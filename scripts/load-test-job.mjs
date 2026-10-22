// The load test's own part (AC 27), run inside a temporary copy of staging by
// scripts/load-test.mjs, as that app's job after its deploy. It fills the empty database with ten
// times launch: 200 tenants, one of them with 300,000 properties and each other one with 500, made
// from Vitec's golden property cases so each record has a real record's size. Then it pulls
// /v1/changes through the app's public address as sites do, all at once:
//
//   - the big tenant's site syncing from 0, page after page, to its end;
//   - two other sites syncing from 0, tenant after tenant;
//   - ten delta pulls a second from all tenants' sites, after their last record.
//
// It measures every request's time to the first byte and to the last, and prints them per kind
// with a last line `load-test result {json}` for the orchestrator. The criterion is read on the
// full 100-item pages; the delta pulls are the load they share the app with. To tell where the
// time goes, it first times pages with nothing else running, straight from the database and
// through the app, and times one page straight from the database every 3 seconds under the load.
//
//   DATABASE_URL=… CREDENTIALS_KEY=… APP_URL=… node scripts/load-test-job.mjs
//
// LOAD_TENANTS, LOAD_BIG, LOAD_OTHERS and LOAD_MINUTES make a smaller run on a machine of one's own.
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { join } from 'node:path';
import { gunzip } from 'node:zlib';
import { promisify } from 'node:util';
import { closeDb, db } from '../dist/engine/storage/db.js';
import { changesPage, fillPageParts } from '../dist/engine/storage/items.js';
import {
  configureCredentials,
  createTenant,
  upsertConnection,
} from '../dist/engine/storage/connections.js';
import { migrate } from '../dist/engine/storage/migrate.js';

const TENANTS = Number(process.env['LOAD_TENANTS'] ?? 200);
const BIG = Number(process.env['LOAD_BIG'] ?? 300_000);
const OTHERS = Number(process.env['LOAD_OTHERS'] ?? 500);
const MINUTES = Number(process.env['LOAD_MINUTES'] ?? 20);
/**
 * DigitalOcean stops a deploy's job after 30 minutes, its build of about 4 included, and keeps no
 * log of a job it stopped (three runs lost on 2026-10-22). So the load runs for what is left of 24
 * minutes once the database is filled and its parts are made, and never less than 5.
 */
const BUDGET_MINUTES = 24;
const MIN_MINUTES = 5;
const began = Date.now();
const BATCH = 2_000;
const DELTAS_PER_SECOND = 10;
const PAGE = 100;
const TARGET = { ttfb: 100, total: 300 };

const root = join(import.meta.dirname, '..');
const base = new URL(process.env['APP_URL'] ?? 'http://127.0.0.1:3000');
const say = (line) => console.log(`${new Date().toISOString().slice(11, 19)} ${line}`);

/** Vitec's three golden property cases, as Core stores a record: the payload and the universal data with display. */
const cases = ['for-sale', 'sold', 'coming-with-viewing'].map((name) => {
  const read = (file) =>
    JSON.parse(readFileSync(join(root, 'golden/vitec/property', name, file), 'utf8'));
  return {
    raw: read('payload.json'),
    data: { ...read('canonical.json'), display: read('display.json') },
  };
});

/** Fill the database: the tenants, a connection each, and their properties, in batches. */
async function seed() {
  db(process.env['DATABASE_URL']);
  configureCredentials(process.env['CREDENTIALS_KEY'] ?? '');
  await migrate();
  const tenants = [];
  for (let n = 0; n < TENANTS; n += 1) {
    const token = randomBytes(32).toString('base64url');
    const id = await createTenant({ displayName: `Load test ${n + 1}`, token });
    const connection = `load-test-${id}`;
    await upsertConnection({ id: connection, tenantId: id, provider: 'loadtest' });
    const count = n === 0 ? BIG : OTHERS;
    for (let from = 0; from < count; from += BATCH) {
      await db().query(
        `insert into items (tenant_id, connection_id, datatype, remote_id, office_id, seq,
           content_hash, raw, data, remote_updated_at, rules_version)
         select $1, $2, 'property', 'P' || n, 'O1', nextval('item_seq'), md5($2 || n),
           c -> 'raw' || jsonb_build_object('loadTestNumber', n),
           c -> 'data' || jsonb_build_object('remote_id', 'P' || n), now(), 'load-test'
         from generate_series($3::int + 1, $3::int + $4::int) as n,
           lateral (select $5::jsonb -> (n % 3) as c) as picked`,
        [id, connection, from, Math.min(BATCH, count - from), JSON.stringify(cases)],
      );
    }
    const { rows } = await db().query('select max(seq) as last from items where tenant_id = $1', [
      id,
    ]);
    tenants.push({ id, token, count, last: Number(rows[0].last) });
    if (n === 0 || (n + 1) % 50 === 0) say(`Seeded ${n + 1} of ${TENANTS} tenants.`);
  }
  // Written straight into the table, the records have no page parts yet: made as the worker makes
  // them after a deploy, so pages are measured as they are once it is done.
  const started = Date.now();
  const filled = await fillPageParts();
  say(
    `Made the page parts of ${filled} records in ${Math.round((Date.now() - started) / 1000)} s.`,
  );
  const { rows } = await db().query(
    `select count(*) as items, pg_size_pretty(pg_database_size(current_database())) as size from items`,
  );
  say(`The database holds ${rows[0].items} records, ${rows[0].size} in all.`);
  await db().query('analyze items');
  return tenants;
}

const client = base.protocol === 'https:' ? https : http;
const agent = new client.Agent({ keepAlive: true, maxSockets: 64 });
const inflate = promisify(gunzip);

/** One pull as a site makes it: the times to the first byte and to the last, and where the next page starts. */
function pull(token, after) {
  return new Promise((resolve) => {
    const started = performance.now();
    const request = client.get(
      new URL(`/v1/changes?datatype=property&after=${after}&limit=${PAGE}`, base),
      {
        agent,
        headers: {
          authorization: `Bearer ${token}`,
          'accept-encoding': 'gzip',
          'x-core-client': 'load-test',
        },
      },
      (response) => {
        const ttfb = performance.now() - started;
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', async () => {
          const total = performance.now() - started;
          let body = Buffer.concat(chunks);
          if (response.headers['content-encoding'] === 'gzip') body = await inflate(body);
          // The page's end says where the next starts; reading only the end keeps this process light.
          const tail = body.subarray(Math.max(0, body.length - 200)).toString();
          const next = Number(/"next_after":(\d+)/.exec(tail)?.[1] ?? after);
          resolve({
            status: response.statusCode,
            ttfb,
            total,
            next,
            more: tail.includes('"has_more":true'),
          });
        });
      },
    );
    request.on('error', (error) => {
      resolve({ status: 0, ttfb: 0, total: performance.now() - started, error: String(error) });
    });
  });
}

const measured = { full: [], partial: [], delta: [], failed: [], queryUnderLoad: [] };
const keep = (kind, result) => {
  if (result.status !== 200) measured.failed.push(result.error ?? `HTTP ${result.status}`);
  else measured[kind].push(result);
};

/** A site syncing a tenant from 0 to its end, one page after the other. */
async function fullSync(tenant, stop) {
  let after = 0;
  for (;;) {
    const result = await pull(tenant.token, after);
    // Core says there is more exactly when the page is full (engine/http/changes.ts).
    keep(result.more ? 'full' : 'partial', result);
    if (result.status !== 200 || !result.more || Date.now() > stop) return;
    after = result.next;
  }
}

const percentile = (values, p) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]);
};
const summary = (results) => ({
  count: results.length,
  ttfb: {
    p50: percentile(
      results.map((r) => r.ttfb),
      50,
    ),
    p95: percentile(
      results.map((r) => r.ttfb),
      95,
    ),
  },
  total: {
    p50: percentile(
      results.map((r) => r.total),
      50,
    ),
    p95: percentile(
      results.map((r) => r.total),
      95,
    ),
  },
});

/** How long the database takes for one of the big tenant's 100-item pages, as /v1/changes asks it. */
async function queryTime(tenant, after) {
  const started = performance.now();
  await changesPage({ tenantId: tenant.id, datatype: 'property', after, limit: PAGE });
  return performance.now() - started;
}

/**
 * The same pages with nothing else running: 30 pages straight from the database, then the next
 * 30 through the app, so each part is measured on pages neither has read before.
 */
async function alone(big) {
  const first = big.last - big.count;
  const query = [];
  for (let n = 0; n < 30; n += 1) query.push({ total: await queryTime(big, first + n * PAGE) });
  const pulled = [];
  for (let n = 30; n < 60; n += 1) pulled.push(await pull(big.token, first + n * PAGE));
  return { query, pulled };
}

/** The database's time for a page now and then while the load runs. */
function sampleQueries(big, samples) {
  const first = big.last - big.count;
  return setInterval(() => {
    const after = first + Math.floor(Math.random() * (big.count / PAGE - 1)) * PAGE;
    void queryTime(big, after).then((total) => samples.push({ total }));
  }, 3_000);
}

async function load(tenants) {
  const left = BUDGET_MINUTES - (Date.now() - began) / 60_000;
  const minutes = Math.min(MINUTES, Math.max(MIN_MINUTES, Math.floor(left)));
  const stop = Date.now() + minutes * 60_000;
  const [big, ...others] = tenants;
  let finished = false;
  const deltas = [];
  const ticker = setInterval(() => {
    for (let n = 0; n < DELTAS_PER_SECOND / 10; n += 1) {
      const tenant = tenants[Math.floor(Math.random() * tenants.length)];
      deltas.push(
        pull(tenant.token, tenant.last - Math.floor(Math.random() * 3)).then((r) =>
          keep('delta', r),
        ),
      );
    }
  }, 100);
  const othersSync = async (offset) => {
    for (let n = offset; !finished && Date.now() < stop; n = (n + 2) % others.length) {
      await fullSync(others[n], stop);
    }
  };
  const sampler = sampleQueries(big, measured.queryUnderLoad);
  say(
    `Pulling for ${minutes} minutes: the big tenant from 0, two other sites from 0, ${DELTAS_PER_SECOND} delta pulls a second.`,
  );
  await Promise.all([
    fullSync(big, stop).then(() => {
      finished = true;
    }),
    ...(others.length > 0 ? [othersSync(0), othersSync(1)] : []),
  ]);
  clearInterval(ticker);
  clearInterval(sampler);
  await Promise.all(deltas);
}

/** Wait, for at most five minutes, until the app answers at its public address as sites reach it. */
async function reachable() {
  const end = Date.now() + 5 * 60_000;
  for (;;) {
    const answered = await new Promise((resolve) => {
      client
        .get(new URL('/v1/ready', base), { agent }, (response) => {
          response.resume();
          resolve(response.statusCode === 200);
        })
        .on('error', () => resolve(false));
    });
    if (answered) return;
    if (Date.now() > end) throw new Error(`${base.host} did not answer in five minutes`);
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
}

const tenants = await seed();
await reachable();
const quiet = await alone(tenants[0]);
say(
  `Alone: the database ${summary(quiet.query).total.p50} ms a page (p95 ${summary(quiet.query).total.p95}); through the app first byte ${summary(quiet.pulled).ttfb.p50} ms, whole ${summary(quiet.pulled).total.p50} ms (p95 ${summary(quiet.pulled).ttfb.p95} and ${summary(quiet.pulled).total.p95}).`,
);
await load(tenants);
await closeDb();
const result = {
  tenants: TENANTS,
  big: BIG,
  others: OTHERS,
  pages: summary(measured.full),
  partial: summary(measured.partial),
  deltas: summary(measured.delta),
  failed: measured.failed.length,
  firstFailures: measured.failed.slice(0, 5),
  alone: { query: summary(quiet.query).total, pulled: summary(quiet.pulled) },
  queryUnderLoad: summary(measured.queryUnderLoad).total,
  target: TARGET,
};
result.passed =
  result.failed === 0 &&
  result.pages.count > 0 &&
  result.pages.ttfb.p95 < TARGET.ttfb &&
  result.pages.total.p95 < TARGET.total;
say(
  `100-item pages: ${result.pages.count}, first byte p95 ${result.pages.ttfb.p95} ms (target under ${TARGET.ttfb}), whole page p95 ${result.pages.total.p95} ms (target under ${TARGET.total}).`,
);
say(
  `Under load the database took ${result.queryUnderLoad.p50} ms a page (p95 ${result.queryUnderLoad.p95}).`,
);
say(
  `Delta pulls: ${result.deltas.count}, first byte p95 ${result.deltas.ttfb.p95} ms, whole p95 ${result.deltas.total.p95} ms. Failed requests: ${result.failed}.`,
);
console.log(`load-test result ${JSON.stringify(result)}`);
agent.destroy();
