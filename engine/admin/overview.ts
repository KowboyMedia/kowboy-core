// The dashboard, the first page after login: the numbers that say whether Core is well, drawn
// from the last 24 hours, then the health checks, the records per tenant and the latest events.
import { healthReport, type HealthReport } from '../health.js';
import { itemCounts, type ItemCount } from '../storage/items.js';
import { queryEvents } from '../events.js';
import { migrationsApplied } from '../storage/migrate.js';
import { undeliveredLifecycleEvents } from '../lifecycle.js';
import { DATATYPES } from '../adapter-api/types.js';
import { BAD, bars, columns, figure, meter, tile, tiles } from './charts.js';
import {
  bellOutcomes,
  countsSince,
  hourly,
  HOURS,
  pullTimes,
  siteFreshness,
  type Hourly,
  type SiteFreshness,
} from './stats.js';
import { card, escape, grid, intro, kv, okBad, pair, pill, table } from './html.js';
import { eventsTable } from './timeline.js';
import type { Panel } from './context.js';

/** The engine's own event types, drawn on the charts; whatever else the log holds is listed by name. */
const RECORD_TYPES = ['entity.written', 'entity.tombstoned', 'entity.dropped'] as const;
const SITE_TYPES = ['bell', 'pull', 'site.applied', 'site.failed'] as const;
const OWN_TYPES = new Set<string>([
  ...RECORD_TYPES,
  ...SITE_TYPES,
  'entity.unchanged',
  'engine.started',
]);

type Data = {
  health: HealthReport;
  counts: ItemCount[];
  since: Map<string, number>;
  records: Hourly;
  sites: Hourly;
  pulls: { pulls: number; p50: number; p95: number };
  freshness: SiteFreshness;
  waiting: number;
  bells: { total: number; failed: number };
};

async function load(): Promise<Data> {
  const [health, counts, since, records, sites, pulls, freshness, waiting, bells] =
    await Promise.all([
      healthReport(),
      itemCounts(),
      countsSince(),
      hourly(RECORD_TYPES),
      hourly(SITE_TYPES),
      pullTimes(),
      siteFreshness(),
      undeliveredLifecycleEvents(0),
      bellOutcomes(),
    ]);
  return { health, counts, since, records, sites, pulls, freshness, waiting, bells };
}

const sum = (rows: { live: string; tombstoned: string }[], key: 'live' | 'tombstoned'): number =>
  rows.reduce((total, row) => total + Number(row[key]), 0);

const allFresh = (f: SiteFreshness): boolean => f.active === 0 || f.fresh === f.active;

function sitesTile(f: SiteFreshness): string {
  const waiting = [...f.stale, ...f.never];
  const named =
    waiting.slice(0, 3).join(', ') + (waiting.length > 3 ? ` and ${waiting.length - 3} more` : '');
  const context =
    f.active === 0
      ? 'no site is attached'
      : allFresh(f)
        ? 'all pulled within the hour'
        : `waiting on ${named}`;
  return tile('Sites up to date', `${f.fresh} of ${f.active}`, {
    state: f.active === 0 ? undefined : allFresh(f) ? 'ok' : 'bad',
    context,
  });
}

/** The six figures at the top. */
function figures(d: Data): string {
  const n = (type: string): number => d.since.get(type) ?? 0;
  const checks = Object.values(d.health.checks);
  const passing = checks.filter((check) => check.ok).length;
  return tiles([
    tile('Health', d.health.ok ? 'ok' : 'failing', {
      state: d.health.ok ? 'ok' : 'bad',
      context: `${passing} of ${checks.length} checks pass`,
    }),
    tile('Live records', figure(sum(d.counts, 'live')), {
      context: `${figure(sum(d.counts, 'tombstoned'))} removed, kept 90 days`,
    }),
    tile(`Written, last ${HOURS} h`, figure(n('entity.written')), {
      context: `${figure(n('entity.unchanged'))} unchanged`,
      spark: d.records.counts.get('entity.written') ?? [],
    }),
    sitesTile(d.freshness),
    tile(`Bells, last ${HOURS} h`, figure(d.bells.total), {
      state: d.bells.failed > 0 ? 'bad' : undefined,
      context: d.bells.failed > 0 ? `${figure(d.bells.failed)} not answered` : 'all answered',
      spark: d.sites.counts.get('bell') ?? [],
    }),
    tile('Waiting for the worker', figure(d.waiting), {
      state: d.waiting > 0 ? 'warn' : 'ok',
      context: d.waiting > 0 ? 'lifecycle events queued' : 'nothing queued',
    }),
  ]);
}

/** The two charts over the last 24 hours. */
function charts(d: Data): string {
  const series = (h: Hourly, type: string): number[] => h.counts.get(type) ?? [];
  return pair([
    card(
      `Records per hour, last ${HOURS} hours`,
      'What the adapters brought in: written, removed in the CRM, or dropped because it was malformed or of an unlicensed office.',
      columns(
        d.records.labels,
        [
          { label: 'written', values: series(d.records, 'entity.written') },
          { label: 'removed', values: series(d.records, 'entity.tombstoned') },
          { label: 'dropped', values: series(d.records, 'entity.dropped'), colour: BAD },
        ],
        'Records per hour',
      ),
    ),
    card(
      `Sites per hour, last ${HOURS} hours`,
      'Bells Core rang, pages the sites pulled, and what they reported back: applied, or failed on their side.',
      columns(
        d.sites.labels,
        [
          { label: 'bells', values: series(d.sites, 'bell') },
          { label: 'pulls', values: series(d.sites, 'pull') },
          { label: 'applied', values: series(d.sites, 'site.applied') },
          { label: 'failed', values: series(d.sites, 'site.failed'), colour: BAD },
        ],
        'Sites per hour',
      ),
    ),
  ]);
}

/** Records per datatype, the sites' freshness and answer times, and everything else in the log. */
function details(d: Data): string {
  const byDatatype = DATATYPES.map((datatype) => {
    const rows = d.counts.filter((row) => row.datatype === datatype);
    return {
      label: datatype,
      value: sum(rows, 'live'),
      note: `${figure(sum(rows, 'tombstoned'))} removed`,
    };
  });
  const other = [...d.since.entries()]
    .filter(([type]) => !OWN_TYPES.has(type))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  return grid([
    card(
      'Records per datatype',
      'Live records, and how many are removed and waiting to be purged.',
      bars(byDatatype),
    ),
    card(
      'Sites',
      'Whether every active site has pulled within the hour, and how long a pull takes to answer.',
      meter(
        d.freshness.fresh,
        d.freshness.active,
        allFresh(d.freshness) ? 'ok' : 'bad',
        'pulled within the hour',
      ) +
        `<div class="mt-3">${kv([
          [`Pulls, last ${HOURS} h`, escape(figure(d.pulls.pulls))],
          ['Answer time, typical', `${escape(figure(d.pulls.p50))} ms`],
          ['Answer time, slowest 5 %', `${escape(figure(d.pulls.p95))} ms`],
        ])}</div>`,
    ),
    card(
      `Other activity, last ${HOURS} hours`,
      'Everything else in the event log by type: the adapters’ calls to their CRMs, notifications, logins, tests.',
      table(
        ['Event type', 'Count'],
        other.map(([type, count]) => [
          `<code>${escape(type)}</code>`,
          `<span class="tabular">${escape(figure(count))}</span>`,
        ]),
        'Nothing else happened.',
      ),
    ),
  ]);
}

function healthCard(health: HealthReport): string {
  const verdict = health.ok ? pill('ok', 'every check passes') : pill('bad', 'a check is failing');
  return card(
    'Health',
    'The same checks the platform and the uptime monitor read at /v1/health, live. A failing check says what is wrong. The adapters add checks of their own.',
    `<p>${verdict}</p>` +
      table(
        ['Check', 'State'],
        Object.entries(health.checks).map(([name, check]) => [
          `<code>${escape(name)}</code>`,
          okBad(check.ok, check.detail),
        ]),
      ),
  );
}

const tenantsCard = (counts: ItemCount[]): string =>
  card(
    'Records per tenant',
    'Live records are what the sites get. Tombstoned ones were removed in the CRM; they stay for 90 days so that every site can delete them too.',
    table(
      ['Tenant', 'Datatype', 'Live', 'Tombstoned'],
      counts.map((row) => [
        `<code>#${escape(row.tenant_id)}</code>`,
        escape(row.datatype),
        escape(row.live),
        escape(row.tombstoned),
      ]),
      'No records yet: add a tenant, then a connection, and load it.',
    ),
  );

export const overviewPanels: Panel[] = [
  {
    method: 'GET',
    pattern: /^\/admin$/,
    handle: async (ctx) => {
      const [d, events, migrations] = await Promise.all([
        load(),
        queryEvents({ limit: 20, newestFirst: true }),
        migrationsApplied(),
      ]);
      const body =
        intro(
          `What Core is doing right now and over the last ${HOURS} hours: whether every check passes, what came in, what the sites got, and the latest events.`,
        ) +
        figures(d) +
        charts(d) +
        details(d) +
        healthCard(d.health) +
        tenantsCard(d.counts) +
        card(
          'Latest events',
          'The 20 newest things Core and its adapters did. The Events page searches the whole log.',
          eventsTable(events),
        ) +
        `<p class="muted">Core ${escape(ctx.config.version)} · migrations applied: ${escape(migrations.join(', '))}</p>`;
      return ctx.render('Dashboard', body);
    },
  },
];
