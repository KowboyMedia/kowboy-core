import { db } from './storage/db.js';
import { registeredHealthChecks } from './registry.js';
import { unknownMigrations } from './storage/migrate.js';
import { report } from './errors.js';
import type { HealthResult } from './adapter-api/types.js';

/**
 * `/v1/health` is 200 when every check passes and 500 when any fails, with the same payload either
 * way (strategy §8.1). Adapters add their own checks through the adapter API.
 */
export type HealthReport = {
  ok: boolean;
  checks: Record<string, { ok: boolean; detail?: string }>;
};

export const WORKER_HEARTBEAT_MS = 2 * 60_000;
export const SUBSCRIBER_IDLE_MS = 60 * 60_000;

export async function heartbeat(name = 'worker'): Promise<void> {
  await db().query(
    `insert into heartbeats (name, at) values ($1, now())
     on conflict (name) do update set at = now()`,
    [name],
  );
}

export async function healthReport(): Promise<HealthReport> {
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

  for (const [name, check] of registeredHealthChecks()) {
    checks[name] = await run(check);
  }

  return { ok: Object.values(checks).every((check) => check.ok), checks };
}

async function run(check: () => Promise<HealthResult> | HealthResult): Promise<HealthResult> {
  try {
    return await check();
  } catch (error) {
    report(error, { where: 'health' });
    return { ok: false, detail: String(error) };
  }
}
