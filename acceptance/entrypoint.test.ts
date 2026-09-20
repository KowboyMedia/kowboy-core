// The entrypoint as deployed (main.ts), web role alone: no adapter is started there, yet a stored
// record must recompute from the panel and from the admin API, so main.ts registers every
// adapter's mappers in both roles. Until 2026-09-20 the web process had none, and every recompute
// on staging failed with "no adapter registered for this connection".
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { main } from '../main.js';
import { ADMIN_EMAIL, ADMIN_SECRET, truncate } from './harness.js';
import { connectionById, createTenant, upsertConnection } from '../engine/storage/connections.js';
import { ingest } from '../engine/ingest.js';

const CONNECTION = 'vitec-web';
const OFFICE = 'M1';
const FORM = { 'content-type': 'application/x-www-form-urlencoded' };

/** An estate as Vitec Connect publishes it, the shape adapters/vitec/vitec.test.ts uses. */
const estate = {
  id: 'OBJ1',
  office: { id: OFFICE, customerId: OFFICE },
  primaryAgentId: 'U1',
  secondaryAgentId: null,
  projectId: 'PR1',
  address: { streetAddress: 'Storgatan 1', area: { id: 'A1', name: 'Centrum' } },
  extensions: { housingCooperative: { association: { id: 'F1' } } },
  changedAt: '2026-09-10T08:00:00.1234567+02:00',
};

let started: Awaited<ReturnType<typeof main>>;
let baseUrl = '';

beforeEach(async () => {
  // The maintenance login (2026-09-19): an allowed address logs in from the form, no mailed link.
  process.env['ADMIN_LOGIN_WITHOUT_EMAIL'] = 'true';
  started = await main('web');
  baseUrl = `http://127.0.0.1:${(started.server?.address() as AddressInfo).port}`;
  await truncate();
  const tenantId = await createTenant({ displayName: 'Test tenant', token: 'web-token' });
  await upsertConnection({
    id: CONNECTION,
    tenantId,
    provider: 'vitec',
    licensedOffices: [OFFICE],
  });
});

afterEach(async () => {
  delete process.env['ADMIN_LOGIN_WITHOUT_EMAIL'];
  await started.engine.stop();
});

const login = async (email: string): Promise<Response> =>
  fetch(`${baseUrl}/admin/login`, {
    method: 'POST',
    headers: FORM,
    body: new URLSearchParams({ email }).toString(),
    redirect: 'manual',
  });

describe('the web process as deployed', () => {
  it('recomputes a stored record from the admin API and the panel with no adapter started (AC 13)', async () => {
    const connection = await connectionById(CONNECTION);
    if (!connection) throw new Error(`no connection ${CONNECTION}`);
    // The write path needs the mapper too: main.ts registered it without starting the adapter.
    expect(await ingest(connection, 'property', 'OBJ1', estate)).toMatchObject({
      outcome: 'written',
    });

    const api = await fetch(`${baseUrl}/v1/admin/recompute`, {
      method: 'POST',
      headers: { 'x-admin-secret': ADMIN_SECRET, 'content-type': 'application/json' },
      body: JSON.stringify({ connection_id: CONNECTION }),
    });
    expect(api.status).toBe(200);
    expect(await api.json()).toMatchObject({ examined: 1, failed: 0 });

    // The panel: the maintenance login from the form, then the record's Recompute button.
    const opened = await login(ADMIN_EMAIL);
    expect(opened.status).toBe(303);
    expect(opened.headers.get('location')).toBe('/admin');
    const cookie = (opened.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    const csrf = cookie.slice(cookie.indexOf('=') + 1);
    const recomputed = await fetch(`${baseUrl}/admin/items/${CONNECTION}/property/OBJ1/recompute`, {
      method: 'POST',
      headers: { cookie, ...FORM },
      body: new URLSearchParams({ csrf }).toString(),
    });
    expect(recomputed.status).toBe(200);
    const html = await recomputed.text();
    expect(html).toContain('examined&quot;: 1');
    expect(html).toContain('failed&quot;: 0');
    expect(html).not.toContain('no adapter registered');
  });

  it('lets only an allowed address in through the maintenance login, and logs every attempt', async () => {
    const refused = await login('someone@elsewhere.test');
    expect(refused.status).toBe(401);
    expect(await refused.text()).toContain('can’t log in here');
    const opened = await login(ADMIN_EMAIL);
    const cookie = (opened.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    const events = await fetch(`${baseUrl}/v1/admin/events?type=admin.login`, {
      headers: { 'x-admin-secret': ADMIN_SECRET },
    });
    const { events: rows } = (await events.json()) as {
      events: { fields: Record<string, unknown> }[];
    };
    expect(rows.map((row) => row.fields['ok'])).toEqual([false, true]);
    expect(rows.every((row) => row.fields['via'] === 'maintenance')).toBe(true);
    expect(
      await fetch(`${baseUrl}/admin/settings`, { headers: { cookie } }).then((r) => r.text()),
    ).toContain('PAUSED for maintenance');
  });
});
