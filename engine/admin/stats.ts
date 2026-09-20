// The numbers behind the dashboard and the Items page, read from the event log, the items and the
// subscribers with a handful of queries. Everything here is the engine's own: the event types it
// writes itself, and whatever else is in the log counted by name without knowing what it means.
import { db } from '../storage/db.js';
import { TIME_ZONE } from './html.js';

/** How far back the dashboard looks. */
export const HOURS = 24;

/** The event types the engine writes on a record's way through (ingest.ts, recompute.ts). */
export const WRITE_PATH = [
  'entity.written',
  'entity.unchanged',
  'entity.tombstoned',
  'entity.dropped',
] as const;

/** Every event type with its count since `hours` ago. */
export async function countsSince(hours = HOURS): Promise<Map<string, number>> {
  const { rows } = await db().query<{ type: string; n: string }>(
    `select type, count(*) as n from events
     where at >= now() - ($1 || ' hours')::interval group by type`,
    [String(hours)],
  );
  return new Map(rows.map((row) => [row.type, Number(row.n)]));
}

export type Hourly = { labels: string[]; counts: Map<string, number[]> };

/**
 * Counts per whole hour for the given types, oldest hour first, the current hour last. The
 * labels are the hours' starts in Swedish time.
 */
export async function hourly(types: readonly string[], hours = HOURS): Promise<Hourly> {
  const { rows } = await db().query<{ type: string; ago: number; n: string }>(
    `select type, floor(extract(epoch from (now() - at)) / 3600)::int as ago, count(*) as n
     from events
     where at >= now() - ($1 || ' hours')::interval and type = any($2::text[])
     group by type, ago`,
    [String(hours), [...types]],
  );
  const counts = new Map<string, number[]>(
    types.map((type) => [type, new Array<number>(hours).fill(0)]),
  );
  for (const row of rows) {
    const bucket = hours - 1 - row.ago;
    const series = counts.get(row.type);
    if (series && bucket >= 0 && bucket < hours) series[bucket] = Number(row.n);
  }
  const clock = new Intl.DateTimeFormat('sv-SE', { timeZone: TIME_ZONE, hour: '2-digit' });
  const now = Date.now();
  const labels = Array.from({ length: hours }, (_, i) =>
    clock.format(new Date(now - (hours - 1 - i) * 3_600_000)),
  );
  return { labels, counts };
}

/** How long the sites' pulls took, in milliseconds, over the window. */
export async function pullTimes(
  hours = HOURS,
): Promise<{ pulls: number; p50: number; p95: number }> {
  const { rows } = await db().query<{ pulls: string; p50: string | null; p95: string | null }>(
    `select count(*) as pulls,
            percentile_cont(0.5) within group (order by (fields->>'duration_ms')::numeric) as p50,
            percentile_cont(0.95) within group (order by (fields->>'duration_ms')::numeric) as p95
     from events where type = 'pull' and at >= now() - ($1 || ' hours')::interval`,
    [String(hours)],
  );
  const row = rows[0];
  return {
    pulls: Number(row?.pulls ?? 0),
    p50: Math.round(Number(row?.p50 ?? 0)),
    p95: Math.round(Number(row?.p95 ?? 0)),
  };
}

/** Bells rung over the window, and how many the sites did not answer with 2xx. */
export async function bellOutcomes(hours = HOURS): Promise<{ total: number; failed: number }> {
  const { rows } = await db().query<{ total: string; failed: string }>(
    `select count(*) as total, count(*) filter (where fields->>'status' <> 'ok') as failed
     from events where type = 'bell' and at >= now() - ($1 || ' hours')::interval`,
    [String(hours)],
  );
  return { total: Number(rows[0]?.total ?? 0), failed: Number(rows[0]?.failed ?? 0) };
}

export type SiteFreshness = { active: number; fresh: number; stale: string[]; never: string[] };

/** Active sites, and which of them pulled within the last hour. */
export async function siteFreshness(): Promise<SiteFreshness> {
  const { rows } = await db().query<{ label: string; fresh: boolean; never: boolean }>(
    `select label,
            last_pull_at >= now() - interval '1 hour' as fresh,
            last_pull_at is null as never
     from subscribers where active = true order by label`,
  );
  return {
    active: rows.length,
    fresh: rows.filter((row) => row.fresh).length,
    stale: rows.filter((row) => !row.fresh && !row.never).map((row) => row.label),
    never: rows.filter((row) => row.never).map((row) => row.label),
  };
}

export type ActivityRow = {
  at: Date;
  type: string;
  correlation_id: string | null;
  tenant_id: number | null;
  connection_id: string;
  datatype: string;
  remote_id: string;
  office_id: string | null;
  fields: Record<string, unknown>;
  /** The latest word from a site about this write, if any: applied or failed, by whom, when. */
  site_type: string | null;
  site_at: Date | null;
  site_client: string | null;
  site_detail: string | null;
};

/**
 * The last records through the write path, newest first: written, unchanged, removed or dropped,
 * each with the latest report a site made about it afterwards.
 */
export async function activity(limit = 100): Promise<ActivityRow[]> {
  const { rows } = await db().query<ActivityRow>(
    `select e.at, e.type, e.correlation_id, e.tenant_id, e.connection_id, e.datatype, e.remote_id,
            e.fields, i.office_id,
            s.type as site_type, s.at as site_at, s.fields->>'client' as site_client,
            s.fields->>'detail' as site_detail
     from events e
     left join items i on i.connection_id = e.connection_id and i.datatype = e.datatype
                       and i.remote_id = e.remote_id
     left join lateral (
       select type, at, fields from events s
       where s.connection_id = e.connection_id and s.datatype = e.datatype
         and s.remote_id = e.remote_id and s.type in ('site.applied', 'site.failed')
         and s.at >= e.at
       order by s.at desc limit 1) s on true
     where e.type = any($1::text[]) and e.remote_id is not null
     order by e.at desc, e.ctid desc
     limit $2`,
    [[...WRITE_PATH], limit],
  );
  return rows;
}
