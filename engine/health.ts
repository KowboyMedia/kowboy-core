import { db } from './storage/db.js';
import { registeredHealthChecks } from './registry.js';
import { unknownMigrations } from './storage/migrate.js';
import { undeliveredLifecycleEvents } from './lifecycle.js';
import { report } from './errors.js';
import type { HealthResult } from './adapter-api/types.js';

/**
 * `GET /v1/health` is 200 when every check passes and 500 when any fails, with the same payload
 * either way (strategy §8.1). `GET /v1/ready` is the platform's readiness probe: this process can
 * serve, nothing about adapters or sites, so a deploy is never held up by a site that stopped
 * pulling or an adapter still catching up.
 */
export type HealthReport = {
  ok: boolean;
  checks: Record<string, { ok: boolean; detail?: string }>;
};

export const WORKER_HEARTBEAT_MS = 2 * 60_000;
export const SUBSCRIBER_IDLE_MS = 60 * 60_000;
/** A check another process recorded longer ago than this is missing: that process is not reporting. */
export const RECORDED_STALE_MS = 2 * 60_000;
/** A lifecycle event waiting longer than this has no worker to deliver it. */
export const LIFECYCLE_WAIT_MS = 5 * 60_000;

export async function heartbeat(name = 'worker'): Promise<void> {
  await db().query(
    `insert into heartbeats (name, at) values ($1, now())
     on conflict (name) do update set at = now()`,
    [name],
  );
}

/** Readiness: the database answers and holds no migration this app does not ship. */
export async function readiness(): Promise<HealthReport> {
  const checks: HealthReport['checks'] = {};

  checks['database'] = await run(async () => {
    await db().query('select 1');
    return { ok: true };
  });

  checks['schema'] = await run(async () => {
    const unknown = await unknownMigrations();
    return unknown.length === 0
      ? { ok: true }
      : { ok: false, detail: `the database is ahead of this app: ${unknown.join(', ')}` };
  });

  return { ok: Object.values(checks).every((check) => check.ok), checks };
}

export async function healthReport(): Promise<HealthReport> {
  const checks = (await readiness()).checks;

  checks['worker'] = await run(async () => {
    const { rows } = await db().query<{ age_ms: string | null }>(
      "select extract(epoch from (now() - at)) * 1000 as age_ms from heartbeats where name = 'worker'",
    );
    const age =
      rows[0]?.age_ms === undefined || rows[0]?.age_ms === null ? null : Number(rows[0].age_ms);
    if (age === null) return { ok: false, detail: 'the worker has never reported in' };
    return age <= WORKER_HEARTBEAT_MS
      ? { ok: true }
      : { ok: false, detail: `last heartbeat ${Math.round(age / 1000)} s ago` };
  });

  checks['subscribers'] = await run(async () => {
    const { rows } = await db().query<{ label: string }>(
      `select label from subscribers
       where active = true
         and (last_pull_at is null or last_pull_at < now() - ($1 || ' milliseconds')::interval)`,
      [SUBSCRIBER_IDLE_MS],
    );
    return rows.length === 0
      ? { ok: true }
      : { ok: false, detail: `not pulling: ${rows.map((row) => row.label).join(', ')}` };
  });

  checks['lifecycle'] = await run(async () => {
    const waiting = await undeliveredLifecycleEvents(LIFECYCLE_WAIT_MS);
    return waiting === 0
      ? { ok: true }
      : { ok: false, detail: `${waiting} lifecycle event(s) waiting for the worker` };
  });

  Object.assign(checks, await adapterChecks());
  return { ok: Object.values(checks).every((check) => check.ok), checks };
}

/**
 * Adapter checks run where the adapters run. This process runs and records its own; whatever
 * another process recorded is read back, and counts as failed once it is stale.
 */
async function adapterChecks(): Promise<HealthReport['checks']> {
  const checks = await recordHealth();
  const { rows } = await db().query<{
    name: string;
    ok: boolean;
    detail: string | null;
    age_ms: string;
  }>(
    'select name, ok, detail, extract(epoch from (now() - at)) * 1000 as age_ms from health_results',
  );
  for (const row of rows) {
    if (row.name in checks) continue;
    const age = Number(row.age_ms);
    checks[row.name] =
      age <= RECORDED_STALE_MS
        ? { ok: row.ok, ...(row.detail ? { detail: row.detail } : {}) }
        : { ok: false, detail: `no report for ${Math.round(age / 1000)} s` };
  }
  return checks;
}

/** Run the checks registered in this process and record them for the other one. The worker's tick. */
export async function recordHealth(): Promise<HealthReport['checks']> {
  const checks: HealthReport['checks'] = {};
  for (const [name, check] of registeredHealthChecks()) {
    const result = await run(check);
    checks[name] = result;
    await db().query(
      `insert into health_results (name, ok, detail, at) values ($1, $2, $3, now())
       on conflict (name) do update set ok = excluded.ok, detail = excluded.detail, at = now()`,
      [name, result.ok, result.detail ?? null],
    );
  }
  return checks;
}

async function run(check: () => Promise<HealthResult> | HealthResult): Promise<HealthResult> {
  try {
    return await check();
  } catch (error) {
    report(error, { where: 'health' });
    return { ok: false, detail: String(error) };
  }
}
