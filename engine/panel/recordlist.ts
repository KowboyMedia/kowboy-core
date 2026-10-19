// Records (design B2, images 01 to 17 and 19): every record Core holds, by name, filtered by
// tenant, office, type and the CRM's id, and one record's page with its fields, its website text,
// what its CRM sent and its changes. The engine sends facts and the panel words them; a CRM is
// named only as its code names itself. Nothing here calls a CRM.
import { db } from '../storage/db.js';
import { OFFICE_IDS, scopeWhere, type ScopeFilter } from '../storage/items.js';
import { mapperFor } from '../registry.js';
import { fieldOrder } from '../contract.js';
import { applyRules, RULES_VERSION } from '../rules/run.js';
import { TOMBSTONE_RETENTION_DAYS } from '../version.js';
import type { Canonical, Datatype } from '../adapter-api/types.js';
import { crmName, type Tenant } from './inbox.js';

/** The types in the order the filter lists them (B2, image 05). */
export const RECORD_TYPES: readonly Datatype[] = [
  'property',
  'project',
  'agent',
  'office',
  'area',
  'association',
];

/** Records come 25 to a page, by name. */
export const LIST_PAGE = 25;

/** What a person filters the records by; an empty list means every one. */
export type RecordFilter = {
  tenants: number[];
  /** `<connection>:<office>`, an office of one connection. */
  offices: string[];
  types: Datatype[];
  /** The CRM's id for one record, exactly. */
  id: string;
  /** Removed records too, marked as removed. */
  removed: boolean;
};

export type RecordRow = {
  connection: string;
  datatype: Datatype;
  /** The CRM's id for it. */
  id: string;
  /** Its address or name, else the CRM's id. */
  name: string;
  tenant: Tenant;
  /** Its offices by name: an agent's every office, another record's own. */
  offices: string[];
  updatedAt: string;
  removed: boolean;
};

/** A tenant to filter by, with how many records the other filters keep for it. */
export type TenantChoice = {
  id: number;
  name: string;
  count: number;
  active: boolean;
  /** Its websites by label. */
  sites: string[];
  /** Its CRM connections, each with its CRM's name as the CRM's code gives it. */
  connections: { id: string; name: string; crm: string }[];
};

export type OfficeChoice = { key: string; name: string; tenant: number; count: number };

export type RecordList = {
  now: string;
  /** The rules that prepare the website text today. */
  rulesVersion: string;
  /** The CRMs Core reads, by name. */
  crms: string[];
  total: number;
  /** Of `total`, those removed. */
  removed: number;
  page: number;
  pageSize: number;
  rows: RecordRow[];
  tenants: TenantChoice[];
  offices: OfficeChoice[];
  types: { datatype: Datatype; count: number }[];
  /** The types whose records belong to no office, so an office filter leaves them out. */
  officeless: Datatype[];
};

const officeKey = (connection: string, office: string): string => `${connection}:${office}`;

/** `<connection>:<office>` back into its parts; null when it is not one. */
export function officeOf(key: string): { connectionId: string; officeId: string } | null {
  const at = key.indexOf(':');
  return at > 0 && at < key.length - 1
    ? { connectionId: key.slice(0, at), officeId: key.slice(at + 1) }
    : null;
}

/** The scope a filter names, as recompute, renumber and the search take it. */
export function scopeOf(filter: Omit<RecordFilter, 'removed'>): ScopeFilter {
  return {
    tenantIds: filter.tenants,
    connectionOffices: filter.offices.flatMap((key) => officeOf(key) ?? []),
    datatypes: filter.types,
    ...(filter.id ? { remoteId: filter.id } : {}),
  };
}

const NAME = `coalesce(data->'address'->>'street', data->>'name')`;

/**
 * A removed record's fields. Core keeps no unified copy of a removed record, so it maps the stored
 * payload again with its CRM's own mapper and the rules, as a recompute does. Null when it can't.
 */
export function fieldsFromRaw(
  provider: string,
  datatype: Datatype,
  raw: unknown,
): Canonical | null {
  const mapper = mapperFor(provider, datatype);
  if (!mapper || raw === null || raw === undefined) return null;
  try {
    return applyRules(datatype, mapper(raw).data);
  } catch {
    return null;
  }
}

/** A record's address or name, from its fields. */
export function nameIn(data: Canonical | null): string | null {
  if (!data) return null;
  const address = data['address'] as { street?: unknown } | null | undefined;
  if (address && typeof address.street === 'string' && address.street) return address.street;
  const name = data['name'];
  return typeof name === 'string' && name ? name : null;
}

type Known = {
  tenants: Map<number, { name: string; active: boolean }>;
  connections: Map<string, { tenantId: number; provider: string; name: string }>;
  sites: Map<number, string[]>;
  /** Office records by `<connection>:<office>`. */
  offices: Map<string, { name: string; tenant: number }>;
};

async function known(): Promise<Known> {
  const [tenants, connections, sites, offices] = await Promise.all([
    db().query<{ id: number; display_name: string; active: boolean }>(
      'select id, display_name, active from tenants',
    ),
    db().query<{ id: string; tenant_id: number; provider: string; name: string | null }>(
      'select id, tenant_id, provider, name from connections order by id',
    ),
    db().query<{ tenant_id: number; label: string }>(
      'select tenant_id, label from subscribers order by id',
    ),
    db().query<{
      connection_id: string;
      tenant_id: number;
      remote_id: string;
      name: string | null;
    }>(
      `select connection_id, tenant_id, remote_id, data->>'name' as name from items
       where datatype = 'office'`,
    ),
  ]);
  const siteMap = new Map<number, string[]>();
  for (const site of sites.rows) {
    const id = Number(site.tenant_id);
    siteMap.set(id, [...(siteMap.get(id) ?? []), site.label]);
  }
  return {
    tenants: new Map(
      tenants.rows.map((row) => [Number(row.id), { name: row.display_name, active: row.active }]),
    ),
    connections: new Map(
      connections.rows.map((row) => [
        row.id,
        { tenantId: Number(row.tenant_id), provider: row.provider, name: row.name ?? row.id },
      ]),
    ),
    sites: siteMap,
    offices: new Map(
      offices.rows.map((row) => [
        officeKey(row.connection_id, row.remote_id),
        { name: row.name ?? row.remote_id, tenant: Number(row.tenant_id) },
      ]),
    ),
  };
}

const swedish = new Intl.Collator('sv-SE', { sensitivity: 'base', numeric: true });

type Listed = {
  tenant_id: number;
  connection_id: string;
  datatype: Datatype;
  remote_id: string;
  office_id: string | null;
  office_ids: unknown;
  deleted: boolean;
  updated_at: Date;
  name: string | null;
  raw: unknown;
};

/** The offices a record belongs to, by name: an agent's every office, another record's own. */
function officesOf(row: Listed | null, data: Canonical | null, facts: Known): string[] {
  const connection = row?.connection_id ?? '';
  const ids = Array.isArray(data?.['office_ids'])
    ? (data['office_ids'] as unknown[]).filter((id): id is string => typeof id === 'string')
    : Array.isArray(row?.office_ids)
      ? (row.office_ids as unknown[]).filter((id): id is string => typeof id === 'string')
      : [];
  const own = row?.office_id ?? null;
  const all = ids.length > 0 ? ids : own ? [own] : [];
  return all.map((id) => facts.offices.get(officeKey(connection, id))?.name ?? id);
}

/** How many records each value of one filter has, with the other filters as they are. */
async function countsBy(
  column: string,
  scope: ScopeFilter,
  removed: boolean,
): Promise<{ value: string; n: number }[]> {
  const where = scopeWhere(scope, removed ? null : false);
  const { rows } = await db().query<{ value: string; n: string }>(
    `select ${column} as value, count(*) as n from items
     where ${where.clauses.join(' and ')} and ${column} is not null
     group by 1`,
    where.values,
  );
  return rows.map((row) => ({ value: String(row.value), n: Number(row.n) }));
}

/** How many records each office has: its own, and the agents it lists among theirs. */
async function countsByOffice(
  scope: ScopeFilter,
  removed: boolean,
): Promise<{ value: string; n: number }[]> {
  const where = scopeWhere(scope, removed ? null : false);
  const { rows } = await db().query<{ value: string; n: string }>(
    `select office.value, count(*) as n from items
     cross join lateral (
       select connection_id || ':' || office_id as value where office_id is not null
       union
       select connection_id || ':' || id from jsonb_array_elements_text(${OFFICE_IDS}) as listed(id)
     ) as office
     where ${where.clauses.join(' and ')}
     group by 1`,
    where.values,
  );
  return rows.map((row) => ({ value: String(row.value), n: Number(row.n) }));
}

/** The types whose records in a scope all belong to no office. */
async function officelessIn(scope: ScopeFilter, removed: boolean): Promise<Datatype[]> {
  const where = scopeWhere(scope, removed ? null : false);
  const { rows } = await db().query<{ datatype: Datatype }>(
    `select datatype from items where ${where.clauses.join(' and ')}
     group by datatype
     having bool_and(office_id is null and jsonb_array_length(${OFFICE_IDS}) = 0)`,
    where.values,
  );
  return RECORD_TYPES.filter((datatype) => rows.some((row) => row.datatype === datatype));
}

/** `GET /v1/panel/records`: one page of the records the filters keep, by name, and the filters. */
export async function recordList(filter: RecordFilter, page: number): Promise<RecordList> {
  const facts = await known();
  const scope = scopeOf(filter);
  // A CRM id finds its record live or removed, whatever the switch says.
  const removed = filter.removed || filter.id !== '';
  const where = scopeWhere(scope, removed ? null : false);
  const [{ rows }, byTenant, byOffice, byType, officeless] = await Promise.all([
    db().query<Listed>(
      `select tenant_id, connection_id, datatype, remote_id, office_id, deleted, updated_at,
         ${NAME} as name,
         case when datatype = 'agent' then data->'office_ids' end as office_ids,
         case when deleted then raw end as raw
       from items where ${where.clauses.join(' and ')}`,
      where.values,
    ),
    countsBy('tenant_id', { ...scope, tenantIds: [] }, removed),
    countsByOffice({ ...scope, connectionOffices: [] }, removed),
    countsBy('datatype', { ...scope, datatypes: [] }, removed),
    officelessIn({ ...scope, datatypes: [], connectionOffices: [] }, removed),
  ]);

  const named = rows.map((row) => {
    const provider = facts.connections.get(row.connection_id)?.provider ?? '';
    const name =
      row.name ??
      (row.deleted ? nameIn(fieldsFromRaw(provider, row.datatype, row.raw)) : null) ??
      row.remote_id;
    return { row, name };
  });
  named.sort(
    (a, b) => swedish.compare(a.name, b.name) || swedish.compare(a.row.remote_id, b.row.remote_id),
  );
  const pages = Math.max(1, Math.ceil(named.length / LIST_PAGE));
  const at = Math.min(Math.max(page, 1), pages);
  const shown = named.slice((at - 1) * LIST_PAGE, at * LIST_PAGE);

  const tenantCounts = new Map(byTenant.map((one) => [Number(one.value), one.n]));
  const officeCounts = new Map(byOffice.map((one) => [one.value, one.n]));
  const typeCounts = new Map(byType.map((one) => [one.value, one.n]));
  const providers = new Set([...facts.connections.values()].map((one) => one.provider));

  return {
    now: new Date().toISOString(),
    rulesVersion: RULES_VERSION,
    crms: [...providers].sort().map(crmName),
    total: named.length,
    removed: rows.filter((row) => row.deleted).length,
    page: at,
    pageSize: LIST_PAGE,
    rows: shown.map(({ row, name }) => ({
      connection: row.connection_id,
      datatype: row.datatype,
      id: row.remote_id,
      name,
      tenant: {
        id: Number(row.tenant_id),
        name: facts.tenants.get(Number(row.tenant_id))?.name ?? '',
      },
      offices: officesOf(row, null, facts),
      updatedAt: row.updated_at.toISOString(),
      removed: row.deleted,
    })),
    tenants: [...facts.tenants.entries()]
      .map(([id, tenant]) => ({
        id,
        name: tenant.name,
        count: tenantCounts.get(id) ?? 0,
        active: tenant.active,
        sites: facts.sites.get(id) ?? [],
        connections: [...facts.connections.entries()]
          .filter(([, connection]) => connection.tenantId === id)
          .map(([connectionId, connection]) => ({
            id: connectionId,
            name: connection.name,
            crm: crmName(connection.provider),
          })),
      }))
      .sort((a, b) => swedish.compare(a.name, b.name) || a.id - b.id),
    offices: [...facts.offices.entries()]
      .filter(([, office]) => filter.tenants.length === 0 || filter.tenants.includes(office.tenant))
      .map(([key, office]) => ({ key, ...office, count: officeCounts.get(key) ?? 0 }))
      .sort((a, b) => b.count - a.count || swedish.compare(a.name, b.name)),
    types: RECORD_TYPES.map((datatype) => ({ datatype, count: typeCounts.get(datatype) ?? 0 })),
    officeless,
  };
}

// ---- One record ----------------------------------------------------------------------------------

/** A field of a record, with the records it names where Core holds them. */
export type RecordField = {
  key: string;
  value: unknown;
  /** The records the field names, each by name and where its page is; empty for a plain field. */
  links: { name: string; connection: string; datatype: Datatype; id: string }[];
};

/** One change Core made to a record, as its event log keeps it. */
export type RecordChange = {
  at: string;
  /** Fetched from its CRM, prepared again with new rules, written the first time, or removed. */
  kind: 'fetched' | 'recomputed' | 'first' | 'removed';
  rules: string | null;
  fields: { key: string; from: unknown; to: unknown }[];
};

export type RecordPage = {
  now: string;
  connection: { id: string; name: string; crm: string };
  tenant: Tenant & { active: boolean; sites: string[] };
  datatype: Datatype;
  id: string;
  name: string;
  offices: string[];
  removed: boolean;
  removedAt: string | null;
  /** When Core deletes a removed record for good. */
  keptUntil: string | null;
  /** When its CRM last changed it, as its CRM said. */
  remoteUpdatedAt: string | null;
  savedAt: string;
  /** Its place in the order of changes the websites fetch by. */
  seq: string;
  /** The rules its website text was prepared with. */
  rulesVersion: string;
  currentRules: string;
  fields: RecordField[];
  texts: RecordField[];
  raw: unknown;
  changes: RecordChange[];
  /** How many days Core keeps its event log, and with it the changes. */
  changeDays: number;
};

/** The fields that name other records, by the type of the record they name. */
const LINKS: Record<string, Datatype> = {
  office_id: 'office',
  office_ids: 'office',
  agent_ids: 'agent',
  area_ids: 'area',
  association_id: 'association',
  project_id: 'project',
};

/** The most changes a record's page lists. */
const CHANGES = 100;

type ItemRow = {
  tenant_id: number;
  datatype: Datatype;
  remote_id: string;
  office_id: string | null;
  seq: string;
  deleted: boolean;
  data: Canonical | null;
  raw: unknown;
  remote_updated_at: Date | null;
  rules_version: string;
  updated_at: Date;
  tombstoned_at: Date | null;
};

const idsIn = (value: unknown): string[] =>
  typeof value === 'string'
    ? [value]
    : Array.isArray(value)
      ? value.filter((one): one is string => typeof one === 'string')
      : [];

/** The names of records of one connection, by `<datatype> <id>`, for those Core holds. */
export async function namesOf(
  connection: string,
  wanted: { datatype: Datatype; id: string }[],
): Promise<Map<string, string>> {
  if (wanted.length === 0) return new Map();
  const { rows } = await db().query<{ datatype: string; remote_id: string; name: string | null }>(
    `select datatype, remote_id, ${NAME} as name from items
     where connection_id = $1
       and (datatype, remote_id) in (select * from unnest($2::text[], $3::text[]))`,
    [connection, wanted.map((one) => one.datatype), wanted.map((one) => one.id)],
  );
  return new Map(
    rows.map((row) => [`${row.datatype} ${row.remote_id}`, row.name ?? row.remote_id]),
  );
}

/** The records a field names, when it is one of the fields that name records. */
export function linksIn(key: string, value: unknown): { datatype: Datatype; id: string }[] {
  const datatype = LINKS[key];
  return datatype ? idsIn(value).map((id) => ({ datatype, id })) : [];
}

/** The names of the records a record's fields name, by `<datatype> <id>`. */
const linked = (connection: string, data: Canonical): Promise<Map<string, string>> =>
  namesOf(
    connection,
    Object.keys(data).flatMap((key) => linksIn(key, data[key])),
  );

const isPlain = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A value as rows: an object with parts opens into one row per part, `address.street`. */
function rowsOf(key: string, value: unknown): { key: string; value: unknown }[] {
  if (isPlain(value) && Object.keys(value).length > 0)
    return Object.entries(value).flatMap(([part, inner]) => rowsOf(`${key}.${part}`, inner));
  return [{ key, value: value ?? null }];
}

/**
 * The parts of a changed field that differ, each by its path, `fee.amount` or
 * `display.sections[2].items[0].value`: an object or a list of objects is opened where both sides
 * have one, so a change lists what changed and not the whole value twice.
 */
export function differences(
  key: string,
  from: unknown,
  to: unknown,
): { key: string; from: unknown; to: unknown }[] {
  if (isPlain(from) && isPlain(to)) {
    return [...new Set([...Object.keys(from), ...Object.keys(to)])].flatMap((part) =>
      differences(`${key}.${part}`, from[part] ?? null, to[part] ?? null),
    );
  }
  const listOfObjects = (value: unknown): value is unknown[] =>
    Array.isArray(value) && value.some((one) => typeof one === 'object' && one !== null);
  if (Array.isArray(from) && Array.isArray(to) && (listOfObjects(from) || listOfObjects(to))) {
    return Array.from({ length: Math.max(from.length, to.length) }, (_, index) =>
      differences(`${key}[${String(index)}]`, from[index] ?? null, to[index] ?? null),
    ).flat();
  }
  return JSON.stringify(from) === JSON.stringify(to) ? [] : [{ key, from, to }];
}

function fieldsOf(
  connection: string,
  datatype: Datatype,
  data: Canonical | null,
  names: Map<string, string>,
): RecordField[] {
  if (!data) return [];
  const order = fieldOrder(datatype);
  const keys = Object.keys(data)
    .filter((key) => key !== 'display')
    .sort((a, b) => {
      const at = (key: string) => (order.includes(key) ? order.indexOf(key) : order.length);
      return at(a) - at(b) || a.localeCompare(b);
    });
  return keys.flatMap((key): RecordField[] => {
    const type = LINKS[key];
    if (!type) return rowsOf(key, data[key]).map((row) => ({ ...row, links: [] }));
    const links = idsIn(data[key]).flatMap((id) => {
      const name = names.get(`${type} ${id}`);
      return name ? [{ name, connection, datatype: type, id }] : [];
    });
    return [{ key, value: data[key] ?? null, links }];
  });
}

function textsOf(data: Canonical | null): RecordField[] {
  const display = data?.['display'];
  if (!isPlain(display)) return [];
  return Object.entries(display)
    .flatMap(([key, value]) => rowsOf(key, value))
    .map((row) => ({ ...row, links: [] }));
}

/** What Core did to the record, newest first, from the event log. */
async function changesOf(
  connection: string,
  datatype: Datatype,
  id: string,
): Promise<RecordChange[]> {
  const { rows } = await db().query<{ type: string; at: Date; fields: Record<string, unknown> }>(
    `select type, at, fields from events
     where connection_id = $1 and datatype = $2 and remote_id = $3
       and type in ('entity.written', 'entity.tombstoned')
     order by id desc limit $4`,
    [connection, datatype, id, CHANGES],
  );
  return rows.map((row) => {
    if (row.type === 'entity.tombstoned') {
      return { at: row.at.toISOString(), kind: 'removed', rules: null, fields: [] };
    }
    const first = row.fields['old_hash'] === null || row.fields['old_hash'] === undefined;
    const changed = (row.fields['changed'] ?? {}) as Record<string, { from: unknown; to: unknown }>;
    return {
      at: row.at.toISOString(),
      kind: first ? 'first' : row.fields['cause'] === 'recompute' ? 'recomputed' : 'fetched',
      rules: typeof row.fields['rules_version'] === 'string' ? row.fields['rules_version'] : null,
      fields: first
        ? []
        : Object.entries(changed).flatMap(([key, change]) =>
            differences(key, change.from ?? null, change.to ?? null),
          ),
    };
  });
}

/** `GET /v1/panel/records/<connection>/<datatype>/<id>`: one record; null when Core has none. */
export async function recordPage(
  connectionId: string,
  datatype: string,
  remoteId: string,
  changeDays: number,
): Promise<RecordPage | null> {
  if (!(RECORD_TYPES as readonly string[]).includes(datatype)) return null;
  const type = datatype as Datatype;
  const { rows } = await db().query<ItemRow>(
    `select tenant_id, datatype, remote_id, office_id, seq, deleted, data, raw, remote_updated_at,
       rules_version, updated_at, tombstoned_at
     from items where connection_id = $1 and datatype = $2 and remote_id = $3`,
    [connectionId, type, remoteId],
  );
  const item = rows[0];
  if (!item) return null;
  const facts = await known();
  const connection = facts.connections.get(connectionId);
  if (!connection) return null;
  const tenantId = Number(item.tenant_id);
  const data = item.deleted ? fieldsFromRaw(connection.provider, type, item.raw) : item.data;
  const [names, changes] = await Promise.all([
    data ? linked(connectionId, data) : Promise.resolve(new Map<string, string>()),
    changesOf(connectionId, type, remoteId),
  ]);
  const tenant = facts.tenants.get(tenantId);
  const kept = item.tombstoned_at
    ? new Date(item.tombstoned_at.getTime() + TOMBSTONE_RETENTION_DAYS * 86_400_000)
    : null;
  return {
    now: new Date().toISOString(),
    connection: { id: connectionId, name: connection.name, crm: crmName(connection.provider) },
    tenant: {
      id: tenantId,
      name: tenant?.name ?? '',
      active: tenant?.active ?? false,
      sites: facts.sites.get(tenantId) ?? [],
    },
    datatype: type,
    id: item.remote_id,
    name: nameIn(data) ?? item.remote_id,
    offices: officesOf(
      {
        tenant_id: tenantId,
        connection_id: connectionId,
        datatype: type,
        remote_id: item.remote_id,
        office_id: item.office_id,
        office_ids: null,
        deleted: item.deleted,
        updated_at: item.updated_at,
        name: null,
        raw: null,
      },
      data,
      facts,
    ),
    removed: item.deleted,
    removedAt: item.deleted ? (item.tombstoned_at?.toISOString() ?? null) : null,
    keptUntil: item.deleted && kept ? kept.toISOString() : null,
    remoteUpdatedAt: item.remote_updated_at?.toISOString() ?? null,
    savedAt: item.updated_at.toISOString(),
    seq: String(item.seq),
    rulesVersion: item.rules_version,
    currentRules: RULES_VERSION,
    fields: fieldsOf(connectionId, type, data, names),
    texts: textsOf(data),
    raw: item.raw ?? null,
    changes,
    changeDays,
  };
}
