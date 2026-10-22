// The load test (AC 27; Patric, 210 a): a temporary copy of staging, its own database server and
// app, deleted after. The server is the size of the one live and staging share, the app's web part
// the size of theirs, and the app runs staging's version. Its job (scripts/load-test-job.mjs)
// fills the empty database with ten times launch and pulls pages through the app's public
// address while it measures them.
//
//   DIGITALOCEAN_ACCESS_TOKEN=… node scripts/load-test.mjs           about an hour
//   DIGITALOCEAN_ACCESS_TOKEN=… node scripts/load-test.mjs --undo    after a run that was cut off
//   … node scripts/load-test.mjs --size db-s-2vcpu-4gb --disk 40960   a trial on another server size
//   … --web apps-s-2vcpu-4gb --web-count 2                            and another web part
//   … --branch claude/some-branch                                     another branch's version
//   … --name 2                                                        its servers named core-load-test-2
//
// A trial answers what sizes or which version the criterion needs: it changes only the database
// server's size and disk, the web part's size and count, or the branch the app is built from, and
// goes to .do/trials/, which the acceptance report does not read.
//
// Nothing of staging or live is read or changed but the size of staging's web part: the copy has
// no CRM connection and no setting of theirs, only a key of its own. Whatever fails, the app and the
// server are deleted. The result goes to .do/drills/load-test.json, which the acceptance report
// reads. It prints no setting and no secret.
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  accessToken,
  api,
  clusterNamed,
  logbook,
  MINUTE,
  until,
  wait,
  words,
} from './lib/digitalocean.mjs';

const STAGING = '57498bcc-59a5-4812-aa1f-ed65c83a5b2f';
const CLUSTER = 'kowboy-core-production';
const TAG = 'load-test';
/**
 * Room for 400,000 records of a real record's size, with the writes' log beside them. DigitalOcean
 * takes this size's disk from 15 GiB up in steps of 10.
 */
const STORAGE_MIB = 35_840;
const TEST =
  'the load test at ten times launch answers 100-item pages within 100 ms to the first byte and 300 ms in full, p95';
const option = (name) => {
  const at = process.argv.indexOf(name);
  return at === -1 ? null : (process.argv[at + 1] ?? null);
};
/**
 * The temporary app's and server's name. `--name` gives another, `core-load-test-<word>`: a deleted
 * server's name stays taken for an hour or more (2026-10-22). `--undo` takes the same option.
 */
const NAME = option('--name') ? `core-load-test-${String(option('--name'))}` : 'core-load-test';
const SIZE = option('--size');
const DISK = option('--disk');
const WEB = option('--web');
const WEB_COUNT = Number(option('--web-count') ?? 1);
const BRANCH = option('--branch');
const TRIAL = [SIZE, WEB && `${WEB}x${WEB_COUNT}`, BRANCH?.replaceAll('/', '-')]
  .filter(Boolean)
  .join('-');
const RECORD = TRIAL
  ? join(import.meta.dirname, '..', '.do', 'trials', `load-test-${TRIAL}.json`)
  : join(import.meta.dirname, '..', '.do', 'drills', 'load-test.json');

accessToken();
const { lines: steps, say } = logbook();

const appNamed = async (name) =>
  ((await api('/apps?per_page=100')).apps ?? []).find((app) => app.spec?.name === name) ?? null;

/**
 * The copy's settings: staging's web part and source, and the temporary server alone. With the
 * job only from the second deploy on: a new app's address is not found until its first deploy is
 * done, and the job pulls through that address.
 */
async function specFor(key, withJob) {
  const staging = (await api(`/apps/${STAGING}`)).app.spec;
  const web = staging.services?.find((service) => service.name === 'web');
  if (!web?.github) throw new Error("staging's web part or its source is not where it was");
  const source = {
    repo: web.github.repo,
    branch: BRANCH ?? web.github.branch,
    deploy_on_push: false,
  };
  const secret = (name, value) => ({ key: name, value, type: 'SECRET', scope: 'RUN_TIME' });
  const shared = [
    { key: 'DATABASE_URL', value: '${db.DATABASE_URL}', scope: 'RUN_TIME' },
    { key: 'DATABASE_CA_CERT', value: '${db.CA_CERT}', scope: 'RUN_TIME' },
    secret('CREDENTIALS_KEY', key),
  ];
  return {
    name: NAME,
    region: staging.region,
    services: [
      {
        name: 'web',
        github: source,
        source_dir: web.source_dir,
        environment_slug: web.environment_slug,
        build_command: web.build_command,
        run_command: web.run_command,
        http_port: web.http_port,
        instance_size_slug: WEB ?? web.instance_size_slug,
        instance_count: WEB_COUNT,
        health_check: web.health_check,
        envs: [...shared, { key: 'SENTRY_ENVIRONMENT', value: 'load-test', scope: 'RUN_TIME' }],
      },
    ],
    jobs: withJob
      ? [
          {
            name: 'load',
            kind: 'POST_DEPLOY',
            github: source,
            source_dir: web.source_dir,
            environment_slug: web.environment_slug,
            build_command: web.build_command,
            // The server's own CA, as scripts/start.sh hands it to Node.
            run_command:
              'printf "%s\\n" "$DATABASE_CA_CERT" > /tmp/database-ca.crt && NODE_EXTRA_CA_CERTS=/tmp/database-ca.crt node scripts/load-test-job.mjs',
            instance_size_slug: 'apps-s-1vcpu-1gb',
            envs: [...shared, { key: 'APP_URL', value: '${APP_URL}', scope: 'RUN_TIME' }],
          },
        ]
      : [],
    databases: [{ name: 'db', cluster_name: NAME, engine: 'PG', production: true }],
  };
}

/**
 * The job's lines from its log, read in this process and never printed but for its own lines.
 * Just after the deploy ends, DigitalOcean can still be putting the job's log away and refuse it
 * (400 "in phase deleting", 404 "component not found", seen on 2026-10-22), so it is asked again
 * for a few minutes.
 */
async function jobLines(appId, deploymentId) {
  let refused = null;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (attempt > 0) await wait(30_000);
    try {
      const { historic_urls: urls, live_url: live } = await api(
        `/apps/${appId}/deployments/${deploymentId}/components/load/logs?type=RUN`,
      );
      const url = urls?.[0] ?? live;
      if (!url) continue;
      const text = await (await fetch(url)).text();
      return text.split('\n').map((line) => line.replace(/^load \S+ /, ''));
    } catch (error) {
      refused = error;
    }
  }
  if (refused) throw refused;
  return [];
}

/**
 * Wait for the app's deploy created at or after `since` to be live, one with the job when `job`;
 * its job's lines if it fails. A deploy without the job can follow the one with it (seen on
 * 2026-10-22, when the job's lines were then asked of a deploy that had none).
 */
async function deployed(appId, since, what, job = false) {
  return until(
    what,
    async () => {
      const { deployments } = await api(`/apps/${appId}/deployments?per_page=5`);
      const deployment = (deployments ?? [])
        .filter((candidate) => Date.parse(candidate.created_at) >= since - MINUTE)
        .filter(
          (candidate) => !job || (candidate.spec?.jobs ?? []).some((one) => one.name === 'load'),
        )
        .at(since === 0 ? -1 : 0);
      if (!deployment) return null;
      if (['ERROR', 'CANCELED', 'SUPERSEDED'].includes(deployment.phase)) {
        for (const line of (await jobLines(appId, deployment.id)).slice(-20)) say(`Job: ${line}`);
        throw new Error(`the app's deploy ${deployment.id} ended ${deployment.phase}`);
      }
      return deployment.phase === 'ACTIVE' ? deployment.id : null;
    },
    MINUTE,
    120 * MINUTE,
  );
}

/** Delete the app and the server, only ever the ones by the test's name (and the server's tag). */
async function removeAll() {
  const app = await appNamed(NAME);
  if (app) {
    await api(`/apps/${app.id}`, { method: 'DELETE' });
    say(`The app ${NAME} deleted.`);
  }
  const cluster = await clusterNamed(NAME);
  if (cluster) {
    if (!(cluster.tags ?? []).includes(TAG))
      throw new Error(`${NAME} lacks the tag ${TAG}; left as it is`);
    await api(`/databases/${cluster.id}`, { method: 'DELETE' });
    say(`The database server ${NAME} deleted.`);
  }
}

async function run() {
  if ((await appNamed(NAME)) || (await clusterNamed(NAME))) {
    throw new Error(`${NAME} exists already; run with --undo after a run that was cut off`);
  }
  const original = await clusterNamed(CLUSTER);
  if (!original) throw new Error(`no database server named ${CLUSTER}`);

  const { database: cluster } = await api('/databases', {
    method: 'POST',
    body: JSON.stringify({
      name: NAME,
      engine: original.engine,
      version: original.version,
      region: original.region,
      size: SIZE ?? original.size,
      num_nodes: 1,
      storage_size_mib: DISK ? Number(DISK) : STORAGE_MIB,
      tags: [TAG],
    }),
  });
  say(
    SIZE
      ? `The database server ${NAME} is being made, of the size ${SIZE}.`
      : `The database server ${NAME} is being made, the size of ${CLUSTER}.`,
  );
  await until(
    `${NAME} online`,
    async () => (await api(`/databases/${cluster.id}`)).database.status === 'online',
    30_000,
    30 * MINUTE,
  );

  const key = randomBytes(32).toString('base64');
  const { app } = await api('/apps', {
    method: 'POST',
    body: JSON.stringify({ spec: await specFor(key, false) }),
  });
  await api(`/databases/${cluster.id}/firewall`, {
    method: 'PUT',
    body: JSON.stringify({ rules: [{ type: 'app', value: app.id }] }),
  });
  say(`The app ${NAME} is being made from staging's version, its server reachable from it alone.`);
  await deployed(app.id, 0, 'the app deployed');

  const since = Date.now();
  await api(`/apps/${app.id}`, {
    method: 'PUT',
    body: JSON.stringify({ spec: await specFor(key, true) }),
  });
  say('The app has its address; its job is added, and runs after the next deploy.');
  const deployment = await deployed(app.id, since, 'the job done', true);

  const lines = await jobLines(app.id, deployment);
  for (const line of lines.filter((line) => /^\d\d:\d\d:\d\d /.test(line))) say(`Job: ${line}`);
  const result = lines.find((line) => line.startsWith('load-test result '));
  if (!result) throw new Error('the job left no result in its log');
  return JSON.parse(result.slice('load-test result '.length));
}

if (process.argv.includes('--undo')) {
  await removeAll();
  process.exit(0);
}
let measured = null;
let cleaned = true;
try {
  measured = await run();
} catch (error) {
  say(`Failed: ${words(error)}`);
}
try {
  await removeAll();
} catch (error) {
  cleaned = false;
  say(`Clean-up failed: ${words(error)}; run the load test with --undo.`);
}
const outcome = measured?.passed ? 'passed' : 'failed';
mkdirSync(join(RECORD, '..'), { recursive: true });
writeFileSync(
  RECORD,
  `${JSON.stringify({ ran: new Date().toISOString(), databaseSize: SIZE ?? CLUSTER, web: WEB ? `${WEB} x ${WEB_COUNT}` : 'as staging', branch: BRANCH ?? 'staging', tests: { [TEST]: outcome }, measured, steps }, null, 2)}\n`,
);
say(`The load test ${outcome}; recorded in ${RECORD.slice(RECORD.indexOf('.do/'))}.`);
process.exit(measured && cleaned ? 0 : 1);
