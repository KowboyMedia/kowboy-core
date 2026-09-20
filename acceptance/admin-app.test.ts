// The admin panel's API (docs/admin-panel.md, AC 42), driven through HTTP exactly as the browser
// app drives it: the login by mailed link, the one-page tenant flow, records and their three
// faces, jobs with progress and results, fetch again, the event log with its audit trail, the
// live stream, alerts, and the adapters' panels as data. The browser journeys (admin/e2e) drive
// the same through the app itself.
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  adminCall,
  adminLogin,
  harness,
  pull,
  until,
  ADMIN_EMAIL,
  ADMIN_SECRET,
  TENANT,
  TOKEN,
  type AdminHeaders,
  type Harness,
} from './harness.js';
import { fakeWebhookAdapter, drainFetchList, queueDepth } from '../adapters/fake-webhook/index.js';
import * as crm from '../adapters/fake-webhook/crm.js';
import { runNextJob } from '../engine/jobs.js';
import { checkAlerts } from '../engine/alerts.js';
import { heartbeat } from '../engine/health.js';
import { flushBells } from '../engine/bells.js';
import { DAY_CAP } from '../engine/admin-api/session.js';
import { db } from '../engine/storage/db.js';

const CONNECTION = 'fake-acme';
const PROVIDER = 'fake-webhook';

const property = (
  ref: string,
  officeRef = '100',
  extra: Record<string, unknown> = {},
): Record<string, unknown> => ({
  ref,
  state: 'FOR_SALE',
  streetAddress: `Storgatan ${ref.slice(-1)}`,
  askingPrice: 4950000,
  officeRef,
  areaRefs: [],
  brokerRefs: [],
  associationRef: null,
  updatedUtc: '2026-09-08T10:02:00Z',
  internalCode: 1,
  ...extra,
});

let running: Harness;
let headers: AdminHeaders;

const get = <T = Record<string, unknown>>(path: string) =>
  adminCall<T>(running, headers, 'GET', path);
const post = <T = Record<string, unknown>>(path: string, body?: unknown) =>
  adminCall<T>(running, headers, 'POST', path, body ?? {});
const put = <T = Record<string, unknown>>(path: string, body: unknown) =>
  adminCall<T>(running, headers, 'PUT', path, body);

/** Two records in the fake CRM, loaded into the test tenant's connection. */
async function loadTwo(): Promise<void> {
  crm.put('office', '100', { ref: '100', title: 'Lidingö', updatedUtc: '2026-08-30T09:00:00Z' });
  crm.put('property', 'OBJ-1', property('OBJ-1'));
  crm.put('property', 'OBJ-2', property('OBJ-2'));
  await post(`/v1/admin/connections/${CONNECTION}/events`, { event: 'connection_added' });
  await running.deliver();
  await until(async () => {
    await drainFetchList();
    return (await pull(running.baseUrl, 'property')).items.length === 2;
  }, 'the load');
}

beforeEach(async () => {
  crm.reset();
  running = await harness({
    adapters: [fakeWebhookAdapter],
    connections: [{ id: CONNECTION, provider: PROVIDER, licensedOffices: ['100'] }],
  });
  headers = (await adminLogin(running)).headers;
});

afterEach(async () => {
  await running.stop();
});

describe('the admin panel’s login', () => {
  it('mails a link to an allowed address only, answers every address the same, and keeps a change without the panel’s header out', async () => {
    const ask = (email: string) =>
      fetch(`${running.baseUrl}/v1/admin/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    const stranger = await ask('someone@elsewhere.test');
    expect(stranger.status).toBe(200);
    expect(await stranger.json()).toEqual({ sent: true, minutes: 15 });
    expect(running.mails.some((mail) => mail.to === 'someone@elsewhere.test')).toBe(false);
    const known = await ask('second@example.test');
    expect(await known.json()).toEqual({ sent: true, minutes: 15 });
    expect(running.mails.at(-1)?.to).toBe('second@example.test');
    expect(running.mails.at(-1)?.text).toContain('/v1/admin/login/');

    // The cookie alone is not enough for a change: the app's header must come with it.
    const bare = await fetch(`${running.baseUrl}/v1/admin/housekeeping`, {
      method: 'POST',
      headers: { cookie: headers['cookie'] ?? '', 'content-type': 'application/json' },
      body: '{}',
    });
    expect(bare.status).toBe(403);
    const withHeader = await post('/v1/admin/housekeeping');
    expect(withHeader.status).toBe(200);
    // And nothing at all gets nothing.
    expect((await fetch(`${running.baseUrl}/v1/admin/dashboard`)).status).toBe(401);
    // The admin secret opens the same doors for the agents.
    const agent = await fetch(`${running.baseUrl}/v1/admin/dashboard`, {
      headers: { 'x-admin-secret': ADMIN_SECRET },
    });
    expect(agent.status).toBe(200);
  });

  it('mails at most ten links a day, whatever the form is fed, and one per address per minute', async () => {
    const ask = (email: string) =>
      fetch(`${running.baseUrl}/v1/admin/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    const before = running.mails.length;
    await ask(ADMIN_EMAIL); // asked within a minute of the login: no second link
    expect(running.mails.length).toBe(before);
    for (let i = 0; i < DAY_CAP + 3; i += 1) await ask(`person${i}@example.test`);
    expect(running.mails.length - before).toBe(DAY_CAP - 1);
  });

  it('remembers the device for 30 days when asked, and for the browser session otherwise', async () => {
    const session =
      (await adminLogin(running, 'a@example.test')).response.headers.get('set-cookie') ?? '';
    expect(session).not.toContain('Max-Age');
    expect(session).toContain('HttpOnly');
    expect(session).toContain('SameSite=Lax');
    const remembered =
      (await adminLogin(running, 'b@example.test', true)).response.headers.get('set-cookie') ?? '';
    expect(remembered).toContain(`Max-Age=${30 * 86_400}`);
    const who = await adminCall<{ user: string }>(
      running,
      { cookie: remembered.split(';')[0] ?? '' },
      'GET',
      '/v1/admin/session',
    );
    expect(who.body.user).toBe('b@example.test');
  });
});

describe('the tenant page', () => {
  it('makes a tenant in one save: name, the CRM with its offices, two sites; the answer carries the token, the secrets and the load (AC 42)', async () => {
    crm.put('property', 'OBJ-9', property('OBJ-9', '200'));
    const saved = await post<{
      id: number;
      notes: string[];
      tenant: { token: string };
      sites: { label: string; secret: string }[];
      connection: { id: string };
    }>('/v1/admin/tenants', {
      name: 'Acme',
      active: true,
      connection: { provider: PROVIDER, credentials: null, offices: ['200'], active: true },
      sites: [
        { label: 'acme.se', url: 'http://127.0.0.1:9/bell', active: true },
        { label: 'acme-two.se', url: 'https://two.acme.se/bell', active: true },
      ],
    });
    expect(saved.status).toBe(201);
    expect(saved.body.id).toBe(2);
    expect(saved.body.notes.join(' ')).toContain(
      `Loading every record of 1 office(s) from ${PROVIDER} now`,
    );
    expect(saved.body.tenant.token).toHaveLength(43);
    expect(saved.body.sites.map((site) => site.label)).toEqual(['acme.se', 'acme-two.se']);
    expect(saved.body.sites[0]?.secret).toHaveLength(43);
    expect(saved.body.connection.id).toBe(`${PROVIDER}-2`);

    // The load runs, and the token from the page pulls what arrived.
    await running.deliver();
    await until(async () => {
      await drainFetchList();
      const pulled = await fetch(`${running.baseUrl}/v1/changes?datatype=property`, {
        headers: { authorization: `Bearer ${saved.body.tenant.token}` },
      });
      return ((await pulled.json()) as { items: unknown[] }).items.length === 1;
    }, 'the new tenant’s load');

    // Who did what is in the log.
    const audit = await get<{ events: { fields: Record<string, unknown> }[] }>(
      '/v1/admin/events?type=admin.action&order=desc',
    );
    expect(audit.body.events[0]?.fields).toMatchObject({
      actor: ADMIN_EMAIL,
      action: 'tenant.save',
      tenant: 2,
      made: true,
    });
  });

  it('edits a tenant on the same page: rename, an office added and one dropped, a site switched off, one removed and one added; refusals name the field', async () => {
    const view = await get<{
      tenant: { name: string };
      connection: { offices: string[] };
      sites: { id: number; label: string }[];
    }>(`/v1/admin/tenants/${TENANT}`);
    expect(view.status).toBe(200);
    expect(view.body.connection.offices).toEqual(['100']);
    const site = view.body.sites[0];
    if (!site) throw new Error('the harness gave the tenant no site');

    const refused = await put<{ error: string; errors: Record<string, string> }>(
      `/v1/admin/tenants/${TENANT}`,
      {
        name: '',
        active: true,
        connection: { provider: PROVIDER, credentials: null, offices: [], active: true },
        sites: [{ id: site.id, label: site.label, url: 'nowhere', active: true }],
      },
    );
    expect(refused.status).toBe(422);
    expect(Object.keys(refused.body.errors).sort()).toEqual([
      'connection.offices',
      'name',
      'sites.0.url',
    ]);

    const changed = await put<{
      notes: string[];
      tenant: { name: string };
      connection: { offices: string[] };
      sites: { label: string; active: boolean }[];
    }>(`/v1/admin/tenants/${TENANT}`, {
      name: 'Test tenant renamed',
      active: true,
      connection: { provider: PROVIDER, credentials: null, offices: ['200', '300'], active: true },
      sites: [
        { id: site.id, label: site.label, url: 'http://127.0.0.1:9/bell', active: false },
        { label: 'third.se', url: 'https://third.se/bell', active: true },
      ],
    });
    expect(changed.status).toBe(200);
    expect(changed.body.tenant.name).toBe('Test tenant renamed');
    expect(changed.body.connection.offices).toEqual(['200', '300']);
    expect(changed.body.sites.map((s) => [s.label, s.active])).toEqual([
      [site.label, false],
      ['third.se', true],
    ]);
    expect(changed.body.notes.join(' ')).toContain('Taking 1 office(s) off the sites');
    expect(changed.body.notes.join(' ')).toContain('Loading 2 new office(s)');
    const queued = await db().query<{ event: string; office_ids: string[] }>(
      'select event, office_ids from lifecycle_events order by id',
    );
    expect(queued.rows.map((row) => [row.event, row.office_ids])).toEqual([
      ['offices_removed', ['100']],
      ['offices_added', ['200', '300']],
    ]);

    // A CRM is never changed on an existing tenant.
    const other = await put<{ errors: Record<string, string> }>(`/v1/admin/tenants/${TENANT}`, {
      name: 'x',
      active: true,
      connection: { provider: 'another-crm', credentials: null, offices: ['1'], active: true },
      sites: [],
    });
    expect(other.status).toBe(422);
    expect(other.body.errors['connection.provider']).toBeDefined();

    // Remove the third site again.
    const after = await get<{ sites: { id: number; label: string }[] }>(
      `/v1/admin/tenants/${TENANT}`,
    );
    const third = after.body.sites.find((s) => s.label === 'third.se');
    const removed = await put<{ notes: string[]; sites: { label: string }[] }>(
      `/v1/admin/tenants/${TENANT}`,
      {
        name: 'Test tenant renamed',
        active: true,
        connection: {
          provider: PROVIDER,
          credentials: null,
          offices: ['200', '300'],
          active: true,
        },
        sites: [
          {
            id: third?.id,
            label: 'third.se',
            url: 'https://third.se/bell',
            active: true,
            removed: true,
          },
        ],
      },
    );
    expect(removed.body.sites.map((s) => s.label)).toEqual([site.label]);
    expect(removed.body.notes.join(' ')).toContain('third.se is removed');
  });

  it('rotates the token and a site’s bell secret, rings one site, and queues the connection’s actions', async () => {
    const before = await get<{
      tenant: { token: string };
      sites: { id: number; secret: string }[];
    }>(`/v1/admin/tenants/${TENANT}`);
    const token = await post<{ token: string }>(`/v1/admin/tenants/${TENANT}/token`);
    expect(token.body.token).not.toBe(before.body.tenant.token);
    expect(
      await pull(running.baseUrl, 'property', 0, {}).catch((error: Error) => error.message),
    ).toContain('401');
    const pulled = await fetch(`${running.baseUrl}/v1/changes?datatype=property`, {
      headers: { authorization: `Bearer ${token.body.token}` },
    });
    expect(pulled.status).toBe(200);

    const site = before.body.sites[0];
    if (!site) throw new Error('no site');
    const secret = await post<{ secret: string }>(`/v1/admin/sites/${site.id}/secret`);
    expect(secret.body.secret).not.toBe(site.secret);
    const rung = await post(`/v1/admin/tenants/${TENANT}/ring`, {
      kind: 'forcerefresh',
      site: site.id,
    });
    expect(rung.status).toBe(202);
    await flushBells();
    expect(running.bells.at(-1)?.secret).toBe(secret.body.secret);

    const resync = await post<{ event: string }>(`/v1/admin/connections/${CONNECTION}/events`, {
      event: 'resync',
      datatype: 'property',
    });
    expect(resync.status).toBe(202);
    const removal = await post(`/v1/admin/connections/${CONNECTION}/events`, {
      event: 'connection_removed',
    });
    expect(removal.status).toBe(202);
    const view = await get<{ connection: { active: boolean } }>(`/v1/admin/tenants/${TENANT}`);
    expect(view.body.connection.active).toBe(false);
    const bad = await post(`/v1/admin/connections/${CONNECTION}/events`, { event: 'explode' });
    expect(bad.status).toBe(400);
  });

  it('shows what the sites did: a bell answered, the first pull, what was applied and what failed, and the sites’ own errors', async () => {
    await loadTwo();
    await post(`/v1/admin/tenants/${TENANT}/ring`, { kind: 'delta' });
    await flushBells();
    const page = await pull(running.baseUrl, 'property');
    const first = page.items[0] as { connection_id: string; remote_id: string; seq: number };
    const second = page.items[1] as { connection_id: string; remote_id: string; seq: number };
    await fetch(`${running.baseUrl}/v1/applied`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${TOKEN}`,
        'content-type': 'application/json',
        'x-core-client': 'wordpress/1.0',
      },
      body: JSON.stringify({
        items: [
          {
            datatype: 'property',
            connection_id: first.connection_id,
            remote_id: first.remote_id,
            seq: first.seq,
            result: 'applied',
          },
          {
            datatype: 'property',
            connection_id: second.connection_id,
            remote_id: second.remote_id,
            seq: second.seq,
            result: 'failed',
            detail: 'no such post type',
          },
        ],
      }),
    });
    await fetch(`${running.baseUrl}/v1/errors`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${TOKEN}`,
        'content-type': 'application/json',
        'x-core-client': 'wordpress/1.0',
      },
      body: JSON.stringify({ message: 'sync failed: http 500', where: 'sync' }),
    });
    const view = await get<{
      sites: { bell_answered_at: string | null; last_pull_at: string | null }[];
      checklist: { first_pull_at: string | null; first_applied_at: string | null };
      outcomes: { datatype: string; applied: number; failed: number }[];
      failures: { remote_id: string; detail: string | null }[];
      errors: { type: string; fields: Record<string, unknown> }[];
      connection: { load: { written: number; event: string } | null };
    }>(`/v1/admin/tenants/${TENANT}`);
    expect(view.body.sites[0]?.bell_answered_at).not.toBeNull();
    expect(view.body.checklist.first_pull_at).not.toBeNull();
    expect(view.body.checklist.first_applied_at).not.toBeNull();
    expect(view.body.outcomes).toEqual([{ datatype: 'property', applied: 1, failed: 1 }]);
    expect(view.body.failures[0]).toMatchObject({
      remote_id: second.remote_id,
      detail: 'no such post type',
    });
    expect(view.body.errors[0]?.type).toBe('site.error');
    expect(view.body.errors[0]?.fields).toMatchObject({
      message: 'sync failed: http 500',
      where: 'sync',
    });
    expect(view.body.connection.load).toMatchObject({ event: 'connection_added', written: 3 });
  });
});

describe('records', () => {
  it('searches with server-side filters, sorts and pages, shows the figures, and one record with its three faces and timeline', async () => {
    await loadTwo();
    crm.put('property', 'OBJ-3', property('OBJ-3', '100', { streetAddress: 'Lilla Nygatan 3' }));
    await fetch(`${running.baseUrl}/v1/hook/fake-webhook/webhook`, {
      method: 'POST',
      body: JSON.stringify({ connection_id: CONNECTION, datatype: 'property', remote_id: 'OBJ-3' }),
    });
    await drainFetchList();

    const all = await get<{
      rows: { remote_id: string; seq: number; display: Record<string, unknown> | null }[];
      total: number;
      sortable: string[];
    }>('/v1/admin/items?datatype=property&sort=remote_id&dir=asc&size=2&page=1');
    expect(all.body.total).toBe(3);
    expect(all.body.rows.map((row) => row.remote_id)).toEqual(['OBJ-1', 'OBJ-2']);
    expect(all.body.sortable).toContain('updated_at');
    const second = await get<{ rows: { remote_id: string }[] }>(
      '/v1/admin/items?datatype=property&sort=remote_id&dir=asc&size=2&page=2',
    );
    expect(second.body.rows.map((row) => row.remote_id)).toEqual(['OBJ-3']);
    const words = await get<{ rows: { remote_id: string }[]; total: number }>(
      '/v1/admin/items?q=lilla%20nyg',
    );
    expect(words.body.rows.map((row) => row.remote_id)).toEqual(['OBJ-3']);
    const office = await get<{ total: number }>('/v1/admin/items?office=100&tenant=1');
    expect(office.body.total).toBe(4);
    const removed = await get<{ total: number }>('/v1/admin/items?removed=yes');
    expect(removed.body.total).toBe(0);
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    expect((await get<{ total: number }>(`/v1/admin/items?from=${tomorrow}`)).body.total).toBe(0);

    const figures = await get<{ live: number; written: number }>('/v1/admin/items/figures');
    expect(figures.body.live).toBe(4);
    expect(figures.body.written).toBe(4);

    const detail = await get<{
      item: { remote_id: string };
      raw: Record<string, unknown>;
      unified: Record<string, unknown>;
      display: Record<string, unknown>;
      timeline: { type: string }[];
    }>(`/v1/admin/items/${CONNECTION}/property/OBJ-3`);
    expect(detail.status).toBe(200);
    expect(detail.body.raw['ref']).toBe('OBJ-3');
    expect(detail.body.unified).not.toHaveProperty('display');
    expect(detail.body.display).toBeDefined();
    expect(detail.body.timeline.map((event) => event.type)).toContain('entity.written');
    expect((await get(`/v1/admin/items/${CONNECTION}/property/NOPE`)).status).toBe(404);
  });

  it('lists the live activity with a state per row, turns a row to applied or failed when a site reports, and shows what waits on the adapter', async () => {
    await loadTwo();
    const page = await pull(running.baseUrl, 'property');
    const first = page.items[0] as { connection_id: string; remote_id: string; seq: number };
    await fetch(`${running.baseUrl}/v1/applied`, {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        items: [
          {
            datatype: 'property',
            connection_id: first.connection_id,
            remote_id: first.remote_id,
            seq: first.seq,
            result: 'applied',
          },
        ],
      }),
    });
    const activity = await get<{
      rows: { remote_id: string; state: string; site: { result: string } | null }[];
      queued: unknown[];
    }>('/v1/admin/items/activity');
    const applied = activity.body.rows.find((row) => row.remote_id === first.remote_id);
    expect(applied?.state).toBe('applied');
    expect(applied?.site?.result).toBe('applied');
    expect(activity.body.rows.filter((row) => row.state === 'written')).toHaveLength(2);

    // What waits on the adapter's own list shows as queued, from the adapter's description.
    crm.put('property', 'OBJ-7', property('OBJ-7'));
    await fetch(`${running.baseUrl}/v1/hook/fake-webhook/webhook`, {
      method: 'POST',
      body: JSON.stringify({ connection_id: CONNECTION, datatype: 'property', remote_id: 'OBJ-7' }),
    });
    expect(queueDepth()).toBe(1);
    const waiting = await get<{
      queued: { remote_id: string; state: string; connection_id: string }[];
    }>('/v1/admin/items/activity');
    expect(waiting.body.queued).toEqual([
      expect.objectContaining({ remote_id: 'OBJ-7', state: 'queued', connection_id: CONNECTION }),
    ]);
  });

  it('fetches again from the CRM: named records go to the adapter as a refetch, a tenant as a resync', async () => {
    await loadTwo();
    crm.put('property', 'OBJ-1', property('OBJ-1', '100', { askingPrice: 4750000 }));
    const before = (await pull(running.baseUrl, 'property')).items.find(
      (item) => item['remote_id'] === 'OBJ-1',
    ) as { seq: number };
    const queued = await post<{
      queued: { connectionId: string; event: string; records?: number }[];
    }>('/v1/admin/refetch', {
      scope: { keys: [{ connectionId: CONNECTION, datatype: 'property', remoteId: 'OBJ-1' }] },
    });
    expect(queued.status).toBe(202);
    expect(queued.body.queued).toEqual([
      { connectionId: CONNECTION, event: 'refetch', records: 1 },
    ]);
    await running.deliver();
    await drainFetchList();
    const after = (await pull(running.baseUrl, 'property')).items.find(
      (item) => item['remote_id'] === 'OBJ-1',
    ) as { seq: number; data: { price?: unknown } };
    expect(after.seq).toBeGreaterThan(before.seq);

    const wide = await post<{ queued: { event: string }[] }>('/v1/admin/refetch', {
      scope: { tenantId: TENANT, datatype: 'property' },
    });
    expect(wide.body.queued).toEqual([{ connectionId: CONNECTION, event: 'resync' }]);
    expect((await post('/v1/admin/refetch', { scope: { tenantId: 99 } })).status).toBe(404);
  });
});

describe('jobs', () => {
  it('previews a recompute as a job with progress and a result, runs it for real with new seqs and a bell, and stops one on request', async () => {
    await loadTwo();
    const preview = await post<{ id: number }>('/v1/admin/jobs', {
      scope: { tenantId: TENANT },
      dryRun: true,
    });
    expect(preview.status).toBe(201);
    let job = await get<{ job: { state: string; progress: Record<string, unknown> } }>(
      `/v1/admin/jobs/${preview.body.id}`,
    );
    expect(job.body.job.state).toBe('queued');
    expect(await runNextJob()).toBe(true);
    job = await get(`/v1/admin/jobs/${preview.body.id}`);
    expect(job.body.job.state).toBe('done');
    const result = (
      job.body.job as unknown as {
        result: {
          total: number;
          examined: number;
          changed: number;
          unchanged: number;
          failed: number;
        };
      }
    ).result;
    expect(result).toMatchObject({ total: 3, examined: 3, failed: 0 });
    expect(result.changed + result.unchanged).toBe(3);
    const before = (await pull(running.baseUrl, 'property')).items.map(
      (item) => item['seq'] as number,
    );

    // The same scope for real: what was unchanged stays, what would change gets a new seq.
    await db().query("update items set rules_version = '0' where datatype = 'property'");
    const bells = running.bells.length;
    const run = await post<{ id: number }>('/v1/admin/jobs', {
      scope: { tenantId: TENANT, datatype: 'property' },
      dryRun: false,
    });
    expect(await runNextJob()).toBe(true);
    const done = await get<{ job: { state: string; result: { changed: number } } }>(
      `/v1/admin/jobs/${run.body.id}`,
    );
    expect(done.body.job.state).toBe('done');
    expect(done.body.job.result.changed).toBe(2);
    const after = (await pull(running.baseUrl, 'property')).items.map(
      (item) => item['seq'] as number,
    );
    expect(Math.min(...after)).toBeGreaterThan(Math.max(...before));
    await flushBells();
    expect(running.bells.length).toBeGreaterThan(bells);

    const list = await get<{ jobs: { id: number; state: string }[] }>('/v1/admin/jobs');
    expect(list.body.jobs.map((j) => j.id)).toEqual([run.body.id, preview.body.id]);

    const queued = await post<{ id: number }>('/v1/admin/jobs', { scope: {}, dryRun: true });
    expect((await post(`/v1/admin/jobs/${queued.body.id}/cancel`)).status).toBe(200);
    const cancelled = await get<{ job: { state: string } }>(`/v1/admin/jobs/${queued.body.id}`);
    expect(cancelled.body.job.state).toBe('cancelled');
    expect((await post(`/v1/admin/jobs/${queued.body.id}/cancel`)).status).toBe(409);
    expect((await post('/v1/admin/jobs', { kind: 'explode', scope: {} })).status).toBe(400);
    expect((await post('/v1/admin/jobs', { scope: { keys: [] } })).status).toBe(400);
  });
});

describe('the dashboard, events, settings and search', () => {
  it('answers the dashboard with figures, two hourly charts, health with the adapter’s checks, and the latest events', async () => {
    await heartbeat();
    await loadTwo();
    const dashboard = await get<{
      hours: number;
      figures: { live: number; written: number };
      charts: {
        records: { hours: string[]; series: Record<string, number[]> };
        sites: { hours: string[] };
      };
      health: { checks: Record<string, unknown> };
      perDatatype: { datatype: string; live: number }[];
      events: unknown[];
    }>('/v1/admin/dashboard');
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.hours).toBe(24);
    expect(dashboard.body.charts.records.hours).toHaveLength(24);
    expect(dashboard.body.charts.records.series['entity.written']?.reduce((a, b) => a + b, 0)).toBe(
      3,
    );
    expect(dashboard.body.figures).toMatchObject({ live: 3, written: 3 });
    expect(Object.keys(dashboard.body.health.checks)).toContain('fake-webhook.webhook_lag');
    expect(dashboard.body.perDatatype.find((row) => row.datatype === 'property')?.live).toBe(2);
    expect(dashboard.body.events.length).toBeGreaterThan(0);
    expect((await get('/v1/admin/health')).status).toBe(200);
  });

  it('pages the event log, follows a correlation id, leaves a bad filter value out and says so, and carries the audit trail', async () => {
    await loadTwo();
    const page = await get<{
      events: { id: string; correlation_id: string | null; type: string }[];
      next: number | null;
      problems: string[];
    }>('/v1/admin/events?order=desc&limit=3');
    expect(page.body.events).toHaveLength(3);
    expect(page.body.next).toBe(Number(page.body.events[2]?.id));
    const older = await get<{ events: { id: string }[] }>(
      `/v1/admin/events?before=${page.body.next}&limit=3`,
    );
    expect(Number(older.body.events[0]?.id)).toBeLessThan(Number(page.body.events[2]?.id));
    const written =
      page.body.events.find((event) => event.type === 'entity.written') ??
      (
        await get<{ events: { correlation_id: string | null }[] }>(
          '/v1/admin/events?type=entity.written',
        )
      ).body.events[0];
    const chain = await get<{ events: { type: string }[] }>(
      `/v1/admin/events?correlation=${written?.correlation_id}`,
    );
    expect(chain.body.events.length).toBeGreaterThan(0);
    const bad = await get<{ problems: string[]; events: unknown[] }>(
      '/v1/admin/events?from=yesterday&limit=x',
    );
    expect(bad.status).toBe(200);
    expect(bad.body.problems).toEqual([
      'from: "yesterday" is not a date, ignored',
      'limit: "x" is not a whole number above zero, ignored',
    ]);
    expect(bad.body.events.length).toBeGreaterThan(0);
    const audit = await get<{ events: { fields: Record<string, unknown> }[] }>(
      '/v1/admin/events?type=admin.action',
    );
    expect(audit.body.events[0]?.fields).toMatchObject({
      actor: ADMIN_EMAIL,
      action: 'connection.connection_added',
    });
  });

  it('shows the settings as they run, runs housekeeping, lists the providers with their panels, and finds tenants and records', async () => {
    await loadTwo();
    const settings = await get<{
      settings: { key: string; value: unknown }[];
      providers: { provider: string; credentials: unknown[] }[];
      startOver: { id: number }[];
    }>('/v1/admin/settings');
    expect(settings.body.settings.map((row) => row.key)).toEqual(
      expect.arrayContaining(['Version', 'Environment', 'Rules version', 'Alerts by mail']),
    );
    expect(settings.body.providers).toEqual([expect.objectContaining({ provider: PROVIDER })]);
    expect(settings.body.startOver[0]?.id).toBe(TENANT);
    const done = await post<{ events: number; tombstones: number }>('/v1/admin/housekeeping');
    expect(done.body).toEqual({ events: 0, tombstones: 0 });

    const provider = await get<{
      directions: { steps: unknown[] };
      sections: { title: string; actions?: { id: string }[] }[];
    }>(`/v1/admin/providers/${PROVIDER}`);
    expect(provider.body.directions.steps.length).toBeGreaterThan(0);
    expect(provider.body.sections[0]?.title).toBe('Fetch list');
    const acted = await post<{ message: string }>(`/v1/admin/providers/${PROVIDER}/actions`, {
      action: 'drain',
      params: {},
    });
    expect(acted.body.message).toContain('fetched');
    expect(
      (await post(`/v1/admin/providers/${PROVIDER}/actions`, { action: 'explode' })).status,
    ).toBe(500);
    expect(
      (await post(`/v1/admin/providers/${PROVIDER}/probe`, { credentials: {}, offices: [] }))
        .status,
    ).toBe(404);

    const found = await get<{ tenants: { id: number }[]; records: { remote_id: string }[] }>(
      '/v1/admin/search?q=OBJ-1',
    );
    expect(found.body.records.map((row) => row.remote_id)).toEqual(['OBJ-1']);
    const tenants = await get<{ tenants: { id: number }[] }>('/v1/admin/search?q=test');
    expect(tenants.body.tenants.map((row) => row.id)).toEqual([TENANT]);
  });

  it('pulls as a site from the panel with the sizes, and rings from it', async () => {
    await loadTwo();
    const pulled = await post<{
      items: unknown[];
      bytes: number;
      gzipBytes: number;
      has_more: boolean;
    }>('/v1/admin/try/changes', { tenantId: TENANT, datatype: 'property', after: 0, limit: 10 });
    expect(pulled.status).toBe(200);
    expect(pulled.body.items).toHaveLength(2);
    expect(pulled.body.gzipBytes).toBeLessThan(pulled.body.bytes);
    expect((await post('/v1/admin/try/bell', { tenantId: TENANT, kind: 'delta' })).status).toBe(
      202,
    );
    await flushBells();
    expect(running.bells.length).toBeGreaterThan(0);
  });
});

describe('the live feed and the alerts', () => {
  it('streams new events and jobs to an open page', async () => {
    const controller = new AbortController();
    const response = await fetch(`${running.baseUrl}/v1/admin/stream`, {
      headers: { cookie: headers['cookie'] ?? '' },
      signal: controller.signal,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('no body');
    const decoder = new TextDecoder();
    let text = '';
    const readUntil = async (needle: string): Promise<void> => {
      const deadline = Date.now() + 8_000;
      while (!text.includes(needle) && Date.now() < deadline) {
        const { value, done } = await reader.read();
        if (done) break;
        text += decoder.decode(value);
      }
    };
    try {
      await readUntil('event: hello');
      await loadTwo();
      await readUntil('entity.written');
      expect(text).toContain('event: events');
      expect(text).toContain('entity.written');
      await post('/v1/admin/jobs', { scope: {}, dryRun: true });
      await readUntil('"state":"queued"');
      expect(text).toContain('event: jobs');
      expect(text).toContain('"state":"queued"');
    } finally {
      controller.abort();
    }
  });

  it('tells a change of a health check once, by mail and to Slack, and its recovery once', async () => {
    const posted: string[] = [];
    const slack: Server = await new Promise((resolve) => {
      const server = createServer((request, response) => {
        let body = '';
        request.on('data', (chunk: Buffer) => {
          body += chunk.toString();
        });
        request.on('end', () => {
          posted.push(body);
          response.writeHead(200);
          response.end();
        });
      });
      server.listen(0, '127.0.0.1', () => resolve(server));
    });
    const config = {
      environment: 'test',
      publicUrl: 'https://core.example.test',
      email: 'ops@example.test',
      slackWebhookUrl: `http://127.0.0.1:${(slack.address() as AddressInfo).port}/hook`,
    };
    try {
      // The worker has not reported in: one alert, and no second one for the same state.
      const mails = running.mails.length;
      const first = await checkAlerts(config);
      expect(first.map((change) => [change.name, change.ok])).toContainEqual(['worker', false]);
      expect(running.mails.length).toBe(mails + 1);
      expect(running.mails.at(-1)?.text).toContain('RED worker');
      expect(running.mails.at(-1)?.text).toContain('https://core.example.test/admin');
      expect(posted).toHaveLength(1);
      expect(await checkAlerts(config)).toEqual([]);
      expect(running.mails.length).toBe(mails + 1);
      // The worker is back: told once.
      await heartbeat();
      const recovered = await checkAlerts(config);
      expect(recovered).toEqual([{ name: 'worker', ok: true, detail: null }]);
      expect(running.mails.at(-1)?.text).toContain('OK  worker');
      expect(posted).toHaveLength(2);
      const logged = await get<{ events: { fields: Record<string, unknown> }[] }>(
        '/v1/admin/events?type=alert.sent',
      );
      expect(logged.body.events).toHaveLength(2);
      expect(logged.body.events[0]?.fields['outcomes']).toEqual({ email: 'sent', slack: 'sent' });
    } finally {
      await new Promise<void>((resolve) => slack.close(() => resolve()));
    }
  });
});
