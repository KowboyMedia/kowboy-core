// The entrypoint, and the only file that imports both the engine and the adapters
// (strategy §3.1 E2, §5.1).
//
//   node dist/main.js web      subscriber API, admin API and panel, health, and the adapters' own endpoints
//   node dist/main.js worker   the adapters' background work, bells, housekeeping
import { startEngine } from './engine/index.js';
import { startAdapter } from './engine/adapter-api/index.js';
import { adapterRoutes } from './engine/http/server.js';
import { adminRoutesFor } from './engine/admin/index.js';
import { report } from './engine/errors.js';
import type { Adapter } from './engine/adapter-api/types.js';
import { fakeWebhookAdapter } from './adapters/fake-webhook/index.js';
import { fakePollingAdapter } from './adapters/fake-polling/index.js';
import { vitecAdapter } from './adapters/vitec/index.js';

/** Every adapter Core ships. Adding a CRM is adding a directory and one line here. */
const adapters: Adapter[] = [fakeWebhookAdapter, fakePollingAdapter, vitecAdapter];

const role = process.argv[2] ?? 'web';
const engine = await startEngine();

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
    .finally(() => process.exit(0));
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
