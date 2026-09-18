// The Vitec adapter against the real engine and a stand-in Connect (test/connect.ts): webhooks,
// the fetch list, both schedules, licensing by office and the health checks. Vitec's behaviour
// beyond its documentation waits for a test account on staging (strategy §9, Phase 6).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminLogin, harness, pull, ADMIN_SECRET, type Harness } from '../../acceptance/harness.js';
import { drainFetchList, runSchedules, vitecAdapter } from './index.js';
import * as store from './store.js';
import { PASSWORD, USERNAME, startFakeConnect, type FakeConnect } from './test/connect.js';

const CONNECTION = 'vitec-acme';
const OFFICE = 'M1';
const TOKEN = 'hook-token';
const CHANGED = '2026-09-10T08:00:00.1234567+02:00';

const credentials = JSON.stringify({ username: USERNAME, password: PASSWORD });

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

/** One record's timeline, as the admin API answers it. */
const timelineOf = async (
  datatype: string,
  id: string,
): Promise<{ type: string; fields: Record<string, unknown> }[]> => {
  const response = await fetch(
    `${running.baseUrl}/v1/admin/events?entity=${CONNECTION}/${datatype}/${id}`,
    { headers: { 'x-admin-secret': ADMIN_SECRET } },
  );
  return (
    (await response.json()) as { events: { type: string; fields: Record<string, unknown> }[] }
  ).events;
};

const notify = (id: string): Promise<Response> =>
  hook({ type: 'Estate', event: 'Update', customerId: OFFICE, id });

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
    expect(property?.['data']).toMatchObject({
      id: 'OBJ1',
      office_id: OFFICE,
      agent_ids: ['U1'],
      area_ids: ['A1'],
      association_id: 'F1',
      project_id: 'PR1',
      display: {},
      provider_extras: {},
      // The whole payload, mirrored under snake_case names with the nesting kept.
      primary_agent_id: 'U1',
      address: { street_address: 'Storgatan 1', area: { id: 'A1', name: 'Centrum' } },
      extensions: { housing_cooperative: { association: { id: 'F1' } } },
      changed_at: CHANGED,
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
    expect(await store.isKnown(OFFICE, 'property', 'OBJ1')).toBe(false);
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
    await event({ event: 'resync' });
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

    const timeline = await fetch(
      `${running.baseUrl}/v1/admin/events?entity=${CONNECTION}/property/OBJ2`,
      { headers: { 'x-admin-secret': ADMIN_SECRET } },
    );
    const { events } = (await timeline.json()) as {
      events: { type: string; correlation_id: string | null; fields: Record<string, unknown> }[];
    };
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
    });
  });

  it('blocks an office at the first 403, probes it back and loads it again', async () => {
    seed(fake);
    await start();
    await drainFetchList();
    fake.forbid(OFFICE);
    fake.put(OFFICE, 'property', estate('OBJ2'));
    await notify('OBJ2');
    await drainFetchList();
    expect(fetchesOf('OBJ2')).toBe(1);
    expect((await health())['vitec.offices']).toMatchObject({
      ok: false,
      detail: expect.stringContaining(OFFICE),
    });

    // Nothing more is asked for the office: a new notification waits, parked.
    await notify('OBJ3');
    await drainFetchList();
    expect(fetchesOf('OBJ3')).toBe(0);
    expect(await store.depth()).toBe(2);

    // A probe that is refused again means a longer wait.
    await store.expediteProbe(OFFICE);
    await runSchedules();
    expect((await store.blockedOffices())[0]?.probes).toBe(1);

    // The office is back: one probe, then everything of it again, the parked records included.
    fake.allow(OFFICE);
    fake.put(OFFICE, 'property', estate('OBJ3'));
    await store.expediteProbe(OFFICE);
    await runSchedules();
    expect((await health())['vitec.offices']?.ok).toBe(true);
    await drainFetchList();
    expect(await item('property', 'OBJ2')).toBeDefined();
    expect(await item('property', 'OBJ3')).toBeDefined();
    const types = (await timelineOf('property', 'OBJ2')).map((event) => event.type);
    expect(types).toContain('entity.written');
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
    expect((await health())['vitec.connect']).toMatchObject({
      ok: false,
      detail: expect.stringContaining(CONNECTION),
    });

    // The pause runs out and Vitec is back: the probe fetches go through, and the rest follow.
    fake.failNext(0);
    await store.setState(CONNECTION, 'paused_until', new Date(0).toISOString());
    await store.expedite();
    await runSchedules();
    await drainFetchList();
    expect((await health())['vitec.connect']?.ok).toBe(true);
    for (const id of ids) expect(await item('property', id)).toBeDefined();
    const events = await fetch(`${running.baseUrl}/v1/admin/events?connection=${CONNECTION}`, {
      headers: { 'x-admin-secret': ADMIN_SECRET },
    });
    const types = ((await events.json()) as { events: { type: string }[] }).events.map(
      (event) => event.type,
    );
    expect(types).toContain('connect.paused');
    expect(types).toContain('connect.resumed');
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

  it('has its own admin panel: the fetch list, the schedules, and one record looked at or queued (AC 42)', async () => {
    seed(fake);
    await start();
    await drainFetchList();
    const { cookie, csrf } = await adminLogin(running);
    const post = (path: string, fields: Record<string, string>): Promise<Response> =>
      fetch(`${running.baseUrl}${path}`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ csrf, ...fields }).toString(),
        redirect: 'manual',
      });

    const front = await fetch(`${running.baseUrl}/admin/vitec`, { headers: { cookie } });
    expect(front.status).toBe(200);
    const html = await front.text();
    expect(html).toContain(`/v1/hook/vitec/webhook/${TOKEN}`);
    expect(html).toContain(CONNECTION);

    // Look: fetched and mapped, nothing written.
    fake.put(OFFICE, 'property', estate('OBJ9'));
    const looked = await post('/admin/vitec/fetch', {
      connection: CONNECTION,
      datatype: 'property',
      office: OFFICE,
      id: 'OBJ9',
      action: 'look',
    });
    const seen = await looked.text();
    expect(seen).toContain('street_address');
    expect(seen).toContain('Nothing was written');
    expect(await item('property', 'OBJ9')).toBeUndefined();

    // Queue: the worker fetches and stores it.
    await post('/admin/vitec/fetch', {
      connection: CONNECTION,
      datatype: 'property',
      office: OFFICE,
      id: 'OBJ9',
      action: 'queue',
    });
    await drainFetchList();
    expect(await item('property', 'OBJ9')).toBeDefined();

    // "Catch up now" makes the next tick run it; the connection page shows what the adapter knows.
    expect(
      (await post('/admin/vitec', { action: 'catch_up', connection: CONNECTION })).status,
    ).toBe(303);
    expect(await store.getState(CONNECTION, 'catch_up_at')).toBe('1970-01-01T00:00:00.000Z');
    const page = await fetch(`${running.baseUrl}/admin/connections/${CONNECTION}`, {
      headers: { cookie },
    });
    const shown = await page.text();
    expect(shown).toContain('Connect username');
    expect(shown).toContain('fetch list');
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
});
