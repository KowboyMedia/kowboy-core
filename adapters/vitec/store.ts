// The adapter's own tables (strategy §5.1: its own queue, dedupe and retries; open question 4,
// option a). The fetch list survives restarts and is shared by the web process, which accepts
// webhooks, and the worker, which fetches. `vitec_known` holds the ids seen per office, so a
// missing id is confirmed gone with a fetch before anything is tombstoned. `vitec_state` is a
// little state per connection. The adapter opens its own pool on DATABASE_URL and creates its
// tables itself; it never touches an engine table.
import pg from 'pg';
import type { Datatype } from '../../engine/adapter-api/index.js';

/** Why a record is on the list. Webhooks are fetched before anything else (strategy §5.3). */
export type Reason = 'webhook' | 'load' | 'catch_up' | 'compare' | 'reference';

export type Entry = {
  officeId: string;
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
  office_id text not null,
  datatype    text not null,
  remote_id   text not null,
  primary key (office_id, datatype, remote_id)
);
create table if not exists vitec_state (
  connection_id text not null,
  name          text not null,
  value         text not null,
  primary key (connection_id, name)
);`;

let pool: pg.Pool | null = null;
let ready: Promise<pg.Pool> | null = null;

/** The pool, opened on first use so the web process and the worker each get their own. */
function db(): Promise<pg.Pool> {
  if (!ready) {
    const url = process.env['DATABASE_URL'];
    if (!url) throw new Error('DATABASE_URL is not set');
    pool = new pg.Pool({ connectionString: url, max: 3 });
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
  officeId: row.office_id,
  datatype: row.datatype,
  remoteId: row.remote_id,
  reason: row.reason,
  correlationId: row.correlation_id,
  queuedAt: row.queued_at,
  attempts: row.attempts,
});

/**
 * Put records on the list. A record already listed is kept once: a webhook for it counts from now
 * and goes first; any signal wakes a record an operator was left with.
 */
export async function enqueue(
  entries: Pick<Entry, 'officeId' | 'datatype' | 'remoteId' | 'reason' | 'correlationId'>[],
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
       reason = case when excluded.reason = 'webhook' then 'webhook' else vitec_fetch_list.reason end,
       queued_at = case
         when excluded.reason = 'webhook' and vitec_fetch_list.reason <> 'webhook' then now()
         else vitec_fetch_list.queued_at end,
       correlation_id = case
         when excluded.reason = 'webhook' then excluded.correlation_id
         else vitec_fetch_list.correlation_id end`,
    [
      entries.map((entry) => entry.officeId),
      entries.map((entry) => entry.datatype),
      entries.map((entry) => entry.remoteId),
      entries.map((entry) => entry.reason),
      entries.map((entry) => entry.correlationId),
    ],
  );
}

/**
 * Take up to `limit` due records off the list, webhooks first, oldest first. Taking is deleting:
 * a record signalled again while its fetch runs gets its own later fetch.
 */
export async function claim(limit: number): Promise<Entry[]> {
  const { rows } = await (
    await db()
  ).query<Row>(
    `delete from vitec_fetch_list
     where (office_id, datatype, remote_id) in (
       select office_id, datatype, remote_id from vitec_fetch_list
       where next_at is not null and next_at <= now()
       order by (reason = 'webhook') desc, queued_at
       limit $1
       for update skip locked)
     returning *`,
    [limit],
  );
  return rows.map(toEntry);
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
      entry.officeId,
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

export async function remember(
  officeId: string,
  datatype: Datatype,
  remoteId: string,
): Promise<void> {
  await (
    await db()
  ).query(
    `insert into vitec_known (office_id, datatype, remote_id) values ($1, $2, $3)
     on conflict do nothing`,
    [officeId, datatype, remoteId],
  );
}

export async function forget(
  officeId: string,
  datatype: Datatype,
  remoteId: string,
): Promise<void> {
  await (
    await db()
  ).query('delete from vitec_known where office_id = $1 and datatype = $2 and remote_id = $3', [
    officeId,
    datatype,
    remoteId,
  ]);
}

export async function known(officeId: string, datatype: Datatype): Promise<string[]> {
  const { rows } = await (
    await db()
  ).query<{ remote_id: string }>(
    'select remote_id from vitec_known where office_id = $1 and datatype = $2',
    [officeId, datatype],
  );
  return rows.map((row) => row.remote_id);
}

export async function isKnown(
  officeId: string,
  datatype: Datatype,
  remoteId: string,
): Promise<boolean> {
  const { rowCount } = await (
    await db()
  ).query('select 1 from vitec_known where office_id = $1 and datatype = $2 and remote_id = $3', [
    officeId,
    datatype,
    remoteId,
  ]);
  return (rowCount ?? 0) > 0;
}

/** How long the oldest webhook still waiting has waited, in milliseconds, or null when none waits. */
export async function oldestWebhookWaitMs(): Promise<number | null> {
  const { rows } = await (
    await db()
  ).query<{ wait_ms: string | null }>(
    `select extract(epoch from (now() - min(queued_at))) * 1000 as wait_ms
     from vitec_fetch_list where reason = 'webhook' and next_at is not null`,
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
  await (await db()).query('truncate vitec_fetch_list, vitec_known, vitec_state');
}
