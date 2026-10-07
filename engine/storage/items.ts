import { db, takeWriteLock, transaction } from './db.js';
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
 * A scope of items: everything, tenants, offices, datatypes, one record, a connection, or a list
 * of records (Patric, 2026-10-06: the same scope on Records, Flow and Manual sync). The
 * recompute, the search and the panel's runs share it.
 */
export type ScopeFilter = {
  tenantIds?: number[];
  officeIds?: string[];
  datatypes?: Datatype[];
  /** One tenant, office or datatype, as the engine names one record's own. */
  tenantId?: number;
  connectionId?: string;
  officeId?: string;
  datatype?: Datatype;
  remoteId?: string;
  /** Named records, whatever else the scope says. */
  keys?: ItemKey[];
};

type Where = { clauses: string[]; values: unknown[] };

/** One or several of a thing, as the clause `= any(...)` takes them; empty means every one. */
const listed = <T>(many: T[] | undefined, one: T | undefined): T[] =>
  many && many.length > 0 ? many : one === undefined || one === '' ? [] : [one];

/**
 * The where clause of a scope. Live records unless `deleted` says otherwise (`null`: live and
 * removed alike, which only the records search asks for).
 */
function scopeWhere(scope: ScopeFilter, deleted: boolean | null = false): Where {
  const where: Where = { clauses: ['true'], values: [] };
  const add = (clause: string, value: unknown): void => {
    where.values.push(value);
    where.clauses.push(clause.replace('?', `$${where.values.length}`));
  };
  if (deleted !== null) add('deleted = ?', deleted);
  const tenantIds = listed(scope.tenantIds, scope.tenantId);
  if (tenantIds.length > 0) add('tenant_id = any(?::int[])', tenantIds);
  if (scope.connectionId) add('connection_id = ?', scope.connectionId);
  const officeIds = listed(scope.officeIds, scope.officeId);
  if (officeIds.length > 0) add('office_id = any(?::text[])', officeIds);
  const datatypes = listed(scope.datatypes, scope.datatype);
  if (datatypes.length > 0) add('datatype = any(?::text[])', datatypes);
  if (scope.remoteId) add('remote_id = ?', scope.remoteId);
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

/** The key a page uses for a record. */
export const itemKey = (row: {
  connectionId: string;
  datatype: string;
  remoteId: string;
}): string => `${row.connectionId}|${row.datatype}|${row.remoteId}`;

/** Every stored item for a scope, for replay and recompute. */
export async function itemsForScope(scope: ScopeFilter): Promise<ItemRow[]> {
  const where = scopeWhere(scope);
  const { rows } = await db().query<ItemRow>(
    `select * from items where ${where.clauses.join(' and ')} order by seq`,
    where.values,
  );
  return rows;
}

/**
 * One page of a scope by seq, so a recompute of everything never holds everything in memory:
 * either the records not sold or the sold ones, because a recompute runs the unsold first and the
 * sold last, whatever the CRM (Patric, 2026-09-20, question 74). "Sold" is the universal
 * `sold_at` (the contract date) being set; a datatype without it is never sold.
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

/** How many records Core holds in a scope: live ones, or with `deleted` null live and removed alike. */
export async function countItems(
  scope: ScopeFilter,
  deleted: boolean | null = false,
): Promise<number> {
  const where = scopeWhere(scope, deleted);
  const { rows } = await db().query<{ n: string }>(
    `select count(*) as n from items where ${where.clauses.join(' and ')}`,
    where.values,
  );
  return Number(rows[0]?.n ?? 0);
}

/** How many records one page of a renumbering moves, each page its own short transaction. */
const RENUMBER_PAGE = 1000;

/**
 * Give the live records of a scope new places in the order of changes, so every site of their
 * tenants pulls them again at its next pull: Manual sync's "send to the sites" (Patric,
 * 2026-10-06). Nothing about a record changes but its place. A removal needs no second sending:
 * a site that missed one gets it at its next pull, or rebuilds once it is purged. Page by page,
 * each under the write lock, so a site's pull never steps past a place still being given out; a
 * record moved once is above the ceiling read at the start and is not moved twice.
 */
export async function renumber(
  scope: ScopeFilter,
): Promise<{ records: number; tenantIds: number[] }> {
  const where = scopeWhere(scope);
  const { rows: top } = await db().query<{ seq: string | null }>(
    'select max(seq) as seq from items',
  );
  const ceiling = top[0]?.seq ?? '0';
  const tenantIds = new Set<number>();
  let records = 0;
  for (;;) {
    const moved = await transaction(async (client) => {
      await takeWriteLock(client);
      const { rows } = await client.query<{ tenant_id: number }>(
        `update items set seq = nextval('item_seq')
         where (tenant_id, connection_id, datatype, remote_id) in (
           select tenant_id, connection_id, datatype, remote_id from items
           where ${where.clauses.join(' and ')} and seq <= $${where.values.length + 1}
           order by seq limit ${RENUMBER_PAGE})
         returning tenant_id`,
        [...where.values, ceiling],
      );
      return rows;
    });
    for (const row of moved) tenantIds.add(row.tenant_id);
    records += moved.length;
    if (moved.length < RENUMBER_PAGE) return { records, tenantIds: [...tenantIds] };
  }
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

/**
 * Make every site of a tenant that has fetched anything fetch everything again at its next fetch,
 * and drop what it no longer receives (strategy §7): the purge watermark goes past every place
 * given out so far. For records that went without a tombstone, such as a removed connection's.
 */
export async function resyncTenant(tenantId: number): Promise<void> {
  await db().query(
    `update tenants set purge_watermark = greatest(purge_watermark, nextval('item_seq'))
     where id = $1`,
    [tenantId],
  );
}

// ---- What the admin panel looks at (docs/admin-panel.md) ----------------------------------------

/** Records come in pages of this many: Core holds thousands, more than one page can show. */
export const RECORDS_PAGE = 500;

export type ItemSearch = ScopeFilter & {
  /** From 1. */
  page?: number;
};

/**
 * Items in a scope, live and removed, the one changed last first: one page, with the count of
 * everything that matches. Records offers no other order (Patric, 2026-10-07).
 */
export async function searchItems(query: ItemSearch): Promise<{ rows: ItemRow[]; total: number }> {
  const where = scopeWhere(query, null);
  const offset = (Math.max(query.page ?? 1, 1) - 1) * RECORDS_PAGE;
  const [{ rows }, total] = await Promise.all([
    db().query<ItemRow>(
      `select * from items where ${where.clauses.join(' and ')} order by updated_at desc, seq desc limit ${RECORDS_PAGE} offset ${offset}`,
      where.values,
    ),
    countItems(query, null),
  ]);
  return { rows, total };
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
