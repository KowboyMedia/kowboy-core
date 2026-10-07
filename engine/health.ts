import { db } from './storage/db.js';
import { adminFor, registeredHealthChecks } from './registry.js';
import { unknownMigrations } from './storage/migrate.js';
import { undeliveredLifecycleEvents } from './lifecycle.js';
import { connectionsWithFailingSubmissions } from './storage/submissions.js';
import { report } from './errors.js';
import { capital, crmName, inWords, lasting } from './admin/words.js';
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
 * its counts and plain words, the names and what failed left out (Patric, 2026-09-20, question 62).
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

/**
 * What failed, for a check that could not run or a database Core cannot reach: kept out of
 * `detail`, which anyone may read, and added to it for the admin area and the alerts.
 */
const failed = new WeakMap<HealthResult, string>();

/** A check's sentence as the admin area and the alerts read it: with what failed, when it failed. */
export const detailOf = (check: HealthResult): string | undefined => {
  const failure = failed.get(check);
  return failure ? `${check.detail ?? ''} ${failure}`.trim() : check.detail;
};

/** The report as the admin area reads it: each sentence with what failed. */
export const forAdmins = (report: HealthReport): HealthReport => ({
  ok: report.ok,
  checks: Object.fromEntries(
    Object.entries(report.checks).map(([name, check]) => {
      const detail = detailOf(check);
      return [name, { ...check, ...(detail ? { detail } : {}) }];
    }),
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
const LIFECYCLE_LONG_MS = 60 * 60_000;
/** A check that cannot run is P2, and P1 once it has not run for this long (rule E). */
const CANNOT_RUN_MS = 15 * 60_000;

/** The check that watches the sites' fetches. */
export const SITES_CHECK = 'subscribers';

/**
 * What a person reads about a check: its title, never its name, what it says while it passes, and
 * the page in the admin area where what it finds is put right, when there is one. The database and
 * the worker are put right where Core is hosted, and a site where it runs, so those have no page;
 * the things a check names are linked one by one.
 */
export type About = {
  title: string;
  fine: string;
  page?: { to: string; label: string };
};

/** The engine's own checks, in words (AGENTS.md, definition of done item 5). */
const ABOUT: Record<string, About> = {
  database: { title: 'Core’s database', fine: 'Core reaches its database.' },
  schema: {
    title: 'Core’s version and its database',
    fine: 'The database fits the version of Core that is running.',
    page: { to: '/settings', label: 'Settings' },
  },
  worker: {
    title: 'Core’s background worker',
    fine: 'Core’s background worker is running. It fetches from the CRMs, tells the sites about changes, sends the alerts and runs each CRM’s own checks.',
  },
  [SITES_CHECK]: {
    title: 'Sites fetching their changes',
    fine: 'Every site Core told about changes has fetched them within the hour.',
  },
  lifecycle: {
    title: 'Tasks asked for in the admin area',
    fine: 'Every task asked for in the admin area more than five minutes ago is done.',
  },
  'submissions.failing': {
    title: 'Sending forms to the CRMs',
    fine: 'No form is waiting because a CRM did not answer it.',
    page: { to: '/forms', label: 'Failed forms' },
  },
};

/**
 * A check in words. A CRM's check is put right on its CRM's page, and its name starts with the
 * CRM's short name ("somecrm.catch_up"); its words are the ones the CRM's code gave it (question
 * 184), and a check it gave none is about fetching from the CRM.
 */
export function aboutCheck(name: string): About {
  const about = ABOUT[name];
  if (about) return about;
  const provider = name.split('.')[0] ?? name;
  const words = adminFor(provider)?.checks?.[name];
  return {
    title: words?.title ?? `Fetching from ${crmName(provider)}`,
    fine: words?.fine ?? 'This check finds nothing wrong.',
    page: { to: `/crms/${provider}`, label: `the ${crmName(provider)} page` },
  };
}

/**
 * A site behind: when Core first told it about changes it has not fetched, and how it answered the
 * last time it was told (`bells.ts`: ok, http and its code, or failed for no answer).
 */
export type SiteBehind = {
  id: number;
  tenantId: number;
  label: string;
  lastPullAt: Date | null;
  toldAt: Date;
  lastBellStatus: string | null;
};

/** The sites a failing sites check found, kept with its result, so the alerts and the Overview read the same ones. */
const behindOf = new WeakMap<HealthResult, SiteBehind[]>();

/** The sites a sites check found behind, or null when it found none or could not run. */
export const sitesFound = (check: HealthResult | undefined): SiteBehind[] | null =>
  (check && behindOf.get(check)) ?? null;

/**
 * The sites that are behind (question 172): Core told the site about changes more than an hour
 * ago, and it has not fetched since. A quiet site is fine: with nothing new it is not told, and its
 * own timer runs only when someone visits it. A site told about changes since its last fetch, which
 * is older than an hour, is behind when its latest message is older than an hour too, or else when
 * the event log holds an earlier one older than an hour, read back from that hour.
 */
async function sitesBehind(): Promise<SiteBehind[]> {
  const { rows } = await db().query<{
    id: string;
    tenant_id: number;
    label: string;
    last_pull_at: Date | null;
    told_at: Date;
    last_bell_status: string | null;
  }>(
    `select s.id, s.tenant_id, s.label, s.last_pull_at, s.last_bell_status,
       coalesce((
         select min(e.at) from events e
         where e.type = 'bell' and e.subscriber_id = s.id
           and e.at > coalesce(s.last_pull_at, '-infinity')
       ), s.last_bell_at) as told_at
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
    toldAt: row.told_at,
    lastBellStatus: row.last_bell_status,
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
      const result: HealthResult = {
        ok: false,
        level: 'P0',
        detail:
          'Core cannot reach its database. Until it can, the sites keep what they show and get no changes, and no form a visitor sends gets through. Core carries on by itself once the database answers. If this lasts more than a few minutes, have the database looked at where Core is hosted.',
      };
      failed.set(result, `What failed: ${String(error)}`);
      return result;
    }
  });

  checks['schema'] = await run('schema', async () => {
    const unknown = await unknownMigrations();
    return unknown.length === 0
      ? { ok: true }
      : {
          ok: false,
          level: 'P0',
          detail: `The running version of Core is older than its database: a newer version changed the database in ${inWords(unknown.length, 'way', 'ways')} this version does not know, so this version must not run on it. Release the newest version again. Settings shows the version running and the changes the database holds.`,
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
      detail: `${age === null ? 'Core’s background worker has never reported' : `Core’s background worker has not reported for ${lasting(age)}`}. Until it runs again, no change from a CRM reaches the sites, Core sends no alert, and each CRM’s own checks do not run. The sites keep what they show, and forms still reach the CRMs. Have the worker restarted where Core is hosted.`,
    };
  });

  checks[SITES_CHECK] = await run(SITES_CHECK, async () => {
    const behind = await sitesBehind();
    if (behind.length === 0) return { ok: true };
    const one = behind.length === 1;
    const result: HealthResult = {
      ok: false,
      level: 'P1',
      detail: `${capital(inWords(behind.length, 'site has', 'sites have'))} not fetched the changes Core told ${one ? 'it' : 'them'} about more than an hour ago, so ${one ? 'its' : 'their'} visitors may see homes that have changed or are gone.`,
      names: behind.map((site) => site.label),
    };
    behindOf.set(result, behind);
    return result;
  });

  checks['lifecycle'] = await run('lifecycle', async () => {
    const waiting = await undeliveredLifecycleEvents(LIFECYCLE_WAIT_MS);
    if (waiting === 0) return { ok: true };
    const long = (await undeliveredLifecycleEvents(LIFECYCLE_LONG_MS)) > 0;
    const tasks = `${capital(inWords(waiting, 'task', 'tasks'))} asked for in the admin area, such as loading a new connection or fetching records again, ${waiting === 1 ? 'is' : 'are'} not done after ${long ? 'an hour' : 'five minutes'}. Until a task is done, the sites do not get what it brings.`;
    return {
      ok: false,
      level: long ? 'P1' : 'P2',
      detail: long
        ? `${tasks} If the check “Core’s background worker” fails too, have the worker restarted where Core is hosted; if not, pass this on to whoever maintains Core.`
        : `${tasks} Core’s background worker does one task after another, and a large one can take a while, so nothing needs doing unless this lasts an hour.`,
    };
  });

  // Red while the latest form submission to a connection failed because the CRM did not answer,
  // green on the next one it takes (docs/forms.md). The connections go in `names`.
  checks['submissions.failing'] = await run('submissions.failing', async () => {
    const failing = await connectionsWithFailingSubmissions();
    if (failing.length === 0) return { ok: true };
    const many = failing.length > 1;
    return {
      ok: false,
      level: 'P2',
      detail: `The last form a visitor sent through ${many ? 'each of ' : ''}${inWords(failing.length, 'CRM connection', 'CRM connections')} could not be sent. Send ${many ? 'those forms' : 'that form'} again on Failed forms once the cause shown there is fixed. The check shows fine again when the CRM answers a form through ${many ? 'each of them' : 'that connection'}.`,
      names: failing.map((connection) => ({ connection })),
    };
  });

  Object.assign(checks, await adapterChecks(!checks['worker']?.ok));
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
      if (!notRun.has(check)) continue;
      const counted: HealthResult = { ...check, level: 'P3' };
      const failure = failed.get(check);
      if (failure) failed.set(counted, failure);
      checks[name] = counted;
    }
  }
  return { ok: Object.values(checks).every((check) => check.ok), checks };
}

/**
 * Adapter checks run where the adapters run. This process runs and records its own; whatever
 * another process recorded is read back, and counts as not run once it is stale. With the
 * database out of reach there are none: the database check says so, once (rule B), and the
 * report still answers.
 */
async function adapterChecks(workerDown: boolean): Promise<HealthReport['checks']> {
  try {
    return await recordedChecks(workerDown);
  } catch (error) {
    report(error, { where: 'health', check: 'adapters' });
    return {};
  }
}

async function recordedChecks(workerDown: boolean): Promise<HealthReport['checks']> {
  const checks = await recordHealth();
  const { rows } = await db().query<{
    name: string;
    ok: boolean;
    detail: string | null;
    names: HealthResult['names'] | null;
    level: Level | null;
    age_ms: string;
  }>(
    'select name, ok, detail, names, level, extract(epoch from (now() - at)) * 1000 as age_ms from health_results',
  );
  for (const row of rows) {
    if (row.name in checks) continue;
    const age = Number(row.age_ms);
    if (age <= RECORDED_STALE_MS) {
      checks[row.name] = {
        ok: row.ok,
        ...(row.detail ? { detail: row.detail } : {}),
        ...(row.names ? { names: row.names } : {}),
        ...(row.level ? { level: row.level } : {}),
      };
      continue;
    }
    const stale: HealthResult = {
      ok: false,
      level: age > RECORDED_STALE_MS + CANNOT_RUN_MS ? 'P1' : 'P2',
      detail: workerDown
        ? `Core’s background worker has not run this check for ${lasting(age)}, because the worker is not running. The check “Core’s background worker” says what to do.`
        : `Core’s background worker has not run this check for ${lasting(age)}, although the worker itself is running, so Core cannot tell whether anything the check watches is wrong. If this lasts a quarter of an hour, have the worker restarted where Core is hosted.`,
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
    // With its level and the things it names, so the other process shows it as this one does.
    await db().query(
      `insert into health_results (name, ok, detail, names, level, at) values ($1, $2, $3, $4, $5, now())
       on conflict (name) do update set ok = excluded.ok, detail = excluded.detail, names = excluded.names,
         level = excluded.level, at = now()`,
      [
        name,
        result.ok,
        result.detail ?? null,
        result.names ? JSON.stringify(result.names) : null,
        result.level ?? null,
      ],
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

/** When each check that throws first threw, without a run between that did not, in this process. */
const throwing = new Map<string, number>();

/**
 * A check that throws could not run (rule E): P2, and P1 once it has thrown at every run for 15
 * minutes.
 */
async function run(
  name: string,
  check: () => Promise<HealthResult> | HealthResult,
): Promise<HealthResult> {
  try {
    const result = await check();
    throwing.delete(name);
    return result;
  } catch (error) {
    report(error, { where: 'health', check: name });
    const since = throwing.get(name) ?? Date.now();
    throwing.set(name, since);
    const result: HealthResult = {
      ok: false,
      level: Date.now() - since > CANNOT_RUN_MS ? 'P1' : 'P2',
      detail:
        'This check could not run, so Core cannot tell whether anything it watches is wrong. Core tries it again every minute.',
    };
    failed.set(
      result,
      `If it keeps failing, pass this on to whoever maintains Core. What failed: ${String(error)}`,
    );
    notRun.add(result);
    return result;
  }
}
