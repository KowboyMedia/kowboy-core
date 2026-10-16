// "Reload all data" for one tenant (design B, rows 105 and 106): each of its connections fetches
// everything from its CRM again, which removes what the CRM no longer lists, and then every site of
// the tenant rebuilds its copy. The panel asks for the fetches (engine/panel/reload.ts); this is the
// worker's half: once the last of them is done, the sites are told to rebuild, once.
import { db } from './storage/db.js';
import { resyncTenant } from './storage/items.js';
import { ring } from './bells.js';

/**
 * Called for each lifecycle event the worker has delivered. When it was the last open fetch of a
 * reload, the tenant's purge watermark goes past everything it holds, so a site rebuilds from the
 * start, and its sites are told to do it now. A fetch that failed is kept as the reload's error;
 * the sites rebuild all the same, from what Core holds.
 */
export async function rebuildAfterFetch(eventId: number): Promise<void> {
  const { rows } = await db().query<{ tenant_id: number }>(
    `update reloads r set rebuilt_at = now(),
       error = (select string_agg(e.error, '; ') from lifecycle_events e
                where e.id = any(r.events) and e.error is not null)
     where r.rebuilt_at is null and $1 = any(r.events)
       and not exists (
         select 1 from lifecycle_events e where e.id = any(r.events) and e.done_at is null)
     returning r.tenant_id`,
    [eventId],
  );
  for (const row of rows) await rebuildSites(Number(row.tenant_id));
}

/** Tell every site of a tenant to fetch everything again from the start. */
export async function rebuildSites(tenantId: number): Promise<void> {
  await resyncTenant(tenantId);
  await ring(tenantId, 'forcerefresh');
}
