import type { Server } from 'node:http';
import { loadConfig, type Config } from './config.js';
import { initErrorReporting } from './errors.js';
import { closeDb, db } from './storage/db.js';
import { migrate } from './storage/migrate.js';
import { configureCredentials } from './storage/connections.js';
import { configureBells, stopBells } from './bells.js';
import { heartbeat, healthReport } from './health.js';
import { dropExpiredEventPartitions } from './events.js';
import { purgeTombstones } from './storage/items.js';
import { changes } from './http/changes.js';
import { adminRoutes } from './http/admin.js';
import { configureCompression, jsonResponse, startServer, type RouteTable } from './http/server.js';

export const VERSION = '0.1.0';

/** Tombstones are hard-deleted after 90 days (AC 26). */
const TOMBSTONE_RETENTION_DAYS = 90;
const HEARTBEAT_MS = 30_000;
const HOUSEKEEPING_MS = 60 * 60_000;

export type Engine = {
  config: Config;
  /** The engine's own HTTP routes. main.ts appends the adapters' routes. */
  routes: RouteTable;
  listen(extraRoutes?: RouteTable): Server;
  /** Worker-role background work: heartbeat, event retention, tombstone purge. */
  startWorker(): void;
  stop(): Promise<void>;
};

/** Start the engine: config, database, migrations, routes. No CRM knowledge anywhere in here. */
export async function startEngine(overrides: Partial<Config> = {}): Promise<Engine> {
  const config = { ...loadConfig(), ...overrides };
  initErrorReporting(config.sentryDsn);
  db(config.databaseUrl);
  await migrate();
  configureCredentials(config.credentialsKey);
  configureBells(config.bellThrottleMs);
  configureCompression(config.gzipLevel);

  const routes: RouteTable = [
    { method: 'GET', path: '/v1/changes', handler: changes },
    {
      method: 'GET',
      path: '/v1/health',
      handler: async () => {
        const health = await healthReport();
        return jsonResponse(health.ok ? 200 : 500, { ...health, version: VERSION });
      },
    },
    ...adminRoutes(config.adminSecret),
  ];

  let server: Server | null = null;
  const timers: NodeJS.Timeout[] = [];

  return {
    config,
    routes,
    listen(extraRoutes: RouteTable = []): Server {
      server = startServer([...routes, ...extraRoutes], config.port);
      return server;
    },
    startWorker(): void {
      const tick = (fn: () => Promise<unknown>, everyMs: number) => {
        void fn();
        const timer = setInterval(() => void fn(), everyMs);
        timer.unref?.();
        timers.push(timer);
      };
      tick(() => heartbeat(), HEARTBEAT_MS);
      tick(async () => {
        await dropExpiredEventPartitions(config.eventRetentionDays);
        await purgeTombstones(TOMBSTONE_RETENTION_DAYS);
      }, HOUSEKEEPING_MS);
    },
    async stop(): Promise<void> {
      for (const timer of timers) clearInterval(timer);
      stopBells();
      await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
      await closeDb();
    },
  };
}
