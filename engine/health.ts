import { db } from './storage/db.js';
import { registeredHealthChecks } from './registry.js';
import { unknownMigrations } from './storage/migrate.js';
import { undeliveredLifecycleEvents } from './lifecycle.js';
import { connectionsWithFailingSubmissions } from './storage/submissions.js';
import { report } from './errors.js';
import { counted, lasting } from './admin/words.js';
import type { HealthResult, Level } from './adapter-api/types.js';

/**
 * Every check Core runs, each failing one with its level (question 172). `GET /v1/health` answers
 * 500 only while a P0 check fails, Core down for every customer, and 200 otherwise, with the same
 * payload either way, so an outside monitor reads an error as "Core is down" (question 173).
 * `GET /v1/ready` is the platform's readiness probe: this process can serve, nothing about adapters
 * or sites, so a deploy is never held up by a site that stopped fetching or an adapter still
 * catching up.
 */
export type HealthReport = {
  ok: boolean;
  checks: Record<string, HealthResult>;
};

/** A failing check's level. One that fails without a level counts as P1 (question 172). */
export const levelOf = (check: HealthResult): Level => check.level ?? 'P1';

/** Core is down for every customer: a P0 check fails. */
export const down = (health: HealthReport): boolean =>
  Object.values(health.checks).some((check) => !check.ok && levelOf(check) === 'P0');

/**
 * The report as `/v1/health` answers it to anyone, an uptime monitor included: every check with
 * its counts and plain words, the names left out (Patric, 2026-09-20, question 62).
 */
export const forViewers = (report: HealthReport): HealthReport => ({
  ok: report.ok,
  checks: Object.fromEntries(
    Object.entries(report.checks).map(([name, check]) => [
      name,
      { ok: check.ok, ...(check.detail ? { detail: check.detail } : {}) },
    ]),
  ),
});

export const WORKER_HEARTBEAT_MS = 2 * 60_000;
/** A site Core told about changes longer ago than this, and that has not fetched since, is behind. */
export const SITE_BEHIND_MS = 60 * 60_000;
/** A check another process recorded longer ago than this is missing: that process is not reporting. */
export const RECORDED_STALE_MS = 2 * 60_000;
/** A lifecycle event waiting longer than this has no worker to deliver it. */
export const LIFECYCLE_WAIT_MS = 5 * 60_000;
/** A lifecycle event waiting longer than this makes the wait P1 (question 172). */
export const LIFECYCLE_LONG_MS = 60 * 60_000;
/** A check that cannot run is P2, and P1 once it has not run for this long (rule E). */
export const CANNOT_RUN_MS = 15 * 60_000;

/** The check that watches the sites' fetches. */
export const SITES_CHECK = 'subscribers';

/** Where a check is put right in the admin area. */
export type Page = { to: string; label: string };

/** What a person reads about a check: its title, never its name, and the page where it is put right. */
export type About = { title: string; page: Page };

/** The engine's own checks, in words (AGENTS.md, definition of done item 5). */
const ABOUT: Record<string, About> = {
  database: { title: 'Core’s database', page: { to: '/settings', label: 'Settings' } },
  schema: { title: 'The database’s version', page: { to: '/settings', label: 'Settings' } },
  worker: { title: 'Core’s worker', page: { to: '/settings', label: 'Settings' } },
  [SITES_CHECK]: {
    title: 'Sites fetching their changes',
    page: { to: '/tenants', label: 'Tenants' },
  },
  lifecycle: {
    title: 'Work asked for in the admin area',
    page: { to: '/flow', label: 'Flow' },
  },
  'submissions.failing': {
    title: 'Forms reaching the CRMs',
    page: { to: '/forms', label: 'Failed forms' },
  },
};

/**
 * A check in words. A CRM's check is shown on its CRM's page: its name starts with the CRM's
 * short name ("somecrm.catch_up"), and it has no title of its own yet.
 */
export function aboutCheck(name: string): About {
  const about = ABOUT[name];
  if (about) return about;
  const provider = name.split('.')[0] ?? name;
  return { title: name, page: { to: `/crms/${provider}`, label: `the ${provider} page` } };
}

export type SiteBehind = { id: number; tenantId: number; label: string; lastPullAt: Date | null };

/**
 * The sites that are behind (question 172): Core told the site about changes more than an hour
 * ago, and it has not fetched since. A quiet site is fine: with nothing new it is not told, and its
 * own timer runs only when someone visits it. A site told about changes since its last fetch, which
 * is older than an hour, is behind when its latest message is older than an hour too, or else when
 * the event log holds an earlier one older than an hour, read back from that hour.
 */
export async function sitesBehind(): Promise<SiteBehind[]> {
  const { rows } = await db().query<{
    id: string;
    tenant_id: number;
    label: string;
    last_pull_at: Date | null;
  }>(
    `select s.id, s.tenant_id, s.label, s.last_pull_at
     from subscribers s
     join tenants t on t.id = s.tenant_id and t.active
     where s.active
       and s.last_bell_at > coalesce(s.last_pull_at, '-infinity')
       and coalesce(s.last_pull_at, '-infinity') < now() - $1::interval
       and case
         when s.last_bell_at < now() - $1::interval then true
         else (
           select e.at from events e
           where e.type = 'bell' and e.subscriber_id = s.id
             and e.at > coalesce(s.last_pull_at, '-infinity') and e.at < now() - $1::interval
           order by e.at desc
           limit 1
         ) is not null
       end
     order by s.id`,
    [`${String(SITE_BEHIND_MS)} milliseconds`],
  );
  return rows.map((row) => ({
    id: Number(row.id),
    tenantId: row.tenant_id,
    label: row.label,
    lastPullAt: row.last_pull_at,
  }));
}

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

  checks['database'] = await run('database', async () => {
    try {
      await db().query('select 1');
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        level: 'P0',
        detail: `Core cannot reach its database (${String(error)}), so nothing works: no site gets changes and no form is sent.`,
      };
    }
  });

  checks['schema'] = await run('schema', async () => {
    const unknown = await unknownMigrations();
    return unknown.length === 0
      ? { ok: true }
      : {
          ok: false,
          level: 'P0',
          detail: `A newer version of Core changed the database (${unknown.join(', ')}), and this older version must not run on it. Release the newer version again.`,
        };
  });

  return settle(checks);
}

export async function healthReport(): Promise<HealthReport> {
  const checks = (await readiness()).checks;

  checks['worker'] = await run('worker', async () => {
    const { rows } = await db().query<{ age_ms: string | null }>(
      "select extract(epoch from (now() - at)) * 1000 as age_ms from heartbeats where name = 'worker'",
    );
    const age =
      rows[0]?.age_ms === undefined || rows[0]?.age_ms === null ? null : Number(rows[0].age_ms);
    if (age !== null && age <= WORKER_HEARTBEAT_MS) return { ok: true };
    return {
      ok: false,
      level: 'P0',
      detail: `${age === null ? 'Core’s worker has never reported' : `Core’s worker has not reported for ${lasting(age)}`}. The worker fetches from the CRMs, tells the sites about changes and sends the alerts, so no site gets new changes until it runs again. It needs a restart.`,
    };
  });

  checks[SITES_CHECK] = await run(SITES_CHECK, async () => {
    const behind = await sitesBehind();
    if (behind.length === 0) return { ok: true };
    const many = behind.length > 1;
    return {
      ok: false,
      level: 'P1',
      detail: `Core told ${counted(behind.length, 'site', 'sites')} about changes over an hour ago, and ${many ? 'they have' : 'it has'} not fetched them since, so ${many ? 'they show' : 'it shows'} out-of-date homes.`,
      names: behind.map((site) => site.label),
    };
  });

  checks['lifecycle'] = await run('lifecycle', async () => {
    const waiting = await undeliveredLifecycleEvents(LIFECYCLE_WAIT_MS);
    if (waiting === 0) return { ok: true };
    const long = (await undeliveredLifecycleEvents(LIFECYCLE_LONG_MS)) > 0;
    return {
      ok: false,
      level: long ? 'P1' : 'P2',
      detail: `${counted(waiting, 'piece', 'pieces')} of work asked for in the admin area (a new connection’s first fetch, a changed office, a fetch someone asked for) ${waiting === 1 ? 'has' : 'have'} waited over ${long ? 'an hour' : 'five minutes'} for the worker, so ${waiting === 1 ? 'its' : 'their'} records are not fetched yet.`,
    };
  });

  // Red while the latest form submission to a connection failed because the CRM did not answer,
  // green on the next one it takes (docs/forms.md). The connection ids go in `names`.
  checks['submissions.failing'] = await run('submissions.failing', async () => {
    const failing = await connectionsWithFailingSubmissions();
    return failing.length === 0
      ? { ok: true }
      : {
          ok: false,
          level: 'P2',
          detail: `The CRM did not answer the latest form sent through ${counted(failing.length, 'connection', 'connections')}, so a visitor’s form may not have reached the brokerage. Failed forms lists each one, to send again.`,
          names: failing,
        };
  });

  Object.assign(checks, await adapterChecks());
  return settle(checks);
}

/** The checks that could not run, or that their process has not reported (rule E). */
const notRun = new WeakSet<HealthResult>();

/**
 * One cause, one problem (rule B): while a P0 check fails, a check that could not run counts under
 * it, as P3, so a database or worker that is down is one problem and not one per check.
 */
function settle(checks: HealthReport['checks']): HealthReport {
  const isDown = Object.values(checks).some((check) => !check.ok && levelOf(check) === 'P0');
  if (isDown) {
    for (const [name, check] of Object.entries(checks)) {
      if (notRun.has(check)) checks[name] = { ...check, level: 'P3' };
    }
  }
  return { ok: Object.values(checks).every((check) => check.ok), checks };
}

/**
 * Adapter checks run where the adapters run. This process runs and records its own; whatever
 * another process recorded is read back, and counts as not run once it is stale.
 */
async function adapterChecks(): Promise<HealthReport['checks']> {
  const checks = await recordHealth();
  const { rows } = await db().query<{
    name: string;
    ok: boolean;
    detail: string | null;
    names: string[] | null;
    age_ms: string;
  }>(
    'select name, ok, detail, names, extract(epoch from (now() - at)) * 1000 as age_ms from health_results',
  );
  for (const row of rows) {
    if (row.name in checks) continue;
    const age = Number(row.age_ms);
    if (age <= RECORDED_STALE_MS) {
      checks[row.name] = {
        ok: row.ok,
        ...(row.detail ? { detail: row.detail } : {}),
        ...(row.names ? { names: row.names } : {}),
      };
      continue;
    }
    const stale: HealthResult = {
      ok: false,
      level: age > RECORDED_STALE_MS + CANNOT_RUN_MS ? 'P1' : 'P2',
      detail: `Core’s worker has not run this check for ${lasting(age)}, so nobody knows whether it would pass.`,
    };
    notRun.add(stale);
    checks[row.name] = stale;
  }
  return checks;
}

/** Run the checks registered in this process and record them for the other one. The worker's tick. */
export async function recordHealth(): Promise<HealthReport['checks']> {
  const checks: HealthReport['checks'] = {};
  for (const [name, check] of registeredHealthChecks()) {
    const result = await run(name, check);
    checks[name] = result;
    await db().query(
      `insert into health_results (name, ok, detail, names, at) values ($1, $2, $3, $4, now())
       on conflict (name) do update set ok = excluded.ok, detail = excluded.detail, names = excluded.names, at = now()`,
      [name, result.ok, result.detail ?? null, result.names ?? null],
    );
  }
  return checks;
}

/**
 * Drop the reports of checks this process does not run any more: a check that left with its
 * adapter would otherwise stay red for ever as not run. The worker's tick, after recording.
 */
export async function pruneHealth(): Promise<void> {
  await db().query('delete from health_results where name <> all($1::text[])', [
    [...registeredHealthChecks().keys()],
  ]);
}

/**
 * A check that throws could not run (rule E): P2, and P1 once its problem, as the alerts keep it,
 * is 15 minutes old.
 */
async function run(
  name: string,
  check: () => Promise<HealthResult> | HealthResult,
): Promise<HealthResult> {
  try {
    return await check();
  } catch (error) {
    report(error, { where: 'health', check: name });
    const result: HealthResult = {
      ok: false,
      level: (await failingFor(name)) > CANNOT_RUN_MS ? 'P1' : 'P2',
      detail: `This check could not run (${String(error)}), so nobody knows whether it would pass.`,
    };
    notRun.add(result);
    return result;
  }
}

/** How long the alerts have kept a check's problem open; none, or unreadable, is no time at all. */
async function failingFor(name: string): Promise<number> {
  try {
    const { rows } = await db().query<{ age_ms: string }>(
      'select extract(epoch from (now() - since)) * 1000 as age_ms from alert_state where name = $1 and not ok',
      [name],
    );
    return Number(rows[0]?.age_ms ?? 0);
  } catch {
    return 0;
  }
}
