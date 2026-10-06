// The scope every list and run is narrowed by (Patric, 2026-10-06: tenants, offices, entity types
// and one record id, the same on Records, Flow and Manual sync). One shape, read from a query
// string or a body, and one call that offers what can be picked, so a scope built on one page
// means exactly what it means on the others.
import { DATATYPES, type Datatype } from '../adapter-api/types.js';
import { db } from '../storage/db.js';
import { tenants } from '../storage/connections.js';
import { itemCounts } from '../storage/items.js';
import { entity, listed, officeNamed } from './words.js';

export type Scope = {
  tenantIds?: number[];
  officeIds?: string[];
  datatypes?: Datatype[];
  remoteId?: string;
};

const list = (query: URLSearchParams, key: string): string[] =>
  (query.get(key) ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');

/**
 * The scope as a query string carries it: `tenant=1,2&office=A,B&datatype=property&id=OBJ-1`.
 * A slip in it is a refusal in words, never a database error.
 */
export function scopeFromQuery(query: URLSearchParams): { scope: Scope } | { error: string } {
  const scope: Scope = {};
  const tenantIds = list(query, 'tenant');
  for (const value of tenantIds) {
    if (!/^\d{1,9}$/.test(value)) return { error: `“${value}” is not a tenant number.` };
  }
  if (tenantIds.length > 0) scope.tenantIds = tenantIds.map(Number);
  const officeIds = list(query, 'office');
  if (officeIds.length > 0) scope.officeIds = officeIds;
  const datatypes: Datatype[] = [];
  for (const value of list(query, 'datatype')) {
    const known = DATATYPES.find((datatype) => datatype === value);
    if (!known)
      return {
        error: `The address asks for a kind of record Core does not know (“${value}”). Pick the entity types in the box instead.`,
      };
    datatypes.push(known);
  }
  if (datatypes.length > 0) scope.datatypes = datatypes;
  const remoteId = query.get('id')?.trim();
  if (remoteId) scope.remoteId = remoteId;
  return { scope };
}

/** The body's names for the parts of a scope, and the address's. */
const IN_BODY = { tenantIds: 'tenant', officeIds: 'office', datatypes: 'datatype', remoteId: 'id' };

/**
 * The scope as a run's body carries it (`tenantIds`, `officeIds`, `datatypes`, `remoteId`), read
 * by the same rules as the address, so a slip is a refusal in words here too.
 */
export function scopeFromBody(
  given: Record<string, unknown>,
): { scope: Scope } | { error: string } {
  const query = new URLSearchParams();
  for (const [field, key] of Object.entries(IN_BODY)) {
    const value = given[field];
    if (value === undefined || value === null) continue;
    const parts: unknown[] = Array.isArray(value) ? value : [value];
    if (!parts.every((part) => typeof part === 'string' || typeof part === 'number'))
      return { error: `“${field}” must be a name or a number, or a list of them.` };
    query.set(key, parts.join(','));
  }
  return scopeFromQuery(query);
}

/** The tenants' names by number, read for the few a sentence names. */
export async function tenantNamesOf(ids: number[]): Promise<Map<number, string>> {
  if (ids.length === 0) return new Map();
  const { rows } = await db().query<{ id: number; display_name: string }>(
    'select id, display_name from tenants where id = any($1::int[])',
    [ids],
  );
  return new Map(rows.map((row) => [Number(row.id), row.display_name]));
}

/** The offices' names as their office records hold them, within the tenants when some are named. */
export async function officeNamesOf(
  ids: string[],
  tenantIds: number[],
): Promise<Map<string, string>> {
  const { rows } = await db().query<{ remote_id: string; name: string | null }>(
    `select distinct on (remote_id) remote_id, data->>'name' as name
     from items
     where datatype = 'office' and remote_id = any($1::text[])
       and ($2::int[] is null or tenant_id = any($2::int[]))
     order by remote_id, tombstoned_at nulls first`,
    [ids, tenantIds.length > 0 ? tenantIds : null],
  );
  return new Map(rows.flatMap((row) => (row.name ? [[row.remote_id, row.name] as const] : [])));
}

/**
 * A scope in words, for the audit event and the message after a run: "the homes of the office
 * Lidingö (the CRM’s office id 100) of Acme", "every record in Core". Things by their names.
 */
export async function describeScope(scope: Scope): Promise<string> {
  const what = scope.remoteId
    ? `the record with the CRM’s id ${scope.remoteId}`
    : scope.datatypes?.length
      ? `the ${listed(scope.datatypes.map((datatype) => entity(datatype, true)))}`
      : 'every record';
  const owners: string[] = [];
  const tenantIds = scope.tenantIds ?? [];
  if (scope.officeIds?.length) {
    const names = await officeNamesOf(scope.officeIds, tenantIds);
    owners.push(`of ${listed(scope.officeIds.map((id) => officeNamed(id, names.get(id))))}`);
  }
  if (tenantIds.length > 0) {
    const names = await tenantNamesOf(tenantIds);
    owners.push(`of ${listed(tenantIds.map((id) => names.get(id) ?? 'a tenant since removed'))}`);
  }
  if (owners.length > 0) return [what, ...owners].join(' ');
  return scope.remoteId ? what : `${what} in Core`;
}

export type ScopeOptions = {
  tenants: { id: number; name: string }[];
  /** Every office Core holds records for, live or removed, named as its office record names it. */
  offices: { tenantId: number; id: string; name: string | null }[];
  /** Every datatype Core holds, so the picker offers no entity nobody has. */
  datatypes: string[];
};

/**
 * What the scope pickers offer, in one call. The offices are read from the records themselves,
 * not from what a connection was licensed for: an adapter that learns its offices from the CRM
 * stores no list (question 156 a), and an office taken off the sites must stay pickable while
 * its removed records are kept, so a link to them shows the office in its filter.
 */
export async function scopeOptions(): Promise<ScopeOptions> {
  const [rows, counts, offices] = await Promise.all([
    tenants(),
    itemCounts(),
    db().query<{ tenant_id: number; office_id: string; name: string | null }>(
      `select held.tenant_id, held.office_id, named.name
       from (select distinct tenant_id, office_id from items where office_id is not null) held
       left join lateral (
         select data->>'name' as name from items office
         where office.tenant_id = held.tenant_id and office.datatype = 'office'
           and office.remote_id = held.office_id
         limit 1) named on true
       order by held.tenant_id, named.name nulls last, held.office_id`,
    ),
  ]);
  return {
    tenants: rows.map((tenant) => ({ id: tenant.id, name: tenant.display_name })),
    offices: offices.rows.map((row) => ({
      tenantId: row.tenant_id,
      id: row.office_id,
      name: row.name,
    })),
    datatypes: [...new Set(counts.map((count) => count.datatype))].sort(),
  };
}
