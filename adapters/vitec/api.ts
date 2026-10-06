// Vitec Connect over HTTP: basic authentication, the advertising endpoints and their paging.
// Documented in docs/inputs/vitec/ (technical-information.md and api/). Nothing here knows the
// engine, and nothing outside this adapter knows these shapes.
import type { Datatype, EventContext } from '../../engine/adapter-api/index.js';

/**
 * Vitec's systems a login can be for (question 169 a): `live`, the Connect the brokerages work in,
 * and `qa`, Vitec's QA environment, a test copy of it at its own address. Nothing else differs.
 */
export const ENVIRONMENTS = ['live', 'qa'] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

/** The Connect key pair from the partner portal (technical-information.md), and its system. */
export type Auth = { username: string; password: string; environment: Environment };

/**
 * A connection's login as its page stores it: the Connect key pair, the customer or group id Vitec
 * issued it for, the CRM function group's own password when Vitec issued one, and the system, QA
 * when the field `qa` says yes and live otherwise.
 */
export type Login = Auth & { customerId: string | null; crmPassword: string | null };

/** The login for Vitec's CRM calls: the CRM function group's own password when Vitec issued one. */
export const crmAuthOf = (login: Login): Auth => ({
  username: login.username,
  password: login.crmPassword ?? login.password,
  environment: login.environment,
});

/** The stored login, or null when it holds no key pair. */
export function loginOf(stored: string | null): Login | null {
  try {
    const parsed = JSON.parse(stored ?? '') as Record<string, unknown>;
    const text = (key: string): string | null => {
      const value = parsed[key];
      return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
    };
    if (typeof parsed['username'] !== 'string' || typeof parsed['password'] !== 'string') {
      return null;
    }
    return {
      username: parsed['username'],
      password: parsed['password'],
      environment: text('qa')?.toLowerCase() === 'yes' ? 'qa' : 'live',
      customerId: text('customer_id'),
      crmPassword: text('crm_password'),
    };
  } catch {
    return null;
  }
}

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

/** Requests per second at most, lists included, so a load never looks like an attack. */
export const requestsPerSecond = (): number =>
  Math.max(1, Number(process.env['VITEC_REQUESTS_PER_SECOND'] ?? 10));

/** How long a Retry-After is honoured at most. */
const HOLD_MAX_MS = 5 * 60_000;

/** One system's traffic: requests running and waiting, the next start, and Vitec's own hold. */
type Limiter = {
  inFlight: number;
  waiting: (() => void)[];
  nextStartAt: number;
  holdUntil: number;
};

const idle = (): Limiter => ({ inFlight: 0, waiting: [], nextStartAt: 0, holdUntil: 0 });

/**
 * Each system has its own limits (question 169 a): the requests at once, the requests per second
 * and a Retry-After Vitec asked for. With each system's own turn at the fetch list (index.ts), a
 * slow or busy QA never holds up live Vitec's fetches.
 */
const limiters: Record<Environment, Limiter> = { live: idle(), qa: idle() };

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Wait for the speed limit, and for any Retry-After Vitec asked for. */
async function pace(limiter: Limiter): Promise<void> {
  const interval = 1000 / requestsPerSecond();
  const now = Date.now();
  const at = Math.max(now, limiter.nextStartAt, limiter.holdUntil);
  limiter.nextStartAt = at + interval;
  if (at > now) await sleep(at - now);
}

/** Honour a Retry-After header (seconds, or a date), for at most HOLD_MAX_MS. */
function hold(limiter: Limiter, header: string | null): void {
  if (!header) return;
  const seconds = Number(header);
  const ms = Number.isFinite(seconds) ? seconds * 1000 : new Date(header).getTime() - Date.now();
  if (ms > 0) limiter.holdUntil = Date.now() + Math.min(ms, HOLD_MAX_MS);
}

/** Run `send` once a slot is free and the speed limit allows. */
async function slot<T>(limiter: Limiter, send: () => Promise<T>): Promise<T> {
  if (limiter.inFlight >= concurrency()) {
    await new Promise<void>((resolve) => limiter.waiting.push(resolve));
  }
  limiter.inFlight += 1;
  try {
    await pace(limiter);
    return await send();
  } finally {
    limiter.inFlight -= 1;
    limiter.waiting.shift()?.();
  }
}

/** Vitec's QA environment, at the address Patric remembered (question 169 a). */
const QA_URL = 'https://connect-qa.maklare.vitec.net';
let qaUrl = QA_URL;

/** Where a system's Connect is: the live one from VITEC_BASE_URL, QA's at its own address. */
export const baseUrlOf = (environment: Environment): string =>
  environment === 'qa'
    ? qaUrl
    : (process.env['VITEC_BASE_URL'] ?? 'https://connect.maklare.vitec.net').replace(/\/$/, '');

/** Test use: QA at a stand-in, or back at Vitec's own address with null. */
export function pointQaAt(url: string | null): void {
  qaUrl = url ?? QA_URL;
}

/** One request as it went, for the event log: what was asked, what came back, how long it took. */
export type Call = {
  method: 'GET' | 'POST';
  endpoint: string;
  query: Record<string, string>;
  status: number | null;
  duration_ms: number;
  response_bytes: number | null;
  error?: string;
  /** The record and the notification the call was for, when it was for one. */
  trace?: EventContext;
};

let observer: ((call: Call) => void) | null = null;

/** Hear about every request made; the adapter puts them in the event log (question 9). */
export function onCall(fn: ((call: Call) => void) | null): void {
  observer = fn;
}

export class VitecError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'VitecError';
  }
}

/**
 * What a failed call means for the adapter's guards: `forbidden` is 401 or 403 (a closed office,
 * a licence gone), `unavailable` is Vitec down, busy or unreachable, `broken` is an answer that is
 * not JSON, and `other` is anything else.
 */
export type FailureKind = 'forbidden' | 'unavailable' | 'broken' | 'other';

export function kindOf(error: unknown): FailureKind {
  if (error instanceof VitecError) {
    if (error.status === 401 || error.status === 403) return 'forbidden';
    if (error.message.includes('broken JSON')) return 'broken';
    if (error.status === 429 || error.status >= 500) return 'unavailable';
    return 'other';
  }
  const name = error instanceof Error ? error.name : '';
  return name === 'TimeoutError' || name === 'AbortError' || name === 'TypeError'
    ? 'unavailable'
    : 'other';
}

/**
 * One page of a list endpoint, as Connect returns it: `index` counts pages from 0, `count` is the
 * number of pages and `totalRowCount` the number of rows (verified against Connect, 2026-09-17).
 */
export type Page = {
  index?: number;
  count?: number;
  totalRowCount?: number;
  rows?: Partial<ListRow>[];
};

/** The start of an answer, for an error message: enough to see what Vitec sent, never the lot. */
const snippet = (text: string): string => text.replace(/\s+/g, ' ').slice(0, 200);

async function get(
  auth: Auth,
  path: string,
  query: Record<string, string>,
  trace?: EventContext,
): Promise<unknown | null> {
  const url = new URL(`${baseUrlOf(auth.environment)}/${path}`);
  const limiter = limiters[auth.environment];
  for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
  const startedAt = Date.now();
  const call: Call = {
    method: 'GET',
    endpoint: `/${path}`,
    query,
    status: null,
    duration_ms: 0,
    response_bytes: null,
    trace,
  };
  try {
    const response = await slot(limiter, () =>
      fetch(url, {
        headers: {
          authorization: `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString('base64')}`,
          accept: 'application/json',
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }),
    );
    call.status = response.status;
    if (response.status === 429 || response.status === 503)
      hold(limiter, response.headers.get('retry-after'));
    const text = await response.text();
    call.response_bytes = Buffer.byteLength(text);
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new VitecError(response.status, `${path}: HTTP ${response.status} ${snippet(text)}`);
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new VitecError(response.status, `${path}: broken JSON: ${snippet(text)}`);
    }
  } catch (error) {
    call.error = String(error);
    throw error;
  } finally {
    call.duration_ms = Date.now() - startedAt;
    observer?.(call);
  }
}

/**
 * A text with no e-mail address and no long run of digits left in it: what Vitec says about a
 * form may echo a field the visitor typed, and that must reach neither the event log nor the
 * error tracker (docs/forms.md, "Security": Core logs ids and outcomes, never the person).
 */
export const scrub = (text: string): string =>
  text
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[e-mail]')
    .replace(/[+\d][\d\s-]{5,}\d/g, '[number]');

/**
 * One POST with a JSON body, as the form calls are made (docs/forms.md): the answer parsed, null
 * when Connect answers with no body (204), and a `VitecError` with Vitec's words for anything
 * else, 404 included. The body is never in the event log; the status, size and time are.
 */
export async function post(
  auth: Auth,
  path: string,
  body: unknown,
  trace?: EventContext,
): Promise<unknown | null> {
  const url = new URL(`${baseUrlOf(auth.environment)}/${path}`);
  const limiter = limiters[auth.environment];
  const startedAt = Date.now();
  const call: Call = {
    method: 'POST',
    endpoint: `/${path}`,
    query: {},
    status: null,
    duration_ms: 0,
    response_bytes: null,
    trace,
  };
  try {
    const response = await slot(limiter, () =>
      fetch(url, {
        method: 'POST',
        headers: {
          authorization: `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString('base64')}`,
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }),
    );
    call.status = response.status;
    if (response.status === 429 || response.status === 503)
      hold(limiter, response.headers.get('retry-after'));
    const text = await response.text();
    call.response_bytes = Buffer.byteLength(text);
    if (!response.ok) {
      throw new VitecError(
        response.status,
        `${path}: HTTP ${String(response.status)} ${scrub(snippet(text))}`,
      );
    }
    if (!text.trim()) return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new VitecError(response.status, `${path}: broken JSON: ${scrub(snippet(text))}`);
    }
  } catch (error) {
    call.error = String(error);
    throw error;
  } finally {
    call.duration_ms = Date.now() - startedAt;
    observer?.(call);
  }
}

const segment = encodeURIComponent;

/**
 * What the form endpoint knows about a home: its viewings with their time slots, as a booking
 * needs them (`GET v2/Advertising/Form/{customerId}/Estate/{estateId}`), or null on 404.
 */
export function form(
  auth: Auth,
  officeId: string,
  estateId: string,
  trace?: EventContext,
): Promise<unknown | null> {
  return get(
    auth,
    `v2/Advertising/Form/${segment(officeId)}/Estate/${segment(estateId)}`,
    {},
    trace,
  );
}

/** One record as Vitec publishes it, or null when Vitec answers 404: the record is gone. */
export function getOne(
  auth: Auth,
  datatype: Datatype,
  officeId: string,
  id: string,
  trace?: EventContext,
): Promise<unknown | null> {
  const query: Record<string, string> = datatype === 'property' ? { extend: ESTATE_EXTEND } : {};
  return get(
    auth,
    `Advertising/${RESOURCE[datatype]}/${segment(officeId)}/${segment(id)}`,
    query,
    trace,
  );
}

/** One office group as Vitec's CRM keeps it: its name and the ids of the offices in it. */
export type OfficeGroup = { id: string; name: string; officeIds: string[] };

/**
 * The office groups a brokerage keeps in Vitec (`GET CRM/Officegroups/{customerId}`, the
 * version 1 CRM category, docs/inputs/vitec/api/). Answered with the CRM function group's rights;
 * an empty list when Connect answers 404.
 */
export async function officeGroups(
  auth: Auth,
  customerId: string,
  trace?: EventContext,
): Promise<OfficeGroup[]> {
  const answer = await get(auth, `CRM/Officegroups/${segment(customerId)}`, {}, trace);
  if (!Array.isArray(answer)) return [];
  const text = (value: unknown): string => (typeof value === 'string' ? value : '');
  return answer.map((group: Record<string, unknown>) => ({
    id: text(group['id']),
    name: text(group['name']),
    officeIds: (Array.isArray(group['offices']) ? group['offices'] : [])
      .map((office: Record<string, unknown>) => text(office['id']))
      .filter((id) => id !== ''),
  }));
}

/** One page of a list endpoint, or null when Connect answers 404. */
export function page(
  auth: Auth,
  datatype: Datatype,
  officeId: string,
  pageIndex: number,
  changedSince?: Date,
  pageSize = PAGE_SIZE,
  trace?: EventContext,
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
    trace,
  ) as Promise<Page | null>;
}

/**
 * Every list row for an office, page by page: pages count from 0, and paging stops after the page
 * `count` names as the last, or on an empty one.
 */
export async function* list(
  auth: Auth,
  datatype: Datatype,
  officeId: string,
  changedSince?: Date,
  trace?: EventContext,
): AsyncGenerator<ListRow> {
  for (let pageIndex = 0; ; pageIndex += 1) {
    const result = await page(auth, datatype, officeId, pageIndex, changedSince, PAGE_SIZE, trace);
    const rows = result?.rows ?? [];
    for (const row of rows) {
      if (!row.id) continue;
      yield {
        id: row.id,
        customerId: row.customerId ?? officeId,
        changedAt: row.changedAt ?? null,
      };
    }
    const last = result?.count !== undefined && pageIndex + 1 >= result.count;
    if (rows.length === 0 || last) return;
  }
}
