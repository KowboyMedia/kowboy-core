// One-off and read-only (question 189, 2026-10-12): prints one home's stored copy and its change
// history from the event log to the worker's log, where a session reads it over HTTPS. Removed
// again once read.
import pg from 'pg';
import { gzipSync } from 'node:zlib';

const ID = 'OBJ5P4RD332KW42S276BD';

// Never holds the worker up: whatever happens, this process ends within half a minute.
setTimeout(() => process.exit(0), 30_000).unref();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10_000,
  query_timeout: 20_000,
});

try {
  await client.connect();
  await client.query('begin read only');
  const items = (
    await client.query(
      `select tenant_id, connection_id, datatype, remote_id, office_id, seq, deleted, updated_at,
              remote_updated_at, tombstoned_at, raw->'images' as raw_images, data->'images' as images
       from items where remote_id = $1`,
      [ID],
    )
  ).rows;
  const events = (
    await client.query(
      `select id, at, type, connection_id, correlation_id, fields->'seq' as seq,
              fields->'changed'->'images' as images,
              (select array_agg(k order by k) from jsonb_object_keys(
                 case when jsonb_typeof(fields->'changed') = 'object' then fields->'changed'
                      else '{}'::jsonb end) k) as changed_keys,
              case when type in ('entity.written', 'entity.unchanged') then null
                   else fields end as other
       from events
       where connection_id = any($1) and datatype = 'property' and remote_id = $2
       order by id`,
      [[...new Set(items.map((item) => item.connection_id))], ID],
    )
  ).rows;
  const oldest = (await client.query('select min(at) as oldest from events')).rows[0].oldest;
  await client.query('rollback');
  const packed = gzipSync(
    Buffer.from(
      JSON.stringify({
        read_at: new Date().toISOString(),
        retention_days: process.env.EVENT_RETENTION_DAYS ?? null,
        oldest_event_kept: oldest,
        items,
        events,
      }),
    ),
  ).toString('base64');
  console.log(`BEGIN-HISTORY ${ID}`);
  for (let i = 0; i < packed.length; i += 76) console.log(packed.slice(i, i + 76));
  console.log('END-HISTORY');
} catch (error) {
  console.log(`HISTORY-ERROR ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await client.end().catch(() => undefined);
}
