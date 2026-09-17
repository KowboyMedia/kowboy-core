import { db } from './db.js';
import type { PoolClient } from 'pg';
import type { Canonical, Datatype } from '../adapter-api/types.js';

export type ItemRow = {
  tenant_id: string;
  connection_id: string;
  datatype: Datatype;
  remote_id: string;
  office_id: string | null;
  seq: string;
  deleted: boolean;
  schema_version: string;
  content_hash: string;
  raw: unknown;
  data: Canonical | null;
  remote_updated_at: Date | null;
  rules_version: string;
  updated_at: Date;
  tombstoned_at: Date | null;
};

export type ItemKey = {
  tenantId: string;
  connectionId: string;
  datatype: Datatype;
  remoteId: string;
};

export async function readItem(key: ItemKey, client?: PoolClient): Promise<ItemRow | null> {
  const { rows } = await (client ?? db()).query<ItemRow>(
    `select * from items
     where tenant_id = $1 and connection_id = $2 and datatype = $3 and remote_id = $4`,
    [key.tenantId, key.connectionId, key.datatype, key.remoteId],
  );
  return rows[0] ?? null;
}

export type WriteItem = ItemKey & {
  officeId: string | null;
  contentHash: string;
  raw: unknown;
  data: Canonical | null;
  remoteUpdatedAt: string | null;
  rulesVersion: string;
  schemaVersion: string;
  deleted: boolean;
};

/** Insert or update one item with a fresh `seq`. Caller holds the write lock. */
export async function writeItem(client: PoolClient, item: WriteItem): Promise<number> {
  const { rows } = await client.query<{ seq: string }>(
    `insert into items (tenant_id, connection_id, datatype, remote_id, office_id, seq, deleted,
                        schema_version, content_hash, raw, data, remote_updated_at, rules_version,
                        updated_at, tombstoned_at)
     values ($1,$2,$3,$4,$5, nextval('item_seq'), $6,$7,$8,$9,$10,$11,$12, now(), $13)
     on conflict (tenant_id, connection_id, datatype, remote_id) do update set
       office_id = excluded.office_id,
       seq = nextval('item_seq'),
       deleted = excluded.deleted,
       schema_version = excluded.schema_version,
       content_hash = excluded.content_hash,
       raw = coalesce(excluded.raw, items.raw),
       data = excluded.data,
       remote_updated_at = excluded.remote_updated_at,
       rules_version = excluded.rules_version,
       updated_at = now(),
       tombstoned_at = excluded.tombstoned_at
     returning seq`,
    [
      item.tenantId,
      item.connectionId,
      item.datatype,
      item.remoteId,
      item.officeId,
      item.deleted,
      item.schemaVersion,
      item.contentHash,
      item.raw === undefined ? null : JSON.stringify(item.raw),
      item.data === null ? null : JSON.stringify(item.data),
      item.remoteUpdatedAt,
      item.rulesVersion,
      item.deleted ? new Date() : null,
    ],
  );
  return Number(rows[0]?.seq);
}

export type ChangesQuery = {
  tenantId: string;
  datatype: Datatype;
  after: number;
  limit: number;
};

/** What `/v1/changes` serves: every column but `raw`, which no subscriber ever sees. */
export type ServedItem = Pick<
  ItemRow,
  | 'datatype'
  | 'connection_id'
  | 'remote_id'
  | 'office_id'
  | 'seq'
  | 'deleted'
  | 'schema_version'
  | 'content_hash'
  | 'remote_updated_at'
  | 'data'
>;

/** The subscriber read (SRS §8): everything for this tenant and datatype after `seq`. */
export async function changesPage(query: ChangesQuery): Promise<ServedItem[]> {
  const { rows } = await db().query<ServedItem>(
    `select datatype, connection_id, remote_id, office_id, seq, deleted, schema_version,
            content_hash, remote_updated_at, data
     from items
     where tenant_id = $1 and datatype = $2 and seq > $3
     order by seq
     limit $4`,
    [query.tenantId, query.datatype, query.after, query.limit],
  );
  return rows;
}

/** Live (not tombstoned) remote ids in a scope, for presentIds comparison. */
export async function liveRemoteIds(
  connectionId: string,
  datatype: Datatype,
  officeId: string | null,
): Promise<string[]> {
  const { rows } = await db().query<{ remote_id: string }>(
    `select remote_id from items
     where connection_id = $1 and datatype = $2 and deleted = false
       and ($3::text is null or office_id = $3)`,
    [connectionId, datatype, officeId],
  );
  return rows.map((row) => row.remote_id);
}

const SCOPE_PAGE = 200;

/**
 * Every live item in a scope, for replay, recompute and tombstoning, read in pages of 200 by
 * `seq` so a scope of 300,000 items never sits in memory at once (strategy §7.3). Only rows up
 * to the highest `seq` at the start are read: a row rewritten meanwhile gets a higher one and is
 * not read twice.
 */
export async function* itemsForScope(scope: {
  tenantId?: string;
  connectionId?: string;
  datatype?: Datatype;
  rulesVersionBefore?: string;
}): AsyncGenerator<ItemRow> {
  const where: string[] = ['deleted = false'];
  const values: unknown[] = [];
  const add = (clause: string, value: unknown) => {
    values.push(value);
    where.push(clause.replace('?', `$${values.length}`));
  };
  if (scope.tenantId) add('tenant_id = ?', scope.tenantId);
  if (scope.connectionId) add('connection_id = ?', scope.connectionId);
  if (scope.datatype) add('datatype = ?', scope.datatype);
  if (scope.rulesVersionBefore) add('rules_version <> ?', scope.rulesVersionBefore);

  const top = await db().query<{ seq: string | null }>('select max(seq) as seq from items');
  add('seq <= ?', Number(top.rows[0]?.seq ?? 0));
  const cursor = values.length + 1;
  const sql = `select * from items where ${where.join(' and ')} and seq > $${cursor}
               order by seq limit ${SCOPE_PAGE}`;
  for (let after = 0; ;) {
    const { rows } = await db().query<ItemRow>(sql, [...values, after]);
    for (const row of rows) yield row;
    const last = rows[rows.length - 1];
    if (!last || rows.length < SCOPE_PAGE) return;
    after = Number(last.seq);
  }
}

/**
 * Hard-delete tombstones older than the retention window and raise each tenant's purge watermark
 * to the highest seq removed (strategy §7). A subscriber whose cursor is below the watermark may
 * have missed a delete and is told to resync.
 */
export async function purgeTombstones(days: number): Promise<number> {
  const { rows } = await db().query<{ tenant_id: string; seq: string }>(
    `delete from items where deleted = true and tombstoned_at < now() - ($1 || ' days')::interval
     returning tenant_id, seq`,
    [days],
  );
  const highest = new Map<string, number>();
  for (const row of rows) {
    highest.set(row.tenant_id, Math.max(highest.get(row.tenant_id) ?? 0, Number(row.seq)));
  }
  for (const [tenantId, seq] of highest) {
    await db().query(
      'update tenants set purge_watermark = greatest(purge_watermark, $2) where id = $1',
      [tenantId, seq],
    );
  }
  return rows.length;
}
