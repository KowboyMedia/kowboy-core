// Tenants, each with its connections and its sites (subscribers): the same writes scripts/tenant.ts
// does, from a page. A connection or a site exists only inside its tenant (Patric, 2026-09-18 and
// 2026-09-19): both are made and listed on the tenant's page, and there is no global list of
// either. A tenant's token is shown on its page (kept recoverable, encrypted); a site's bell
// secret is shown once, when it is made, and never stored in the clear.
import {
  addSubscriber,
  connections,
  subscribers,
  tenants,
  updateSubscriber,
  updateTenant,
  createTenant,
  type ConnectionListRow,
  type SubscriberRow,
  type TenantRow,
} from '../storage/connections.js';
import { newSecret } from '../storage/crypto.js';
import { ring, type BellKind } from '../bells.js';
import { addConnectionForm, connectionTable } from './connections.js';
import {
  card,
  details,
  escape,
  field,
  form,
  grid,
  intro,
  kv,
  link,
  menu,
  pill,
  pre,
  select,
  table,
  when,
  yesNo,
} from './html.js';
import { numberOf, type Ctx, type Panel } from './context.js';

/** A secret shown once, on the page that made it (a site's bell secret). */
type Shown = { label: string; value: string };

const ACTIVE = [
  { value: 'yes', label: 'yes' },
  { value: 'no', label: 'no' },
];

const href = (id: number): string => `/admin/tenants/${id}`;

const tenantById = async (id: number | undefined): Promise<TenantRow | undefined> =>
  id === undefined ? undefined : (await tenants()).find((tenant) => tenant.id === id);

const siteById = async (id: number): Promise<SubscriberRow | undefined> =>
  (await subscribers()).find((row) => String(row.id) === String(id));

function tenantRows(rows: TenantRow[], links: ConnectionListRow[], sites: SubscriberRow[]): string {
  return table(
    ['Tenant', 'Name', 'Licence', 'Connections', 'Sites'],
    rows.map((tenant) => [
      link(href(tenant.id), `#${tenant.id}`),
      escape(tenant.display_name),
      licence(tenant),
      escape(links.filter((row) => row.tenant_id === tenant.id).length),
      escape(sites.filter((site) => site.tenant_id === tenant.id).length),
    ]),
    'No tenants yet.',
  );
}

const licence = (tenant: TenantRow): string =>
  tenant.active ? pill('ok', 'active') : pill('bad', 'disabled');

/** One row per site, with its actions in one menu (Patric, 2026-09-19: one style everywhere). */
function siteRows(ctx: Ctx, sites: SubscriberRow[]): string {
  const bell = (site: SubscriberRow, kind: BellKind, label: string): string =>
    form(`/admin/sites/${site.id}/ring`, ctx.csrf, '', {
      submit: label,
      menu: true,
      hidden: { tenant: String(site.tenant_id), kind },
    });
  return table(
    ['Site', 'Bell URL', 'Active', 'Last pull', 'Last bell', ''],
    sites.map((site) => [
      escape(site.label),
      `<code>${escape(site.bell_url)}</code>`,
      yesNo(site.active),
      `${when(site.last_pull_at)} <span class="text-secondary">${escape(site.last_client ?? '')}</span>`,
      `${when(site.last_bell_at)} <span class="text-secondary">${escape(site.last_bell_status ?? '')}</span>`,
      menu('Actions', [
        bell(site, 'delta', 'Ring: pull changes'),
        bell(site, 'forcerefresh', 'Ring: pull everything'),
        form(`/admin/sites/${site.id}/secret`, ctx.csrf, '', {
          submit: 'New bell secret',
          menu: true,
        }),
        `<a class="dropdown-item" href="/admin/sites/${site.id}/edit">Edit</a>`,
      ]),
    ]),
    'No sites yet.',
  );
}

async function listPage(ctx: Ctx, flash?: string | null): Promise<ReturnType<Ctx['render']>> {
  const [rows, links, sites] = await Promise.all([tenants(), connections(), subscribers()]);
  const body =
    intro(
      'A tenant is one customer of Kowboy. Open one for its licence and token, its connections (the CRM logins and offices its records come from) and its sites. A disabled licence stops the bells and the pulls; the sites keep showing what they have.',
    ) +
    card(
      'Tenants',
      'Every tenant has one token, shown on its page; its sites pull with it.',
      tenantRows(rows, links, sites),
    ) +
    card(
      'Add a tenant',
      'Makes the tenant, gives it a number and shows its token on its page. Its connections and sites come next, there too.',
      form(
        '/admin/tenants',
        ctx.csrf,
        field('name', 'Name', {
          required: true,
          help: 'The customer’s name as people say it. Core assigns the tenant its number.',
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
  const token = tenant.token
    ? `<code class="user-select-all">${escape(tenant.token)}</code>`
    : '<span class="text-secondary">Set before tokens were shown here; use “New token” to set and reveal one.</span>';
  const body =
    intro(
      `Everything about ${escape(tenant.display_name)}: the licence and the token its sites pull with, the CRM connections its records come from, and the sites that show them.`,
    ) +
    once +
    grid([
      card(
        'Licence and token',
        'The token goes into every site’s settings; a new one retires the old one at once.',
        kv([
          ['Tenant number', `<code>${escape(tenant.id)}</code>`],
          ['Licence', licence(tenant)],
          ['Token', token],
          ['Connections', escape(own.length)],
          ['Sites', escape(ownSites.length)],
        ]) +
          `<div class="mt-3">${form(`${href(tenant.id)}/token`, ctx.csrf, '', { submit: 'New token', inline: true })}</div>`,
      ),
      card(
        'Name and licence',
        'A disabled licence stops the bells and the pulls; the sites keep showing what they have.',
        form(
          href(tenant.id),
          ctx.csrf,
          field('name', 'Name', { value: tenant.display_name }) +
            select('active', 'Licence', ACTIVE, tenant.active ? 'yes' : 'no'),
          { submit: 'Save' },
        ),
      ),
    ]) +
    card(
      'Connections',
      'A connection is this tenant’s link to one CRM: the offices that belong to it, and the login Core uses there. Open one for its login, its offices and its loads.',
      connectionTable(own) + details('Add a connection', addConnectionForm(ctx, tenant.id)),
    ) +
    card(
      'Sites',
      'Core calls a site’s bell URL when this tenant has something new, and the site pulls with the token. The bell secret proves it was Core that called. "Pull changes" fetches what changed since the site’s last pull; "pull everything" makes it rewrite all it has.',
      siteRows(ctx, ownSites) +
        details(
          'Add a site',
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
            { submit: 'Add site', hidden: { tenant: String(tenant.id) } },
          ),
        ),
    );
  return ctx.render(tenant.display_name, body, flash);
}

function sitePage(ctx: Ctx, site: SubscriberRow): ReturnType<Ctx['render']> {
  const body =
    intro(
      `The site ${escape(site.label)} of tenant #${escape(site.tenant_id)}. Its token and bell secret are not shown here; make new ones from the tenant’s page.`,
    ) +
    card(
      'Site',
      'The label is for these pages; the bell URL is where Core calls.',
      form(
        `/admin/sites/${site.id}`,
        ctx.csrf,
        field('label', 'Label', { value: site.label, required: true }) +
          field('url', 'Bell URL', { value: site.bell_url, required: true }) +
          select(
            'active',
            'Active',
            ACTIVE,
            site.active ? 'yes' : 'no',
            'An inactive site is not rung.',
          ),
        { submit: 'Save' },
      ) + `<p class="mt-3 mb-0">${link(href(site.tenant_id), 'Back to the tenant')}</p>`,
    );
  return ctx.render(`Site ${site.label}`, body);
}

const yes = (value: string | undefined): boolean => value === 'yes';

/** The page a site's action returns to: its tenant's. */
async function tenantOfSite(id: number): Promise<TenantRow | undefined> {
  const site = await siteById(id);
  return site ? tenantById(site.tenant_id) : undefined;
}

export const tenantPanels: Panel[] = [
  { method: 'GET', pattern: /^\/admin\/tenants$/, handle: (ctx) => listPage(ctx) },
  {
    method: 'POST',
    pattern: /^\/admin\/tenants$/,
    handle: async (ctx) => {
      const name = (ctx.form['name'] ?? '').trim();
      if (!name) return listPage(ctx, '!A tenant needs a name.');
      const token = newSecret();
      const id = await createTenant({ displayName: name, token });
      const tenant = await tenantById(id);
      if (!tenant) return listPage(ctx, `!Tenant ${id} could not be read back.`);
      return tenantPage(ctx, tenant, `Tenant #${id} ${name} created. Its token is shown below.`);
    },
  },
  {
    method: 'GET',
    pattern: /^\/admin\/tenants\/(\d+)$/,
    handle: async (ctx) => {
      const tenant = await tenantById(numberOf(ctx.params[0]));
      if (!tenant) return { ...ctx.render('Not found', '<p>No such tenant.</p>'), status: 404 };
      return tenantPage(ctx, tenant);
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/tenants\/(\d+)\/token$/,
    handle: async (ctx) => {
      const tenant = await tenantById(numberOf(ctx.params[0]));
      if (!tenant) return ctx.redirect('/admin/tenants', '!No such tenant.');
      const token = newSecret();
      await updateTenant(tenant.id, { token });
      const updated = (await tenantById(tenant.id)) ?? tenant;
      return tenantPage(
        ctx,
        updated,
        `New token for ${tenant.display_name}; the old one stops working now. The new one is shown below.`,
      );
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/tenants\/(\d+)$/,
    handle: async (ctx) => {
      const id = numberOf(ctx.params[0]);
      if (id === undefined || !(await tenantById(id)))
        return ctx.redirect('/admin/tenants', '!No such tenant.');
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
      const tenant = await tenantById(numberOf(ctx.form['tenant']));
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
    method: 'GET',
    pattern: /^\/admin\/sites\/(\d+)\/edit$/,
    handle: async (ctx) => {
      const site = await siteById(Number(ctx.params[0]));
      if (!site) return { ...ctx.render('Not found', '<p>No such site.</p>'), status: 404 };
      return sitePage(ctx, site);
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/sites\/(\d+)\/ring$/,
    handle: async (ctx) => {
      const kind: BellKind = ctx.form['kind'] === 'forcerefresh' ? 'forcerefresh' : 'delta';
      const tenantId = numberOf(ctx.form['tenant']);
      if (tenantId === undefined) return ctx.redirect('/admin/tenants', '!No such tenant.');
      await ring(tenantId, kind);
      return ctx.redirect(href(tenantId), `Rang ${kind} for tenant #${tenantId}.`);
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
