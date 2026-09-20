// The panel's API (docs/admin-panel.md): JSON under /v1/admin/, one place where tenants are saved,
// records searched, recomputes run and events read, used by the browser app and by the agents
// alike. The app itself is static files served under /admin (static.ts). A login by email link
// or, in maintenance, straight from the form (session.ts); the admin secret opens the same doors
// for the agents. Every change made here is logged as `admin.action` with who made it.
import { sameSecret } from '../storage/crypto.js';
import { report } from '../errors.js';
import { VERSION, type Engine } from '../index.js';
import type { Adapter } from '../adapter-api/types.js';
import type { Request, Response, RouteTable } from '../http/server.js';
import { auditEvent, HttpError, json, type AdminAdapter, type Ctx, type Route } from './context.js';
import {
  CLEARED_COOKIE,
  LINK_MINUTES,
  login,
  openLink,
  sessionCookie,
  sessionOf,
  type LoginOptions,
} from './session.js';
import { openStream } from './stream.js';
import { appRoutes } from './static.js';
import { dashboardRoutes } from './dashboard.js';
import { tenantRoutes } from './tenants.js';
import { itemRoutes } from './items.js';
import { jobRoutes } from './jobs.js';
import { eventRoutes } from './events.js';
import { settingsRoutes } from './settings.js';

export type { AdminAdapter } from './context.js';

/** The header the app sends with every change, which a page on another site cannot. */
const PANEL_HEADER = 'core-admin';

/** Who is asking, or null: the admin secret says "agent", a session says the address. */
function actorOf(request: Request, secret: string): string | null {
  const given = request.headers['x-admin-secret'];
  if (given && sameSecret(given, secret)) return 'agent';
  const session = sessionOf(request, secret);
  if (!session) return null;
  if (request.method !== 'GET') {
    // A cookie goes with any request a browser makes, so a change must also carry what only the
    // app sends: its header, and an origin that is this host.
    if (request.headers['x-requested-with'] !== PANEL_HEADER) {
      throw new HttpError(403, 'a change needs the panel header');
    }
    const origin = request.headers['origin'];
    if (origin && new URL(origin).host !== request.headers['host']) {
      throw new HttpError(403, 'the request comes from another site');
    }
  }
  return session.email;
}

const unauthorized = json({ error: 'log in first' }, 401);

const failure = (error: unknown, path: string): Response => {
  if (error instanceof HttpError) {
    return json(
      { error: error.message, ...(error.errors ? { errors: error.errors } : {}) },
      error.status,
    );
  }
  report(error, { where: 'admin api', path });
  return json({ error: 'something went wrong; it is reported' }, 500);
};

/** The doors: the login form, the link from the mail, logging out, and who is in. */
function sessionRoutes(engine: Engine, options: LoginOptions): RouteTable {
  return [
    {
      method: 'POST',
      path: '/v1/admin/login',
      handler: async (request) => {
        let body: { email?: unknown; remember?: unknown };
        try {
          body = request.json();
        } catch {
          return json({ error: 'the body is not JSON' }, 400);
        }
        const email = typeof body.email === 'string' ? body.email : '';
        const outcome = await login(request, { email, remember: body.remember === true }, options);
        if (outcome.kind === 'session') {
          return {
            status: 200,
            body: { user: outcome.email, via: 'maintenance' },
            headers: { 'set-cookie': sessionCookie(request, options.secret, outcome) },
          };
        }
        if (outcome.kind === 'refused')
          return json({ error: 'that address can’t log in here' }, 401);
        return json({ sent: true, minutes: LINK_MINUTES });
      },
    },
    {
      method: 'GET',
      path: '/v1/admin/login/*',
      handler: async (request): Promise<Response> => {
        const token = request.path.split('/').pop() ?? '';
        const grant = await openLink(options.secret, token);
        if (!grant) return { status: 303, headers: { location: '/admin/login?stale=1' } };
        return {
          status: 303,
          headers: {
            location: '/admin',
            'set-cookie': sessionCookie(request, options.secret, grant),
          },
        };
      },
    },
    {
      // What the login page needs before anyone is in: whether the mailed link is paused.
      method: 'GET',
      path: '/v1/admin/login-mode',
      handler: async () => json({ maintenanceLogin: options.directLogin }),
    },
    {
      method: 'POST',
      path: '/v1/admin/logout',
      handler: async () => ({
        status: 200,
        body: { ok: true },
        headers: { 'set-cookie': CLEARED_COOKIE },
      }),
    },
    {
      method: 'GET',
      path: '/v1/admin/session',
      handler: async (request) => {
        const session = sessionOf(request, options.secret);
        const agent = request.headers['x-admin-secret'];
        const user =
          session?.email ?? (agent && sameSecret(agent, options.secret) ? 'agent' : null);
        if (!user) return unauthorized;
        return json({
          user,
          version: VERSION,
          environment: engine.config.environment,
          maintenanceLogin: options.directLogin,
        });
      },
    },
  ];
}

/** The panel's API for a running engine and the adapters it serves: what main.ts and the tests mount. */
export function adminRoutesFor(engine: Engine, adapters: Adapter[]): RouteTable {
  const secret = engine.config.adminSecret;
  const options: LoginOptions = {
    secret,
    domains: engine.config.adminEmailDomains,
    directLogin: engine.config.adminLoginWithoutEmail,
  };
  const adminAdapters: AdminAdapter[] = adapters.map((adapter) => ({
    provider: adapter.manifest.provider,
    admin: adapter.admin,
  }));
  const routes: Route[] = [
    ...dashboardRoutes,
    ...tenantRoutes,
    ...itemRoutes,
    ...jobRoutes,
    ...eventRoutes,
    ...settingsRoutes,
  ];

  const dispatch = async (request: Request): Promise<Response> => {
    let actor: string | null;
    try {
      actor = actorOf(request, secret);
    } catch (error) {
      return failure(error, request.path);
    }
    if (!actor) return unauthorized;
    if (request.path === '/v1/admin/stream' && request.method === 'GET') {
      return { raw: (outgoing) => void openStream(outgoing) };
    }
    for (const route of routes) {
      if (route.method !== request.method) continue;
      const match = route.pattern.exec(request.path);
      if (!match) continue;
      const ctx: Ctx = {
        request,
        params: match.slice(1).map((part) => decodeURIComponent(part)),
        actor,
        engine,
        adapters: adminAdapters,
        body<T extends object>(): T {
          try {
            const parsed = request.json<T>();
            if (!parsed || typeof parsed !== 'object') throw new Error('not an object');
            return parsed;
          } catch {
            throw new HttpError(400, 'the body is not a JSON object');
          }
        },
        audit: (action, fields = {}, context = {}) => auditEvent(actor, action, fields, context),
      };
      try {
        return await route.handle(ctx);
      } catch (error) {
        return failure(error, request.path);
      }
    }
    return json({ error: 'not found' }, 404);
  };

  return [
    ...sessionRoutes(engine, options),
    ...(['GET', 'POST', 'PUT', 'DELETE'] as const).map((method) => ({
      method,
      path: '/v1/admin/*',
      handler: dispatch,
    })),
    ...appRoutes(),
  ];
}
