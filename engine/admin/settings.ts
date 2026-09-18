// Core's configuration as it runs, read-only, and the housekeeping that otherwise waits for its
// hourly turn.
import { deleteExpiredEvents } from '../events.js';
import { purgeTombstones } from '../storage/items.js';
import { migrationsApplied } from '../storage/migrate.js';
import { tenants } from '../storage/connections.js';
import { escape, form, table } from './html.js';
import type { Panel } from './context.js';

export const settingsPanels: Panel[] = [
  {
    method: 'GET',
    pattern: /^\/admin\/settings$/,
    handle: async (ctx) => {
      const [migrations, tenantRows] = await Promise.all([migrationsApplied(), tenants()]);
      const config = ctx.config;
      const body =
        '<h2>Configuration (from the environment, read-only)</h2>' +
        table(
          ['Setting', 'Value'],
          [
            ['Version', escape(config.version)],
            ['Page size of /v1/changes', escape(config.pageSize)],
            ['Bell window (ms)', escape(config.bellThrottleMs)],
            ['Event retention (days)', escape(config.eventRetentionDays)],
            ['Tombstone retention (days)', escape(config.tombstoneRetentionDays)],
            ['Gzip level', escape(config.gzipLevel)],
            ['Migrations applied', escape(migrations.join(', '))],
          ],
        ) +
        '<h2>Purge watermark per tenant</h2>' +
        table(
          ['Tenant', 'Watermark', 'Active'],
          tenantRows.map((tenant) => [
            escape(tenant.id),
            escape(tenant.purge_watermark),
            escape(tenant.active ? 'yes' : 'no'),
          ]),
          'No tenants yet.',
        ) +
        '<h2>Housekeeping</h2><p class="muted">Deletes events outside the retention window and tombstones older than their retention, as the worker does every hour.</p>' +
        form('/admin/settings/housekeeping', ctx.csrf, '', { submit: 'Run housekeeping now' });
      return ctx.render('Settings', body);
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/settings\/housekeeping$/,
    handle: async (ctx) => {
      const events = await deleteExpiredEvents(ctx.config.eventRetentionDays);
      const tombstones = await purgeTombstones(ctx.config.tombstoneRetentionDays);
      return ctx.redirect(
        '/admin/settings',
        `Housekeeping done: ${events} event(s) and ${tombstones} tombstone(s) deleted.`,
      );
    },
  },
];
