// Tenants (docs/admin-panel.md): the list, and one page that makes a tenant and changes it, the
// same page and code path (Patric, 2026-09-20): the name and licence, the CRM connection with
// the login the adapter declares and the offices, the sites one or many, one save. Below it:
// the token, the connection's state and actions, the sites' secrets, checklist and outcomes,
// what the adapter knows, the site's own errors, and the latest events.
import { newSecret } from '../storage/crypto.js';
import {
  addSubscriber,
  connectionById,
  connections,
  createTenant,
  deleteSubscriber,
  setConnectionActive,
  subscribers,
  tenantById,
  tenants,
  updateSubscriber,
  updateTenant,
  upsertConnection,
  type ConnectionListRow,
  type SubscriberRow,
} from '../storage/connections.js';
import { itemCounts } from '../storage/items.js';
import { queueLifecycle } from '../lifecycle.js';
import { queryEvents } from '../events.js';
import { ring, type BellKind } from '../bells.js';
import { applyRules } from '../rules/run.js';
import {
  DATATYPES,
  type AdminField,
  type Datatype,
  type LifecycleEvent,
} from '../adapter-api/types.js';
import { checklist, loadProgress, siteOutcomes } from './stats.js';
import {
  datatypeOf,
  HttpError,
  json,
  numberOf,
  stringOf,
  type AdminAdapter,
  type Ctx,
  type Route,
} from './context.js';
import type { Response } from '../http/server.js';

type SiteInput = { id?: number; label: string; url: string; active: boolean; removed?: boolean };
type ConnectionInput = {
  provider: string;
  /** The login as typed; null or empty keeps what is stored. */
  credentials: Record<string, string> | null;
  offices: string[];
  active: boolean;
};
export type TenantInput = {
  name: string;
  active: boolean;
  connection: ConnectionInput | null;
  sites: SiteInput[];
};

const CONNECTION_EVENTS: LifecycleEvent['type'][] = [
  'connection_added',
  'resync',
  'connection_removed',
];

const adapterOf = (ctx: Ctx, provider: string): AdminAdapter | undefined =>
  ctx.adapters.find((adapter) => adapter.provider === provider && adapter.admin);

const connectionOf = async (tenantId: number): Promise<ConnectionListRow | undefined> =>
  (await connections()).find((row) => row.tenant_id === tenantId);

// ---- Reading -----------------------------------------------------------------------------------

const bellUrlOk = (url: string): boolean => {
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol);
  } catch {
    return false;
  }
};

const siteView = (site: SubscriberRow, bells: Record<string, string | null>) => ({
  id: Number(site.id),
  label: site.label,
  url: site.bell_url,
  secret: site.bell_secret,
  active: site.active,
  last_bell_at: site.last_bell_at,
  last_bell_status: site.last_bell_status,
  last_pull_at: site.last_pull_at,
  last_client: site.last_client,
  /** When this site first answered a bell, which proves it holds the secret. */
  bell_answered_at: bells[site.id] ?? null,
});

/** The connection as the page shows it: its row, the adapter's view of it, and the latest load. */
async function connectionViewOf(
  ctx: Ctx,
  connection: ConnectionListRow,
): Promise<Record<string, unknown>> {
  const adapter = adapterOf(ctx, connection.provider);
  const live = await connectionById(connection.id);
  const [sections, load] = await Promise.all([
    adapter?.admin?.connection && live ? adapter.admin.connection(live) : Promise.resolve([]),
    loadProgress(connection.id),
  ]);
  return {
    id: connection.id,
    provider: connection.provider,
    has_credentials: connection.has_credentials,
    offices: connection.licensed_offices,
    active: connection.active,
    last_ingest_at: connection.last_ingest_at,
    last_error: connection.last_error,
    credentials: adapter?.admin?.credentials ?? [],
    can: { probe: Boolean(adapter?.admin?.probe), inspect: Boolean(adapter?.admin?.inspect) },
    load,
    sections,
  };
}

/** Everything the tenant's page shows. */
async function tenantView(ctx: Ctx, id: number): Promise<Record<string, unknown>> {
  const tenant = await tenantById(id);
  if (!tenant) throw new HttpError(404, 'no such tenant');
  const [connection, sites, counts, list, events, errors, outcomes] = await Promise.all([
    connectionOf(id),
    subscribers(),
    itemCounts(),
    checklist(id),
    queryEvents({ tenantId: id, limit: 20, newestFirst: true }),
    queryEvents({ tenantId: id, type: 'site.error', limit: 20, newestFirst: true }),
    siteOutcomes(id),
  ]);
  return {
    tenant: {
      id: tenant.id,
      name: tenant.display_name,
      active: tenant.active,
      token: tenant.token,
      created_at: tenant.created_at,
      purge_watermark: Number(tenant.purge_watermark),
    },
    connection: connection ? await connectionViewOf(ctx, connection) : null,
    sites: sites.filter((site) => site.tenant_id === id).map((site) => siteView(site, list.bells)),
    checklist: { first_pull_at: list.firstPull, first_applied_at: list.firstApplied },
    records: counts
      .filter((row) => row.tenant_id === id)
      .map((row) => ({
        datatype: row.datatype,
        live: Number(row.live),
        tombstoned: Number(row.tombstoned),
      })),
    outcomes: outcomes.outcomes,
    failures: outcomes.failures,
    errors,
    events,
  };
}

async function tenantList(): Promise<Record<string, unknown>[]> {
  const [rows, links, sites, counts] = await Promise.all([
    tenants(),
    connections(),
    subscribers(),
    itemCounts(),
  ]);
  return rows.map((tenant) => {
    const connection = links.find((row) => row.tenant_id === tenant.id);
    return {
      id: tenant.id,
      name: tenant.display_name,
      active: tenant.active,
      created_at: tenant.created_at,
      provider: connection?.provider ?? null,
      offices: connection?.licensed_offices.length ?? 0,
      has_credentials: connection?.has_credentials ?? false,
      last_ingest_at: connection?.last_ingest_at ?? null,
      last_error: connection?.last_error ?? null,
      sites: sites.filter((site) => site.tenant_id === tenant.id && site.active).length,
      records: counts
        .filter((row) => row.tenant_id === tenant.id)
        .reduce((total, row) => total + Number(row.live), 0),
    };
  });
}

// ---- Saving ------------------------------------------------------------------------------------

/** The body as the app sends it, shaped and trimmed; anything else is a 400. */
function inputOf(ctx: Ctx): TenantInput {
  const body = ctx.body<Record<string, unknown>>();
  const connection = body['connection'] as Record<string, unknown> | null | undefined;
  const sitesGiven = Array.isArray(body['sites'])
    ? (body['sites'] as Record<string, unknown>[])
    : [];
  const strings = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.map((item) => String(item).trim()).filter(Boolean)
      : typeof value === 'string'
        ? value
            .split(/[\s,]+/)
            .map((item) => item.trim())
            .filter(Boolean)
        : [];
  return {
    name: stringOf(body['name']) ?? '',
    active: body['active'] !== false,
    connection:
      connection && stringOf(connection['provider'])
        ? {
            provider: stringOf(connection['provider']) ?? '',
            credentials:
              connection['credentials'] && typeof connection['credentials'] === 'object'
                ? Object.fromEntries(
                    Object.entries(connection['credentials'] as Record<string, unknown>)
                      .map(([key, value]) => [key, typeof value === 'string' ? value : ''])
                      .filter(([, value]) => value !== ''),
                  )
                : null,
            offices: strings(connection['offices']),
            active: connection['active'] !== false,
          }
        : null,
    sites: sitesGiven.map((site) => ({
      id: numberOf(site['id']),
      label: stringOf(site['label']) ?? '',
      url: stringOf(site['url']) ?? '',
      active: site['active'] !== false,
      removed: site['removed'] === true,
    })),
  };
}

/** What is wrong with the connection: the CRM, its login, its offices. */
function validateConnection(
  ctx: Ctx,
  input: ConnectionInput,
  existing: ConnectionListRow | undefined,
  errors: Record<string, string>,
): void {
  const adapter = adapterOf(ctx, input.provider);
  if (!adapter?.admin) {
    errors['connection.provider'] = 'No such CRM.';
    return;
  }
  if (existing && existing.provider !== input.provider) {
    errors['connection.provider'] =
      `This tenant is connected to ${existing.provider}; a CRM is not changed.`;
    return;
  }
  Object.assign(
    errors,
    missingLogin(
      adapter.admin.credentials,
      input.credentials ?? {},
      existing?.has_credentials === true,
    ),
  );
  if (input.offices.length === 0) {
    errors['connection.offices'] = 'Name at least one office; without one nothing is loaded.';
  }
}

/** The login fields still empty when a login is needed: all of them on a new connection, or a half-typed replacement. */
function missingLogin(
  fields: AdminField[],
  typed: Record<string, string>,
  stored: boolean,
): Record<string, string> {
  const anyTyped = fields.some((field) => typed[field.key]);
  if (stored && !anyTyped) return {};
  const errors: Record<string, string> = {};
  for (const field of fields) {
    if (field.required === false || typed[field.key]) continue;
    errors[`connection.credentials.${field.key}`] = stored
      ? 'Fill in every part of the login, or leave all of it empty to keep the stored one.'
      : `${field.label} is needed to connect.`;
  }
  return errors;
}

/** What is wrong with the input, by field, or nothing. */
function validate(
  ctx: Ctx,
  input: TenantInput,
  existing: ConnectionListRow | undefined,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name) errors['name'] = 'Give the tenant a name.';
  if (input.connection) validateConnection(ctx, input.connection, existing, errors);
  input.sites.forEach((site, index) => {
    if (site.removed) return;
    if (!site.label) errors[`sites.${index}.label`] = 'Give the site a name.';
    if (!bellUrlOk(site.url))
      errors[`sites.${index}.url`] = 'The bell URL must start with http:// or https://.';
  });
  return errors;
}

const credentialsJson = (fields: AdminField[], typed: Record<string, string>): string | null =>
  fields.some((field) => typed[field.key])
    ? JSON.stringify(Object.fromEntries(fields.map((field) => [field.key, typed[field.key] ?? ''])))
    : null;

/** The loads that follow a save, handed to the worker: dropped offices off, everything or the new offices on. */
async function queueLoads(
  id: string,
  provider: string,
  offices: { before: string[]; after: string[] },
  login: { had: boolean; has: boolean; replaced: boolean; isNew: boolean },
  notes: string[],
): Promise<void> {
  const removed = offices.before.filter((office) => !offices.after.includes(office));
  const added = offices.after.filter((office) => !offices.before.includes(office));
  if (!login.isNew && removed.length > 0) {
    await queueLifecycle(id, 'offices_removed', { officeIds: removed });
    notes.push(`Taking ${removed.length} office(s) off the sites.`);
  }
  if (!login.had && login.has) {
    await queueLifecycle(id, 'connection_added');
    notes.push(`Loading every record of ${offices.after.length} office(s) from ${provider} now.`);
  } else if (!login.isNew && added.length > 0 && login.has) {
    await queueLifecycle(id, 'offices_added', { officeIds: added });
    notes.push(`Loading ${added.length} new office(s) from ${provider} now.`);
  }
  if (login.replaced) notes.push('The login is replaced.');
}

/** The connection: stored, and the loads that follow handed to the worker. */
async function saveConnection(
  ctx: Ctx,
  tenantId: number,
  input: ConnectionInput,
  existing: ConnectionListRow | undefined,
  notes: string[],
): Promise<void> {
  const fields = adapterOf(ctx, input.provider)?.admin?.credentials ?? [];
  const id = existing?.id ?? `${input.provider}-${tenantId}`;
  const typed = credentialsJson(fields, input.credentials ?? {});
  await upsertConnection({
    id,
    tenantId,
    provider: input.provider,
    credentials: typed,
    licensedOffices: input.offices,
    active: input.active,
  });
  await queueLoads(
    id,
    input.provider,
    { before: existing?.licensed_offices ?? [], after: input.offices },
    loginState(existing, fields.length > 0, typed !== null),
    notes,
  );
}

/** Whether the connection had a usable login before this save, has one after it, and got a new one. */
function loginState(
  existing: ConnectionListRow | undefined,
  needsLogin: boolean,
  typed: boolean,
): { had: boolean; has: boolean; replaced: boolean; isNew: boolean } {
  const had = existing !== undefined && (!needsLogin || existing.has_credentials);
  return {
    had,
    has: had || !needsLogin || typed,
    replaced: typed && existing?.has_credentials === true,
    isNew: existing === undefined,
  };
}

async function saveSites(tenantId: number, sites: SiteInput[], notes: string[]): Promise<void> {
  const mine = (await subscribers()).filter((site) => site.tenant_id === tenantId);
  for (const site of sites) {
    const existing = site.id ? mine.find((row) => Number(row.id) === site.id) : undefined;
    if (site.removed) {
      if (existing) {
        await deleteSubscriber(Number(existing.id));
        notes.push(`The site ${existing.label} is removed.`);
      }
      continue;
    }
    if (existing) {
      await updateSubscriber(Number(existing.id), {
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
      notes.push(
        `The site ${site.label} has its bell secret; paste it into the site with the token.`,
      );
    }
  }
}

/** One save for everything on the page, new tenant or existing. */
async function save(ctx: Ctx, tenantId?: number): Promise<{ id: number; notes: string[] }> {
  const input = inputOf(ctx);
  if (tenantId && !(await tenantById(tenantId))) throw new HttpError(404, 'no such tenant');
  const existing = tenantId ? await connectionOf(tenantId) : undefined;
  const errors = validate(ctx, input, existing);
  if (Object.keys(errors).length > 0)
    throw new HttpError(422, 'Some fields need attention.', errors);
  const notes: string[] = [];
  let id = tenantId ?? 0;
  if (tenantId) {
    await updateTenant(tenantId, { displayName: input.name, active: input.active });
  } else {
    id = await createTenant({ displayName: input.name, token: newSecret() });
    notes.push(`Tenant #${id} is made; its token is on this page.`);
  }
  if (input.connection) await saveConnection(ctx, id, input.connection, existing, notes);
  await saveSites(id, input.sites, notes);
  await ctx.audit('tenant.save', { tenant: id, made: !tenantId, notes }, { tenantId: id });
  return { id, notes };
}

/** What "look at a record" asks for: the connection, its adapter, and the record named. */
async function inspectInput(ctx: Ctx) {
  const connection = await connectionById(ctx.params[0] ?? '');
  if (!connection) throw new HttpError(404, 'no such connection');
  const adapter = adapterOf(ctx, connection.provider);
  if (!adapter?.admin?.inspect) throw new HttpError(404, 'this CRM cannot be looked at');
  const body = ctx.body<{ datatype?: string; remoteId?: string; officeId?: string }>();
  const datatype = datatypeOf(body.datatype);
  const remoteId = stringOf(body.remoteId);
  if (!datatype || !remoteId) {
    throw new HttpError(400, `a datatype (${DATATYPES.join(', ')}) and a record id are needed`);
  }
  return {
    connection,
    look: adapter.admin.inspect.bind(adapter.admin),
    record: { datatype, remoteId, officeId: stringOf(body.officeId) ?? null },
  };
}

/** One record fetched from the CRM and mapped, nothing written: its raw, unified and display faces. */
async function inspect(ctx: Ctx): Promise<Response> {
  const { connection, look, record } = await inspectInput(ctx);
  const result = await look(connection, record);
  await ctx.audit(
    'connection.inspect',
    { connection: connection.id, ...record, found: result !== null },
    { tenantId: connection.tenantId, connectionId: connection.id },
  );
  if (!result) throw new HttpError(404, 'the CRM has no such record');
  const mapped = result.mapped;
  const display = mapped ? applyRules(record.datatype as Datatype, mapped.data)['display'] : null;
  return json({
    raw: result.raw,
    unified: mapped?.data ?? null,
    display: display ?? null,
    officeId: mapped?.officeId ?? null,
    remoteUpdatedAt: mapped?.remoteUpdatedAt ?? null,
  });
}

// ---- Routes ------------------------------------------------------------------------------------

export const tenantRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/v1\/admin\/tenants$/,
    handle: async () => json({ tenants: await tenantList() }),
  },
  {
    method: 'POST',
    pattern: /^\/v1\/admin\/tenants$/,
    handle: async (ctx) => {
      const { id, notes } = await save(ctx);
      return json({ id, notes, ...(await tenantView(ctx, id)) }, 201);
    },
  },
  {
    method: 'GET',
    pattern: /^\/v1\/admin\/tenants\/(\d+)$/,
    handle: async (ctx) => json(await tenantView(ctx, Number(ctx.params[0]))),
  },
  {
    method: 'PUT',
    pattern: /^\/v1\/admin\/tenants\/(\d+)$/,
    handle: async (ctx) => {
      const { id, notes } = await save(ctx, Number(ctx.params[0]));
      return json({ id, notes, ...(await tenantView(ctx, id)) });
    },
  },
  {
    method: 'POST',
    pattern: /^\/v1\/admin\/tenants\/(\d+)\/token$/,
    handle: async (ctx) => {
      const id = Number(ctx.params[0]);
      if (!(await tenantById(id))) throw new HttpError(404, 'no such tenant');
      const token = newSecret();
      await updateTenant(id, { token });
      await ctx.audit('tenant.token', { tenant: id }, { tenantId: id });
      return json({ token });
    },
  },
  {
    method: 'POST',
    pattern: /^\/v1\/admin\/tenants\/(\d+)\/ring$/,
    handle: async (ctx) => {
      const id = Number(ctx.params[0]);
      if (!(await tenantById(id))) throw new HttpError(404, 'no such tenant');
      const body = ctx.body<{ kind?: string; site?: number }>();
      const kind: BellKind = body.kind === 'forcerefresh' ? 'forcerefresh' : 'delta';
      const site = numberOf(body.site);
      await ring(id, kind, site);
      await ctx.audit('bell.ring', { tenant: id, kind, site: site ?? null }, { tenantId: id });
      return json({ ok: true }, 202);
    },
  },
  {
    method: 'POST',
    pattern: /^\/v1\/admin\/sites\/(\d+)\/secret$/,
    handle: async (ctx) => {
      const id = Number(ctx.params[0]);
      const site = (await subscribers()).find((row) => Number(row.id) === id);
      if (!site) throw new HttpError(404, 'no such site');
      const secret = newSecret();
      await updateSubscriber(id, { bellSecret: secret });
      await ctx.audit('site.secret', { site: id }, { tenantId: site.tenant_id });
      return json({ secret });
    },
  },
  {
    method: 'POST',
    pattern: /^\/v1\/admin\/connections\/([^/]+)\/events$/,
    handle: async (ctx) => {
      const id = ctx.params[0] ?? '';
      const row = (await connections()).find((candidate) => candidate.id === id);
      if (!row) throw new HttpError(404, 'no such connection');
      const body = ctx.body<{ event?: string; datatype?: string }>();
      const event = CONNECTION_EVENTS.find((candidate) => candidate === body.event);
      if (!event) throw new HttpError(400, `event must be one of ${CONNECTION_EVENTS.join(', ')}`);
      const datatype = datatypeOf(body.datatype);
      await queueLifecycle(id, event, { datatype });
      if (event === 'connection_removed') await setConnectionActive(id, false);
      await ctx.audit(
        `connection.${event}`,
        { connection: id, datatype: datatype ?? null },
        { tenantId: row.tenant_id, connectionId: id },
      );
      return json({ ok: true, event }, 202);
    },
  },
  {
    // Try the CRM with a login before it is saved.
    method: 'POST',
    pattern: /^\/v1\/admin\/providers\/([^/]+)\/probe$/,
    handle: async (ctx) => {
      const adapter = adapterOf(ctx, ctx.params[0] ?? '');
      if (!adapter?.admin?.probe) throw new HttpError(404, 'this CRM cannot be probed');
      const body = ctx.body<{
        credentials?: Record<string, string>;
        offices?: string[] | string;
      }>();
      const typed = body.credentials ?? {};
      const credentials = credentialsJson(adapter.admin.credentials, typed);
      if (!credentials) throw new HttpError(422, 'Type the login first.');
      const offices = Array.isArray(body.offices)
        ? body.offices.map(String)
        : String(body.offices ?? '')
            .split(/[\s,]+/)
            .filter(Boolean);
      const result = await adapter.admin.probe(credentials, offices);
      await ctx.audit('connection.probe', { provider: adapter.provider, ok: result.ok });
      return json(result);
    },
  },
  {
    // One record fetched from the CRM and mapped, nothing written: raw, unified and display.
    method: 'POST',
    pattern: /^\/v1\/admin\/connections\/([^/]+)\/inspect$/,
    handle: (ctx) => inspect(ctx),
  },
];
