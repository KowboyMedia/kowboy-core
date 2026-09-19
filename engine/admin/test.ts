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
import { card, escape, field, form, grid, intro, json, link, select } from './html.js';
import { numberOf, officesOf, type Ctx, type Panel } from './context.js';

const datatypeOf = (value: string | undefined): Datatype | undefined =>
  DATATYPES.find((candidate) => candidate === value);

async function page(
  ctx: Ctx,
  result?: { title: string; html: string },
): Promise<ReturnType<Ctx['render']>> {
  const [tenantRows, connectionRows] = await Promise.all([tenants(), connections()]);
  const tenantChoices = tenantRows.map((tenant) => ({
    value: String(tenant.id),
    label: `#${tenant.id} ${tenant.display_name}`,
  }));
  const connectionChoices = connectionRows.map((row) => ({ value: row.id }));
  const datatypes = DATATYPES.map((d) => ({ value: d }));
  const anyDatatype = [{ value: '', label: 'all' }, ...datatypes];
  const shown = result
    ? card(result.title, 'The answer to the request just made.', result.html)
    : '';
  const adapters = ctx.adapters
    .filter((adapter) => adapter.admin)
    .map((adapter) => link(`/admin/${adapter.provider}`, adapter.provider))
    .join(', ');
  const body =
    intro(
      'Run a request against Core from here, exactly as a site or an operator would, and see the answer. Nothing here touches a CRM.',
    ) +
    shown +
    grid([
      card(
        'Pull as a site',
        'What a site gets from GET /v1/changes: the tenant’s records of one datatype after a sequence number, with the size plain and gzipped.',
        form(
          '/admin/test/changes',
          ctx.csrf,
          select('tenant', 'Tenant', tenantChoices) +
            select('datatype', 'Datatype', datatypes) +
            field('after', 'After seq', {
              type: 'number',
              value: '0',
              help: '0 is the very beginning; a site remembers where it got to.',
            }) +
            field('limit', 'Limit', { type: 'number', value: String(ctx.config.pageSize) }),
          { submit: 'Pull' },
        ),
      ),
      card(
        'Ring a bell',
        'Tells the tenant’s sites to pull now: "delta" for what changed, "forcerefresh" for everything again.',
        form(
          '/admin/test/bell',
          ctx.csrf,
          select('tenant', 'Tenant', tenantChoices) +
            select('kind', 'Kind', [{ value: 'delta' }, { value: 'forcerefresh' }]),
          { submit: 'Ring' },
        ),
      ),
      card(
        'Queue a lifecycle event',
        'The same actions as on a connection’s page, handed to the worker: load, add or remove offices, resync, remove.',
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
            field('office_ids', 'Office ids', {
              help: 'For offices added or removed; comma-separated.',
            }) +
            select('datatype', 'Datatype', anyDatatype, undefined, 'For a resync.'),
          { submit: 'Queue' },
        ),
      ),
      card(
        'Recompute, or preview one',
        'Runs the mapping and the rules again over stored raw records. A preview writes nothing and reports what would change.',
        form(
          '/admin/test/recompute',
          ctx.csrf,
          select('tenant', 'Tenant', [{ value: '', label: 'any' }, ...tenantChoices]) +
            select('connection', 'Connection', [
              { value: '', label: 'any' },
              ...connectionChoices,
            ]) +
            select('datatype', 'Datatype', anyDatatype) +
            select('mode', 'Mode', [
              { value: 'preview', label: 'preview (writes nothing)' },
              { value: 'write', label: 'recompute and write' },
            ]),
          { submit: 'Run' },
        ),
      ),
    ]) +
    (adapters
      ? `<p class="muted">Requests against a CRM live on its own page: ${adapters}.</p>`
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
      const tenantId = numberOf(ctx.form['tenant']);
      const datatype = datatypeOf(ctx.form['datatype']);
      if (tenantId === undefined || !datatype)
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
        html: `<p>${items.length} item(s) · ${escape(size.plain)} bytes plain, ${escape(size.gzip)} bytes gzipped</p>${json(body)}`,
      });
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/test\/bell$/,
    handle: async (ctx) => {
      const tenantId = numberOf(ctx.form['tenant']);
      const kind: BellKind = ctx.form['kind'] === 'forcerefresh' ? 'forcerefresh' : 'delta';
      if (tenantId === undefined) {
        return page(ctx, { title: 'Bell', html: '<p class="bad">A tenant is needed.</p>' });
      }
      await ring(tenantId, kind);
      await logEvent({ type: 'admin.test', tenantId, fields: { what: 'bell', kind } });
      return page(ctx, {
        title: 'Bell',
        html: `<p>Rang ${escape(kind)} for tenant #${escape(tenantId)}; the sites' pulls show up on the tenant's page.</p>`,
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
        tenantId: numberOf(ctx.form['tenant']),
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
        html: json(report),
      });
    },
  },
];
