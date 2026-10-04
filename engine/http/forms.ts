// The browser's door to the forms (docs/forms.md, "The widget", question 137): a site's widget
// talks to Core over CORS with the site's public site key. The key opens four things and nothing
// else: the forms config (what the site may send, its area list, the bot gate), one record's
// fields the wizard prefills from, one record's viewing slots, and a submission. Core checks the
// request's Origin against the site's registered addresses, the bot gate's token on a submission
// (question 138), and the rate per address; the submission and the slots then go through the
// same code as the server's door (submissions.ts). The tenant token and the CRM login never
// reach the browser. Nothing here reads a value to decide anything: the config is a list of what
// the store holds, the record's fields are copied as stored.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  connections,
  connectionById,
  siteOrigins,
  subscriberByOrigin,
  subscriberBySiteKey,
} from '../storage/connections.js';
import { itemsForScope, readItem } from '../storage/items.js';
import { manifestFor } from '../registry.js';
import { humanCheck, verifyHuman } from '../human.js';
import { jsonResponse, type Request, type Response } from './server.js';
import { slotsThrough, submitThrough, type Door } from './submissions.js';
import type { Canonical } from '../adapter-api/types.js';

/** More than this from one address in a minute is answered 429 (strategy §13). */
export const SUBMISSIONS_PER_ADDRESS = 10;
const MINUTE_MS = 60_000;
const ALLOW_HEADERS = 'content-type, x-core-site-key, x-core-human, x-core-client';
/** How long a browser may keep the widget before asking again: a fix reaches every site within this. */
const WIDGET_MAX_AGE_S = 300;

type Site = { id: number; tenantId: number; label: string };
type Opened = { site: Site; origin: string } | { response: Response };

const byAddress = new Map<string, number[]>();

/** Test helper: a fresh engine has taken nothing. */
export function resetFormsLimits(): void {
  byAddress.clear();
}

/** The visitor's address: the proxy's header when there is one, else the socket's. */
const addressOf = (request: Request): string | null =>
  request.headers['x-forwarded-for']?.split(',')[0]?.trim() || request.remoteAddress;

function overAddressLimit(address: string | null): boolean {
  const key = address ?? 'unknown';
  const now = Date.now();
  const times = (byAddress.get(key) ?? []).filter((at) => now - at < MINUTE_MS);
  const over = times.length >= SUBMISSIONS_PER_ADDRESS;
  if (!over) times.push(now);
  byAddress.set(key, times);
  return over;
}

/** The CORS headers an answer to this origin carries; the preflight adds what it may ask. */
const cors = (origin: string, response: Response): Response =>
  'raw' in response
    ? response
    : {
        ...response,
        headers: {
          ...response.headers,
          'access-control-allow-origin': origin,
          vary: 'origin',
        },
      };

/**
 * The key, the site and the origin: the three answers given before anything is looked up. A
 * request with no Origin is a browser's only when the page is Core's own, which no site is.
 */
async function open(request: Request): Promise<Opened> {
  const key = request.headers['x-core-site-key'];
  const origin = request.headers['origin'];
  if (!key) return { response: jsonResponse(401, { error: 'the site key is missing' }) };
  const site = await subscriberBySiteKey(key);
  if (!site) return { response: jsonResponse(401, { error: 'no site carries this key' }) };
  if (!origin || !siteOrigins(site).includes(origin)) {
    return {
      response: jsonResponse(403, {
        error: 'the site key is used from an address the site has not registered',
      }),
    };
  }
  if (!site.active) {
    return { response: cors(origin, jsonResponse(403, { error: 'the site is switched off' })) };
  }
  return { site: { id: Number(site.id), tenantId: site.tenant_id, label: site.label }, origin };
}

const door = (site: Site): Door => ({ tenantId: site.tenantId, subscriberId: site.id });

/** `OPTIONS /v1/forms/*`: a browser on a site's address may ask; a stranger gets nothing. */
export async function preflight(request: Request): Promise<Response> {
  const origin = request.headers['origin'];
  const site = origin ? await subscriberByOrigin(origin) : null;
  if (!origin || !site) return { status: 403 };
  return {
    status: 204,
    headers: {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET, POST',
      'access-control-allow-headers': ALLOW_HEADERS,
      'access-control-max-age': '600',
      vary: 'origin',
    },
  };
}

const str = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);
const num = (value: unknown): number | null => (typeof value === 'number' ? value : null);

type Area = { id: string; name: string; county_municipality_code: string | null };

/** The tenant's areas as the CRM lists them, the chips of the profile step, by name. */
async function areasOf(tenantId: number): Promise<Area[]> {
  const rows = await itemsForScope({ tenantId, datatype: 'area' });
  return rows
    .map((row) => {
      const data = row.data ?? {};
      return {
        id: str(data['id']) ?? row.remote_id,
        name: str(data['name']) ?? '',
        county_municipality_code: str(data['county_municipality_code']),
      };
    })
    .filter((area) => area.name !== '')
    .sort((a, b) => a.name.localeCompare(b.name, 'sv'));
}

/** `GET /v1/forms/config`: what this site may send, its areas, and the bot gate to render. */
export async function formsConfig(request: Request): Promise<Response> {
  const opened = await open(request);
  if ('response' in opened) return opened.response;
  const { site, origin } = opened;
  const kinds = new Set<string>();
  for (const connection of await connections()) {
    if (connection.tenant_id !== site.tenantId || !connection.active) continue;
    for (const kind of manifestFor(connection.provider)?.submissions ?? []) kinds.add(kind);
  }
  return cors(
    origin,
    jsonResponse(200, {
      site: site.label,
      kinds: [...kinds],
      areas: await areasOf(site.tenantId),
      human: humanCheck(),
    }),
  );
}

type Found = { connectionId: string; remoteId: string; data: Canonical } | { response: Response };

/** The property a widget asks about: the tenant's, stored, not deleted. */
async function findRecord(request: Request, site: Site): Promise<Found> {
  const connectionId = request.query.get('connection_id');
  const remoteId = request.query.get('remote_id');
  if (!connectionId || !remoteId) {
    return { response: jsonResponse(400, { error: 'connection_id and remote_id are required' }) };
  }
  const connection = await connectionById(connectionId);
  if (!connection || connection.tenantId !== site.tenantId) {
    return { response: jsonResponse(400, { error: 'the record is not one of this tenant’s' }) };
  }
  const item = await readItem({
    tenantId: site.tenantId,
    connectionId,
    datatype: 'property',
    remoteId,
  });
  if (!item || item.deleted) return { response: jsonResponse(400, { error: 'no such record' }) };
  return { connectionId, remoteId, data: item.data ?? {} };
}

/**
 * `GET /v1/forms/record?connection_id=…&remote_id=…`: the fields of the home the wizard shows
 * and prefills from (docs/forms.md, "What the modal asks"): the street for the heading, the
 * rooms and the living space for the profile's minimums, the areas and the municipality code
 * for the chips and the criteria, and the viewings' ids so a viewing's own button can name its
 * viewing. Copied from the stored record; nothing is judged.
 */
export async function formsRecord(request: Request): Promise<Response> {
  const opened = await open(request);
  if ('response' in opened) return opened.response;
  const found = await findRecord(request, opened.site);
  if ('response' in found) return cors(opened.origin, found.response);
  const { data } = found;
  const address = (data['address'] ?? {}) as Canonical;
  const areaIds = Array.isArray(data['area_ids']) ? (data['area_ids'] as unknown[]) : [];
  const areas = (await areasOf(opened.site.tenantId)).filter((area) => areaIds.includes(area.id));
  const viewings = Array.isArray(data['viewings']) ? (data['viewings'] as Canonical[]) : [];
  return cors(
    opened.origin,
    jsonResponse(200, {
      title: str(address['street']),
      rooms: num(data['rooms']),
      living_space: num(data['living_space']),
      areas,
      county_municipality_code: str(address['county_municipality_code']),
      viewings: viewings.map((viewing) => ({
        id: str(viewing['id']),
        starts_at: str(viewing['starts_at']),
        ends_at: str(viewing['ends_at']),
      })),
    }),
  );
}

/** `GET /v1/forms/slots`: the same read as the server's door, for this site's tenant. */
export async function formsSlots(request: Request): Promise<Response> {
  const opened = await open(request);
  if ('response' in opened) return opened.response;
  return cors(opened.origin, await slotsThrough(request, door(opened.site)));
}

/**
 * `POST /v1/forms/submissions`: the bot gate's token and the address's rate, then the same
 * sending as the server's door, with the site known.
 */
export async function formsSubmit(request: Request): Promise<Response> {
  const opened = await open(request);
  if ('response' in opened) return opened.response;
  const { site, origin } = opened;
  const address = addressOf(request);
  if (overAddressLimit(address)) {
    return cors(
      origin,
      jsonResponse(429, {
        error: `more than ${String(SUBMISSIONS_PER_ADDRESS)} submissions in a minute from this address; try again shortly`,
      }),
    );
  }
  if (!(await verifyHuman(request.headers['x-core-human'] ?? null, address))) {
    return cors(origin, jsonResponse(403, { error: 'the human check did not pass' }));
  }
  return cors(origin, await submitThrough(request, door(site)));
}

const here = dirname(fileURLToPath(import.meta.url));
/** Built: `dist/engine/http` sits beside `dist/widget`. Run from source: `dist/widget` under the cwd. */
const WIDGET_CANDIDATES = [
  join(here, '..', '..', 'widget', 'forms.js'),
  join(process.cwd(), 'dist', 'widget', 'forms.js'),
];

/**
 * `GET /widget/forms.js`: the widget as `npm run build` makes it (clients/forms-widget), with a
 * short cache so a fix reaches every site without a deploy of theirs.
 */
export function widgetFile(): Response {
  const path = WIDGET_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!path) {
    return jsonResponse(503, {
      error: 'the forms widget is not built; run npm run build and start Core again',
    });
  }
  return {
    status: 200,
    body: readFileSync(path),
    headers: {
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': `public, max-age=${String(WIDGET_MAX_AGE_S)}`,
    },
  };
}
