// "Reload all data" on a brokerage's page (design B, images 39 and 40; rows 105 and 106): each of
// the brokerage's connections fetches everything from its CRM again, which removes what the CRM no
// longer lists, and then its websites reload everything. The panel follows it until every website
// has, and says what the fetch removed. The fetch is the CRM's code's own (the lifecycle event
// `resync`); the rebuild is Core's (reload.ts). No CRM is named here.
import { db } from '../storage/db.js';
import { tenantById } from '../storage/connections.js';
import { queueLifecycle } from '../lifecycle.js';
import { rebuildAfterFetch, rebuildSites } from '../reload.js';
import { mapperFor } from '../registry.js';
import type { Datatype } from '../adapter-api/types.js';
import { crmName } from './inbox.js';

/** A record the reload removed because its CRM no longer lists it. */
export type Removed = {
  datatype: Datatype;
  /** The CRM, by name. */
  crm: string;
  /** Its address ("Kopparbergsvägen 8, Västerås") or name, or null when Core cannot tell. */
  name: string | null;
  /** The CRM's id for it. */
  id: string;
};

export type ReloadView = {
  startedAt: string;
  /** Fetching from the CRMs, the websites rebuilding, or done. */
  state: 'fetching' | 'rebuilding' | 'done';
  /** When the last website began its reload, or the fetch ended when there was none. */
  doneAt: string | null;
  /**
   * Why a CRM's code could not finish its fetch, in its own words; the websites reloaded what Core
   * holds. Null when every fetch finished.
   */
  failure: string | null;
  /** What was removed, the first of them; `removedCount` counts them all. */
  removed: Removed[];
  removedCount: number;
  /** Each website, and when it began to fetch everything again. */
  sites: { label: string; reloadedAt: string | null }[];
};

/** How many removed records the page names. */
const NAMED = 20;

/** A reload is shown on the brokerage's page for a day. */
const SHOWN_HOURS = 24;

/**
 * Start a reload of a brokerage: a full fetch of each of its connections. With none, its websites
 * are told to reload at once. A reload still fetching is not started twice. False: no brokerage.
 */
export async function startReload(tenantId: number, by: string): Promise<boolean> {
  if (!(await tenantById(tenantId))) return false;
  const { rows: running } = await db().query(
    'select id from reloads where tenant_id = $1 and rebuilt_at is null',
    [tenantId],
  );
  if (running.length > 0) return true;
  const { rows } = await db().query<{ id: string }>(
    'insert into reloads (tenant_id, requested_by) values ($1, $2) returning id',
    [tenantId, by],
  );
  const reload = rows[0]?.id;
  const { rows: connections } = await db().query<{ id: string }>(
    'select id from connections where tenant_id = $1 order by id',
    [tenantId],
  );
  const events: number[] = [];
  for (const connection of connections) {
    const event = await queueLifecycle(connection.id, 'resync');
    if (event !== null) events.push(event);
  }
  if (events.length === 0) {
    await db().query('update reloads set rebuilt_at = now() where id = $1', [reload]);
    await rebuildSites(tenantId);
    return true;
  }
  await db().query('update reloads set events = $2 where id = $1', [reload, events]);
  // A worker quick enough to finish every fetch before the reload knew of them leaves the
  // rebuild to this call.
  for (const event of events) await rebuildAfterFetch(event);
  return true;
}

/** The fetches' errors as a person reads them: without the error's type, one line, short. */
const failureOf = (error: string): string =>
  error
    .replace(/(^|; )\w*Error: /g, '$1')
    .replace(/\s+/g, ' ')
    .slice(0, 300)
    .replace(/[\s.;]+$/, '')
    .trim();

type ReloadRow = {
  id: string;
  started_at: Date;
  rebuilt_at: Date | null;
  error: string | null;
};

/** The brokerage's latest reload of the last day, as its page follows it; null when none. */
export async function reloadOf(tenantId: number): Promise<ReloadView | null> {
  const { rows } = await db().query<ReloadRow & { active: boolean }>(
    `select r.id, r.started_at, r.rebuilt_at, r.error, t.active
     from reloads r join tenants t on t.id = r.tenant_id
     where r.tenant_id = $1 and r.started_at >= now() - ($2 || ' hours')::interval
     order by r.id desc limit 1`,
    [tenantId, SHOWN_HOURS],
  );
  const reload = rows[0];
  if (!reload) return null;
  const [removed, sites] = await Promise.all([
    removedBy(tenantId, reload),
    sitesAfter(tenantId, reload.rebuilt_at),
  ]);
  const reloaded = sites.every((site) => site.reloadedAt !== null);
  const done = reload.rebuilt_at !== null && (reloaded || !reload.active);
  const last = sites
    .map((site) => site.reloadedAt ?? '')
    .sort()
    .at(-1);
  return {
    startedAt: reload.started_at.toISOString(),
    state: reload.rebuilt_at === null ? 'fetching' : done ? 'done' : 'rebuilding',
    doneAt: done ? last || (reload.rebuilt_at?.toISOString() ?? null) : null,
    failure: reload.error === null ? null : failureOf(reload.error),
    removed: removed.named,
    removedCount: removed.count,
    sites,
  };
}

/** The records of the brokerage removed while the reload fetched, named from their stored payload. */
async function removedBy(
  tenantId: number,
  reload: ReloadRow,
): Promise<{ named: Removed[]; count: number }> {
  const { rows } = await db().query<{
    provider: string;
    datatype: Datatype;
    remote_id: string;
    raw: unknown;
    total: string;
  }>(
    `select c.provider, i.datatype, i.remote_id, i.raw, count(*) over () as total
     from items i join connections c on c.id = i.connection_id
     where i.tenant_id = $1 and i.deleted
       and i.tombstoned_at >= $2 and i.tombstoned_at <= coalesce($3, now())
     order by i.tombstoned_at, i.seq
     limit $4`,
    [tenantId, reload.started_at, reload.rebuilt_at, NAMED],
  );
  return {
    named: rows.map((row) => ({
      datatype: row.datatype,
      crm: crmName(row.provider),
      name: nameOf(row.provider, row.datatype, row.raw),
      id: row.remote_id,
    })),
    count: Number(rows[0]?.total ?? 0),
  };
}

/**
 * A removed record's address or name. Core keeps no unified copy of a removed record, so it maps
 * the stored payload again with the CRM's own mapper, as a recompute does.
 */
function nameOf(provider: string, datatype: Datatype, raw: unknown): string | null {
  const mapper = mapperFor(provider, datatype);
  if (!mapper || raw === null || raw === undefined) return null;
  try {
    const data = mapper(raw).data as {
      address?: { street?: string | null; city?: string | null } | null;
      name?: unknown;
    };
    const address = [data.address?.street, data.address?.city].filter(Boolean).join(', ');
    return address || (typeof data.name === 'string' && data.name ? data.name : null);
  } catch {
    return null;
  }
}

/** Each website of the brokerage, with its first fetch from the start since it was told to reload. */
async function sitesAfter(
  tenantId: number,
  rebuiltAt: Date | null,
): Promise<{ label: string; reloadedAt: string | null }[]> {
  const { rows } = await db().query<{ label: string; reloaded_at: Date | null }>(
    `select s.label,
       (select min(e.at) from events e
        where e.type = 'pull' and e.subscriber_id = s.id and $2::timestamptz is not null
          and e.at >= $2 and e.fields->>'after' = '0') as reloaded_at
     from subscribers s where s.tenant_id = $1 order by s.id`,
    [tenantId, rebuiltAt],
  );
  return rows.map((row) => ({
    label: row.label,
    reloadedAt: row.reloaded_at ? row.reloaded_at.toISOString() : null,
  }));
}
