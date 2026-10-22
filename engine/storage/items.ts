import { db, takeWriteLock, transaction } from './db.js';
import type { PoolClient } from 'pg';
import type { Canonical, Datatype } from '../adapter-api/types.js';
import { pagePart, type PartFields } from '../pages.js';

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
  /** Its part of a changes page, ready to send (engine/pages.ts); null until it has one. */
  page_part: Buffer | null;
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
  const raw = item.raw === undefined ? null : JSON.stringify(item.raw);
  const data = item.data === null ? null : JSON.stringify(item.data);
  const { rows } = await client.query<{ seq: string }>(
    `insert into items (tenant_id, connection_id, datatype, remote_id, office_id, seq, deleted,
                        schema_version, content_hash, raw, data, remote_updated_at, rules_version,
                        updated_at, tombstoned_at, page_part)
     values ($1,$2,$3,$4,$5, nextval('item_seq'), $6,$7,$8,$9,$10,$11,$12, now(), $13, $14)
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
       tombstoned_at = excluded.tombstoned_at,
       page_part = excluded.page_part
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
      raw,
      data,
      item.remoteUpdatedAt,
      item.rulesVersion,
      item.deleted ? new Date() : null,
      // Without its raw a live record's part cannot be made here; the fill makes it.
      raw === null && !item.deleted
        ? null
        : pagePart({
            datatype: item.datatype,
            connection_id: item.connectionId,
            remote_id: item.remoteId,
            office_id: item.officeId,
            deleted: item.deleted,
            schema_version: item.schemaVersion,
            content_hash: item.contentHash,
            raw,
            data,
          }),
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

/**
 * One item of a changes page with its part ready to send (engine/pages.ts). A record without one
 * yet has `raw` and `data` instead, as the JSON text the database holds, and gets its part made
 * as it is sent; with a part, both are null.
 */
export type ChangeRow = Pick<
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
  | 'page_part'
> & { raw: string | null; data: string | null };

/** The subscriber read (SRS §8): everything for this tenant and datatype after `seq`. */
export async function changesPage(query: ChangesQuery): Promise<ChangeRow[]> {
  const { rows } = await db().query<ChangeRow>(
    `select datatype, connection_id, remote_id, office_id, seq, deleted, schema_version,
       content_hash, remote_updated_at, page_part,
       case when page_part is null then raw::text end as raw,
       case when page_part is null then data::text end as data
     from items
     where tenant_id = $1 and datatype = $2 and seq > $3
     order by seq
     limit $4`,
    [query.tenantId, query.datatype, query.after, query.limit],
  );
  return rows;
}

/** How many records the fill makes parts for at a time. */
const FILL_BATCH = 100;

/**
 * Make the parts of the records stored before parts were (question 227), a batch at a time in
 * `seq` order, until none is left or `stop` says so, and tell how many. A record written meanwhile
 * has a new `seq` and its own part, and is left alone.
 */
export async function fillPageParts(stop: () => boolean = () => false): Promise<number> {
  let filled = 0;
  for (let after = '0'; !stop();) {
    // The next batch picked first, so only its records are turned into text.
    const { rows } = await db().query<PartFields & { seq: string }>(
      `select i.seq, i.datatype, i.connection_id, i.remote_id, i.office_id, i.deleted,
         i.schema_version, i.content_hash, i.raw::text as raw, i.data::text as data
       from (select seq from items where page_part is null and seq > $1
             order by seq limit ${String(FILL_BATCH)}) as batch
       join items i on i.seq = batch.seq
       order by i.seq`,
      [after],
    );
    if (rows.length === 0) break;
    const made = rows.filter((row) => row.deleted || row.raw !== null);
    const { rowCount } = await db().query(
      `update items set page_part = part.page_part
       from unnest($1::bigint[], $2::bytea[]) as part(seq, page_part)
       where items.seq = part.seq and items.page_part is null`,
      [made.map((row) => row.seq), made.map((row) => pagePart(row))],
    );
    filled += rowCount ?? 0;
    after = rows[rows.length - 1]?.seq ?? after;
  }
  return filled;
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
  /** Offices each of its own connection, as a person picks them: an office id alone may repeat. */
  connectionOffices?: { connectionId: string; officeId: string }[];
  /** Named records, whatever else the scope says. */
  keys?: ItemKey[];
};

export type Where = { clauses: string[]; values: unknown[] };

/**
 * A record's list of offices, as an agent's data names them; empty for any other record, whose
 * data is then never read (a record's data is large, and reading it for every record is slow).
 */
export const OFFICE_IDS = `case when datatype <> 'agent' then '[]'::jsonb when jsonb_typeof(data->'office_ids') = 'array' then data->'office_ids' else '[]'::jsonb end`;

/** One or several of a thing, as the clause `= any(...)` takes them; empty means every one. */
const listed = <T>(many: T[] | undefined, one: T | undefined): T[] =>
  many && many.length > 0 ? many : one === undefined || one === '' ? [] : [one];

/**
 * The where clause of a scope. Live records unless `deleted` says otherwise (`null`: live and
 * removed alike, which only the records search asks for).
 */
export function scopeWhere(scope: ScopeFilter, deleted: boolean | null = false): Where {
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
  if (scope.connectionOffices && scope.connectionOffices.length > 0) {
    const n = where.values.length;
    where.values.push(
      scope.connectionOffices.map((office) => office.connectionId),
      scope.connectionOffices.map((office) => office.officeId),
    );
    // An agent belongs to each of its offices, as its list of offices names them.
    const picked = `select * from unnest($${n + 1}::text[], $${n + 2}::text[])`;
    where.clauses.push(
      `((connection_id, office_id) in (${picked})
        or exists (select 1 from jsonb_array_elements_text(${OFFICE_IDS}) as office(id)
                   where (connection_id, office.id) in (${picked})))`,
    );
  }
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

/**
 * One page of a scope by seq, so a recompute of everything never holds everything in memory:
 * either the records not sold or the sold ones, because a recompute runs the unsold first and the
 * sold last, whatever the CRM (Patric, 2026-09-20, question 74). "Sold" is the universal
 * `sold_at` (the contract date) being set; a datatype without it is never sold.
 *
 * The page is the next `limit` records of the scope by seq, read on the seq index, and of those
 * only the sold or the unsold come back, so a page can come back short or empty while more
 * follow: `next` is where the next page starts, null after the last. With the sold test in the
 * same query as the limit the planner expected few records to match and read the whole table
 * for every page, which made the release preview time out on staging (2026-10-21).
 */
export async function scopeBatch(
  scope: ScopeFilter,
  sold: boolean,
  afterSeq: number,
  limit: number,
): Promise<{ items: ItemRow[]; next: number | null }> {
  const where = scopeWhere(scope);
  where.values.push(afterSeq, limit);
  const { rows: page } = await db().query<{ seq: string; sold: boolean }>(
    `select seq, (data->>'sold_at') is not null as sold from items
     where ${where.clauses.join(' and ')} and seq > $${where.values.length - 1}
     order by seq limit $${where.values.length}`,
    where.values,
  );
  const next = page.length === limit ? Number(page[page.length - 1]?.seq) : null;
  const wanted = page.filter((row) => row.sold === sold).map((row) => row.seq);
  if (wanted.length === 0) return { items: [], next };
  const { rows } = await db().query<ItemRow>(
    'select * from items where seq = any($1::bigint[]) order by seq',
    [wanted],
  );
  return { items: rows, next };
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
