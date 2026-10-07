// The Overview page's figures (docs/admin-panel-design.md §2): the verdict first, then the day,
// then the sites. One call, because a dashboard that loads in eight requests feels like eight
// pages.
import { db } from '../storage/db.js';
import {
  aboutCheck,
  forAdmins,
  healthReport,
  sitesFound,
  SITES_CHECK,
  type About,
} from '../health.js';
import { itemCounts } from '../storage/items.js';
import { subscribers, tenants } from '../storage/connections.js';
import { openJobs } from '../jobs.js';
import { inMaintenance } from '../storage/settings.js';
import { attention, type AttentionRow } from '../attention.js';
import { namedThings, type Linked } from './things.js';
import { capital, siteNamed } from './words.js';

/** The event types the day's chart counts, in the order the legend shows them. */
export const COUNTED = ['entity.written', 'pull', 'bell', 'site.applied', 'site.failed'] as const;
export type Counted = (typeof COUNTED)[number];

export type HourRow = { hour: string } & Record<Counted, number>;

export type SiteRow = {
  id: number;
  tenantId: number;
  tenant: string;
  label: string;
  bellUrl: string;
  active: boolean;
  lastPullAt: string | null;
  lastBellAt: string | null;
  lastBellStatus: string | null;
  lastClient: string | null;
};

/** One thing that needs attention, as the Overview lists it (attention.ts), with its level (question 178). */
export type NeedsAttention = Omit<AttentionRow, 'at' | 'kind' | 'ids'> & {
  at: string;
  title: string;
};

export type Overview = {
  health: Awaited<ReturnType<typeof healthReport>>;
  /** Each check's title and the page where it is put right: the Overview never shows its name. */
  about: Record<string, About>;
  /**
   * The things a failing check names, each with its place when it has one: the sites the sites
   * check finds behind, and the connections, offices and records a check points at (things.ts).
   */
  links: Record<string, Linked[]>;
  maintenance: boolean;
  attention: NeedsAttention[];
  tenants: { total: number; active: number };
  records: { tenantId: number; datatype: string; live: number; tombstoned: number }[];
  day: { hours: HourRow[]; totals: Record<Counted, number> };
  sites: SiteRow[];
  jobs: Awaited<ReturnType<typeof openJobs>>;
};

/** Twenty-four hourly buckets ending now, so the chart never has a hole in it. */
function emptyHours(): HourRow[] {
  const start = new Date();
  start.setUTCMinutes(0, 0, 0);
  return Array.from({ length: 24 }, (_, index) => {
    const at = new Date(start.getTime() - (23 - index) * 3_600_000);
    const row = { hour: at.toISOString() } as HourRow;
    for (const type of COUNTED) row[type] = 0;
    return row;
  });
}

async function day(): Promise<Overview['day']> {
  const { rows } = await db().query<{ hour: Date; type: Counted; n: string }>(
    `select date_trunc('hour', at) as hour, type, count(*) as n
     from events
     where at >= now() - interval '24 hours' and type = any($1::text[])
     group by 1, 2`,
    [[...COUNTED]],
  );
  const hours = emptyHours();
  const at = new Map(hours.map((row) => [row.hour, row]));
  const totals = Object.fromEntries(COUNTED.map((type) => [type, 0])) as Record<Counted, number>;
  for (const row of rows) {
    const bucket = at.get(row.hour.toISOString());
    const n = Number(row.n);
    if (bucket) bucket[row.type] = n;
    totals[row.type] += n;
  }
  return { hours, totals };
}

/** What each failing check names, in words and with its place. */
async function namedLinks(health: Overview['health']): Promise<Overview['links']> {
  const links: Overview['links'] = {};
  for (const [name, check] of Object.entries(health.checks)) {
    if (check.ok || !check.names?.length) continue;
    links[name] = (await namedThings(check.names)).map((linked) => ({
      ...linked,
      label: capital(linked.label),
    }));
  }
  return links;
}

export async function overview(): Promise<Overview> {
  const [health, maintenance, needs, allTenants, counts, figures, sites, jobs] = await Promise.all([
    healthReport(),
    inMaintenance(),
    attention(),
    tenants(),
    itemCounts(),
    day(),
    subscribers(),
    openJobs(),
  ]);
  const names = new Map(allTenants.map((tenant) => [tenant.id, tenant.display_name]));
  return {
    health: forAdmins(health),
    about: Object.fromEntries(Object.keys(health.checks).map((name) => [name, aboutCheck(name)])),
    links: {
      ...(await namedLinks(health)),
      [SITES_CHECK]: (sitesFound(health.checks[SITES_CHECK]) ?? []).map((site) => ({
        label: capital(siteNamed(site.label, names.get(site.tenantId))),
        to: `/tenants/${String(site.tenantId)}#site:${String(site.id)}`,
      })),
    },
    maintenance,
    attention: needs.map((row) => ({
      key: row.key,
      id: row.id,
      at: row.at.toISOString(),
      type: row.type,
      title: row.kind.title,
      said: row.said,
      what: row.what,
      where: row.where,
      link: row.link,
      tenantId: row.tenantId,
      tenant: row.tenant,
      level: row.level,
    })),
    tenants: { total: allTenants.length, active: allTenants.filter((t) => t.active).length },
    records: counts.map((count) => ({
      tenantId: count.tenant_id,
      datatype: count.datatype,
      live: Number(count.live),
      tombstoned: Number(count.tombstoned),
    })),
    day: figures,
    sites: sites.map((site) => ({
      id: Number(site.id),
      tenantId: site.tenant_id,
      tenant: names.get(site.tenant_id) ?? String(site.tenant_id),
      label: site.label,
      bellUrl: site.bell_url,
      active: site.active,
      lastPullAt: site.last_pull_at?.toISOString() ?? null,
      lastBellAt: site.last_bell_at?.toISOString() ?? null,
      lastBellStatus: site.last_bell_status,
      lastClient: site.last_client,
    })),
    jobs,
  };
}
