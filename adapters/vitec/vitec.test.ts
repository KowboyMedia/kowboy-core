// The Vitec adapter against the real engine and a stand-in Connect (test/connect.ts): webhooks,
// the fetch list, both schedules, licensing by office and the health checks. The stand-in follows
// what a read-only probe of Connect showed on 2026-09-17 (scripts/vitec-probe.ts). Core carries
// every estate Vitec answers 200 for, marketed or not (Patric); only a 404 tombstones.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  harness,
  previewToken,
  pull,
  ADMIN_SECRET,
  type Harness,
} from '../../acceptance/harness.js';
import { drainFetchList, runSchedules, vitecAdapter } from './index.js';
import { isoDate } from './mappers.js';
import * as store from './store.js';
import {
  PASSWORD,
  USERNAME,
  startFakeConnect,
  stockholm,
  type FakeConnect,
} from './test/connect.js';

const CONNECTION = 'vitec-acme';
/** The office id: Connect's customer id. Its office record has an id of its own. */
const OFFICE = 'M1';
const OFFICE_RECORD = 'FIR1';
const TOKEN = 'hook-token';
/** Swedish wall-clock time, the way Connect writes every date. */
const CHANGED = '2026-09-10T08:00:00.123';

const credentials = JSON.stringify({ username: USERNAME, password: PASSWORD });

const minutesAgo = (minutes: number): Date => new Date(Date.now() - minutes * 60_000);

const estate = (id: string, officeId = OFFICE, extra: Record<string, unknown> = {}) => ({
  id,
  office: { id: officeId.replace('M', 'FIR'), customerId: officeId },
  primaryAgentId: 'U1',
  secondaryAgentId: null,
  projectId: 'PR1',
  address: { streetAddress: 'Storgatan 1', area: { id: 'A1', name: 'Centrum' } },
  extensions: { housingCooperative: { association: { id: 'F1' } } },
  changedAt: CHANGED,
  ...extra,
});

/** One office with one of everything, the way Connect would publish it. */
function seed(fake: FakeConnect): void {
  fake.put(OFFICE, 'office', {
    id: OFFICE_RECORD,
    customerId: OFFICE,
    name: 'Kontor 1',
    changedAt: CHANGED,
  });
  fake.put(OFFICE, 'agent', {
    id: 'U1',
    name: 'Anna',
    offices: [
      { id: OFFICE_RECORD, customerId: OFFICE, orderNumber: 1, isVisibleInStaffList: true },
    ],
    changedAt: CHANGED,
  });
  fake.put(OFFICE, 'area', { id: 'A1', name: 'Centrum', changedAt: CHANGED });
  fake.put(OFFICE, 'project', {
    id: 'PR1',
    office: { id: OFFICE_RECORD, customerId: OFFICE },
    primaryAgentId: 'U1',
    address: { area: { id: 'A1' } },
    changedAt: CHANGED,
  });
  fake.put(OFFICE, 'association', { id: 'F1', name: 'Brf Solen', changedAt: CHANGED });
  fake.put(OFFICE, 'property', estate('OBJ1'));
}

let fake: FakeConnect;
let running: Harness;

/** An admin event: queued by the web process, delivered by the worker, here by hand. */
const event = async (body: Record<string, unknown>): Promise<Response> => {
  const response = await fetch(`${running.baseUrl}/v1/admin/event`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-secret': ADMIN_SECRET },
    body: JSON.stringify({ connection_id: CONNECTION, ...body }),
  });
  await running.deliver();
  return response;
};

const hook = (body: Record<string, unknown>, token = TOKEN): Promise<Response> =>
  fetch(`${running.baseUrl}/v1/hook/vitec/webhook/${token}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

/** What Vitec's preview landing page calls: init when the agent clicks, verify until ready. */
const preview = (step: 'init' | 'verify', estateId: string, token = TOKEN): Promise<Response> =>
  fetch(
    `${running.baseUrl}/v1/hook/vitec/preview/${step}/${token}?customerId=${OFFICE}&estateId=${estateId}`,
  );

const health = async (): Promise<Record<string, { ok: boolean; detail?: string }>> => {
  const response = await fetch(`${running.baseUrl}/v1/health`);
  return ((await response.json()) as { checks: Record<string, { ok: boolean; detail?: string }> })
    .checks;
};

const item = async (
  datatype: string,
  remoteId: string,
): Promise<Record<string, unknown> | undefined> =>
  (await pull(running.baseUrl, datatype)).items.find(
    (candidate) => candidate['remote_id'] === remoteId,
  );

const fetchesOf = (id: string): number =>
  fake.requests.filter((request) => request.path.endsWith(`/${OFFICE}/${id}`)).length;

async function start(licensedOffices: string[] = [OFFICE]): Promise<void> {
  running = await harness({
    adapters: [vitecAdapter],
    connections: [{ id: CONNECTION, provider: 'vitec', credentials, licensedOffices }],
  });
  // The adapter's first tick catches up every connection it has never seen; wait for it.
  await runSchedules();
}

beforeEach(async () => {
  fake = await startFakeConnect();
  process.env['VITEC_BASE_URL'] = fake.url;
  process.env['VITEC_WEBHOOK_TOKEN'] = TOKEN;
  await store.reset();
});

afterEach(async () => {
  await running.stop();
  await fake.close();
});

describe('the Vitec adapter', () => {
  it('loads everything a new connection publishes, with the spine and the referenced association', async () => {
    seed(fake);
    await start();
    await event({ event: 'connection_added' });
    await drainFetchList();

    const property = await item('property', 'OBJ1');
    expect(property?.['data']).toEqual({
      id: 'OBJ1',
      office_id: OFFICE,
      agent_ids: ['U1'],
      area_ids: ['A1'],
      association_id: 'F1',
      project_id: 'PR1',
      display: {},
      provider_extras: {},
    });
    expect(property?.['office_id']).toBe(OFFICE);
    // Swedish summer time is two hours ahead of UTC.
    expect(property?.['remote_updated_at']).toBe('2026-09-10T06:00:00.123Z');

    expect((await item('agent', 'U1'))?.['data']).toMatchObject({ office_ids: [OFFICE] });
    expect((await item('project', 'PR1'))?.['data']).toMatchObject({
      office_id: OFFICE,
      agent_ids: ['U1'],
      area_ids: ['A1'],
    });
    // An office is fetched by its own id; the item carries the customer id, which licensing uses.
    const office = await item('office', OFFICE_RECORD);
    expect(office?.['data']).toMatchObject({ id: OFFICE });
    expect(office?.['office_id']).toBe(OFFICE);
    expect(await item('area', 'A1')).toBeDefined();
    // No list endpoint for associations: reached through the estate that names it.
    expect(await item('association', 'F1')).toBeDefined();
    expect(await store.depth()).toBe(0);
  });

  it('answers a burst of webhooks with 202 and fetches the record once (AC 29, AC 33)', async () => {
    seed(fake);
    await start();
    await drainFetchList();
    fake.requests.length = 0;
    // Slow answers: the whole burst lands while one fetch is in flight.
    fake.delayMs = 1000;

    const responses = await Promise.all(
      Array.from({ length: 100 }, () =>
        hook({ type: 'Estate', event: 'Update', customerId: OFFICE, id: 'OBJ1' }),
      ),
    );
    expect(responses.every((response) => response.status === 202)).toBe(true);
    // One row, or none if the drain has just claimed it: never a hundred.
    expect(await store.depth()).toBeLessThanOrEqual(1);

    await drainFetchList();
    // One fetch in flight when the burst began, at most one more for what arrived meanwhile.
    expect(fetchesOf('OBJ1')).toBeLessThanOrEqual(2);
    expect(fake.requests.every((request) => request.path.includes('/OBJ1'))).toBe(true);
    expect(await store.depth()).toBe(0);
  });

  it('refuses a wrong token, and says so when none is configured', async () => {
    await start();
    const wrong = await hook({ type: 'Estate', customerId: OFFICE, id: 'OBJ1' }, 'nope');
    expect(wrong.status).toBe(401);

    delete process.env['VITEC_WEBHOOK_TOKEN'];
    const unset = await hook({ type: 'Estate', customerId: OFFICE, id: 'OBJ1' });
    expect(unset.status).toBe(503);
    expect(await store.depth()).toBe(0);
  });

  it('ignores notification types it does not carry and rejects one without an id', async () => {
    await start();
    const contact = await hook({ type: 'Contact', customerId: OFFICE, id: 'ADR1' });
    expect(contact.status).toBe(202);
    expect(await contact.json()).toEqual({ ignored: true });

    const bare = await hook({ type: 'Estate', customerId: OFFICE });
    expect(bare.status).toBe(400);
    expect(await store.depth()).toBe(0);
  });

  it('tombstones after a Remove notification once Vitec answers 404 (AC 3)', async () => {
    seed(fake);
    await start();
    await drainFetchList();
    expect((await item('property', 'OBJ1'))?.['deleted']).toBe(false);

    fake.remove(OFFICE, 'property', 'OBJ1');
    await hook({ type: 'Estate', event: 'Remove', customerId: OFFICE, id: 'OBJ1' });
    await drainFetchList();

    expect((await item('property', 'OBJ1'))?.['deleted']).toBe(true);
  });

  it('retries a failed fetch with backoff, turns vitec.retries red after three, and recovers (AC 39)', async () => {
    seed(fake);
    await start();
    await drainFetchList();
    fake.put(OFFICE, 'property', estate('OBJ1', OFFICE, { primaryAgentId: 'U2' }));
    const before = (await item('property', 'OBJ1'))?.['seq'];

    fake.failNext(3);
    await hook({ type: 'Estate', event: 'Update', customerId: OFFICE, id: 'OBJ1' });
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await drainFetchList();
      expect(await store.depth()).toBe(1);
      await store.expedite();
    }
    expect((await health())['vitec.retries']).toMatchObject({ ok: false });
    // Three failures did not tombstone anything.
    expect((await item('property', 'OBJ1'))?.['seq']).toBe(before);

    await drainFetchList();
    expect(await store.depth()).toBe(0);
    const after = await item('property', 'OBJ1');
    expect(after?.['seq']).toBeGreaterThan(Number(before));
    expect(after?.['data']).toMatchObject({ agent_ids: ['U2'] });
    expect((await health())['vitec.retries']).toEqual({ ok: true });
  });

  it('gives up after six failures, reports it, and a new webhook wakes the record (AC 39)', async () => {
    seed(fake);
    await start();
    await drainFetchList();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      fake.failNext(6);
      await hook({ type: 'Estate', event: 'Update', customerId: OFFICE, id: 'OBJ1' });
      for (let attempt = 1; attempt <= 6; attempt += 1) {
        await drainFetchList();
        await store.expedite();
      }
      // Given up: still listed, but not due, and reported once.
      await drainFetchList();
      expect(await store.depth()).toBe(1);
      expect(fetchesOf('OBJ1')).toBe(7);
      expect(
        errors.mock.calls.some((call) => String(call[0]).includes('vitec fetch given up')),
      ).toBe(true);
      expect((await health())['vitec.retries']).toMatchObject({ ok: false });

      await hook({ type: 'Estate', event: 'Update', customerId: OFFICE, id: 'OBJ1' });
      await drainFetchList();
      expect(await store.depth()).toBe(0);
      expect((await health())['vitec.retries']).toEqual({ ok: true });
    } finally {
      errors.mockRestore();
    }
  });

  it('turns vitec.webhook_lag red when a webhook has waited five minutes (AC 38)', async () => {
    seed(fake);
    await start();
    await drainFetchList();
    expect((await health())['vitec.webhook_lag']).toEqual({ ok: true });

    fake.failNext(100);
    await hook({ type: 'Estate', event: 'Update', customerId: OFFICE, id: 'OBJ1' });
    await drainFetchList();
    await store.backdate(6 * 60_000);
    expect((await health())['vitec.webhook_lag']).toMatchObject({ ok: false });
  });

  it('catches up on what changed since the last window, less one hour of overlap (AC 35)', async () => {
    seed(fake);
    await start();
    await drainFetchList();
    const until = await store.getState(CONNECTION, 'catch_up_until');
    expect(until).not.toBeNull();

    fake.put(OFFICE, 'property', estate('OBJ2', OFFICE, { changedAt: stockholm(new Date()) }));
    await store.setState(
      CONNECTION,
      'catch_up_at',
      new Date(Date.now() - 13 * 3_600_000).toISOString(),
    );
    fake.requests.length = 0;
    await runSchedules();
    await drainFetchList();

    expect(await item('property', 'OBJ2')).toBeDefined();
    const listing = fake.requests.find((request) =>
      request.query.has('criteria.changedAtMinValue'),
    );
    const since = new Date(listing?.query.get('criteria.changedAtMinValue') ?? 0).getTime();
    expect(new Date(until!).getTime() - since).toBe(3_600_000);
    expect((await health())['vitec.catch_up']).toEqual({ ok: true });
  });

  it('starts with a catch-up since the last window, fetching only records whose change date moved (AC 35, AC 41)', async () => {
    const until = minutesAgo(120).toISOString();
    seed(fake);
    const unchanged = stockholm(minutesAgo(30));
    fake.put(OFFICE, 'property', estate('OBJ1', OFFICE, { changedAt: unchanged }));
    fake.put(OFFICE, 'property', estate('OBJ2', OFFICE, { changedAt: stockholm(minutesAgo(20)) }));
    // As the worker finds things: the last catch-up ended two hours ago, OBJ1 was fetched as it is now.
    await store.setState(CONNECTION, 'catch_up_until', until);
    await store.setState(CONNECTION, 'catch_up_at', until);
    await store.setState(CONNECTION, 'compare_at', minutesAgo(1).toISOString());
    await store.remember(OFFICE, 'property', 'OBJ1', unchanged);

    await start();
    await drainFetchList();

    expect(fetchesOf('OBJ1')).toBe(0);
    expect(await item('property', 'OBJ2')).toBeDefined();
    const listing = fake.requests.find((request) =>
      request.query.has('criteria.changedAtMinValue'),
    );
    const since = new Date(listing?.query.get('criteria.changedAtMinValue') ?? 0).getTime();
    expect(since).toBe(new Date(until).getTime() - 3_600_000);
  });

  it('keeps vitec.catch_up red from a start until the catch-up and its fetches are done (AC 41)', async () => {
    seed(fake);
    fake.delayMs = 150;
    running = await harness({
      adapters: [vitecAdapter],
      connections: [{ id: CONNECTION, provider: 'vitec', credentials, licensedOffices: [OFFICE] }],
    });
    expect((await health())['vitec.catch_up']).toMatchObject({
      ok: false,
      detail: expect.stringContaining('since the worker started'),
    });

    await runSchedules();
    expect((await health())['vitec.catch_up']).toEqual({ ok: true });
    expect(await item('office', OFFICE_RECORD)).toBeDefined();
  });

  it('turns vitec.catch_up red when the last catch-up is older than 13 hours', async () => {
    seed(fake);
    await start();
    await store.setState(
      CONNECTION,
      'catch_up_at',
      new Date(Date.now() - 14 * 3_600_000).toISOString(),
    );
    expect((await health())['vitec.catch_up']).toMatchObject({ ok: false });
  });

  it('confirms a missing id with a fetch before tombstoning it, once a day (AC 35)', async () => {
    seed(fake);
    await start();
    await drainFetchList();

    fake.remove(OFFICE, 'property', 'OBJ1');
    await store.setState(
      CONNECTION,
      'compare_at',
      new Date(Date.now() - 25 * 3_600_000).toISOString(),
    );
    fake.requests.length = 0;
    await runSchedules();
    expect((await item('property', 'OBJ1'))?.['deleted']).toBe(false);

    await drainFetchList();
    expect(fetchesOf('OBJ1')).toBe(1);
    expect((await item('property', 'OBJ1'))?.['deleted']).toBe(true);
  });

  it('tombstones what Vitec no longer lists on a resync (AC 14)', async () => {
    seed(fake);
    await start();
    await drainFetchList();

    fake.remove(OFFICE, 'property', 'OBJ1');
    await event({ event: 'resync' });
    expect((await item('property', 'OBJ1'))?.['deleted']).toBe(true);
    await drainFetchList();
    expect((await item('office', OFFICE_RECORD))?.['deleted']).toBe(false);
  });

  it('fetches at most five records at once (proposal point 10)', async () => {
    seed(fake);
    for (let n = 2; n <= 20; n += 1) fake.put(OFFICE, 'property', estate(`OBJ${n}`));
    fake.delayMs = 20;
    await start();
    await drainFetchList();

    expect(fake.maxInFlight).toBeLessThanOrEqual(5);
    expect(fake.maxInFlight).toBeGreaterThan(1);
    expect((await pull(running.baseUrl, 'property')).items).toHaveLength(20);
  });

  it('loads an added office without a new seq for the others (AC 14)', async () => {
    seed(fake);
    fake.put('M2', 'property', estate('OBJ2', 'M2'));
    await start([OFFICE]);
    await drainFetchList();
    const first = await item('property', 'OBJ1');
    expect(first?.['deleted']).toBe(false);
    expect(await item('property', 'OBJ2')).toBeUndefined();

    await running.connection({
      id: CONNECTION,
      provider: 'vitec',
      credentials,
      licensedOffices: [OFFICE, 'M2'],
    });
    fake.requests.length = 0;
    await event({ event: 'offices_added', office_ids: ['M2'] });
    await drainFetchList();

    expect((await item('property', 'OBJ2'))?.['office_id']).toBe('M2');
    expect((await item('property', 'OBJ1'))?.['seq']).toBe(first?.['seq']);
    // Only the added office was listed and fetched.
    expect(fake.requests.every((request) => request.path.includes('/M2'))).toBe(true);
  });

  it("answers a preview: fetches the estate first, then points Vitec at the site's preview link (AC 42)", async () => {
    seed(fake);
    await start();
    await drainFetchList();
    // The agent changed the estate and clicked "Förhandsgranska".
    fake.put(OFFICE, 'property', estate('OBJ1', OFFICE, { primaryAgentId: 'U2' }));

    const started = (await (await preview('init', 'OBJ1')).json()) as { url: string | null };
    // The estate is known already, so Vitec may show the site's page while the fetch runs.
    expect(started.url).toContain('?datatype=property&id=OBJ1&token=');
    expect(await (await preview('verify', 'OBJ1')).json()).toEqual({ isReady: false, url: null });

    await drainFetchList();
    const ready = (await (await preview('verify', 'OBJ1')).json()) as {
      isReady: boolean;
      url: string;
    };
    expect(ready).toEqual({ isReady: true, url: started.url });
    expect((await item('property', 'OBJ1'))?.['data']).toMatchObject({ agent_ids: ['U2'] });
    // The link is the site's bell endpoint, with the token the site checks with its bell secret.
    const link = new URL(ready.url);
    expect(link.searchParams.get('token')).toBe(previewToken('bell-secret', 'property', 'OBJ1'));
    expect(`${link.origin}${link.pathname}`).toBe(running.bellUrl);
  });

  it('tells Vitec when a previewed estate does not exist, and refuses a wrong token (AC 42)', async () => {
    seed(fake);
    await start();
    await drainFetchList();

    expect((await preview('init', 'OBJ1', 'nope')).status).toBe(401);
    expect(await (await preview('verify', 'OBJ9')).json()).toEqual({
      isReady: false,
      url: null,
      errorMessage: 'Förhandsgranskningen är inte startad',
    });

    expect(await (await preview('init', 'OBJ9')).json()).toEqual({ url: null });
    await drainFetchList();
    expect(await (await preview('verify', 'OBJ9')).json()).toEqual({
      isReady: false,
      url: null,
      errorMessage: 'Bostaden finns inte i Vitec',
    });
  });

  it('lists page by page from page 0 and stops at the first empty page', async () => {
    seed(fake);
    for (let n = 2; n <= 250; n += 1) fake.put(OFFICE, 'property', estate(`OBJ${n}`));
    await start();
    await drainFetchList();

    let stored = 0;
    for (let after = 0, more = true; more;) {
      const pulled = await pull(running.baseUrl, 'property', after);
      stored += pulled.items.length;
      after = pulled.next_after;
      more = pulled.has_more;
    }
    expect(stored).toBe(250);
    const pages = fake.requests
      .filter((request) => request.path.endsWith(`/Estate/${OFFICE}`))
      .map((request) => Number(request.query.get('paging.pageIndex')));
    // 250 rows at 100 a page: pages 0, 1 and 2, then page 3 comes back empty. Listed twice: once
    // by the catch-up and once by the comparison the first tick runs.
    expect(pages).toEqual([0, 1, 2, 3, 0, 1, 2, 3]);
  });
});

describe('Vitec dates', () => {
  it('reads a bare value as Swedish wall-clock time, summer and winter', () => {
    expect(isoDate('2026-09-10T10:31:42.29')).toBe('2026-09-10T08:31:42.290Z');
    expect(isoDate('2026-01-09T11:56:22')).toBe('2026-01-09T10:56:22.000Z');
  });

  it('settles the hours around a daylight-saving switch', () => {
    // Clocks go forward at 02:00 on 2026-03-29: 01:30 is still CET, 03:30 already CEST.
    expect(isoDate('2026-03-29T01:30:00')).toBe('2026-03-29T00:30:00.000Z');
    expect(isoDate('2026-03-29T03:30:00')).toBe('2026-03-29T01:30:00.000Z');
    // Clocks go back at 03:00 on 2026-10-25: 00:30 is CEST, 03:30 CET.
    expect(isoDate('2026-10-25T00:30:00')).toBe('2026-10-24T22:30:00.000Z');
    expect(isoDate('2026-10-25T03:30:00')).toBe('2026-10-25T02:30:00.000Z');
  });

  it('honours an offset when one is given, and refuses what is not a date', () => {
    expect(isoDate('2026-09-16T05:56:31.3256156+02:00')).toBe('2026-09-16T03:56:31.325Z');
    expect(isoDate('2026-09-16T05:56:31Z')).toBe('2026-09-16T05:56:31.000Z');
    expect(isoDate('soon')).toBeNull();
    expect(isoDate('')).toBeNull();
    expect(isoDate(null)).toBeNull();
  });
});
