// Settings, the adapters' pages, the try-out tools and the search behind the command palette:
// how this Core is set up (read-only, from the environment), housekeeping now, each adapter's
// directions and page with its actions, a pull as a site or a bell without leaving the browser,
// and finding a tenant or a record by what is typed.
import { gzipSync } from 'node:zlib';
import { deleteExpiredEvents } from '../events.js';
import { changesPage, purgeTombstones, searchItems } from '../storage/items.js';
import { migrationsApplied } from '../storage/migrate.js';
import { connectionsForProvider, tenants } from '../storage/connections.js';
import { mailConfigured } from '../mail.js';
import { toEnvelope, PAGE_SIZE } from '../http/changes.js';
import { ring, type BellKind } from '../bells.js';
import { RULES_VERSION } from '../rules/run.js';
import { SCHEMA_VERSION } from '../contract.js';
import { TOMBSTONE_RETENTION_DAYS, VERSION } from '../index.js';
import { DATATYPES } from '../adapter-api/types.js';
import {
  datatypeOf,
  HttpError,
  json,
  numberOf,
  stringOf,
  type Ctx,
  type Route,
} from './context.js';

const providerOf = (ctx: Ctx, provider: string) => {
  const adapter = ctx.adapters.find((candidate) => candidate.provider === provider);
  if (!adapter?.admin) throw new HttpError(404, 'no such CRM');
  return { provider: adapter.provider, admin: adapter.admin };
};

/** Every CRM Core ships, with what its panel asks for and can do. */
const providers = (ctx: Ctx) =>
  ctx.adapters
    .filter((adapter) => adapter.admin)
    .map((adapter) => ({
      provider: adapter.provider,
      credentials: adapter.admin?.credentials ?? [],
      can: {
        probe: Boolean(adapter.admin?.probe),
        inspect: Boolean(adapter.admin?.inspect),
        queue: Boolean(adapter.admin?.queue),
      },
    }));

export const settingsRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/v1\/admin\/settings$/,
    handle: async (ctx) => {
      const config = ctx.engine.config;
      const [migrations, tenantRows] = await Promise.all([migrationsApplied(), tenants()]);
      const rows = [
        { key: 'Version', value: VERSION, help: 'The release this app runs.' },
        {
          key: 'Environment',
          value: config.environment,
          help: 'What this Core is: staging, production or local (SENTRY_ENVIRONMENT).',
        },
        {
          key: 'Page size',
          value: PAGE_SIZE,
          help: 'How many records a site gets per request when it pulls changes.',
        },
        {
          key: 'Bell window',
          value: `${config.bellThrottleMs} ms`,
          help: 'A site is rung at most once per window, however many changes arrive.',
        },
        {
          key: 'Event retention',
          value: `${config.eventRetentionDays} days`,
          help: 'How long the event log keeps an event.',
        },
        {
          key: 'Tombstone retention',
          value: `${TOMBSTONE_RETENTION_DAYS} days`,
          help: 'How long a removed record stays, so that every site can delete it too.',
        },
        {
          key: 'Gzip level',
          value: config.gzipLevel,
          help: 'How hard answers are compressed: 1 is fastest, 9 smallest.',
        },
        {
          key: 'Rules version',
          value: RULES_VERSION,
          help: 'The rules ledger the display strings come from; a change recomputes stored records.',
        },
        {
          key: 'Schema version',
          value: SCHEMA_VERSION,
          help: 'The shape of the records the sites receive (schemas/).',
        },
        {
          key: 'Migrations applied',
          value: migrations.join(', '),
          help: 'The database changes this version has made.',
        },
        {
          key: 'Who may log in',
          value:
            config.adminEmailDomains.length > 0
              ? `addresses at ${config.adminEmailDomains.join(', ')}`
              : 'nobody: ADMIN_EMAIL_DOMAINS is empty',
          help: 'The mail domains whose addresses get a login link.',
        },
        {
          key: 'Login mail',
          value: mailConfigured()
            ? `sent from ${config.mailFrom ?? 'the configured sender'}`
            : 'no sender: set POSTMARK_SERVER_TOKEN and MAIL_FROM',
          help: 'Where the login links come from.',
        },
        {
          key: 'Email login',
          value: config.adminLoginWithoutEmail
            ? 'PAUSED for maintenance: an allowed address logs in from the form, no mailed link'
            : 'normal: a link is mailed',
          help: 'Whether the mailed login link is temporarily bypassed (ADMIN_LOGIN_WITHOUT_EMAIL).',
        },
        {
          key: 'Public URL',
          value: config.publicUrl ?? 'not set',
          help: 'Where this Core is reached, for the links in alerts (PUBLIC_URL).',
        },
        {
          key: 'Alerts by mail',
          value: config.alertEmail
            ? mailConfigured()
              ? `to ${config.alertEmail}`
              : `to ${config.alertEmail}, but no mail sender is set`
            : 'off',
          help: 'A mail when a health check turns red, and one when it is green again (ALERT_EMAIL).',
        },
        {
          key: 'Alerts to Slack',
          value: config.alertSlackWebhookUrl ? 'on' : 'off',
          help: 'The same message to a Slack incoming webhook (ALERT_SLACK_WEBHOOK_URL).',
        },
      ];
      return json({
        settings: rows,
        providers: providers(ctx),
        startOver: tenantRows.map((tenant) => ({
          id: tenant.id,
          name: tenant.display_name,
          active: tenant.active,
          watermark: Number(tenant.purge_watermark),
        })),
      });
    },
  },
  {
    method: 'POST',
    pattern: /^\/v1\/admin\/housekeeping$/,
    handle: async (ctx) => {
      const events = await deleteExpiredEvents(ctx.engine.config.eventRetentionDays);
      const tombstones = await purgeTombstones(TOMBSTONE_RETENTION_DAYS);
      await ctx.audit('housekeeping', { events, tombstones });
      return json({ events, tombstones });
    },
  },
  {
    method: 'GET',
    pattern: /^\/v1\/admin\/providers$/,
    handle: async (ctx) => json({ providers: providers(ctx) }),
  },
  {
    method: 'GET',
    pattern: /^\/v1\/admin\/providers\/([^/]+)$/,
    handle: async (ctx) => {
      const { provider, admin } = providerOf(ctx, ctx.params[0] ?? '');
      return json({
        provider,
        credentials: admin.credentials,
        directions: admin.directions(),
        sections: await admin.panel(await connectionsForProvider(provider)),
      });
    },
  },
  {
    method: 'POST',
    pattern: /^\/v1\/admin\/providers\/([^/]+)\/actions$/,
    handle: async (ctx) => {
      const { provider, admin } = providerOf(ctx, ctx.params[0] ?? '');
      const body = ctx.body<{ action?: string; params?: Record<string, unknown> }>();
      const action = stringOf(body.action);
      if (!action) throw new HttpError(400, 'an action is needed');
      const params = Object.fromEntries(
        Object.entries(body.params ?? {}).map(([key, value]) => [key, String(value ?? '')]),
      );
      const result = await admin.act(action, params, await connectionsForProvider(provider));
      await ctx.audit(`${provider}.${action}`, { params });
      return json(result);
    },
  },
  {
    // What a site gets from GET /v1/changes, with the size plain and gzipped. Nothing is logged as a pull.
    method: 'POST',
    pattern: /^\/v1\/admin\/try\/changes$/,
    handle: async (ctx) => {
      const body = ctx.body<{
        tenantId?: unknown;
        datatype?: unknown;
        after?: unknown;
        limit?: unknown;
      }>();
      const tenantId = numberOf(body.tenantId);
      const datatype = datatypeOf(body.datatype);
      if (!tenantId || !datatype) {
        throw new HttpError(400, `a tenantId and a datatype (${DATATYPES.join(', ')}) are needed`);
      }
      const after = Math.max(0, Number(body.after ?? 0)) || 0;
      const limit = Math.min(numberOf(body.limit) ?? PAGE_SIZE, PAGE_SIZE);
      const items = (await changesPage({ tenantId, datatype, after, limit })).map(toEnvelope);
      const answer = {
        items,
        next_after: items.length > 0 ? items[items.length - 1]?.['seq'] : after,
        has_more: items.length === limit,
      };
      const plain = Buffer.from(JSON.stringify(answer), 'utf8');
      await ctx.audit(
        'try.changes',
        { tenant: tenantId, datatype, after, items: items.length },
        { tenantId },
      );
      return json({
        ...answer,
        bytes: plain.length,
        gzipBytes: gzipSync(plain, { level: ctx.engine.config.gzipLevel }).length,
      });
    },
  },
  {
    method: 'POST',
    pattern: /^\/v1\/admin\/try\/bell$/,
    handle: async (ctx) => {
      const body = ctx.body<{ tenantId?: unknown; kind?: unknown }>();
      const tenantId = numberOf(body.tenantId);
      if (!tenantId) throw new HttpError(400, 'a tenantId is needed');
      const kind: BellKind = body.kind === 'forcerefresh' ? 'forcerefresh' : 'delta';
      await ring(tenantId, kind);
      await ctx.audit('bell.ring', { tenant: tenantId, kind }, { tenantId });
      return json({ ok: true }, 202);
    },
  },
  {
    // The command palette: tenants by name or number, records by id.
    method: 'GET',
    pattern: /^\/v1\/admin\/search$/,
    handle: async (ctx) => {
      const q = stringOf(ctx.request.query.get('q'));
      if (!q) return json({ tenants: [], records: [] });
      const needle = q.toLowerCase();
      const [tenantRows, records] = await Promise.all([
        tenants(),
        searchItems({ remoteId: q, size: 10 }),
      ]);
      return json({
        tenants: tenantRows
          .filter(
            (tenant) =>
              tenant.display_name.toLowerCase().includes(needle) ||
              String(tenant.id) === needle.replace(/^#/, ''),
          )
          .slice(0, 10)
          .map((tenant) => ({ id: tenant.id, name: tenant.display_name, active: tenant.active })),
        records: records.rows.map((row) => ({
          tenant_id: row.tenant_id,
          connection_id: row.connection_id,
          datatype: row.datatype,
          remote_id: row.remote_id,
          deleted: row.deleted,
        })),
      });
    },
  },
];
