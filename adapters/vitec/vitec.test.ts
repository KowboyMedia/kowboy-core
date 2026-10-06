// The Vitec adapter against the real engine and a stand-in Connect (test/connect.ts): webhooks,
// the fetch list, both schedules, licensing by office and the health checks. Vitec's behaviour
// beyond its documentation waits for a test account on staging (strategy §9, Phase 6).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  connectionById,
  harness,
  healthReport,
  pull,
  queryEvents,
  queueLifecycle,
  type Harness,
  type HealthReport,
} from '../../acceptance/harness.js';
import { drainFetchList, runSchedules, vitecAdapter } from './index.js';
import { vitecAdmin } from './admin/index.js';
import { checkOffices, lastCheck } from './offices.js';
import type { AdminSection, Connection, LifecycleEvent } from '../../engine/adapter-api/index.js';
import * as store from './store.js';
import { PASSWORD, USERNAME, startFakeConnect, type FakeConnect } from './test/connect.js';

const CONNECTION = 'vitec-acme';
const OFFICE = 'M1';
const TOKEN = 'hook-token';
const CHANGED = '2026-09-10T08:00:00.1234567+02:00';

const credentials = JSON.stringify({ username: USERNAME, password: PASSWORD, customer_id: OFFICE });
/** The office in live Vitec, as the adapter's lists keep it. */
const LIVE_OFFICE = { environment: 'live' as const, officeId: OFFICE };

const estate = (id: string, officeId = OFFICE, extra: Record<string, unknown> = {}) => ({
  id,
  office: { id: officeId, customerId: officeId },
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
    id: OFFICE,
    customerId: OFFICE,
    name: 'Kontor 1',
    changedAt: CHANGED,
  });
  fake.put(OFFICE, 'agent', {
    id: 'U1',
    name: 'Anna',
    offices: [{ id: OFFICE, customerId: OFFICE, orderNumber: 1 }],
    changedAt: CHANGED,
  });
  fake.put(OFFICE, 'area', { id: 'A1', name: 'Centrum', changedAt: CHANGED });
  fake.put(OFFICE, 'project', {
    id: 'PR1',
    office: { id: OFFICE, customerId: OFFICE },
    primaryAgentId: 'U1',
    address: { area: { id: 'A1' } },
    changedAt: CHANGED,
  });
  fake.put(OFFICE, 'association', { id: 'F1', name: 'Brf Solen', changedAt: CHANGED });
  fake.put(OFFICE, 'property', estate('OBJ1'));
}

let fake: FakeConnect;
let running: Harness;

/** A lifecycle event: queued as the panel will queue it, delivered by the worker, here by hand. */
const event = async (type: LifecycleEvent['type'], officeIds?: string[]): Promise<void> => {
  await queueLifecycle(CONNECTION, type, officeIds ? { officeIds } : {});
  await running.deliver();
};

/** An optional part of the adapter's panel that the Vitec adapter does implement. */
const required = <T>(part: T | undefined, what: string): T => {
  if (!part) throw new Error(`the Vitec adapter has no ${what}`);
  return part;
};

/** The test connection as the engine holds it, credentials decrypted. */
const connection = async (): Promise<Connection> => {
  const found = await connectionById(CONNECTION);
  if (!found) throw new Error(`${CONNECTION} is gone`);
  return found;
};

const hook = (body: Record<string, unknown>, token = TOKEN): Promise<Response> =>
  fetch(`${running.baseUrl}/v1/hook/vitec/webhook/${token}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

/** The checks as the worker reports them, names included; /v1/health answers without the names. */
const health = async (): Promise<HealthReport['checks']> => (await healthReport()).checks;

const item = async (
  datatype: string,
  remoteId: string,
): Promise<Record<string, unknown> | undefined> =>
  (await pull(running.baseUrl, datatype)).items.find(
    (candidate) => candidate['remote_id'] === remoteId,
  );

const fetchesOf = (id: string): number =>
  fake.requests.filter((request) => request.path.endsWith(`/${OFFICE}/${id}`)).length;

/** One record's timeline, as the event log answers it. */
const timelineOf = (
  datatype: string,
  id: string,
): Promise<{ type: string; correlation_id: string | null; fields: Record<string, unknown> }[]> =>
  queryEvents({ entity: { connectionId: CONNECTION, datatype, remoteId: id } });

const notify = (id: string): Promise<Response> =>
  hook({ type: 'Estate', event: 'Update', customerId: OFFICE, id });

async function start(login = credentials): Promise<void> {
  running = await harness({
    adapters: [vitecAdapter],
    connections: [{ id: CONNECTION, provider: 'vitec', credentials: login, licensedOffices: [] }],
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
    await event('connection_added');
    await drainFetchList();

    const property = await item('property', 'OBJ1');
    expect(property?.['data']).toMatchObject({
      id: 'OBJ1',
      office_id: OFFICE,
      agent_ids: ['U1'],
      area_ids: ['A1'],
      association_id: 'F1',
      project_id: 'PR1',
      provider_extras: {},
      // The universal names (docs/field-tables.md), and the strings the engine prepared from them.
      address: { street: 'Storgatan 1', area_id: 'A1', area_name: 'Centrum' },
      display: { address_line: 'Storgatan 1' },
      // What the tables do not name stays under its mechanical snake_case name, nesting kept.
      extensions: { housing_cooperative: { association: { id: 'F1' } } },
    });
    // And the payload itself, untouched, next to it.
    expect(property?.['raw']).toEqual(estate('OBJ1'));
    expect(property?.['office_id']).toBe(OFFICE);
    expect(property?.['remote_updated_at']).toBe('2026-09-10T06:00:00.123Z');

    expect((await item('agent', 'U1'))?.['data']).toMatchObject({ office_ids: [OFFICE] });
    expect((await item('project', 'PR1'))?.['data']).toMatchObject({
      office_id: OFFICE,
      agent_ids: ['U1'],
      area_ids: ['A1'],
    });
    expect(await item('office', OFFICE)).toBeDefined();
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

  it('tombstones after a Remove notification, without a fetch (AC 3)', async () => {
    seed(fake);
    await start();
    await drainFetchList();
    expect((await item('property', 'OBJ1'))?.['deleted']).toBe(false);

    // Taken off the website: it still answers by id, but it left the marketed set.
    fake.unlist(OFFICE, 'property', 'OBJ1');
    fake.requests.length = 0;
    await hook({ type: 'Estate', event: 'Remove', customerId: OFFICE, id: 'OBJ1' });
    await drainFetchList();

    expect((await item('property', 'OBJ1'))?.['deleted']).toBe(true);
    expect(fetchesOf('OBJ1')).toBe(0);
    expect(await store.isKnown(LIVE_OFFICE, 'property', 'OBJ1')).toBe(false);
  });

  it('brings a record back on an Update after a Remove, and removes it on a Remove after an Update (AC 33)', async () => {
    seed(fake);
    await start();
    await drainFetchList();

    // Marketed again: the last signal wins.
    await hook({ type: 'Estate', event: 'Remove', customerId: OFFICE, id: 'OBJ1' });
    await drainFetchList();
    expect((await item('property', 'OBJ1'))?.['deleted']).toBe(true);
    await hook({ type: 'Estate', event: 'Update', customerId: OFFICE, id: 'OBJ1' });
    await drainFetchList();
    expect((await item('property', 'OBJ1'))?.['deleted']).toBe(false);

    // Update then Remove before any fetch ran: removed, and the Update was never fetched.
    fake.requests.length = 0;
    await hook({ type: 'Estate', event: 'Update', customerId: OFFICE, id: 'OBJ1' });
    await hook({ type: 'Estate', event: 'Remove', customerId: OFFICE, id: 'OBJ1' });
    await drainFetchList();
    expect((await item('property', 'OBJ1'))?.['deleted']).toBe(true);
    expect(fetchesOf('OBJ1')).toBe(0);
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
      if (attempt > 1) await store.expedite();
      await drainFetchList();
      expect(await store.depth()).toBe(1);
    }
    // The record now waits out its third backoff, where the adapter's own drain timer leaves it.
    expect((await health())['vitec.retries']).toMatchObject({ ok: false });
    // Three failures did not tombstone anything.
    expect((await item('property', 'OBJ1'))?.['seq']).toBe(before);

    await store.expedite();
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
        // Other fetches succeed in between: only this record keeps failing, the connection is fine.
        await store.setState(CONNECTION, 'failures', '0');
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

    fake.put(OFFICE, 'property', estate('OBJ2', OFFICE, { changedAt: new Date().toISOString() }));
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
    const ago = (minutes: number): string => new Date(Date.now() - minutes * 60_000).toISOString();
    const until = ago(120);
    seed(fake);
    const unchanged = ago(30);
    fake.put(OFFICE, 'property', estate('OBJ1', OFFICE, { changedAt: unchanged }));
    fake.put(OFFICE, 'property', estate('OBJ2', OFFICE, { changedAt: ago(20) }));
    // As the worker finds things: the last catch-up ended two hours ago, OBJ1 was fetched as it is now.
    await store.setState(CONNECTION, 'catch_up_until', until);
    await store.setState(CONNECTION, 'catch_up_at', until);
    await store.setState(CONNECTION, 'compare_at', ago(1));
    await store.setState(
      CONNECTION,
      'offices_check',
      JSON.stringify({ at: until, ids: [], offices: [OFFICE], source: 'all' }),
    );
    await store.remember(LIVE_OFFICE, 'property', 'OBJ1', unchanged);

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
      connections: [{ id: CONNECTION, provider: 'vitec', credentials, licensedOffices: [] }],
    });
    expect((await health())['vitec.catch_up']).toMatchObject({
      ok: false,
      detail: expect.stringContaining('since the worker started'),
    });

    await runSchedules();
    expect((await health())['vitec.catch_up']).toEqual({ ok: true });
    expect(await item('office', OFFICE)).toBeDefined();
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

  it('tombstones an id the list no longer holds, once a day, without a fetch (AC 35)', async () => {
    seed(fake);
    await start();
    await drainFetchList();

    // Off the list but still answering by id: the list defines what exists for the sites.
    fake.unlist(OFFICE, 'property', 'OBJ1');
    await store.setState(
      CONNECTION,
      'compare_at',
      new Date(Date.now() - 25 * 3_600_000).toISOString(),
    );
    fake.requests.length = 0;
    await runSchedules();
    await drainFetchList();

    expect(fetchesOf('OBJ1')).toBe(0);
    expect((await item('property', 'OBJ1'))?.['deleted']).toBe(true);
  });

  it('tombstones what Vitec no longer lists on a resync (AC 14)', async () => {
    seed(fake);
    await start();
    await drainFetchList();

    fake.unlist(OFFICE, 'property', 'OBJ1');
    await event('resync');
    await drainFetchList();
    expect((await item('property', 'OBJ1'))?.['deleted']).toBe(true);
    expect((await item('office', OFFICE))?.['deleted']).toBe(false);
  });

  it('lists page by page and stops after the page Connect names as the last', async () => {
    seed(fake);
    for (let n = 2; n <= 250; n += 1) fake.put(OFFICE, 'property', estate(`OBJ${n}`));
    await start();
    await drainFetchList();

    let held = 0;
    for (let after = 0, more = true; more;) {
      const page = await pull(running.baseUrl, 'property', after);
      held += page.items.length;
      after = page.next_after;
      more = page.has_more;
    }
    expect(held).toBe(250);
    const pages = fake.requests
      .filter((request) => request.path.endsWith(`/Estate/${OFFICE}`))
      .map((request) => request.query.get('paging.pageIndex'));
    expect([...new Set(pages)].sort()).toEqual(['0', '1', '2']);
  });

  it('puts the notification, the Vitec call and the write on one timeline (AC 16)', async () => {
    seed(fake);
    await start();
    await drainFetchList();
    fake.put(OFFICE, 'property', estate('OBJ2'));
    const response = await hook({
      type: 'Estate',
      event: 'Update',
      customerId: OFFICE,
      id: 'OBJ2',
    });
    const { correlation_id } = (await response.json()) as { correlation_id: string };
    await drainFetchList();

    const events = await timelineOf('property', 'OBJ2');
    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining(['webhook.received', 'crm.call', 'entity.written']),
    );
    for (const event of events) expect(event.correlation_id).toBe(correlation_id);
    const call = events.find((event) => event.type === 'crm.call');
    expect(call?.fields).toMatchObject({
      method: 'GET',
      endpoint: `/Advertising/Estate/${OFFICE}/OBJ2`,
      status: 200,
    });
    expect(typeof call?.fields['duration_ms']).toBe('number');
    expect(events.find((event) => event.type === 'webhook.received')?.fields).toMatchObject({
      outcome: 'queued',
      event: 'webhook',
      response: 202,
      // What Vitec sent, kept whole for as long as the log keeps events (question 63).
      body: { type: 'Estate', event: 'Update', customerId: OFFICE, id: 'OBJ2' },
    });
  });

  it('blocks an office at the first 403, and only the office check asks about it again (question 161 a)', async () => {
    seed(fake);
    await start();
    await drainFetchList();
    fake.forbid(OFFICE);
    fake.put(OFFICE, 'property', estate('OBJ2'));
    fake.requests.length = 0;
    await notify('OBJ2');
    await drainFetchList();
    expect(fetchesOf('OBJ2')).toBe(1);
    // The public detail counts; the office is named aside, for the alerts (question 62).
    const offices = (await health())['vitec.offices'];
    expect(offices).toMatchObject({
      ok: false,
      detail: expect.stringContaining('1 office(s) refused by Vitec'),
    });
    expect(offices?.names?.[0]).toContain(OFFICE);

    // Nothing more is asked for the office: a new notification waits, parked.
    await notify('OBJ3');
    await drainFetchList();
    expect(fetchesOf('OBJ3')).toBe(0);
    expect(await store.depth()).toBe(2);

    // The office check at the next tick is the one call that asks: the id's own list, refused, so
    // no office groups. The office stays blocked, and later ticks within the day ask nothing.
    await runSchedules();
    await drainFetchList();
    await runSchedules();
    await drainFetchList();
    expect(fake.requests.map((request) => request.path)).toEqual([
      `/Advertising/Estate/${OFFICE}/OBJ2`,
      `/Advertising/Office/${OFFICE}`,
    ]);
    expect((await health())['vitec.offices']?.ok).toBe(false);

    // Vitec answers again: the next check unblocks the office and loads everything of it again,
    // the parked records included.
    fake.allow(OFFICE);
    fake.put(OFFICE, 'property', estate('OBJ3'));
    await vitecAdmin.act('check_offices', { connection: CONNECTION }, [await connection()]);
    await runSchedules();
    expect((await health())['vitec.offices']?.ok).toBe(true);
    await drainFetchList();
    expect(await item('property', 'OBJ2')).toBeDefined();
    expect(await item('property', 'OBJ3')).toBeDefined();
    const types = (await timelineOf('property', 'OBJ2')).map((event) => event.type);
    expect(types).toContain('entity.written');
    const told = (await queryEvents({ connectionId: CONNECTION })).map((row) => row.type);
    expect(told.filter((type) => type === 'office.blocked')).toHaveLength(1);
    expect(told).toContain('office.unblocked');
  });

  it('holds every other fetch of the login until the office check has run, and finishes a load it cut short', async () => {
    seed(fake);
    fake.put('M2', 'office', { id: 'M2', customerId: 'M2', name: 'Kontor 2', changedAt: CHANGED });
    fake.put('G1', 'office', { id: OFFICE, customerId: OFFICE, changedAt: CHANGED });
    fake.put('G1', 'office', { id: 'M2', customerId: 'M2', changedAt: CHANGED });
    await start(JSON.stringify({ username: USERNAME, password: PASSWORD, customer_id: 'G1' }));
    await drainFetchList();
    const fetched = (path: string): number =>
      fake.requests.filter((request) => request.path === path).length;

    // A refusal for one office holds the other office's notification too.
    fake.forbid(OFFICE);
    fake.put(OFFICE, 'property', estate('OBJ2'));
    fake.put('M2', 'property', estate('OBJ3', 'M2'));
    await notify('OBJ2');
    await drainFetchList();
    await hook({ type: 'Estate', event: 'Update', customerId: 'M2', id: 'OBJ3' });
    await drainFetchList();
    expect(fetched('/Advertising/Estate/M2/OBJ3')).toBe(0);

    // The check finds only the one office refused: it stays blocked, the hold ends.
    await runSchedules();
    await drainFetchList();
    expect(await item('property', 'OBJ3')).toBeDefined();
    expect(await item('property', 'OBJ2')).toBeUndefined();
    expect((await store.blockedOffices()).map((office) => office.officeId)).toEqual([OFFICE]);

    // A resync meets a newly refused office first: the hold stops it, and the check finishes the
    // load of the office that still reads.
    fake.allow(OFFICE);
    await vitecAdmin.act('check_offices', { connection: CONNECTION }, [await connection()]);
    await runSchedules();
    await drainFetchList();
    expect(await store.blockedOffices()).toEqual([]);
    fake.forbid(OFFICE);
    fake.put('M2', 'property', estate('OBJ4', 'M2'));
    fake.requests.length = 0;
    await event('resync');
    expect(fake.requests.map((request) => request.path)).toEqual([`/Advertising/Office/${OFFICE}`]);
    await runSchedules();
    await drainFetchList();
    expect(await item('property', 'OBJ4')).toBeDefined();
  });

  it('pauses a connection after five failures in a row and resumes it with a probe', async () => {
    seed(fake);
    await start();
    await drainFetchList();
    const ids = ['OBJ2', 'OBJ3', 'OBJ4', 'OBJ5', 'OBJ6', 'OBJ7', 'OBJ8'];
    for (const id of ids) fake.put(OFFICE, 'property', estate(id));
    fake.failNext(100);
    const before = fake.requests.length;
    for (const id of ids) await notify(id);
    await drainFetchList();
    expect(fake.requests.length - before).toBeLessThanOrEqual(5);
    const paused = (await health())['vitec.connect'];
    expect(paused).toMatchObject({
      ok: false,
      detail: expect.stringContaining('1 connection(s) paused'),
    });
    expect(paused?.names?.[0]).toContain(CONNECTION);

    // The pause runs out and Vitec is back: the probe fetches go through, and the rest follow.
    fake.failNext(0);
    await store.setState(CONNECTION, 'paused_until', new Date(0).toISOString());
    await store.expedite();
    await runSchedules();
    await drainFetchList();
    expect((await health())['vitec.connect']?.ok).toBe(true);
    for (const id of ids) expect(await item('property', id)).toBeDefined();
    const types = (await queryEvents({ connectionId: CONNECTION })).map((row) => row.type);
    expect(types).toContain('connection.paused');
    expect(types).toContain('connection.resumed');
    const pausedEvent = (await queryEvents({ connectionId: CONNECTION })).find(
      (row) => row.type === 'connection.paused',
    );
    expect(typeof pausedEvent?.fields['failures']).toBe('number');
    expect(pausedEvent?.fields['detail']).toBeTruthy();
  });

  it('keeps the start of a broken answer and fetches the record at the next try', async () => {
    seed(fake);
    await start();
    await drainFetchList();
    fake.put(OFFICE, 'property', estate('OBJ2'));
    fake.brokenNext(1);
    await notify('OBJ2');
    await drainFetchList();
    expect(await item('property', 'OBJ2')).toBeUndefined();
    const call = (await timelineOf('property', 'OBJ2')).find(
      (event) => event.type === 'crm.call' && event.fields['error'],
    );
    expect(String(call?.fields['error'])).toContain('broken JSON');
    expect(String(call?.fields['error'])).toContain('custo');
    await store.expedite();
    await drainFetchList();
    expect(await item('property', 'OBJ2')).toBeDefined();
  });

  it('honours Retry-After and keeps under the speed limit', async () => {
    seed(fake);
    await start();
    await drainFetchList();
    fake.put(OFFICE, 'property', estate('OBJ2'));
    fake.retryAfterNext(1);
    await notify('OBJ2');
    await drainFetchList();
    const heldAt = Date.now();
    await store.expedite();
    await drainFetchList();
    expect(Date.now() - heldAt).toBeGreaterThanOrEqual(900);
    expect(await item('property', 'OBJ2')).toBeDefined();

    const limit = process.env['VITEC_REQUESTS_PER_SECOND'];
    process.env['VITEC_REQUESTS_PER_SECOND'] = '4';
    try {
      const ids = ['OBJ3', 'OBJ4', 'OBJ5', 'OBJ6', 'OBJ7', 'OBJ8', 'OBJ9', 'OBJ10'];
      for (const id of ids) fake.put(OFFICE, 'property', estate(id));
      const startedAt = Date.now();
      for (const id of ids) await notify(id);
      await drainFetchList();
      expect(Date.now() - startedAt).toBeGreaterThanOrEqual(1500);
      expect(await item('property', 'OBJ10')).toBeDefined();
    } finally {
      process.env['VITEC_REQUESTS_PER_SECOND'] = limit;
    }
  });

  it('probes a typed login per office before it is saved, and loads with that login (AC 42)', async () => {
    seed(fake);
    await start();
    const probe = required(vitecAdmin.probe, 'probe');
    const refused = await probe(JSON.stringify({ username: USERNAME, password: 'wrong' }), [
      OFFICE,
    ]);
    expect(refused.ok).toBe(false);
    expect(refused.detail).toContain(OFFICE);
    const accepted = await probe(credentials, [OFFICE]);
    expect(accepted.ok).toBe(true);
    expect(accepted.detail).toContain('Vitec answers');
    expect(
      await probe(JSON.stringify({ username: USERNAME, password: PASSWORD }), []),
    ).toMatchObject({ ok: false, detail: expect.stringContaining('customer or group id') });

    // The worker takes the first load, and the adapter fetches with the saved login.
    await event('connection_added');
    await drainFetchList();
    expect((await pull(running.baseUrl, 'property')).items).toHaveLength(1);
  });

  it('describes its panel as data: the directions and settings, the schedules with run-now actions, the fetch list, one record looked at without writing or fetched again, and its queue (AC 42)', async () => {
    seed(fake);
    await start();
    await drainFetchList();
    const connections = [await connection()];

    expect(vitecAdmin.directions().settings.map((setting) => setting.key)).toContain(
      'VITEC_WEBHOOK_TOKEN',
    );
    const page = await vitecAdmin.panel(connections);
    const url = page.find((section) => section.title === 'Notification URL')?.items?.[0]?.value;
    expect(url).toContain(`/v1/hook/vitec/webhook/${TOKEN}`);
    const schedules = page.find((section) => section.title === 'Connections and schedules');
    expect(schedules?.table?.rows[0]?.cells[0]).toBe(CONNECTION);

    // Look: fetched and mapped, nothing written.
    fake.put(OFFICE, 'property', estate('OBJ9'));
    const looked = await required(vitecAdmin.inspect, 'inspect')(connections[0] as Connection, {
      datatype: 'property',
      remoteId: 'OBJ9',
      officeId: OFFICE,
    });
    expect(looked?.raw).toHaveProperty('id', 'OBJ9');
    expect(looked?.mapped?.data).toHaveProperty('agent_ids');
    expect(await item('property', 'OBJ9')).toBeUndefined();

    // Fetch again, named outright: the worker hands it to the adapter, which fetches and stores it.
    await queueLifecycle(CONNECTION, 'refetch', {
      records: [{ datatype: 'property', remoteId: 'OBJ9', officeId: OFFICE }],
    });
    await running.deliver();
    const queue = required(vitecAdmin.queue, 'queue');
    expect((await queue(connections)).map((row) => row.remoteId)).toContain('OBJ9');
    // Only what waits for the connections asked about, so Flow narrowed to one tenant sees its own.
    expect(await queue([])).toEqual([]);
    await drainFetchList();
    expect(await item('property', 'OBJ9')).toBeDefined();

    // "Catch up now" makes the next tick run it; the connection's section says what the adapter knows.
    const acted = await vitecAdmin.act('catch_up', { connection: CONNECTION }, connections);
    expect(acted.message).toContain('next tick');
    expect(await store.getState(CONNECTION, 'catch_up_at')).toBe('1970-01-01T00:00:00.000Z');
    expect(vitecAdmin.credentials.map((field) => field.label)).toContain('Connect username');
    const own = await vitecAdmin.connection?.(connections[0] as Connection);
    expect(own?.map((section) => section.title)).toContain('What Vitec knows');
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

  it('loads an office that joined the group “Webbplats” without a new seq for the others (AC 14)', async () => {
    seed(fake);
    fake.put('M2', 'office', { id: 'M2', customerId: 'M2', name: 'Kontor 2', changedAt: CHANGED });
    fake.put('M2', 'property', estate('OBJ2', 'M2'));
    fake.put('G1', 'office', { id: OFFICE, customerId: OFFICE, changedAt: CHANGED });
    fake.put('G1', 'office', { id: 'M2', customerId: 'M2', changedAt: CHANGED });
    fake.setGroups('G1', [{ id: 'OG1', name: 'Webbplats', offices: [{ id: OFFICE }] }]);
    await start(JSON.stringify({ username: USERNAME, password: PASSWORD, customer_id: 'G1' }));
    await drainFetchList();
    const first = await item('property', 'OBJ1');
    expect(first?.['deleted']).toBe(false);
    expect(await item('property', 'OBJ2')).toBeUndefined();

    fake.setGroups('G1', [
      { id: 'OG1', name: 'Webbplats', offices: [{ id: OFFICE }, { id: 'M2' }] },
    ]);
    await vitecAdmin.act('check_offices', { connection: CONNECTION }, [await connection()]);
    fake.requests.length = 0;
    await runSchedules();
    await drainFetchList();

    expect((await item('property', 'OBJ2'))?.['office_id']).toBe('M2');
    expect((await item('property', 'OBJ1'))?.['seq']).toBe(first?.['seq']);
    // The first office was read by the check and nothing of it was listed or fetched again.
    const ofFirst = fake.requests.filter((request) => request.path.includes(`/${OFFICE}`));
    expect(ofFirst.map((request) => request.path)).toEqual([
      `/Advertising/Office/${OFFICE}/${OFFICE}`,
    ]);
  });

  it('lists the offices behind a group id and reads each one, naming the ones this login may not read', async () => {
    // A group lists offices of two customers; the login may read one of them and not the group G9.
    fake.put('G1', 'office', { id: 'FIR1', customerId: 'M1', changedAt: CHANGED });
    fake.put('G1', 'office', { id: 'FIR2', customerId: 'M2', changedAt: CHANGED });
    fake.put('M1', 'office', { id: 'FIR1', customerId: 'M1', name: 'Kontor 1' });
    fake.put('M2', 'office', { id: 'FIR2', customerId: 'M2', name: 'Kontor 2' });
    fake.forbid('M2');
    fake.forbid('G9');

    const auth = { username: USERNAME, password: PASSWORD, environment: 'live' as const };
    const check = await checkOffices(CONNECTION, auth, auth, ['G1', 'G9']);

    expect(check.ids).toEqual([
      {
        id: 'G1',
        error: null,
        refusedSince: null,
        groups: [],
        groupsError: null,
        offices: [
          {
            customerId: 'M1',
            officeId: 'FIR1',
            name: 'Kontor 1',
            readable: true,
            detail: null,
            refusedSince: null,
          },
          {
            customerId: 'M2',
            officeId: 'FIR2',
            name: null,
            readable: false,
            detail: 'Vitec refuses this login',
            refusedSince: check.at,
          },
        ],
      },
      {
        id: 'G9',
        error: 'Vitec refuses this login',
        refusedSince: check.at,
        groups: [],
        groupsError: null,
        offices: [],
      },
    ]);
    // Only the office that reads is synced, nothing but reads went to Vitec, and the refused id
    // was not asked for its groups (question 161 a).
    expect(check).toMatchObject({ offices: ['M1'], source: 'all' });
    expect(fake.requests.map((request) => request.path)).toEqual([
      '/Advertising/Office/G1',
      '/Advertising/Office/M1/FIR1',
      '/Advertising/Office/M2/FIR2',
      '/CRM/Officegroups/G1',
      '/Advertising/Office/G9',
    ]);
    expect(fake.forms).toHaveLength(0);
    expect(await lastCheck(CONNECTION)).toEqual(check);
  });

  it('takes each office’s customer id from the office itself, and never syncs a group id', async () => {
    // The group's list rows leave the customer id out; each office's own record names it.
    fake.put('G1', 'office', {
      id: 'FIR1',
      customerId: 'M1',
      name: 'Kontor 1',
      changedAt: CHANGED,
    });
    fake.put('G1', 'office', {
      id: 'FIR2',
      customerId: 'M2',
      name: 'Kontor 2',
      changedAt: CHANGED,
    });
    fake.bareRows('G1');
    // An answer saved before that names the group itself as an office (typed before 156 a).
    const saved = { at: CHANGED, ids: [], offices: ['G1'], source: 'kept' };
    await store.setState(CONNECTION, 'offices_check', JSON.stringify(saved));
    expect((await lastCheck(CONNECTION))?.offices).toEqual([]);

    const auth = { username: USERNAME, password: PASSWORD, environment: 'live' as const };
    const check = await checkOffices(CONNECTION, auth, auth, ['G1']);
    expect(check).toMatchObject({ offices: ['M1', 'M2'], source: 'all' });
    expect(check.ids[0]?.offices.map((office) => office.customerId)).toEqual(['M1', 'M2']);

    // Vitec does not answer: what is kept is the offices, never the group.
    fake.failNext(100);
    await store.setState(CONNECTION, 'offices_check', JSON.stringify(saved));
    expect((await checkOffices(CONNECTION, auth, auth, ['G1'])).offices).toEqual([]);
  });

  it('uses every office when there is no group “Webbplats”, when it holds none of them, or when the login may not read the groups', async () => {
    fake.put('G1', 'office', { id: 'M1', customerId: 'M1', changedAt: CHANGED });
    fake.put('G1', 'office', { id: 'M2', customerId: 'M2', changedAt: CHANGED });
    fake.put('M1', 'office', { id: 'M1', customerId: 'M1', name: 'Kontor 1' });
    fake.put('M2', 'office', { id: 'M2', customerId: 'M2', name: 'Kontor 2' });
    const auth = { username: USERNAME, password: PASSWORD, environment: 'live' as const };
    const check = (): Promise<{ offices: string[]; source: string }> =>
      checkOffices(CONNECTION, auth, auth, ['G1']);

    expect(await check()).toMatchObject({ offices: ['M1', 'M2'], source: 'all' });

    fake.setGroups('G1', [{ id: 'OG1', name: 'Webbplats', offices: [{ id: 'M9' }] }]);
    expect(await check()).toMatchObject({ offices: ['M1', 'M2'], source: 'all' });

    fake.setGroups('G1', [{ id: 'OG1', name: ' WEBBPLATS ', offices: [{ id: 'M2' }] }]);
    expect(await check()).toMatchObject({ offices: ['M2'], source: 'group' });

    fake.forbidGroups('G1');
    const refused = await checkOffices(CONNECTION, auth, auth, ['G1']);
    expect(refused).toMatchObject({ offices: ['M1', 'M2'], source: 'all' });
    expect(refused.ids[0]?.groupsError).toBe('Vitec refuses this login its office groups');
  });

  it('syncs the offices of the group “Webbplats” behind the login’s id, takes an office that left off the sites, and keeps them when Vitec does not answer', async () => {
    seed(fake);
    fake.put('M2', 'office', { id: 'M2', customerId: 'M2', name: 'Kontor 2', changedAt: CHANGED });
    fake.put('M2', 'property', estate('OBJ2', 'M2'));
    fake.put('G1', 'office', { id: OFFICE, customerId: OFFICE, changedAt: CHANGED });
    fake.put('G1', 'office', { id: 'M2', customerId: 'M2', changedAt: CHANGED });
    fake.setGroups('G1', [
      { id: 'OG1', name: 'Webbplats', offices: [{ id: OFFICE }] },
      { id: 'OG2', name: 'Övrigt', offices: [{ id: 'M2' }] },
    ]);
    const login = JSON.stringify({ username: USERNAME, password: PASSWORD, customer_id: 'G1' });
    await start(login);
    await drainFetchList();

    expect(await lastCheck(CONNECTION)).toMatchObject({ offices: [OFFICE], source: 'group' });
    expect((await item('property', 'OBJ1'))?.['deleted']).toBe(false);
    expect(await item('property', 'OBJ2')).toBeUndefined();
    const own = async (): Promise<AdminSection | undefined> =>
      (await vitecAdmin.connection?.(await connection()))?.find(
        (section) => section.title === 'Offices Vitec lists',
      );
    expect((await own())?.items?.[1]?.value).toBe('Webbplats (1), Övrigt (1)');

    // The brokerage moves the website to the other office; "Check offices now" acts on it.
    fake.setGroups('G1', [{ id: 'OG1', name: 'Webbplats', offices: [{ id: 'M2' }] }]);
    await vitecAdmin.act('check_offices', { connection: CONNECTION }, [await connection()]);
    await runSchedules();
    await drainFetchList();
    expect(await lastCheck(CONNECTION)).toMatchObject({ offices: ['M2'], source: 'group' });
    expect((await item('property', 'OBJ1'))?.['deleted']).toBe(true);
    expect((await item('office', OFFICE))?.['deleted']).toBe(true);
    expect((await item('property', 'OBJ2'))?.['deleted']).toBe(false);
    // Told once, for the super admin's notifications.
    const takenOff = (await queryEvents({ connectionId: CONNECTION })).filter(
      (row) => row.type === 'office.taken_off',
    );
    expect(takenOff.map((row) => row.fields)).toEqual([
      {
        office_id: OFFICE,
        office_name: 'Kontor 1',
        reason: 'it is no longer in the office group Webbplats in Vitec',
      },
    ]);

    // Vitec does not answer: the offices stay as they were, and the check is due within the hour.
    await vitecAdmin.act('check_offices', { connection: CONNECTION }, [await connection()]);
    fake.failNext(1);
    await runSchedules();
    await drainFetchList();
    expect(await lastCheck(CONNECTION)).toMatchObject({ offices: ['M2'], source: 'kept' });
    expect((await item('property', 'OBJ2'))?.['deleted']).toBe(false);
    const due = new Date((await store.getState(CONNECTION, 'offices_check_at')) ?? 0).getTime();
    expect(Date.now() - due).toBeGreaterThan(22 * 3_600_000);
  });

  it('ignores offices typed on the connection, and reloads Vitec’s choice when the engine empties the list', async () => {
    seed(fake);
    fake.put('M2', 'office', { id: 'M2', customerId: 'M2', name: 'Kontor 2', changedAt: CHANGED });
    fake.put('M2', 'property', estate('OBJ2', 'M2'));
    fake.put('G1', 'office', { id: OFFICE, customerId: OFFICE, changedAt: CHANGED });
    fake.put('G1', 'office', { id: 'M2', customerId: 'M2', changedAt: CHANGED });
    fake.setGroups('G1', [{ id: 'OG1', name: 'Webbplats', offices: [{ id: 'M2' }] }]);
    const login = JSON.stringify({ username: USERNAME, password: PASSWORD, customer_id: 'G1' });
    // A list typed before the field went away: it neither picks offices nor keeps records out.
    running = await harness({
      adapters: [vitecAdapter],
      connections: [
        { id: CONNECTION, provider: 'vitec', credentials: login, licensedOffices: ['G1'] },
      ],
    });
    await runSchedules();
    await drainFetchList();
    expect(await lastCheck(CONNECTION)).toMatchObject({ offices: ['M2'], source: 'group' });
    const first = await item('property', 'OBJ2');
    expect(first?.['deleted']).toBe(false);
    expect(await item('property', 'OBJ1')).toBeUndefined();

    // The save stores the list empty; the engine's event makes the adapter ask Vitec again.
    await running.connection({
      id: CONNECTION,
      provider: 'vitec',
      credentials: login,
      licensedOffices: [],
    });
    await event('offices_removed', ['G1']);
    await drainFetchList();
    expect((await item('property', 'OBJ2'))?.['seq']).toBe(first?.['seq']);
    expect((await item('property', 'OBJ2'))?.['deleted']).toBe(false);
    expect(fake.forms).toHaveLength(0);
  });

  it('keeps an office Vitec refuses for a day of grace, then takes it off, the whole id too; a refusal at a fetch checks within a minute', async () => {
    seed(fake);
    fake.put('M2', 'office', { id: 'M2', customerId: 'M2', name: 'Kontor 2', changedAt: CHANGED });
    fake.put('M2', 'property', estate('OBJ2', 'M2'));
    fake.put('G1', 'office', { id: OFFICE, customerId: OFFICE, changedAt: CHANGED });
    fake.put('G1', 'office', { id: 'M2', customerId: 'M2', changedAt: CHANGED });
    await start(JSON.stringify({ username: USERNAME, password: PASSWORD, customer_id: 'G1' }));
    await drainFetchList();
    expect(await lastCheck(CONNECTION)).toMatchObject({ offices: [OFFICE, 'M2'], source: 'all' });
    const check = async (): Promise<void> => {
      await vitecAdmin.act('check_offices', { connection: CONNECTION }, [await connection()]);
      await runSchedules();
      await drainFetchList();
    };
    /** Move the first refusal back in time, as a day's checks would find it. */
    const age = async (hours: number): Promise<void> => {
      const stored = JSON.parse((await store.getState(CONNECTION, 'offices_check')) ?? '{}');
      const since = new Date(Date.now() - hours * 3_600_000).toISOString();
      for (const id of stored.ids) {
        if (id.refusedSince) id.refusedSince = since;
        for (const office of id.offices) if (office.refusedSince) office.refusedSince = since;
      }
      await store.setState(CONNECTION, 'offices_check', JSON.stringify(stored));
    };
    const cell = async (row: number): Promise<unknown> =>
      (await vitecAdmin.connection?.(await connection()))?.find(
        (section) => section.title === 'Offices Vitec lists',
      )?.table?.rows[row]?.cells[3];

    // Vitec refuses one office: still synced, and the row says since when and what follows.
    fake.forbid('M2');
    await check();
    expect(await lastCheck(CONNECTION)).toMatchObject({ offices: [OFFICE, 'M2'], source: 'all' });
    expect((await item('property', 'OBJ2'))?.['deleted']).toBe(false);
    expect(await cell(1)).toMatchObject({
      text: expect.stringContaining('taken off the sites if still refused at the next daily check'),
      state: 'warn',
    });

    // The refusal has stood a day: the office goes, with everything of it.
    await age(25);
    await check();
    expect(await lastCheck(CONNECTION)).toMatchObject({ offices: [OFFICE], source: 'all' });
    expect((await item('property', 'OBJ2'))?.['deleted']).toBe(true);
    expect((await item('office', 'M2'))?.['deleted']).toBe(true);
    expect(await cell(1)).toMatchObject({ state: 'bad' });

    // The whole id is refused (a cancelled subscription): a day of grace, then every office goes.
    fake.forbid('G1');
    await check();
    expect(await lastCheck(CONNECTION)).toMatchObject({ offices: [OFFICE] });
    expect((await item('property', 'OBJ1'))?.['deleted']).toBe(false);
    await age(25);
    await check();
    expect(await lastCheck(CONNECTION)).toMatchObject({ offices: [] });
    expect((await item('property', 'OBJ1'))?.['deleted']).toBe(true);
    expect((await item('office', OFFICE))?.['deleted']).toBe(true);
    expect(fake.forms).toHaveLength(0);

    // For the super admin: each office once as it went, the refused login once as it began.
    const events = await queryEvents({ connectionId: CONNECTION });
    expect(
      events.filter((row) => row.type === 'office.taken_off').map((row) => row.fields),
    ).toEqual(
      expect.arrayContaining([
        // Named as Vitec last gave the name, although Vitec refused to read the office since.
        {
          office_id: 'M2',
          office_name: 'Kontor 2',
          reason: 'Vitec still refused it at the next daily check',
        },
        {
          office_id: OFFICE,
          office_name: 'Kontor 1',
          reason: 'Vitec still refused it at the next daily check',
        },
      ]),
    );
    const refused = events.filter((row) => row.type === 'login.refused');
    expect(refused).toHaveLength(1);
    expect(refused[0]?.fields['detail']).toBe('Vitec refuses this login for G1');
  });

  it('checks the offices at the next tick after a refusal at a fetch', async () => {
    seed(fake);
    await start();
    await drainFetchList();
    fake.forbid(OFFICE);
    fake.put(OFFICE, 'property', estate('OBJ2'));
    await notify('OBJ2');
    await drainFetchList();
    expect(await store.getState(CONNECTION, 'offices_check_at')).toBe(new Date(0).toISOString());
    await runSchedules();
    const last = await lastCheck(CONNECTION);
    expect(last?.ids[0]?.refusedSince).toBeTruthy();
    expect(last).toMatchObject({ offices: [OFFICE] });
  });

  it('checks the offices at start and once a day, and "Check offices now" checks at the next tick', async () => {
    seed(fake);
    await start();
    const first = await lastCheck(CONNECTION);
    expect(first?.ids[0]?.offices).toEqual([
      {
        customerId: OFFICE,
        officeId: OFFICE,
        name: 'Kontor 1',
        readable: true,
        detail: null,
        refusedSince: null,
      },
    ]);
    expect(first).toMatchObject({ offices: [OFFICE], source: 'all' });

    // Within the day, a tick does not ask again.
    const listed = (): number =>
      fake.requests.filter((request) => request.path === `/CRM/Officegroups/${OFFICE}`).length;
    fake.requests.length = 0;
    await runSchedules();
    expect(listed()).toBe(0);

    // The button makes the next tick ask; the tenant's page shows what Vitec answered.
    const connections = [await connection()];
    const acted = await vitecAdmin.act('check_offices', { connection: CONNECTION }, connections);
    expect(acted.message).toContain('next tick');
    await runSchedules();
    expect(listed()).toBe(1);
    const own = await vitecAdmin.connection?.(connections[0] as Connection);
    const section = own?.find((candidate) => candidate.title === 'Offices Vitec lists');
    expect(section?.table?.rows[0]?.cells).toEqual([
      OFFICE,
      `${OFFICE} (${OFFICE})`,
      'Kontor 1',
      { text: 'yes', state: 'ok' },
      true,
    ]);
    expect(section?.actions?.[0]?.help).toBeTruthy();
  });
});
