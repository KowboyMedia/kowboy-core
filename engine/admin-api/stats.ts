// The numbers the panel shows, read from the event log, the items and the sites. Every function
// is one or two queries; the routes compose them. Times are moments (ISO, UTC); the app formats.
import { db } from '../storage/db.js';

/** The window the dashboard and the figures look back over. */
export const HOURS = 24;

const window = (hours: number): string => `${hours} hours`;

/** Event counts by type over the window. */
export async function countsSince(hours = HOURS): Promise<Record<string, number>> {
  const { rows } = await db().query<{ type: string; n: string }>(
    `select type, count(*) as n from events where at > now() - $1::interval group by type`,
    [window(hours)],
  );
  return Object.fromEntries(rows.map((row) => [row.type, Number(row.n)]));
}

export type Hourly = { hours: string[]; series: Record<string, number[]> };

/** Per-hour counts of the given types over the window; the hours are their starts, oldest first. */
export async function hourly(types: readonly string[], hours = HOURS): Promise<Hourly> {
  const { rows } = await db().query<{ hour: Date; type: string; n: string }>(
    `select date_trunc('hour', at) as hour, type, count(*) as n
     from events
     where type = any($1::text[]) and at >= date_trunc('hour', now()) - $2::interval
     group by 1, 2`,
    [types, window(hours - 1)],
  );
  const start = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000 - (hours - 1) * 3_600_000);
  const labels = Array.from({ length: hours }, (_, i) =>
    new Date(start.getTime() + i * 3_600_000).toISOString(),
  );
  const series: Record<string, number[]> = Object.fromEntries(
    types.map((type) => [type, labels.map(() => 0)]),
  );
  for (const row of rows) {
    const index = Math.round((row.hour.getTime() - start.getTime()) / 3_600_000);
    const values = series[row.type];
    if (values && index >= 0 && index < hours) values[index] = Number(row.n);
  }
  return { hours: labels, series };
}

/** Pulls over the window and how long they took to answer: typical, and the slowest 5 %. */
export async function pullTimes(
  hours = HOURS,
): Promise<{ pulls: number; p50: number; p95: number }> {
  const { rows } = await db().query<{ n: string; p50: string | null; p95: string | null }>(
    `select count(*) as n,
            percentile_cont(0.5) within group (order by (fields->>'duration_ms')::numeric) as p50,
            percentile_cont(0.95) within group (order by (fields->>'duration_ms')::numeric) as p95
     from events where type = 'pull' and at > now() - $1::interval`,
    [window(hours)],
  );
  const row = rows[0];
  return {
    pulls: Number(row?.n ?? 0),
    p50: Math.round(Number(row?.p50 ?? 0)),
    p95: Math.round(Number(row?.p95 ?? 0)),
  };
}

export type SiteFreshness = {
  active: number;
  fresh: number;
  /** Active sites that have not pulled within the hour, or ever. */
  waiting: { id: string; tenant_id: number; label: string; last_pull_at: Date | null }[];
};

/** Whether every active site has pulled within the hour. */
export async function siteFreshness(): Promise<SiteFreshness> {
  const { rows } = await db().query<{
    id: string;
    tenant_id: number;
    label: string;
    last_pull_at: Date | null;
  }>('select id, tenant_id, label, last_pull_at from subscribers where active order by id');
  const limit = Date.now() - 3_600_000;
  const waiting = rows.filter((row) => !row.last_pull_at || row.last_pull_at.getTime() < limit);
  return { active: rows.length, fresh: rows.length - waiting.length, waiting };
}

/** Bells over the window, and how many were not answered. */
export async function bellOutcomes(hours = HOURS): Promise<{ total: number; failed: number }> {
  const { rows } = await db().query<{ total: string; failed: string }>(
    `select count(*) as total, count(*) filter (where fields->>'status' <> 'ok') as failed
     from events where type = 'bell' and at > now() - $1::interval`,
    [window(hours)],
  );
  return { total: Number(rows[0]?.total ?? 0), failed: Number(rows[0]?.failed ?? 0) };
}

export type ActivityRow = {
  id: string;
  at: Date;
  type: string;
  tenant_id: number | null;
  connection_id: string | null;
  datatype: string | null;
  remote_id: string | null;
  correlation_id: string | null;
  fields: Record<string, unknown>;
  office_id: string | null;
  /** What a site reported about this write since, if anything. */
  site_type: string | null;
  site_at: Date | null;
  site_fields: Record<string, unknown> | null;
};

/** The last records through the write path, newest first, with what the sites reported since. */
export async function writePath(limit = 100): Promise<ActivityRow[]> {
  const { rows } = await db().query<ActivityRow>(
    `select e.id, e.at, e.type, e.tenant_id, e.connection_id, e.datatype, e.remote_id,
            e.correlation_id, e.fields, i.office_id, s.type as site_type, s.at as site_at,
            s.fields as site_fields
     from events e
     left join items i on i.connection_id = e.connection_id and i.datatype = e.datatype
                      and i.remote_id = e.remote_id
     left join lateral (
       select type, at, fields from events s
       where s.connection_id = e.connection_id and s.datatype = e.datatype
         and s.remote_id = e.remote_id and s.type in ('site.applied', 'site.failed') and s.id > e.id
       order by s.id desc limit 1) s on true
     where e.type in ('entity.written', 'entity.tombstoned', 'entity.dropped')
     order by e.id desc limit $1`,
    [limit],
  );
  return rows;
}

export type ItemFigures = {
  live: number;
  tombstoned: number;
  written: number;
  removed: number;
  dropped: number;
  unchanged: number;
  applied: number;
  failed: number;
};

/** The records figures: what exists, and what happened over the window. */
export async function itemFigures(hours = HOURS): Promise<ItemFigures> {
  const [items, since] = await Promise.all([
    db().query<{ live: string; tombstoned: string }>(
      'select count(*) filter (where not deleted) as live, count(*) filter (where deleted) as tombstoned from items',
    ),
    countsSince(hours),
  ]);
  return {
    live: Number(items.rows[0]?.live ?? 0),
    tombstoned: Number(items.rows[0]?.tombstoned ?? 0),
    written: since['entity.written'] ?? 0,
    removed: since['entity.tombstoned'] ?? 0,
    dropped: since['entity.dropped'] ?? 0,
    unchanged: since['entity.unchanged'] ?? 0,
    applied: since['site.applied'] ?? 0,
    failed: since['site.failed'] ?? 0,
  };
}

export type SiteOutcome = { datatype: string; applied: number; failed: number };

/**
 * Per datatype, the records a tenant's sites reported: how many were applied, and how many
 * failed at their latest report, with those failures named. Only what the log still holds.
 */
export async function siteOutcomes(tenantId: number): Promise<{
  outcomes: SiteOutcome[];
  failures: {
    datatype: string;
    remote_id: string;
    at: Date;
    detail: string | null;
    client: string | null;
  }[];
}> {
  const { rows } = await db().query<{
    datatype: string;
    remote_id: string;
    type: string;
    at: Date;
    fields: Record<string, unknown>;
  }>(
    `select distinct on (connection_id, datatype, remote_id) datatype, remote_id, type, at, fields
     from events
     where tenant_id = $1 and type in ('site.applied', 'site.failed')
     order by connection_id, datatype, remote_id, id desc`,
    [tenantId],
  );
  const byDatatype = new Map<string, SiteOutcome>();
  const failures: {
    datatype: string;
    remote_id: string;
    at: Date;
    detail: string | null;
    client: string | null;
  }[] = [];
  for (const row of rows) {
    const outcome = byDatatype.get(row.datatype) ?? {
      datatype: row.datatype,
      applied: 0,
      failed: 0,
    };
    if (row.type === 'site.applied') outcome.applied += 1;
    else {
      outcome.failed += 1;
      failures.push({
        datatype: row.datatype,
        remote_id: row.remote_id,
        at: row.at,
        detail: (row.fields['detail'] as string | undefined) ?? null,
        client: (row.fields['client'] as string | undefined) ?? null,
      });
    }
    byDatatype.set(row.datatype, outcome);
  }
  failures.sort((a, b) => b.at.getTime() - a.at.getTime());
  return { outcomes: [...byDatatype.values()], failures: failures.slice(0, 50) };
}

export type Checklist = {
  /** Per site: when its bell was first answered, or null. */
  bells: Record<string, string | null>;
  /** When the tenant's token first pulled, and when a site first reported an applied record. */
  firstPull: string | null;
  firstApplied: string | null;
};

/** The setup steps a tenant's sites have passed, from the log and the sites' rows. */
export async function checklist(tenantId: number): Promise<Checklist> {
  const [bells, firsts] = await Promise.all([
    db().query<{ subscriber_id: string; answered: Date | null }>(
      `select subscriber_id, min(at) filter (where fields->>'status' = 'ok') as answered
       from events where tenant_id = $1 and type = 'bell' group by subscriber_id`,
      [tenantId],
    ),
    db().query<{ pull: Date | null; applied: Date | null }>(
      `select min(at) filter (where type = 'pull') as pull,
              min(at) filter (where type = 'site.applied') as applied
       from events where tenant_id = $1`,
      [tenantId],
    ),
  ]);
  return {
    bells: Object.fromEntries(
      bells.rows.map((row) => [row.subscriber_id, row.answered?.toISOString() ?? null]),
    ),
    firstPull: firsts.rows[0]?.pull?.toISOString() ?? null,
    firstApplied: firsts.rows[0]?.applied?.toISOString() ?? null,
  };
}

export type LoadProgress = {
  /** The latest load handed to the adapter, and what it was. */
  startedAt: string;
  event: string;
  written: number;
  unchanged: number;
  dropped: number;
  removed: number;
};

/** What the latest load of a connection has brought in so far. */
export async function loadProgress(connectionId: string): Promise<LoadProgress | null> {
  const { rows } = await db().query<{ at: Date; type: string }>(
    `select at, type from events
     where connection_id = $1 and type in ('lifecycle.connection_added', 'lifecycle.offices_added', 'lifecycle.resync', 'lifecycle.refetch')
     order by id desc limit 1`,
    [connectionId],
  );
  const load = rows[0];
  if (!load) return null;
  const { rows: counts } = await db().query<{ type: string; n: string }>(
    `select type, count(*) as n from events
     where connection_id = $1 and at >= $2 and type like 'entity.%' group by type`,
    [connectionId, load.at],
  );
  const n = (type: string): number => Number(counts.find((row) => row.type === type)?.n ?? 0);
  return {
    startedAt: load.at.toISOString(),
    event: load.type.replace('lifecycle.', ''),
    written: n('entity.written'),
    unchanged: n('entity.unchanged'),
    dropped: n('entity.dropped'),
    removed: n('entity.tombstoned'),
  };
}
