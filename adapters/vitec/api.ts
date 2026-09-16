// Vitec Connect over HTTP: basic authentication, the advertising endpoints and their paging.
// Documented in docs/inputs/vitec/ (technical-information.md and api/). Nothing here knows the
// engine, and nothing outside this adapter knows these shapes.
import type { Datatype } from '../../engine/adapter-api/index.js';

/** The Connect key pair from the partner portal (technical-information.md). */
export type Auth = { username: string; password: string };

/**
 * One row of a list endpoint: identity and change date only, named as Connect names them. The
 * `customerId` (M30011 and the like) is the office id: one office, one customer id (Patric).
 */
export type ListRow = { id: string; customerId: string; changedAt: string | null };

/** The advertising resource per datatype. */
const RESOURCE: Record<Datatype, string> = {
  property: 'Estate',
  agent: 'User',
  office: 'Office',
  area: 'Area',
  association: 'Association',
  project: 'Project',
};

/**
 * The datatypes with a list endpoint, in reference order: offices, agents and projects before the
 * properties that point at them. Associations have no list; they are reached from the properties.
 */
export const LISTABLE: readonly Datatype[] = ['office', 'agent', 'area', 'project', 'property'];

/** Every estate extension except the two agents: agents are their own items (proposal point 7). */
const ESTATE_EXTEND =
  'housingCooperative+condominium+foreignProperty+farm+commercialProperty+premises';

const PAGE_SIZE = 100;
const REQUEST_TIMEOUT_MS = 30_000;

/** How many Connect requests run at once, lists included. Vitec states no rate limit (Patric). */
export const concurrency = (): number =>
  Math.max(1, Number(process.env['VITEC_FETCH_CONCURRENCY'] ?? 5));

let inFlight = 0;
const waiting: (() => void)[] = [];

/** Run `send` once a slot is free. */
async function slot<T>(send: () => Promise<T>): Promise<T> {
  if (inFlight >= concurrency()) await new Promise<void>((resolve) => waiting.push(resolve));
  inFlight += 1;
  try {
    return await send();
  } finally {
    inFlight -= 1;
    waiting.shift()?.();
  }
}

export const baseUrl = (): string =>
  (process.env['VITEC_BASE_URL'] ?? 'https://connect.maklare.vitec.net').replace(/\/$/, '');

export class VitecError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'VitecError';
  }
}

/** One page of a list endpoint, as Connect returns it. */
export type Page = {
  index?: number;
  count?: number;
  totalRowCount?: number;
  rows?: Partial<ListRow>[];
};

async function get(
  auth: Auth,
  path: string,
  query: Record<string, string>,
): Promise<unknown | null> {
  const url = new URL(`${baseUrl()}/${path}`);
  for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
  const response = await slot(() =>
    fetch(url, {
      headers: {
        authorization: `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString('base64')}`,
        accept: 'application/json',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }),
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new VitecError(response.status, `${path}: HTTP ${response.status}`);
  return response.json();
}

const segment = encodeURIComponent;

/** One record as Vitec publishes it, or null when Vitec answers 404: the record is gone. */
export function getOne(
  auth: Auth,
  datatype: Datatype,
  officeId: string,
  id: string,
): Promise<unknown | null> {
  const query: Record<string, string> = datatype === 'property' ? { extend: ESTATE_EXTEND } : {};
  return get(auth, `Advertising/${RESOURCE[datatype]}/${segment(officeId)}/${segment(id)}`, query);
}

/** One page of a list endpoint, or null when Connect answers 404. */
export function page(
  auth: Auth,
  datatype: Datatype,
  officeId: string,
  pageIndex: number,
  changedSince?: Date,
  pageSize = PAGE_SIZE,
): Promise<Page | null> {
  const query: Record<string, string> = {
    'paging.pageSize': String(pageSize),
    'paging.pageIndex': String(pageIndex),
  };
  if (changedSince) query['criteria.changedAtMinValue'] = changedSince.toISOString();
  return get(
    auth,
    `Advertising/${RESOURCE[datatype]}/${segment(officeId)}`,
    query,
  ) as Promise<Page | null>;
}

/**
 * Every list row for an office, page by page. Paging stops on an empty page, or when two pages in
 * a row bring nothing new, so it is right whether the server counts pages from 0 or from 1 (the
 * documentation names the parameters, not the first index).
 */
export async function* list(
  auth: Auth,
  datatype: Datatype,
  officeId: string,
  changedSince?: Date,
): AsyncGenerator<ListRow> {
  const seen = new Set<string>();
  let idle = 0;
  for (let pageIndex = 0; idle < 2; pageIndex += 1) {
    const rows = (await page(auth, datatype, officeId, pageIndex, changedSince))?.rows ?? [];
    if (rows.length === 0) return;
    let fresh = 0;
    for (const row of rows) {
      if (!row.id || seen.has(row.id)) continue;
      seen.add(row.id);
      fresh += 1;
      yield {
        id: row.id,
        customerId: row.customerId ?? officeId,
        changedAt: row.changedAt ?? null,
      };
    }
    idle = fresh === 0 ? idle + 1 : 0;
  }
}
