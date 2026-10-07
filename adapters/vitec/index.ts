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
// failures in a row a connection pauses and probes its way back with growing waits; a 401 or 403
// blocks the office at once and holds every other fetch of its login until the office check has
// run, and from then on that check is the only call that asks about the office (question 161 a);
// a broken answer is kept in the event and retried; requests are capped per second and Vitec's
// own Retry-After is honoured (api.ts).
//
// A connection's credentials are a JSON document, `{"username", "password"}`: the Connect key
// pair. Its licensed offices are the office ids, which are what Connect calls customer ids
// (M30011 and the like): every URL and notification carries one. They are also the fetch scope,
// so a connection without offices fetches nothing and says so in `vitec.catch_up`.
//
// A login whose field `qa` says yes is for Vitec's QA environment (question 169 a): its calls go
// to QA's address with their own speed limit, its notifications arrive at /v1/hook/vitec/qa/…,
// and its offices are kept apart from live Vitec's in every list, since QA may hold the same
// office ids. A notification, a fetch or a refusal of one system never touches the other's, and
// each system drains its own part of the fetch list. A login switched from one system to the
// other has everything the first gave taken off the sites, and is loaded again from the second.
import { randomUUID, timingSafeEqual } from 'node:crypto';
import * as connect from './api.js';
import * as store from './store.js';
import * as forms from './forms.js';
import { changedAtOf, isoDate, mappers, referencedIds } from './mappers.js';
import { hookPath, refetchOffice, vitecAdmin } from './admin/index.js';
import {
  type AdminThing,
  agree,
  counted,
  failureInWords,
  lasting,
  officeNamed,
  recordNamed,
  sentence,
  when,
} from './words.js';
import {
  CHECK_EVERY_MS,
  checkOffices,
  checkSoon,
  lastCheck,
  NO_SUCH_OFFICE,
  OFFICE_REFUSED,
  officesOf,
  type OfficesCheck,
} from './offices.js';
import { DATATYPES } from '../../engine/adapter-api/index.js';
import type {
  Adapter,
  AdapterApi,
  Connection,
  Datatype,
  EventContext,
  HealthResult,
  Route,
  RouteRequest,
  RouteResponse,
} from '../../engine/adapter-api/index.js';

const PROVIDER = 'vitec';
const DRAIN_MS = 250;
const SCHEDULE_MS = 60_000;
const CATCH_UP_EVERY_MS = 12 * 3_600_000;
const CATCH_UP_OVERLAP_MS = 3_600_000;
const CATCH_UP_LIMIT_MS = 13 * 3_600_000;
const COMPARE_EVERY_MS = 24 * 3_600_000;
const LAG_LIMIT_MS = 5 * 60_000;
/** A notification waiting this long, or a connection paused this long, matters at once (172). */
const URGENT_AFTER_MS = 3_600_000;
const RETRIES_RED = 3;
/** A connection pauses after this many failures in a row on Vitec's side. */
const PAUSE_AFTER = 5;
const PAUSE_BASE_MS = 2 * 60_000;
const PAUSE_MAX_MS = 30 * 60_000;

/** A connection the adapter works for, with the offices it syncs (`officesOf`). */
type Live = { connection: Connection; credentials: connect.Login; offices: string[] };

/** Whether a connection syncs this office: the same office id in Vitec's other system is another. */
const syncs = (target: Live, office: store.Office): boolean =>
  store.holds(target.credentials.environment, target.offices, office);

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
/**
 * Each system drains its own part of the fetch list (question 169 a), so a slow or busy QA never
 * holds up live Vitec's fetches. Within a system, drains run one after another; a second one
 * waiting would find nothing the first will not.
 */
const draining: Record<connect.Environment, Promise<void>> = {
  live: Promise.resolve(),
  qa: Promise.resolve(),
};
const drainWaiting: Record<connect.Environment, boolean> = { live: false, qa: false };
let scheduling: Promise<void> = Promise.resolve();

const serial = (run: () => Promise<void>, chain: Promise<void>): Promise<void> =>
  chain.then(run, run);

const drainIn = (environment: connect.Environment): Promise<void> => {
  if (!drainWaiting[environment]) {
    drainWaiting[environment] = true;
    draining[environment] = serial(() => {
      drainWaiting[environment] = false;
      return drainOnce(environment);
    }, draining[environment]);
  }
  return draining[environment];
};

const scheduleDrain = async (): Promise<void> => {
  await Promise.all(connect.ENVIRONMENTS.map(drainIn));
};

const scheduleTick = (): Promise<void> => {
  scheduling = serial(tickOnce, scheduling);
  return scheduling;
};

/** The connection's login, or null when it is not readable (reported in `vitec.catch_up`). */
const credentialsOf = (connection: Connection): connect.Login | null =>
  connect.loginOf(connection.credentials);

/** Connections with a readable login. One with no offices yet shows up in `vitec.catch_up`. */
async function live(current: AdapterApi): Promise<Live[]> {
  const result: Live[] = [];
  for (const connection of await current.connections()) {
    const credentials = credentialsOf(connection);
    if (credentials) result.push({ connection, credentials, offices: await officesOf(connection) });
  }
  return result;
}

// ---- The guards: a paused connection, a blocked office ----------------------------------------

type Pause = {
  failures: number;
  pausedUntil: number | null;
  pauseMs: number;
  probing: boolean;
  /** When the first pause of this run of failures began; null once Vitec answered again. */
  pausedSince: number | null;
};

async function pauseOf(connectionId: string): Promise<Pause> {
  const [failures, until, pauseMs, probing, since] = await Promise.all([
    store.getState(connectionId, 'failures'),
    store.getState(connectionId, 'paused_until'),
    store.getState(connectionId, 'pause_ms'),
    store.getState(connectionId, 'probing'),
    store.getState(connectionId, 'paused_since'),
  ]);
  return {
    failures: Number(failures ?? 0),
    pausedUntil: until ? new Date(until).getTime() : null,
    pauseMs: Number(pauseMs ?? PAUSE_BASE_MS),
    probing: probing === '1',
    pausedSince: since ? new Date(since).getTime() : null,
  };
}

const paused = (pause: Pause): boolean =>
  pause.pausedUntil !== null && pause.pausedUntil > Date.now();

/**
 * How many more calls the connection may send before its pause: none once its failures in a row
 * reached PAUSE_AFTER, even after the pause ran out and until resumeDue lets one probe through.
 */
const callsLeft = (pause: Pause): number =>
  paused(pause) ? 0 : Math.max(0, PAUSE_AFTER - pause.failures);

/** A call failed on Vitec's side: count it, and pause the connection at PAUSE_AFTER in a row. */
async function noteFailure(current: AdapterApi, live: Live, error: unknown): Promise<void> {
  const id = live.connection.id;
  // Fetches fail side by side, so the count and the pause are both settled in the database.
  const failures = await store.increment(id, 'failures');
  if (failures < PAUSE_AFTER) return;
  const pause = await pauseOf(id);
  if (paused(pause)) return;
  const until = new Date(Date.now() + pause.pauseMs);
  if (!(await store.setIfEmpty(id, 'paused_until', until.toISOString()))) return;
  await store.setIfEmpty(id, 'paused_since', new Date().toISOString());
  await store.setState(id, 'pause_ms', String(Math.min(pause.pauseMs * 2, PAUSE_MAX_MS)));
  await store.setState(id, 'probing', '');
  const detail = `the last call failed because ${failureInWords(error)}. Core asks Vitec nothing for this connection until ${when(until)}, then tries again by itself and waits longer after each new failure, at most ${lasting(PAUSE_MAX_MS)}. Until Vitec answers, the sites keep showing the homes as they are, and changes wait. Nothing needs doing while Vitec is down. Once Vitec answers again, “Ask Vitec again now” on the Vitec page starts at once.`;
  await current.logEvent(
    'connection.paused',
    { connection_id: id, failures, until: until.toISOString(), detail },
    { connectionId: id },
  );
  current.report(new Error('vitec connection paused'), {
    connection_id: id,
    failures,
    detail: String(error),
  });
}

/** Vitec answered: the run of failures ends, and a probing connection is back for good. */
async function noteSuccess(current: AdapterApi, live: Live): Promise<void> {
  const id = live.connection.id;
  const pause = await pauseOf(id);
  if (pause.failures === 0 && !pause.probing && pause.pausedSince === null) return;
  await store.setState(id, 'failures', '0');
  await store.setState(id, 'pause_ms', String(PAUSE_BASE_MS));
  await store.setState(id, 'probing', '');
  await store.setState(id, 'paused_since', '');
  if (pause.probing) {
    await current.logEvent('connection.resumed', { connection_id: id }, { connectionId: id });
  }
}

/**
 * A pause that has run out lets one fetch through as a probe: one more failure pauses again. So
 * does a connection out of calls whose pause never began, so that it is never stuck.
 */
async function resumeDue(targets: Live[]): Promise<void> {
  for (const target of targets) {
    const pause = await pauseOf(target.connection.id);
    if (paused(pause) || (pause.pausedUntil === null && callsLeft(pause) > 0)) continue;
    await store.setState(target.connection.id, 'paused_until', '');
    await store.setState(target.connection.id, 'failures', String(PAUSE_AFTER - 1));
    await store.setState(target.connection.id, 'probing', '1');
  }
}

/**
 * The connections an office's block concerns: the one that met it, and every other that syncs the
 * office in the same system. Each is told on its own, so its own events say what its office went
 * through (the super admin's notifications read them per connection).
 */
async function concerned(
  current: AdapterApi,
  connectionId: string,
  office: store.Office,
): Promise<string[]> {
  const others = (await live(current))
    .filter((target) => syncs(target, office))
    .map((target) => target.connection.id);
  return [...new Set([connectionId, ...others])];
}

/**
 * An office is blocked, told once to each connection it concerns: nothing is asked for it until
 * the office check reads it.
 */
async function markBlocked(
  current: AdapterApi,
  connectionId: string,
  office: store.Office,
  detail: string,
): Promise<void> {
  if (!(await store.blockOffice(office, detail))) return;
  for (const id of await concerned(current, connectionId, office)) {
    await current.logEvent(
      'office.blocked',
      { office_id: office.officeId, connection_id: id, detail },
      { connectionId: id },
    );
  }
  current.report(new Error('vitec office blocked'), {
    office_id: office.officeId,
    connection_id: connectionId,
    detail,
  });
}

/**
 * Vitec refused an office at a fetch (question 161 a): block it, hold every other fetch of the same
 * login, and have the next tick check the offices. A revoked login so costs one refused call, not
 * one per office; the check then settles which offices stay blocked and releases the hold, and from
 * then on it is the only call that asks about a blocked office: once a day (checkAndApply).
 */
async function blockOffice(
  current: AdapterApi,
  live: Live,
  officeId: string,
  detail: string,
): Promise<void> {
  await store.setState(live.connection.id, 'held', new Date().toISOString());
  await checkSoon(live.connection.id);
  const { environment } = live.credentials;
  await markBlocked(current, live.connection.id, { environment, officeId }, detail);
}

/** When the login's hold began, or null while it is not held. */
const heldSince = async (connectionId: string): Promise<string | null> =>
  (await store.getState(connectionId, 'held')) || null;

const isHeld = async (connectionId: string): Promise<boolean> =>
  (await heldSince(connectionId)) !== null;

/**
 * Offices the drain leaves alone: blocked ones, and every office of a connection that is held or
 * may send no more calls (callsLeft).
 */
async function skippedOffices(targets: Live[]): Promise<store.Office[]> {
  const skipped: store.Office[] = await store.blockedOffices();
  for (const target of targets) {
    const id = target.connection.id;
    if (callsLeft(await pauseOf(id)) === 0 || (await isHeld(id))) {
      const { environment } = target.credentials;
      skipped.push(...target.offices.map((officeId) => ({ environment, officeId })));
    }
  }
  return skipped;
}

/** The offices of one system that Vitec refuses, by office id. */
const blockedIn = async (environment: connect.Environment): Promise<Set<string>> =>
  new Set(
    (await store.blockedOffices())
      .filter((office) => office.environment === environment)
      .map((office) => office.officeId),
  );

/**
 * Refusals that a person's button or a form met at the door (api.ts) since the last tick: each
 * office is blocked as after a refusal at a fetch, told once to every connection that syncs it,
 * and those connections hold their other calls until the office check, which runs this tick
 * (question 161 a). A refusal no connection syncs the office of guards nothing and is forgotten.
 */
async function settleDoorRefusals(current: AdapterApi, targets: Live[]): Promise<void> {
  for (const refusal of await store.refusalsAtDoor()) {
    const office: store.Office = { environment: refusal.environment, officeId: refusal.officeId };
    if (!(await blockedIn(office.environment)).has(office.officeId)) {
      for (const owner of targets.filter((target) => syncs(target, office))) {
        await blockOffice(current, owner, office.officeId, refusal.detail);
      }
    }
    await store.forgetRefusal(office);
  }
}

/** A block on an office no connection syncs any more guards nothing and is dropped, without a call. */
async function dropStrayBlocks(targets: Live[]): Promise<void> {
  for (const office of await store.blockedOffices()) {
    if (!targets.some((target) => syncs(target, office))) await store.unblockOffice(office);
  }
}

// ---- Path 1: webhooks -------------------------------------------------------------------------

type Notification = {
  officeId: string;
  id: string;
  datatype: Datatype | null;
  reason: 'webhook' | 'remove';
};

/**
 * What a notification Core turned away or left alone means, for the event a person reads; Vitec
 * gets the short answer.
 */
const LATER =
  'The change still reaches the sites with the next catch-up, within 12 hours, and a removal with the next comparison, within a day.';
const TURNED_AWAY: Record<string, string> = {
  'bad token':
    'A notification came to Vitec’s address with a wrong secret, so Core turned it away. If Vitec sent it, Vitec holds an old address. Give Vitec the address under “Notification addresses and call limits” on the Vitec page again.',
  'malformed body': `Core could not read the notification, so it turned it away. ${LATER}`,
  'type is required': `The notification did not say what kind of record changed, so Core turned it away. ${LATER}`,
  'customerId and id are required': `The notification did not name the office or the record, so Core turned it away. ${LATER}`,
  'a type Core does not sync':
    'The notification was about a kind of record the sites do not show, so Core did nothing. Nothing needs doing.',
};
const turnedAway = (answer: string): string => TURNED_AWAY[answer] ?? answer;

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

/** The first active connection that syncs this office in its system: the record's timeline. */
async function ownerOf(api: AdapterApi, office: store.Office): Promise<Connection | undefined> {
  return (await live(api)).find((target) => syncs(target, office))?.connection;
}

/**
 * One notification from Vitec, checked, logged and put on the fetch list. Each system sends to its
 * own address (`hookPath`), so the address says which system the notification's office is in.
 */
async function notified(
  environment: connect.Environment,
  request: RouteRequest,
  api: AdapterApi,
): Promise<RouteResponse> {
  const expected = process.env['VITEC_WEBHOOK_TOKEN'];
  if (!expected) return { status: 503, body: { error: 'VITEC_WEBHOOK_TOKEN is not set' } };
  // Every arrival goes in the event log with what Vitec sent, kept as long as the log keeps
  // events (Patric, 2026-09-20, question 63), and a queued one onto its record's timeline (AC 16).
  const [path, query] = request.url.split('?');
  const arrived = (fields: Record<string, unknown>, context?: EventContext): Promise<void> =>
    api.logEvent(
      'webhook.received',
      {
        path: `/v1/hook/vitec/${hookPath(environment)}`,
        body: bodyOf(request.body),
        ...(query ? { query } : {}),
        ...fields,
      },
      context,
    );
  if (!tokenMatches(path?.split('/').pop(), expected)) {
    await arrived({ outcome: 'rejected', detail: turnedAway('bad token'), response: 401 });
    return { status: 401, body: { error: 'bad token' } };
  }
  const notification = parseNotification(request.body, query);
  if ('error' in notification) {
    await arrived({ outcome: 'rejected', detail: turnedAway(notification.error), response: 400 });
    return { status: 400, body: { error: notification.error } };
  }
  if (!notification.datatype) {
    await arrived({
      outcome: 'ignored',
      detail: turnedAway('a type Core does not sync'),
      response: 202,
    });
    return { status: 202, body: { ignored: true } };
  }
  // Never fetch inside the request: a burst must not become a burst of Connect calls.
  const correlationId = randomUUID();
  const owner = await ownerOf(api, { environment, officeId: notification.officeId });
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
      environment,
      officeId: notification.officeId,
      datatype: notification.datatype,
      remoteId: notification.id,
      reason: notification.reason,
      correlationId,
    },
  ]);
  return { status: 202, body: { queued: true, correlation_id: correlationId } };
}

const routes: Route[] = connect.ENVIRONMENTS.map((environment): Route => ({
  method: 'POST',
  path: `${hookPath(environment)}/*`,
  handler: (request, api) => notified(environment, request, api),
}));

// ---- The fetch list ---------------------------------------------------------------------------

/** One system's due records, a batch at a time; with nothing due, one question and no more. */
async function drainOnce(environment: connect.Environment): Promise<void> {
  const current = engine;
  if (!current || !(await store.anyDue(environment))) return;
  const targets = await live(current);
  for (;;) {
    if (!engine) return;
    const skipped = await skippedOffices(targets);
    const claimed = await store.claim(environment, connect.concurrency(), skipped);
    if (claimed.length === 0) return;
    const sent = await withinPause(claimed, targets);
    if (sent.length === 0) return;
    await Promise.all(sent.map((entry) => fetchOne(entry, targets, current)));
  }
}

/**
 * The claimed records that may go to Vitec now. The calls of a batch run side by side, so a batch
 * of a connection that has failed before could carry it past PAUSE_AFTER failures, and a probe
 * would be a whole batch: each connection sends at most its callsLeft, and the rest go back on the
 * list as they were, for the next batch to weigh again. A removal or a record no connection
 * fetches calls nothing, so it always goes.
 */
async function withinPause(claimed: store.Entry[], targets: Live[]): Promise<store.Entry[]> {
  const left = new Map<string, number>();
  const sent: store.Entry[] = [];
  for (const entry of claimed) {
    const first = targets.find((target) => syncs(target, entry));
    if (entry.reason === 'remove' || !first) {
      sent.push(entry);
      continue;
    }
    const id = first.connection.id;
    const calls = left.get(id) ?? callsLeft(await pauseOf(id));
    left.set(id, calls - 1);
    if (calls > 0) sent.push(entry);
    else await store.park(entry);
  }
  return sent;
}

/**
 * One record: fetched once and ingested into every connection that licenses its office, or, on a
 * removal, tombstoned in each of them without a fetch: the record left the sites' scope.
 */
async function fetchOne(entry: store.Entry, targets: Live[], current: AdapterApi): Promise<void> {
  const owners = targets.filter((target) => syncs(target, entry));
  if (entry.reason === 'remove') {
    for (const { connection } of owners) {
      await current.notFound(connection, entry.datatype, entry.remoteId);
    }
    await store.forget(entry, entry.datatype, entry.remoteId);
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
        detail: `No connection fetches this record’s office${entry.environment === 'qa' ? ' in Vitec’s QA environment' : ''} any more, for example because the office left the group “Webbplats” or its connection was removed. Core did not fetch the record. Nothing needs doing.`,
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
      await store.forget(entry, entry.datatype, entry.remoteId);
      return;
    }
    for (const { connection } of owners) {
      await current.ingest(connection, entry.datatype, entry.remoteId, payload, {
        correlationId: entry.correlationId,
      });
    }
    await store.remember(entry, entry.datatype, entry.remoteId, changedAtOf(payload));
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
  // Blocked since it was claimed: nothing was sent, so it waits for its office like the rest.
  if (kind === 'blocked') {
    await store.park(entry);
    return;
  }
  if (kind === 'forbidden') {
    await store.park(entry);
    await blockOffice(current, live, entry.officeId, sentence(OFFICE_REFUSED));
    return;
  }
  if (kind !== 'other') await noteFailure(current, live, error);
  const outcome = await store.requeue(entry, sentence(failureInWords(error)));
  if (outcome === 'given_up') {
    const fields = {
      office_id: entry.officeId,
      datatype: entry.datatype,
      remote_id: entry.remoteId,
      attempts: entry.attempts + 1,
      detail: `Core gave up fetching this ${recordNamed(entry.datatype)} from Vitec after ${String(entry.attempts + 1)} failed tries. The last try failed because ${failureInWords(error)}. The sites show the ${recordNamed(entry.datatype)} as it was before. Once Vitec answers for it, press “Retry now” beside it in the fetch list on the Vitec page.`,
    };
    await current.logEvent('fetch.failed', fields, trace);
    current.report(new Error('vitec fetch given up'), { ...fields, error: String(error) });
  }
}

/** Associations have no list, and a project may not be listed yet: fetch what a record names. */
async function queueReferences(entry: store.Entry, payload: unknown): Promise<void> {
  const missing = [];
  for (const reference of referencedIds(entry.datatype, payload)) {
    if (!(await store.isKnown(entry, reference.datatype, reference.id))) {
      missing.push({
        environment: entry.environment,
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

/**
 * Every id Vitec lists for the given offices, per datatype and office, blocked offices left out.
 * A refusal blocks its office and holds the login (blockOffice), and nothing more is asked while
 * the login is held: what was listed so far comes back with `complete` false.
 */
async function listAll(
  live: Live,
  offices: readonly string[],
  datatypes: readonly Datatype[],
  changedSince?: Date,
): Promise<{ listed: Listed; complete: boolean }> {
  const listed: Listed = new Map();
  const blocked = await blockedIn(live.credentials.environment);
  for (const datatype of datatypes) {
    const perOffice = new Map<string, Map<string, string | null>>();
    listed.set(datatype, perOffice);
    for (const officeId of offices) {
      if (blocked.has(officeId)) continue;
      if (await isHeld(live.connection.id)) return { listed, complete: false };
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
        // An office blocked since the listing began is left for later; a refused office blocks
        // and holds; anything else fails the schedule.
        if (connect.kindOf(error) === 'blocked') return { listed, complete: false };
        if (connect.kindOf(error) !== 'forbidden' || !engine) throw error;
        await blockOffice(engine, live, officeId, sentence(OFFICE_REFUSED));
        return { listed, complete: false };
      }
      perOffice.set(officeId, ids);
    }
  }
  return { listed, complete: true };
}

/**
 * Put what was listed on the fetch list. A catch-up skips a record whose change date is the one
 * seen at its last fetch (Patric, 2026-09-17); a load or resync fetches everything listed.
 */
async function enqueueListed(
  environment: connect.Environment,
  listed: Listed,
  reason: store.Reason,
  onlyChanged: boolean,
): Promise<void> {
  const correlationId = randomUUID();
  for (const [datatype, perOffice] of listed) {
    for (const [officeId, ids] of perOffice) {
      const seen = onlyChanged
        ? await store.known({ environment, officeId }, datatype)
        : new Map<string, string | null>();
      const wanted = [...ids].filter(
        ([id, changedAt]) => changedAt === null || seen.get(id) !== changedAt,
      );
      await store.enqueue(
        wanted.map(([remoteId]) => ({
          environment,
          officeId,
          datatype,
          remoteId,
          reason,
          correlationId,
        })),
      );
    }
  }
}

/** The ids seen before that Vitec no longer lists: they left the sites' scope, so they are removed. */
async function enqueueMissing(environment: connect.Environment, listed: Listed): Promise<void> {
  const correlationId = randomUUID();
  for (const [datatype, perOffice] of listed) {
    for (const [officeId, ids] of perOffice) {
      const missing = [...(await store.known({ environment, officeId }, datatype)).keys()].filter(
        (id) => !ids.has(id),
      );
      await store.enqueue(
        missing.map((remoteId) => ({
          environment,
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
  const datatypes = listable(datatype);
  const { listed, complete } = await listAll(live, offices, datatypes);
  await enqueueListed(live.credentials.environment, listed, 'load', false);
  await enqueueMissing(live.credentials.environment, listed);
  if (!complete) {
    const done = (officeId: string): boolean =>
      datatypes.every((one) => listed.get(one)?.has(officeId));
    await loadAfterCheck(
      live.connection.id,
      offices.filter((officeId) => !done(officeId)),
    );
    return;
  }
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
  const { environment } = live.credentials;
  for (const record of records) {
    const officeId = await refetchOffice(
      live.connection,
      environment,
      record.datatype,
      record.remoteId,
      record.officeId,
    );
    if (!officeId) continue;
    entries.push({
      environment,
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
  const { listed, complete } = await listAll(live, live.offices, connect.LISTABLE, since);
  await enqueueListed(live.credentials.environment, listed, 'catch_up', true);
  // Cut short by a hold, it stays due and runs again after the office check.
  if (complete) await markCatchUp(live.connection.id, startedAt);
}

async function compare(live: Live): Promise<void> {
  const startedAt = new Date();
  const { listed, complete } = await listAll(live, live.offices, connect.LISTABLE);
  await enqueueMissing(live.credentials.environment, listed);
  if (complete) await store.setState(live.connection.id, 'compare_at', startedAt.toISOString());
}

/** Offices whose load a hold cut short: loaded in full once the office check has run. */
async function loadAfterCheck(connectionId: string, offices: readonly string[]): Promise<void> {
  const pending = new Set([...(await takeLoadsAfterCheck(connectionId)), ...offices]);
  await store.setState(connectionId, 'load_after_check', JSON.stringify([...pending]));
}

async function takeLoadsAfterCheck(connectionId: string): Promise<string[]> {
  const stored = await store.getState(connectionId, 'load_after_check');
  await store.setState(connectionId, 'load_after_check', '');
  try {
    const parsed = JSON.parse(stored || '[]') as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((one): one is string => typeof one === 'string')
      : [];
  } catch {
    return [];
  }
}

/**
 * A login switched between live Vitec and its QA environment since its last office check
 * (question 169 a): every office the other system gave is taken off the sites, and the connection
 * starts again as a new one would, its offices checked and loaded in full from its system now.
 */
async function settleSwitch(current: AdapterApi, target: Live): Promise<Live> {
  const { connection, credentials } = target;
  const before = await lastCheck(connection.id);
  if (!before || before.environment === credentials.environment) return target;
  const toQa = credentials.environment === 'qa';
  const [now, other] = toQa
    ? ['Vitec’s QA environment, Vitec’s test system', 'live Vitec']
    : ['live Vitec', 'Vitec’s QA environment'];
  const reason = `someone switched the connection’s login to ${now}, on the tenant’s page. The homes, new-build projects and offices ${other} gave left the sites, and their agents stay. Core now loads the offices from ${toQa ? 'the QA environment' : 'live Vitec'}. Nothing needs doing if the switch was meant. To undo it, type ${toQa ? 'no' : 'yes'} in the field “Use Vitec’s QA environment” on the tenant’s page and save.`;
  // One switch, one cause: every office it takes off shares one id.
  const correlationId = randomUUID();
  for (const officeId of before.offices) {
    await takeOff(current, connection, officeId, reason, before.names[officeId], correlationId);
  }
  await store.clearState(connection.id);
  return { ...target, offices: [] };
}

/**
 * Ask Vitec which offices to sync (offices.ts) and act on the difference with `target.offices`,
 * what was synced before: an office that went is taken off the sites, and an office that came is
 * loaded. The blocks follow the check, the login's hold ends, and every office that came, read
 * again after a block, or had its load cut short by the hold is loaded in full.
 */
async function checkAndApply(current: AdapterApi, target: Live): Promise<Live> {
  const { credentials, connection } = target;
  const ids = credentials.customerId ? [credentials.customerId] : [];
  const before = await lastCheck(connection.id);
  const check = await checkOffices(connection.id, credentials, ids);
  await noteRefusedLogin(current, connection, before, check);
  const next = { ...target, offices: check.offices };
  // The blocks first, so an office that reads again is told unblocked before it is taken off.
  const back = await settleBlocks(current, connection, credentials.environment, check);
  // Offices taken off for the same reason in this check share one id: one cause, one alert.
  const causes = new Map<string, string>();
  for (const officeId of target.offices.filter((office) => !check.offices.includes(office))) {
    const name =
      before?.names[officeId] ??
      check.ids.flatMap((one) => one.offices).find((one) => one.customerId === officeId)?.name;
    const reason = takenOffBecause(check, officeId);
    const correlationId = causes.get(reason) ?? randomUUID();
    causes.set(reason, correlationId);
    await takeOff(current, connection, officeId, reason, name, correlationId);
  }
  // A hold that began after this check started waits for the next one, at the next tick.
  const held = await heldSince(connection.id);
  if (held !== null && held <= check.at) await store.setState(connection.id, 'held', '');
  else if (held !== null) await checkSoon(connection.id);
  const added = check.offices.filter((office) => !target.offices.includes(office));
  const blocked = await blockedIn(credentials.environment);
  const wanted = new Set([...added, ...back, ...(await takeLoadsAfterCheck(connection.id))]);
  const toLoad = check.offices.filter((office) => wanted.has(office) && !blocked.has(office));
  if (toLoad.length > 0) await load(next, toLoad);
  return next;
}

/**
 * The blocks follow the check (question 161 a): an office Vitec refused, on its own or with the
 * whole id, stays or becomes blocked while it is still synced, so no call asks about it until the
 * next check; a blocked office that read is unblocked, told to each connection it concerns, and
 * returned, to be loaded in full, since nothing of it was fetched while it was blocked.
 */
async function settleBlocks(
  current: AdapterApi,
  connection: Connection,
  environment: connect.Environment,
  check: OfficesCheck,
): Promise<string[]> {
  const seen = check.ids.flatMap((checked) => checked.offices);
  const readable = new Set(seen.filter((office) => office.readable).map((o) => o.customerId));
  const refusedId = check.ids.find((checked) => checked.refusedSince);
  for (const officeId of check.offices) {
    const office = seen.find((one) => one.customerId === officeId);
    const detail = office?.refusedSince
      ? sentence(OFFICE_REFUSED)
      : refusedId && !readable.has(officeId)
        ? `Vitec does not let this login read ${refusedId.id}, the customer or group id the office is listed under.`
        : null;
    if (detail) await markBlocked(current, connection.id, { environment, officeId }, detail);
  }
  return unblockReadable(current, connection.id, environment, readable);
}

/** The blocked offices of one system that read at the check: unblocked, told, and returned. */
async function unblockReadable(
  current: AdapterApi,
  connectionId: string,
  environment: connect.Environment,
  readable: ReadonlySet<string>,
): Promise<string[]> {
  const back = [];
  for (const office of await store.blockedOffices()) {
    if (office.environment !== environment || !readable.has(office.officeId)) continue;
    await store.unblockOffice(office);
    for (const id of await concerned(current, connectionId, office)) {
      await current.logEvent(
        'office.unblocked',
        { office_id: office.officeId },
        { connectionId: id },
      );
    }
    back.push(office.officeId);
  }
  return back;
}

/**
 * An office no longer synced (Patric, 2026-10-06: "an office that is removed regardless of method
 * needs to have their data pulled from client sites"): every record of it is tombstoned, so each
 * site deletes it at its next sync, and the tombstone stays for the engine's retention window.
 * Offices taken off for one cause carry the same correlation id.
 */
async function takeOff(
  current: AdapterApi,
  connection: Connection,
  officeId: string,
  reason: string,
  name: string | null | undefined,
  correlationId: string,
): Promise<void> {
  if (!officeId) return; // an empty office would be every office
  for (const datatype of DATATYPES)
    await current.presentIds(connection, datatype, { officeId }, []);
  // For the super admin's notifications (question 159 a): told once, at the moment it goes, with
  // the office's name as Vitec last gave it, since its own record is a tombstone by now.
  await current.logEvent(
    'office.taken_off',
    { office_id: officeId, ...(name ? { office_name: name } : {}), reason },
    { connectionId: connection.id, correlationId },
  );
}

/** What leaving the sites took, said after every reason an office leaves them. */
const LEFT =
  'Its homes, its new-build projects and the office itself left the sites, and its agents stay.';

/** Why an office the last check synced is not synced now, in plain words. */
function takenOffBecause(check: OfficesCheck, officeId: string): string {
  const seen = check.ids
    .flatMap((checked) => checked.offices)
    .find((office) => office.customerId === officeId);
  const refused = `Vitec has refused for a day to let this login read the office. ${LEFT} This happens, for example, when the brokerage’s Vitec subscription for the office ended or the password changed. Ask the brokerage. When Vitec lets the login read the office again, the office comes back at the next daily check, or within a minute after “Fetch offices” on the tenant’s page.`;
  if (seen?.readable) {
    return `the brokerage took the office out of its office group “Webbplats” in Vitec. ${LEFT} Nothing needs doing if the brokerage meant it. To bring the office back, the brokerage puts it in the group again, and “Fetch offices” on the tenant’s page acts on it within a minute.`;
  }
  if (seen?.refusedSince) return refused;
  if (seen?.detail === NO_SUCH_OFFICE) {
    return `Vitec still lists the office behind the customer or group id, but answers that the office does not exist when Core reads it. ${LEFT} Ask Vitec about the office if it should be on the sites.`;
  }
  if (seen) {
    return `Vitec still lists the office behind the customer or group id, but Core could not read it, because ${seen.detail ?? 'the call to Vitec failed'}. ${LEFT} Ask Vitec why the office cannot be read.`;
  }
  if (check.ids.some((checked) => checked.refusedSince)) return refused;
  const ids = check.ids.map((checked) => checked.id).join(' and ');
  return `Vitec no longer lists the office behind ${ids || 'the customer or group id'}, the customer or group id on the connection. ${LEFT} If the office should be on the sites, check the field “Customer or group id” on the tenant’s page with the brokerage.`;
}

/**
 * The connection's own id is refused now and was not at the last check: told once, for the super
 * admin's notifications (question 159 a); the offices it takes off are told one by one.
 */
async function noteRefusedLogin(
  current: AdapterApi,
  connection: Connection,
  before: OfficesCheck | null,
  check: OfficesCheck,
): Promise<void> {
  for (const checked of check.ids) {
    if (!checked.refusedSince) continue;
    if (before?.ids.find((one) => one.id === checked.id)?.refusedSince) continue;
    await current.logEvent(
      'login.refused',
      {
        detail: `Vitec no longer lets this username and password read ${checked.id}, the customer or group id on the connection. The offices behind it stay on the sites for one more day without updates, and leave the sites if Vitec still refuses at the next daily check. This happens, for example, when the brokerage’s Vitec subscription ended or the password changed. Ask the brokerage. If the password changed, type the new one in the field “Password” on the tenant’s page, press “Check login” and save.`,
      },
      { connectionId: connection.id },
    );
  }
}

const ageMs = (iso: string | null): number =>
  iso ? Date.now() - new Date(iso).getTime() : Number.POSITIVE_INFINITY;

/**
 * The two schedules, checked every minute. After a start, each connection runs both whatever their
 * age, and the fetch list is drained, before the adapter counts as caught up: a restart, and a
 * database restored to an earlier point, are made good within minutes and `vitec.catch_up` is red
 * until then (strategy §7.2). A connection whose start-up round failed runs it again at the next
 * tick, while the others run only what is due, so one system that is down never makes the other
 * list everything once a minute. Later ticks run what is due.
 */
let startPending = true;
/** The connections whose start-up round is still to run; null until the first tick names them. */
let toStart: Set<string> | null = null;
/** When this copy of the adapter started: its start-up round checks each login's offices once. */
let runningSince = '';

/** One connection's schedules that are due: the offices first, then the catch-up and the
 * comparison over the offices the check chose. */
async function runDue(current: AdapterApi, given: Live, startup: boolean): Promise<void> {
  const { id } = given.connection;
  const aged = async (key: string, every: number): Promise<boolean> =>
    ageMs(await store.getState(id, key)) >= every;
  // The start-up round checks the offices once per start, never again when it is retried: the
  // check calls every office of the id, refused ones too, and a refused office gets that call
  // once a day (question 161 a).
  const checkedSinceStart = ((await lastCheck(id))?.at ?? '') > runningSince;
  const target =
    (startup && !checkedSinceStart) || (await aged('offices_check_at', CHECK_EVERY_MS))
      ? await checkAndApply(current, given)
      : given;
  if (target.offices.length === 0) return;
  if (startup || (await aged('catch_up_at', CATCH_UP_EVERY_MS))) await catchUp(target);
  if (startup || (await aged('compare_at', COMPARE_EVERY_MS))) await compare(target);
}

async function tickOnce(): Promise<void> {
  const current = engine;
  if (!current) return;
  const targets: Live[] = [];
  for (const target of await live(current)) targets.push(await settleSwitch(current, target));
  const starting = (toStart ??= new Set(targets.map((target) => target.connection.id)));
  await resumeDue(targets);
  await settleDoorRefusals(current, targets);
  await dropStrayBlocks(targets);
  for (const given of targets) {
    try {
      await runDue(current, given, starting.has(given.connection.id));
      starting.delete(given.connection.id);
    } catch (error) {
      await current.logEvent(
        'schedule.failed',
        {
          connection_id: given.connection.id,
          detail: `Core’s regular work for this connection stopped with an error, because ${failureInWords(error)}. Core tries again within a minute. Nothing needs doing unless this repeats every minute. If it does, the Vitec page shows whether Vitec answers.`,
        },
        { connectionId: given.connection.id },
      );
      current.report(error, { where: 'vitec schedule', connection_id: given.connection.id });
    }
  }
  if (startPending && !targets.some((target) => starting.has(target.connection.id))) {
    await scheduleDrain();
    startPending = false;
  }
}

// ---- Health -----------------------------------------------------------------------------------

// Each check has a level (question 172) and says, for a cold reader, what is wrong, what it means
// for the sites and what to do (AGENTS.md, definition of done 5). `detail` is public on
// /v1/health, so it holds counts and words only; the connections and offices go in `names`.

/** A notification Core has not handled yet: P2, and P1 once it has waited an hour. */
async function webhookHealth(): Promise<HealthResult> {
  const wait = await store.oldestWebhookWaitMs();
  if (wait === null || wait <= LAG_LIMIT_MS) return { ok: true };
  return {
    ok: false,
    level: wait > URGENT_AFTER_MS ? 'P1' : 'P2',
    detail: `Vitec told Core about a change ${lasting(wait)} ago, and Core has not handled it yet, so the sites show that change late. It usually clears by itself, and Flow shows what waits.`,
  };
}

/** Records that failed their last fetches: P2. */
async function retriesHealth(): Promise<HealthResult> {
  const count = await store.retrying(RETRIES_RED);
  if (count === 0) return { ok: true };
  const them = agree(count, 'it', 'them');
  return {
    ok: false,
    level: 'P2',
    detail: `${counted(count, 'record', 'records')} failed to fetch from Vitec ${String(RETRIES_RED)} times in a row, so the sites show ${them} as before. Core tries each one again, up to ${String(store.MAX_ATTEMPTS)} times. The fetch list on the Vitec page shows ${them}, with “Retry now” and “Drop”.`,
  };
}

/** Connections whose saved login Core cannot read: P1. */
async function loginHealth(current: AdapterApi): Promise<HealthResult> {
  const unreadable = (await current.connections()).filter(
    (connection) => !credentialsOf(connection),
  );
  if (unreadable.length === 0) return { ok: true };
  const n = unreadable.length;
  return {
    ok: false,
    level: 'P1',
    detail: `Core cannot read the saved Vitec login of ${counted(n, 'connection', 'connections')}, so nothing is fetched for ${agree(n, 'it', 'them')} and ${agree(n, 'its', 'their')} sites get no new changes. Save the login again on the tenant’s page.`,
    names: unreadable.map((connection) => ({ connection: connection.id })),
  };
}

/** Connections whose office check chose no office: P2. */
async function officesNoneHealth(current: AdapterApi): Promise<HealthResult> {
  const empty: AdminThing[] = [];
  for (const target of await live(current)) {
    // Before its first check a connection has no offices yet; "catching up" covers that time.
    if (target.offices.length === 0 && (await lastCheck(target.connection.id)) !== null) {
      empty.push({ connection: target.connection.id });
    }
  }
  if (empty.length === 0) return { ok: true };
  const n = empty.length;
  return {
    ok: false,
    level: 'P2',
    detail: `${counted(n, 'connection has', 'connections have')} no offices to fetch, so ${agree(n, 'its', 'their')} sites show no homes from ${agree(n, 'it', 'them')}. Check the customer or group id saved on the tenant’s page, and the office group “Webbplats” in Vitec.`,
    names: empty,
  };
}

/**
 * Catching up after the worker started: P3. A connection not caught up for over 13 hours, or
 * never: P1. Restoring a database waits for this check to pass (strategy §7.2).
 */
async function catchUpHealth(current: AdapterApi): Promise<HealthResult> {
  if (startPending) {
    return {
      ok: false,
      level: 'P3',
      detail:
        'Core is catching up with Vitec since the worker started, so the sites may lag behind for a few minutes. Wait for this to pass before you run Manual sync.',
    };
  }
  const behind: AdminThing[] = [];
  for (const target of await live(current)) {
    if (target.offices.length === 0) continue;
    const age = ageMs(await store.getState(target.connection.id, 'catch_up_at'));
    if (age <= CATCH_UP_LIMIT_MS) continue;
    behind.push({
      connection: target.connection.id,
      note: Number.isFinite(age) ? `last caught up ${lasting(age)} ago` : 'never caught up',
    });
  }
  if (behind.length === 0) return { ok: true };
  const n = behind.length;
  return {
    ok: false,
    level: 'P1',
    detail: `Core has not caught up ${counted(n, 'connection', 'connections')} with Vitec for over ${lasting(CATCH_UP_LIMIT_MS)}, so a change Vitec did not tell Core about may be missing from ${agree(n, 'its', 'their')} sites. The Vitec page shows each connection’s last catch-up, and “Catch up now” runs one.`,
    names: behind,
  };
}

/** Offices Vitec refuses: P2. */
async function refusedHealth(current: AdapterApi): Promise<HealthResult> {
  const blocked = await store.blockedOffices();
  if (blocked.length === 0) return { ok: true };
  const targets = await live(current);
  const names: (string | AdminThing)[] = [];
  for (const office of blocked) {
    const since = lasting(Date.now() - office.blockedAt.getTime());
    const qa = office.environment === 'qa' ? 'in Vitec’s QA environment, ' : '';
    // Core names the office under a connection that fetches it, so a QA office is its QA login's.
    const by = targets.find((one) => syncs(one, office));
    names.push(
      by
        ? {
            connection: by.connection.id,
            office: office.officeId,
            note: `${qa}refused ${since} ago`,
          }
        : `${officeNamed(office)}, refused ${since} ago`,
    );
  }
  return {
    ok: false,
    level: 'P2',
    detail: `Vitec refuses to let Core read ${counted(blocked.length, 'office', 'offices')}. Each stays on the sites for a day after the first refusal, without updates, and then leaves them with its homes and new-build projects if Vitec still refuses it. Its agents stay. Ask the brokerage about a refused office. Core asks Vitec about it again only at the daily office check, and “Fetch offices” on the tenant’s page asks within a minute.`,
    names,
  };
}

/** Connections paused after failures on Vitec's side: P2, and P1 once Vitec has failed an hour. */
async function pausedHealth(current: AdapterApi): Promise<HealthResult> {
  const names: AdminThing[] = [];
  let urgent = false;
  for (const connection of await current.connections()) {
    const pause = await pauseOf(connection.id);
    if (!paused(pause)) continue;
    const failing = Date.now() - (pause.pausedSince ?? Date.now());
    urgent ||= failing > URGENT_AFTER_MS;
    const again = lasting((pause.pausedUntil ?? 0) - Date.now());
    names.push({
      connection: connection.id,
      note: `failing for ${lasting(failing)}, asked again in ${again}`,
    });
  }
  if (names.length === 0) return { ok: true };
  const n = names.length;
  return {
    ok: false,
    level: urgent ? 'P1' : 'P2',
    detail: `Core stopped asking Vitec for ${counted(n, 'connection', 'connections')} after ${String(PAUSE_AFTER)} failed calls in a row, so ${agree(n, 'its', 'their')} sites get no new changes meanwhile. Core asks Vitec again by itself. Once Vitec answers again, “Ask Vitec again now” on the Vitec page starts at once.`,
    names,
  };
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
        detail:
          'the form was not sent to Vitec, because the connection has no username or password saved. Type them on the tenant’s page, save, and send the form again from Failed forms.',
      });
    }
    return forms.submit(connection, credentials, submission);
  },

  // A login with "Use Vitec’s QA environment" ticked is for Vitec's test system, so staging sends
  // its forms too, to QA's address (question 181, Patric: "staging dry run unless qa").
  testSystem: (connection) => credentialsOf(connection)?.environment === 'qa',

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
    runningSince = new Date().toISOString();
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
      if (!credentials) return;
      const target = { connection: event.connection, credentials, offices: [] as string[] };
      if (
        event.type === 'connection_added' ||
        event.type === 'offices_added' ||
        event.type === 'offices_removed'
      ) {
        // A new connection, or the engine's own office list changed (for this adapter only ever
        // to empty): Vitec is asked which offices to sync, and every one of them is loaded. It
        // waits for the schedules' turn, so a tick never checks, switches or loads the same
        // connection at the same moment, and nothing is taken off twice.
        const applied = serial(async () => {
          await checkAndApply(given, await settleSwitch(given, target));
        }, scheduling);
        // The schedules go on whatever happens here; a failure reaches the engine below.
        scheduling = applied.catch(() => undefined);
        await applied;
        return;
      }
      target.offices = await officesOf(event.connection);
      if (event.type === 'resync') await resync(target, event.datatype);
      if (event.type === 'refetch') await refetch(target, event.records);
    });

    given.healthCheck(`${PROVIDER}.webhook_lag`, webhookHealth);
    given.healthCheck(`${PROVIDER}.retries`, retriesHealth);
    given.healthCheck(`${PROVIDER}.login`, () => loginHealth(given));
    given.healthCheck(`${PROVIDER}.no_offices`, () => officesNoneHealth(given));
    given.healthCheck(`${PROVIDER}.catch_up`, () => catchUpHealth(given));
    given.healthCheck(`${PROVIDER}.offices`, () => refusedHealth(given));
    given.healthCheck(`${PROVIDER}.connect`, () => pausedHealth(given));

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
    toStart = null;
    await Promise.all(Object.values(draining));
    await scheduling;
    await store.close();
  },
};

/** Test and local use: fetch everything queued now, and wait for it. */
export const drainFetchList = scheduleDrain;
/** Test and local use: run any overdue catch-up or comparison now, and wait for it. */
export const runSchedules = scheduleTick;
