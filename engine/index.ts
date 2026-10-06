import type { Server } from 'node:http';
import { loadConfig, type Config } from './config.js';
import { initErrorReporting } from './errors.js';
import { closeDb, db } from './storage/db.js';
import { migrate } from './storage/migrate.js';
import { configureCredentials } from './storage/connections.js';
import { configureBells, flushPendingBells } from './bells.js';
import { configureMail, postmark } from './mail.js';
import {
  forViewers,
  heartbeat,
  healthReport,
  pruneHealth,
  readiness,
  recordHealth,
} from './health.js';
import { deliverLifecycleEvents } from './lifecycle.js';
import { deleteExpiredEvents, listenToEvents, logEvent } from './events.js';
import { failStaleJobs, runNextJob } from './jobs.js';
import { checkAlerts, watchEvents } from './alerts.js';
import { purgeTombstones } from './storage/items.js';
import { changes } from './http/changes.js';
import { applied } from './http/applied.js';
import { siteError } from './http/errors.js';
import { botCheck, configureSubmissions, slots, submit } from './http/submissions.js';
import { configureHumanCheck, turnstile } from './human.js';
import { configureSubmissionContent, deleteExpiredSubmissions } from './storage/submissions.js';
import { configureCompression, jsonResponse, startServer, type RouteTable } from './http/server.js';
import { SEQUENCE_JUMP, TOMBSTONE_RETENTION_DAYS, VERSION } from './version.js';
import { adminRoutes, configureAdmin } from './admin/index.js';
import { deleteExpiredSessions } from './admin/auth.js';

export { SEQUENCE_JUMP, STARTED_AT, TOMBSTONE_RETENTION_DAYS, VERSION } from './version.js';

const HEARTBEAT_MS = 30_000;
const BELL_FLUSH_MS = 1_000;
const HOUSEKEEPING_MS = 60 * 60_000;
/** How often the worker takes queued lifecycle events and jobs, and records the adapters' health checks. */
const LIFECYCLE_MS = 2_000;
const JOBS_MS = 2_000;
const HEALTH_RECORD_MS = 30_000;
/** How often the worker compares the health checks with their last state and tells a change. */
const ALERTS_MS = 60_000;

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
  initErrorReporting(config.sentryDsn, { environment: config.environment, release: VERSION });
  db(config.databaseUrl);
  await migrate();
  await advanceSequence();
  configureCredentials(config.credentialsKey);
  configureSubmissionContent(config.credentialsKey);
  configureBells(config.bellThrottleMs);
  configureCompression(config.gzipLevel);
  configureMail(
    config.postmarkServerToken && config.mailFrom
      ? postmark(config.postmarkServerToken, config.mailFrom)
      : null,
  );
  configureAdmin(config);
  const alerts = {
    environment: config.environment,
    publicUrl: config.publicUrl,
    email: config.alertEmail,
    slackWebhookUrl: config.alertSlackWebhookUrl,
  };
  watchEvents(alerts);
  configureHumanCheck(
    config.turnstileSiteKey && config.turnstileSecret
      ? turnstile(config.turnstileSiteKey, config.turnstileSecret)
      : null,
  );
  // Forms reach a CRM only from the live service (question 152); staging and local stop before it.
  configureSubmissions({ live: config.environment === 'production' });

  const routes: RouteTable = [
    ...adminRoutes(),
    { method: 'GET', path: '/v1/changes', handler: changes },
    { method: 'POST', path: '/v1/applied', handler: applied },
    { method: 'POST', path: '/v1/errors', handler: siteError },
    { method: 'POST', path: '/v1/submissions', handler: submit },
    { method: 'GET', path: '/v1/submissions/slots', handler: slots },
    { method: 'GET', path: '/v1/submissions/bot-check', handler: botCheck },
    {
      method: 'GET',
      path: '/v1/health',
      handler: async () => {
        // Public, for an uptime monitor: 500 while any check fails, counts and plain words only.
        const health = forViewers(await healthReport());
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
      tick(async () => {
        while (await runNextJob()) {
          // one job after another, until the queue is empty
        }
      }, JOBS_MS);
      tick(() => checkAlerts(alerts), ALERTS_MS);
      tick(async () => {
        await recordHealth();
        await pruneHealth();
      }, HEALTH_RECORD_MS);
      tick(async () => {
        await deleteExpiredEvents(config.eventRetentionDays);
        await deleteExpiredSubmissions(config.eventRetentionDays);
        await purgeTombstones(TOMBSTONE_RETENTION_DAYS);
        await deleteExpiredSessions();
      }, HOUSEKEEPING_MS);
      tick(() => failStaleJobs(), ALERTS_MS);
    },
    async stop(): Promise<void> {
      for (const timer of timers) clearInterval(timer);
      listenToEvents(null);
      await new Promise<void>((resolve) => {
        if (!server) return resolve();
        server.close(() => resolve());
        // A page's live feed never ends on its own; a stop must not wait for it.
        server.closeAllConnections();
      });
      await closeDb();
    },
  };
}
