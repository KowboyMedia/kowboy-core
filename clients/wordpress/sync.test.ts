// The WordPress client against the real Core: the shared scenarios through a real WordPress
// install (test/site.ts), then what only WordPress has: the must-use updater, the release
// packaging and the WP-CLI commands.
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { harness, TOKEN } from '../../acceptance/harness.js';
import { fakePollingAdapter, poll } from '../../adapters/fake-polling/index.js';
import * as crm from '../../adapters/fake-polling/crm.js';
import {
  BELL_SECRET,
  CONNECTION,
  fakeProperty,
  syncScenarios,
  type ClientStatus,
} from '../sync-scenarios.js';
import { driver, run, start, stop, wp } from './test/site.js';

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

  it('packages the plugin and a set for WordPress, and indexes the sets, from the plugin headers', async () => {
    const out = mkdtempSync(join(tmpdir(), 'core-client-release-'));
    const release = join(import.meta.dirname, 'release.php');
    const plugin = join(import.meta.dirname, 'core-client');
    const theme = join(import.meta.dirname, 'themes', 'kowboy-2026');
    const set = join(import.meta.dirname, 'test', 'fixtures', 'core-client-templates-fixture');
    const targets: [string, string][] = [
      [plugin, 'core-client'],
      [theme, 'kowboy-2026'],
      [set, 'core-client-templates-fixture'],
    ];
    for (const [dir, name] of targets) {
      await run('php', [release, 'package', dir, name, out, 'https://example.test/channel']);
    }
    await run('php', [release, 'index', out, 'https://example.test/channel', `fixture=${set}`]);

    const { stdout } = await run('unzip', ['-Z1', join(out, 'core-client.zip')]);
    const files = stdout.trim().split('\n').sort();
    expect(files).toContain('core-client/core-client.php');
    expect(files).toContain('core-client/includes/sync.php');
    expect(files).toContain('core-client/updater/core-client-updater.php');
    expect(files).toContain('core-client/channel.json');
    expect(files).toContain('core-client/lib/action-scheduler/action-scheduler.php');
    expect(files.every((file) => file.startsWith('core-client/'))).toBe(true);
    const version = /^\s*\*\s*Version:\s*(\S+)/m.exec(
      readFileSync(join(plugin, 'core-client.php'), 'utf8'),
    )?.[1];
    expect(JSON.parse(readFileSync(join(out, 'core-client.json'), 'utf8'))).toEqual({
      version,
      package: `https://example.test/channel/core-client/core-client-${version}.zip`,
    });

    // The theme's package is named by its style.css header and holds the views and the assets.
    const themeFiles = (await run('unzip', ['-Z1', join(out, 'kowboy-2026.zip')])).stdout
      .trim()
      .split('\n');
    expect(themeFiles).toContain('kowboy-2026/style.css');
    expect(themeFiles).toContain('kowboy-2026/core/single-core_property.php');
    expect(themeFiles).toContain('kowboy-2026/assets/kowboy-2026.css');
    const themeVersion = /^Version:\s*(\S+)/m.exec(
      readFileSync(join(theme, 'style.css'), 'utf8'),
    )?.[1];
    expect(JSON.parse(readFileSync(join(out, 'kowboy-2026.json'), 'utf8'))).toEqual({
      version: themeVersion,
      package: `https://example.test/channel/kowboy-2026/kowboy-2026-${themeVersion}.zip`,
    });

    const setFiles = (
      await run('unzip', ['-Z1', join(out, 'core-client-templates-fixture.zip')])
    ).stdout
      .trim()
      .split('\n');
    expect(setFiles).toContain('core-client-templates-fixture/core-client-templates-fixture.php');
    expect(setFiles).toContain('core-client-templates-fixture/card-property.php');
    expect(JSON.parse(readFileSync(join(out, 'sets.json'), 'utf8'))).toEqual([
      {
        slug: 'fixture',
        name: 'Core client templates: fixture',
        version: '0.1.0',
        package: `https://example.test/channel/core-client-templates-fixture/core-client-templates-fixture-0.1.0.zip`,
      },
    ]);
  });

  it('ships PHP that parses', async () => {
    // The plugin's own PHP; the bundled Action Scheduler is not ours to lint.
    const files = readdirSync(import.meta.dirname, { recursive: true, encoding: 'utf8' }).filter(
      (file) =>
        file.endsWith('.php') &&
        !file.startsWith('vendor/') &&
        !file.startsWith('core-client/lib/') &&
        !file.startsWith('themes/kowboy-2026/assets/'),
    );
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) await run('php', ['-l', join(import.meta.dirname, file)]);
  });

  it('lets the must-use updater offer a newer release of the plugin and of a set, and the settings page the sets on offer (AC 21)', async () => {
    const channel = createServer((request, response) => {
      const bodies: Record<string, unknown> = {
        '/core-client/core-client.json': {
          version: '9.9.9',
          package: 'https://kowboy.se/core-client-9.9.9.zip',
        },
        '/core-client-templates-fixture/core-client-templates-fixture.json': {
          version: '9.9.9',
          package: 'https://kowboy.se/core-client-templates-fixture-9.9.9.zip',
        },
        '/sets.json': [
          {
            slug: 'fixture',
            name: 'Fixture set',
            version: '9.9.9',
            package: 'https://kowboy.se/core-client-templates-fixture-9.9.9.zip',
          },
          {
            slug: 'kowboy-2027',
            name: 'Kowboy 2027',
            version: '1.0.0',
            package: 'https://kowboy.se/core-client-templates-kowboy-2027-1.0.0.zip',
          },
        ],
      };
      const body = bodies[request.url ?? ''];
      response.writeHead(body === undefined ? 404 : 200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(body ?? {}));
    });
    await new Promise<void>((resolve) => channel.listen(0, '127.0.0.1', () => resolve()));
    try {
      const url = `http://127.0.0.1:${(channel.address() as AddressInfo).port}/`;
      const result = await driver<{
        offered: Record<string, { version: string; package: string } | null>;
      }>('update-check', url);
      expect(result.offered).toEqual({
        'core-client': { version: '9.9.9', package: 'https://kowboy.se/core-client-9.9.9.zip' },
        'core-client-templates-fixture': {
          version: '9.9.9',
          package: 'https://kowboy.se/core-client-templates-fixture-9.9.9.zip',
        },
      });
      const { sets } = await driver<{ sets: { slug: string }[] }>('sets', url);
      expect(sets.map((set) => set.slug)).toEqual(['fixture', 'kowboy-2027']);
    } finally {
      channel.close();
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
