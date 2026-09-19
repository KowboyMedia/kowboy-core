// The WordPress client against the real Core: the shared scenarios through a real WordPress
// install (WP_ROOT, prepared by test/setup.sh) served by PHP's built-in server, so the REST
// endpoint, WP-Cron and the bell all run for real. Then what only WordPress has: the must-use
// updater and the WP-CLI commands.
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
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

const WP_ROOT = process.env['WP_ROOT'] ?? join(homedir(), '.cache/kowboy-core/wordpress');
const WP_CLI = join(WP_ROOT, '..', 'wp-cli.phar');
const DRIVER = join(import.meta.dirname, 'test/driver.php');
const run = promisify(execFile);

if (!existsSync(join(WP_ROOT, 'wp-load.php'))) {
  throw new Error(`no WordPress install at ${WP_ROOT}: run clients/wordpress/test/setup.sh first`);
}

/** One command through the driver. The last line of its output is the answer, as JSON. */
async function driver<T>(command: string, argument = ''): Promise<T> {
  const { stdout } = await run('php', [DRIVER, command, argument], {
    env: { ...process.env, WP_ROOT },
    maxBuffer: 16 * 1024 * 1024,
  });
  const lines = stdout.trim().split('\n');
  return JSON.parse(lines[lines.length - 1] ?? 'null') as T;
}

const wp = (...args: string[]): Promise<{ stdout: string; stderr: string }> =>
  run('php', [WP_CLI, `--path=${WP_ROOT}`, '--allow-root', ...args], {
    env: { ...process.env, WP_ROOT },
  });

let server: ChildProcess | null = null;

async function start(core: CoreDetails): Promise<ClientDriver> {
  const port = await freePort();
  const siteUrl = `http://127.0.0.1:${port}`;
  // Several workers, because a bell makes WordPress call its own wp-cron.php.
  server = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', WP_ROOT], {
    env: { ...process.env, WP_ROOT, PHP_CLI_SERVER_WORKERS: '4' },
    stdio: 'ignore',
  });

  const configured = await driver<{ bell_url: string }>(
    'configure',
    JSON.stringify({
      site: siteUrl,
      url: core.url,
      token: core.token,
      bell_secret: core.bellSecret,
    }),
  );
  await driver('reset');
  await until(
    () =>
      fetch(`${siteUrl}/?rest_route=/`).then(
        (response) => response.ok,
        () => false,
      ),
    'WordPress to serve',
    30_000,
  );

  return {
    bellUrl: configured.bell_url,
    async bell(kind: Kind, secret: string): Promise<number> {
      const response = await fetch(configured.bell_url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-core-secret': secret },
        body: JSON.stringify({ kind }),
      });
      return response.status;
    },
    async trigger(kind: Kind): Promise<void> {
      await driver('sync', kind);
    },
    async backstop(): Promise<void> {
      const result = await driver<{ scheduled: boolean; processed: number }>('backstop');
      expect(result.scheduled).toBe(true);
      expect(result.processed).toBeGreaterThanOrEqual(1);
    },
    items: (datatype: string) => driver<ClientItem[]>('items', datatype),
    status: () => driver<ClientStatus>('status'),
    async damage(datatype: string, remoteId: string): Promise<void> {
      const result = await driver<{ damaged: boolean }>(
        'damage',
        JSON.stringify({ datatype, remote_id: remoteId }),
      );
      expect(result.damaged).toBe(true);
    },
  };
}

async function stop(): Promise<void> {
  const running = server;
  if (!running) return;
  server = null;
  const exited = new Promise<void>((resolve) => running.once('exit', () => resolve()));
  running.kill('SIGTERM');
  await exited;
}

syncScenarios('the WordPress client', { start, stop });

describe('the WordPress client', () => {
  it('touches posts the way WordPress and cache plugins listen for', async () => {
    crm.reset();
    const core = await harness({
      adapters: [fakePollingAdapter],
      connections: [{ id: CONNECTION, provider: 'fake-polling' }],
      subscriber: false, // Core rings nobody, so every write below is this test's own sync
    });
    await start({ url: core.baseUrl, token: TOKEN, bellSecret: BELL_SECRET });
    try {
      crm.put('property', 'P-1', fakeProperty('P-1'));
      crm.put('property', 'P-2', fakeProperty('P-2'));
      await poll();
      const written = await driver<{ hooks: Record<string, number> }>('sync', 'delta');
      expect(written.hooks).toMatchObject({ core_item_updated: 2, core_item_deleted: 0 });
      expect(written.hooks['save_post']).toBeGreaterThanOrEqual(2);
      expect(written.hooks['clean_post_cache']).toBeGreaterThanOrEqual(2);

      crm.remove('property', 'P-1');
      await poll();
      const deleted = await driver<{ hooks: Record<string, number> }>('sync', 'delta');
      expect(deleted.hooks).toMatchObject({ deleted_post: 1, core_item_deleted: 1 });
    } finally {
      await stop();
      await core.stop();
    }
  });

  it('answers /objekt/<id> with 301 to the property, and an unknown or removed id with 301 to the archive (41, 42)', async () => {
    crm.reset();
    const core = await harness({
      adapters: [fakePollingAdapter],
      connections: [{ id: CONNECTION, provider: 'fake-polling' }],
      subscriber: false,
    });
    const site = await start({ url: core.baseUrl, token: TOKEN, bellSecret: BELL_SECRET });
    try {
      crm.put('property', 'P-1', fakeProperty('P-1'));
      await poll();
      await driver('sync', 'delta');
      const origin = new URL(site.bellUrl).origin;
      const at = (name: string): Promise<globalThis.Response> =>
        fetch(`${origin}/?core_property=${encodeURIComponent(name)}`, { redirect: 'manual' });

      const byId = await at('P-1');
      expect(byId.status).toBe(301);
      expect(byId.headers.get('location')).toContain('polling-acme-p-1');
      const oldSlug = await at('storgatan-1-P-1');
      expect(oldSlug.status).toBe(301);
      expect(oldSlug.headers.get('location')).toContain('polling-acme-p-1');
      const gone = await at('P-9');
      expect(gone.status).toBe(301);
      expect(gone.headers.get('location')).toContain('post_type=core_property');
    } finally {
      await stop();
      await core.stop();
    }
  });

  it('packages a release WordPress can install, with the version from the plugin header', async () => {
    const out = mkdtempSync(join(tmpdir(), 'core-client-release-'));
    await run('php', [
      join(import.meta.dirname, 'release.php'),
      out,
      'https://example.test/core-client.zip',
    ]);

    const { stdout } = await run('unzip', ['-Z1', join(out, 'core-client.zip')]);
    const files = stdout.trim().split('\n').sort();
    expect(files).toContain('core-client/core-client.php');
    expect(files).toContain('core-client/includes/sync.php');
    expect(files).toContain('core-client/lib/action-scheduler/action-scheduler.php');
    expect(files.every((file) => file.startsWith('core-client/'))).toBe(true);

    const header = readFileSync(join(import.meta.dirname, 'core-client/core-client.php'), 'utf8');
    const version = /^\s*\*\s*Version:\s*(\S+)/m.exec(header)?.[1];
    expect(JSON.parse(readFileSync(join(out, 'core-client.json'), 'utf8'))).toEqual({
      version,
      package: 'https://example.test/core-client.zip',
    });
  });

  it('ships PHP that parses', async () => {
    // The plugin's own PHP; the bundled Action Scheduler is not ours to lint.
    const files = readdirSync(import.meta.dirname, { recursive: true, encoding: 'utf8' }).filter(
      (file) =>
        file.endsWith('.php') &&
        !file.startsWith('vendor/') &&
        !file.startsWith('core-client/lib/'),
    );
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) await run('php', ['-l', join(import.meta.dirname, file)]);
  });

  it('lets the must-use updater offer a newer release without touching the plugin (AC 21)', async () => {
    const release = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({ version: '9.9.9', package: 'https://kowboy.se/core-client-9.9.9.zip' }),
      );
    });
    await new Promise<void>((resolve) => release.listen(0, '127.0.0.1', () => resolve()));
    try {
      const url = `http://127.0.0.1:${(release.address() as AddressInfo).port}/core-client.json`;
      const result = await driver<{ update: { version: string; package: string } | null }>(
        'update-check',
        url,
      );
      expect(result.update).toEqual({
        version: '9.9.9',
        package: 'https://kowboy.se/core-client-9.9.9.zip',
      });
    } finally {
      release.close();
    }
  });

  it('answers wp core-client status, and wp core-client sync says why it failed', async () => {
    await driver(
      'configure',
      JSON.stringify({
        site: 'http://127.0.0.1:9',
        url: 'http://127.0.0.1:9',
        token: 'no-such-core',
        bell_secret: BELL_SECRET,
      }),
    );
    const status = JSON.parse((await wp('core-client', 'status')).stdout) as ClientStatus;
    expect(Object.keys(status.after).sort()).toEqual(
      ['agent', 'area', 'association', 'office', 'project', 'property'].sort(),
    );

    await expect(wp('core-client', 'sync')).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('pull failed'),
    });
    // The notice every administrator sees (Patric, 2026-09-18): the failure, and an unlinked site.
    const failed = JSON.parse((await wp('core-client', 'status')).stdout) as ClientStatus;
    expect(failed.notice).toContain('failed');
    await wp('option', 'update', 'core_client_token', '');
    const unlinked = JSON.parse((await wp('core-client', 'status')).stdout) as ClientStatus;
    expect(unlinked.notice).toContain('not linked');
  });
});
