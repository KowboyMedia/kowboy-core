// The web role exactly as deployed, `node dist/main.js web` in a function: the adapters' mappers
// are registered without the adapters started, so a recompute from the admin API works; the app
// itself is served under /admin; and the maintenance login lets only an allowed address in.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { main } from '../main.js';
import { adapterApi } from '../engine/adapter-api/index.js';
import { clearRegistry } from '../engine/registry.js';
import { queryEvents } from '../engine/events.js';
import { createTenant, upsertConnection } from '../engine/storage/connections.js';
import type { Engine } from '../engine/index.js';
import { ADMIN_SECRET, TOKEN, truncate } from './harness.js';

const CONNECTION = 'vitec-entrypoint';
const OFFICE = 'M77';

const estate = {
  id: 'OBJ-ENTRY',
  customerId: OFFICE,
  changedAt: '2026-09-10T08:00:00.1234567+02:00',
  status: { id: 1, name: 'Till salu' },
  address: { streetAddress: 'Storgatan 1', city: 'Malmö' },
  price: { startingPrice: 2000000, currency: 'SEK' },
};

let engine: Engine;
let server: Server;
let baseUrl: string;

beforeEach(async () => {
  clearRegistry();
  process.env['ADMIN_LOGIN_WITHOUT_EMAIL'] = 'true';
  process.env['PORT'] = '0';
  const started = await main('web');
  engine = started.engine;
  server = started.server as Server;
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  await truncate();
  await createTenant({ displayName: 'Entry tenant', token: TOKEN });
  await upsertConnection({
    id: CONNECTION,
    tenantId: 1,
    provider: 'vitec',
    licensedOffices: [OFFICE],
  });
});

afterEach(async () => {
  delete process.env['ADMIN_LOGIN_WITHOUT_EMAIL'];
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await engine.stop();
});

const admin = (
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<Response> =>
  fetch(`${baseUrl}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'x-admin-secret': ADMIN_SECRET, 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe('the web process as deployed', () => {
  it('recomputes a stored record from the admin API with no adapter started (AC 13)', async () => {
    // The record arrives the way the worker's adapter would write it: through the adapter API.
    const api = adapterApi('vitec');
    const written = await api.ingest(
      {
        id: CONNECTION,
        tenantId: 1,
        provider: 'vitec',
        credentials: null,
        licensedOffices: [OFFICE],
        active: true,
      },
      'property',
      estate.id,
      estate,
    );
    expect(written.outcome).toBe('written');

    const synchronous = await admin('/v1/admin/recompute', {
      connection_id: CONNECTION,
      dry_run: true,
    });
    expect(synchronous.status).toBe(200);
    const preview = (await synchronous.json()) as { examined: number; failed: number };
    expect(preview.examined).toBe(1);
    expect(preview.failed).toBe(0);

    // The same through the panel's API: a job, run here as the worker would run it.
    const queued = await admin('/v1/admin/jobs', {
      scope: { connectionId: CONNECTION },
      dryRun: true,
    });
    expect(queued.status).toBe(201);
    const { runNextJob } = await import('../engine/jobs.js');
    expect(await runNextJob()).toBe(true);
    const { id } = (await queued.json()) as { id: number };
    const job = (await (await admin(`/v1/admin/jobs/${id}`)).json()) as {
      job: { state: string; result: { examined: number } };
    };
    expect(job.job.state).toBe('done');
    expect(job.job.result.examined).toBe(1);
  });

  it('serves the app under /admin and its API next to it', async () => {
    const page = await fetch(`${baseUrl}/admin/tenants/1`);
    expect(page.status).toBe(200);
    expect(page.headers.get('content-type')).toContain('text/html');
    expect(page.headers.get('content-security-policy')).toContain("default-src 'self'");
    const html = await page.text();
    expect(html).toContain('<div id="root">');
    expect(html).toContain('/admin/assets/');
    const mode = await fetch(`${baseUrl}/v1/admin/login-mode`);
    expect(((await mode.json()) as { maintenanceLogin: boolean }).maintenanceLogin).toBe(true);
    expect((await fetch(`${baseUrl}/v1/admin/session`)).status).toBe(401);
  });

  it('lets only an allowed address in through the maintenance login, and logs every attempt', async () => {
    const refused = await fetch(`${baseUrl}/v1/admin/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'someone@elsewhere.test' }),
    });
    expect(refused.status).toBe(401);
    expect(refused.headers.get('set-cookie')).toBeNull();

    const allowed = await fetch(`${baseUrl}/v1/admin/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'operator@example.test', remember: true }),
    });
    expect(allowed.status).toBe(200);
    const cookie = allowed.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('core_admin_session=');
    expect(cookie).toContain('Max-Age=');
    const session = await fetch(`${baseUrl}/v1/admin/session`, {
      headers: { cookie: cookie.split(';')[0] ?? '' },
    });
    expect(((await session.json()) as { user: string }).user).toBe('operator@example.test');

    const attempts = await queryEvents({ type: 'admin.login' });
    expect(
      attempts.map((event) => [event.fields['email'], event.fields['ok'], event.fields['via']]),
    ).toEqual([
      ['someone@elsewhere.test', false, 'maintenance'],
      ['operator@example.test', true, 'maintenance'],
    ]);
  });
});
