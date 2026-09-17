import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { startEngine, type Engine } from '../engine/index.js';
import { startAdapter } from '../engine/adapter-api/index.js';
import { adapterRoutes } from '../engine/http/server.js';
import { db } from '../engine/storage/db.js';
import { addSubscriber, upsertConnection, upsertTenant } from '../engine/storage/connections.js';
import { deliverLifecycleEvents } from '../engine/lifecycle.js';
import { clearRegistry } from '../engine/registry.js';
import type { Adapter } from '../engine/adapter-api/types.js';

export const TENANT = 't_test';
export const TOKEN = 'test-tenant-token';
export const ADMIN_SECRET = 'test-admin-secret';

export type Bell = { kind: string; tenant_id: string; secret: string | undefined };

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
  /** Add or change a connection of the test tenant. */
  connection(input: ConnectionInput): Promise<void>;
  /** Deliver queued lifecycle events, as the worker's tick would. */
  deliver(): Promise<void>;
  /** Stop and start Core again on the same port, as the platform does after a deploy or a restore. */
  restart(): Promise<void>;
  stop(): Promise<void>;
};

/** A running engine, a bell receiver, and whatever adapters a test needs. */
export async function harness(options: {
  adapters?: Adapter[];
  connections?: ConnectionInput[];
  subscriber?: boolean;
}): Promise<Harness> {
  clearRegistry();
  const adapters = options.adapters ?? [];

  let engine = await startEngine({ port: 0 });
  await truncate();

  const bells: Bell[] = [];
  const bellServer = await listen((request, respond) => {
    bells.push({
      kind: 'delta',
      tenant_id: TENANT,
      secret: request.headers['x-core-secret'] as string | undefined,
    });
    respond(200);
  });

  await upsertTenant({ id: TENANT, displayName: 'Test tenant', token: TOKEN });
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

  for (const adapter of adapters) await startAdapter(adapter);

  const running: Harness = {
    engine,
    baseUrl: `http://127.0.0.1:${port}`,
    bells,
    connection,
    deliver: async () => {
      await deliverLifecycleEvents();
    },
    async restart() {
      for (const adapter of adapters) await adapter.stop?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await engine.stop();
      engine = await startEngine({ port });
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

async function truncate(): Promise<void> {
  await db().query(
    'truncate tenants, connections, subscribers, items, heartbeats, events, lifecycle_events, health_results restart identity cascade',
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
