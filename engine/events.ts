import { db } from './storage/db.js';
import type { PoolClient } from 'pg';

export type EventFields = Record<string, unknown>;

export type EventRow = {
  at: Date;
  type: string;
  correlation_id: string | null;
  tenant_id: string | null;
  connection_id: string | null;
  datatype: string | null;
  remote_id: string | null;
  subscriber_id: string | null;
  fields: EventFields;
};

export type EventInput = {
  type: string;
  correlationId?: string | null;
  tenantId?: string | null;
  connectionId?: string | null;
  datatype?: string | null;
  remoteId?: string | null;
  subscriberId?: number | null;
  fields?: EventFields;
};

const SECRET_KEYS = /(secret|token|password|credential|authorization|dsn|key)/i;

/** Redaction is not optional: AC 16 and AC 25 require secrets never to reach the log. */
export function redact(fields: EventFields): EventFields {
  const out: EventFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SECRET_KEYS.test(key)) out[key] = '[redacted]';
    else if (value && typeof value === 'object' && !Array.isArray(value))
      out[key] = redact(value as EventFields);
    else out[key] = value;
  }
  return out;
}

const partitions = new Set<string>();

/** Daily partitions are created on first use (strategy §8.2). */
async function ensurePartition(client: Pick<PoolClient, 'query'>, at: Date): Promise<void> {
  const day = at.toISOString().slice(0, 10);
  if (partitions.has(day)) return;
  const next = new Date(at.getTime() + 86_400_000).toISOString().slice(0, 10);
  await client.query(
    `create table if not exists events_${day.replace(/-/g, '_')}
     partition of events for values from ('${day}') to ('${next}')`,
  );
  partitions.add(day);
}

/** Write one row to the event log. Never throws into the caller's path. */
export async function logEvent(event: EventInput, client?: PoolClient): Promise<void> {
  const executor = client ?? db();
  const at = new Date();
  try {
    await ensurePartition(executor, at);
    await executor.query(
      `insert into events (at, type, correlation_id, tenant_id, connection_id, datatype, remote_id, subscriber_id, fields)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        at,
        event.type,
        event.correlationId ?? null,
        event.tenantId ?? null,
        event.connectionId ?? null,
        event.datatype ?? null,
        event.remoteId ?? null,
        event.subscriberId ?? null,
        JSON.stringify(redact(event.fields ?? {})),
      ],
    );
  } catch (error) {
    console.error('event log write failed', error);
  }
}

export type EventQuery = {
  entity?: { connectionId: string; datatype: string; remoteId: string };
  connectionId?: string;
  tenantId?: string;
  subscriberId?: number;
  correlationId?: string;
  type?: string;
  from?: string;
  to?: string;
  limit?: number;
};

/** The admin timeline query (SRS §11, AC 16). */
export async function queryEvents(query: EventQuery): Promise<EventRow[]> {
  const where: string[] = [];
  const values: unknown[] = [];
  const add = (clause: string, value: unknown) => {
    values.push(value);
    where.push(clause.replace('?', `$${values.length}`));
  };

  if (query.entity) {
    add('connection_id = ?', query.entity.connectionId);
    add('datatype = ?', query.entity.datatype);
    add('remote_id = ?', query.entity.remoteId);
  }
  if (query.connectionId) add('connection_id = ?', query.connectionId);
  if (query.tenantId) add('tenant_id = ?', query.tenantId);
  if (query.subscriberId !== undefined) add('subscriber_id = ?', query.subscriberId);
  if (query.correlationId) add('correlation_id = ?', query.correlationId);
  if (query.type) add('type = ?', query.type);
  if (query.from) add('at >= ?', query.from);
  if (query.to) add('at <= ?', query.to);

  const limit = Math.min(query.limit ?? 500, 5000);
  const sql = `select * from events ${where.length ? `where ${where.join(' and ')}` : ''} order by at, ctid limit ${limit}`;
  return (await db().query<EventRow>(sql, values)).rows;
}

/** Drop partitions outside the retention window (strategy §8.2). */
export async function dropExpiredEventPartitions(retentionDays: number): Promise<string[]> {
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
  const { rows } = await db().query<{ tablename: string }>(
    "select tablename from pg_tables where tablename like 'events\\_%'",
  );
  const dropped: string[] = [];
  for (const { tablename } of rows) {
    const day = tablename.slice('events_'.length).replace(/_/g, '-');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    if (new Date(day) >= cutoff) continue;
    await db().query(`drop table if exists ${tablename}`);
    partitions.delete(day);
    dropped.push(tablename);
  }
  return dropped;
}

/** Test helper: partition cache is per process. */
export function forgetPartitionCache(): void {
  partitions.clear();
}
