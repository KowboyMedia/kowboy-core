// The WordPress install the client tests drive (WP_ROOT, prepared by test/setup.sh), served by
// PHP's built-in server so the REST endpoints, WP-Cron, the bell and the pages all run for real.
// The sync suite and the template suite share it.
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect } from 'vitest';
import { until } from '../../../acceptance/harness.js';
import {
  freePort,
  type ClientDriver,
  type ClientItem,
  type ClientStatus,
  type CoreDetails,
  type Kind,
} from '../../sync-scenarios.js';

export const WP_ROOT = process.env['WP_ROOT'] ?? join(homedir(), '.cache/kowboy-core/wordpress');
const WP_CLI = join(WP_ROOT, '..', 'wp-cli.phar');
const DRIVER = join(import.meta.dirname, 'driver.php');
export const run = promisify(execFile);

if (!existsSync(join(WP_ROOT, 'wp-load.php'))) {
  throw new Error(`no WordPress install at ${WP_ROOT}: run clients/wordpress/test/setup.sh first`);
}

/** One command through the driver. The last line of its output is the answer, as JSON. */
export async function driver<T>(command: string, argument = ''): Promise<T> {
  const { stdout } = await run('php', [DRIVER, command, argument], {
    env: { ...process.env, WP_ROOT },
    maxBuffer: 16 * 1024 * 1024,
  });
  const lines = stdout.trim().split('\n');
  return JSON.parse(lines[lines.length - 1] ?? 'null') as T;
}

export const wp = (...args: string[]): Promise<{ stdout: string; stderr: string }> =>
  run('php', [WP_CLI, `--path=${WP_ROOT}`, '--allow-root', ...args], {
    env: { ...process.env, WP_ROOT },
  });

let server: ChildProcess | null = null;
/** The address the site is served on while it runs. */
export let siteUrl = '';

export async function start(core: CoreDetails): Promise<ClientDriver> {
  const port = await freePort();
  siteUrl = `http://127.0.0.1:${port}`;
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

export async function stop(): Promise<void> {
  const running = server;
  if (!running) return;
  server = null;
  const exited = new Promise<void>((resolve) => running.once('exit', () => resolve()));
  running.kill('SIGTERM');
  await exited;
}
