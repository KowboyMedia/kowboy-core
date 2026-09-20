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

/**
 * A scope of live items: everything, a CRM (every connection of a provider), a tenant, a
 * connection, an office, a datatype, one record, or a list of records. The recompute and the
 * panel's actions share it.
 */
export type ScopeFilter = {
  provider?: string;
  tenantId?: number;
  connectionId?: string;
  officeId?: string;
  datatype?: Datatype;
  remoteId?: string;
  /** Named records, whatever else the scope says. */
  keys?: ItemKey[];
  rulesVersionBefore?: string;
};

type Where = { clauses: string[]; values: unknown[] };

function scopeWhere(scope: ScopeFilter): Where {
  const where: Where = { clauses: ['deleted = false'], values: [] };
  const add = (clause: string, value: unknown): void => {
    where.values.push(value);
    where.clauses.push(clause.replace('?', `$${where.values.length}`));
  };
  if (scope.provider)
    add('connection_id in (select id from connections where provider = ?)', scope.provider);
  if (scope.tenantId) add('tenant_id = ?', scope.tenantId);
  if (scope.connectionId) add('connection_id = ?', scope.connectionId);
  if (scope.officeId) add('office_id = ?', scope.officeId);
  if (scope.datatype) add('datatype = ?', scope.datatype);
  if (scope.remoteId) add('remote_id = ?', scope.remoteId);
  if (scope.rulesVersionBefore) add('rules_version <> ?', scope.rulesVersionBefore);
  if (scope.keys) {
    const n = where.values.length;
    where.values.push(
      scope.keys.map((key) => key.connectionId),
      scope.keys.map((key) => key.datatype),
      scope.keys.map((key) => key.remoteId),
    );
    where.clauses.push(
      `(connection_id, datatype, remote_id) in (select * from unnest($${n + 1}::text[], $${n + 2}::text[], $${n + 3}::text[]))`,
    );
  }
  return where;
}

/** Every stored item for a scope, for replay and recompute. */
export async function itemsForScope(scope: ScopeFilter): Promise<ItemRow[]> {
  const where = scopeWhere(scope);
  const { rows } = await db().query<ItemRow>(
    `select * from items where ${where.clauses.join(' and ')} order by seq`,
    where.values,
  );
  return rows;
}

/** A scope in pages by seq, so a recompute of everything never holds everything in memory. */
/**
 * One page of a scope by seq, either the records not sold or the sold ones: a recompute runs the
 * unsold first and the sold last, whatever the CRM (Patric, 2026-09-20, question 74). "Sold" is
 * the universal `sold_at` (the contract date) being set; a datatype without it is never sold.
 */
export async function scopeBatch(
  scope: ScopeFilter,
  sold: boolean,
  afterSeq: number,
  limit: number,
): Promise<ItemRow[]> {
  const where = scopeWhere(scope);
  where.clauses.push(`(data->>'sold_at') is ${sold ? 'not null' : 'null'}`);
  where.values.push(afterSeq, limit);
  const { rows } = await db().query<ItemRow>(
    `select * from items where ${where.clauses.join(' and ')} and seq > $${where.values.length - 1}
     order by seq limit $${where.values.length}`,
    where.values,
  );
  return rows;
}

export async function countItems(scope: ScopeFilter): Promise<number> {
  const where = scopeWhere(scope);
  const { rows } = await db().query<{ n: string }>(
    `select count(*) as n from items where ${where.clauses.join(' and ')}`,
    where.values,
  );
  return Number(rows[0]?.n ?? 0);
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

/** The columns a search can sort by. */
export const SORTABLE = [
  'seq',
  'updated_at',
  'remote_updated_at',
  'tenant_id',
  'connection_id',
  'datatype',
  'remote_id',
  'office_id',
  'deleted',
] as const;

export type ItemSearch = {
  tenantId?: number;
  provider?: string;
  connectionId?: string;
  datatype?: Datatype;
  officeId?: string;
  remoteId?: string;
  /** Words looked for in the unified record's strings, each as a prefix. */
  text?: string;
  /** Written in Core at or after this moment, and before this one (ISO strings). */
  writtenFrom?: string;
  writtenTo?: string;
  deleted?: boolean;
  sort?: (typeof SORTABLE)[number];
  dir?: 'asc' | 'desc';
  /** From 1. */
  page?: number;
  size?: number;
};

/** The words of a free-text search as a prefix query, or null when there are none. */
export const textQuery = (text: string): string | null => {
  const words = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  return words.length === 0 ? null : words.map((word) => `${word}:*`).join(' & ');
};

/** Items by any mix of filters, one page, with the count of everything that matches. */
export async function searchItems(query: ItemSearch): Promise<{ rows: ItemRow[]; total: number }> {
  const text = query.text ? textQuery(query.text) : null;
  const filters: [string, unknown][] = [
    ['tenant_id = ?', query.tenantId],
    ['connection_id in (select id from connections where provider = ?)', query.provider],
    ['connection_id = ?', query.connectionId],
    ['datatype = ?', query.datatype],
    ['office_id = ?', query.officeId],
    ['remote_id = ?', query.remoteId],
    ['updated_at >= ?', query.writtenFrom],
    ['updated_at < ?', query.writtenTo],
    ['deleted = ?', query.deleted],
    [
      `jsonb_to_tsvector('simple', coalesce(data, '{}'::jsonb), '["string"]') @@ to_tsquery('simple', ?)`,
      text,
    ],
  ];
  const where: string[] = ['true'];
  const values: unknown[] = [];
  for (const [clause, value] of filters) {
    if (value === undefined || value === null || value === '') continue;
    values.push(value);
    where.push(clause.replace('?', `$${values.length}`));
  }
  const sort = SORTABLE.find((column) => column === query.sort) ?? 'seq';
  const dir = query.dir === 'asc' ? 'asc' : 'desc';
  const size = Math.min(Math.max(query.size ?? 50, 1), 500);
  const offset = (Math.max(query.page ?? 1, 1) - 1) * size;
  const condition = where.join(' and ');
  const [{ rows }, count] = await Promise.all([
    db().query<ItemRow>(
      `select * from items where ${condition} order by ${sort} ${dir} nulls last, seq desc limit ${size} offset ${offset}`,
      values,
    ),
    db().query<{ n: string }>(`select count(*) as n from items where ${condition}`, values),
  ]);
  return { rows, total: Number(count.rows[0]?.n ?? 0) };
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
