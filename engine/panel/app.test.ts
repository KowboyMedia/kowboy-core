// The panel's browser app under /admin: its files, its page for every other address under /admin,
// and a 503 page that says how to build it when there is no build.
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { harness, type Harness } from '../../acceptance/harness.js';
import { configurePanelApp } from './app.js';

let core: Harness;
const built = mkdtempSync(join(tmpdir(), 'panel-'));
const PAGE = '<!doctype html><html><head><title>Kowboy Core</title></head><body></body></html>';

beforeAll(async () => {
  core = await harness({ subscriber: false });
  mkdirSync(join(built, 'assets'));
  writeFileSync(join(built, 'index.html'), PAGE);
  writeFileSync(join(built, 'assets', 'index-abc123.js'), 'console.log(1)');
});
afterAll(async () => {
  configurePanelApp(resolve(process.cwd(), 'dist/panel'));
  await core.stop();
});

const get = (path: string) => fetch(`${core.baseUrl}${path}`);

/** A request with its path exactly as written, which fetch would tidy first. */
const raw = (path: string): Promise<string> =>
  new Promise((done, fail) => {
    const sent = request(`${core.baseUrl}${path}`, { path }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => done(Buffer.concat(chunks).toString('utf8')));
    });
    sent.on('error', fail);
    sent.end();
  });

describe('the admin panel’s app under /admin', () => {
  it('answers /admin and every deep address with the app’s page', async () => {
    configurePanelApp(built);
    for (const path of ['/admin', '/admin/', '/admin/tenants/1', '/admin/link']) {
      const response = await get(path);
      expect(response.status, path).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
      expect(response.headers.get('x-frame-options')).toBe('DENY');
      expect(await response.text()).toBe(PAGE);
    }
  });

  it('serves the app’s own files, those under assets/ for good', async () => {
    configurePanelApp(built);
    const script = await get('/admin/assets/index-abc123.js');
    expect(script.status).toBe(200);
    expect(script.headers.get('content-type')).toContain('text/javascript');
    expect(script.headers.get('cache-control')).toContain('immutable');
    expect(await script.text()).toBe('console.log(1)');
  });

  it('never reaches outside the build', async () => {
    configurePanelApp(built);
    for (const path of [
      '/admin/../package.json',
      '/admin/%2e%2e/package.json',
      '/admin//etc/hosts',
    ]) {
      const page = await raw(path);
      expect(page, path).not.toContain('kowboy-core');
      expect(page, path).not.toContain('localhost');
    }
  });

  it('answers 503 with a page that says how to build it, when there is no build', async () => {
    configurePanelApp(join(built, 'missing'));
    for (const path of ['/admin', '/admin/tenants/1']) {
      const response = await get(path);
      expect(response.status, path).toBe(503);
      expect(response.headers.get('content-type')).toContain('text/html');
      const page = await response.text();
      expect(page).toContain('<title>Kowboy Core</title>');
      expect(page).toContain('npm run build');
    }
  });
});
