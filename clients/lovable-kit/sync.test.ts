// The Lovable kit against the real Core: the function runs under Deno as Supabase would run it,
// against this test database, and answers bells from an in-process Core.
import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, expect } from 'vitest';
import pg from 'pg';
import { until } from '../../acceptance/harness.js';
import {
  BELL_SECRET,
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
const MIGRATION = join(KIT, 'supabase/migrations/0001_core_client.sql');
const DENO = join(KIT, '../../node_modules/.bin/deno');

const TABLES: Record<string, string> = {
  office: 'offices',
  agent: 'agents',
  area: 'areas',
  association: 'associations',
  property: 'properties',
};

// The site's database. Here it is the same server as Core's, which no site would ever do.
const site = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
let deno: ChildProcess | null = null;

beforeAll(async () => {
  await site.query(readFileSync(MIGRATION, 'utf8'));
});

afterAll(async () => {
  await site.end();
});

async function start(core: CoreDetails): Promise<ClientDriver> {
  await site.query(`truncate ${Object.values(TABLES).join(', ')}, core_sync_state`);

  const port = await freePort();
  deno = spawn(DENO, ['run', '--quiet', '--allow-all', '--config', CONFIG, FUNCTION], {
    env: {
      ...process.env,
      PORT: String(port),
      CORE_URL: core.url,
      CORE_TENANT_TOKEN: core.token,
      CORE_BELL_SECRET: core.bellSecret,
      SUPABASE_DB_URL: process.env['DATABASE_URL'] ?? '',
    },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  const bellUrl = `http://127.0.0.1:${port}/`;
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
        `select connection_id, remote_id, content_hash, synced_at, data
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
