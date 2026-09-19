// The first page after login: health, counts, the latest events, the version.
import { healthReport } from '../health.js';
import { itemCounts } from '../storage/items.js';
import { queryEvents } from '../events.js';
import { migrationsApplied } from '../storage/migrate.js';
import { card, escape, intro, okBad, pill, table } from './html.js';
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
        ? pill('ok', 'every check passes')
        : pill('bad', 'a check is failing');
      const body =
        intro(
          'What Core is doing right now: whether every check passes, how many records each tenant has, and the latest events.',
        ) +
        card(
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
        ) +
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
        ) +
        card(
          'Latest events',
          'The 20 newest things Core and its adapters did. The Events page searches the whole log.',
          eventsTable(events),
        ) +
        `<p class="muted">Core ${escape(ctx.config.version)} · migrations applied: ${escape(migrations.join(', '))}</p>`;
      return ctx.render('Overview', body);
    },
  },
];
