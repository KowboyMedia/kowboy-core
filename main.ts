// The entrypoint, and the only file that imports both the engine and the adapters
// (strategy §3.1 E2, §5.1).
//
//   node dist/main.js web      subscriber API, admin API and panel, health, and the adapters' own endpoints
//   node dist/main.js worker   the adapters' background work, bells, housekeeping
import { startEngine } from './engine/index.js';
import { adapterApi, startAdapter } from './engine/adapter-api/index.js';
import { adapterRoutes } from './engine/http/server.js';
import { adminRoutesFor } from './engine/admin/index.js';
import { closeErrorReporting, report } from './engine/errors.js';
import type { Adapter } from './engine/adapter-api/types.js';
import { vitecAdapter } from './adapters/vitec/index.js';

/**
 * Every adapter Core ships. Adding a CRM is adding a directory and one line here. The two fake
 * adapters live in the tests and local runs only (question 34, 2026-09-18).
 */
const adapters: Adapter[] = [vitecAdapter];

const role = process.argv[2] ?? 'web';
const engine = await startEngine();

// Both roles need the adapters' mappers in the registry: the worker to ingest, the web process to
// recompute a record and to render an adapter's raw-vs-mapped preview on its panel. Registering is
// separate from starting: only the worker runs the adapters' timers, loops and endpoints.
for (const adapter of adapters) {
  adapterApi(adapter.manifest.provider).register(adapter.manifest, adapter.mappers);
}

if (role === 'web') {
  const routes = adapters.flatMap((adapter) =>
    adapterRoutes(adapter.manifest.provider, adapter.routes ?? []),
  );
  // The admin panel (docs/admin-panel.md) lives in the web process, with the adapters' own panels.
  engine.listen([...routes, ...adminRoutesFor(engine, adapters)]);
  console.log(`web listening on ${engine.config.port}`);
} else if (role === 'worker') {
  engine.startWorker();
  for (const adapter of adapters) await startAdapter(adapter);
  console.log(`worker started with ${adapters.length} adapter(s)`);
} else {
  console.error(`unknown role "${role}"; expected web or worker`);
  process.exit(1);
}

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
