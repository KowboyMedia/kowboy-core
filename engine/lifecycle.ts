import { db } from './storage/db.js';
import { lifecycleHandlersFor } from './registry.js';
import { logEvent } from './events.js';
import { report } from './errors.js';
import { connectionById } from './storage/connections.js';
import { itemsForScope } from './storage/items.js';
import { notFound } from './ingest.js';
import type { AdminRecord, Datatype, LifecycleEvent } from './adapter-api/types.js';

type Options = { officeIds?: string[]; datatype?: Datatype; records?: AdminRecord[] };

type QueuedRow = {
  id: string;
  connection_id: string;
  event: LifecycleEvent['type'];
  office_ids: string[] | null;
  datatype: Datatype | null;
  records: AdminRecord[] | null;
};

/**
 * Queue an event for the worker. The web process takes the admin call and the adapters run in
 * the worker, so events travel through this table (strategy §5.1). Null: no such connection.
 */
export async function queueLifecycle(
  connectionId: string,
  event: LifecycleEvent['type'],
  options: Options = {},
): Promise<number | null> {
  if (!(await connectionById(connectionId))) return null;
  const { rows } = await db().query<{ id: string }>(
    `insert into lifecycle_events (connection_id, event, office_ids, datatype, records)
     values ($1, $2, $3, $4, $5) returning id`,
    [
      connectionId,
      event,
      options.officeIds ?? null,
      options.datatype ?? null,
      options.records ? JSON.stringify(options.records) : null,
    ],
  );
  return Number(rows[0]?.id);
}

/**
 * Deliver every queued event, oldest first. The worker's tick calls this every few seconds; the
 * tests call it directly. An event taken but not finished within ten minutes is taken again.
 */
export async function deliverLifecycleEvents(): Promise<number> {
  let delivered = 0;
  for (;;) {
    const { rows } = await db().query<QueuedRow>(
      `update lifecycle_events set taken_at = now()
       where id = (
         select id from lifecycle_events
         where done_at is null and (taken_at is null or taken_at < now() - interval '10 minutes')
         order by id limit 1 for update skip locked)
       returning id, connection_id, event, office_ids, datatype, records`,
    );
    const row = rows[0];
    if (!row) return delivered;
    let error: string | null = null;
    try {
      await sendLifecycle(row.connection_id, row.event, {
        officeIds: row.office_ids ?? undefined,
        datatype: row.datatype ?? undefined,
        records: row.records ?? undefined,
      });
    } catch (caught) {
      error = String(caught);
      report(caught, { where: 'lifecycle', event: row.event, connectionId: row.connection_id });
    }
    await db().query('update lifecycle_events set done_at = now(), error = $2 where id = $1', [
      row.id,
      error,
    ]);
    delivered += 1;
  }
}

/** Events queued longer than `limitMs` ago and still not delivered: no worker is taking them. */
export async function undeliveredLifecycleEvents(limitMs: number): Promise<number> {
  const { rows } = await db().query<{ n: string }>(
    `select count(*) as n from lifecycle_events
     where done_at is null and created_at < now() - ($1 || ' milliseconds')::interval`,
    [String(limitMs)],
  );
  return Number(rows[0]?.n ?? 0);
}

/**
 * Administrative events are the only thing the engine tells an adapter (SRS §4.8). Everything else
 * an adapter does, it starts itself.
 */
async function sendLifecycle(
  connectionId: string,
  event: LifecycleEvent['type'],
  options: Options = {},
): Promise<void> {
  const connection = await connectionById(connectionId);
  if (!connection) throw new Error(`no connection ${connectionId}`);

  await logEvent({
    type: `lifecycle.${event}`,
    tenantId: connection.tenantId,
    connectionId,
    fields: {
      office_ids: options.officeIds ?? null,
      datatype: options.datatype ?? null,
      records: options.records?.length ?? null,
    },
  });

  // Removals are the engine's own work: tombstone what the tenant may no longer receive (§7).
  if (event === 'connection_removed') await tombstoneScope(connectionId);
  if (event === 'offices_removed') await tombstoneScope(connectionId, options.officeIds ?? []);

  const payload = buildEvent(event, connection, options);
  for (const handler of lifecycleHandlersFor(connection.provider)) {
    try {
      await handler(payload);
    } catch (error) {
      report(error, { where: 'lifecycle', connectionId, event });
    }
  }
}

function buildEvent(
  event: LifecycleEvent['type'],
  connection: Awaited<ReturnType<typeof connectionById>> & object,
  options: Options,
): LifecycleEvent {
  switch (event) {
    case 'offices_added':
      return { type: 'offices_added', connection, officeIds: options.officeIds ?? [] };
    case 'offices_removed':
      return { type: 'offices_removed', connection, officeIds: options.officeIds ?? [] };
    case 'resync':
      return options.datatype
        ? { type: 'resync', connection, datatype: options.datatype }
        : { type: 'resync', connection };
    case 'connection_removed':
      return { type: 'connection_removed', connection };
    case 'refetch':
      return { type: 'refetch', connection, records: options.records ?? [] };
    default:
      return { type: 'connection_added', connection };
  }
}

async function tombstoneScope(connectionId: string, officeIds?: string[]): Promise<void> {
  const connection = await connectionById(connectionId);
  if (!connection) return;
  const items = await itemsForScope({ connectionId });
  for (const item of items) {
    if (officeIds && !(item.office_id && officeIds.includes(item.office_id))) continue;
    await notFound(connection, item.datatype, item.remote_id);
  }
}
