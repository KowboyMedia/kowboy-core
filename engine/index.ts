import type { Server } from 'node:http';
import { loadConfig, type Config } from './config.js';
import { initErrorReporting, report } from './errors.js';
import { closeDb, db } from './storage/db.js';
import { migrate } from './storage/migrate.js';
import { configureCredentials } from './storage/connections.js';
import { configureBells, flushPendingBells } from './bells.js';
import { configureMail, ses } from './mail.js';
import {
  down,
  forViewers,
  heartbeat,
  healthReport,
  pruneHealth,
  readiness,
  recordHealth,
} from './health.js';
import { deliverLifecycleEvents } from './lifecycle.js';
import { deleteExpiredEvents, logEvent, stripChangeValues } from './events.js';
import { failStaleJobs, runNextJob } from './jobs.js';
import { checkAlerts } from './alerts.js';
import { fillPageParts, purgeTombstones } from './storage/items.js';
import { changes } from './http/changes.js';
import { applied } from './http/applied.js';
import { siteError } from './http/errors.js';
import { botCheck, slots, submit } from './http/submissions.js';
import { configureLiveService } from './registry.js';
import {
  configureBotCheckList,
  configureHumanCheck,
  TEST_SECRET,
  TEST_SITE_KEY,
  turnstile,
} from './human.js';
import { deleteExpiredSubmissions } from './storage/submissions.js';
import { configureCompression, jsonResponse, startServer, type RouteTable } from './http/server.js';
import { SEQUENCE_JUMP, TOMBSTONE_RETENTION_DAYS, VERSION } from './version.js';
import { configurePanel, panelRoutes } from './panel/index.js';
import { readListNames } from './panel/recordlist.js';
import { deleteExpiredSessions } from './panel/auth.js';

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
/** How long a stop waits for the worker's running tasks, so a stuck one never holds up a deploy. */
const STOP_WAIT_MS = 10_000;

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
  configureBells(config.bellThrottleMs);
  configureCompression(config.gzipLevel);
  configureMail(config.ses ? ses(config.ses, config.ses.sender) : null);
  configurePanel(config);
  const alerts = {
    environment: config.environment,
    publicUrl: config.publicUrl,
    email: config.alertEmail,
    slackWebhookUrl: config.alertSlackWebhookUrl,
  };
  // The bot check's keys; outside production, without them, Cloudflare's test keys, so the check
  // runs there too and never silently not at all. Production without them refuses every form.
  configureHumanCheck(
    config.turnstileSiteKey && config.turnstileSecret
      ? turnstile(config.turnstileSiteKey, config.turnstileSecret)
      : config.environment === 'production'
        ? null
        : turnstile(TEST_SITE_KEY, TEST_SECRET),
  );
  configureBotCheckList(
    config.cloudflareAccountId && config.cloudflareTurnstileToken
      ? { accountId: config.cloudflareAccountId, token: config.cloudflareTurnstileToken }
      : null,
  );
  // Only the live service writes to a live CRM (question 152); staging and local stop before it,
  // in the registry, the one place the engine gets an adapter's send, unless the adapter says the
  // connection is its own test system (question 181).
  configureLiveService({ live: config.environment === 'production' });

  const routes: RouteTable = [
    // The admin panel (design B): its API under /v1/panel/, its app under /admin.
    ...panelRoutes(),
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
        // Public, for an outside monitor: 500 only while Core is down for every customer (a P0
        // check fails, question 173), with counts and plain words only.
        const health = await healthReport();
        return jsonResponse(down(health) ? 500 : 200, { ...forViewers(health), version: VERSION });
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
  /** The worker's tasks running now: a stop lets them finish before it closes the database. */
  const running = new Set<Promise<void>>();
  let stopping = false;

  return {
    config,
    routes,
    listen(extraRoutes: RouteTable = []): Server {
      server = startServer([...routes, ...extraRoutes], config.port);
      // The records list's names, read once now so the list's first load needs no wait. A stop
      // waits for it as for the worker's tasks.
      const names: Promise<void> = readListNames()
        .catch((error: unknown) => report(error, { where: 'panel record names' }))
        .finally(() => running.delete(names));
      running.add(names);
      return server;
    },
    startWorker(): void {
      // A task's failure is reported where it happened, so it never ends the process and goes
      // through the error tracker's daily gate like every other report.
      const tick = (where: string, fn: () => Promise<unknown>, everyMs: number) => {
        const run = () => {
          const task: Promise<void> = fn()
            .then(() => undefined)
            .catch((error: unknown) => report(error, { where }))
            .finally(() => running.delete(task));
          running.add(task);
        };
        run();
        const timer = setInterval(run, everyMs);
        timer.unref?.();
        timers.push(timer);
      };
      // The parts of the records stored before parts were (question 227), made once, in the
      // background; until a record has its part, pages make it as they are sent. Then the values
      // leave the log lines written before it kept none (question 228). One after the other, so
      // they hold one of the worker's two connections at a time and every other task keeps one.
      let cleaned = false;
      const strip = async (): Promise<void> => {
        const stripped = await stripChangeValues(() => stopping);
        if (stripped.lines > 0) {
          console.log(
            `kept only the names of the changed fields in ${String(stripped.lines)} log lines: ${String(stripped.bytesBefore)} bytes before, ${String(stripped.bytesAfter)} after`,
          );
        }
      };
      const fill: Promise<void> = fillPageParts(() => stopping)
        .then((filled) => {
          if (filled > 0) console.log(`made the page parts of ${String(filled)} stored records`);
        })
        .catch((error: unknown) => report(error, { where: 'page parts' }))
        .then(() => strip())
        .catch((error: unknown) => report(error, { where: 'log values' }))
        .finally(() => {
          cleaned = true;
          running.delete(fill);
        });
      running.add(fill);
      tick('heartbeat', () => heartbeat(), HEARTBEAT_MS);
      tick('bells', () => flushPendingBells(), BELL_FLUSH_MS);
      tick('lifecycle events', () => deliverLifecycleEvents(), LIFECYCLE_MS);
      tick(
        'jobs',
        async () => {
          while (!stopping && (await runNextJob())) {
            // one job after another, until the queue is empty or Core stops
          }
        },
        JOBS_MS,
      );
      tick('alerts', () => checkAlerts(alerts), ALERTS_MS);
      tick(
        'health record',
        async () => {
          await recordHealth();
          await pruneHealth();
        },
        HEALTH_RECORD_MS,
      );
      tick(
        'housekeeping',
        async () => {
          await deleteExpiredEvents(config.eventRetentionDays);
          // The lines an older version still wrote during the deploy, once the first round is done.
          if (cleaned) await strip();
          await deleteExpiredSubmissions(config.eventRetentionDays);
          await purgeTombstones(TOMBSTONE_RETENTION_DAYS);
          await deleteExpiredSessions();
        },
        HOUSEKEEPING_MS,
      );
      tick('stale jobs', () => failStaleJobs(), ALERTS_MS);
    },
    async stop(): Promise<void> {
      stopping = true;
      for (const timer of timers) clearInterval(timer);
      await new Promise<void>((resolve) => {
        if (!server) return resolve();
        server.close(() => resolve());
        // A page's live feed never ends on its own; a stop must not wait for it.
        server.closeAllConnections();
      });
      // A task already running finishes first, so none meets a closed database (seen on staging
      // at every deploy, 2026-10-06 to 2026-10-18), and one that hangs is left after a while.
      await Promise.race([
        Promise.all(running),
        new Promise((resolve) => setTimeout(resolve, STOP_WAIT_MS).unref()),
      ]);
      await closeDb();
    },
  };
}
