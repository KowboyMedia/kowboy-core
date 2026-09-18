// The test panel: run a request and see the answer, as a site would, or as an operator would,
// without leaving the browser. CRM requests live on the adapters' own panels.
import { gzipSync } from 'node:zlib';
import { changesPage } from '../storage/items.js';
import { toEnvelope } from '../http/changes.js';
import { connections, tenants } from '../storage/connections.js';
import { queueLifecycle } from '../lifecycle.js';
import { recompute } from '../recompute.js';
import { ring, type BellKind } from '../bells.js';
import { logEvent } from '../events.js';
import { DATATYPES, type Datatype, type LifecycleEvent } from '../adapter-api/types.js';
import { escape, field, form, link, pre, select } from './html.js';
import { officesOf, type Ctx, type Panel } from './context.js';

const datatypeOf = (value: string | undefined): Datatype | undefined =>
  DATATYPES.find((candidate) => candidate === value);

async function page(
  ctx: Ctx,
  result?: { title: string; html: string },
): Promise<ReturnType<Ctx['render']>> {
  const [tenantRows, connectionRows] = await Promise.all([tenants(), connections()]);
  const tenantChoices = tenantRows.map((tenant) => ({ value: tenant.id }));
  const connectionChoices = connectionRows.map((row) => ({ value: row.id }));
  const datatypes = DATATYPES.map((d) => ({ value: d }));
  const anyDatatype = [{ value: '', label: 'all' }, ...datatypes];
  const shown = result ? `<h2>${escape(result.title)}</h2>${result.html}` : '';
  const adapters = ctx.adapters
    .filter((adapter) => adapter.admin)
    .map((adapter) => link(`/admin/${adapter.provider}`, adapter.provider))
    .join(', ');
  const body =
    shown +
    '<div class="columns"><div><h2>As a site: GET /v1/changes</h2>' +
    form(
      '/admin/test/changes',
      ctx.csrf,
      select('tenant', 'Tenant', tenantChoices) +
        select('datatype', 'Datatype', datatypes) +
        field('after', 'After seq', { type: 'number', value: '0' }) +
        field('limit', 'Limit', { type: 'number', value: String(ctx.config.pageSize) }),
      { submit: 'Pull' },
    ) +
    '</div><div><h2>Ring a bell</h2>' +
    form(
      '/admin/test/bell',
      ctx.csrf,
      select('tenant', 'Tenant', tenantChoices) +
        select('kind', 'Kind', [{ value: 'delta' }, { value: 'forcerefresh' }]),
      { submit: 'Ring' },
    ) +
    '</div><div><h2>Lifecycle event</h2>' +
    form(
      '/admin/test/event',
      ctx.csrf,
      select('connection', 'Connection', connectionChoices) +
        select(
          'event',
          'Event',
          [
            'connection_added',
            'offices_added',
            'offices_removed',
            'resync',
            'connection_removed',
          ].map((value) => ({ value })),
        ) +
        field('office_ids', 'Office ids (for offices added or removed)') +
        select('datatype', 'Datatype (for resync)', anyDatatype),
      { submit: 'Queue' },
    ) +
    '</div><div><h2>Recompute, or preview one</h2>' +
    form(
      '/admin/test/recompute',
      ctx.csrf,
      select('tenant', 'Tenant', [{ value: '', label: 'any' }, ...tenantChoices]) +
        select('connection', 'Connection', [{ value: '', label: 'any' }, ...connectionChoices]) +
        select('datatype', 'Datatype', anyDatatype) +
        select('mode', 'Mode', [
          { value: 'preview', label: 'preview (writes nothing)' },
          { value: 'write', label: 'recompute and write' },
        ]),
      { submit: 'Run' },
    ) +
    '</div></div>' +
    (adapters
      ? `<p class="muted">Requests against a CRM live on its own panel: ${adapters}.</p>`
      : '');
  return ctx.render('Test', body);
}

const bytes = (value: unknown): { plain: number; gzip: number } => {
  const plain = Buffer.from(JSON.stringify(value), 'utf8');
  return { plain: plain.length, gzip: gzipSync(plain, { level: 3 }).length };
};

export const testPanels: Panel[] = [
  { method: 'GET', pattern: /^\/admin\/test$/, handle: (ctx) => page(ctx) },
  {
    method: 'POST',
    pattern: /^\/admin\/test\/changes$/,
    handle: async (ctx) => {
      const tenantId = ctx.form['tenant'] ?? '';
      const datatype = datatypeOf(ctx.form['datatype']);
      if (!tenantId || !datatype)
        return page(ctx, {
          title: 'Pull',
          html: '<p class="bad">A tenant and a datatype are needed.</p>',
        });
      const after = Math.max(0, Number(ctx.form['after'] ?? 0) || 0);
      const limit = Math.min(
        Math.max(1, Number(ctx.form['limit'] ?? ctx.config.pageSize) || ctx.config.pageSize),
        ctx.config.pageSize,
      );
      const rows = await changesPage({ tenantId, datatype, after, limit });
      const items = rows.map(toEnvelope);
      const body = {
        items,
        next_after: items.length > 0 ? rows[rows.length - 1]?.seq : after,
        has_more: items.length === limit,
      };
      const size = bytes(body);
      await logEvent({
        type: 'admin.test',
        tenantId,
        datatype,
        fields: { what: 'changes', after, limit, items: items.length },
      });
      return page(ctx, {
        title: `GET /v1/changes?datatype=${datatype}&after=${after}&limit=${limit} as ${tenantId}`,
        html: `<p>${items.length} item(s) · ${escape(size.plain)} bytes plain, ${escape(size.gzip)} bytes gzipped</p>${pre(body)}`,
      });
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/test\/bell$/,
    handle: async (ctx) => {
      const tenantId = ctx.form['tenant'] ?? '';
      const kind: BellKind = ctx.form['kind'] === 'forcerefresh' ? 'forcerefresh' : 'delta';
      await ring(tenantId, kind);
      await logEvent({ type: 'admin.test', tenantId, fields: { what: 'bell', kind } });
      return page(ctx, {
        title: 'Bell',
        html: `<p>Rang ${escape(kind)} for ${escape(tenantId)}; the sites' pulls show up under Tenants and sites.</p>`,
      });
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/test\/event$/,
    handle: async (ctx) => {
      const connectionId = ctx.form['connection'] ?? '';
      const event = ctx.form['event'] as LifecycleEvent['type'];
      const queued = await queueLifecycle(connectionId, event, {
        officeIds: officesOf(ctx.form['office_ids'] ?? ''),
        datatype: datatypeOf(ctx.form['datatype']),
      });
      await logEvent({
        type: 'admin.test',
        connectionId,
        fields: { what: 'event', event, queued },
      });
      return page(ctx, {
        title: 'Lifecycle event',
        html:
          queued === null
            ? '<p class="bad">No such connection.</p>'
            : `<p>Queued as ${escape(queued)}; the worker delivers it within seconds.</p>`,
      });
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/test\/recompute$/,
    handle: async (ctx) => {
      const dryRun = ctx.form['mode'] !== 'write';
      const scope = {
        tenantId: ctx.form['tenant'] || undefined,
        connectionId: ctx.form['connection'] || undefined,
        datatype: datatypeOf(ctx.form['datatype']),
      };
      const report = await recompute(scope, { dryRun });
      await logEvent({
        type: 'admin.test',
        tenantId: scope.tenantId,
        connectionId: scope.connectionId,
        fields: {
          what: dryRun ? 'preview' : 'recompute',
          ...report,
          failures: undefined,
          examples: undefined,
        },
      });
      return page(ctx, {
        title: dryRun ? 'Preview (nothing written)' : 'Recompute',
        html: pre(report),
      });
    },
  },
];
