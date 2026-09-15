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
import { describe, expect, it } from 'vitest';
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
      const result = await driver<{ scheduled: boolean }>('backstop');
      expect(result.scheduled).toBe(true);
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
  it('ships PHP that parses', async () => {
    const files = readdirSync(import.meta.dirname, { recursive: true, encoding: 'utf8' }).filter(
      (file) => file.endsWith('.php') && !file.startsWith('vendor/'),
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
      ['agent', 'area', 'association', 'office', 'property'].sort(),
    );

    await expect(wp('core-client', 'sync')).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('pull failed'),
    });
  });
});
