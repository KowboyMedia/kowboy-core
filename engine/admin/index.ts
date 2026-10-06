// The admin API: the one code path for the browser app and for an agent (docs/admin-panel-design.md
// §3). Everything the app does is one of these calls. The whole subtree is four routes on the
// engine's server — one per method — and the table below picks the handler.
import { jsonResponse, type Request, type Response, type RouteTable } from '../http/server.js';
import { report } from '../errors.js';
import { DATATYPES, type Datatype } from '../adapter-api/types.js';
import { newSecret } from '../storage/crypto.js';
import { subscribers, tenantById, updateSubscriber, updateTenant } from '../storage/connections.js';
import { ring } from '../bells.js';
import { queryEvents } from '../events.js';
import { healthReport } from '../health.js';
import { SORTABLE } from '../storage/items.js';
import { STARTED_AT, VERSION } from '../version.js';
import {
  configureAdmin,
  cookieFrom,
  cookieHeader,
  currentConfig,
  devicesOf,
  forgetOtherDevices,
  requestSignIn,
  sessionFor,
  signIn,
  signOut,
  type Session,
} from './auth.js';
import { audit } from './audit.js';
import { overview } from './overview.js';
import { act, crmPage, crms, probe } from './crms.js';
import { configuration, setMaintenance } from './configuration.js';
import { flow, stream, toStreamEvent } from './feed.js';
import { inspect, previewRecord, readRecord, search } from './records.js';
import {
  cancelJob,
  describe,
  fetchAgain,
  getJob,
  listJobs,
  preview,
  queueRecompute,
  sync,
  toScope,
  LEVELS,
  type ScopeInput,
} from './runs.js';
import { scopeFromQuery, scopeOptions } from './scope.js';
import { listTenants, readTenant, removeTenant, saveTenant, type TenantInput } from './tenants.js';
import {
  body,
  fail,
  flag,
  match,
  number,
  one,
  page,
  refuseBadFilters,
  text,
  PREFIX,
  type AdminRequest,
  type AdminRoute,
} from './http.js';
import { file } from './files.js';

export { configureAdmin };

const datatype = (value: string | undefined): Datatype | undefined =>
  DATATYPES.find((known) => known === value);

const routes: AdminRoute[] = [
  // ---- Getting in ------------------------------------------------------------------------------
  {
    method: 'POST',
    path: '/sign-in',
    open: true,
    handler: async (request) => {
      const parsed = body<{ email?: string; remember?: boolean }>(request);
      if ('error' in parsed) return parsed.error;
      if (!parsed.value.email) return fail(400, 'Type the address you sign in with.');
      return jsonResponse(
        200,
        await requestSignIn(parsed.value.email, parsed.value.remember === true),
      );
    },
  },
  {
    method: 'GET',
    path: '/sign-in/:token',
    open: true,
    handler: async (request): Promise<Response> => {
      // The browser that opens the link is the device being remembered, so it names itself here.
      const signedIn = await signIn(request.params['token'] ?? '', deviceOf(request));
      // A link that is unknown, spent or too old sends the person back to ask for a new one.
      if (!signedIn) return { status: 303, headers: { location: '/admin/sign-in?again=1' } };
      return {
        status: 303,
        headers: {
          location: '/admin',
          'set-cookie': cookieHeader(signedIn.cookie, signedIn.seconds),
        },
      };
    },
  },
  {
    method: 'POST',
    path: '/sign-out',
    handler: async (request) => {
      await signOut(cookieFrom(request.headers['cookie']), request.session.email);
      return {
        status: 200,
        body: { data: { signedOut: true } },
        headers: { 'set-cookie': cookieHeader('', 0) },
      };
    },
  },
  {
    method: 'GET',
    path: '/me',
    handler: async (request) => {
      const config = currentConfig();
      return one({
        email: request.session.email,
        environment: config.environment,
        version: VERSION,
        startedAt: STARTED_AT,
      });
    },
  },

  {
    method: 'GET',
    path: '/devices',
    handler: async (request) => {
      const rows = await devicesOf(request.session.email, cookieFrom(request.headers['cookie']));
      return page(
        rows.map((row) => ({
          device: row.device,
          remembered: row.remembered,
          current: row.current,
          signedInAt: row.created_at.toISOString(),
          lastSeenAt: row.last_seen_at.toISOString(),
          until: row.expires_at.toISOString(),
        })),
        rows.length,
      );
    },
  },
  {
    method: 'POST',
    path: '/devices/forget-others',
    handler: async (request) => {
      const forgotten = await forgetOtherDevices(
        request.session.email,
        cookieFrom(request.headers['cookie']),
      );
      await audit(request.session, 'devices_forgotten', { sessions: forgotten });
      return one({ forgotten });
    },
  },

  // ---- Overview, health, flow -----------------------------------------------------------------
  { method: 'GET', path: '/overview', handler: async () => one(await overview()) },
  { method: 'GET', path: '/health', handler: async () => one(await healthReport()) },
  {
    method: 'GET',
    path: '/flow',
    handler: async (request) => {
      const read = scopeFromQuery(request.query);
      if ('error' in read) return fail(400, read.error);
      const rows = await flow(read.scope, number(request, 'limit', 100));
      return page(rows, rows.length);
    },
  },
  {
    method: 'GET',
    path: '/stream',
    handler: (request) => stream(number(request, 'after', 0)),
  },

  // ---- Tenants ---------------------------------------------------------------------------------
  {
    method: 'GET',
    path: '/tenants',
    handler: async () => {
      const rows = await listTenants();
      return page(rows, rows.length);
    },
  },
  {
    method: 'GET',
    path: '/tenants/:id',
    handler: async (request) => {
      const tenant = await readTenant(Number(request.params['id']));
      return tenant ? one(tenant) : fail(404, 'There is no such tenant.');
    },
  },
  {
    method: 'POST',
    path: '/tenants',
    handler: async (request) => {
      const parsed = body<TenantInput>(request);
      if ('error' in parsed) return parsed.error;
      const refused = refuseTenant(parsed.value);
      if (refused) return fail(400, refused);
      const saved = await saveTenant(null, parsed.value);
      await audit(
        request.session,
        'tenant_saved',
        { changes: saved.changes },
        { tenantId: saved.id },
      );
      return one({ ...(await readTenant(saved.id)), changes: saved.changes });
    },
  },
  {
    method: 'PATCH',
    path: '/tenants/:id',
    handler: async (request) => {
      const parsed = body<TenantInput>(request);
      if ('error' in parsed) return parsed.error;
      const refused = refuseTenant(parsed.value);
      if (refused) return fail(400, refused);
      const id = Number(request.params['id']);
      if (!(await tenantById(id))) return fail(404, 'There is no such tenant.');
      const saved = await saveTenant(id, parsed.value);
      await audit(request.session, 'tenant_saved', { changes: saved.changes }, { tenantId: id });
      return one({ ...(await readTenant(id)), changes: saved.changes });
    },
  },
  {
    method: 'DELETE',
    path: '/tenants/:id',
    handler: async (request) => {
      const id = Number(request.params['id']);
      const tenant = await tenantById(id);
      if (!tenant) return fail(404, 'There is no such tenant.');
      await audit(
        request.session,
        'tenant_removed',
        { name: tenant.display_name },
        { tenantId: id },
      );
      await removeTenant(id);
      return one({ removed: id });
    },
  },
  {
    method: 'POST',
    path: '/tenants/:id/token',
    handler: async (request) => {
      const id = Number(request.params['id']);
      if (!(await tenantById(id))) return fail(404, 'There is no such tenant.');
      const token = newSecret();
      await updateTenant(id, { token });
      await audit(request.session, 'token_rotated', {}, { tenantId: id });
      return one({ token });
    },
  },
  {
    method: 'POST',
    path: '/tenants/:id/ring',
    handler: async (request) => {
      const id = Number(request.params['id']);
      if (!(await tenantById(id))) return fail(404, 'There is no such tenant.');
      const kind = text(request, 'kind') === 'forcerefresh' ? 'forcerefresh' : 'delta';
      await ring(id, kind);
      await audit(request.session, 'rang', { kind }, { tenantId: id });
      return one({ rang: kind });
    },
  },

  // ---- Sites -----------------------------------------------------------------------------------
  {
    method: 'POST',
    path: '/sites/:id/secret',
    handler: async (request) => {
      const id = Number(request.params['id']);
      const site = (await subscribers()).find((one_) => Number(one_.id) === id);
      if (!site) return fail(404, 'There is no such site.');
      const bellSecret = newSecret();
      await updateSubscriber(id, { bellSecret });
      await audit(
        request.session,
        'bell_secret_rotated',
        { site: site.label },
        {
          tenantId: site.tenant_id,
          subscriberId: id,
        },
      );
      return one({ bellSecret });
    },
  },
  {
    method: 'POST',
    path: '/sites/:id/ring',
    handler: async (request) => {
      const id = Number(request.params['id']);
      const site = (await subscribers()).find((one_) => Number(one_.id) === id);
      if (!site) return fail(404, 'There is no such site.');
      const kind = text(request, 'kind') === 'forcerefresh' ? 'forcerefresh' : 'delta';
      await ring(site.tenant_id, kind, id);
      await audit(
        request.session,
        'rang',
        { kind, site: site.label },
        {
          tenantId: site.tenant_id,
          subscriberId: id,
        },
      );
      return one({ rang: kind });
    },
  },

  // ---- Records ---------------------------------------------------------------------------------
  {
    method: 'GET',
    path: '/scope',
    handler: async () => one(await scopeOptions()),
  },
  {
    method: 'GET',
    path: '/records',
    handler: async (request) => {
      const read = scopeFromQuery(request.query);
      if ('error' in read) return fail(400, read.error);
      const refused = refuseBadFilters(request, [], ['page', 'size']);
      if (refused) return refused;
      const sort = SORTABLE.find((column) => column === text(request, 'sort'));
      const found = await search({
        ...read.scope,
        deleted: flag(request, 'deleted'),
        ...(sort ? { sort } : {}),
        dir: text(request, 'dir') === 'asc' ? 'asc' : 'desc',
        page: number(request, 'page', 1),
        size: number(request, 'size', 50),
      });
      return page(found.rows, found.total);
    },
  },
  {
    method: 'GET',
    path: '/records/:connection/:datatype/:id',
    handler: async (request) => {
      const kind = datatype(request.params['datatype']);
      if (!kind) return fail(400, 'That is not a datatype Core knows.');
      const record = await readRecord(
        request.params['connection'] ?? '',
        kind,
        request.params['id'] ?? '',
      );
      return record ? one(record) : fail(404, 'Core holds no such record.');
    },
  },
  {
    method: 'POST',
    path: '/records/:connection/:datatype/:id/preview',
    handler: async (request) => {
      const kind = datatype(request.params['datatype']);
      if (!kind) return fail(400, 'That is not a datatype Core knows.');
      return one(
        await previewRecord(request.params['connection'] ?? '', kind, request.params['id'] ?? ''),
      );
    },
  },
  {
    method: 'POST',
    path: '/records/:connection/:datatype/:id/inspect',
    handler: async (request) => {
      const kind = datatype(request.params['datatype']);
      if (!kind) return fail(400, 'That is not a datatype Core knows.');
      const connectionId = request.params['connection'] ?? '';
      const remoteId = request.params['id'] ?? '';
      const looked = await inspect(connectionId, {
        datatype: kind,
        remoteId,
        officeId: text(request, 'office') ?? null,
      });
      if ('error' in looked) return fail(422, looked.error);
      await audit(
        request.session,
        'inspected',
        {},
        {
          connectionId,
          datatype: kind,
          remoteId,
        },
      );
      return one(looked.inspection);
    },
  },

  // ---- Runs ------------------------------------------------------------------------------------
  {
    method: 'POST',
    path: '/runs/preview',
    handler: async (request) => {
      const parsed = body<ScopeInput>(request);
      if ('error' in parsed) return parsed.error;
      const scope = await toScope(parsed.value);
      return one({ scope: describe(parsed.value), report: await preview(scope) });
    },
  },
  {
    method: 'POST',
    path: '/runs/recompute',
    handler: async (request) => {
      const parsed = body<ScopeInput>(request);
      if ('error' in parsed) return parsed.error;
      const scope = await toScope(parsed.value);
      const job = await queueRecompute(scope, request.session.email);
      await audit(request.session, 'recompute_queued', { job, scope: describe(parsed.value) });
      return one({ job, scope: describe(parsed.value) });
    },
  },
  {
    method: 'POST',
    path: '/runs/fetch-again',
    handler: async (request) => {
      const parsed = body<ScopeInput>(request);
      if ('error' in parsed) return parsed.error;
      const outcome = await fetchAgain(parsed.value);
      await audit(request.session, 'fetch_again', {
        scope: describe(parsed.value),
        queued: outcome.queued,
      });
      return one(outcome);
    },
  },
  {
    method: 'POST',
    path: '/runs/sync',
    handler: async (request) => {
      const parsed = body<ScopeInput & { level?: string }>(request);
      if ('error' in parsed) return parsed.error;
      const level = LEVELS.find((known) => known === parsed.value.level);
      if (!level) return fail(400, `Say how far to go: ${LEVELS.join(', ')}.`);
      const detail = await sync(level, parsed.value, request.session.email);
      await audit(request.session, 'synced', { level, scope: describe(parsed.value) });
      return one({ detail });
    },
  },
  {
    method: 'GET',
    path: '/jobs',
    handler: async (request) => {
      const rows = await listJobs(number(request, 'limit', 50));
      return page(rows, rows.length);
    },
  },
  {
    method: 'GET',
    path: '/jobs/:id',
    handler: async (request) => {
      const job = await getJob(Number(request.params['id']));
      return job ? one(job) : fail(404, 'There is no such job.');
    },
  },
  {
    method: 'POST',
    path: '/jobs/:id/cancel',
    handler: async (request) => {
      const id = Number(request.params['id']);
      const stopped = await cancelJob(id);
      if (stopped) await audit(request.session, 'job_cancelled', { job: id });
      return one({ cancelled: stopped });
    },
  },

  // ---- Events ----------------------------------------------------------------------------------
  {
    method: 'GET',
    path: '/events',
    handler: async (request) => {
      const refused = refuseBadFilters(
        request,
        ['from', 'to'],
        ['tenant', 'site', 'before', 'after', 'limit'],
      );
      if (refused) return refused;
      const rows = await queryEvents({
        type: text(request, 'type'),
        tenantId: text(request, 'tenant') ? Number(text(request, 'tenant')) : undefined,
        connectionId: text(request, 'connection'),
        subscriberId: text(request, 'site') ? Number(text(request, 'site')) : undefined,
        correlationId: text(request, 'correlation'),
        from: text(request, 'from'),
        to: text(request, 'to'),
        beforeId: text(request, 'before') ? Number(text(request, 'before')) : undefined,
        afterId: text(request, 'after') ? Number(text(request, 'after')) : undefined,
        newestFirst: text(request, 'oldest') !== 'true',
        limit: number(request, 'limit', 100),
      });
      return page(rows.map(toStreamEvent), rows.length);
    },
  },

  // ---- CRMs ------------------------------------------------------------------------------------
  {
    method: 'GET',
    path: '/crms',
    handler: async () => {
      const rows = await crms();
      return page(rows, rows.length);
    },
  },
  {
    method: 'GET',
    path: '/crms/:provider',
    handler: async (request) => {
      const found = await crmPage(request.params['provider'] ?? '');
      return found ? one(found) : fail(404, 'No such CRM is registered here.');
    },
  },
  {
    method: 'POST',
    path: '/crms/:provider/act',
    handler: async (request) => {
      const parsed = body<{ action?: string; params?: Record<string, string> }>(request);
      if ('error' in parsed) return parsed.error;
      const provider = request.params['provider'] ?? '';
      if (!parsed.value.action) return fail(400, 'Which action?');
      const outcome = await act(provider, parsed.value.action, parsed.value.params ?? {});
      if ('error' in outcome) return fail(422, outcome.error);
      await audit(request.session, 'crm_action', {
        provider,
        action: parsed.value.action,
        params: parsed.value.params ?? {},
      });
      return one(outcome);
    },
  },
  {
    method: 'POST',
    path: '/crms/:provider/probe',
    handler: async (request) => {
      const parsed = body<{
        credentials?: Record<string, string>;
        officeIds?: string[];
        /** A saved connection: try the login Core already holds, which the page cannot re-type. */
        connectionId?: string;
      }>(request);
      if ('error' in parsed) return parsed.error;
      const provider = request.params['provider'] ?? '';
      const outcome = await probe(provider, {
        typed: parsed.value.credentials ?? {},
        officeIds: parsed.value.officeIds ?? [],
        ...(parsed.value.connectionId ? { connectionId: parsed.value.connectionId } : {}),
      });
      await audit(request.session, 'login_tried', { provider, ok: outcome.ok });
      return one(outcome);
    },
  },

  // ---- Settings --------------------------------------------------------------------------------
  { method: 'GET', path: '/settings', handler: async () => one(await configuration()) },
  {
    method: 'POST',
    path: '/settings/maintenance',
    handler: async (request) => {
      const parsed = body<{ on?: boolean }>(request);
      if ('error' in parsed) return parsed.error;
      const on = parsed.value.on === true;
      await setMaintenance(on, request.session.email);
      await audit(request.session, 'maintenance', { on });
      return one({ maintenance: on });
    },
  },
];

const refuseConnection = (connection: TenantInput['connections'][number]): string | null => {
  if (!connection.id || !/^[a-z0-9][a-z0-9-]*$/.test(connection.id)) {
    return 'A connection needs a short name of lower-case letters, digits and dashes.';
  }
  // No office named means every office the CRM gives the login, which an adapter may learn from
  // the CRM itself (question 147 a, 2026-10-06, reversing the rule of 2026-09-21 that refused an
  // empty list); a connection that ends up with none says so in its health check.
  return connection.provider ? null : `The connection ${connection.id} needs a CRM.`;
};

const refuseSite = (site: TenantInput['sites'][number]): string | null => {
  if (!site.label || site.label.trim() === '') return 'A site needs a name.';
  return /^https?:\/\/.+/.test(site.bellUrl)
    ? null
    : `The site ${site.label} needs a bell address starting with http:// or https://.`;
};

/**
 * The device a request comes from, as a person would name it. The browser's own description is
 * all Core has; it is kept whole and shown only to the person it belongs to.
 */
function deviceOf(request: Request): string | null {
  const agent = request.headers['user-agent'];
  return agent ? agent.slice(0, 200) : null;
}

/** What a tenant page will not save, said as the field the person must fix. */
function refuseTenant(input: TenantInput): string | null {
  if (!input.displayName || input.displayName.trim() === '') return 'A tenant needs a name.';
  for (const connection of input.connections ?? []) {
    const refused = refuseConnection(connection);
    if (refused) return refused;
  }
  for (const site of input.sites ?? []) {
    const refused = refuseSite(site);
    if (refused) return refused;
  }
  return null;
}

/** The whole admin subtree, as the engine's server mounts it. */
export function adminRoutes(): RouteTable {
  const methods = ['GET', 'POST', 'PATCH', 'DELETE'] as const;
  return [
    ...methods.map((method) => ({
      method,
      path: `${PREFIX}/*`,
      handler: (request: Request) => dispatch(method, request),
    })),
    // The app itself, and every address it routes on its own.
    { method: 'GET', path: '/admin', handler: (request: Request) => file(request) },
    { method: 'GET', path: '/admin/*', handler: (request: Request) => file(request) },
  ];
}

async function dispatch(method: string, request: Request): Promise<Response> {
  const path = request.path.slice(PREFIX.length) || '/';
  for (const route of routes) {
    if (route.method !== method) continue;
    const params = match(route.path, path);
    if (!params) continue;
    if (route.open) return guarded(route, request, params, { email: '' });
    const session = await sessionFor(cookieFrom(request.headers['cookie']));
    if (!session) return fail(401, 'Sign in to use the admin area.');
    return guarded(route, request, params, session);
  }
  return fail(404, 'There is no such admin call.');
}

/** A handler's own failure is the panel's message, not a blank 500. */
async function guarded(
  route: AdminRoute,
  request: Request,
  params: Record<string, string>,
  session: Session,
): Promise<Response> {
  try {
    return await route.handler({ ...request, params, session } as AdminRequest);
  } catch (error) {
    report(error, { where: 'admin', path: request.path });
    return fail(500, String(error instanceof Error ? error.message : error));
  }
}
