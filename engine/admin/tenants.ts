// One page per tenant, for making it and for changing it (Patric, 2026-09-20, the flow as he told
// it): the name and licence, the CRM connection with the login the adapter asks for and the
// offices, and the sites, one or many; one Save. The same page, the same components and the same
// code path edit an existing tenant, and then the page also shows the token, the loads and
// actions, what the adapter knows and the latest events. Nothing about a customer is made
// anywhere else: a connection or a site exists only inside its tenant.
import {
  addSubscriber,
  connections,
  createTenant,
  subscribers,
  tenants,
  updateSubscriber,
  updateTenant,
  upsertConnection,
  type ConnectionListRow,
  type SubscriberRow,
  type TenantRow,
} from '../storage/connections.js';
import { newSecret } from '../storage/crypto.js';
import { queueLifecycle } from '../lifecycle.js';
import { ring, type BellKind } from '../bells.js';
import { credentialFields } from './adapters.js';
import { actionCards, eventsCard, statusCard } from './connections.js';
import {
  card,
  escape,
  field,
  form,
  intro,
  kv,
  link,
  pill,
  select,
  table,
  textarea,
  when,
  yesNo,
} from './html.js';
import { lists, numberOf, officesOf, type Ctx, type Panel } from './context.js';
import type { Response } from '../http/server.js';

type SiteDraft = { id: string; label: string; url: string; active: boolean };

/** What the form holds: typed in, or read from a tenant that exists. Secrets are never echoed. */
type Draft = {
  name: string;
  active: boolean;
  /** The CRM adapter, or '' for none yet. */
  provider: string;
  offices: string;
  connectionActive: boolean;
  sites: SiteDraft[];
};

type Existing = {
  tenant: TenantRow;
  connection: ConnectionListRow | undefined;
  sites: SubscriberRow[];
};

const ACTIVE = [
  { value: 'yes', label: 'yes' },
  { value: 'no', label: 'no' },
];
const EMPTY_SITE: SiteDraft = { id: '', label: '', url: '', active: true };
const href = (id: number): string => `/admin/tenants/${id}`;
const yes = (value: string | undefined): boolean => value !== 'no';

async function load(id: number): Promise<Existing | undefined> {
  const [rows, links, sites] = await Promise.all([tenants(), connections(), subscribers()]);
  const tenant = rows.find((row) => row.id === id);
  if (!tenant) return undefined;
  return {
    tenant,
    connection: links.find((row) => row.tenant_id === id),
    sites: sites.filter((site) => site.tenant_id === id),
  };
}

const draftOf = (existing: Existing | undefined): Draft =>
  existing
    ? {
        name: existing.tenant.display_name,
        active: existing.tenant.active,
        provider: existing.connection?.provider ?? '',
        offices: existing.connection?.licensed_offices.join('\n') ?? '',
        connectionActive: existing.connection?.active ?? true,
        sites: existing.sites.map((site) => ({
          id: String(site.id),
          label: site.label,
          url: site.bell_url,
          active: site.active,
        })),
      }
    : {
        name: '',
        active: true,
        provider: '',
        offices: '',
        connectionActive: true,
        sites: [EMPTY_SITE],
      };

/** The form as typed: the rows of sites come from the body with their repeats kept. */
function draftFromForm(ctx: Ctx): Draft {
  const body = lists(ctx.request);
  const ids = body.getAll('site_id');
  const urls = body.getAll('site_url');
  const actives = body.getAll('site_active');
  const provider = ctx.form['provider'] ?? '';
  return {
    name: (ctx.form['name'] ?? '').trim(),
    active: yes(ctx.form['active']),
    provider,
    offices: ctx.form[`${provider}_offices`] ?? '',
    connectionActive: yes(ctx.form[`${provider}_active`]),
    sites: body.getAll('site_label').map((label, i) => ({
      id: ids[i] ?? '',
      label: label.trim(),
      url: (urls[i] ?? '').trim(),
      active: yes(actives[i]),
    })),
  };
}

// ---- The list --------------------------------------------------------------------------------------

const licence = (tenant: TenantRow): string =>
  tenant.active ? pill('ok', 'active') : pill('bad', 'disabled');

async function listPage(ctx: Ctx): Promise<Response> {
  const [rows, links, sites] = await Promise.all([tenants(), connections(), subscribers()]);
  const body =
    intro(
      'A tenant is one customer of Kowboy: its name and licence, the CRM its records come from, and the sites that show them, all on one page. A disabled licence stops the bells and the pulls; the sites keep showing what they have.',
    ) +
    card(
      'Tenants',
      'Open one for everything about that customer, or make a new one.',
      table(
        ['Tenant', 'Name', 'Licence', 'CRM', 'Sites'],
        rows.map((tenant) => [
          link(href(tenant.id), `#${tenant.id}`),
          escape(tenant.display_name),
          licence(tenant),
          escape(
            links
              .filter((row) => row.tenant_id === tenant.id)
              .map((row) => row.provider)
              .join(', '),
          ),
          escape(sites.filter((site) => site.tenant_id === tenant.id).length),
        ]),
        'No tenants yet.',
      ) + `<a class="btn btn-primary mt-3" href="/admin/tenants/new">New tenant</a>`,
    );
  return ctx.render('Tenants', body);
}

// ---- The form: tenant, CRM connection, sites -----------------------------------------------------------

/** One CRM's panel: the login its adapter asks for, and the offices. Shown when that CRM is chosen. */
function crmPanel(ctx: Ctx, provider: string, draft: Draft, existing?: Existing): string {
  const fields = credentialFields(ctx.adapters, provider);
  const connection = existing?.connection?.provider === provider ? existing.connection : undefined;
  const login = fields
    .map((f) =>
      field(`${provider}_credential_${f.key}`, f.label, { type: f.secret ? 'password' : 'text' }),
    )
    .join('');
  const state = connection
    ? connection.has_credentials
      ? pill('ok', 'login set')
      : pill('bad', 'login missing')
    : '';
  const help =
    fields.length === 0
      ? 'This CRM needs no login.'
      : connection
        ? 'The login is stored encrypted and never shown again. Leave the fields empty to keep it, or fill in every field to replace it.'
        : 'The login this CRM issues to the customer. It is stored encrypted and never shown again.';
  return (
    `<div class="crm-panel border rounded p-3 mb-3" data-provider="${escape(provider)}">` +
    `<h4 class="mb-1">${escape(provider)} ${state}</h4><p class="text-secondary small">${escape(help)}</p>${login}` +
    textarea(
      `${provider}_offices`,
      'Offices',
      draft.provider === provider ? draft.offices : '',
      'The office ids this tenant is licensed for, one per line or comma-separated. Saving loads an added office and takes a dropped one off the sites.',
    ) +
    (connection
      ? select(
          `${provider}_active`,
          'Connection active',
          ACTIVE,
          draft.connectionActive ? 'yes' : 'no',
          'An inactive connection is left alone: nothing is fetched, and its records stay as they are.',
        )
      : '') +
    `</div>`
  );
}

function crmSection(ctx: Ctx, draft: Draft, existing?: Existing): string {
  const fixed = existing?.connection;
  const providers = ctx.adapters.map((adapter) => adapter.provider);
  const choice = fixed
    ? `<input type="hidden" name="provider" value="${escape(fixed.provider)}"><div class="mb-3"><div class="form-label">CRM</div><div>${escape(fixed.provider)} <span class="text-secondary small">connection <code>${escape(fixed.id)}</code></span></div></div>`
    : select(
        'provider',
        'CRM',
        [{ value: '', label: 'none yet' }, ...providers.map((value) => ({ value }))],
        draft.provider,
        'Choose the CRM this tenant’s records come from; its panel opens below.',
      );
  const panels = providers
    .filter((provider) => !fixed || provider === fixed.provider)
    .map((provider) => crmPanel(ctx, provider, draft, existing))
    .join('');
  return choice + panels;
}

/** A button in a site row that submits the small actions form outside the main one. */
const siteAction = (site: SubscriberRow, action: string, label: string, kind?: BellKind): string =>
  `<button type="submit" class="dropdown-item" form="site-actions" formaction="/admin/sites/${site.id}/${action}"${kind ? ` name="kind" value="${kind}"` : ''}>${escape(label)}</button>`;

function siteRow(site: SiteDraft, saved: SubscriberRow | undefined, editing: boolean): string {
  const actions = saved
    ? `<div class="dropdown"><button type="button" class="btn btn-outline-secondary btn-sm dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">Actions</button><div class="dropdown-menu">${siteAction(saved, 'ring', 'Ring: pull changes', 'delta')}${siteAction(saved, 'ring', 'Ring: pull everything', 'forcerefresh')}${siteAction(saved, 'secret', 'New bell secret')}</div></div>`
    : '';
  const secret = saved
    ? `<code class="user-select-all">${escape(saved.bell_secret)}</code>` +
      (saved.last_bell_at
        ? `<div class="text-secondary small">last bell ${when(saved.last_bell_at)} ${escape(saved.last_bell_status ?? '')}</div>`
        : '')
    : '<span class="text-secondary small">made on save</span>';
  return (
    `<tr><td><input type="hidden" name="site_id" value="${escape(site.id)}"><input class="form-control" name="site_label" value="${escape(site.label)}" placeholder="acme.se" aria-label="Site"></td>` +
    `<td><input class="form-control" name="site_url" value="${escape(site.url)}" placeholder="https://acme.se/wp-json/core/v1/bell" aria-label="Bell URL"></td>` +
    `<td><select class="form-select" name="site_active" aria-label="Active"><option value="yes"${site.active ? ' selected' : ''}>yes</option><option value="no"${site.active ? '' : ' selected'}>no</option></select></td>` +
    `<td>${secret}</td>${editing ? `<td>${actions}</td>` : ''}</tr>`
  );
}

function sitesSection(draft: Draft, existing?: Existing): string {
  const editing = existing !== undefined;
  const rows = draft.sites
    .map((site) =>
      siteRow(
        site,
        existing?.sites.find((saved) => String(saved.id) === site.id),
        editing,
      ),
    )
    .join('');
  return (
    `<div class="table-responsive"><table class="table table-vcenter"><thead><tr><th>Site</th><th>Bell URL</th><th>Active</th><th>Bell secret</th>${editing ? '<th></th>' : ''}</tr></thead><tbody id="sites">${rows}</tbody></table></div>` +
    `<button type="button" class="btn btn-outline-secondary btn-sm" id="add-site">Add another site</button>` +
    `<template id="site-row">${siteRow(EMPTY_SITE, undefined, editing)}</template>`
  );
}

/** Shows the chosen CRM's panel, and adds a site row on request. */
const FORM_SCRIPT =
  `<script>(function(){var s=document.getElementById('provider');function show(){document.querySelectorAll('.crm-panel').forEach(function(p){p.hidden=p.dataset.provider!==s.value})}` +
  `if(s){s.addEventListener('change',show);show()}var a=document.getElementById('add-site'),t=document.getElementById('site-row'),b=document.getElementById('sites');` +
  `if(a&&t&&b)a.addEventListener('click',function(){b.appendChild(t.content.cloneNode(true))})})();</script>`;

async function formPage(
  ctx: Ctx,
  draft: Draft,
  existing?: Existing,
  flash?: string | null,
): Promise<Response> {
  const tenant = existing?.tenant;
  const action = tenant ? href(tenant.id) : '/admin/tenants/new';
  const body =
    intro(
      tenant
        ? `Everything about ${tenant.display_name}: the name and licence, the CRM connection its records come from, and the sites that show them. Change what you need and save.`
        : 'A new customer in one go: the name, the CRM its records come from with the login and the offices, and the sites that show them. Save makes the tenant, loads the CRM and gives every site its bell secret.',
    ) +
    `<form method="post" action="${action}"><input type="hidden" name="csrf" value="${escape(ctx.csrf)}">` +
    card(
      'Tenant',
      'The customer’s name as people say it; Core assigns the number. A disabled licence stops the bells and the pulls.',
      field('name', 'Name', { value: draft.name, required: true }) +
        select('active', 'Licence', ACTIVE, draft.active ? 'yes' : 'no'),
    ) +
    card(
      'CRM connection',
      'Where this tenant’s records come from: the CRM, the login it issued and the offices it licenses.',
      crmSection(ctx, draft, existing),
    ) +
    card(
      'Sites',
      'The websites that show this tenant’s records, one or many. Core calls a site’s bell URL when there is something new; the site pulls with the tenant’s token and proves it is Core with the bell secret. Both go into the site’s own settings.',
      sitesSection(draft, existing),
    ) +
    `<button class="btn btn-primary">Save</button></form>` +
    (tenant
      ? `<form method="post" id="site-actions"><input type="hidden" name="csrf" value="${escape(ctx.csrf)}"><input type="hidden" name="tenant" value="${tenant.id}"></form>` +
        (await afterForm(ctx, existing))
      : '') +
    FORM_SCRIPT;
  return ctx.render(tenant ? tenant.display_name : 'New tenant', body, flash);
}

/** What only an existing tenant has: its token, the loads and actions, the adapter's view, events. */
async function afterForm(ctx: Ctx, existing: Existing): Promise<string> {
  const { tenant, connection } = existing;
  const token = tenant.token
    ? `<code class="user-select-all">${escape(tenant.token)}</code>`
    : '<span class="text-secondary">Set before tokens were shown here; “New token” sets and shows one.</span>';
  const tokenCard = card(
    'Token',
    'The token goes into every site’s settings; a new one retires the old one at once.',
    kv([
      ['Tenant number', `<code>${escape(tenant.id)}</code>`],
      ['Licence', licence(tenant)],
      ['Token', token],
    ]) +
      `<div class="mt-3">${form(`${href(tenant.id)}/token`, ctx.csrf, '', { submit: 'New token', inline: true })}</div>`,
  );
  if (!connection) return `<div class="mt-4">${tokenCard}</div>`;
  return (
    `<div class="mt-4">${tokenCard}` +
    card(
      'CRM connection: state',
      'What Core knows about the link to the CRM.',
      kv([
        ['Connection', `<code>${escape(connection.id)}</code>`],
        ['Active', yesNo(connection.active)],
        ['Login', connection.has_credentials ? pill('ok', 'set') : pill('bad', 'missing')],
        ['Last ingest', when(connection.last_ingest_at)],
        [
          'Last error',
          connection.last_error
            ? `<span class="bad">${escape(connection.last_error)}</span>`
            : '<span class="muted">none</span>',
        ],
      ]),
    ) +
    actionCards(ctx, connection) +
    (await statusCard(ctx, connection)) +
    (await eventsCard(connection)) +
    `</div>`
  );
}

// ---- Save: the one code path for a new tenant and a changed one -------------------------------------------

/** What is wrong with the CRM part of the draft, in one sentence, or null. */
function checkConnection(ctx: Ctx, draft: Draft, existing?: Existing): string | null {
  if (!draft.provider) return null;
  if (!ctx.adapters.some((adapter) => adapter.provider === draft.provider))
    return 'Choose a CRM from the list.';
  if (existing?.connection && draft.provider !== existing.connection.provider)
    return 'The CRM of an existing connection cannot change; remove everything first.';
  const fields = credentialFields(ctx.adapters, draft.provider);
  const given = fields.filter(
    (f) => (ctx.form[`${draft.provider}_credential_${f.key}`] ?? '') !== '',
  );
  return given.length > 0 && given.length < fields.length
    ? `Fill in every login field (${fields.map((f) => f.label).join(', ')}) or none.`
    : null;
}

/** A site row that is not empty needs a name and a proper bell URL. */
const checkSites = (sites: SiteDraft[]): string | null =>
  sites.some((site) => (site.label || site.url) && (!site.label || !/^https?:\/\//.test(site.url)))
    ? 'A site needs a name and a bell URL starting with http:// or https://.'
    : null;

/** What is wrong with the draft, in one sentence, or null. */
const check = (ctx: Ctx, draft: Draft, existing?: Existing): string | null =>
  (draft.name ? null : 'A tenant needs a name.') ??
  checkConnection(ctx, draft, existing) ??
  checkSites(draft.sites);

/** What the worker is asked to do after a save, in words for the flash. */
async function queueLoads(
  id: string,
  provider: string,
  login: { had: boolean; has: boolean },
  before: string[],
  offices: string[],
): Promise<string[]> {
  const notes: string[] = [];
  const added = offices.filter((office) => !before.includes(office));
  const removed = before.filter((office) => !offices.includes(office));
  if (removed.length > 0) {
    await queueLifecycle(id, 'offices_removed', { officeIds: removed });
    notes.push(`Taking office ${removed.join(', ')} off the sites.`);
  }
  if (!login.has) {
    notes.push(
      `The ${provider} login is missing, so nothing is loaded yet: add it and save again.`,
    );
  } else if (!login.had) {
    await queueLifecycle(id, 'connection_added');
    notes.push(`Loading every record of ${offices.length} office(s) from ${provider} now.`);
  } else if (added.length > 0) {
    await queueLifecycle(id, 'offices_added', { officeIds: added });
    notes.push(`Loading office ${added.join(', ')} now.`);
  }
  return notes;
}

/** The connection written and its loads queued; what happened, in words for the flash. */
async function saveConnection(
  ctx: Ctx,
  tenantId: number,
  draft: Draft,
  existing: ConnectionListRow | undefined,
): Promise<string[]> {
  const provider = draft.provider;
  const fields = credentialFields(ctx.adapters, provider);
  const values = fields.map(
    (f) => [f.key, ctx.form[`${provider}_credential_${f.key}`] ?? ''] as const,
  );
  const replaced = fields.length > 0 && values.every(([, value]) => value !== '');
  const offices = officesOf(draft.offices);
  const id = existing?.id ?? `${provider}-${tenantId}`;
  await upsertConnection({
    id,
    tenantId,
    provider,
    credentials: replaced ? JSON.stringify(Object.fromEntries(values)) : null,
    licensedOffices: offices,
    active: existing ? draft.connectionActive : true,
  });
  // "Had" a login: the connection could load before this save; "has": it can now.
  const needsLogin = fields.length > 0;
  const had = existing !== undefined && (!needsLogin || existing.has_credentials);
  const has = had || !needsLogin || replaced;
  return queueLoads(id, provider, { had, has }, existing?.licensed_offices ?? [], offices);
}

async function saveSites(tenantId: number, sites: SiteDraft[]): Promise<string[]> {
  const notes: string[] = [];
  for (const site of sites) {
    if (!site.label && !site.url) continue;
    if (site.id) {
      await updateSubscriber(Number(site.id), {
        label: site.label,
        bellUrl: site.url,
        active: site.active,
      });
    } else {
      await addSubscriber({
        tenantId,
        label: site.label,
        bellUrl: site.url,
        bellSecret: newSecret(),
      });
      if (!site.active) await updateSubscriber(await lastSiteId(tenantId), { active: false });
      notes.push(`Site ${site.label} added; its bell secret is on the page.`);
    }
  }
  return notes;
}

const lastSiteId = async (tenantId: number): Promise<number> =>
  Math.max(
    ...(await subscribers()).filter((s) => s.tenant_id === tenantId).map((s) => Number(s.id)),
  );

async function save(ctx: Ctx, id?: number): Promise<Response> {
  const existing = id === undefined ? undefined : await load(id);
  if (id !== undefined && !existing) return ctx.redirect('/admin/tenants', '!No such tenant.');
  const draft = draftFromForm(ctx);
  const problem = check(ctx, draft, existing);
  if (problem) return formPage(ctx, draft, existing, `!${problem}`);
  const tenantId = existing
    ? existing.tenant.id
    : await createTenant({ displayName: draft.name, token: newSecret() });
  if (existing) await updateTenant(tenantId, { displayName: draft.name, active: draft.active });
  const notes = draft.provider
    ? await saveConnection(ctx, tenantId, draft, existing?.connection)
    : [];
  notes.push(...(await saveSites(tenantId, draft.sites)));
  return ctx.redirect(
    href(tenantId),
    `Tenant #${tenantId} ${draft.name} saved.${notes.length ? ` ${notes.join(' ')}` : ''}`,
  );
}

/** The tenant a site belongs to, for the site's actions. */
async function tenantOfSite(id: number): Promise<number | undefined> {
  const site = (await subscribers()).find((row) => String(row.id) === String(id));
  return site?.tenant_id;
}

export const tenantPanels: Panel[] = [
  { method: 'GET', pattern: /^\/admin\/tenants$/, handle: (ctx) => listPage(ctx) },
  {
    method: 'GET',
    pattern: /^\/admin\/tenants\/new$/,
    handle: (ctx) => formPage(ctx, draftOf(undefined)),
  },
  { method: 'POST', pattern: /^\/admin\/tenants\/new$/, handle: (ctx) => save(ctx) },
  {
    method: 'GET',
    pattern: /^\/admin\/tenants\/(\d+)$/,
    handle: async (ctx) => {
      const existing = await load(Number(ctx.params[0]));
      if (!existing) return { ...ctx.render('Not found', '<p>No such tenant.</p>'), status: 404 };
      return formPage(ctx, draftOf(existing), existing);
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/tenants\/(\d+)$/,
    handle: (ctx) => save(ctx, numberOf(ctx.params[0]) ?? 0),
  },
  {
    method: 'POST',
    pattern: /^\/admin\/tenants\/(\d+)\/token$/,
    handle: async (ctx) => {
      const id = numberOf(ctx.params[0]);
      if (id === undefined || !(await load(id)))
        return ctx.redirect('/admin/tenants', '!No such tenant.');
      await updateTenant(id, { token: newSecret() });
      return ctx.redirect(href(id), 'New token; the old one stops working now. It is on the page.');
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/sites\/(\d+)\/ring$/,
    handle: async (ctx) => {
      const kind: BellKind = ctx.form['kind'] === 'forcerefresh' ? 'forcerefresh' : 'delta';
      const tenantId = await tenantOfSite(Number(ctx.params[0]));
      if (tenantId === undefined) return ctx.redirect('/admin/tenants', '!No such site.');
      await ring(tenantId, kind);
      return ctx.redirect(href(tenantId), `Rang ${kind} for tenant #${tenantId}.`);
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/sites\/(\d+)\/secret$/,
    handle: async (ctx) => {
      const id = Number(ctx.params[0]);
      const tenantId = await tenantOfSite(id);
      if (tenantId === undefined) return ctx.redirect('/admin/tenants', '!No such site.');
      await updateSubscriber(id, { bellSecret: newSecret() });
      return ctx.redirect(
        href(tenantId),
        `New bell secret for site ${id}; it is on the page. Give it to the site.`,
      );
    },
  },
  {
    // The site's own edit page is gone; the tenant's page edits every site.
    method: 'GET',
    pattern: /^\/admin\/sites\/(\d+)\/edit$/,
    handle: async (ctx) => {
      const tenantId = await tenantOfSite(Number(ctx.params[0]));
      return tenantId === undefined ? ctx.redirect('/admin/tenants') : ctx.redirect(href(tenantId));
    },
  },
];
