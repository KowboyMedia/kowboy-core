// The WordPress install the client tests drive (WP_ROOT, prepared by test/setup.sh), served by
// PHP's built-in server so the REST endpoints, WP-Cron, the bell and the pages all run for real.
// The sync suite, the template suite and the journeys' site (journey-site.ts) share it, so no
// test runner is imported here.
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { until } from '../../../acceptance/harness.js';
import {
  freePort,
  type ClientDriver,
  type ClientItem,
  type ClientStatus,
  type CoreDetails,
  type Kind,
} from '../../client-driver.js';

export const WP_ROOT = process.env['WP_ROOT'] ?? join(homedir(), '.cache/kowboy-core/wordpress');
const WP_CLI = join(WP_ROOT, '..', 'wp-cli.phar');
/** The driver next to this file, or next to its source when this runs compiled from `dist`. */
function findDriver(): string {
  const found = [
    import.meta.dirname,
    resolve(import.meta.dirname, '../../../../clients/wordpress/test'),
  ]
    .map((dir) => join(dir, 'driver.php'))
    .find((file) => existsSync(file));
  if (found === undefined) {
    throw new Error('driver.php is neither next to site.ts nor in clients/wordpress/test');
  }
  return found;
}
const DRIVER = findDriver();
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

/** Point the site at this Core and serve it, on a free port. */
export async function start(core: CoreDetails): Promise<ClientDriver> {
  const client = await configure(core);
  await serve();
  return client;
}

/**
 * Point the site at this Core, emptied of records, without serving it yet: what the journeys'
 * site does while it loads its records, so no visitor's request, and no WP-Cron run one spawns,
 * meets a sync halfway. `serve` follows.
 */
export async function configure(core: CoreDetails, port?: number): Promise<ClientDriver> {
  port ??= await freePort();
  siteUrl = `http://127.0.0.1:${String(port)}`;
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
      if (!result.scheduled || result.processed < 1) {
        throw new Error(`the backstop did not run: ${JSON.stringify(result)}`);
      }
    },
    items: (datatype: string) => driver<ClientItem[]>('items', datatype),
    status: () => driver<ClientStatus>('status'),
    async damage(datatype: string, remoteId: string): Promise<void> {
      const result = await driver<{ damaged: boolean }>(
        'damage',
        JSON.stringify({ datatype, remote_id: remoteId }),
      );
      if (!result.damaged) throw new Error(`${datatype} ${remoteId} was not there to damage`);
    },
  };
}

/** Serve the configured site on its address until `stop`. */
export async function serve(): Promise<void> {
  const { port } = new URL(siteUrl);
  // Several workers, because a bell makes WordPress call its own wp-cron.php.
  server = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', WP_ROOT], {
    env: { ...process.env, WP_ROOT, PHP_CLI_SERVER_WORKERS: '4' },
    stdio: 'ignore',
  });
  await until(
    () =>
      fetch(`${siteUrl}/?rest_route=/`).then(
        (response) => response.ok,
        () => false,
      ),
    'WordPress to serve',
    30_000,
  );
}

export async function stop(): Promise<void> {
  const running = server;
  if (!running) return;
  server = null;
  const exited = new Promise<void>((resolve) => running.once('exit', () => resolve()));
  running.kill('SIGTERM');
  await exited;
}
