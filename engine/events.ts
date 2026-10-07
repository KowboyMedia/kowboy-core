import { db } from './storage/db.js';

export type EventFields = Record<string, unknown>;

export type EventRow = {
  /** In order of writing; the panel tails and pages the log by it. */
  id: string;
  at: Date;
  type: string;
  correlation_id: string | null;
  tenant_id: number | null;
  connection_id: string | null;
  datatype: string | null;
  remote_id: string | null;
  subscriber_id: string | null;
  fields: EventFields;
};

export type EventInput = {
  type: string;
  correlationId?: string | null;
  tenantId?: number | null;
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

/**
 * The row as it will be written. The database gives it its id and its time: the time it is
 * written, on one clock, so a reader that reads up to a few seconds ago never passes over a row
 * that waited for its connection.
 */
const toRow = (event: EventInput): Omit<EventRow, 'id' | 'at'> => ({
  type: event.type,
  correlation_id: event.correlationId ?? null,
  tenant_id: event.tenantId ?? null,
  connection_id: event.connectionId ?? null,
  datatype: event.datatype ?? null,
  remote_id: event.remoteId ?? null,
  subscriber_id:
    event.subscriberId === undefined || event.subscriberId === null
      ? null
      : String(event.subscriberId),
  fields: redact(event.fields ?? {}),
});

/** Write one row to the event log. Never throws into the caller's path. */
export async function logEvent(event: EventInput): Promise<void> {
  const row = toRow(event);
  try {
    await db().query(
      `insert into events (type, correlation_id, tenant_id, connection_id, datatype, remote_id, subscriber_id, fields)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        row.type,
        row.correlation_id,
        row.tenant_id,
        row.connection_id,
        row.datatype,
        row.remote_id,
        row.subscriber_id,
        JSON.stringify(row.fields),
      ],
    );
  } catch (error) {
    console.error('event log write failed', error);
  }
}

export type EventQuery = {
  entity?: { connectionId: string; datatype: string; remoteId: string };
  connectionId?: string;
  tenantId?: number;
  subscriberId?: number;
  correlationId?: string;
  type?: string;
  limit?: number;
  /** A record's page reads the latest first. */
  newestFirst?: boolean;
  /** The live tail: only events newer than this one. */
  afterId?: number;
};

/** The admin timeline query (SRS §11, AC 16). */
export async function queryEvents(query: EventQuery): Promise<EventRow[]> {
  const filters: [string, unknown][] = [
    ['connection_id = ?', query.entity?.connectionId],
    ['datatype = ?', query.entity?.datatype],
    ['remote_id = ?', query.entity?.remoteId],
    ['connection_id = ?', query.connectionId],
    ['tenant_id = ?', query.tenantId],
    ['subscriber_id = ?', query.subscriberId],
    ['correlation_id = ?', query.correlationId],
    ['type = ?', query.type],
    ['id > ?', query.afterId],
  ];
  const where: string[] = [];
  const values: unknown[] = [];
  for (const [clause, value] of filters) {
    if (value === undefined || value === null || value === '' || value === 0) continue;
    values.push(value);
    where.push(clause.replace('?', `$${values.length}`));
  }
  const limit = Math.min(query.limit ?? 500, 5000);
  const order = query.newestFirst ? 'id desc' : 'id';
  const sql = `select * from events ${where.length ? `where ${where.join(' and ')}` : ''} order by ${order} limit ${limit}`;
  return (await db().query<EventRow>(sql, values)).rows;
}

/** The newest event's number, where a live tail starts. */
export async function latestEventId(): Promise<number> {
  const { rows } = await db().query<{ id: string | null }>('select max(id) as id from events');
  return Number(rows[0]?.id ?? 0);
}

/** Delete events outside the retention window (strategy §8.2). */
export async function deleteExpiredEvents(retentionDays: number): Promise<number> {
  const { rowCount } = await db().query(
    "delete from events where at < now() - ($1 || ' days')::interval",
    [retentionDays],
  );
  return rowCount ?? 0;
}
