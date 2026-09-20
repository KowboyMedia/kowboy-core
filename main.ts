// The entrypoint, and the only file that imports both the engine and the adapters
// (strategy §3.1 E2, §5.1).
//
//   node dist/main.js web      subscriber API, health, and the adapters' own endpoints
//   node dist/main.js worker   the adapters' background work, bells, housekeeping
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { pathToFileURL } from 'node:url';
import { startEngine, type Engine } from './engine/index.js';
import { adapterApi, startAdapter } from './engine/adapter-api/index.js';
import { adapterRoutes } from './engine/http/server.js';
import { closeErrorReporting, report } from './engine/errors.js';
import type { Adapter } from './engine/adapter-api/types.js';
import { vitecAdapter } from './adapters/vitec/index.js';

/**
 * Every adapter Core ships. Adding a CRM is adding a directory and one line here. The two fake
 * adapters live in the tests and local runs only (question 34, 2026-09-18).
 */
const adapters: Adapter[] = [vitecAdapter];

/**
 * One role of Core, as `node dist/main.js <role>` runs it. A function so the acceptance tests can
 * start the web role exactly as deployed, with no adapter started.
 */
export async function main(role: string): Promise<{ engine: Engine; server: Server | null }> {
  const engine = await startEngine();

  // Both roles need every adapter's mappers in the registry: the worker to ingest, and the web
  // process to recompute a record from stored raw, with no CRM traffic and no adapter started. Starting an adapter (its timers, loops and endpoints) is the
  // worker's alone. Without this the web process answered every recompute with "no adapter
  // registered for this connection" (found on staging, 2026-09-20).
  for (const adapter of adapters) {
    adapterApi(adapter.manifest.provider).register(adapter.manifest, adapter.mappers);
  }

  if (role === 'web') {
    const routes = adapters.flatMap((adapter) =>
      adapterRoutes(adapter.manifest.provider, adapter.routes ?? []),
    );
    const server = engine.listen(routes);
    console.log(`web listening on ${(server.address() as AddressInfo).port}`);
    return { engine, server };
  }
  if (role === 'worker') {
    engine.startWorker();
    for (const adapter of adapters) await startAdapter(adapter);
    console.log(`worker started with ${adapters.length} adapter(s)`);
    return { engine, server: null };
  }
  await engine.stop();
  throw new Error(`unknown role "${role}"; expected web or worker`);
}

// Run when started as the program, not when a test imports it.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { engine } = await main(process.argv[2] ?? 'web').catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });

  const shutdown = (signal: string): void => {
    console.log(`${signal}: shutting down`);
    void Promise.all(adapters.map((adapter) => adapter.stop?.()))
      .then(() => engine.stop())
      .catch((error: unknown) => report(error, { where: 'shutdown' }))
      .then(() => closeErrorReporting())
      .finally(() => process.exit(0));
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
