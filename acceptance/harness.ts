import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { startEngine, type Engine } from '../engine/index.js';
import { startAdapter } from '../engine/adapter-api/index.js';
import { adapterRoutes, type RouteTable } from '../engine/http/server.js';
import { adminRoutesFor } from '../engine/admin-api/index.js';
import { forgetLoginRequests } from '../engine/admin-api/session.js';
import { configureMail, type Mail } from '../engine/mail.js';
import { db } from '../engine/storage/db.js';
import { addSubscriber, createTenant, upsertConnection } from '../engine/storage/connections.js';
import { deliverLifecycleEvents } from '../engine/lifecycle.js';
import { clearRegistry } from '../engine/registry.js';
import type { Adapter } from '../engine/adapter-api/types.js';

/** The test tenant's number: the first one made after every reset. */
export const TENANT = 1;
export const TOKEN = 'test-tenant-token';
export const ADMIN_SECRET = 'test-admin-secret';
/** An address at the domain the tests allow into the admin panel (ADMIN_EMAIL_DOMAINS). */
export const ADMIN_EMAIL = 'operator@example.test';

export type Bell = { kind: string; tenant_id: number; secret: string | undefined };

export type ConnectionInput = {
  id: string;
  provider: string;
  licensedOffices?: string[];
  /** What the adapter needs to reach the CRM, stored encrypted; its format is the adapter's. */
  credentials?: string | null;
};

export type Harness = {
  engine: Engine;
  baseUrl: string;
  bells: Bell[];
  /** Every mail Core sent, instead of sending it. */
  mails: Mail[];
  /** Add or change a connection of the test tenant. */
  connection(input: ConnectionInput): Promise<void>;
  /** Deliver queued lifecycle events, as the worker's tick would. */
  deliver(): Promise<void>;
  /**
   * Stop Core, run `during` while it is down (a database restore, say), and start it again on
   * the same port, as the platform does. Adapters and the server are stopped first, so nothing
   * polls or pulls while the database changes under it.
   */
  restart(during?: () => Promise<void>): Promise<void>;
  stop(): Promise<void>;
};

/** A running engine, a bell receiver, and whatever adapters a test needs. */
export async function harness(options: {
  adapters?: Adapter[];
  connections?: ConnectionInput[];
  subscriber?: boolean;
  /** A fixed port, for the browser journeys' server; a free one otherwise. */
  port?: number;
  /** Routes mounted next to Core's own, for the journeys' test-only helpers. */
  routes?: RouteTable;
}): Promise<Harness> {
  clearRegistry();
  const adapters = options.adapters ?? [];

  let engine = await startEngine({ port: options.port ?? 0 });
  await truncate();
  const mails: Mail[] = [];
  const keepMail = (): void => {
    configureMail(async (mail) => {
      mails.push(mail);
    });
    forgetLoginRequests();
  };
  keepMail();

  const bells: Bell[] = [];
  const bellServer = await listen((request, respond) => {
    bells.push({
      kind: 'delta',
      tenant_id: TENANT,
      secret: request.headers['x-core-secret'] as string | undefined,
    });
    respond(200);
  });

  const tenantId = await createTenant({ displayName: 'Test tenant', token: TOKEN });
  if (tenantId !== TENANT) throw new Error(`the test tenant got number ${tenantId}, not ${TENANT}`);
  const connection = (input: ConnectionInput): Promise<void> =>
    upsertConnection({
      id: input.id,
      tenantId: TENANT,
      provider: input.provider,
      licensedOffices: input.licensedOffices ?? [],
      credentials: input.credentials ?? null,
    });
  for (const input of options.connections ?? []) await connection(input);
  if (options.subscriber !== false) {
    await addSubscriber({
      tenantId: TENANT,
      label: 'test site',
      bellUrl: `http://127.0.0.1:${(bellServer.address() as AddressInfo).port}/bell`,
      bellSecret: 'bell-secret',
    });
  }

  const routes = [
    ...adapters.flatMap((adapter) =>
      adapterRoutes(adapter.manifest.provider, adapter.routes ?? []),
    ),
    ...adminRoutesFor(engine, adapters),
    ...(options.routes ?? []),
  ];
  let server = engine.listen(routes);
  const port = (server.address() as AddressInfo).port;

  for (const adapter of adapters) await startAdapter(adapter);

  const running: Harness = {
    engine,
    baseUrl: `http://127.0.0.1:${port}`,
    bells,
    mails,
    connection,
    deliver: async () => {
      await deliverLifecycleEvents();
    },
    async restart(during?: () => Promise<void>) {
      for (const adapter of adapters) await adapter.stop?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await during?.();
      await engine.stop();
      engine = await startEngine({ port });
      keepMail();
      running.engine = engine;
      server = engine.listen(routes);
      for (const adapter of adapters) await startAdapter(adapter);
    },
    async stop() {
      for (const adapter of adapters) await adapter.stop?.();
      await new Promise<void>((resolve) => bellServer.close(() => resolve()));
      await engine.stop();
    },
  };
  return running;
}

/** Every table empty and the sequence at 1: what the harness does before a test, for a test that starts Core another way. */
export async function truncate(): Promise<void> {
  await db().query(
    'truncate tenants, connections, subscribers, items, heartbeats, events, lifecycle_events, health_results, error_reports, jobs, alert_state restart identity cascade',
  );
  await db().query("select setval('item_seq', 1, false)");
}

function listen(
  handler: (
    request: import('node:http').IncomingMessage,
    respond: (status: number) => void,
  ) => void,
): Promise<Server> {
  return new Promise((resolve) => {
    const server = createServer((request, response) => {
      request.resume();
      handler(request, (status) => {
        response.writeHead(status);
        response.end();
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/** Wait until `condition` holds, or fail the test with a useful message. */
export async function until(
  condition: () => boolean | Promise<boolean>,
  what: string,
  timeoutMs = 5000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`timed out waiting for ${what}`);
}

export const pull = async (
  baseUrl: string,
  datatype: string,
  after = 0,
  headers: Record<string, string> = {},
): Promise<{ items: Record<string, unknown>[]; next_after: number; has_more: boolean }> => {
  const response = await fetch(`${baseUrl}/v1/changes?datatype=${datatype}&after=${after}`, {
    headers: { authorization: `Bearer ${TOKEN}`, ...headers },
  });
  if (!response.ok) throw new Error(`pull failed: ${response.status} ${await response.text()}`);
  return (await response.json()) as {
    items: Record<string, unknown>[];
    next_after: number;
    has_more: boolean;
  };
};

/** The headers a logged-in browser sends with a change: the session, and the panel's own header. */
export type AdminHeaders = Record<string, string>;

/**
 * Log in to the admin panel as a browser would: ask for a link, open the link the mail carries,
 * and keep the session cookie. The headers returned carry what a change needs.
 */
export async function adminLogin(
  running: Harness,
  email = ADMIN_EMAIL,
  remember = false,
): Promise<{ cookie: string; headers: AdminHeaders; response: Response }> {
  await fetch(`${running.baseUrl}/v1/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, remember }),
  });
  const link = running.mails.at(-1)?.text.match(/https?:\/\/\S+/)?.[0];
  if (!link) throw new Error(`no login link was mailed to ${email}`);
  const response = await fetch(link, { redirect: 'manual' });
  const cookie = (response.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
  return {
    cookie,
    headers: { cookie, 'x-requested-with': 'core-admin', 'content-type': 'application/json' },
    response,
  };
}

/** A logged-in call to the admin API, JSON in and out. */
export async function adminCall<T = Record<string, unknown>>(
  running: Harness,
  headers: AdminHeaders,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<{ status: number; body: T }> {
  const response = await fetch(`${running.baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : {}) as T };
}
