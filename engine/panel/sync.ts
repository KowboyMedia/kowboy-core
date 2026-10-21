// Manual sync (design B2, images 13 to 37): fetch records from their CRM again, prepare their
// website text again, or send them to the websites again, for records a person picked or for
// what the records filter keeps. It is built from the engine's own pieces: the CRM's code is
// asked through a lifecycle event (refetch or resync), the recompute runs as a job, and sending is
// a renumbering and a change notice. Nothing here calls a CRM or writes to one; a fetch is a read
// the CRM's own code makes through its own door. Core keeps no row of a sync: the panel holds the
// ticket it is given and asks with it how the sync is coming along.
import { db } from '../storage/db.js';
import {
  countItems,
  renumber,
  resyncTenant,
  scopeWhere,
  type ScopeFilter,
} from '../storage/items.js';
import { connectionById } from '../storage/connections.js';
import { queueLifecycle } from '../lifecycle.js';
import { createJob, getJob } from '../jobs.js';
import { ring } from '../bells.js';
import { adminFor } from '../registry.js';
import { canonicalJson } from '../json.js';
import type { AdminRecord, Datatype } from '../adapter-api/types.js';
import { crmName } from './inbox.js';
import {
  fieldsFromRaw,
  linksIn,
  nameIn,
  namesOf,
  RECORD_TYPES,
  scopeOf,
  type RecordFilter,
} from './recordlist.js';

export type SyncWhat = 'fetch' | 'recompute' | 'send';

/** The most records a person may pick for one sync. */
export const MOST_PICKED = 500;

export type PickedRecord = { connection: string; datatype: Datatype; id: string };

/** What to sync: the records a person picked, or everything the filter keeps. */
export type SyncChoice = { records: PickedRecord[] } | { filter: Omit<RecordFilter, 'removed'> };

/** What the panel keeps of a sync it started, and sends back to ask how it is coming along. */
export type SyncTicket = {
  what: SyncWhat;
  /** When it started, by Core's clock. */
  at: string;
  /** The lifecycle events a fetch queued. */
  events: number[];
  /** The recompute's job. */
  job: number | null;
  /** The tenants whose websites get the change. */
  tenants: number[];
  /** How many records a send put in line for the websites. */
  sent: number | null;
};

export type SyncStarted = SyncTicket & {
  /** How many records were chosen. */
  count: number;
  /** A fetch asks again for named records, or has its CRM list them all afresh. */
  mode: 'refetch' | 'resync' | null;
  /** The connections a fetch goes through, each with its CRM's name as the CRM's code gives it. */
  connections: { id: string; name: string; crm: string }[];
};

export type SyncSite = {
  tenant: { id: number; name: string; active: boolean };
  label: string;
  /** When the website last fetched from Core. */
  fetchedAt: string | null;
  /** It fetched after Core wrote the sync's last change, or there was nothing to fetch. */
  current: boolean;
};

export type SyncView = {
  state: 'working' | 'done' | 'stopped';
  /** A recompute's progress, in records. */
  progress: { done: number; total: number } | null;
  /** Records the CRM's code still has to fetch, and those whose fetch failed so far. */
  waiting: number;
  failedFetches: number;
  /** What failed, in the words Core has, when the sync stopped. */
  error: string | null;
  fetched: {
    /** How many records were asked for again; null when the CRM listed them all afresh. */
    asked: number | null;
    added: { datatype: Datatype; name: string }[];
    addedCount: number;
    removed: { datatype: Datatype; name: string }[];
    removedCount: number;
    changed: number;
    /** The changes every changed record shares, with the records a field names by name. */
    common: { key: string; from: unknown; to: unknown }[];
  } | null;
  recomputed: { examined: number; changed: number; unchanged: number; failed: number } | null;
  /** When Core wrote the sync's last change; null while it works or when it wrote nothing. */
  writtenAt: string | null;
  sites: SyncSite[];
};

/** The most records a finished sync names; the rest are counted. */
const NAMED = 10;

type Chosen = {
  scope: ScopeFilter;
  /** The records, when a person picked them or the filter names them by office or id. */
  keys:
    | {
        tenant: number;
        connection: string;
        datatype: Datatype;
        id: string;
        office: string | null;
      }[]
    | null;
};

/** The picked records as Core holds them, live or removed; null when one is not Core's. */
async function picked(records: PickedRecord[]): Promise<Chosen['keys']> {
  if (records.length === 0) return [];
  const { rows } = await db().query<{
    tenant_id: number;
    connection_id: string;
    datatype: Datatype;
    remote_id: string;
    office_id: string | null;
  }>(
    `select tenant_id, connection_id, datatype, remote_id, office_id from items
     where (connection_id, datatype, remote_id) in (
       select * from unnest($1::text[], $2::text[], $3::text[]))`,
    [
      records.map((one) => one.connection),
      records.map((one) => one.datatype),
      records.map((one) => one.id),
    ],
  );
  return rows.map((row) => ({
    tenant: Number(row.tenant_id),
    connection: row.connection_id,
    datatype: row.datatype,
    id: row.remote_id,
    office: row.office_id,
  }));
}

/** Every record a filter keeps, live or removed, when it names offices or an id. */
async function filtered(scope: ScopeFilter): Promise<NonNullable<Chosen['keys']>> {
  const where = scopeWhere(scope, null);
  const { rows } = await db().query<{
    tenant_id: number;
    connection_id: string;
    datatype: Datatype;
    remote_id: string;
    office_id: string | null;
  }>(
    `select tenant_id, connection_id, datatype, remote_id, office_id from items
     where ${where.clauses.join(' and ')} order by seq`,
    where.values,
  );
  return rows.map((row) => ({
    tenant: Number(row.tenant_id),
    connection: row.connection_id,
    datatype: row.datatype,
    id: row.remote_id,
    office: row.office_id,
  }));
}

/** The tenants with records in a scope, or with a connection when the scope names none. */
async function tenantsOf(scope: ScopeFilter, connections: string[]): Promise<number[]> {
  const where = scopeWhere(scope, null);
  const { rows } = await db().query<{ tenant_id: number }>(
    `select distinct tenant_id from items where ${where.clauses.join(' and ')}
     union select tenant_id from connections where id = any($${where.values.length + 1}::text[])`,
    [...where.values, connections],
  );
  return rows.map((row) => Number(row.tenant_id)).sort((a, b) => a - b);
}

/** The connections of the tenants a filter names, or every connection. */
async function connectionsFor(tenants: number[]): Promise<string[]> {
  const { rows } = await db().query<{ id: string }>(
    `select id from connections where cardinality($1::int[]) = 0 or tenant_id = any($1::int[])
     order by id`,
    [tenants],
  );
  return rows.map((row) => row.id);
}

async function described(ids: string[]): Promise<SyncStarted['connections']> {
  const { rows } = await db().query<{ id: string; provider: string; name: string | null }>(
    'select id, provider, name from connections where id = any($1::text[]) order by id',
    [ids],
  );
  return rows.map((row) => ({ id: row.id, name: row.name ?? row.id, crm: crmName(row.provider) }));
}

/** Fetch again: the named records through their CRM's code, or everything listed afresh. */
async function startFetch(
  chosen: Chosen,
  filter: Omit<RecordFilter, 'removed'> | null,
): Promise<{ events: number[]; connections: string[]; mode: 'refetch' | 'resync' }> {
  const events: number[] = [];
  if (chosen.keys) {
    const byConnection = new Map<string, AdminRecord[]>();
    for (const key of chosen.keys) {
      byConnection.set(key.connection, [
        ...(byConnection.get(key.connection) ?? []),
        { datatype: key.datatype, remoteId: key.id, officeId: key.office },
      ]);
    }
    for (const [connection, records] of byConnection) {
      const id = await queueLifecycle(connection, 'refetch', { records });
      if (id !== null) events.push(id);
    }
    return { events, connections: [...byConnection.keys()], mode: 'refetch' };
  }
  const connections = await connectionsFor(filter?.tenants ?? []);
  const types = filter?.types ?? [];
  for (const connection of connections) {
    for (const datatype of types.length > 0 ? types : [undefined]) {
      const id = await queueLifecycle(connection, 'resync', datatype ? { datatype } : {});
      if (id !== null) events.push(id);
    }
  }
  return { events, connections, mode: 'resync' };
}

/** A choice made valid: known types, at most the picked records allowed. Null when it is not one. */
export function choiceOf(given: unknown): SyncChoice | null {
  if (!given || typeof given !== 'object') return null;
  const object = given as Record<string, unknown>;
  const isType = (value: unknown): value is Datatype =>
    typeof value === 'string' && (RECORD_TYPES as readonly string[]).includes(value);
  if (Array.isArray(object['records'])) {
    const records = object['records'].flatMap((one: unknown) => {
      const record = (one ?? {}) as Record<string, unknown>;
      return typeof record['connection'] === 'string' &&
        isType(record['datatype']) &&
        typeof record['id'] === 'string' &&
        record['id'] !== ''
        ? [{ connection: record['connection'], datatype: record['datatype'], id: record['id'] }]
        : [];
    });
    return records.length === object['records'].length &&
      records.length > 0 &&
      records.length <= MOST_PICKED
      ? { records }
      : null;
  }
  const filter = object['filter'];
  if (!filter || typeof filter !== 'object') return null;
  const shape = filter as Record<string, unknown>;
  const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
  const tenants = list(shape['tenants']).filter(
    (one): one is number => typeof one === 'number' && Number.isInteger(one),
  );
  const offices = list(shape['offices']).filter(
    (one): one is string => typeof one === 'string' && one.includes(':'),
  );
  const types = list(shape['types']).filter(isType);
  const id = typeof shape['id'] === 'string' ? shape['id'].trim() : '';
  return { filter: { tenants, offices, types, id } };
}

/**
 * `POST /v1/panel/records/sync`: start a sync. A fetch queues one event for each connection's CRM
 * code; a recompute queues a job; a send gives the records new places in the order of changes and
 * tells the tenants' websites. Null when the choice holds no record Core has.
 */
export async function startSync(
  choice: SyncChoice,
  what: SyncWhat,
  by: string,
): Promise<SyncStarted | null> {
  const filter = 'filter' in choice ? choice.filter : null;
  const scope = filter ? scopeOf(filter) : null;
  const keys =
    'records' in choice
      ? await picked(choice.records)
      : filter && (filter.offices.length > 0 || filter.id !== '') && scope
        ? await filtered(scope)
        : null;
  const chosen: Chosen = {
    scope: keys
      ? {
          keys: keys.map((key) => ({
            tenantId: key.tenant,
            connectionId: key.connection,
            datatype: key.datatype,
            remoteId: key.id,
          })),
        }
      : (scope ?? {}),
    keys,
  };
  if (keys && keys.length === 0) return null;
  const count = keys ? keys.length : await countItems(chosen.scope);
  const { rows: clock } = await db().query<{ now: Date }>('select now() as now');
  const at = (clock[0]?.now ?? new Date()).toISOString();

  if (what === 'fetch') {
    const fetch = await startFetch(chosen, filter);
    return {
      what,
      at,
      events: fetch.events,
      job: null,
      tenants: await tenantsOf(chosen.scope, fetch.connections),
      count,
      mode: fetch.mode,
      connections: await described(fetch.connections),
      sent: null,
    };
  }
  const tenants = await tenantsOf(chosen.scope, []);
  if (what === 'recompute') {
    const job = await createJob({
      kind: 'recompute',
      scope: chosen.scope,
      dryRun: false,
      requestedBy: by,
    });
    return { what, at, events: [], job, tenants, count, mode: null, connections: [], sent: null };
  }
  const sent = await send(chosen);
  return {
    what,
    at,
    events: [],
    job: null,
    tenants,
    count,
    mode: null,
    connections: [],
    sent: sent ?? count,
  };
}

/**
 * The tenants a sync covers whole: no record, office, type or id narrows it. Null when it is
 * narrowed.
 */
function wholeTenants(chosen: Chosen): number[] | null {
  const { scope } = chosen;
  const types = scope.datatypes ?? [];
  const everyType = types.length === 0 || RECORD_TYPES.every((one) => types.includes(one));
  const narrowed =
    chosen.keys !== null || (scope.connectionOffices ?? []).length > 0 || scope.remoteId;
  return !narrowed && everyType && (scope.tenantIds ?? []).length > 0
    ? (scope.tenantIds ?? [])
    : null;
}

/**
 * Send records to the websites again. A whole tenant's websites rebuild from the start, so they
 * also drop what Core does not hold for the tenant, such as another tenant's records left by an
 * earlier token (Patric, 2026-10-19: switching a website to another tenant "should be possible
 * for an admin"); anything narrower gets new change numbers and a change notice. Answers how many
 * records were renumbered, or null for a rebuild.
 */
async function send(chosen: Chosen): Promise<number | null> {
  const whole = wholeTenants(chosen);
  if (whole) {
    // The tenant's purge watermark goes past everything it holds, so its websites rebuild.
    for (const tenant of whole) {
      await resyncTenant(tenant);
      await ring(tenant, 'forcerefresh');
    }
    return null;
  }
  const moved = await renumber(chosen.scope);
  for (const tenant of moved.tenantIds) await ring(tenant);
  return moved.records;
}

// ---- How a sync is coming along ------------------------------------------------------------------

type LifecycleRow = {
  id: string;
  connection_id: string;
  event: string;
  datatype: Datatype | null;
  records: AdminRecord[] | null;
  done_at: Date | null;
  error: string | null;
};

type Written = {
  type: string;
  at: Date;
  connection_id: string;
  datatype: Datatype;
  remote_id: string;
  fields: Record<string, unknown>;
  name: string | null;
  deleted: boolean | null;
  raw: unknown;
  provider: string;
};

/** Each change every changed record shares, the records a field names written by their names. */
async function commonChanges(
  changes: { connection: string; changed: Record<string, { from: unknown; to: unknown }> }[],
): Promise<{ key: string; from: unknown; to: unknown }[]> {
  const first = changes[0];
  if (!first) return [];
  const shared = Object.entries(first.changed).filter(
    ([key, change]) =>
      !key.startsWith('display.') &&
      changes.every((other) => {
        const same = other.changed[key];
        return (
          same !== undefined &&
          canonicalJson(same.from) === canonicalJson(change.from) &&
          canonicalJson(same.to) === canonicalJson(change.to)
        );
      }),
  );
  const wanted = shared.flatMap(([key, change]) => [
    ...linksIn(key, change.from),
    ...linksIn(key, change.to),
  ]);
  const names = await namesOf(first.connection, wanted);
  const named = (key: string, value: unknown): unknown => {
    const links = linksIn(key, value);
    if (links.length === 0) return value;
    const words = links.map((one) => names.get(`${one.datatype} ${one.id}`) ?? one.id);
    return Array.isArray(value) ? words : words[0];
  };
  // Those that name records first, then plain values, then values with parts: the panel words the
  // first, and a name reads better than an id or a block of JSON.
  const rank = ([key, change]: [string, { from: unknown; to: unknown }]): number => {
    if (linksIn(key, change.from).length + linksIn(key, change.to).length > 0) return 0;
    const plain = (value: unknown) =>
      typeof value !== 'object' ||
      value === null ||
      (Array.isArray(value) && value.every((one) => typeof one !== 'object' || one === null));
    return plain(change.from) && plain(change.to) ? 1 : 2;
  };
  return shared
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => rank(a.entry) - rank(b.entry) || a.index - b.index)
    .map(({ entry: [key, change] }) => ({
      key,
      from: named(key, change.from),
      to: named(key, change.to),
    }));
}

/** What a fetch wrote: the records that came, went and changed since it started, in its part. */
async function fetchedSince(
  at: string,
  rows: LifecycleRow[],
): Promise<NonNullable<SyncView['fetched']>> {
  const connections = [...new Set(rows.map((row) => row.connection_id))];
  const { rows: events } = await db().query<Written>(
    `select e.type, e.at, e.connection_id, e.datatype, e.remote_id, e.fields,
       coalesce(i.data->'address'->>'street', i.data->>'name') as name, i.deleted,
       case when i.deleted then i.raw end as raw, c.provider
     from events e
     join connections c on c.id = e.connection_id
     left join items i on i.connection_id = e.connection_id and i.datatype = e.datatype
       and i.remote_id = e.remote_id
     where e.at >= $1 and e.connection_id = any($2::text[])
       and e.type in ('entity.written', 'entity.tombstoned')
       and coalesce(e.fields->>'cause', '') <> 'recompute'
     order by e.id`,
    [at, connections],
  );
  const asked = new Set(
    rows.flatMap((row) =>
      (row.records ?? []).map((one) => `${row.connection_id} ${one.datatype} ${one.remoteId}`),
    ),
  );
  const listed = rows
    .filter((row) => row.event === 'resync')
    .map((row) => ({ connection: row.connection_id, datatype: row.datatype }));
  const inPart = (event: Written): boolean =>
    asked.has(`${event.connection_id} ${event.datatype} ${event.remote_id}`) ||
    listed.some(
      (one) =>
        one.connection === event.connection_id &&
        (one.datatype === null || one.datatype === event.datatype),
    );

  // A record's last word counts: written, then removed, is removed.
  const last = new Map<string, { event: Written; first: boolean }>();
  for (const event of events.filter(inPart)) {
    const key = `${event.connection_id} ${event.datatype} ${event.remote_id}`;
    const first =
      (last.get(key)?.first ?? false) ||
      (event.type === 'entity.written' &&
        (event.fields['old_hash'] === null || event.fields['old_hash'] === undefined));
    last.set(key, { event, first });
  }
  const nameOf = (event: Written): string =>
    event.name ??
    nameIn(event.deleted ? fieldsFromRaw(event.provider, event.datatype, event.raw) : null) ??
    event.remote_id;
  const all = [...last.values()];
  const added = all.filter((one) => one.first && one.event.type === 'entity.written');
  const removed = all.filter((one) => one.event.type === 'entity.tombstoned');
  const changed = all.filter((one) => !one.first && one.event.type === 'entity.written');
  return {
    asked: asked.size > 0 && listed.length === 0 ? asked.size : null,
    added: added
      .slice(0, NAMED)
      .map((one) => ({ datatype: one.event.datatype, name: nameOf(one.event) })),
    addedCount: added.length,
    removed: removed
      .slice(0, NAMED)
      .map((one) => ({ datatype: one.event.datatype, name: nameOf(one.event) })),
    removedCount: removed.length,
    changed: changed.length,
    common: await commonChanges(
      changed.map((one) => ({
        connection: one.event.connection_id,
        changed: (one.event.fields['changed'] ?? {}) as Record<
          string,
          { from: unknown; to: unknown }
        >,
      })),
    ),
  };
}

/** The part of a CRM's fetch list one lifecycle event asked for: its type, its records' types, its one record. */
function queueScopeOf(row: LifecycleRow): { datatypes?: Datatype[]; remoteId?: string } {
  const records = row.records ?? [];
  const datatypes = row.datatype
    ? [row.datatype]
    : records.length > 0
      ? [...new Set(records.map((one) => one.datatype))]
      : undefined;
  const only = records.length === 1 ? records[0]?.remoteId : undefined;
  return { ...(datatypes ? { datatypes } : {}), ...(only ? { remoteId: only } : {}) };
}

/** What waits on the CRM's own fetch list for the part a fetch asked for. */
async function stillQueued(rows: LifecycleRow[]): Promise<{ waiting: number; failed: number }> {
  let waiting = 0;
  let failed = 0;
  for (const row of rows) {
    const connection = await connectionById(row.connection_id);
    const admin = connection ? adminFor(connection.provider) : undefined;
    if (!connection || !admin?.queueCount) continue;
    const queued = await admin.queueCount([connection], queueScopeOf(row));
    waiting += queued.waiting;
    failed += queued.failed;
  }
  return { waiting, failed };
}

/** Each website of the tenants, and whether it fetched after `writtenAt`. */
async function sitesOf(tenants: number[], writtenAt: string | null): Promise<SyncSite[]> {
  const { rows } = await db().query<{
    tenant_id: number;
    display_name: string;
    active: boolean;
    label: string;
    last_pull_at: Date | null;
  }>(
    `select s.tenant_id, t.display_name, t.active, s.label, s.last_pull_at
     from subscribers s join tenants t on t.id = s.tenant_id
     where s.tenant_id = any($1::int[]) order by t.display_name, s.id`,
    [tenants],
  );
  return rows.map((row) => ({
    tenant: { id: Number(row.tenant_id), name: row.display_name, active: row.active },
    label: row.label,
    fetchedAt: row.last_pull_at?.toISOString() ?? null,
    current:
      writtenAt === null ||
      (row.last_pull_at !== null && row.last_pull_at.getTime() >= Date.parse(writtenAt)),
  }));
}

const latest = (times: (Date | null | undefined)[]): string | null => {
  const known = times.filter((one): one is Date => one instanceof Date);
  return known.length === 0
    ? null
    : new Date(Math.max(...known.map((one) => one.getTime()))).toISOString();
};

/** A fetch's state: its lifecycle events, what waits on the CRM's own fetch list, what it wrote. */
async function fetchState(ticket: SyncTicket, view: SyncView): Promise<void> {
  const { rows } = await db().query<LifecycleRow>(
    `select id, connection_id, event, datatype, records, done_at, error from lifecycle_events
     where id = any($1::bigint[]) order by id`,
    [ticket.events],
  );
  const open = rows.some((row) => row.done_at === null);
  const failure = rows.find((row) => row.error !== null)?.error ?? null;
  const queued = open ? { waiting: 0, failed: 0 } : await stillQueued(rows);
  view.waiting = queued.waiting;
  view.failedFetches = queued.failed;
  view.state = failure ? 'stopped' : open || queued.waiting > 0 ? 'working' : 'done';
  view.error = failure;
  view.fetched = await fetchedSince(ticket.at, rows);
  if (view.state !== 'done') return;
  const { rows: written } = await db().query<{ at: Date | null }>(
    `select max(at) as at from events where at >= $1 and connection_id = any($2::text[])
       and type in ('entity.written', 'entity.tombstoned')`,
    [ticket.at, [...new Set(rows.map((row) => row.connection_id))]],
  );
  const wrote = view.fetched.addedCount + view.fetched.removedCount + view.fetched.changed > 0;
  view.writtenAt = wrote ? latest([written[0]?.at, ...rows.map((row) => row.done_at)]) : null;
}

/** A recompute's state, from its job. */
async function recomputeState(job: number, view: SyncView): Promise<void> {
  const row = await getJob(job);
  if (!row || row.state === 'failed') {
    view.state = 'stopped';
    view.error = row?.error ?? null;
    return;
  }
  if (row.state !== 'done') {
    view.state = 'working';
    view.progress = {
      done: row.progress.examined ?? 0,
      total: row.progress.total ?? (await countItems(row.scope)),
    };
    return;
  }
  view.recomputed = {
    examined: row.result?.examined ?? 0,
    changed: row.result?.changed ?? 0,
    unchanged: row.result?.unchanged ?? 0,
    failed: row.result?.failed ?? 0,
  };
  view.writtenAt = view.recomputed.changed > 0 ? latest([row.finished_at]) : null;
}

/** `GET /v1/panel/records/sync`: how a sync is coming along, from the ticket it started with. */
export async function syncState(ticket: SyncTicket): Promise<SyncView> {
  const view: SyncView = {
    state: 'done',
    progress: null,
    waiting: 0,
    failedFetches: 0,
    error: null,
    fetched: null,
    recomputed: null,
    writtenAt: null,
    sites: [],
  };
  if (ticket.what === 'fetch') await fetchState(ticket, view);
  else if (ticket.what === 'recompute' && ticket.job !== null)
    await recomputeState(ticket.job, view);
  else if (ticket.what === 'send') view.writtenAt = ticket.sent === 0 ? null : ticket.at;

  view.sites = await sitesOf(ticket.tenants, view.state === 'done' ? view.writtenAt : null);
  if (view.state !== 'done') view.sites = view.sites.map((site) => ({ ...site, current: false }));
  return view;
}
