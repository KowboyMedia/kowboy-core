// The Vitec Connect adapter (strategy §5.3): two independent paths, both inside the adapter.
//
//   Vitec webhook ──► token check ──► fetch list ──► 202
//   worker ──► fetch, five at a time ──► found: ingest · gone: notFound · failed: retry later
//   every 12 h ──► "what changed since the last catch-up, less one hour" ──► fetch list
//   every 24 h ──► Vitec's full id list against the ids seen ──► missing ones fetched to confirm
//
// A connection's credentials are a JSON document, `{"username", "password"}`: the Connect key
// pair. Its licensed offices are the office ids, which are what Connect calls customer ids
// (M30011 and the like): every URL and notification carries one. They are also the fetch scope,
// so a connection without offices fetches nothing and says so in `vitec.catch_up`.
import { randomUUID, timingSafeEqual } from 'node:crypto';
import * as connect from './api.js';
import * as store from './store.js';
import { changedAtOf, mappers, referencedIds } from './mappers.js';
import type {
  Adapter,
  AdapterApi,
  Connection,
  Datatype,
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

type Credentials = { username: string; password: string };
type Live = { connection: Connection; credentials: Credentials };

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
    const parsed = JSON.parse(connection.credentials) as Partial<Credentials>;
    if (typeof parsed.username === 'string' && typeof parsed.password === 'string') {
      return { username: parsed.username, password: parsed.password };
    }
  } catch {
    // reported below as unreadable
  }
  return null;
}

/** Active connections with readable credentials and at least one office. The rest show up in `vitec.catch_up`. */
async function live(current: AdapterApi): Promise<Live[]> {
  const result: Live[] = [];
  for (const connection of await current.connections()) {
    if (!connection.active || connection.licensedOffices.length === 0) continue;
    const credentials = credentialsOf(connection);
    if (credentials) result.push({ connection, credentials });
  }
  return result;
}

// ---- Path 1: webhooks -------------------------------------------------------------------------

type Notification = { officeId: string; id: string; datatype: Datatype | null };

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
  if (!datatype) return { officeId: '', id: '', datatype: null };
  const officeId = field('customerId');
  const id = field('id');
  if (!officeId || !id) return { error: 'customerId and id are required' };
  return { officeId, id, datatype };
}

const tokenMatches = (given: string | undefined, expected: string): boolean =>
  given !== undefined &&
  given.length === expected.length &&
  timingSafeEqual(Buffer.from(given), Buffer.from(expected));

const routes: Route[] = [
  {
    method: 'POST',
    path: 'webhook/*',
    handler: async (request) => {
      const expected = process.env['VITEC_WEBHOOK_TOKEN'];
      if (!expected) return { status: 503, body: { error: 'VITEC_WEBHOOK_TOKEN is not set' } };
      const [path, query] = request.url.split('?');
      if (!tokenMatches(path?.split('/').pop(), expected)) {
        return { status: 401, body: { error: 'bad token' } };
      }
      const notification = parseNotification(request.body, query);
      if ('error' in notification) return { status: 400, body: { error: notification.error } };
      if (!notification.datatype) return { status: 202, body: { ignored: true } };
      // Never fetch inside the request: a burst must not become a burst of Connect calls.
      const correlationId = randomUUID();
      await store.enqueue([
        {
          officeId: notification.officeId,
          datatype: notification.datatype,
          remoteId: notification.id,
          reason: 'webhook',
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
    const claimed = await store.claim(connect.concurrency());
    if (claimed.length === 0) return;
    await Promise.all(claimed.map((entry) => fetchOne(entry, targets, current)));
  }
}

/** One record: fetched once, ingested into every connection that licenses its office. */
async function fetchOne(entry: store.Entry, targets: Live[], current: AdapterApi): Promise<void> {
  const owners = targets.filter((live) => live.connection.licensedOffices.includes(entry.officeId));
  const first = owners[0];
  if (!first) {
    await current.logEvent('fetch.orphan', {
      office_id: entry.officeId,
      datatype: entry.datatype,
      remote_id: entry.remoteId,
      detail: 'no active connection licenses this office',
    });
    return;
  }
  try {
    const payload = await connect.getOne(
      first.credentials,
      entry.datatype,
      entry.officeId,
      entry.remoteId,
    );
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
    // A failed fetch is retried, never treated as a delete (strategy §5.3).
    const outcome = await store.requeue(entry, String(error));
    if (outcome === 'given_up') {
      const fields = {
        office_id: entry.officeId,
        datatype: entry.datatype,
        remote_id: entry.remoteId,
        attempts: entry.attempts + 1,
        detail: String(error),
      };
      await current.logEvent('fetch.failed', fields);
      current.report(new Error('vitec fetch given up'), fields);
    }
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
  for (const datatype of datatypes) {
    const perOffice = new Map<string, Map<string, string | null>>();
    for (const officeId of offices) {
      const ids = new Map<string, string | null>();
      for await (const row of connect.list(live.credentials, datatype, officeId, changedSince)) {
        ids.set(row.id, row.changedAt);
      }
      perOffice.set(officeId, ids);
    }
    listed.set(datatype, perOffice);
  }
  return listed;
}

/**
 * Put what was listed on the fetch list. A catch-up skips a record whose change date, as Vitec
 * writes it, is the one seen at its last fetch (Patric, 2026-09-17); a load or resync fetches
 * everything listed.
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

/** The ids seen before that Vitec no longer lists: fetched to confirm, never tombstoned blind. */
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
          reason: 'compare',
          correlationId,
        })),
      );
    }
  }
}

const listable = (datatype?: Datatype): readonly Datatype[] =>
  datatype ? connect.LISTABLE.filter((candidate) => candidate === datatype) : connect.LISTABLE;

/** Everything the given offices publish, onto the list after any webhook fetches. */
async function load(live: Live, offices: readonly string[], datatype?: Datatype): Promise<Listed> {
  const startedAt = new Date();
  const listed = await listAll(live, offices, listable(datatype));
  await enqueueListed(listed, 'load', false);
  await enqueueMissing(listed);
  await markCatchUp(live.connection.id, startedAt);
  await store.setState(live.connection.id, 'compare_at', startedAt.toISOString());
  return listed;
}

/** Resync with sweep (strategy §7.2): reload, and tell the engine which ids exist. */
async function resync(live: Live, current: AdapterApi, datatype?: Datatype): Promise<void> {
  const listed = await load(live, live.connection.licensedOffices, datatype);
  for (const [listedDatatype, perOffice] of listed) {
    const ids = [...perOffice.values()].flatMap((office) => [...office.keys()]);
    await current.presentIds(live.connection, listedDatatype, { officeId: null }, ids);
  }
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
  const listed = await listAll(live, live.connection.licensedOffices, connect.LISTABLE, since);
  await enqueueListed(listed, 'catch_up', true);
  await markCatchUp(live.connection.id, startedAt);
}

async function compare(live: Live): Promise<void> {
  const startedAt = new Date();
  await enqueueMissing(await listAll(live, live.connection.licensedOffices, connect.LISTABLE));
  await store.setState(live.connection.id, 'compare_at', startedAt.toISOString());
}

const ageMs = (iso: string | null): number =>
  iso ? Date.now() - new Date(iso).getTime() : Number.POSITIVE_INFINITY;

/**
 * The two schedules, checked every minute. After a start, both run whatever their age, and the
 * fetch list is drained, before the adapter counts as caught up: a restart, and a database
 * restored to an earlier point, are made good within minutes and `vitec.catch_up` is red until
 * then (strategy §7.2). Later ticks run what is due.
 */
let startPending = true;

async function tickOnce(): Promise<void> {
  const current = engine;
  if (!current) return;
  const startup = startPending;
  let failed = false;
  for (const target of await live(current)) {
    try {
      const catchUpAge = ageMs(await store.getState(target.connection.id, 'catch_up_at'));
      if (startup || catchUpAge >= CATCH_UP_EVERY_MS) await catchUp(target);
      const compareAge = ageMs(await store.getState(target.connection.id, 'compare_at'));
      if (startup || compareAge >= COMPARE_EVERY_MS) await compare(target);
    } catch (error) {
      failed = true;
      await current.logEvent('schedule.failed', {
        connection_id: target.connection.id,
        detail: String(error),
      });
      current.report(error, { where: 'vitec schedule', connection_id: target.connection.id });
    }
  }
  if (startup && !failed) {
    await scheduleDrain();
    startPending = false;
  }
}

// ---- Health -----------------------------------------------------------------------------------

async function catchUpHealth(current: AdapterApi): Promise<{ ok: boolean; detail?: string }> {
  const problems: string[] = startPending ? ['catching up since the worker started'] : [];
  for (const connection of await current.connections()) {
    if (!connection.active) continue;
    if (!credentialsOf(connection)) {
      problems.push(`${connection.id}: credentials are not readable`);
      continue;
    }
    if (connection.licensedOffices.length === 0) {
      problems.push(`${connection.id}: no offices configured`);
      continue;
    }
    const age = ageMs(await store.getState(connection.id, 'catch_up_at'));
    if (age > CATCH_UP_LIMIT_MS) {
      problems.push(
        Number.isFinite(age)
          ? `${connection.id}: last catch-up ${Math.round(age / 3_600_000)} h ago`
          : `${connection.id}: never caught up`,
      );
    }
  }
  return problems.length === 0 ? { ok: true } : { ok: false, detail: problems.join('; ') };
}

export const vitecAdapter: Adapter = {
  manifest: {
    provider: PROVIDER,
    datatypes: ['property', 'agent', 'office', 'area', 'association', 'project'],
  },
  mappers,
  routes,

  start(given: AdapterApi): void {
    engine = given;

    given.onLifecycle(async (event) => {
      const credentials = credentialsOf(event.connection);
      if (!credentials || !event.connection.active) return;
      const target = { connection: event.connection, credentials };
      if (event.type === 'connection_added') await load(target, event.connection.licensedOffices);
      if (event.type === 'offices_added') await load(target, event.officeIds);
      if (event.type === 'resync') await resync(target, given, event.datatype);
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
