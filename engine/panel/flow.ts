// The Flow (the tenant mockups, images 22 to 27): what the CRMs have listed for Core to fetch, from
// queued to written in Core and fetched by the websites, the newest 100, read again every second.
// Three sources, none of them new: each CRM's code's own fetch list (`queue`, with `queueCount` for
// the totals), the event log's writes, and each website's last fetch. A record leaves its CRM's
// list once it is fetched, and its queued time with it, so a record already written shows when it
// was written. Core keeps nothing new for this. The engine names no CRM: the reasons and the
// errors are the CRM's code's own words.
import { db } from '../storage/db.js';
import { connectionsForProvider } from '../storage/connections.js';
import { report } from '../errors.js';
import { adminFor } from '../registry.js';
import type {
  AdminQueueCount,
  AdminQueued,
  AdminThing,
  Connection,
  Datatype,
} from '../adapter-api/types.js';
import { recordNames, type Tenant } from './inbox.js';

/** The most rows the Flow lists. */
export const FLOW_ROWS = 100;

/** Where a website stands with a record Core wrote. */
export type FlowSite = {
  label: string;
  /** It fetched since the write; not yet; its tenant is off. */
  state: 'fetched' | 'waiting' | 'off';
  /** Its last fetch, when it fetched since the write. */
  at: string | null;
};

export type FlowRow = {
  key: string;
  /** When its CRM's code queued it; null once written, as the CRM's list no longer has it. */
  queuedAt: string | null;
  /** When Core wrote it; null while it is on its CRM's list. */
  writtenAt: string | null;
  /** On the list and not tried yet, failed and tried again later, given up, or written. */
  state: 'waiting' | 'failed' | 'given-up' | 'written';
  datatype: Datatype;
  /** The CRM's id for it. */
  id: string;
  /** Its address or name, where Core holds it. */
  name: string | null;
  tenant: Tenant;
  /** Its office by name, else the CRM's id for it; null for a record of no office. */
  office: string | null;
  /** Why its CRM's code queued it, in the code's words. */
  why: string | null;
  attempts: number;
  nextAt: string | null;
  lastError: string | null;
  /** Each of the tenant's websites, for a written record. */
  sites: FlowSite[];
};

/** An office to filter by: `<connection>:<office>`, as the filter sends it back. */
export type FlowOffice = { key: string; name: string; tenant: number };

export type Flow = {
  now: string;
  /** Every tenant and every office, for the filters. */
  tenants: Tenant[];
  offices: FlowOffice[];
  /** On the CRMs' lists in the filters' scope, not only among the rows. */
  waiting: number;
  failed: number;
  rows: FlowRow[];
};

/** An empty list means every one. */
export type FlowFilter = { tenants: number[]; offices: string[] };

const officeKey = (connection: string, office: string): string => `${connection}:${office}`;

type Facts = {
  tenants: Map<number, { name: string; active: boolean }>;
  connections: Map<string, { tenantId: number; provider: string }>;
  sites: Map<number, { label: string; lastFetchAt: Date | null }[]>;
  offices: (FlowOffice & { connection: string; id: string })[];
};

async function facts(): Promise<Facts> {
  const [tenants, connections, sites, offices] = await Promise.all([
    db().query<{ id: number; display_name: string; active: boolean }>(
      'select id, display_name, active from tenants order by lower(display_name), id',
    ),
    db().query<{ id: string; tenant_id: number; provider: string }>(
      'select id, tenant_id, provider from connections order by id',
    ),
    db().query<{ tenant_id: number; label: string; last_pull_at: Date | null }>(
      'select tenant_id, label, last_pull_at from subscribers order by id',
    ),
    db().query<{
      connection_id: string;
      tenant_id: number;
      remote_id: string;
      name: string | null;
    }>(
      `select connection_id, tenant_id, remote_id, data->>'name' as name from items
       where datatype = 'office' and not deleted
       order by lower(coalesce(data->>'name', remote_id)), connection_id`,
    ),
  ]);
  const siteMap = new Map<number, { label: string; lastFetchAt: Date | null }[]>();
  for (const site of sites.rows) {
    const id = Number(site.tenant_id);
    siteMap.set(id, [
      ...(siteMap.get(id) ?? []),
      { label: site.label, lastFetchAt: site.last_pull_at },
    ]);
  }
  return {
    tenants: new Map(
      tenants.rows.map((row) => [Number(row.id), { name: row.display_name, active: row.active }]),
    ),
    connections: new Map(
      connections.rows.map((row) => [
        row.id,
        { tenantId: Number(row.tenant_id), provider: row.provider },
      ]),
    ),
    sites: siteMap,
    offices: offices.rows.map((row) => ({
      key: officeKey(row.connection_id, row.remote_id),
      name: row.name ?? row.remote_id,
      tenant: Number(row.tenant_id),
      connection: row.connection_id,
      id: row.remote_id,
    })),
  };
}

/** The connections the filters keep: those of the chosen tenants that hold a chosen office. */
function chosenConnections(known: Facts, filter: FlowFilter): Set<string> {
  const offices = new Set(filter.offices);
  const withOffice = new Set(
    known.offices.filter((office) => offices.has(office.key)).map((office) => office.connection),
  );
  const chosen = new Set<string>();
  for (const [id, connection] of known.connections) {
    if (filter.tenants.length > 0 && !filter.tenants.includes(connection.tenantId)) continue;
    if (offices.size > 0 && !withOffice.has(id)) continue;
    chosen.add(id);
  }
  return chosen;
}

/** Where each of a tenant's websites stands with a record written at `at`. */
function sitesFor(known: Facts, tenantId: number, at: Date): FlowSite[] {
  const tenant = known.tenants.get(tenantId);
  return (known.sites.get(tenantId) ?? []).map((site) => {
    if (site.lastFetchAt && site.lastFetchAt >= at) {
      return { label: site.label, state: 'fetched', at: site.lastFetchAt.toISOString() };
    }
    if (tenant && !tenant.active) return { label: site.label, state: 'off', at: null };
    return { label: site.label, state: 'waiting', at: null };
  });
}

/** Where a record on a CRM's list stands, from what the list says of it. */
function standing(queued: AdminQueued): FlowRow['state'] {
  if (queued.attempts === 0) return 'waiting';
  return queued.nextAt ? 'failed' : 'given-up';
}

type Listed = { rows: AdminQueued[]; counts: AdminQueueCount };

/** One CRM's list and its totals for the chosen connections; nothing when its code has no list. */
async function listOf(
  provider: string,
  connections: Connection[],
  offices: string[],
): Promise<Listed> {
  const admin = adminFor(provider);
  if (!admin?.queue) return { rows: [], counts: { waiting: 0, failed: 0 } };
  try {
    const rows = await admin.queue(connections);
    const counts = admin.queueCount
      ? await admin.queueCount(connections, offices.length > 0 ? { officeIds: offices } : {})
      : {
          waiting: rows.filter((row) => standing(row) === 'waiting').length,
          failed: rows.filter((row) => standing(row) !== 'waiting').length,
        };
    return { rows, counts };
  } catch (error) {
    report(error, { where: 'panel flow', provider });
    return { rows: [], counts: { waiting: 0, failed: 0 } };
  }
}

/** Every CRM's list for the chosen connections, kept to the chosen offices, with the totals. */
async function lists(known: Facts, chosen: Set<string>, filter: FlowFilter): Promise<Listed> {
  const byProvider = new Map<string, Connection[]>();
  for (const id of chosen) {
    const provider = known.connections.get(id)?.provider;
    if (provider && !byProvider.has(provider)) {
      byProvider.set(
        provider,
        (await connectionsForProvider(provider)).filter((one) => chosen.has(one.id)),
      );
    }
  }
  const offices = new Set(filter.offices);
  const officeIds = [...new Set(known.offices.filter((o) => offices.has(o.key)).map((o) => o.id))];
  const all: Listed = { rows: [], counts: { waiting: 0, failed: 0 } };
  for (const [provider, connections] of byProvider) {
    const listed = await listOf(provider, connections, officeIds);
    all.rows.push(
      ...listed.rows.filter(
        (row) =>
          row.connectionId !== null &&
          chosen.has(row.connectionId) &&
          (offices.size === 0 || offices.has(officeKey(row.connectionId, row.officeId))),
      ),
    );
    all.counts.waiting += listed.counts.waiting;
    all.counts.failed += listed.counts.failed;
  }
  return all;
}

type Written = {
  id: string;
  at: Date;
  tenant_id: number;
  connection_id: string;
  datatype: Datatype;
  remote_id: string;
  office_id: string | null;
};

/** The newest records Core wrote from the chosen connections and offices; a recompute is not one. */
async function written(chosen: Set<string>, filter: FlowFilter): Promise<Written[]> {
  if (chosen.size === 0) return [];
  const { rows } = await db().query<Written>(
    `select e.id, e.at, e.tenant_id, e.connection_id, e.datatype, e.remote_id, i.office_id
     from events e
     left join items i on i.tenant_id = e.tenant_id and i.connection_id = e.connection_id
       and i.datatype = e.datatype and i.remote_id = e.remote_id
     where e.type = 'entity.written' and coalesce(e.fields->>'cause', '') <> 'recompute'
       and e.connection_id = any($1::text[])
       and ($2::text[] = '{}' or e.connection_id || ':' || i.office_id = any($2::text[]))
     order by e.id desc limit $3`,
    [[...chosen], filter.offices, FLOW_ROWS],
  );
  return rows;
}

/** The names Core holds of the records and offices the rows name. */
async function namesOf(queued: AdminQueued[], rows: Written[]): Promise<Map<string, string>> {
  const things: AdminThing[] = [
    ...queued.flatMap((one) =>
      one.connectionId
        ? [
            { connection: one.connectionId, record: { datatype: one.datatype, id: one.remoteId } },
            { connection: one.connectionId, office: one.officeId },
          ]
        : [],
    ),
    ...rows.flatMap((one) => [
      { connection: one.connection_id, record: { datatype: one.datatype, id: one.remote_id } },
      ...(one.office_id ? [{ connection: one.connection_id, office: one.office_id }] : []),
    ]),
  ];
  return recordNames(things);
}

/** `GET /v1/panel/flow`: the newest records on the CRMs' lists and written in Core. */
export async function flow(filter: FlowFilter): Promise<Flow> {
  const known = await facts();
  const chosen = chosenConnections(known, filter);
  const [listed, done] = await Promise.all([lists(known, chosen, filter), written(chosen, filter)]);
  const names = await namesOf(listed.rows, done);
  const named = (connection: string, datatype: string, id: string): string | null =>
    names.get(`${connection} ${datatype} ${id}`) ?? null;
  const tenantOf = (connection: string): Tenant => {
    const id = known.connections.get(connection)?.tenantId ?? 0;
    return { id, name: known.tenants.get(id)?.name ?? '' };
  };
  const onList: FlowRow[] = listed.rows.map((one) => {
    const connection = one.connectionId ?? '';
    return {
      key: `listed ${connection} ${one.datatype} ${one.remoteId}`,
      queuedAt: one.queuedAt,
      writtenAt: null,
      state: standing(one),
      datatype: one.datatype,
      id: one.remoteId,
      name: named(connection, one.datatype, one.remoteId),
      tenant: tenantOf(connection),
      office: named(connection, 'office', one.officeId) ?? one.officeId,
      why: one.reason || null,
      attempts: one.attempts,
      nextAt: one.nextAt,
      lastError: one.lastError,
      sites: [],
    };
  });
  const wrote: FlowRow[] = done.map((one) => ({
    key: `written ${one.id}`,
    queuedAt: null,
    writtenAt: one.at.toISOString(),
    state: 'written',
    datatype: one.datatype,
    id: one.remote_id,
    name: named(one.connection_id, one.datatype, one.remote_id),
    tenant: tenantOf(one.connection_id),
    office: one.office_id
      ? (named(one.connection_id, 'office', one.office_id) ?? one.office_id)
      : null,
    why: null,
    attempts: 0,
    nextAt: null,
    lastError: null,
    sites: sitesFor(known, Number(one.tenant_id), one.at),
  }));
  const time = (row: FlowRow): number => Date.parse(row.queuedAt ?? row.writtenAt ?? '') || 0;
  return {
    now: new Date().toISOString(),
    tenants: [...known.tenants].map(([id, tenant]) => ({ id, name: tenant.name })),
    offices: known.offices.map(({ key, name, tenant }) => ({ key, name, tenant })),
    waiting: listed.counts.waiting,
    failed: listed.counts.failed,
    rows: [...onList, ...wrote].sort((a, b) => time(b) - time(a)).slice(0, FLOW_ROWS),
  };
}
