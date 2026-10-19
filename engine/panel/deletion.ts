// Deleting a tenant and everything of it (the tenant mockups, images 15 and 16): its websites with
// their history, its CRM connections with their logins, its records, the forms Core holds for it,
// its problems in the Inbox, its reloads and its events. Each website and each connection goes the
// way one is deleted on its own, so nothing about deleting one is done twice or done otherwise;
// then every other row of Core's that holds the tenant or one of its connections goes. Nothing is
// sent to a CRM: deleting reads and writes Core's own database only.
import { db } from '../storage/db.js';
import { tenantById } from '../storage/connections.js';
import { removeWebsite } from './brokerages.js';
import { removeConnection } from './connections.js';

/** The rows that name the tenant or its connections without a key that deletes them with it. */
async function forgetRest(id: number, connections: string[]): Promise<void> {
  // The event log names a tenant and a connection by plain columns, without a foreign key.
  await db().query('delete from events where tenant_id = $1 or connection_id = any($2::text[])', [
    id,
    connections,
  ]);
  await db().query('delete from lifecycle_events where connection_id = any($1::text[])', [
    connections,
  ]);
  // A long run asked for the tenant or one of its connections.
  await db().query(
    `delete from jobs where scope->>'tenantId' = $1 or scope->>'connectionId' = any($2::text[])`,
    [String(id), connections],
  );
  // The Inbox's problems about one of its connections or websites that kept no tenant, and the
  // tenant in a problem about several tenants. The tenant's own go with it below.
  await db().query(
    `delete from panel_problems where key = any(select 'login:' || unnest($1::text[]))`,
    [connections],
  );
  await db().query(
    `update panel_problems
     set facts = jsonb_set(facts, '{tenants}', coalesce(
       (select jsonb_agg(one) from jsonb_array_elements(facts->'tenants') one
        where one <> to_jsonb($1::int)), '[]'::jsonb))
     where jsonb_typeof(facts->'tenants') = 'array' and facts->'tenants' @> to_jsonb(array[$1::int])`,
    [id],
  );
  // The things a health check named of its connections, until the check runs again.
  await db().query(
    `update health_results
     set names = (select coalesce(jsonb_agg(one), '[]'::jsonb) from jsonb_array_elements(names) one
                  where not (jsonb_typeof(one) = 'object' and one->>'connection' = any($1::text[])))
     where jsonb_typeof(names) = 'array' and exists (
       select 1 from jsonb_array_elements(names) one
       where jsonb_typeof(one) = 'object' and one->>'connection' = any($1::text[]))`,
    [connections],
  );
}

/**
 * Delete a tenant and everything of it. Its websites go first, so no change notice reaches a
 * website that is going; then each connection, whose records leave with it; then the rest. The
 * tenant's row goes last, and with it what is kept by its key: the forms Core holds, its problems
 * and its reloads. False when there is no such tenant.
 */
export async function deleteBrokerage(id: number): Promise<boolean> {
  if (!(await tenantById(id))) return false;
  const { rows: sites } = await db().query<{ id: string }>(
    'select id from subscribers where tenant_id = $1 order by id',
    [id],
  );
  for (const site of sites) await removeWebsite(Number(site.id));
  const { rows: owned } = await db().query<{ id: string }>(
    'select id from connections where tenant_id = $1 order by id',
    [id],
  );
  const connections = owned.map((row) => row.id);
  for (const connection of connections) await removeConnection(connection);
  await forgetRest(id, connections);
  await db().query('delete from tenants where id = $1', [id]);
  return true;
}
