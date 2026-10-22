// The restore drill (AC 24; Patric, 217 a): Core's database is restored from the cluster's latest
// backup onto a new database server, staging runs on that copy until its sites have caught up,
// then staging is pointed back and the copy deleted. Live is not touched, and the copy is
// reachable from staging alone.
//
//   DIGITALOCEAN_ACCESS_TOKEN=… node scripts/restore-drill.mjs           the drill, about 40 minutes
//   DIGITALOCEAN_ACCESS_TOKEN=… node scripts/restore-drill.mjs --undo    after a drill that was cut off
//
// It changes staging's settings twice; each change is a deploy with the preview before it, which
// reads every restored record, and the smoke suite after. Each staging site's lists are read
// before, on the copy and after: a list's count and a fingerprint of its cards must come back the
// same, so no site skipped, deleted or rewrote anything. A change at the CRM during the drill
// changes a fingerprint too, so the drill is run when nobody is at work. Whatever fails, staging
// is pointed back before the copy is deleted. The result goes to .do/drills/restore-drill.json,
// which the acceptance report reads. It prints no setting and no secret.
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
const COPY = 'core-restore-drill';
const TAG = 'restore-drill';
const CORE = 'https://staging.core.kowboy.cloud';
const SITES = [
  'https://wordpress-1545003-6698706.cloudwaysapps.com',
  'https://wordpress-1545003-6715283.cloudwaysapps.com',
];
const ENTITIES = ['property', 'project', 'agent', 'office', 'area', 'association'];
const TEST = 'the restore drill on staging ends with subscribers converged';
const RECORD = join(import.meta.dirname, '..', '.do', 'drills', 'restore-drill.json');

accessToken();
const { lines: steps, say } = logbook();

/** Where staging's one database binding points. */
const stagingCluster = async () => {
  const databases = (await api(`/apps/${STAGING}`)).app.spec.databases ?? [];
  if (databases.length !== 1) throw new Error('staging has more than one database binding');
  return databases[0].cluster_name;
};

/**
 * Point staging's database binding from one server to the other, and wait until the deploy that
 * change starts is live. Everything else in staging's settings stays as it is now.
 */
async function pointStaging(from, to) {
  const { app } = await api(`/apps/${STAGING}`);
  const spec = app.spec;
  if (spec.databases?.length !== 1 || spec.databases[0].cluster_name !== from) {
    throw new Error(`staging's database binding is not ${from}`);
  }
  spec.databases[0].cluster_name = to;
  const since = Date.now() - MINUTE;
  await api(`/apps/${STAGING}`, { method: 'PUT', body: JSON.stringify({ spec }) });
  say(`Staging's settings now name ${to}; waiting for that deploy, the preview first.`);
  return until(
    `staging deployed on ${to}`,
    async () => {
      const { deployments } = await api(`/apps/${STAGING}/deployments?per_page=10`);
      const newest = (deployments ?? []).find(
        (deployment) =>
          Date.parse(deployment.created_at) >= since &&
          deployment.spec?.databases?.[0]?.cluster_name === to &&
          deployment.phase !== 'SUPERSEDED',
      );
      if (!newest) return null;
      if (newest.phase === 'ERROR' || newest.phase === 'CANCELED') {
        throw new Error(`the deploy ${newest.id} on ${to} ended ${newest.phase}`);
      }
      return newest.phase === 'ACTIVE' ? newest.id : null;
    },
    30_000,
    45 * MINUTE,
  );
}

/** The health checks staging fails now. */
async function failing() {
  try {
    const response = await fetch(`${CORE}/v1/health`);
    const { checks } = await response.json();
    return Object.entries(checks)
      .filter(([, check]) => !check.ok)
      .map(([name]) => name)
      .sort();
  } catch {
    return ['(no answer from /v1/health)'];
  }
}

/**
 * Wait until staging fails no check it did not fail before, three times in a row half a minute
 * apart and at least three minutes after the deploy: the worker has started on the database
 * and the CRM's catch-up from it is done.
 */
async function settled(before) {
  const start = Date.now();
  let good = 0;
  return until(
    'staging settled with no new failing check',
    async () => {
      const now = await failing();
      const fresh = now.filter((name) => !before.includes(name));
      good = fresh.length === 0 ? good + 1 : 0;
      return good >= 3 && Date.now() - start >= 3 * MINUTE ? now : null;
    },
    30_000,
    30 * MINUTE,
  );
}

/** Each site's lists as a visitor gets them: per kind of record, the count and the cards' fingerprint. */
async function lists() {
  const found = {};
  for (const site of SITES) {
    for (const entity of ENTITIES) {
      const url = `${site}/wp-json/core/v1/list?entity=${entity}&per_page=100000&nocache=${Date.now()}`;
      const response = await fetch(url, {
        headers: { 'user-agent': 'Mozilla/5.0 (restore drill)' },
      });
      if (!response.ok)
        throw new Error(`${site} answered ${response.status} for its ${entity} list`);
      const { total, hash } = await response.json();
      found[`${site} ${entity}`] = `${total} ${hash}`;
    }
  }
  return found;
}

/** Wait until every site's lists are as they were before, for at most ten minutes. */
async function sameLists(before, where) {
  let differ = [];
  try {
    await until(
      `the sites' lists ${where}`,
      async () => {
        try {
          const now = await lists();
          differ = Object.keys(before).filter((key) => now[key] !== before[key]);
        } catch (error) {
          differ = [String(error)];
        }
        return differ.length === 0;
      },
      MINUTE,
      10 * MINUTE,
    );
  } catch {
    throw new Error(`the sites' lists ${where} differ from before: ${differ.join(', ')}`);
  }
  say(`The sites' lists ${where} are as before (${Object.keys(before).length} lists).`);
}

/** Delete the copy, only ever a server by the copy's name and tag that staging does not use. */
async function deleteCopy() {
  const copy = await clusterNamed(COPY);
  if (!copy) return;
  if (!(copy.tags ?? []).includes(TAG))
    throw new Error(`${COPY} lacks the tag ${TAG}; left as it is`);
  if ((await stagingCluster()) === COPY)
    throw new Error(`staging still runs on ${COPY}; left as it is`);
  await api(`/databases/${copy.id}`, { method: 'DELETE' });
  say(`${COPY} deleted.`);
}

/** After a drill that was cut off: staging back on its own server, then the copy deleted. */
async function undo() {
  if ((await stagingCluster()) === COPY) {
    await pointStaging(COPY, CLUSTER);
    say(`Staging runs on ${CLUSTER} again.`);
  }
  await deleteCopy();
}

async function drill() {
  if (await clusterNamed(COPY)) {
    throw new Error(`${COPY} exists already; run with --undo after a drill that was cut off`);
  }
  if ((await stagingCluster()) !== CLUSTER) throw new Error(`staging does not run on ${CLUSTER}`);
  const original = await clusterNamed(CLUSTER);
  if (!original) throw new Error(`no database server named ${CLUSTER}`);

  const failingBefore = await failing();
  const listsBefore = await lists();
  say(
    `Before: staging fails ${failingBefore.join(', ') || 'no check'}; ${Object.keys(listsBefore).length} lists read on ${SITES.length} sites.`,
  );

  const { database: copy } = await api('/databases', {
    method: 'POST',
    body: JSON.stringify({
      name: COPY,
      engine: original.engine,
      version: original.version,
      region: original.region,
      size: original.size,
      num_nodes: 1,
      storage_size_mib: original.storage_size_mib,
      tags: [TAG],
      backup_restore: { database_name: CLUSTER },
    }),
  });
  say(`${COPY} is being made from ${CLUSTER}'s latest backup.`);
  await until(
    `${COPY} online`,
    async () => (await api(`/databases/${copy.id}`)).database.status === 'online',
    30_000,
    30 * MINUTE,
  );
  await api(`/databases/${copy.id}/firewall`, {
    method: 'PUT',
    body: JSON.stringify({ rules: [{ type: 'app', value: STAGING }] }),
  });
  say(`${COPY} is online and reachable from staging alone.`);

  const onCopy = await pointStaging(CLUSTER, COPY);
  say(`Staging runs on ${COPY} (deploy ${onCopy}): the preview read the restored records.`);
  const failingOnCopy = await settled(failingBefore);
  say(`On ${COPY} staging fails ${failingOnCopy.join(', ') || 'no check'}, as before or fewer.`);
  await sameLists(listsBefore, `on ${COPY}`);

  const back = await pointStaging(COPY, CLUSTER);
  say(`Staging runs on ${CLUSTER} again (deploy ${back}).`);
  const failingAfter = await settled(failingBefore);
  say(
    `Back on ${CLUSTER} staging fails ${failingAfter.join(', ') || 'no check'}, as before or fewer.`,
  );
  await sameLists(listsBefore, `back on ${CLUSTER}`);
}

if (process.argv.includes('--undo')) {
  await undo();
  process.exit(0);
}
let passed = false;
let cleaned = true;
try {
  await drill();
  passed = true;
} catch (error) {
  say(`Failed: ${words(error)}`);
}
try {
  await undo();
} catch (error) {
  cleaned = false;
  say(`Clean-up failed: ${words(error)}; run the drill with --undo.`);
}
const result = passed ? 'passed' : 'failed';
mkdirSync(join(RECORD, '..'), { recursive: true });
writeFileSync(
  RECORD,
  `${JSON.stringify({ ran: new Date().toISOString(), tests: { [TEST]: result }, steps }, null, 2)}\n`,
);
say(`The drill ${result}; recorded in .do/drills/restore-drill.json.`);
process.exit(passed && cleaned ? 0 : 1);
