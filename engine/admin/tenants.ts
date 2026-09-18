// Tenants, each with its connections and its sites (subscribers): the same writes scripts/tenant.ts
// does, from a page. Connections and sites are made on the tenant's page, never from a global list
// (Patric, 2026-09-18, question 39: the token paste stays, and everything about a customer is in one
// place). A token or a bell secret is shown once, on the page that created it, never stored in the
// clear.
import {
  addSubscriber,
  connections,
  subscribers,
  tenants,
  updateSubscriber,
  updateTenant,
  upsertTenant,
  type ConnectionListRow,
  type SubscriberRow,
  type TenantRow,
} from '../storage/connections.js';
import { newSecret } from '../storage/crypto.js';
import { ring, type BellKind } from '../bells.js';
import { addConnectionForm, connectionTable } from './connections.js';
import { card, escape, field, form, intro, link, pre, select, table, when, yesNo } from './html.js';
import type { Ctx, Panel } from './context.js';

type Shown = { label: string; value: string };

const ID = /^[a-z0-9_-]{1,64}$/;

const ACTIVE = [
  { value: 'yes', label: 'yes' },
  { value: 'no', label: 'no' },
];

const href = (id: string): string => `/admin/tenants/${encodeURIComponent(id)}`;

const tenantById = async (id: string): Promise<TenantRow | undefined> =>
  (await tenants()).find((tenant) => tenant.id === id);

function tenantRows(rows: TenantRow[], links: ConnectionListRow[], sites: SubscriberRow[]): string {
  return table(
    ['Tenant', 'Name', 'Active', 'Connections', 'Sites'],
    rows.map((tenant) => [
      link(href(tenant.id), tenant.id),
      escape(tenant.display_name),
      yesNo(tenant.active),
      escape(links.filter((row) => row.tenant_id === tenant.id).length),
      escape(sites.filter((site) => site.tenant_id === tenant.id).length),
    ]),
    'No tenants yet.',
  );
}

function siteRows(ctx: Ctx, sites: SubscriberRow[]): string {
  const bell = (site: SubscriberRow, kind: BellKind): string =>
    form(`/admin/sites/${site.id}/ring`, ctx.csrf, '', {
      submit: kind === 'delta' ? 'Ring: pull changes' : 'Ring: pull everything',
      inline: true,
      hidden: { tenant: site.tenant_id, kind },
    });
  return table(
    ['Site', 'Bell URL', 'Active', 'Last pull', 'Last bell', 'Actions'],
    sites.map((site) => [
      escape(site.label),
      escape(site.bell_url),
      yesNo(site.active),
      `${when(site.last_pull_at)} <span class="muted">${escape(site.last_client ?? '')}</span>`,
      `${when(site.last_bell_at)} <span class="muted">${escape(site.last_bell_status ?? '')}</span>`,
      bell(site, 'delta') +
        bell(site, 'forcerefresh') +
        form(`/admin/sites/${site.id}/secret`, ctx.csrf, '', {
          submit: 'New bell secret',
          inline: true,
        }) +
        `<details><summary>Edit</summary>` +
        form(
          `/admin/sites/${site.id}`,
          ctx.csrf,
          field('label', 'Label', { value: site.label }) +
            field('url', 'Bell URL', { value: site.bell_url }) +
            select(
              'active',
              'Active',
              ACTIVE,
              site.active ? 'yes' : 'no',
              'An inactive site is not rung.',
            ),
          { submit: 'Save', hidden: { tenant: site.tenant_id } },
        ) +
        '</details>',
    ]),
    'No sites yet.',
  );
}

async function listPage(ctx: Ctx, flash?: string | null): Promise<ReturnType<Ctx['render']>> {
  const [rows, links, sites] = await Promise.all([tenants(), connections(), subscribers()]);
  const body =
    intro(
      'A tenant is one customer of Kowboy. Open one for its connections (its CRM logins and offices), its sites, its token and its licence. An inactive tenant is a disabled licence: its sites get no bell and no page, and keep showing what they have.',
    ) +
    card(
      'Tenants',
      'Every tenant has one token, shown once when it is made; its sites pull with it.',
      tenantRows(rows, links, sites),
    ) +
    card(
      'Add a tenant',
      'Makes the tenant and shows its token once. Its connections and sites come next, on its page.',
      form(
        '/admin/tenants',
        ctx.csrf,
        field('id', 'Tenant id', {
          required: true,
          placeholder: 'acme',
          help: 'Short, lowercase and permanent: letters, digits, - and _. It appears in URLs and in the event log.',
        }) +
          field('name', 'Name', {
            required: true,
            help: 'The customer’s name as people say it.',
          }),
        { submit: 'Add tenant' },
      ),
    );
  return ctx.render('Tenants', body, flash);
}

async function tenantPage(
  ctx: Ctx,
  tenant: TenantRow,
  flash?: string | null,
  shown?: Shown,
): Promise<ReturnType<Ctx['render']>> {
  const [links, sites] = await Promise.all([connections(), subscribers()]);
  const own = links.filter((row) => row.tenant_id === tenant.id);
  const ownSites = sites.filter((site) => site.tenant_id === tenant.id);
  const once = shown
    ? `<div class="alert alert-important alert-success" role="alert"><strong>${escape(shown.label)}</strong>: copy it now, it is shown once and never again.${pre(shown.value)}</div>`
    : '';
  const body =
    intro(
      `Everything about ${escape(tenant.display_name)}: its licence and token, the CRM connections its records come from, and the sites that show them.`,
    ) +
    once +
    card(
      `Tenant ${escape(tenant.id)}`,
      'The name is for people; "Active" is the licence. A new token retires the old one at once and goes into every site’s settings.',
      form(
        href(tenant.id),
        ctx.csrf,
        field('name', 'Name', { value: tenant.display_name }) +
          select(
            'active',
            'Active',
            ACTIVE,
            tenant.active ? 'yes' : 'no',
            'No means a disabled licence: the sites are not rung and cannot pull, and keep what they show.',
          ),
        { submit: 'Save' },
      ) + form(`${href(tenant.id)}/token`, ctx.csrf, '', { submit: 'New token', inline: true }),
    ) +
    card(
      'Connections',
      'A connection is this tenant’s link to one CRM: which offices belong to it, and the login Core uses there. Open one to change its login or offices, to load or remove its records, and to see what its adapter knows.',
      connectionTable(own, false) +
        '<h4 class="mt-3">Add a connection</h4>' +
        addConnectionForm(ctx, tenant.id),
    ) +
    card(
      'Sites',
      'Where the bell rings: Core calls a site’s bell URL when this tenant has something new, and the site pulls with the tenant’s token. The bell secret proves it was Core that called. "Pull changes" makes the site fetch what changed since its last pull; "pull everything" makes it rewrite all it has.',
      siteRows(ctx, ownSites) +
        '<h4 class="mt-3">Add a site</h4>' +
        form(
          '/admin/sites',
          ctx.csrf,
          field('label', 'Label', {
            required: true,
            help: 'What you call this site, for these pages only.',
          }) +
            field('url', 'Bell URL', {
              required: true,
              placeholder: 'https://site.example/wp-json/core/v1/bell',
              help: 'The address Core calls when there is something new. A WordPress site with the plugin answers at /wp-json/core/v1/bell.',
            }),
          { submit: 'Add site', hidden: { tenant: tenant.id } },
        ),
    );
  return ctx.render(`Tenant ${tenant.id}`, body, flash);
}

const yes = (value: string | undefined): boolean => value === 'yes';

/** The page a site's action returns to: its tenant's. */
async function tenantOfSite(id: number): Promise<TenantRow | undefined> {
  const site = (await subscribers()).find((row) => String(row.id) === String(id));
  return site ? tenantById(site.tenant_id) : undefined;
}

export const tenantPanels: Panel[] = [
  { method: 'GET', pattern: /^\/admin\/tenants$/, handle: (ctx) => listPage(ctx) },
  {
    method: 'POST',
    pattern: /^\/admin\/tenants$/,
    handle: async (ctx) => {
      const id = ctx.form['id'] ?? '';
      const name = ctx.form['name'] ?? '';
      if (!ID.test(id) || !name)
        return listPage(ctx, '!A tenant needs an id like acme-1 and a name.');
      if (await tenantById(id)) return listPage(ctx, `!There is already a tenant ${id}.`);
      const token = newSecret();
      await upsertTenant({ id, displayName: name, token });
      const tenant = await tenantById(id);
      if (!tenant) return listPage(ctx, `!Tenant ${id} could not be read back.`);
      return tenantPage(ctx, tenant, `Tenant ${id} created.`, {
        label: `Token for ${id}`,
        value: token,
      });
    },
  },
  {
    method: 'GET',
    pattern: /^\/admin\/tenants\/([^/]+)$/,
    handle: async (ctx) => {
      const tenant = await tenantById(ctx.params[0] ?? '');
      if (!tenant) return { ...ctx.render('Not found', '<p>No such tenant.</p>'), status: 404 };
      return tenantPage(ctx, tenant);
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/tenants\/([^/]+)\/token$/,
    handle: async (ctx) => {
      const tenant = await tenantById(ctx.params[0] ?? '');
      if (!tenant) return ctx.redirect('/admin/tenants', '!No such tenant.');
      const token = newSecret();
      await updateTenant(tenant.id, { token });
      return tenantPage(ctx, tenant, `New token for ${tenant.id}; the old one stops working now.`, {
        label: `Token for ${tenant.id}`,
        value: token,
      });
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/tenants\/([^/]+)$/,
    handle: async (ctx) => {
      const id = ctx.params[0] ?? '';
      if (!(await tenantById(id))) return ctx.redirect('/admin/tenants', '!No such tenant.');
      await updateTenant(id, {
        displayName: ctx.form['name'] || undefined,
        active: yes(ctx.form['active']),
      });
      return ctx.redirect(href(id), `Tenant ${id} saved.`);
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/sites$/,
    handle: async (ctx) => {
      const tenant = await tenantById(ctx.form['tenant'] ?? '');
      if (!tenant) return ctx.redirect('/admin/tenants', '!A site needs a tenant.');
      const label = ctx.form['label'] ?? '';
      const bellUrl = ctx.form['url'] ?? '';
      if (!label || !/^https?:\/\//.test(bellUrl)) {
        return ctx.redirect(href(tenant.id), '!A site needs a label and a bell URL.');
      }
      const bellSecret = newSecret();
      const id = await addSubscriber({ tenantId: tenant.id, label, bellUrl, bellSecret });
      return tenantPage(ctx, tenant, `Site ${label} added.`, {
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
      const tenantId = ctx.form['tenant'] ?? '';
      await ring(tenantId, kind);
      return ctx.redirect(href(tenantId), `Rang ${kind} for tenant ${tenantId}.`);
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/sites\/(\d+)\/secret$/,
    handle: async (ctx) => {
      const id = Number(ctx.params[0]);
      const tenant = await tenantOfSite(id);
      if (!tenant) return ctx.redirect('/admin/tenants', '!No such site.');
      const bellSecret = newSecret();
      await updateSubscriber(id, { bellSecret });
      return tenantPage(ctx, tenant, `New bell secret for site ${id}; give it to the site.`, {
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
      const tenant = await tenantOfSite(id);
      if (!tenant) return ctx.redirect('/admin/tenants', '!No such site.');
      await updateSubscriber(id, {
        label: ctx.form['label'] || undefined,
        bellUrl: ctx.form['url'] || undefined,
        active: yes(ctx.form['active']),
      });
      return ctx.redirect(href(tenant.id), `Site ${id} saved.`);
    },
  },
];
