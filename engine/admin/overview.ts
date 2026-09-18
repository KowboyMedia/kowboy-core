// The first page after login: health, counts, the latest events, the version.
import { healthReport } from '../health.js';
import { itemCounts } from '../storage/items.js';
import { queryEvents } from '../events.js';
import { migrationsApplied } from '../storage/migrate.js';
import { escape, okBad, table } from './html.js';
import { eventsTable } from './timeline.js';
import type { Panel } from './context.js';

export const overviewPanels: Panel[] = [
  {
    method: 'GET',
    pattern: /^\/admin$/,
    handle: async (ctx) => {
      const [health, counts, events, migrations] = await Promise.all([
        healthReport(),
        itemCounts(),
        queryEvents({ limit: 20, newestFirst: true }),
        migrationsApplied(),
      ]);
      const verdict = health.ok
        ? '<span class="ok">every check passes</span>'
        : '<span class="bad">a check is failing</span>';
      const body =
        `<h2>Health: ${verdict}</h2>` +
        table(
          ['Check', 'State'],
          Object.entries(health.checks).map(([name, check]) => [
            escape(name),
            okBad(check.ok, check.detail),
          ]),
        ) +
        '<h2>Items</h2>' +
        table(
          ['Tenant', 'Datatype', 'Live', 'Tombstoned'],
          counts.map((row) => [
            escape(row.tenant_id),
            escape(row.datatype),
            escape(row.live),
            escape(row.tombstoned),
          ]),
          'No items yet.',
        ) +
        '<h2>Latest events</h2>' +
        eventsTable(events) +
        `<p class="muted">Core ${escape(ctx.config.version)} · migrations applied: ${escape(migrations.join(', '))}</p>`;
      return ctx.render('Overview', body);
    },
  },
];
