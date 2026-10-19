// The entrypoint, and the only file that imports both the engine and the adapters
// (strategy §3.1 E2, §5.1).
//
//   node dist/main.js web      subscriber API, health, and the adapters' own endpoints
//   node dist/main.js worker   the adapters' background work, bells, housekeeping
//   node dist/main.js preview  the release impact preview, the release's first step: every
//                              stored record through this version, nothing written
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { pathToFileURL } from 'node:url';
import { startEngine, type Engine } from './engine/index.js';
import { adapterApi, startAdapter } from './engine/adapter-api/index.js';
import { registerAdmin, registerSubmissions } from './engine/registry.js';
import { adapterRoutes } from './engine/http/server.js';
import { removeLoginFields } from './engine/admin/login.js';
import { closeErrorReporting, report } from './engine/errors.js';
import { databaseUrl } from './engine/config.js';
import { markDemoTenants } from './engine/demo-tenants.js';
import { previewInWords, previewRelease } from './engine/preview.js';
import type { Adapter } from './engine/adapter-api/types.js';
import { vitecAdapter } from './adapters/vitec/index.js';

/**
 * Every adapter Core ships. Adding a CRM is adding a directory and one line here. The two fake
 * adapters live in the tests and local runs only (question 34, 2026-09-18).
 */
export const adapters: Adapter[] = [vitecAdapter];

/**
 * Every role needs every adapter's mappers in the registry: the worker to ingest, the web process
 * to recompute a record from stored raw, and the preview to map every record, with no CRM traffic
 * and no adapter started. Starting an adapter (its timers, loops and endpoints) is the worker's
 * alone. Without this the web process answered every recompute with "no adapter registered for
 * this connection" (found on staging, 2026-09-20).
 */
function registerAdapters(): void {
  for (const adapter of adapters) {
    adapterApi(adapter.manifest.provider).register(adapter.manifest, adapter.mappers);
    // The admin area runs in the web process while the adapter runs in the worker, so both roles
    // register what the adapter shows and does there (docs/admin-panel-design.md §3).
    if (adapter.admin) registerAdmin(adapter.manifest.provider, adapter.admin);
    // A site's form is answered by the web process, which asks the CRM through the adapter and
    // waits inside the request (docs/forms.md, the departure approved with question 130).
    registerSubmissions(adapter.manifest.provider, adapter);
  }
}

/**
 * The release impact preview, as the release's first step runs it: this version's mappers and
 * rules over every record in the database being released, with no migration run and nothing
 * written. Prints the release note's lines and answers the exit code: 1 stops the release.
 */
export async function preview(): Promise<number> {
  registerAdapters();
  const result = await previewRelease(databaseUrl());
  for (const line of previewInWords(result)) console.log(line);
  return result.failed === 0 ? 0 : 1;
}

/**
 * One role of Core, as `node dist/main.js <role>` runs it. A function so the acceptance tests can
 * start the web role exactly as deployed, with no adapter started.
 */
export async function main(role: string): Promise<{ engine: Engine; server: Server | null }> {
  const engine = await startEngine();
  registerAdapters();

  if (role === 'web') {
    const routes = adapters.flatMap((adapter) =>
      adapterRoutes(adapter.manifest.provider, adapter.routes ?? []),
    );
    const server = engine.listen(routes);
    console.log(`web listening on ${(server.address() as AddressInfo).port}`);
    return { engine, server };
  }
  if (role === 'worker') {
    // One-time (Patric's rule for a removed feature, 2026-10-06; questions 174 and 179 yes): the
    // seven forms fields and the CRM password a Vitec connection no longer has leave the stored
    // logins. Ships with the next release and comes out in the first commit after production's
    // worker log shows it ran.
    try {
      const cleaned = await removeLoginFields(vitecAdapter.manifest.provider, [
        'send_forms',
        'lead_source_id',
        'assignment_source_id',
        'interest_status',
        'confirm_by_email',
        'confirm_by_sms',
        'reminder_minutes',
        'crm_password',
      ]);
      console.log(`removed the old forms fields and CRM password from ${cleaned} stored login(s)`);
    } catch (error) {
      report(error, { where: 'removing the old forms fields' });
    }
    // One-off on staging only; see engine/demo-tenants.ts.
    if (engine.config.environment === 'staging') {
      try {
        for (const line of await markDemoTenants()) console.log(`demo tenants: ${line}`);
      } catch (error) {
        report(error, { where: 'marking the demo tenants' });
      }
    }
    engine.startWorker();
    for (const adapter of adapters) await startAdapter(adapter);
    console.log(`worker started with ${adapters.length} adapter(s)`);
    return { engine, server: null };
  }
  await engine.stop();
  throw new Error(`unknown role "${role}"; expected web, worker or preview`);
}

// Run when started as the program, not when a test imports it.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === 'preview') {
    process.exit(
      await preview().catch((error: unknown) => {
        console.error(`The release preview could not run: ${String(error)}`);
        return 1;
      }),
    );
  }
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
