import { db } from './db.js';
import type { PoolClient } from 'pg';
import type { Canonical, Datatype } from '../adapter-api/types.js';

export type ItemRow = {
  tenant_id: number;
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
  tenantId: number;
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
  tenantId: number;
  datatype: Datatype;
  after: number;
  limit: number;
};

/** The subscriber read (SRS §8): everything for this tenant and datatype after `seq`. */
export async function changesPage(query: ChangesQuery): Promise<ItemRow[]> {
  const { rows } = await db().query<ItemRow>(
    `select * from items
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

/** Every stored item for a scope, for replay and recompute. */
export async function itemsForScope(scope: {
  tenantId?: number;
  connectionId?: string;
  datatype?: Datatype;
  remoteId?: string;
  rulesVersionBefore?: string;
}): Promise<ItemRow[]> {
  const where: string[] = ['deleted = false'];
  const values: unknown[] = [];
  const add = (clause: string, value: unknown) => {
    values.push(value);
    where.push(clause.replace('?', `$${values.length}`));
  };
  if (scope.tenantId) add('tenant_id = ?', scope.tenantId);
  if (scope.connectionId) add('connection_id = ?', scope.connectionId);
  if (scope.datatype) add('datatype = ?', scope.datatype);
  if (scope.remoteId) add('remote_id = ?', scope.remoteId);
  if (scope.rulesVersionBefore) add('rules_version <> ?', scope.rulesVersionBefore);
  const { rows } = await db().query<ItemRow>(
    `select * from items where ${where.join(' and ')} order by seq`,
    values,
  );
  return rows;
}

/**
 * Hard-delete tombstones older than the retention window and raise each tenant's purge watermark
 * to the highest seq removed (strategy §7). A subscriber whose cursor is below the watermark may
 * have missed a delete and is told to resync.
 */
export async function purgeTombstones(days: number): Promise<number> {
  const { rows } = await db().query<{ tenant_id: number; seq: string }>(
    `delete from items where deleted = true and tombstoned_at < now() - ($1 || ' days')::interval
     returning tenant_id, seq`,
    [days],
  );
  const highest = new Map<number, number>();
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

// ---- What the admin panel looks at (docs/admin-panel.md) ----------------------------------------

/** Items by remote id, or the first ones of an office or a connection, tombstones included. */
export async function findItems(query: {
  datatype?: Datatype;
  remoteId?: string;
  officeId?: string;
  connectionId?: string;
  limit?: number;
}): Promise<ItemRow[]> {
  const where: string[] = ['true'];
  const values: unknown[] = [];
  const add = (clause: string, value: unknown) => {
    values.push(value);
    where.push(clause.replace('?', `$${values.length}`));
  };
  if (query.datatype) add('datatype = ?', query.datatype);
  if (query.remoteId) add('remote_id = ?', query.remoteId);
  if (query.officeId) add('office_id = ?', query.officeId);
  if (query.connectionId) add('connection_id = ?', query.connectionId);
  values.push(Math.min(query.limit ?? 50, 500));
  const { rows } = await db().query<ItemRow>(
    `select * from items where ${where.join(' and ')} order by seq desc limit $${values.length}`,
    values,
  );
  return rows;
}

export type ItemCount = { tenant_id: number; datatype: string; live: string; tombstoned: string };

/** Live and tombstoned items per tenant and datatype. */
export async function itemCounts(): Promise<ItemCount[]> {
  const { rows } = await db().query<ItemCount>(
    `select tenant_id, datatype,
            count(*) filter (where not deleted) as live,
            count(*) filter (where deleted) as tombstoned
     from items group by tenant_id, datatype order by tenant_id, datatype`,
  );
  return rows;
}
