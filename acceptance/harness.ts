import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { startEngine, type Engine } from '../engine/index.js';
import { startAdapter } from '../engine/adapter-api/index.js';
import { adapterRoutes } from '../engine/http/server.js';
import { configureMail, type Mail } from '../engine/mail.js';
import { configureHumanCheck, type HumanCheck } from '../engine/human.js';
import { db } from '../engine/storage/db.js';
import { addSubscriber, createTenant, upsertConnection } from '../engine/storage/connections.js';
import { deliverLifecycleEvents } from '../engine/lifecycle.js';
import { clearRegistry, registerAdmin, registerSubmissions } from '../engine/registry.js';
import { configureSubmissions, resetSubmissionLimits } from '../engine/http/submissions.js';
import { resetFormsLimits } from '../engine/http/forms.js';
import type { Adapter } from '../engine/adapter-api/types.js';

// The engine's operations an adapter's tests drive, re-exported so those tests import the harness
// only: the seam check keeps adapter code, its tests included, out of the engine's internals.
export { queueLifecycle } from '../engine/lifecycle.js';
export { queryEvents } from '../engine/events.js';
export { connectionById } from '../engine/storage/connections.js';
export { healthReport, type HealthReport } from '../engine/health.js';

/** Where Core in a test sends its alerts (kept in `mails`) and where its links point. */
export const ALERTS = { alertEmail: 'ops@example.test', publicUrl: 'https://core.example' };

/**
 * The bot check in a test: Cloudflare's documented test key, which always passes in a browser and
 * hands out this dummy token, and a stand-in for Cloudflare's verification that takes only that
 * token, so no test calls Cloudflare (Turnstile's testing page, updated 2026-05-05).
 */
export const HUMAN_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';
export const HUMAN_CHECK: HumanCheck = {
  provider: 'turnstile',
  siteKey: '1x00000000000000000000AA',
  verify: (token) => Promise.resolve(token === HUMAN_TOKEN),
};

/** The test tenant's number: the first one made after every reset. */
export const TENANT = 1;
export const TOKEN = 'test-tenant-token';

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
}): Promise<Harness> {
  clearRegistry();
  resetSubmissionLimits();
  resetFormsLimits();
  const adapters = options.adapters ?? [];

  let engine = await startEngine({ port: 0, ...ALERTS });
  await truncate();
  const mails: Mail[] = [];
  const keepMail = (): void => {
    configureMail(async (mail) => {
      mails.push(mail);
    });
  };
  keepMail();
  // The stand-in CRMs are no brokerage, so this Core sends forms as the live service does, behind
  // the stand-in bot check; the guard's own test turns that off (question 152).
  const asLive = (): void => {
    configureSubmissions({ live: true });
    configureHumanCheck(HUMAN_CHECK);
  };
  asLive();

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

  const routes = adapters.flatMap((adapter) =>
    adapterRoutes(adapter.manifest.provider, adapter.routes ?? []),
  );
  let server = engine.listen(routes);
  const port = (server.address() as AddressInfo).port;

  for (const adapter of adapters) {
    await startAdapter(adapter);
    // As the entrypoint does for both roles: the admin area draws the adapter's own panel, and a
    // site's form is handed to the adapter inside the request.
    if (adapter.admin) registerAdmin(adapter.manifest.provider, adapter.admin);
    registerSubmissions(adapter.manifest.provider, adapter);
  }

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
      engine = await startEngine({ port, ...ALERTS });
      keepMail();
      asLive();
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

const TABLES =
  'tenants, connections, subscribers, items, heartbeats, events, lifecycle_events, health_results, error_reports, jobs, alert_state, settings, admin_logins, admin_sessions, submissions';

/**
 * Every table empty and the sequence at 1: what the harness does before a test, and what a test
 * that starts Core another way calls. Truncating takes an exclusive lock on every table at once,
 * which Postgres will refuse as a deadlock if a connection the last test left behind is reading
 * one of them in another order; the second try always has the field to itself.
 */
export async function truncate(): Promise<void> {
  for (const attempt of [1, 2]) {
    try {
      await db().query(`truncate ${TABLES} restart identity cascade`);
      break;
    } catch (error) {
      if (attempt === 2 || !String(error).includes('deadlock')) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
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
