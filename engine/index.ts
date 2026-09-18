import type { Server } from 'node:http';
import { loadConfig, type Config } from './config.js';
import { initErrorReporting } from './errors.js';
import { closeDb, db } from './storage/db.js';
import { migrate } from './storage/migrate.js';
import { configureCredentials } from './storage/connections.js';
import { configureBells, flushPendingBells } from './bells.js';
import { configureMail, postmark } from './mail.js';
import { heartbeat, healthReport, readiness, recordHealth } from './health.js';
import { deliverLifecycleEvents } from './lifecycle.js';
import { deleteExpiredEvents, logEvent } from './events.js';
import { purgeTombstones } from './storage/items.js';
import { changes } from './http/changes.js';
import { applied } from './http/applied.js';
import { adminRoutes } from './http/admin.js';
import { configureCompression, jsonResponse, startServer, type RouteTable } from './http/server.js';

export const VERSION = '0.1.0';

/**
 * Every start moves the item sequence this far ahead (strategy §7.2). A database restored to an
 * earlier point then never hands out a seq a subscriber has already seen: nothing is skipped, and
 * nothing below a subscriber's cursor is served except what is written after the restore.
 */
export const SEQUENCE_JUMP = 1_000_000_000;
/** Tombstones are hard-deleted after 90 days (AC 26). */
export const TOMBSTONE_RETENTION_DAYS = 90;
const HEARTBEAT_MS = 30_000;
const BELL_FLUSH_MS = 1_000;
const HOUSEKEEPING_MS = 60 * 60_000;
/** How often the worker takes queued lifecycle events, and records the adapters' health checks. */
const LIFECYCLE_MS = 2_000;
const HEALTH_RECORD_MS = 30_000;

export type Engine = {
  config: Config;
  /** The engine's own HTTP routes. main.ts appends the adapters' routes. */
  routes: RouteTable;
  listen(extraRoutes?: RouteTable): Server;
  /** Worker-role background work: heartbeat, event retention, tombstone purge. */
  startWorker(): void;
  stop(): Promise<void>;
};

/** The jump described above, logged so a restore's recovery can be followed in the event log. */
async function advanceSequence(): Promise<void> {
  const { rows } = await db().query<{ last_value: string }>(
    `select setval('item_seq', last_value + $1) as last_value from item_seq`,
    [SEQUENCE_JUMP],
  );
  const to = Number(rows[0]?.last_value ?? 0);
  await logEvent({
    type: 'engine.started',
    fields: { version: VERSION, seq_from: to - SEQUENCE_JUMP, seq_to: to },
  });
}

/** Start the engine: config, database, migrations, routes. No CRM knowledge anywhere in here. */
export async function startEngine(overrides: Partial<Config> = {}): Promise<Engine> {
  const config = { ...loadConfig(), ...overrides };
  initErrorReporting(config.sentryDsn);
  db(config.databaseUrl);
  await migrate();
  await advanceSequence();
  configureCredentials(config.credentialsKey);
  configureBells(config.bellThrottleMs);
  configureCompression(config.gzipLevel);
  configureMail(
    config.postmarkServerToken && config.mailFrom
      ? postmark(config.postmarkServerToken, config.mailFrom)
      : null,
  );

  const routes: RouteTable = [
    { method: 'GET', path: '/v1/changes', handler: changes },
    { method: 'POST', path: '/v1/applied', handler: applied },
    {
      method: 'GET',
      path: '/v1/health',
      handler: async () => {
        const health = await healthReport();
        return jsonResponse(health.ok ? 200 : 500, { ...health, version: VERSION });
      },
    },
    {
      method: 'GET',
      path: '/v1/ready',
      handler: async () => {
        const ready = await readiness();
        return jsonResponse(ready.ok ? 200 : 500, { ...ready, version: VERSION });
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
      tick(() => flushPendingBells(), BELL_FLUSH_MS);
      tick(() => deliverLifecycleEvents(), LIFECYCLE_MS);
      tick(() => recordHealth(), HEALTH_RECORD_MS);
      tick(async () => {
        await deleteExpiredEvents(config.eventRetentionDays);
        await purgeTombstones(TOMBSTONE_RETENTION_DAYS);
      }, HOUSEKEEPING_MS);
    },
    async stop(): Promise<void> {
      for (const timer of timers) clearInterval(timer);
      await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
      await closeDb();
    },
  };
}
