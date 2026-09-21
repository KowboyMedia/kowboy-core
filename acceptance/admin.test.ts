// AC 42: every page of the admin area works through HTTP, and an adapter brings its own. The app
// makes exactly these calls and no others, so what passes here is what a person can do
// (docs/admin-panel-design.md §3). The browser journeys in `admin/e2e` walk the same ground with a
// real browser; this suite proves the API underneath them.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { harness, until, type Harness } from './harness.js';
import { fakeWebhookAdapter } from '../adapters/fake-webhook/index.js';
import * as crm from '../adapters/fake-webhook/crm.js';
import { db } from '../engine/storage/db.js';
import { queryEvents } from '../engine/events.js';
import { inMaintenance } from '../engine/storage/settings.js';
import { flushBells } from '../engine/bells.js';
import { runNextJob } from '../engine/jobs.js';
import { PAGE_NAMES, pagesNamedIn } from '../engine/admin/pages.js';
import { adapters as shipped } from '../main.js';
import { fakePollingAdapter } from '../adapters/fake-polling/index.js';

const EMAIL = 'tester@kowboy.se';

const property = (ref: string, officeRef = '100'): Record<string, unknown> => ({
  ref,
  state: 'FOR_SALE',
  streetAddress: 'Storgatan 12',
  askingPrice: 4950000,
  officeRef,
  areaRefs: [],
  brokerRefs: [],
  associationRef: null,
  updatedUtc: '2026-09-08T10:02:00Z',
  internalCode: 1,
});

let running: Harness;
/** The session cookie, as a browser would keep it. */
let cookie = '';

type Answer<T> = { status: number; body: T };

async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; redirect?: 'manual' } = {},
): Promise<Answer<T> & { headers: Headers }> {
  const response = await fetch(`${running.baseUrl}/v1/admin${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(cookie === '' ? {} : { cookie }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    redirect: 'manual',
  });
  const text = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    body: (text === '' ? {} : JSON.parse(text)) as T,
  };
}

/** The sign-in link out of the mail Core sent, as a person would read it. */
const linkFrom = (text: string): string | null =>
  /\/v1\/admin\/sign-in\/[A-Za-z0-9_-]+/.exec(text)?.[0] ?? null;

/** Sign in the way a person does: ask for a link, open the one that arrives, keep the cookie. */
async function signIn(email = EMAIL): Promise<void> {
  cookie = '';
  const before = running.mails.length;
  const asked = await api<{ sent: boolean }>('/sign-in', { method: 'POST', body: { email } });
  expect(asked.body.sent).toBe(true);
  const mail = running.mails[before];
  const path = mail ? linkFrom(mail.text) : null;
  if (!path) throw new Error('no sign-in link was mailed');
  const opened = await fetch(`${running.baseUrl}${path}`, { redirect: 'manual' });
  expect(opened.status).toBe(303);
  cookie = (opened.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
  expect(cookie).not.toBe('');
}

/** The whole tenant page, saved in one call, as the app sends it. */
const tenantBody = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  displayName: 'Acme Mäklare',
  active: true,
  connections: [
    {
      id: 'acme-crm',
      provider: 'fake-webhook',
      credentials: { key: 'a-key' },
      licensedOffices: ['100'],
      active: true,
    },
  ],
  sites: [{ label: 'acme.se', bellUrl: `${running.baseUrl}/v1/ready`, active: true }],
  ...over,
});

beforeEach(async () => {
  crm.reset();
  running = await harness({ adapters: [fakeWebhookAdapter], subscriber: false });
  await signIn();
});

afterEach(async () => {
  await running.stop();
});

describe('the admin area', () => {
  it('lets nobody in without a session, and nobody who is not on the list (AC 42)', async () => {
    cookie = '';
    expect((await api('/overview')).status).toBe(401);
    expect((await api('/tenants')).status).toBe(401);

    // An address that may not open the area gets the same answer as one that may, and no mail:
    // the panel never tells a stranger who works here.
    const before = running.mails.length;
    const stranger = await api<{ sent: boolean; detail: string }>('/sign-in', {
      method: 'POST',
      body: { email: 'someone@example.com' },
    });
    expect(stranger.body.sent).toBe(true);
    expect(running.mails).toHaveLength(before);

    // A colleague whose address is nowhere on the list by name, but whose whole domain is allowed,
    // is let in — and the answer is word for word the stranger's, so the page never gives away
    // that a domain is allowed at all (Patric, 2026-09-21).
    const colleague = await api<{ sent: boolean; detail: string }>('/sign-in', {
      method: 'POST',
      body: { email: 'colleague@kowboy.se' },
    });
    expect(colleague.body.detail).toBe(stranger.body.detail);
    expect(running.mails).toHaveLength(before + 1);

    await signIn();
    expect((await api('/overview')).status).toBe(200);
  });

  it('spends a sign-in link once (U6, AC 42)', async () => {
    const before = running.mails.length;
    await api('/sign-in', { method: 'POST', body: { email: EMAIL } });
    const path = linkFrom(running.mails[before]?.text ?? '');
    if (!path) throw new Error('no sign-in link was mailed');
    expect((await fetch(`${running.baseUrl}${path}`, { redirect: 'manual' })).status).toBe(303);
    // The second opening of the same link signs nobody in; it sends them back to ask again.
    const again = await fetch(`${running.baseUrl}${path}`, { redirect: 'manual' });
    expect(again.status).toBe(303);
    expect(again.headers.get('location')).toContain('again=1');
    expect(again.headers.get('set-cookie')).toBeNull();
  });

  it('remembers a device for thirty days, on as many as a person likes (Patric, 2026-09-21)', async () => {
    /** The days a cookie is kept for, out of what the browser was told. */
    const days = (header: string): number =>
      Math.round(Number(/Max-Age=(\d+)/.exec(header)?.[1] ?? 0) / 86_400);

    /** One browser signing in: ask for a link, open it, keep what it was given. */
    const device = async (remember: boolean): Promise<{ cookie: string; days: number }> => {
      const before = running.mails.length;
      await api('/sign-in', { method: 'POST', body: { email: EMAIL, remember } });
      const path = linkFrom(running.mails[before]?.text ?? '');
      if (!path) throw new Error('no sign-in link was mailed');
      const opened = await fetch(`${running.baseUrl}${path}`, { redirect: 'manual' });
      const header = opened.headers.get('set-cookie') ?? '';
      return { cookie: header.split(';')[0] ?? '', days: days(header) };
    };

    // The session beforeEach made is a device of its own; these are two more.
    const already = (await api<{ total: number }>('/devices')).body.total;
    const remembered = await device(true);
    const ordinary = await device(false);
    expect(remembered.days).toBe(30);
    expect(ordinary.days).toBe(14);

    // Both are signed in at once: remembering one device never signs another one out.
    cookie = remembered.cookie;
    const listed = await api<{
      data: { remembered: boolean; current: boolean }[];
      total: number;
    }>('/devices');
    expect(listed.body.total).toBe(already + 2);
    expect(listed.body.data.filter((row) => row.current)).toHaveLength(1);
    expect(listed.body.data.filter((row) => row.remembered)).toHaveLength(1);

    // A laptop goes missing: every other device is forgotten from here, and this one carries on.
    const forgot = await api<{ data: { forgotten: number } }>('/devices/forget-others', {
      method: 'POST',
    });
    expect(forgot.body.data.forgotten).toBe(already + 1);
    expect((await api('/overview')).status).toBe(200);
    cookie = ordinary.cookie;
    expect((await api('/overview')).status).toBe(401);
  });

  it('onboards a customer in one save, and says what it did (U1, AC 42)', async () => {
    const made = await api<{
      data: { id: number; changes: string[]; token: string; sites: { bellSecret: string }[] };
    }>('/tenants', { method: 'POST', body: tenantBody() });
    expect(made.status).toBe(200);
    const tenant = made.body.data;
    expect(tenant.changes.join(' ')).toContain('added the connection acme-crm');
    // The token and the bell secret are on the page at once, ready to paste into the site.
    expect(tenant.token).toMatch(/.{20,}/);
    expect(tenant.sites[0]?.bellSecret).toMatch(/.{20,}/);

    // One save queued the connection's first load; the worker's tick delivers it.
    crm.put('office', '100', { ref: '100', title: 'Lidingö', updatedUtc: '2026-08-30T09:00:00Z' });
    crm.put('property', 'OBJ-1', property('OBJ-1'));
    await running.deliver();
    await until(
      async () => (await api<{ total: number }>('/records?datatype=property')).body.total === 1,
      'the first load to reach the records',
    );

    const page = await api<{ data: { connections: { loaded: { live: number }[] }[] } }>(
      `/tenants/${String(tenant.id)}`,
    );
    expect(page.body.data.connections[0]?.loaded.length).toBeGreaterThan(0);
  });

  it('refuses a tenant page that is not filled in, at the field (AC 42)', async () => {
    const noName = await api<{ error: string }>('/tenants', {
      method: 'POST',
      body: tenantBody({ displayName: '' }),
    });
    expect(noName.status).toBe(400);
    expect(noName.body.error).toContain('name');

    const badBell = await api<{ error: string }>('/tenants', {
      method: 'POST',
      body: tenantBody({ sites: [{ label: 'acme.se', bellUrl: 'acme.se/bell', active: true }] }),
    });
    expect(badBell.status).toBe(400);
    expect(badBell.body.error).toContain('http');
  });

  it('holds one tenant with two CRM connections (U1, a Must of 2026-09-20)', async () => {
    const made = await api<{ data: { id: number } }>('/tenants', {
      method: 'POST',
      body: tenantBody({
        connections: [
          {
            id: 'acme-one',
            provider: 'fake-webhook',
            credentials: { key: 'one' },
            licensedOffices: ['100'],
            active: true,
          },
          {
            id: 'acme-two',
            provider: 'fake-webhook',
            credentials: { key: 'two' },
            licensedOffices: ['200'],
            active: true,
          },
        ],
      }),
    });
    const read = await api<{ data: { connections: { id: string }[] } }>(
      `/tenants/${String(made.body.data.id)}`,
    );
    expect(read.body.data.connections.map((connection) => connection.id).sort()).toEqual([
      'acme-one',
      'acme-two',
    ]);
  });

  it('keeps the stored login when the save carries no new one (AC 42)', async () => {
    const made = await api<{ data: { id: number } }>('/tenants', {
      method: 'POST',
      body: tenantBody(),
    });
    const id = made.body.data.id;
    await api(`/tenants/${String(id)}`, {
      method: 'PATCH',
      body: tenantBody({
        displayName: 'Acme Mäklare AB',
        connections: [
          {
            id: 'acme-crm',
            provider: 'fake-webhook',
            credentials: {},
            licensedOffices: ['100'],
            active: true,
          },
        ],
      }),
    });
    const read = await api<{
      data: { displayName: string; connections: { hasCredentials: boolean }[] };
    }>(`/tenants/${String(id)}`);
    expect(read.body.data.displayName).toBe('Acme Mäklare AB');
    expect(read.body.data.connections[0]?.hasCredentials).toBe(true);
  });

  it('searches, sorts and pages the records, and shows one whole (U3, AC 42)', async () => {
    await api('/tenants', { method: 'POST', body: tenantBody() });
    crm.put('office', '100', { ref: '100', title: 'Lidingö', updatedUtc: '2026-08-30T09:00:00Z' });
    for (const ref of ['OBJ-1', 'OBJ-2', 'OBJ-3']) crm.put('property', ref, property(ref));
    await running.deliver();
    await until(
      async () => (await api<{ total: number }>('/records?datatype=property')).body.total === 3,
      'three properties to load',
    );

    const sorted = await api<{ data: { remoteId: string }[] }>(
      '/records?datatype=property&sort=remote_id&dir=asc',
    );
    expect(sorted.body.data.map((row) => row.remoteId)).toEqual(['OBJ-1', 'OBJ-2', 'OBJ-3']);

    // Scoped to the properties, so the office loading a moment later cannot change the pages.
    const first = await api<{ data: { remoteId: string }[] }>(
      '/records?datatype=property&size=2&page=1&sort=remote_id&dir=asc',
    );
    expect(first.body.data.map((row) => row.remoteId)).toEqual(['OBJ-1', 'OBJ-2']);
    const second = await api<{ data: { remoteId: string }[] }>(
      '/records?datatype=property&size=2&page=2&sort=remote_id&dir=asc',
    );
    expect(second.body.data.map((row) => row.remoteId)).toEqual(['OBJ-3']);

    // The words of the record itself, through the full-text index.
    const words = await api<{ total: number }>('/records?q=storgatan');
    expect(words.body.total).toBe(3);

    const one = await api<{
      data: {
        raw: unknown;
        data: Record<string, unknown>;
        display: unknown;
        timeline: Record<string, unknown>[];
      };
    }>('/records/acme-crm/property/OBJ-1');
    expect(one.status).toBe(200);
    expect(one.body.data.raw).toMatchObject({ ref: 'OBJ-1' });
    expect(one.body.data.data?.['id']).toBe('OBJ-1');
    expect(one.body.data.display).not.toBeNull();

    // Its timeline says what happened in words and carries no payload at all, so a person reads it
    // at a glance and the page stays the same size however long the history is (Patric,
    // 2026-09-21). The record's own faces are above it; the history never repeats them.
    expect(one.body.data.timeline.length).toBeGreaterThan(0);
    for (const event of one.body.data.timeline) {
      expect(Object.keys(event).sort()).toEqual(['at', 'correlationId', 'id', 'said', 'type']);
      expect(event['said']).not.toBe('');
    }
    expect(JSON.stringify(one.body.data.timeline)).not.toContain('Storgatan');
  });

  it('previews a recompute and runs one as a job with progress (U4, AC 42)', async () => {
    await api('/tenants', { method: 'POST', body: tenantBody() });
    crm.put('office', '100', { ref: '100', title: 'Lidingö', updatedUtc: '2026-08-30T09:00:00Z' });
    crm.put('property', 'OBJ-1', property('OBJ-1'));
    await running.deliver();
    // The office lands first, so waiting for "a record" is not waiting for this record.
    await until(
      async () => (await api<{ total: number }>('/records?datatype=property')).body.total === 1,
      'the property to load',
    );

    const before = (await api<{ total: number }>('/records')).body.total;
    const preview = await api<{
      data: { scope: string; report: { examined: number; changed: number } };
    }>('/runs/preview', { method: 'POST', body: { datatype: 'property' } });
    expect(preview.body.data.scope).toContain('property');
    expect(preview.body.data.report.examined).toBe(1);
    // A preview writes nothing: the records are exactly as they were (AC 36).
    expect((await api<{ total: number }>('/records')).body.total).toBe(before);

    const queued = await api<{ data: { job: number } }>('/runs/recompute', {
      method: 'POST',
      body: { datatype: 'property' },
    });
    expect(queued.body.data.job).toBeGreaterThan(0);
    const list = await api<{ data: { id: string; state: string }[] }>('/jobs');
    expect(list.body.data[0]?.state).toBe('queued');

    await runNextJob();
    const done = await api<{ data: { state: string; result: { examined: number } } }>(
      `/jobs/${String(queued.body.data.job)}`,
    );
    expect(done.body.data.state).toBe('done');
    expect(done.body.data.result.examined).toBe(1);
  });

  it('fetches named records again through the adapter (U3, question 57)', async () => {
    await api('/tenants', { method: 'POST', body: tenantBody() });
    crm.put('office', '100', { ref: '100', title: 'Lidingö', updatedUtc: '2026-08-30T09:00:00Z' });
    crm.put('property', 'OBJ-1', property('OBJ-1'));
    await running.deliver();
    // The office lands first, so waiting for "a record" is not waiting for this record.
    await until(
      async () => (await api<{ total: number }>('/records?datatype=property')).body.total === 1,
      'the property to load',
    );

    const again = await api<{ data: { queued: number; detail: string } }>('/runs/fetch-again', {
      method: 'POST',
      body: { records: [{ connectionId: 'acme-crm', datatype: 'property', remoteId: 'OBJ-1' }] },
    });
    expect(again.body.data.queued).toBe(1);
    await running.deliver();
    const events = await queryEvents({ type: 'lifecycle.refetch', limit: 10 });
    expect(events).toHaveLength(1);

    // "Select all" on Records sends the search itself, never the rows the browser happened to have
    // loaded: the engine resolves it to the same records, so a hundred thousand matches cost one
    // call and one page of fifty costs no less (Patric, 2026-09-21).
    const bySearch = await api<{ data: { queued: number } }>('/runs/fetch-again', {
      method: 'POST',
      body: { text: 'storgatan', datatype: 'property' },
    });
    expect(bySearch.body.data.queued).toBe(1);
    await running.deliver();
    expect(await queryEvents({ type: 'lifecycle.refetch', limit: 10 })).toHaveLength(2);

    // The same search as a recompute scope, in the words the confirmation shows.
    const preview = await api<{ data: { scope: string; report: { examined: number } } }>(
      '/runs/preview',
      { method: 'POST', body: { text: 'storgatan' } },
    );
    expect(preview.body.data.scope).toContain('storgatan');
    expect(preview.body.data.report.examined).toBe(1);
  });

  it('offers the pickers a scope is chosen from (Patric, 2026-09-21)', async () => {
    // Tenant, then that tenant's CRM connections, then that connection's offices: Records and
    // Manual sync both read this, so neither page asks a person to type a number they must know.
    await api('/tenants', { method: 'POST', body: tenantBody() });
    const scope = await api<{
      data: {
        tenants: {
          id: number;
          name: string;
          connections: { id: string; provider: string; offices: string[] }[];
        }[];
        datatypes: string[];
      };
    }>('/scope');
    expect(scope.status).toBe(200);
    const tenant = scope.body.data.tenants.find((row) => row.name === 'Acme Mäklare');
    expect(tenant).toBeDefined();
    expect(tenant?.connections).toHaveLength(1);
    expect(tenant?.connections[0]?.id).toBe('acme-crm');
    expect(tenant?.connections[0]?.provider).toBe('fake-webhook');
    expect(tenant?.connections[0]?.offices).toEqual(['100']);
  });

  it('rings a tenant’s sites and one site alone (U8, AC 42)', async () => {
    const made = await api<{ data: { id: number; sites: { id: number }[] } }>('/tenants', {
      method: 'POST',
      body: tenantBody(),
    });
    const tenant = made.body.data;
    expect((await api(`/tenants/${String(tenant.id)}/ring`, { method: 'POST' })).status).toBe(200);
    await flushBells();
    expect(
      (await api(`/sites/${String(tenant.sites[0]?.id ?? 0)}/ring`, { method: 'POST' })).status,
    ).toBe(200);
    await until(
      async () => (await queryEvents({ type: 'bell', limit: 10 })).length > 0,
      'a bell to be recorded',
    );
  });

  it('rotates a token and a bell secret, each to a new value (U6, AC 42)', async () => {
    const made = await api<{
      data: { id: number; token: string; sites: { id: number; bellSecret: string }[] };
    }>('/tenants', { method: 'POST', body: tenantBody() });
    const before = made.body.data;
    const token = await api<{ data: { token: string } }>(`/tenants/${String(before.id)}/token`, {
      method: 'POST',
    });
    expect(token.body.data.token).not.toBe(before.token);

    const secret = await api<{ data: { bellSecret: string } }>(
      `/sites/${String(before.sites[0]?.id ?? 0)}/secret`,
      { method: 'POST' },
    );
    expect(secret.body.data.bellSecret).not.toBe(before.sites[0]?.bellSecret);
  });

  it('removes a site with its history, and a tenant with everything (AC 42)', async () => {
    const made = await api<{ data: { id: number; sites: { id: number }[] } }>('/tenants', {
      method: 'POST',
      body: tenantBody(),
    });
    const tenant = made.body.data;
    const siteId = tenant.sites[0]?.id ?? 0;
    await api(`/tenants/${String(tenant.id)}/ring`, { method: 'POST' });
    await flushBells();

    await api(`/tenants/${String(tenant.id)}`, {
      method: 'PATCH',
      body: tenantBody({ sites: [] }),
    });
    expect(await queryEvents({ subscriberId: siteId, limit: 10 })).toHaveLength(0);

    expect((await api(`/tenants/${String(tenant.id)}`, { method: 'DELETE' })).status).toBe(200);
    expect((await api(`/tenants/${String(tenant.id)}`)).status).toBe(404);
    expect((await api<{ total: number }>('/records')).body.total).toBe(0);
  });

  it('shows the day, the verdict and the sites on one call (U2, U5, AC 42)', async () => {
    await api('/tenants', { method: 'POST', body: tenantBody() });
    const overview = await api<{
      data: {
        health: { ok: boolean; checks: Record<string, unknown> };
        day: { hours: unknown[]; totals: Record<string, number> };
        sites: unknown[];
        tenants: { total: number };
      };
    }>('/overview');
    expect(overview.status).toBe(200);
    expect(overview.body.data.day.hours).toHaveLength(24);
    expect(Object.keys(overview.body.data.health.checks)).toContain('database');
    // The harness makes a tenant of its own before this one, and only this one has a site.
    expect(overview.body.data.sites).toHaveLength(1);
    expect(overview.body.data.tenants.total).toBe(2);
  });

  it('lists what is in flight, coloured by state (U5, Patric’s rule 3)', async () => {
    await api('/tenants', { method: 'POST', body: tenantBody() });
    crm.put('office', '100', { ref: '100', title: 'Lidingö', updatedUtc: '2026-08-30T09:00:00Z' });
    crm.put('property', 'OBJ-1', property('OBJ-1'));
    await running.deliver();
    // The office lands first, so waiting for "a record" is not waiting for this record.
    await until(
      async () => (await api<{ total: number }>('/records?datatype=property')).body.total === 1,
      'the property to load',
    );

    const flow = await api<{
      data: { state: string; remoteId: string; queuedAt: string; what: string }[];
    }>('/flow');
    expect(flow.status).toBe(200);
    const row = flow.body.data.find((one) => one.remoteId === 'OBJ-1');
    expect(row?.state).toBe('fetched');
    expect(row?.what).not.toBe('');
  });

  it('reads the event log by every filter, and follows a chain (U3, U6, AC 42)', async () => {
    const made = await api<{ data: { id: number } }>('/tenants', {
      method: 'POST',
      body: tenantBody(),
    });
    const all = await api<{ data: { id: number; type: string; correlationId: string | null }[] }>(
      '/events',
    );
    expect(all.body.data.length).toBeGreaterThan(0);

    // A panel save is an event with the person on it: "who did what" is a filter, not a page.
    const saves = await api<{ data: { fields: { by: string } }[] }>(
      '/events?type=admin.tenant_saved',
    );
    expect(saves.body.data[0]?.fields.by).toBe(EMAIL);

    const byTenant = await api<{ data: unknown[] }>(`/events?tenant=${String(made.body.data.id)}`);
    expect(byTenant.body.data.length).toBeGreaterThan(0);
    // A bad date or number is a refusal in words, never a database error (found on staging).
    const slip = await api<{ error: string }>('/events?from=not-a-date');
    expect(slip.status).toBe(400);
    expect(slip.body.error).toContain('not a date');
    expect((await api('/records?tenant=abc')).status).toBe(400);
  });

  it('brings an adapter’s own page, its directions and its actions (U7, question 61)', async () => {
    crm.put('office', '100', { ref: '100', title: 'Lidingö', updatedUtc: '2026-08-30T09:00:00Z' });
    const list = await api<{ data: { provider: string; credentials: unknown[] }[] }>('/crms');
    const fake = list.body.data.find((crm_) => crm_.provider === 'fake-webhook');
    expect(fake).toBeDefined();
    expect(fake?.credentials.length).toBeGreaterThan(0);

    const page = await api<{
      data: { directions: { steps: unknown[] }; sections: { title: string }[] };
    }>('/crms/fake-webhook');
    expect(page.status).toBe(200);
    expect(page.body.data.directions.steps.length).toBeGreaterThan(0);
    expect(page.body.data.sections.length).toBeGreaterThan(0);

    const acted = await api<{ data: { message: string } }>('/crms/fake-webhook/act', {
      method: 'POST',
      body: { action: 'drain', params: {} },
    });
    expect(acted.status).toBe(200);
    expect(acted.body.data.message).not.toBe('');

    const probed = await api<{ data: { ok: boolean; detail: string } }>(
      '/crms/fake-webhook/probe',
      {
        method: 'POST',
        body: { credentials: { key: 'a-key' }, officeIds: ['100'] },
      },
    );
    expect(probed.body.data.ok).toBe(true);

    // On a saved connection the page has no password to send — a stored secret never reaches the
    // browser — so the check tries the login Core already holds (Patric, 2026-09-21: the check did
    // not work there), with the offices that connection is licensed for.
    await api('/tenants', { method: 'POST', body: tenantBody() });
    const stored = await api<{ data: { ok: boolean; detail: string } }>(
      '/crms/fake-webhook/probe',
      {
        method: 'POST',
        body: { credentials: {}, officeIds: [], connectionId: 'acme-crm' },
      },
    );
    expect(stored.body.data.ok).toBe(true);

    // Nothing typed and nothing saved is a question, not a red cross.
    const neither = await api<{ data: { ok: boolean; detail: string } }>(
      '/crms/fake-webhook/probe',
      {
        method: 'POST',
        body: { credentials: {}, officeIds: [] },
      },
    );
    expect(neither.body.data.ok).toBe(false);
    expect(neither.body.data.detail).toContain('save the connection');

    expect((await api('/crms/nothing-here')).status).toBe(404);
  });

  it('names only pages that exist in every adapter’s setup directions (AGENTS.md, done 5)', () => {
    // A direction tells a cold reader where to go; a page it names and the area does not have
    // sends that reader nowhere. Every adapter Core ships is checked, and the fakes with them,
    // so a new CRM is covered the day it is added to the entrypoint.
    const all = [...shipped, fakeWebhookAdapter, fakePollingAdapter].filter((one) => one.admin);
    expect(all.length).toBeGreaterThan(1);
    for (const adapter of all) {
      const provider = adapter.manifest.provider;
      const text = (adapter.admin?.directions().steps ?? [])
        .map((step) => `${step.title} ${step.text}`)
        .join('\n');
      const named = pagesNamedIn(text);
      expect(named.length, `${provider} names no page`).toBeGreaterThan(0);
      for (const page of named) {
        expect(PAGE_NAMES, `${provider} sends a reader to ${page}`).toContain(page);
      }
    }
  });

  it('explains every button an adapter puts on a page (Patric, 2026-09-21)', async () => {
    // A button nobody can explain is a button nobody should press. Every action an adapter
    // declares, on a page, under a connection or on a row, carries one sentence saying what it
    // does and when to press it.
    const all = [...shipped, fakeWebhookAdapter].filter((one) => one.admin);
    const connections = [
      {
        id: 'explained',
        tenantId: 1,
        provider: '',
        credentials: null,
        licensedOffices: ['100'],
        active: true,
      },
    ];
    let checked = 0;
    for (const adapter of all) {
      const provider = adapter.manifest.provider;
      const sections = [
        ...((await adapter.admin?.panel(connections.map((c) => ({ ...c, provider })))) ?? []),
        ...((await adapter.admin?.connection?.({ ...connections[0], provider } as never)) ?? []),
      ];
      const actions = sections.flatMap((section) => [
        ...(section.actions ?? []),
        ...(section.table?.rows ?? []).flatMap((row) => row.actions ?? []),
      ]);
      for (const action of actions) {
        checked += 1;
        expect(action.help ?? '', `${provider}: the button "${action.label}"`).not.toBe('');
        expect((action.help ?? '').length, `${provider}: "${action.label}"`).toBeGreaterThan(30);
      }
    }
    expect(checked).toBeGreaterThan(2);
  });

  it('shows the configuration without any value, and the migrations (U6, AC 42)', async () => {
    const settings = await api<{
      data: { set: { key: string; set: boolean }[]; migrations: string[]; people: string[] };
    }>('/settings');
    expect(settings.status).toBe(200);
    expect(settings.body.data.migrations).toContain('001_init.sql');
    expect(settings.body.data.people).toEqual([EMAIL]);
    // Whether it is set, never what it is.
    const asText = JSON.stringify(settings.body.data);
    expect(asText).not.toContain(process.env['CREDENTIALS_KEY'] ?? 'unset');
  });

  it('holds the bells and the jobs while maintenance is on (U6, AC 42)', async () => {
    const made = await api<{ data: { id: number } }>('/tenants', {
      method: 'POST',
      body: tenantBody(),
    });
    await api('/settings/maintenance', { method: 'POST', body: { on: true } });
    expect(await inMaintenance()).toBe(true);

    await api(`/tenants/${String(made.body.data.id)}/ring`, { method: 'POST' });
    await flushBells();
    expect(await queryEvents({ type: 'bell', limit: 10 })).toHaveLength(0);

    await api('/runs/recompute', { method: 'POST', body: {} });
    expect(await runNextJob()).toBe(false);

    await api('/settings/maintenance', { method: 'POST', body: { on: false } });
    await flushBells();
    await until(
      async () => (await queryEvents({ type: 'bell', limit: 10 })).length > 0,
      'the held bell to go out once maintenance is off',
    );
    expect(await runNextJob()).toBe(true);
  });

  it('clears what housekeeping clears, on demand (AC 42)', async () => {
    const done = await api<{ data: { events: number; tombstones: number; sessions: number } }>(
      '/runs/housekeeping',
      { method: 'POST' },
    );
    expect(done.status).toBe(200);
    expect(done.body.data.sessions).toBeGreaterThanOrEqual(0);
  });

  it('streams what happens, so the pages need no reload (§3 I, Should)', async () => {
    const response = await fetch(`${running.baseUrl}/v1/admin/stream`, { headers: { cookie } });
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('the stream had no body');

    await api('/tenants', { method: 'POST', body: tenantBody() });
    let seen = '';
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline && !seen.includes('admin.tenant_saved')) {
      const chunk = await reader.read();
      if (chunk.done) break;
      seen += new TextDecoder().decode(chunk.value);
    }
    await reader.cancel();
    // The stream polls until its connection is gone; let the server notice before the test ends.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(seen).toContain('event: events');
    expect(seen).toContain('admin.tenant_saved');
  });

  it('serves the built app under /admin, and the app’s own addresses (AC 42)', async () => {
    const page = await fetch(`${running.baseUrl}/admin`);
    const body = await page.text();
    // Built: the page is the app. Not built: a page that says how to build it, never a 404.
    expect([200, 503]).toContain(page.status);
    expect(body).toContain('<title>');

    const deep = await fetch(`${running.baseUrl}/admin/tenants/1`);
    expect([200, 503]).toContain(deep.status);
  });

  it('signs a person out, and the session stops working (U6, AC 42)', async () => {
    expect((await api('/sign-out', { method: 'POST' })).status).toBe(200);
    expect((await api('/overview')).status).toBe(401);
    const { rows } = await db().query<{ n: string }>('select count(*) as n from admin_sessions');
    expect(Number(rows[0]?.n)).toBe(0);
  });
});
