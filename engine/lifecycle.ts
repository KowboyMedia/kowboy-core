import { lifecycleHandlersFor } from './registry.js';
import { logEvent } from './events.js';
import { report } from './errors.js';
import { connectionById } from './storage/connections.js';
import { itemsForScope } from './storage/items.js';
import { notFound } from './ingest.js';
import type { Datatype, LifecycleEvent } from './adapter-api/types.js';

/**
 * Administrative events are the only thing the engine tells an adapter (SRS §4.8). Everything else
 * an adapter does, it starts itself.
 */
export async function sendLifecycle(
  connectionId: string,
  event: LifecycleEvent['type'],
  options: { officeIds?: string[]; datatype?: Datatype } = {},
): Promise<void> {
  const connection = await connectionById(connectionId);
  if (!connection) throw new Error(`no connection ${connectionId}`);

  await logEvent({
    type: `lifecycle.${event}`,
    tenantId: connection.tenantId,
    connectionId,
    fields: { office_ids: options.officeIds ?? null, datatype: options.datatype ?? null },
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
  options: { officeIds?: string[]; datatype?: Datatype },
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
