// AC 42: every page of the admin area works through HTTP, and an adapter brings its own. The app
// makes exactly these calls and no others, so what passes here is what a person can do
// (docs/admin-panel-design.md §3). The browser journeys in `admin/e2e` walk the same ground with a
// real browser; this suite proves the API underneath them.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { connectionById, harness, until, type Harness } from './harness.js';
import { fakeWebhookAdapter } from '../adapters/fake-webhook/index.js';
import * as crm from '../adapters/fake-webhook/crm.js';
import { db } from '../engine/storage/db.js';
import { logEvent, queryEvents } from '../engine/events.js';
import { checkAlerts } from '../engine/alerts.js';
import { inMaintenance } from '../engine/storage/settings.js';
import { flushBells } from '../engine/bells.js';
import { getJob, runNextJob } from '../engine/jobs.js';
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

    // A connection names its CRM. No office named is allowed since question 147 a (2026-10-06):
    // it means every office the CRM gives the login.
    const noCrm = await api<{ error: string }>('/tenants', {
      method: 'POST',
      body: tenantBody({
        connections: [
          {
            id: 'acme-crm',
            provider: '',
            credentials: { key: 'a-key' },
            licensedOffices: [],
            active: true,
          },
        ],
      }),
    });
    expect(noCrm.status).toBe(400);
    expect(noCrm.body.error).toContain('CRM');
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

    // One field typed goes over the stored ones and loses none of them (known bug 3).
    await api(`/tenants/${String(id)}`, {
      method: 'PATCH',
      body: tenantBody({
        connections: [
          {
            id: 'acme-crm',
            provider: 'fake-webhook',
            credentials: { region: 'south' },
            licensedOffices: ['100'],
            active: true,
          },
        ],
      }),
    });
    expect(JSON.parse((await connectionById('acme-crm'))?.credentials ?? '{}')).toEqual({
      key: 'a-key',
      region: 'south',
    });
  });

  it('scopes, sorts and pages the records, and shows one whole (U3, AC 42)', async () => {
    const made = await api<{ data: { id: number } }>('/tenants', {
      method: 'POST',
      body: tenantBody(),
    });
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

    // The same scope as Flow and Manual sync: tenants, offices and entity types, each one or
    // several, and one record id (Patric, 2026-10-06). A second tenant reads the same CRM, so
    // both hold office 100 and the same three homes.
    const count = async (query: string): Promise<number> =>
      (await api<{ total: number }>(`/records?${query}`)).body.total;
    await until(async () => (await count('datatype=office')) === 1, 'the office to load');
    const other = await api<{ data: { id: number } }>('/tenants', {
      method: 'POST',
      body: tenantBody({
        displayName: 'Bravo Mäklare',
        connections: [
          {
            id: 'bravo-crm',
            provider: 'fake-webhook',
            credentials: { key: 'b-key' },
            licensedOffices: ['100'],
            active: true,
          },
        ],
        sites: [],
      }),
    });
    expect(other.status).toBe(200);
    await running.deliver();
    await until(async () => (await count('')) === 8, 'the second tenant to load');
    const [acme, bravo] = [String(made.body.data.id), String(other.body.data.id)];
    expect(await count(`tenant=${acme}&datatype=property`)).toBe(3);
    expect(await count(`tenant=${acme},${bravo}`)).toBe(8);
    expect(await count(`tenant=${bravo}&office=100`)).toBe(4);
    expect(await count('datatype=property,office')).toBe(8);
    expect(await count('office=100&datatype=property')).toBe(6);
    expect(await count('office=999')).toBe(0);
    expect(await count(`id=OBJ-2&tenant=${acme}`)).toBe(1);
    expect(await count('deleted=true')).toBe(0);

    // A home the CRM no longer has stays in Core as removed: counted by Both, the default, and
    // told apart by Live and Removed. Fetched again for one tenant only, so the other keeps it.
    crm.remove('property', 'OBJ-3');
    await api('/runs/fetch-again', {
      method: 'POST',
      body: { tenantIds: [made.body.data.id], remoteId: 'OBJ-3' },
    });
    await running.deliver();
    await until(async () => (await count('deleted=true')) === 1, 'the home to be removed');
    expect(await count(`tenant=${acme}&datatype=property`)).toBe(3);
    expect(await count(`tenant=${acme}&datatype=property&deleted=false`)).toBe(2);
    expect(await count(`tenant=${acme}&deleted=true&id=OBJ-3`)).toBe(1);
    expect(await count(`tenant=${bravo}&deleted=false&datatype=property`)).toBe(3);
    const slip = await api<{ error: string }>('/records?datatype=house');
    expect(slip.status).toBe(400);
    expect(slip.body.error).toContain('is not an entity type Core knows');

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

  it('recomputes a scope as a job the worker runs (U4, AC 42)', async () => {
    await api('/tenants', { method: 'POST', body: tenantBody() });
    crm.put('office', '100', { ref: '100', title: 'Lidingö', updatedUtc: '2026-08-30T09:00:00Z' });
    crm.put('property', 'OBJ-1', property('OBJ-1'));
    await running.deliver();
    // The office lands first, so waiting for "a record" is not waiting for this record.
    await until(
      async () => (await api<{ total: number }>('/records?datatype=property')).body.total === 1,
      'the property to load',
    );

    const queued = await api<{ data: { job: number } }>('/runs/recompute', {
      method: 'POST',
      body: { datatypes: ['property'] },
    });
    expect(queued.body.data.job).toBeGreaterThan(0);
    await runNextJob();
    const done = await getJob(queued.body.data.job);
    expect(done?.state).toBe('done');
    expect(done?.result?.examined).toBe(1);
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

    // One record id, or an office, is the records Core holds there, each asked for again: an
    // adapter told only "this office" may check the office and fetch none of its records.
    const byId = await api<{ data: { queued: number } }>('/runs/fetch-again', {
      method: 'POST',
      body: { remoteId: 'OBJ-1' },
    });
    expect(byId.body.data.queued).toBe(1);
    const byOffice = await api<{ data: { queued: number } }>('/runs/fetch-again', {
      method: 'POST',
      body: { officeIds: ['100'], datatypes: ['property'] },
    });
    expect(byOffice.body.data.queued).toBe(1);
    await running.deliver();
    expect(await queryEvents({ type: 'lifecycle.refetch', limit: 10 })).toHaveLength(3);
  });

  it('offers the pickers a scope is chosen from (Patric, 2026-09-21 and 2026-10-06)', async () => {
    // Tenants, then the offices of the tenants picked, then the entity types: Records, Flow and
    // Manual sync all read this, so no page asks a person to type a number they must know. The
    // offices are the ones Core holds records for, named as their office record names them.
    const made = await api<{ data: { id: number } }>('/tenants', {
      method: 'POST',
      body: tenantBody(),
    });
    crm.put('office', '100', { ref: '100', title: 'Lidingö', updatedUtc: '2026-08-30T09:00:00Z' });
    crm.put('property', 'OBJ-1', property('OBJ-1'));
    await running.deliver();
    await until(
      async () => (await api<{ total: number }>('/records')).body.total === 2,
      'the office and the property to load',
    );
    const scope = await api<{
      data: {
        tenants: { id: number; name: string }[];
        offices: { tenantId: number; id: string; name: string | null }[];
        datatypes: string[];
      };
    }>('/scope');
    expect(scope.status).toBe(200);
    expect(scope.body.data.tenants).toContainEqual(
      expect.objectContaining({ id: made.body.data.id, name: 'Acme Mäklare' }),
    );
    expect(scope.body.data.offices).toEqual([
      { tenantId: made.body.data.id, id: '100', name: 'Lidingö' },
    ]);
    expect(scope.body.data.datatypes).toEqual(['office', 'property']);
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

  it('lists what needs attention from the last seven days, naming each thing, where it is, and its link (U2, questions 159 and 163)', async () => {
    const made = await api<{ data: { id: number } }>('/tenants', {
      method: 'POST',
      body: tenantBody(),
    });
    const tenantId = made.body.data.id;
    // A sites check from before the sites were kept on it: one line with the names it gave.
    await logEvent({
      type: 'check.failed',
      fields: {
        name: 'subscribers',
        detail: '1 site(s) have not pulled for an hour',
        names: ['old.se'],
      },
    });
    // The office's record is already removed when the adapter tells: its name comes with the event.
    await logEvent({
      type: 'office.taken_off',
      connectionId: 'acme-crm',
      fields: {
        office_id: '100',
        office_name: 'Lidingö',
        reason: 'it is no longer in the office group the sites use',
      },
    });
    await logEvent({
      type: 'connection.paused',
      connectionId: 'acme-crm',
      fields: { failures: 5, detail: 'the CRM did not answer' },
    });
    // Older than a week: not listed.
    await logEvent({
      type: 'login.refused',
      connectionId: 'acme-crm',
      fields: { detail: 'refused' },
    });
    await db().query(
      "update events set at = now() - interval '8 days' where type = 'login.refused'",
    );
    // Core told the new site about changes two hours ago, and it has never fetched: the sites check
    // finds it behind, and only the site is listed, not the other failing checks.
    await db().query("update subscribers set last_bell_at = now() - interval '2 hours'");
    await checkAlerts({
      environment: 'test',
      publicUrl: null,
      email: null,
      slackWebhookUrl: null,
    });
    const tenant = await api<{ data: { sites: { id: number }[] } }>(`/tenants/${String(tenantId)}`);
    const siteId = tenant.body.data.sites[0]?.id ?? 0;
    const connection = 'Acme Mäklare’s Fake-webhook connection, short name acme-crm';

    const overview = await api<{ data: { attention: Record<string, unknown>[] } }>('/overview');
    expect(overview.body.data.attention).toEqual([
      expect.objectContaining({
        type: 'check.failed',
        title: 'a site is not fetching its changes',
        said: 'Core told the site about changes over an hour ago, and it has not fetched them since, so it shows out-of-date homes. It has never fetched. Check that the site is up and that its plugin reaches Core.',
        what: 'site acme.se',
        where: 'Acme Mäklare',
        link: `/tenants/${String(tenantId)}#site:${String(siteId)}`,
        tenantId,
        tenant: 'Acme Mäklare',
      }),
      // The connection is the thing itself, so it is not named again as where it is.
      expect.objectContaining({
        type: 'connection.paused',
        what: connection,
        where: null,
        link: `/tenants/${String(tenantId)}#connection:acme-crm`,
        tenant: 'Acme Mäklare',
      }),
      expect.objectContaining({
        type: 'office.taken_off',
        title: 'an office was taken off the sites',
        said: 'Office Lidingö (the CRM’s office id 100) was taken off the sites, with its homes and agents: it is no longer in the office group the sites use. Each office comes back on the sites, with its homes and agents, once this connection can read it from the CRM again.',
        what: 'office Lidingö (the CRM’s office id 100)',
        where: connection,
        link: `/records?tenant=${String(tenantId)}&office=100&deleted=true`,
        tenantId,
        tenant: 'Acme Mäklare',
      }),
      expect.objectContaining({
        type: 'check.failed',
        what: 'site old.se',
        link: '/tenants',
        tenant: null,
      }),
    ]);
  });

  it('lists what is in flight, coloured by state, by tenant and office (U5, Patric’s rule 3)', async () => {
    const made = await api<{ data: { id: number } }>('/tenants', {
      method: 'POST',
      body: tenantBody(),
    });
    crm.put('office', '100', { ref: '100', title: 'Lidingö', updatedUtc: '2026-08-30T09:00:00Z' });
    crm.put('property', 'OBJ-1', property('OBJ-1'));
    await running.deliver();
    // The office lands first, so waiting for "a record" is not waiting for this record.
    await until(
      async () => (await api<{ total: number }>('/records?datatype=property')).body.total === 1,
      'the property to load',
    );

    const flow = await api<{
      data: {
        state: string;
        remoteId: string;
        queuedAt: string;
        what: string;
        officeId: string | null;
        tenant: string | null;
      }[];
    }>('/flow');
    expect(flow.status).toBe(200);
    const row = flow.body.data.find((one) => one.remoteId === 'OBJ-1');
    expect(row?.state).toBe('fetched');
    expect(row?.what).not.toBe('');
    // Every row says whose record it is and which office it came from. The office is on the
    // record, never on the event, so a record that has already moved must still show it
    // (Patric, 2026-09-21: two tenants held the same records and the office column was empty).
    expect(row?.tenant).toBe('Acme Mäklare');
    expect(row?.officeId).toBe('100');

    // Filtered by tenant and office, the same scope as Records and Manual sync (Patric,
    // 2026-10-06), and never more than the hundred newest.
    const ids = async (query: string): Promise<string[]> =>
      (await api<{ data: { remoteId: string }[] }>(`/flow?${query}`)).body.data.map(
        (one) => one.remoteId,
      );
    const tenant = String(made.body.data.id);
    expect(await ids(`tenant=${tenant}`)).toContain('OBJ-1');
    expect(await ids(`tenant=${tenant}&office=100`)).toContain('OBJ-1');
    expect(await ids(`tenant=${String(made.body.data.id + 1)}`)).toEqual([]);
    expect(await ids('office=999')).toEqual([]);
    expect(await ids('limit=1')).toHaveLength(1);
    expect((await api('/flow?tenant=abc')).status).toBe(400);
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

  it('syncs a scope at each of three levels, each ending at the sites (Patric, 2026-10-06)', async () => {
    await api('/tenants', { method: 'POST', body: tenantBody() });
    crm.put('office', '100', { ref: '100', title: 'Lidingö', updatedUtc: '2026-08-30T09:00:00Z' });
    for (const ref of ['OBJ-1', 'OBJ-2']) crm.put('property', ref, property(ref));
    await running.deliver();
    await until(
      async () => (await api<{ total: number }>('/records')).body.total === 3,
      'the office and the two properties to load',
    );
    const seqOf = async (id: string): Promise<number> =>
      (await api<{ data: { seq: number }[] }>(`/records?id=${id}`)).body.data[0]?.seq ?? 0;
    const sync = (level: string, scope: Record<string, unknown>) =>
      api<{ data: { detail: string }; error: string }>('/runs/sync', {
        method: 'POST',
        body: { level, ...scope },
      });
    await flushBells();
    const bells = async (): Promise<number> =>
      (await queryEvents({ type: 'bell', limit: 100 })).length;

    // Send only: the records in the scope get new places in the order the sites pull by, so
    // every site takes them again on the bell; nothing else moves, nothing is fetched or run.
    const [one, two] = [await seqOf('OBJ-1'), await seqOf('OBJ-2')];
    const rung = await bells();
    const sent = await sync('send', { remoteId: 'OBJ-1' });
    expect(sent.status).toBe(200);
    expect(sent.body.data.detail).toBe(
      'Core sent 1 record to the sites of Acme Mäklare again. Each site takes the ones it lacks or holds in another version.',
    );
    expect(await seqOf('OBJ-1')).toBeGreaterThan(Math.max(one, two));
    expect(await seqOf('OBJ-2')).toBe(two);
    await flushBells();
    expect(await bells()).toBeGreaterThan(rung);
    expect(await runNextJob()).toBe(false);

    // Recompute and send: a recompute of the scope runs in the background, and the send goes now.
    const recomputed = await sync('recompute', { officeIds: ['100'], datatypes: ['property'] });
    expect(recomputed.body.data.detail).toContain('Core recomputes them in the background.');
    expect(recomputed.body.data.detail).toContain('Core sent 2 records to the sites');
    expect(await runNextJob()).toBe(true);

    // The whole way: the CRM is asked for the scope again and a recompute is queued, both in the
    // background, and the send goes now; what the fetch changes goes to the sites as it is written.
    const fetched = await sync('fetch', { remoteId: 'OBJ-2' });
    expect(fetched.body.data.detail).toContain('Core asks the CRM for 1 record again.');
    await running.deliver();
    expect(await queryEvents({ type: 'lifecycle.refetch', limit: 10 })).toHaveLength(1);
    expect(await runNextJob()).toBe(true);

    // Who started which, in the log; and a level nobody offers is a refusal in words.
    const said = await queryEvents({ type: 'admin.synced', limit: 10 });
    expect(said.map((event) => event.fields['level'])).toEqual(['send', 'recompute', 'fetch']);
    const slip = await sync('everything', {});
    expect(slip.status).toBe(400);
    expect(slip.body.error).toBe('Say how far to go: fetch, recompute, send.');
    // A scope Core cannot read is refused in words too, never a database error.
    const odd = await sync('send', { tenantIds: ['x'] });
    expect(odd.status).toBe(400);
    expect(odd.body.error).toContain('is not a tenant number');
    expect((await sync('send', { datatypes: [{}] })).status).toBe(400);
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
