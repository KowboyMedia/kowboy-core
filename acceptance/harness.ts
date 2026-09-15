import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { startEngine, type Engine } from '../engine/index.js';
import { startAdapter } from '../engine/adapter-api/index.js';
import { adapterRoutes } from '../engine/http/server.js';
import { db } from '../engine/storage/db.js';
import { addSubscriber, upsertConnection, upsertTenant } from '../engine/storage/connections.js';
import { clearRegistry } from '../engine/registry.js';
import type { Adapter } from '../engine/adapter-api/types.js';

export const TENANT = 't_test';
export const TOKEN = 'test-tenant-token';
export const ADMIN_SECRET = 'test-admin-secret';

export type Bell = { kind: string; tenant_id: string; secret: string | undefined };

export type Harness = {
  engine: Engine;
  baseUrl: string;
  bells: Bell[];
  stop(): Promise<void>;
};

/** A running engine, a bell receiver, and whatever adapters a test needs. */
export async function harness(options: {
  adapters?: Adapter[];
  connections?: { id: string; provider: string; licensedOffices?: string[] }[];
  subscriber?: boolean;
}): Promise<Harness> {
  clearRegistry();

  const engine = await startEngine({ port: 0 });
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
  for (const connection of options.connections ?? []) {
    await upsertConnection({
      id: connection.id,
      tenantId: TENANT,
      provider: connection.provider,
      licensedOffices: connection.licensedOffices ?? [],
    });
  }
  if (options.subscriber !== false) {
    await addSubscriber({
      tenantId: TENANT,
      label: 'test site',
      bellUrl: `http://127.0.0.1:${(bellServer.address() as AddressInfo).port}/bell`,
      bellSecret: 'bell-secret',
    });
  }

  const routes = (options.adapters ?? []).flatMap((adapter) =>
    adapterRoutes(adapter.manifest.provider, adapter.routes ?? []),
  );
  const server = engine.listen(routes);
  const port = (server.address() as AddressInfo).port;

  for (const adapter of options.adapters ?? []) await startAdapter(adapter);

  return {
    engine,
    baseUrl: `http://127.0.0.1:${port}`,
    bells,
    async stop() {
      for (const adapter of options.adapters ?? []) await adapter.stop?.();
      await new Promise<void>((resolve) => bellServer.close(() => resolve()));
      await engine.stop();
    },
  };
}

async function truncate(): Promise<void> {
  await db().query(
    'truncate tenants, connections, subscribers, items, heartbeats, events restart identity cascade',
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
