// The Vitec Connect adapter (strategy §5.3): two independent paths, both inside the adapter.
//
//   Vitec webhook ──► token check ──► fetch list ──► 202
//   worker ──► Update: fetch, five at a time ──► found: ingest · gone: notFound · failed: retry later
//          ──► Remove: notFound, no fetch
//   every 12 h ──► "what changed since the last catch-up, less one hour" ──► fetch list
//   every 24 h ──► Vitec's full id list against the ids seen ──► missing ones removed
//   every 24 h ──► the offices behind the login's id, each read; the group "webbplats" or all ──►
//                  offices that came are loaded, offices that went are taken off (offices.ts)
//
// Core syncs what Vitec lists for the sites, the marketed estates, and nothing else (Patric,
// 2026-09-17): in the list means on the sites; a Remove notification, or an id gone from the list,
// means removed. Nothing here reads a field's value; the list and the notifications define what
// exists. Vitec's estate subscription is limited to estates advertised on the website, so Update
// means marketed and Remove means not any more.
//
// Vitec misbehaves at times (Patric, 2026-09-18), and the adapter guards itself: after five
// failures in a row a connection pauses and probes its way back with growing waits; a 403 blocks
// the office at once, its records wait, and one probe per cool-down brings it back with a full
// load; a broken answer is kept in the event and retried; requests are capped per second and
// Vitec's own Retry-After is honoured (api.ts).
//
// A connection's credentials are a JSON document, `{"username", "password"}`: the Connect key
// pair. Its licensed offices are the office ids, which are what Connect calls customer ids
// (M30011 and the like): every URL and notification carries one. They are also the fetch scope,
// so a connection without offices fetches nothing and says so in `vitec.catch_up`.
import { randomUUID, timingSafeEqual } from 'node:crypto';
import * as connect from './api.js';
import * as store from './store.js';
import * as forms from './forms.js';
import { changedAtOf, isoDate, mappers, referencedIds } from './mappers.js';
import { refetchOffice, vitecAdmin } from './admin/index.js';
import { CHECK_EVERY_MS, checkOffices, officesOf } from './offices.js';
import { DATATYPES } from '../../engine/adapter-api/index.js';
import type {
  Adapter,
  AdapterApi,
  Connection,
  Datatype,
  EventContext,
  HealthResult,
  Route,
} from '../../engine/adapter-api/index.js';

const PROVIDER = 'vitec';
const DRAIN_MS = 250;
const SCHEDULE_MS = 60_000;
const CATCH_UP_EVERY_MS = 12 * 3_600_000;
const CATCH_UP_OVERLAP_MS = 3_600_000;
const CATCH_UP_LIMIT_MS = 13 * 3_600_000;
const COMPARE_EVERY_MS = 24 * 3_600_000;
const LAG_LIMIT_MS = 5 * 60_000;
const RETRIES_RED = 3;
/** A connection pauses after this many failures in a row on Vitec's side. */
const PAUSE_AFTER = 5;
const PAUSE_BASE_MS = 2 * 60_000;
const PAUSE_MAX_MS = 30 * 60_000;
/** An office Vitec refuses is probed after this long, doubling per failed probe. */
const BLOCK_BASE_MS = 3_600_000;
const BLOCK_MAX_MS = 24 * 3_600_000;

/**
 * The login as the connection's page stores it: the Connect key pair, the customer or group id
 * Vitec issued it for, and the CRM function group's own password when Vitec issued one.
 */
type Credentials = {
  username: string;
  password: string;
  customerId: string | null;
  crmPassword: string | null;
};
/** A connection the adapter works for, with the offices it syncs (`officesOf`). */
type Live = { connection: Connection; credentials: Credentials; offices: string[] };

/** Vitec's notification `type` per datatype; users are documented as both `User` and `Agent`. */
const NOTIFIED: Record<string, Datatype> = {
  estate: 'property',
  project: 'project',
  user: 'agent',
  agent: 'agent',
  office: 'office',
  area: 'area',
};

let engine: AdapterApi | null = null;
let drainTimer: NodeJS.Timeout | null = null;
let scheduleTimer: NodeJS.Timeout | null = null;
/** Drains run one after another; a second one waiting would find nothing the first will not. */
let draining: Promise<void> = Promise.resolve();
let drainWaiting = false;
let scheduling: Promise<void> = Promise.resolve();

const serial = (run: () => Promise<void>, chain: Promise<void>): Promise<void> =>
  chain.then(run, run);

const scheduleDrain = (): Promise<void> => {
  if (!drainWaiting) {
    drainWaiting = true;
    draining = serial(() => {
      drainWaiting = false;
      return drainOnce();
    }, draining);
  }
  return draining;
};

const scheduleTick = (): Promise<void> => {
  scheduling = serial(tickOnce, scheduling);
  return scheduling;
};

function credentialsOf(connection: Connection): Credentials | null {
  if (!connection.credentials) return null;
  try {
    const parsed = JSON.parse(connection.credentials) as Record<string, unknown>;
    const text = (key: string): string | null => {
      const value = parsed[key];
      return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
    };
    if (typeof parsed['username'] === 'string' && typeof parsed['password'] === 'string') {
      return {
        username: parsed['username'],
        password: parsed['password'],
        customerId: text('customer_id'),
        crmPassword: text('crm_password'),
      };
    }
  } catch {
    // reported below as unreadable
  }
  return null;
}

/** Active connections with a readable login. One with no offices yet shows up in `vitec.catch_up`. */
async function live(current: AdapterApi): Promise<Live[]> {
  const result: Live[] = [];
  for (const connection of await current.connections()) {
    if (!connection.active) continue;
    const credentials = credentialsOf(connection);
    if (credentials) result.push({ connection, credentials, offices: await officesOf(connection) });
  }
  return result;
}

// ---- The guards: a paused connection, a blocked office ----------------------------------------

type Pause = { failures: number; pausedUntil: number | null; pauseMs: number; probing: boolean };

async function pauseOf(connectionId: string): Promise<Pause> {
  const [failures, until, pauseMs, probing] = await Promise.all([
    store.getState(connectionId, 'failures'),
    store.getState(connectionId, 'paused_until'),
    store.getState(connectionId, 'pause_ms'),
    store.getState(connectionId, 'probing'),
  ]);
  return {
    failures: Number(failures ?? 0),
    pausedUntil: until ? new Date(until).getTime() : null,
    pauseMs: Number(pauseMs ?? PAUSE_BASE_MS),
    probing: probing === '1',
  };
}

const paused = (pause: Pause): boolean =>
  pause.pausedUntil !== null && pause.pausedUntil > Date.now();

/** A call failed on Vitec's side: count it, and pause the connection at PAUSE_AFTER in a row. */
async function noteFailure(current: AdapterApi, live: Live, detail: string): Promise<void> {
  const id = live.connection.id;
  // Fetches fail side by side, so the count and the pause are both settled in the database.
  const failures = await store.increment(id, 'failures');
  if (failures < PAUSE_AFTER) return;
  const pause = await pauseOf(id);
  if (paused(pause)) return;
  const until = new Date(Date.now() + pause.pauseMs);
  if (!(await store.setIfEmpty(id, 'paused_until', until.toISOString()))) return;
  await store.setState(id, 'pause_ms', String(Math.min(pause.pauseMs * 2, PAUSE_MAX_MS)));
  await store.setState(id, 'probing', '');
  await current.logEvent(
    'connect.paused',
    { connection_id: id, failures, until: until.toISOString(), detail },
    { connectionId: id },
  );
  current.report(new Error('vitec connection paused'), { connection_id: id, failures, detail });
}

/** Vitec answered: the run of failures ends, and a probing connection is back for good. */
async function noteSuccess(current: AdapterApi, live: Live): Promise<void> {
  const id = live.connection.id;
  const pause = await pauseOf(id);
  if (pause.failures === 0 && !pause.probing) return;
  await store.setState(id, 'failures', '0');
  await store.setState(id, 'pause_ms', String(PAUSE_BASE_MS));
  await store.setState(id, 'probing', '');
  if (pause.probing) {
    await current.logEvent('connect.resumed', { connection_id: id }, { connectionId: id });
  }
}

/** A pause that has run out lets the next fetches through as a probe: one more failure pauses again. */
async function resumeDue(targets: Live[]): Promise<void> {
  for (const target of targets) {
    const pause = await pauseOf(target.connection.id);
    if (pause.pausedUntil === null || pause.pausedUntil > Date.now()) continue;
    await store.setState(target.connection.id, 'paused_until', '');
    await store.setState(target.connection.id, 'failures', String(PAUSE_AFTER - 1));
    await store.setState(target.connection.id, 'probing', '1');
  }
}

/** Vitec refused an office: block it at once, once. */
async function blockOffice(
  current: AdapterApi,
  live: Live,
  officeId: string,
  detail: string,
): Promise<void> {
  const fresh = await store.blockOffice(officeId, detail, BLOCK_BASE_MS, BLOCK_MAX_MS);
  if (!fresh) return;
  await current.logEvent(
    'office.blocked',
    { office_id: officeId, connection_id: live.connection.id, detail },
    { connectionId: live.connection.id },
  );
  current.report(new Error('vitec office blocked'), {
    office_id: officeId,
    connection_id: live.connection.id,
    detail,
  });
}

/** Offices the drain leaves alone: blocked ones, and every office of a paused connection. */
async function skippedOffices(targets: Live[]): Promise<string[]> {
  const skipped = new Set((await store.blockedOffices()).map((office) => office.officeId));
  for (const target of targets) {
    if (paused(await pauseOf(target.connection.id))) {
      for (const officeId of target.offices) skipped.add(officeId);
    }
  }
  return [...skipped];
}

/**
 * One probe per blocked office whose cool-down has passed: a single list request. Back means
 * unblocked and loaded in full, so nothing that happened while it was refused is missed; refused
 * again means a longer cool-down.
 */
async function probeOffices(current: AdapterApi, targets: Live[]): Promise<void> {
  for (const office of await store.probesDue()) {
    const owner = targets.find((t) => t.offices.includes(office.officeId));
    if (!owner) {
      await store.unblockOffice(office.officeId);
      continue;
    }
    if (paused(await pauseOf(owner.connection.id))) continue;
    const trace: EventContext = { connectionId: owner.connection.id };
    try {
      await connect.page(owner.credentials, 'office', office.officeId, 0, undefined, 1, trace);
      await store.unblockOffice(office.officeId);
      await current.logEvent(
        'office.unblocked',
        { office_id: office.officeId, probes: office.probes + 1 },
        trace,
      );
      await load(owner, [office.officeId]);
    } catch (error) {
      if (connect.kindOf(error) === 'forbidden') {
        await store.blockOffice(office.officeId, String(error), BLOCK_BASE_MS, BLOCK_MAX_MS);
      } else {
        await noteFailure(current, owner, String(error));
      }
    }
  }
}

// ---- Path 1: webhooks -------------------------------------------------------------------------

type Notification = {
  officeId: string;
  id: string;
  datatype: Datatype | null;
  reason: 'webhook' | 'remove';
};

/** Vitec sends the parameters as JSON and as query parameters (notifications.md); JSON first. */
function parseNotification(
  body: Buffer,
  query: string | undefined,
): Notification | { error: string } {
  let json: Record<string, unknown> = {};
  if (body.length > 0) {
    try {
      json = JSON.parse(body.toString('utf8')) as Record<string, unknown>;
    } catch {
      return { error: 'malformed body' };
    }
  }
  const params = new URLSearchParams(query ?? '');
  const field = (name: string): string | null => {
    const value = json[name] ?? params.get(name);
    return typeof value === 'string' && value !== '' ? value : null;
  };
  const type = field('type');
  if (!type) return { error: 'type is required' };
  const datatype = NOTIFIED[type.toLowerCase()] ?? null;
  if (!datatype) return { officeId: '', id: '', datatype: null, reason: 'webhook' };
  const officeId = field('customerId');
  const id = field('id');
  if (!officeId || !id) return { error: 'customerId and id are required' };
  const reason = field('event')?.toLowerCase() === 'remove' ? 'remove' : 'webhook';
  return { officeId, id, datatype, reason };
}

/** The largest notification body the event log keeps whole; Vitec's are a few hundred bytes. */
const BODY_LIMIT = 10_000;

/** What Vitec sent, as the log keeps it: the JSON when it parses, the text otherwise, cut at the limit. */
function bodyOf(body: Buffer): unknown {
  const text = body.toString('utf8');
  if (text === '') return null;
  try {
    return text.length <= BODY_LIMIT ? JSON.parse(text) : text.slice(0, BODY_LIMIT);
  } catch {
    return text.slice(0, BODY_LIMIT);
  }
}

const tokenMatches = (given: string | undefined, expected: string): boolean =>
  given !== undefined &&
  given.length === expected.length &&
  timingSafeEqual(Buffer.from(given), Buffer.from(expected));

const routes: Route[] = [
  {
    method: 'POST',
    path: 'webhook/*',
    handler: async (request, api) => {
      const expected = process.env['VITEC_WEBHOOK_TOKEN'];
      if (!expected) return { status: 503, body: { error: 'VITEC_WEBHOOK_TOKEN is not set' } };
      // Every arrival goes in the event log with what Vitec sent, kept as long as the log keeps
      // events (Patric, 2026-09-20, question 63), and a queued one onto its record's timeline (AC 16).
      const [path, query] = request.url.split('?');
      const arrived = (fields: Record<string, unknown>, context?: EventContext): Promise<void> =>
        api.logEvent(
          'webhook.received',
          {
            path: '/v1/hook/vitec/webhook',
            body: bodyOf(request.body),
            ...(query ? { query } : {}),
            ...fields,
          },
          context,
        );
      if (!tokenMatches(path?.split('/').pop(), expected)) {
        await arrived({ outcome: 'rejected', detail: 'bad token', response: 401 });
        return { status: 401, body: { error: 'bad token' } };
      }
      const notification = parseNotification(request.body, query);
      if ('error' in notification) {
        await arrived({ outcome: 'rejected', detail: notification.error, response: 400 });
        return { status: 400, body: { error: notification.error } };
      }
      if (!notification.datatype) {
        await arrived({ outcome: 'ignored', detail: 'a type Core does not sync', response: 202 });
        return { status: 202, body: { ignored: true } };
      }
      // Never fetch inside the request: a burst must not become a burst of Connect calls.
      const correlationId = randomUUID();
      let owner: Connection | undefined;
      for (const candidate of await api.connections()) {
        if (candidate.active && (await officesOf(candidate)).includes(notification.officeId)) {
          owner = candidate;
          break;
        }
      }
      await arrived(
        {
          outcome: 'queued',
          office_id: notification.officeId,
          datatype: notification.datatype,
          remote_id: notification.id,
          event: notification.reason,
          response: 202,
        },
        {
          correlationId,
          connectionId: owner?.id ?? null,
          datatype: notification.datatype,
          remoteId: notification.id,
        },
      );
      await store.enqueue([
        {
          officeId: notification.officeId,
          datatype: notification.datatype,
          remoteId: notification.id,
          reason: notification.reason,
          correlationId,
        },
      ]);
      return { status: 202, body: { queued: true, correlation_id: correlationId } };
    },
  },
];

// ---- The fetch list ---------------------------------------------------------------------------

async function drainOnce(): Promise<void> {
  const current = engine;
  if (!current) return;
  const targets = await live(current);
  for (;;) {
    if (!engine) return;
    const claimed = await store.claim(connect.concurrency(), await skippedOffices(targets));
    if (claimed.length === 0) return;
    await Promise.all(claimed.map((entry) => fetchOne(entry, targets, current)));
  }
}

/**
 * One record: fetched once and ingested into every connection that licenses its office, or, on a
 * removal, tombstoned in each of them without a fetch: the record left the sites' scope.
 */
async function fetchOne(entry: store.Entry, targets: Live[], current: AdapterApi): Promise<void> {
  const owners = targets.filter((live) => live.offices.includes(entry.officeId));
  if (entry.reason === 'remove') {
    for (const { connection } of owners) {
      await current.notFound(connection, entry.datatype, entry.remoteId);
    }
    await store.forget(entry.officeId, entry.datatype, entry.remoteId);
    return;
  }
  const first = owners[0];
  if (!first) {
    await current.logEvent(
      'fetch.orphan',
      {
        office_id: entry.officeId,
        datatype: entry.datatype,
        remote_id: entry.remoteId,
        detail: 'no active connection licenses this office',
      },
      { correlationId: entry.correlationId, datatype: entry.datatype, remoteId: entry.remoteId },
    );
    return;
  }
  const trace: EventContext = {
    correlationId: entry.correlationId,
    connectionId: first.connection.id,
    datatype: entry.datatype,
    remoteId: entry.remoteId,
  };
  try {
    const payload = await connect.getOne(
      first.credentials,
      entry.datatype,
      entry.officeId,
      entry.remoteId,
      trace,
    );
    await noteSuccess(current, first);
    if (payload === null) {
      for (const { connection } of owners) {
        await current.notFound(connection, entry.datatype, entry.remoteId);
      }
      await store.forget(entry.officeId, entry.datatype, entry.remoteId);
      return;
    }
    for (const { connection } of owners) {
      await current.ingest(connection, entry.datatype, entry.remoteId, payload, {
        correlationId: entry.correlationId,
      });
    }
    await store.remember(entry.officeId, entry.datatype, entry.remoteId, changedAtOf(payload));
    await queueReferences(entry, payload);
  } catch (error) {
    await failed(entry, first, error, current, trace);
  }
}

/** A fetch failed: what happens next depends on why. Never a delete (strategy §5.3). */
async function failed(
  entry: store.Entry,
  live: Live,
  error: unknown,
  current: AdapterApi,
  trace: EventContext,
): Promise<void> {
  const kind = connect.kindOf(error);
  if (kind === 'forbidden') {
    await store.park(entry);
    await blockOffice(current, live, entry.officeId, String(error));
    return;
  }
  if (kind !== 'other') await noteFailure(current, live, String(error));
  const outcome = await store.requeue(entry, String(error));
  if (outcome === 'given_up') {
    const fields = {
      office_id: entry.officeId,
      datatype: entry.datatype,
      remote_id: entry.remoteId,
      attempts: entry.attempts + 1,
      detail: String(error),
    };
    await current.logEvent('fetch.failed', fields, trace);
    current.report(new Error('vitec fetch given up'), fields);
  }
}

/** Associations have no list, and a project may not be listed yet: fetch what a record names. */
async function queueReferences(entry: store.Entry, payload: unknown): Promise<void> {
  const missing = [];
  for (const reference of referencedIds(entry.datatype, payload)) {
    if (!(await store.isKnown(entry.officeId, reference.datatype, reference.id))) {
      missing.push({
        officeId: entry.officeId,
        datatype: reference.datatype,
        remoteId: reference.id,
        reason: 'reference' as const,
        correlationId: entry.correlationId,
      });
    }
  }
  await store.enqueue(missing);
}

// ---- Listing: initial load, resync, catch-up and the daily comparison --------------------------

/** What Vitec lists, per datatype and office: each id with its change date. */
type Listed = Map<Datatype, Map<string, Map<string, string | null>>>;

/** Every id Vitec lists for the given offices, per datatype and office. */
async function listAll(
  live: Live,
  offices: readonly string[],
  datatypes: readonly Datatype[],
  changedSince?: Date,
): Promise<Listed> {
  const listed: Listed = new Map();
  const blocked = new Set((await store.blockedOffices()).map((office) => office.officeId));
  for (const datatype of datatypes) {
    const perOffice = new Map<string, Map<string, string | null>>();
    for (const officeId of offices) {
      if (blocked.has(officeId)) continue;
      const ids = new Map<string, string | null>();
      const trace: EventContext = { connectionId: live.connection.id };
      try {
        for await (const row of connect.list(
          live.credentials,
          datatype,
          officeId,
          changedSince,
          trace,
        )) {
          ids.set(row.id, isoDate(row.changedAt));
        }
      } catch (error) {
        // A refused office stops here, the others go on; anything else fails the schedule.
        if (connect.kindOf(error) !== 'forbidden' || !engine) throw error;
        blocked.add(officeId);
        await blockOffice(engine, live, officeId, String(error));
        continue;
      }
      perOffice.set(officeId, ids);
    }
    listed.set(datatype, perOffice);
  }
  return listed;
}

/**
 * Put what was listed on the fetch list. A catch-up skips a record whose change date is the one
 * seen at its last fetch (Patric, 2026-09-17); a load or resync fetches everything listed.
 */
async function enqueueListed(
  listed: Listed,
  reason: store.Reason,
  onlyChanged: boolean,
): Promise<void> {
  const correlationId = randomUUID();
  for (const [datatype, perOffice] of listed) {
    for (const [officeId, ids] of perOffice) {
      const seen = onlyChanged
        ? await store.known(officeId, datatype)
        : new Map<string, string | null>();
      const wanted = [...ids].filter(
        ([id, changedAt]) => changedAt === null || seen.get(id) !== changedAt,
      );
      await store.enqueue(
        wanted.map(([remoteId]) => ({ officeId, datatype, remoteId, reason, correlationId })),
      );
    }
  }
}

/** The ids seen before that Vitec no longer lists: they left the sites' scope, so they are removed. */
async function enqueueMissing(listed: Listed): Promise<void> {
  const correlationId = randomUUID();
  for (const [datatype, perOffice] of listed) {
    for (const [officeId, ids] of perOffice) {
      const missing = [...(await store.known(officeId, datatype)).keys()].filter(
        (id) => !ids.has(id),
      );
      await store.enqueue(
        missing.map((remoteId) => ({
          officeId,
          datatype,
          remoteId,
          reason: 'remove',
          correlationId,
        })),
      );
    }
  }
}

const listable = (datatype?: Datatype): readonly Datatype[] =>
  datatype ? connect.LISTABLE.filter((candidate) => candidate === datatype) : connect.LISTABLE;

/** Everything the given offices publish, onto the list after any webhook fetches. */
async function load(live: Live, offices: readonly string[], datatype?: Datatype): Promise<void> {
  const startedAt = new Date();
  const listed = await listAll(live, offices, listable(datatype));
  await enqueueListed(listed, 'load', false);
  await enqueueMissing(listed);
  // Only a load of every office is a catch-up and a comparison of the whole connection.
  const whole = live.offices.every((officeId) => offices.includes(officeId));
  if (whole && !datatype) {
    await markCatchUp(live.connection.id, startedAt);
    await store.setState(live.connection.id, 'compare_at', startedAt.toISOString());
  }
}

/**
 * "Fetch again" from the panel: the named records go on the list ahead of loads, each under the
 * office it was seen with (a record of an office-scoped datatype is fetched under its office; a
 * record never seen is asked for under the connection's first office). A record Vitec no longer
 * has is removed, as any fetch that answers 404.
 */
async function refetch(
  live: Live,
  records: { datatype: Datatype; remoteId: string; officeId: string | null }[],
): Promise<void> {
  const correlationId = randomUUID();
  const entries = [];
  for (const record of records) {
    const officeId = await refetchOffice(
      live.connection,
      record.datatype,
      record.remoteId,
      record.officeId,
    );
    if (!officeId) continue;
    entries.push({
      officeId,
      datatype: record.datatype,
      remoteId: record.remoteId,
      reason: 'refetch' as const,
      correlationId,
    });
  }
  await store.enqueue(entries);
}

/** Resync (strategy §7.2): reload everything listed, and remove every id no longer listed. */
async function resync(live: Live, datatype?: Datatype): Promise<void> {
  await load(live, live.offices, datatype);
}

async function markCatchUp(connectionId: string, startedAt: Date): Promise<void> {
  await store.setState(connectionId, 'catch_up_until', startedAt.toISOString());
  await store.setState(connectionId, 'catch_up_at', new Date().toISOString());
}

/**
 * What changed since the last catch-up, less one hour of overlap (strategy §5.3, §13), fetching
 * only records whose change date moved.
 */
async function catchUp(live: Live): Promise<void> {
  const startedAt = new Date();
  const until = await store.getState(live.connection.id, 'catch_up_until');
  const since = until ? new Date(new Date(until).getTime() - CATCH_UP_OVERLAP_MS) : undefined;
  const listed = await listAll(live, live.offices, connect.LISTABLE, since);
  await enqueueListed(listed, 'catch_up', true);
  await markCatchUp(live.connection.id, startedAt);
}

async function compare(live: Live): Promise<void> {
  const startedAt = new Date();
  await enqueueMissing(await listAll(live, live.offices, connect.LISTABLE));
  await store.setState(live.connection.id, 'compare_at', startedAt.toISOString());
}

/**
 * Ask Vitec which offices to sync (offices.ts) and act on the difference with `target.offices`,
 * what was synced before: an office that went is taken off the sites, and an office that came is
 * loaded. Offices typed on the connection are loaded by the engine's offices_added instead.
 */
async function checkAndApply(current: AdapterApi, target: Live): Promise<Live> {
  const { credentials, connection } = target;
  const ids = credentials.customerId ? [credentials.customerId] : [];
  const crmAuth = credentials.crmPassword
    ? { ...credentials, password: credentials.crmPassword }
    : credentials;
  const check = await checkOffices(connection.id, credentials, crmAuth, ids);
  const next = { ...target, offices: check.offices };
  for (const officeId of target.offices.filter((office) => !check.offices.includes(office))) {
    await takeOff(current, connection, officeId);
  }
  const added = check.offices.filter((office) => !target.offices.includes(office));
  if (added.length > 0) await load(next, added);
  return next;
}

/**
 * An office no longer synced (Patric, 2026-10-06: "an office that is removed regardless of method
 * needs to have their data pulled from client sites"): every record of it is tombstoned, so each
 * site deletes it at its next sync, and the tombstone stays for the engine's retention window.
 */
async function takeOff(
  current: AdapterApi,
  connection: Connection,
  officeId: string,
): Promise<void> {
  if (!officeId) return; // an empty office would be every office
  for (const datatype of DATATYPES)
    await current.presentIds(connection, datatype, { officeId }, []);
}

const ageMs = (iso: string | null): number =>
  iso ? Date.now() - new Date(iso).getTime() : Number.POSITIVE_INFINITY;

/** A length of time for a health line: `40 s`, `12 min`, `3 h`. */
const span = (ms: number): string => {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds} s`;
  if (seconds < 3_600) return `${Math.round(seconds / 60)} min`;
  return `${Math.round(seconds / 3_600)} h`;
};

/**
 * The two schedules, checked every minute. After a start, both run whatever their age, and the
 * fetch list is drained, before the adapter counts as caught up: a restart, and a database
 * restored to an earlier point, are made good within minutes and `vitec.catch_up` is red until
 * then (strategy §7.2). Later ticks run what is due.
 */
let startPending = true;

/** One connection's schedules that are due: the offices first, then the catch-up and the
 * comparison over the offices the check chose. */
async function runDue(current: AdapterApi, given: Live, startup: boolean): Promise<void> {
  const due = async (key: string, every: number): Promise<boolean> =>
    startup || ageMs(await store.getState(given.connection.id, key)) >= every;
  const target = (await due('offices_check_at', CHECK_EVERY_MS))
    ? await checkAndApply(current, given)
    : given;
  if (target.offices.length === 0) return;
  if (await due('catch_up_at', CATCH_UP_EVERY_MS)) await catchUp(target);
  if (await due('compare_at', COMPARE_EVERY_MS)) await compare(target);
}

async function tickOnce(): Promise<void> {
  const current = engine;
  if (!current) return;
  const startup = startPending;
  let failed = false;
  const targets = await live(current);
  await resumeDue(targets);
  await probeOffices(current, targets);
  for (const given of targets) {
    try {
      await runDue(current, given, startup);
    } catch (error) {
      failed = true;
      await current.logEvent(
        'schedule.failed',
        { connection_id: given.connection.id, detail: String(error) },
        { connectionId: given.connection.id },
      );
      current.report(error, { where: 'vitec schedule', connection_id: given.connection.id });
    }
  }
  if (startup && !failed) {
    await scheduleDrain();
    startPending = false;
  }
}

// ---- Health -----------------------------------------------------------------------------------

/** A red check's answer: what is wrong in counts and plain words, and which ones, kept apart. */
function unhealthy(problems: Map<string, string[]>, prefix: string[] = []): HealthResult {
  const names = [...problems.values()].flat();
  if (prefix.length === 0 && names.length === 0) return { ok: true };
  const counted = [...problems.entries()]
    .filter(([, which]) => which.length > 0)
    .map(([what, which]) => `${which.length} ${what}`);
  return { ok: false, detail: [...prefix, ...counted].join('; '), names };
}

async function catchUpHealth(current: AdapterApi): Promise<HealthResult> {
  const problems = new Map<string, string[]>([
    ['connection(s) whose login is not readable', []],
    ['connection(s) with no offices', []],
    ['connection(s) not caught up for over 12 h', []],
    ['connection(s) never caught up', []],
  ]);
  const note = (what: string, which: string): void => {
    problems.get(what)?.push(which);
  };
  for (const connection of await current.connections()) {
    if (!connection.active) continue;
    if (!credentialsOf(connection)) {
      note('connection(s) whose login is not readable', `${connection.id}: login not readable`);
      continue;
    }
    if ((await officesOf(connection)).length === 0) {
      note('connection(s) with no offices', `${connection.id}: no offices to sync`);
      continue;
    }
    const age = ageMs(await store.getState(connection.id, 'catch_up_at'));
    if (age > CATCH_UP_LIMIT_MS) {
      if (Number.isFinite(age)) {
        note(
          'connection(s) not caught up for over 12 h',
          `${connection.id}: last catch-up ${Math.round(age / 3_600_000)} h ago`,
        );
      } else note('connection(s) never caught up', `${connection.id}: never caught up`);
    }
  }
  return unhealthy(problems, startPending ? ['catching up since the worker started'] : []);
}

export const vitecAdapter: Adapter = {
  manifest: {
    provider: PROVIDER,
    datatypes: ['property', 'agent', 'office', 'area', 'association', 'project'],
    // The forms Connect takes (docs/forms.md): the valuation, the interest, the viewing booking,
    // and the search profile through the CRM function group.
    submissions: ['lead', 'interest', 'viewing', 'search_profile'],
    // The offices come from Vitec (offices.ts): the tenant page draws no office field.
    officesFromCrm: true,
  },
  mappers,
  routes,
  admin: vitecAdmin,

  // A site's form, handed over by the web process inside the request (docs/forms.md). The
  // customer id is the office Core filled in: the home's, or the lead's.
  submit(connection, submission) {
    const credentials = credentialsOf(connection);
    if (!credentials) {
      return Promise.resolve({
        outcome: 'failed' as const,
        detail: 'the connection’s login is not readable',
      });
    }
    return forms.submit(connection, credentials, submission);
  },

  slots(connection, record) {
    const credentials = credentialsOf(connection);
    if (!credentials) throw new Error('the connection’s login is not readable');
    const officeId = record.officeId ?? connection.licensedOffices[0];
    if (!officeId) throw new Error('the connection has no office to ask for');
    return forms.slots(credentials, officeId, record.remoteId, {
      connectionId: connection.id,
      datatype: record.datatype,
      remoteId: record.remoteId,
    });
  },

  start(given: AdapterApi): void {
    engine = given;
    // Every call to Vitec goes in the event log, on the record's timeline when it was for one.
    connect.onCall((call) => {
      const api = engine;
      if (!api) return;
      const { trace, ...fields } = call;
      void api
        .logEvent('crm.call', fields, trace)
        .catch((error: unknown) => api.report(error, { where: 'vitec crm.call event' }));
    });

    given.onLifecycle(async (event) => {
      const credentials = credentialsOf(event.connection);
      if (!credentials || !event.connection.active) return;
      const target = { connection: event.connection, credentials, offices: [] as string[] };
      if (
        event.type === 'connection_added' ||
        event.type === 'offices_added' ||
        event.type === 'offices_removed'
      ) {
        // A new connection, or the engine's own office list changed (for this adapter only ever
        // to empty): Vitec is asked which offices to sync, and every one of them is loaded.
        await checkAndApply(given, target);
        return;
      }
      target.offices = await officesOf(event.connection);
      if (event.type === 'resync') await resync(target, event.datatype);
      if (event.type === 'refetch') await refetch(target, event.records);
    });

    given.healthCheck(`${PROVIDER}.webhook_lag`, async () => {
      const wait = await store.oldestWebhookWaitMs();
      return wait !== null && wait > LAG_LIMIT_MS
        ? { ok: false, detail: `a webhook has waited ${Math.round(wait / 1000)} s` }
        : { ok: true };
    });
    given.healthCheck(`${PROVIDER}.retries`, async () => {
      const count = await store.retrying(RETRIES_RED);
      return count === 0
        ? { ok: true }
        : { ok: false, detail: `${count} record(s) failed ${RETRIES_RED} fetches in a row` };
    });
    given.healthCheck(`${PROVIDER}.catch_up`, () => catchUpHealth(given));
    given.healthCheck(`${PROVIDER}.offices`, async () => {
      const blocked = await store.blockedOffices();
      if (blocked.length === 0) return { ok: true };
      const nextProbe = Math.min(...blocked.map((office) => office.blockedUntil.getTime()));
      return {
        ok: false,
        detail: `${blocked.length} office(s) refused by Vitec; the next probe is ${nextProbe <= Date.now() ? 'due' : `in ${span(nextProbe - Date.now())}`}`,
        names: blocked.map(
          (office) =>
            `${office.officeId}: refused ${span(Date.now() - office.blockedAt.getTime())} ago, next probe ${office.blockedUntil.getTime() <= Date.now() ? 'due' : `in ${span(office.blockedUntil.getTime() - Date.now())}`}`,
        ),
      };
    });
    given.healthCheck(`${PROVIDER}.connect`, async () => {
      const pausedOnes: string[] = [];
      for (const connection of await given.connections()) {
        const pause = await pauseOf(connection.id);
        if (paused(pause)) {
          pausedOnes.push(
            `${connection.id}: paused for another ${span((pause.pausedUntil ?? 0) - Date.now())}`,
          );
        }
      }
      return unhealthy(
        new Map([[`connection(s) paused after ${PAUSE_AFTER} failures in a row`, pausedOnes]]),
      );
    });

    drainTimer = setInterval(() => void scheduleDrain(), DRAIN_MS);
    drainTimer.unref?.();
    void scheduleTick();
    scheduleTimer = setInterval(() => void scheduleTick(), SCHEDULE_MS);
    scheduleTimer.unref?.();
  },

  async stop(): Promise<void> {
    if (drainTimer) clearInterval(drainTimer);
    if (scheduleTimer) clearInterval(scheduleTimer);
    drainTimer = null;
    scheduleTimer = null;
    connect.onCall(null);
    engine = null;
    startPending = true;
    await draining;
    await scheduling;
    await store.close();
  },
};

/** Test and local use: fetch everything queued now, and wait for it. */
export const drainFetchList = scheduleDrain;
/** Test and local use: run any overdue catch-up or comparison now, and wait for it. */
export const runSchedules = scheduleTick;
