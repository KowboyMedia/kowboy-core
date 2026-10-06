// The adapter's own tables (strategy §5.1: its own queue, dedupe and retries; open question 4,
// option a). The fetch list survives restarts and is shared by the web process, which accepts
// webhooks, and the worker, which fetches. `vitec_known` holds the ids seen per office, so a
// missing id is confirmed gone with a fetch before anything is tombstoned. `vitec_state` is a
// little state per connection. The adapter opens its own pool on DATABASE_URL and creates its
// tables itself; it never touches an engine table.
import pg from 'pg';
import type { Datatype } from '../../engine/adapter-api/index.js';
import type { Environment } from './api.js';

/** An office in one of Vitec's systems: the same office id in live Vitec and in QA is two offices. */
export type Office = { environment: Environment; officeId: string };

/**
 * The office id the lists keep (question 169 a): a QA office's rows carry its system, `qa:M30011`,
 * because Vitec's QA may hold the same office ids as live Vitec (a copy of live data), and the two
 * must never share a fetch, a seen id or a refusal. A live office keeps its bare id, so the rows
 * written before QA existed stay as they are.
 */
const QA = 'qa:';

const keyOf = ({ environment, officeId }: Office): string =>
  environment === 'qa' ? `${QA}${officeId}` : officeId;

const officeOf = (key: string): Office =>
  key.startsWith(QA)
    ? { environment: 'qa', officeId: key.slice(QA.length) }
    : { environment: 'live', officeId: key };

/** SQL: whether a list row's office is in the system the parameter names (true: QA). */
const inSystem = (parameter: string): string => `(office_id like '${QA}%') = ${parameter}`;

/** Whether offices synced in one system hold this office: the same id in the other is another. */
export const holds = (
  environment: Environment,
  offices: readonly string[],
  office: Office,
): boolean => office.environment === environment && offices.includes(office.officeId);

/**
 * Why a record is on the list. A signal from Vitec, a webhook or a removal, and an operator's
 * "fetch again" go before loads and catch-ups (strategy §5.3). A 'remove' entry is not fetched:
 * the record left the sites' scope.
 */
export type Reason = 'webhook' | 'remove' | 'load' | 'catch_up' | 'reference' | 'refetch';

export type Entry = Office & {
  datatype: Datatype;
  remoteId: string;
  reason: Reason;
  correlationId: string;
  queuedAt: Date;
  attempts: number;
};

type Row = {
  office_id: string;
  datatype: Datatype;
  remote_id: string;
  reason: Reason;
  correlation_id: string;
  queued_at: Date;
  attempts: number;
};

const RETRY_BASE_MS = 10_000;
/** After this many failed fetches in a row the record waits for the next signal or an operator. */
export const MAX_ATTEMPTS = 6;

const TABLES = `
create table if not exists vitec_fetch_list (
  office_id    text not null,
  datatype       text not null,
  remote_id      text not null,
  reason         text not null,
  correlation_id text not null,
  queued_at      timestamptz not null default now(),
  next_at        timestamptz,
  attempts       int not null default 0,
  last_error     text,
  primary key (office_id, datatype, remote_id)
);
create index if not exists vitec_fetch_list_due on vitec_fetch_list (next_at, queued_at);
create table if not exists vitec_known (
  office_id  text not null,
  datatype   text not null,
  remote_id  text not null,
  changed_at text,
  primary key (office_id, datatype, remote_id)
);
alter table vitec_known add column if not exists changed_at text;
create table if not exists vitec_state (
  connection_id text not null,
  name          text not null,
  value         text not null,
  primary key (connection_id, name)
);
create table if not exists vitec_office_state (
  office_id     text primary key,
  blocked_at    timestamptz not null default now(),
  blocked_until timestamptz not null,
  reason        text not null,
  probes        int not null default 0
);`;

let pool: pg.Pool | null = null;
let ready: Promise<pg.Pool> | null = null;

/** How long a process trusts the blocks it read; this process's own changes apply at once. */
const BLOCKS_FRESH_MS = 5_000;
let blocks: { at: number; keys: Promise<Set<string>> } | null = null;

/** The pool, opened on first use so the web process and the worker each get their own. */
function db(): Promise<pg.Pool> {
  if (!ready) {
    const url = process.env['DATABASE_URL'];
    if (!url) throw new Error('DATABASE_URL is not set');
    pool = new pg.Pool({
      connectionString: url,
      // One connection: this pool and the engine's share the cluster's 22 slots with the other
      // app and with a deploy's new processes (the arithmetic is in engine/storage/db.ts).
      max: 1,
      // The engine's pool has the same guards (docs/decisions.md, 2026-09-18): a query on a
      // connection the network silently dropped fails after a minute and the pool discards that
      // connection, which with one connection is the difference between a stall and a recovery.
      query_timeout: 60_000,
      connectionTimeoutMillis: 10_000,
      keepAlive: true,
    });
    pool.on('error', (error) => console.error('vitec: idle database client error', error));
    const opened = pool;
    ready = opened
      .query(TABLES)
      .then(() => opened)
      .catch((error: unknown) => {
        ready = null;
        throw error;
      });
  }
  return ready;
}

export async function close(): Promise<void> {
  const open = pool;
  pool = null;
  ready = null;
  await open?.end();
}

const toEntry = (row: Row): Entry => ({
  ...officeOf(row.office_id),
  datatype: row.datatype,
  remoteId: row.remote_id,
  reason: row.reason,
  correlationId: row.correlation_id,
  queuedAt: row.queued_at,
  attempts: row.attempts,
});

/**
 * Put records on the list. A record already listed is kept once: a signal from Vitec (a webhook or
 * a removal) for it counts from now, goes first and decides what happens, the last signal
 * winning; any signal wakes a record an operator was left with.
 */
export async function enqueue(
  entries: Pick<
    Entry,
    'environment' | 'officeId' | 'datatype' | 'remoteId' | 'reason' | 'correlationId'
  >[],
): Promise<void> {
  if (entries.length === 0) return;
  await (
    await db()
  ).query(
    `insert into vitec_fetch_list (office_id, datatype, remote_id, reason, correlation_id, next_at)
     select office_id, datatype, remote_id, reason, correlation_id, now()
     from unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[])
       as fresh(office_id, datatype, remote_id, reason, correlation_id)
     on conflict (office_id, datatype, remote_id) do update set
       next_at = now(),
       attempts = case when vitec_fetch_list.next_at is null then 0 else vitec_fetch_list.attempts end,
       reason = case
         when excluded.reason in ('webhook', 'remove') then excluded.reason
         else vitec_fetch_list.reason end,
       queued_at = case
         when excluded.reason in ('webhook', 'remove') and vitec_fetch_list.reason not in ('webhook', 'remove') then now()
         else vitec_fetch_list.queued_at end,
       correlation_id = case
         when excluded.reason in ('webhook', 'remove') then excluded.correlation_id
         else vitec_fetch_list.correlation_id end`,
    [
      entries.map(keyOf),
      entries.map((entry) => entry.datatype),
      entries.map((entry) => entry.remoteId),
      entries.map((entry) => entry.reason),
      entries.map((entry) => entry.correlationId),
    ],
  );
}

/**
 * Take up to `limit` due records of one system off the list, signals first, oldest first, none of
 * the skipped offices. Taking is deleting: a record signalled again while its fetch runs gets its
 * own later fetch.
 */
export async function claim(
  environment: Environment,
  limit: number,
  skip: readonly Office[] = [],
): Promise<Entry[]> {
  const { rows } = await (
    await db()
  ).query<Row>(
    `delete from vitec_fetch_list
     where (office_id, datatype, remote_id) in (
       select office_id, datatype, remote_id from vitec_fetch_list
       where next_at is not null and next_at <= now() and office_id <> all($2::text[])
         and ${inSystem('$3')}
       order by (reason in ('webhook', 'remove', 'refetch')) desc, queued_at
       limit $1
       for update skip locked)
     returning *`,
    [limit, skip.map(keyOf), environment === 'qa'],
  );
  return rows.map(toEntry);
}

/** Whether a record of the system is due: an idle drain asks this and nothing more. */
export async function anyDue(environment: Environment): Promise<boolean> {
  const { rows } = await (
    await db()
  ).query<{ due: boolean }>(
    `select exists (select 1 from vitec_fetch_list
       where next_at is not null and next_at <= now() and ${inSystem('$1')}) as due`,
    [environment === 'qa'],
  );
  return rows[0]?.due === true;
}

/** Put a claimed record back as it was, to wait for its office or connection to come back. */
export async function park(entry: Entry): Promise<void> {
  await (
    await db()
  ).query(
    `insert into vitec_fetch_list
       (office_id, datatype, remote_id, reason, correlation_id, queued_at, next_at, attempts)
     values ($1, $2, $3, $4, $5, $6, now(), $7)
     on conflict (office_id, datatype, remote_id) do nothing`,
    [
      keyOf(entry),
      entry.datatype,
      entry.remoteId,
      entry.reason,
      entry.correlationId,
      entry.queuedAt,
      entry.attempts,
    ],
  );
}

/**
 * Put a record back after a failed fetch, with exponential backoff, or give up after
 * MAX_ATTEMPTS. A fresh signal that arrived meanwhile keeps its earlier time.
 */
export async function requeue(entry: Entry, error: string): Promise<'retrying' | 'given_up'> {
  const attempts = entry.attempts + 1;
  const givenUp = attempts >= MAX_ATTEMPTS;
  const delayMs = RETRY_BASE_MS * 2 ** (attempts - 1);
  await (
    await db()
  ).query(
    `insert into vitec_fetch_list
       (office_id, datatype, remote_id, reason, correlation_id, queued_at, next_at, attempts, last_error)
     values ($1, $2, $3, $4, $5, $6, case when $7 then null else now() + ($8 || ' milliseconds')::interval end, $9, $10)
     on conflict (office_id, datatype, remote_id) do update set
       attempts = excluded.attempts,
       last_error = excluded.last_error,
       queued_at = least(vitec_fetch_list.queued_at, excluded.queued_at),
       next_at = case
         when vitec_fetch_list.next_at is not null
          and vitec_fetch_list.next_at < coalesce(excluded.next_at, 'infinity'::timestamptz)
         then vitec_fetch_list.next_at
         else excluded.next_at end`,
    [
      keyOf(entry),
      entry.datatype,
      entry.remoteId,
      entry.reason,
      entry.correlationId,
      entry.queuedAt,
      givenUp,
      String(delayMs),
      attempts,
      error.slice(0, 1000),
    ],
  );
  return givenUp ? 'given_up' : 'retrying';
}

/** The record was fetched: remember it, with the change date Vitec gave it. */
export async function remember(
  office: Office,
  datatype: Datatype,
  remoteId: string,
  changedAt: string | null,
): Promise<void> {
  await (
    await db()
  ).query(
    `insert into vitec_known (office_id, datatype, remote_id, changed_at) values ($1, $2, $3, $4)
     on conflict (office_id, datatype, remote_id) do update set changed_at = excluded.changed_at`,
    [keyOf(office), datatype, remoteId, changedAt],
  );
}

export async function forget(office: Office, datatype: Datatype, remoteId: string): Promise<void> {
  await (
    await db()
  ).query('delete from vitec_known where office_id = $1 and datatype = $2 and remote_id = $3', [
    keyOf(office),
    datatype,
    remoteId,
  ]);
}

/** Every id seen for an office and datatype, with the change date at its last fetch. */
export async function known(
  office: Office,
  datatype: Datatype,
): Promise<Map<string, string | null>> {
  const { rows } = await (
    await db()
  ).query<{ remote_id: string; changed_at: string | null }>(
    'select remote_id, changed_at from vitec_known where office_id = $1 and datatype = $2',
    [keyOf(office), datatype],
  );
  return new Map(rows.map((row) => [row.remote_id, row.changed_at]));
}

export async function isKnown(
  office: Office,
  datatype: Datatype,
  remoteId: string,
): Promise<boolean> {
  const { rowCount } = await (
    await db()
  ).query('select 1 from vitec_known where office_id = $1 and datatype = $2 and remote_id = $3', [
    keyOf(office),
    datatype,
    remoteId,
  ]);
  return (rowCount ?? 0) > 0;
}

/** How long the oldest signal still waiting has waited, in milliseconds, or null when none waits. */
export async function oldestWebhookWaitMs(): Promise<number | null> {
  const { rows } = await (
    await db()
  ).query<{ wait_ms: string | null }>(
    `select extract(epoch from (now() - min(queued_at))) * 1000 as wait_ms
     from vitec_fetch_list where reason in ('webhook', 'remove') and next_at is not null`,
  );
  const wait = rows[0]?.wait_ms;
  return wait === undefined || wait === null ? null : Number(wait);
}

/** Records that have failed at least `threshold` fetches in a row. */
export async function retrying(threshold: number): Promise<number> {
  const { rows } = await (
    await db()
  ).query<{ n: string }>('select count(*) as n from vitec_fetch_list where attempts >= $1', [
    threshold,
  ]);
  return Number(rows[0]?.n ?? 0);
}

export async function getState(connectionId: string, name: string): Promise<string | null> {
  const { rows } = await (
    await db()
  ).query<{ value: string }>(
    'select value from vitec_state where connection_id = $1 and name = $2',
    [connectionId, name],
  );
  return rows[0]?.value ?? null;
}

export async function setState(connectionId: string, name: string, value: string): Promise<void> {
  await (
    await db()
  ).query(
    `insert into vitec_state (connection_id, name, value) values ($1, $2, $3)
     on conflict (connection_id, name) do update set value = excluded.value`,
    [connectionId, name, value],
  );
}

/** Forget a connection's state, so that it starts again as a new connection would. */
export async function clearState(connectionId: string): Promise<void> {
  await (await db()).query('delete from vitec_state where connection_id = $1', [connectionId]);
}

/** Add one to a counter kept in the state, atomically, and return the new count. */
export async function increment(connectionId: string, name: string): Promise<number> {
  const { rows } = await (
    await db()
  ).query<{ value: string }>(
    `insert into vitec_state (connection_id, name, value) values ($1, $2, '1')
     on conflict (connection_id, name) do update
       set value = (coalesce(nullif(vitec_state.value, ''), '0')::int + 1)::text
     returning value`,
    [connectionId, name],
  );
  return Number(rows[0]?.value ?? 0);
}

/** Set a state value only when it is unset or empty: true when this call set it. */
export async function setIfEmpty(
  connectionId: string,
  name: string,
  value: string,
): Promise<boolean> {
  const { rowCount } = await (
    await db()
  ).query(
    `insert into vitec_state (connection_id, name, value) values ($1, $2, $3)
     on conflict (connection_id, name) do update set value = excluded.value
     where vitec_state.value = ''`,
    [connectionId, name, value],
  );
  return (rowCount ?? 0) > 0;
}

// Test and local use.

export async function depth(): Promise<number> {
  const { rows } = await (
    await db()
  ).query<{ n: string }>('select count(*) as n from vitec_fetch_list');
  return Number(rows[0]?.n ?? 0);
}

/** Make every waiting record due now, so a test need not wait out a backoff. */
export async function expedite(): Promise<void> {
  await (await db()).query('update vitec_fetch_list set next_at = now() where next_at is not null');
}

/** Pretend every listed record was queued `ms` earlier. */
export async function backdate(ms: number): Promise<void> {
  await (
    await db()
  ).query(`update vitec_fetch_list set queued_at = queued_at - ($1 || ' milliseconds')::interval`, [
    String(ms),
  ]);
}

export async function reset(): Promise<void> {
  await (
    await db()
  ).query('truncate vitec_fetch_list, vitec_known, vitec_state, vitec_office_state');
  blocks = null;
}

// ---- What the adapter's admin panel shows and touches (adapters/vitec/admin) ------------------

export type EntryView = Entry & { nextAt: Date | null; lastError: string | null };

/**
 * The fetch list as it stands: due first, then retrying, then what an operator was left with.
 * Named offices narrow it to theirs, each in its own system.
 */
export async function entries(
  limit = 50,
  offices: readonly Office[] | null = null,
): Promise<EntryView[]> {
  const { rows } = await (
    await db()
  ).query<Row & { next_at: Date | null; last_error: string | null }>(
    `select * from vitec_fetch_list where ($2::text[] is null or office_id = any($2::text[]))
     order by next_at nulls last, queued_at limit $1`,
    [limit, offices?.map(keyOf) ?? null],
  );
  return rows.map((row) => ({ ...toEntry(row), nextAt: row.next_at, lastError: row.last_error }));
}

export type Summary = { waiting: number; retrying: number; givenUp: number };

/** How many records of these offices wait, retry, or were given up on. */
export async function summary(offices: readonly Office[]): Promise<Summary> {
  const { rows } = await (
    await db()
  ).query<{ waiting: string; retrying: string; given_up: string }>(
    `select count(*) filter (where next_at is not null and attempts = 0) as waiting,
            count(*) filter (where next_at is not null and attempts > 0) as retrying,
            count(*) filter (where next_at is null) as given_up
     from vitec_fetch_list where office_id = any($1::text[])`,
    [offices.map(keyOf)],
  );
  const row = rows[0];
  return {
    waiting: Number(row?.waiting ?? 0),
    retrying: Number(row?.retrying ?? 0),
    givenUp: Number(row?.given_up ?? 0),
  };
}

/** An operator's "try again now": due at once, attempts back to zero. */
export async function expediteOne(
  office: Office,
  datatype: Datatype,
  remoteId: string,
): Promise<void> {
  await (
    await db()
  ).query(
    'update vitec_fetch_list set next_at = now(), attempts = 0 where office_id = $1 and datatype = $2 and remote_id = $3',
    [keyOf(office), datatype, remoteId],
  );
}

/** An operator's "drop it": off the list, nothing else changes. */
export async function drop(office: Office, datatype: Datatype, remoteId: string): Promise<void> {
  await (
    await db()
  ).query(
    'delete from vitec_fetch_list where office_id = $1 and datatype = $2 and remote_id = $3',
    [keyOf(office), datatype, remoteId],
  );
}

// ---- Offices Vitec refuses (401 or 403): blocked until the office check reads them again --------
// The columns blocked_until and probes are left from the probes (question 161 a removed them) and
// are no longer read.

export type BlockedOffice = Office & {
  blockedAt: Date;
  reason: string;
};

type OfficeRow = {
  office_id: string;
  blocked_at: Date;
  reason: string;
};

const toBlocked = (row: OfficeRow): BlockedOffice => ({
  ...officeOf(row.office_id),
  blockedAt: row.blocked_at,
  reason: row.reason,
});

/**
 * Stop all traffic to an office until the office check reads it again. Returns true when the
 * office was not blocked before; a second refusal keeps the first date and takes the new reason.
 */
export async function blockOffice(office: Office, reason: string): Promise<boolean> {
  const { rows } = await (
    await db()
  ).query<{ fresh: boolean }>(
    `insert into vitec_office_state (office_id, blocked_until, reason)
     values ($1, now(), $2)
     on conflict (office_id) do update set reason = excluded.reason
     returning (xmax = 0) as fresh`,
    [keyOf(office), reason.slice(0, 1000)],
  );
  blocks = null;
  return rows[0]?.fresh ?? false;
}

export async function unblockOffice(office: Office): Promise<void> {
  await (await db()).query('delete from vitec_office_state where office_id = $1', [keyOf(office)]);
  blocks = null;
}

/**
 * Refusals met at the door (api.ts) by a request the fetch list did not make, a person's button or
 * a form, kept in `vitec_state` under this name, which no connection's short name can be, until
 * the worker's next tick blocks the office and tells its connections (index.ts).
 */
const DOOR = '(door)';
const REFUSED = 'refused:';

/** Note that Vitec refused the office at the door: from now on the door keeps its requests back. */
export async function noteRefusal(office: Office, detail: string): Promise<void> {
  await (
    await db()
  ).query(
    `insert into vitec_state (connection_id, name, value) values ($1, $2, $3)
     on conflict (connection_id, name) do nothing`,
    [DOOR, `${REFUSED}${keyOf(office)}`, detail.slice(0, 1000)],
  );
  blocks = null;
}

/** The refusals met at the door that the worker has not yet turned into blocks. */
export async function refusalsAtDoor(): Promise<(Office & { detail: string })[]> {
  const { rows } = await (
    await db()
  ).query<{ name: string; value: string }>(
    'select name, value from vitec_state where connection_id = $1 order by name',
    [DOOR],
  );
  return rows
    .filter((row) => row.name.startsWith(REFUSED))
    .map((row) => ({ ...officeOf(row.name.slice(REFUSED.length)), detail: row.value }));
}

/** A refusal met at the door is settled: blocked by the worker, or concerning no connection. */
export async function forgetRefusal(office: Office): Promise<void> {
  await (
    await db()
  ).query('delete from vitec_state where connection_id = $1 and name = $2', [
    DOOR,
    `${REFUSED}${keyOf(office)}`,
  ]);
  blocks = null;
}

/**
 * Whether Vitec refuses the office, asked before every request (api.ts): blocked, or refused at
 * the door and not yet settled. Read from the tables at most once in five seconds per process, so
 * the check costs the database almost nothing.
 */
export async function isBlocked(office: Office): Promise<boolean> {
  if (!blocks || Date.now() - blocks.at >= BLOCKS_FRESH_MS) {
    const keys = db()
      .then((pool) =>
        pool.query<{ office_id: string }>(
          `select office_id from vitec_office_state
           union all
           select substr(name, ${REFUSED.length + 1}) from vitec_state
            where connection_id = $1 and name like $2`,
          [DOOR, `${REFUSED}%`],
        ),
      )
      .then(({ rows }) => new Set(rows.map((row) => row.office_id)));
    blocks = { at: Date.now(), keys };
    keys.catch(() => {
      if (blocks?.keys === keys) blocks = null;
    });
  }
  return (await blocks.keys).has(keyOf(office));
}

export async function blockedOffices(): Promise<BlockedOffice[]> {
  const { rows } = await (
    await db()
  ).query<OfficeRow>(
    'select office_id, blocked_at, reason from vitec_office_state order by blocked_at',
  );
  return rows.map(toBlocked);
}
