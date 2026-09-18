// Tenants and their sites (subscribers): the same writes scripts/tenant.ts does, from a page.
// A token or a bell secret is shown once, on the page that created it, never stored in the clear.
import {
  addSubscriber,
  subscribers,
  tenants,
  updateSubscriber,
  updateTenant,
  upsertTenant,
  type SubscriberRow,
  type TenantRow,
} from '../storage/connections.js';
import { newSecret } from '../storage/crypto.js';
import { ring, type BellKind } from '../bells.js';
import { escape, field, form, pre, select, table, when } from './html.js';
import type { Ctx, Panel } from './context.js';

type Shown = { label: string; value: string };

const ID = /^[a-z0-9_-]{1,64}$/;

function tenantRows(ctx: Ctx, rows: TenantRow[], sites: SubscriberRow[]): string {
  return table(
    ['Tenant', 'Name', 'Active', 'Sites', 'Actions'],
    rows.map((tenant) => [
      `<code>${escape(tenant.id)}</code>`,
      escape(tenant.display_name),
      escape(tenant.active ? 'yes' : 'no'),
      escape(sites.filter((site) => site.tenant_id === tenant.id).length),
      form(
        `/admin/tenants/${encodeURIComponent(tenant.id)}`,
        ctx.csrf,
        field('name', 'Name', { value: tenant.display_name }) +
          select(
            'active',
            'Active',
            [{ value: 'yes' }, { value: 'no' }],
            tenant.active ? 'yes' : 'no',
          ),
        { submit: 'Save' },
      ) +
        form(`/admin/tenants/${encodeURIComponent(tenant.id)}/token`, ctx.csrf, '', {
          submit: 'New token',
          inline: true,
        }),
    ]),
    'No tenants yet.',
  );
}

function siteRows(ctx: Ctx, sites: SubscriberRow[]): string {
  const bell = (site: SubscriberRow, kind: BellKind): string =>
    form(`/admin/sites/${site.id}/ring`, ctx.csrf, '', {
      submit: `Ring ${kind}`,
      inline: true,
      hidden: { tenant: site.tenant_id, kind },
    });
  return table(
    ['Site', 'Tenant', 'Bell URL', 'Active', 'Last pull', 'Last bell', 'Actions'],
    sites.map((site) => [
      escape(site.label),
      `<code>${escape(site.tenant_id)}</code>`,
      escape(site.bell_url),
      escape(site.active ? 'yes' : 'no'),
      `${when(site.last_pull_at)} <span class="muted">${escape(site.last_client ?? '')}</span>`,
      `${when(site.last_bell_at)} <span class="muted">${escape(site.last_bell_status ?? '')}</span>`,
      bell(site, 'delta') +
        bell(site, 'forcerefresh') +
        form(`/admin/sites/${site.id}/secret`, ctx.csrf, '', {
          submit: 'New bell secret',
          inline: true,
        }) +
        form(
          `/admin/sites/${site.id}`,
          ctx.csrf,
          field('label', 'Label', { value: site.label }) +
            field('url', 'Bell URL', { value: site.bell_url }) +
            select(
              'active',
              'Active',
              [{ value: 'yes' }, { value: 'no' }],
              site.active ? 'yes' : 'no',
            ),
          { submit: 'Save' },
        ),
    ]),
    'No sites yet.',
  );
}

async function render(
  ctx: Ctx,
  flash?: string | null,
  shown?: Shown,
): Promise<ReturnType<Ctx['render']>> {
  const [rows, sites] = await Promise.all([tenants(), subscribers()]);
  const once = shown
    ? `<div class="flash"><strong>${escape(shown.label)}</strong>: this is shown once.${pre(shown.value)}</div>`
    : '';
  const body =
    once +
    '<h2>Tenants</h2>' +
    tenantRows(ctx, rows, sites) +
    form(
      '/admin/tenants',
      ctx.csrf,
      field('id', 'New tenant id (letters, digits, - and _)', { required: true }) +
        field('name', 'Name', { required: true }),
      { submit: 'Add tenant' },
    ) +
    '<h2>Sites</h2>' +
    siteRows(ctx, sites) +
    form(
      '/admin/sites',
      ctx.csrf,
      select(
        'tenant',
        'Tenant',
        rows.map((tenant) => ({ value: tenant.id })),
      ) +
        field('label', 'Label', { required: true }) +
        field('url', 'Bell URL', {
          required: true,
          placeholder: 'https://site.example/wp-json/core/v1/bell',
        }),
      { submit: 'Add site' },
    );
  return ctx.render('Tenants and sites', body, flash);
}

const yes = (value: string | undefined): boolean => value === 'yes';

export const tenantPanels: Panel[] = [
  { method: 'GET', pattern: /^\/admin\/tenants$/, handle: (ctx) => render(ctx) },
  {
    method: 'POST',
    pattern: /^\/admin\/tenants$/,
    handle: async (ctx) => {
      const id = ctx.form['id'] ?? '';
      const name = ctx.form['name'] ?? '';
      if (!ID.test(id) || !name)
        return render(ctx, '!A tenant needs an id like acme-1 and a name.');
      if ((await tenants()).some((tenant) => tenant.id === id)) {
        return render(ctx, `!There is already a tenant ${id}.`);
      }
      const token = newSecret();
      await upsertTenant({ id, displayName: name, token });
      return render(ctx, `Tenant ${id} created.`, { label: `Token for ${id}`, value: token });
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/tenants\/([^/]+)\/token$/,
    handle: async (ctx) => {
      const id = ctx.params[0] ?? '';
      const token = newSecret();
      await updateTenant(id, { token });
      return render(ctx, `New token for ${id}; the old one stops working now.`, {
        label: `Token for ${id}`,
        value: token,
      });
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/tenants\/([^/]+)$/,
    handle: async (ctx) => {
      const id = ctx.params[0] ?? '';
      await updateTenant(id, {
        displayName: ctx.form['name'] || undefined,
        active: yes(ctx.form['active']),
      });
      return ctx.redirect('/admin/tenants', `Tenant ${id} saved.`);
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/sites$/,
    handle: async (ctx) => {
      const tenantId = ctx.form['tenant'] ?? '';
      const label = ctx.form['label'] ?? '';
      const bellUrl = ctx.form['url'] ?? '';
      if (!tenantId || !label || !/^https?:\/\//.test(bellUrl)) {
        return render(ctx, '!A site needs a tenant, a label and a bell URL.');
      }
      const bellSecret = newSecret();
      const id = await addSubscriber({ tenantId, label, bellUrl, bellSecret });
      return render(ctx, `Site ${label} added.`, {
        label: `Bell secret for site ${id}`,
        value: bellSecret,
      });
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/sites\/(\d+)\/ring$/,
    handle: async (ctx) => {
      const kind: BellKind = ctx.form['kind'] === 'forcerefresh' ? 'forcerefresh' : 'delta';
      await ring(ctx.form['tenant'] ?? '', kind);
      return ctx.redirect('/admin/tenants', `Rang ${kind} for tenant ${ctx.form['tenant'] ?? ''}.`);
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/sites\/(\d+)\/secret$/,
    handle: async (ctx) => {
      const id = Number(ctx.params[0]);
      const bellSecret = newSecret();
      await updateSubscriber(id, { bellSecret });
      return render(ctx, `New bell secret for site ${id}; give it to the site.`, {
        label: `Bell secret for site ${id}`,
        value: bellSecret,
      });
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/sites\/(\d+)$/,
    handle: async (ctx) => {
      const id = Number(ctx.params[0]);
      await updateSubscriber(id, {
        label: ctx.form['label'] || undefined,
        bellUrl: ctx.form['url'] || undefined,
        active: yes(ctx.form['active']),
      });
      return ctx.redirect('/admin/tenants', `Site ${id} saved.`);
    },
  },
];
