// Core's configuration as it runs, read-only, and the housekeeping that otherwise waits for its
// hourly turn.
import { deleteExpiredEvents } from '../events.js';
import { purgeTombstones } from '../storage/items.js';
import { migrationsApplied } from '../storage/migrate.js';
import { tenants } from '../storage/connections.js';
import { mailConfigured } from '../mail.js';
import { card, escape, form, intro, table, yesNo } from './html.js';
import type { Panel } from './context.js';

export const settingsPanels: Panel[] = [
  {
    method: 'GET',
    pattern: /^\/admin\/settings$/,
    handle: async (ctx) => {
      const [migrations, tenantRows] = await Promise.all([migrationsApplied(), tenants()]);
      const config = ctx.config;
      const body =
        intro(
          'How this Core is set up. The values come from the environment the app runs in, so they are read-only here; an agent changes them.',
        ) +
        card(
          'Configuration',
          'Every setting, its value, and what it does.',
          table(
            ['Setting', 'Value', 'What it does'],
            [
              ['Version', escape(config.version), 'The release this app runs.'],
              [
                'Page size',
                escape(config.pageSize),
                'How many records a site gets per request when it pulls changes.',
              ],
              [
                'Bell window (ms)',
                escape(config.bellThrottleMs),
                'A site is rung at most once per window, however many changes arrive.',
              ],
              [
                'Event retention (days)',
                escape(config.eventRetentionDays),
                'How long the event log keeps an event.',
              ],
              [
                'Tombstone retention (days)',
                escape(config.tombstoneRetentionDays),
                'How long a removed record stays, so that every site can delete it too.',
              ],
              [
                'Gzip level',
                escape(config.gzipLevel),
                'How hard answers are compressed: 1 is fastest, 9 smallest.',
              ],
              [
                'Migrations applied',
                escape(migrations.join(', ')),
                'The database changes this version has made.',
              ],
              [
                'Who may log in',
                escape(
                  config.loginDomains.length > 0
                    ? `addresses at ${config.loginDomains.join(', ')}`
                    : 'nobody: ADMIN_EMAIL_DOMAINS is empty',
                ),
                'The mail domains whose addresses get a login link.',
              ],
              [
                'Login mail',
                escape(
                  mailConfigured()
                    ? `sent from ${config.mailFrom ?? 'the configured sender'}`
                    : 'no sender: set POSTMARK_SERVER_TOKEN and MAIL_FROM',
                ),
                'Where the login links come from.',
              ],
            ],
          ),
        ) +
        card(
          'Purge watermark per tenant',
          'A site whose position is below its tenant’s watermark is told to start over from the beginning. The watermark moves when a tenant is purged and loaded again.',
          table(
            ['Tenant', 'Watermark', 'Active'],
            tenantRows.map((tenant) => [
              `<code>${escape(tenant.id)}</code>`,
              escape(tenant.purge_watermark),
              yesNo(tenant.active),
            ]),
            'No tenants yet.',
          ),
        ) +
        card(
          'Housekeeping',
          'Deletes events past their retention and removed records past theirs. The worker does this every hour; this runs it now.',
          form('/admin/settings/housekeeping', ctx.csrf, '', { submit: 'Run housekeeping now' }),
        );
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
