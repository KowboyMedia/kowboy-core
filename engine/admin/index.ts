// The admin panel (docs/admin-panel.md): one place to configure Core and its adapters and to see
// what is happening, inside the web process under /admin. Server-rendered HTML, a login by email
// link (auth.ts), a session cookie, a CSRF token on every form. The engine's own panels live
// here; an adapter's panels come through `Adapter.admin` and are rendered in the same shell
// without the engine knowing what they show.
import { csrfOf, csrfOk, HTML, loginPage, logout, openLink, requestLink, userOf } from './auth.js';
import {
  redirect,
  renderer,
  type AdminAdapter,
  type AdminConfig,
  type Ctx,
  type Panel,
} from './context.js';
import { adapterPanels } from './adapters.js';
import { assetRoutes } from './html.js';
import { overviewPanels } from './overview.js';
import { tenantPanels } from './tenants.js';
import { connectionPanels } from './connections.js';
import { itemPanels } from './items.js';
import { eventPanels } from './timeline.js';
import { testPanels } from './test.js';
import { settingsPanels } from './settings.js';
import { report } from '../errors.js';
import { PAGE_SIZE } from '../http/changes.js';
import { TOMBSTONE_RETENTION_DAYS, VERSION, type Engine } from '../index.js';
import type { Request, Response, RouteTable } from '../http/server.js';
import type { Adapter } from '../adapter-api/types.js';

export type { AdminAdapter, AdminConfig } from './context.js';

const parseForm = (body: Buffer): Record<string, string> =>
  Object.fromEntries(new URLSearchParams(body.toString('utf8')));

export function adminPanelRoutes(options: {
  secret: string;
  /** Email domains whose addresses may log in. */
  domains: string[];
  adapters: AdminAdapter[];
  config: AdminConfig;
}): RouteTable {
  const panels: Panel[] = [
    ...overviewPanels,
    ...tenantPanels,
    ...connectionPanels,
    ...itemPanels,
    ...eventPanels,
    ...testPanels,
    ...settingsPanels,
    ...adapterPanels(options.adapters),
  ];

  const dispatch = async (request: Request): Promise<Response> => {
    const form = request.method === 'POST' ? parseForm(request.body) : {};
    const gated = await gate(request, form, options);
    if ('response' in gated) return gated.response;
    const { user } = gated;
    const render = renderer(request, options.adapters, user);
    for (const panel of panels) {
      if (panel.method !== request.method) continue;
      const match = panel.pattern.exec(request.path);
      if (!match) continue;
      const ctx: Ctx = {
        request,
        form,
        params: match.slice(1).map((part) => decodeURIComponent(part)),
        csrf: csrfOf(request),
        user,
        adapters: options.adapters,
        config: options.config,
        render,
        redirect,
      };
      return run(panel, ctx);
    }
    return { ...render('Not found', '<p>No such page.</p>'), status: 404 };
  };

  return [
    ...assetRoutes(),
    { method: 'GET', path: '/admin', handler: dispatch },
    { method: 'GET', path: '/admin/*', handler: dispatch },
    { method: 'POST', path: '/admin/*', handler: dispatch },
  ];
}

/** The panel for a running engine and the adapters it serves: what main.ts and the test harness mount. */
export function adminRoutesFor(engine: Engine, adapters: Adapter[]): RouteTable {
  return adminPanelRoutes({
    secret: engine.config.adminSecret,
    domains: engine.config.adminEmailDomains,
    adapters: adapters.map((adapter) => ({
      provider: adapter.manifest.provider,
      admin: adapter.admin,
    })),
    config: {
      version: VERSION,
      loginDomains: engine.config.adminEmailDomains,
      mailFrom: engine.config.mailFrom,
      pageSize: PAGE_SIZE,
      bellThrottleMs: engine.config.bellThrottleMs,
      eventRetentionDays: engine.config.eventRetentionDays,
      tombstoneRetentionDays: TOMBSTONE_RETENTION_DAYS,
      gzipLevel: engine.config.gzipLevel,
    },
  });
}

type Entrance = { secret: string; domains: string[] };
type Gate = { response: Response } | { user: string };

/** The pages anyone may open: the login form, its POST, and the link from the mail. */
async function entrance(
  request: Request,
  form: Record<string, string>,
  options: Entrance,
): Promise<Response | null> {
  if (request.path === '/admin/login') {
    return request.method === 'POST'
      ? requestLink(request, { ...options, form })
      : { status: 200, headers: HTML, body: loginPage() };
  }
  const token = /^\/admin\/login\/([^/]+)$/.exec(request.path)?.[1];
  return token && request.method === 'GET' ? openLink(request, options.secret, token) : null;
}

/** Who is asking, or what an unknown or stale visitor gets: the login pages, a redirect, a 403. */
async function gate(
  request: Request,
  form: Record<string, string>,
  options: Entrance,
): Promise<Gate> {
  const open = await entrance(request, form, options);
  if (open) return { response: open };
  const user = userOf(request, options.secret);
  if (!user) {
    return {
      response:
        request.method === 'GET'
          ? redirect('/admin/login')
          : { status: 403, body: { error: 'log in first' } },
    };
  }
  if (request.path === '/admin/logout') return { response: logout() };
  if (request.method === 'POST' && !csrfOk(request, form)) {
    return { response: { status: 403, body: { error: 'the form is stale; open the page again' } } };
  }
  return { user };
}

/** One panel, with its failure shown as a page instead of a bare 500. */
async function run(panel: Panel, ctx: Ctx): Promise<Response> {
  try {
    return await panel.handle(ctx);
  } catch (error) {
    report(error, { where: 'admin panel', path: ctx.request.path });
    return ctx.render('Something went wrong', '', `!${String(error)}`);
  }
}
