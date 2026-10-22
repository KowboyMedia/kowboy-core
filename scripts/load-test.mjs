// The load test (AC 27; Patric, 210 a): a temporary copy of staging, its own database server and
// app, deleted after. The server is the size of the one live and staging share, the app's web part
// the size of theirs, and the app runs staging's version. Its job (scripts/load-test-job.mjs)
// fills the empty database with ten times launch and pulls pages through the app's public
// address while it measures them.
//
//   DIGITALOCEAN_ACCESS_TOKEN=… node scripts/load-test.mjs           about an hour
//   DIGITALOCEAN_ACCESS_TOKEN=… node scripts/load-test.mjs --undo    after a run that was cut off
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
  words,
} from './lib/digitalocean.mjs';

const STAGING = '57498bcc-59a5-4812-aa1f-ed65c83a5b2f';
const CLUSTER = 'kowboy-core-production';
const NAME = 'core-load-test';
const TAG = 'load-test';
/**
 * Room for 400,000 records of a real record's size, with the writes' log beside them. DigitalOcean
 * takes this size's disk from 15 GiB up in steps of 10.
 */
const STORAGE_MIB = 35_840;
const TEST =
  'the load test at ten times launch answers 100-item pages within 100 ms to the first byte and 300 ms in full, p95';
const RECORD = join(import.meta.dirname, '..', '.do', 'drills', 'load-test.json');

accessToken();
const { lines: steps, say } = logbook();

const appNamed = async (name) =>
  ((await api('/apps?per_page=100')).apps ?? []).find((app) => app.spec?.name === name) ?? null;

/** The copy's settings: staging's web part and source, a job, and the temporary server alone. */
async function specFor(key) {
  const staging = (await api(`/apps/${STAGING}`)).app.spec;
  const web = staging.services?.find((service) => service.name === 'web');
  if (!web?.github) throw new Error("staging's web part or its source is not where it was");
  const source = { repo: web.github.repo, branch: web.github.branch, deploy_on_push: false };
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
        instance_size_slug: web.instance_size_slug,
        instance_count: 1,
        health_check: web.health_check,
        envs: [...shared, { key: 'SENTRY_ENVIRONMENT', value: 'load-test', scope: 'RUN_TIME' }],
      },
    ],
    jobs: [
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
    ],
    databases: [{ name: 'db', cluster_name: NAME, engine: 'PG', production: true }],
  };
}

/** The job's lines from its log, read in this process and never printed but for its own lines. */
async function jobLines(appId, deploymentId) {
  const { historic_urls: urls, live_url: live } = await api(
    `/apps/${appId}/deployments/${deploymentId}/components/load/logs?type=RUN`,
  );
  const url = urls?.[0] ?? live;
  if (!url) return [];
  const text = await (await fetch(url)).text();
  return text.split('\n').map((line) => line.replace(/^load \S+ /, ''));
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
      size: original.size,
      num_nodes: 1,
      storage_size_mib: STORAGE_MIB,
      tags: [TAG],
    }),
  });
  say(`The database server ${NAME} is being made, the size of ${CLUSTER}.`);
  await until(
    `${NAME} online`,
    async () => (await api(`/databases/${cluster.id}`)).database.status === 'online',
    30_000,
    30 * MINUTE,
  );

  const key = randomBytes(32).toString('base64');
  const { app } = await api('/apps', {
    method: 'POST',
    body: JSON.stringify({ spec: await specFor(key) }),
  });
  await api(`/databases/${cluster.id}/firewall`, {
    method: 'PUT',
    body: JSON.stringify({ rules: [{ type: 'app', value: app.id }] }),
  });
  say(`The app ${NAME} is being made from staging's version, its server reachable from it alone.`);

  const deployment = await until(
    'the app deployed and its job done',
    async () => {
      const { deployments } = await api(`/apps/${app.id}/deployments?per_page=5`);
      const first = deployments?.[deployments.length - 1];
      if (!first) return null;
      if (first.phase === 'ERROR' || first.phase === 'CANCELED') {
        for (const line of (await jobLines(app.id, first.id)).slice(-20)) say(`Job: ${line}`);
        throw new Error(`the app's deploy ${first.id} ended ${first.phase}`);
      }
      return first.phase === 'ACTIVE' ? first.id : null;
    },
    MINUTE,
    120 * MINUTE,
  );

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
  `${JSON.stringify({ ran: new Date().toISOString(), tests: { [TEST]: outcome }, measured, steps }, null, 2)}\n`,
);
say(`The load test ${outcome}; recorded in .do/drills/load-test.json.`);
process.exit(measured && cleaned ? 0 : 1);
