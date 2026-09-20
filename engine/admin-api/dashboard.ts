// The dashboard: whether Core is well, what came in and what the sites got over the last 24
// hours, per hour and per datatype, and the latest events. The app draws the charts; this hands
// it the numbers.
import { healthReport } from '../health.js';
import { itemCounts } from '../storage/items.js';
import { queryEvents } from '../events.js';
import { migrationsApplied } from '../storage/migrate.js';
import { undeliveredLifecycleEvents } from '../lifecycle.js';
import { openJobs } from '../jobs.js';
import { RULES_VERSION } from '../rules/run.js';
import { SCHEMA_VERSION } from '../contract.js';
import { DATATYPES } from '../adapter-api/types.js';
import { bellOutcomes, countsSince, hourly, HOURS, pullTimes, siteFreshness } from './stats.js';
import { jobView } from './jobs.js';
import { json, type Route } from './context.js';

/** The engine's own event types, drawn on the charts; whatever else the log holds is listed by name. */
export const RECORD_TYPES = ['entity.written', 'entity.tombstoned', 'entity.dropped'] as const;
export const SITE_TYPES = ['bell', 'pull', 'site.applied', 'site.failed'] as const;
const OWN_TYPES = new Set<string>([
  ...RECORD_TYPES,
  ...SITE_TYPES,
  'entity.unchanged',
  'engine.started',
]);

export const dashboardRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/v1\/admin\/dashboard$/,
    handle: async (ctx) => {
      const [
        health,
        counts,
        since,
        records,
        sites,
        pulls,
        freshness,
        waiting,
        bells,
        jobs,
        events,
        migrations,
      ] = await Promise.all([
        healthReport(),
        itemCounts(),
        countsSince(),
        hourly(RECORD_TYPES),
        hourly(SITE_TYPES),
        pullTimes(),
        siteFreshness(),
        undeliveredLifecycleEvents(0),
        bellOutcomes(),
        openJobs(),
        queryEvents({ limit: 20, newestFirst: true }),
        migrationsApplied(),
      ]);
      const sum = (datatype: string | null, key: 'live' | 'tombstoned'): number =>
        counts
          .filter((row) => datatype === null || row.datatype === datatype)
          .reduce((total, row) => total + Number(row[key]), 0);
      return json({
        hours: HOURS,
        health,
        figures: {
          live: sum(null, 'live'),
          tombstoned: sum(null, 'tombstoned'),
          written: since['entity.written'] ?? 0,
          unchanged: since['entity.unchanged'] ?? 0,
          bells: bells.total,
          bellsFailed: bells.failed,
          waiting,
          jobs: jobs.length,
        },
        sites: freshness,
        pulls,
        charts: { records, sites },
        perDatatype: DATATYPES.map((datatype) => ({
          datatype,
          live: sum(datatype, 'live'),
          tombstoned: sum(datatype, 'tombstoned'),
        })),
        perTenant: counts.map((row) => ({
          tenant_id: row.tenant_id,
          datatype: row.datatype,
          live: Number(row.live),
          tombstoned: Number(row.tombstoned),
        })),
        other: Object.entries(since)
          .filter(([type]) => !OWN_TYPES.has(type))
          .sort((a, b) => b[1] - a[1])
          .map(([type, count]) => ({ type, count })),
        jobs: jobs.map(jobView),
        events,
        version: ctx.engine.config.environment === 'local' ? 'local' : undefined,
        about: {
          environment: ctx.engine.config.environment,
          migrations,
          rulesVersion: RULES_VERSION,
          schemaVersion: SCHEMA_VERSION,
        },
      });
    },
  },
  {
    // The health checks with their names, as strategy §8.1 names it; 200 whatever they say.
    method: 'GET',
    pattern: /^\/v1\/admin\/health$/,
    handle: async () => json(await healthReport()),
  },
];
