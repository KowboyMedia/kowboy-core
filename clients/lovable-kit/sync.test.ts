// The Lovable kit against the real Core: the function runs under Deno as Supabase would run it,
// against this test database, and answers bells from an in-process Core.
import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { harness, until, TOKEN } from '../../acceptance/harness.js';
import { fakePollingAdapter, poll } from '../../adapters/fake-polling/index.js';
import * as crm from '../../adapters/fake-polling/crm.js';
import {
  BELL_SECRET,
  CONNECTION,
  fakeProperty,
  freePort,
  syncScenarios,
  type ClientDriver,
  type ClientItem,
  type ClientStatus,
  type CoreDetails,
  type Kind,
} from '../sync-scenarios.js';

const KIT = import.meta.dirname;
const FUNCTION = join(KIT, 'supabase/functions/core-sync/index.ts');
const CONFIG = join(KIT, 'supabase/functions/core-sync/deno.json');
/** The site's tables and their additions; 0002 is the pg_cron backstop, which the test drives by hand. */
const MIGRATIONS = ['0001_core_client.sql', '0003_raw.sql'].map((file) =>
  join(KIT, 'supabase/migrations', file),
);
const DENO = join(KIT, '../../node_modules/.bin/deno');

const TABLES: Record<string, string> = {
  office: 'offices',
  agent: 'agents',
  area: 'areas',
  association: 'associations',
  project: 'projects',
  property: 'properties',
};

// The site's database. Here it is the same server as Core's, which no site would ever do.
const site = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
let deno: ChildProcess | null = null;

beforeAll(async () => {
  for (const migration of MIGRATIONS) await site.query(readFileSync(migration, 'utf8'));
});

afterAll(async () => {
  await site.end();
});

async function start(
  core: CoreDetails,
  extraEnv: Record<string, string> = {},
): Promise<ClientDriver> {
  await site.query(`truncate ${Object.values(TABLES).join(', ')}, core_sync_state`);

  const port = await freePort();
  const bellUrl = `http://127.0.0.1:${port}/`;
  deno = spawn(DENO, ['run', '--quiet', '--allow-all', '--config', CONFIG, FUNCTION], {
    env: {
      ...process.env,
      PORT: String(port),
      CORE_URL: core.url,
      CORE_TENANT_TOKEN: core.token,
      CORE_BELL_SECRET: core.bellSecret,
      SUPABASE_DB_URL: process.env['DATABASE_URL'] ?? '',
      // What Supabase injects for the function's own address; chaining calls itself through it.
      SUPABASE_URL: `http://127.0.0.1:${port}`,
      ...extraEnv,
    },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  await until(
    () =>
      fetch(bellUrl).then(
        () => true,
        () => false,
      ),
    'the function to listen',
    30_000,
  );

  const bell = async (kind: Kind, secret: string): Promise<number> => {
    const response = await fetch(bellUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-core-secret': secret },
      body: JSON.stringify({ kind }),
    });
    return response.status;
  };

  return {
    bellUrl,
    bell,
    async trigger(kind: Kind): Promise<void> {
      expect(await bell(kind, BELL_SECRET)).toBe(202);
    },
    // What pg_cron does every 15 minutes: the same call, from inside the database.
    async backstop(): Promise<void> {
      expect(await bell('delta', BELL_SECRET)).toBe(202);
    },
    async items(datatype: string): Promise<ClientItem[]> {
      const { rows } = await site.query<ClientItem & { synced_at: Date }>(
        `select connection_id, remote_id, content_hash, synced_at, data, raw
         from ${TABLES[datatype]} order by remote_id`,
      );
      return rows.map((row) => ({ ...row, synced_at: row.synced_at.toISOString() }));
    },
    async status(): Promise<ClientStatus> {
      const { rows } = await site.query<{ name: string; value: string }>(
        'select name, value from core_sync_state',
      );
      const state = Object.fromEntries(rows.map((row) => [row.name, row.value]));
      return {
        runs: Number(state['runs'] ?? 0),
        pending: state['pending'] ?? null,
        running_since: state['running_since'] ?? null,
        last_success_at: state['last_success_at'] ?? null,
        last_error: state['last_error'] ?? null,
        after: Object.fromEntries(
          Object.keys(TABLES).map((datatype) => [
            datatype,
            Number(state[`after.${datatype}`] ?? 0),
          ]),
        ),
      };
    },
    async damage(datatype: string, remoteId: string): Promise<void> {
      await site.query(
        `update ${TABLES[datatype]} set data = '{"damaged": true}'::jsonb where remote_id = $1`,
        [remoteId],
      );
    },
  };
}

async function stop(): Promise<void> {
  const running = deno;
  if (!running) return;
  deno = null;
  const exited = new Promise<void>((resolve) => running.once('exit', () => resolve()));
  running.kill('SIGTERM');
  await exited;
}

syncScenarios('the Lovable kit', { start, stop });

describe('the Lovable kit on its own', () => {
  it('finishes a sync that outlasts one invocation by calling itself, from one bell', async () => {
    crm.reset();
    const core = await harness({
      adapters: [fakePollingAdapter],
      connections: [{ id: CONNECTION, provider: 'fake-polling' }],
      subscriber: false, // Core rings nobody: the one bell below is the only external trigger
    });
    // A budget of nothing: every invocation hands over after its first page.
    const client = await start(
      { url: core.baseUrl, token: TOKEN, bellSecret: BELL_SECRET },
      { CORE_SYNC_BUDGET_MS: '0' },
    );
    try {
      const ids = Array.from({ length: 120 }, (_, index) => `P-${String(index).padStart(3, '0')}`);
      for (const id of ids) crm.put('property', id, fakeProperty(id));
      crm.put('office', 'B-1', { branch_id: 'B-1', branch_name: 'Main street' });
      await poll();

      const converged = async (): Promise<boolean> => {
        const status = await client.status();
        return (
          status.pending === null &&
          status.running_since === null &&
          status.last_success_at !== null &&
          (await client.items('property')).length === ids.length
        );
      };

      expect(await client.bell('delta', BELL_SECRET)).toBe(202);
      await until(converged, 'the chain of invocations to finish', 60_000);
      const delta = await client.status();
      // 120 properties are two pages: the first invocation hands over after page one.
      expect(delta.runs).toBeGreaterThanOrEqual(2);
      expect(delta.last_error).toBeNull();

      // A rebuild hands over the same way, carries on from its cursors, and sweeps only at the end.
      await site.query(
        `update properties set data = '{"damaged": true}'::jsonb where remote_id = 'P-000'`,
      );
      expect(await client.bell('forcerefresh', BELL_SECRET)).toBe(202);
      await until(
        async () => (await converged()) && (await client.status()).runs >= delta.runs + 2,
        'the chained rebuild to finish',
        60_000,
      );
      const repaired = (await client.items('property')).find((item) => item.remote_id === 'P-000');
      expect(repaired?.data?.['fake_label']).toBe('Kungsgatan P-000');
      expect((await client.items('office')).map((item) => item.remote_id)).toEqual(['B-1']);
      const { rows } = await site.query(
        "select value from core_sync_state where name = 'rebuild_started_at'",
      );
      expect(rows).toHaveLength(0);
    } finally {
      await stop();
      await core.stop();
    }
  }, 150_000);
});
