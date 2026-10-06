// Vitec's QA environment as a switch on a Vitec connection (question 169 a): a login whose field
// `qa` says yes is read, notified, checked and sent forms at QA's own address, with its own speed
// limit and its own turn at the fetch list, and a live and a QA connection that both sync office
// M1 never share a fetch, a seen id, a comparison or a refusal. A login switched from one system
// to the other takes what the first gave off the sites. Two stand-in Connects play live Vitec and
// QA, each with its own street names.
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  HUMAN_TOKEN,
  TOKEN,
  connectionById,
  harness,
  healthReport,
  pull,
  queryEvents,
  queueLifecycle,
  until,
  type Harness,
} from '../../acceptance/harness.js';
import { drainFetchList, runSchedules, vitecAdapter } from './index.js';
import { vitecAdmin } from './admin/index.js';
import { checkSoon, lastCheck, officesOf } from './offices.js';
import * as connect from './api.js';
import * as store from './store.js';
import { PASSWORD, USERNAME, startFakeConnect, type FakeConnect } from './test/connect.js';
import type { Connection } from '../../engine/adapter-api/index.js';

const OFFICE = 'M1';
const HOOK_TOKEN = 'hook-token';
const LIVE = 'vitec-live';
const QA = 'vitec-qa';
const CHANGED = '2026-09-10T08:00:00.1234567+02:00';

const login = (extra: Record<string, string> = {}): string =>
  JSON.stringify({ username: USERNAME, password: PASSWORD, customer_id: OFFICE, ...extra });

const home = (id: string, street: string): Record<string, unknown> & { id: string } => ({
  id,
  office: { id: OFFICE, customerId: OFFICE },
  primaryAgentId: 'U1',
  secondaryAgentId: null,
  projectId: 'PR1',
  address: { streetAddress: street, area: { id: 'A1', name: 'Centrum' } },
  extensions: { housingCooperative: { association: { id: 'F1' } } },
  changedAt: CHANGED,
});

/** Office M1 with its homes, as one of Vitec's systems publishes it. */
function publish(fake: FakeConnect, street: string, homes: string[]): void {
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
  for (const id of homes) fake.put(OFFICE, 'property', home(id, street));
}

let live: FakeConnect;
let qa: FakeConnect;
let running: Harness;

const connection = async (id: string): Promise<Connection> => {
  const found = await connectionById(id);
  if (!found) throw new Error(`${id} is gone`);
  return found;
};

/** A notification as Vitec sends it, to the live address (`webhook`) or QA's (`qa`). */
const hook = (path: 'webhook' | 'qa', body: Record<string, unknown>): Promise<Response> =>
  fetch(`${running.baseUrl}/v1/hook/vitec/${path}/${HOOK_TOKEN}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const update = (id: string): Record<string, unknown> => ({
  type: 'Estate',
  event: 'Update',
  customerId: OFFICE,
  id,
});

/** One connection's homes as a site pulls them. */
const homesOf = async (connectionId: string): Promise<Record<string, unknown>[]> =>
  (await pull(running.baseUrl, 'property')).items.filter(
    (item) => item['connection_id'] === connectionId,
  );

const homeOf = async (
  connectionId: string,
  id: string,
): Promise<Record<string, unknown> | undefined> =>
  (await homesOf(connectionId)).find((item) => item['remote_id'] === id);

const streetOf = (item: Record<string, unknown> | undefined): unknown =>
  (item?.['raw'] as { address?: { streetAddress?: string } } | undefined)?.address?.streetAddress;

const paths = (fake: FakeConnect): string[] => fake.requests.map((request) => request.path);

/** How many list pages a stand-in Connect has answered. */
const listings = (fake: FakeConnect): number =>
  fake.requests.filter((request) => request.query.has('paging.pageIndex')).length;

/** Make a connection's daily comparison due at the next tick. */
const compareNow = (connectionId: string): Promise<void> =>
  store.setState(connectionId, 'compare_at', new Date(0).toISOString());

beforeEach(async () => {
  live = await startFakeConnect();
  qa = await startFakeConnect();
  process.env['VITEC_BASE_URL'] = live.url;
  connect.pointQaAt(qa.url);
  process.env['VITEC_WEBHOOK_TOKEN'] = HOOK_TOKEN;
  await store.reset();
  publish(live, 'Storgatan 1', ['OBJ1']);
  publish(qa, 'Testgatan 9', ['OBJ1', 'OBJ2']);
  running = await harness({
    adapters: [vitecAdapter],
    connections: [
      { id: LIVE, provider: 'vitec', credentials: login(), licensedOffices: [] },
      { id: QA, provider: 'vitec', credentials: login({ qa: 'yes' }), licensedOffices: [] },
    ],
  });
  // The first tick asks each system for its offices and loads them; the fetches follow.
  await runSchedules();
  await drainFetchList();
});

afterEach(async () => {
  await running.stop();
  await live.close();
  await qa.close();
  connect.pointQaAt(null);
});

describe('Vitec’s QA environment', () => {
  it('reads the switch from the login: yes is QA, anything else live Vitec, and offers just no and yes', () => {
    expect(connect.loginOf(login({ qa: 'yes' }))?.environment).toBe('qa');
    expect(connect.loginOf(login({ qa: ' Yes ' }))?.environment).toBe('qa');
    expect(connect.loginOf(login({ qa: 'no' }))?.environment).toBe('live');
    expect(connect.loginOf(login())?.environment).toBe('live');

    // The tenant page draws the switch from these two values as a tickbox: unticked is live Vitec.
    const offered = vitecAdmin.credentials.find((field) => field.key === 'qa')?.options ?? [];
    expect(offered.map(({ value }) => connect.loginOf(login({ qa: value }))?.environment)).toEqual([
      'live',
      'qa',
    ]);
  });

  it('reads a QA login at QA’s address only, and keeps its homes apart from live Vitec’s with the same office id', async () => {
    const liveHomes = await homesOf(LIVE);
    expect(liveHomes.map((item) => item['remote_id'])).toEqual(['OBJ1']);
    expect(streetOf(liveHomes[0])).toBe('Storgatan 1');

    const qaHomes = await homesOf(QA);
    expect(qaHomes.map((item) => item['remote_id']).sort()).toEqual(['OBJ1', 'OBJ2']);
    expect(qaHomes.map(streetOf)).toEqual(['Testgatan 9', 'Testgatan 9']);
    expect([...liveHomes, ...qaHomes].every((item) => item['deleted'] === false)).toBe(true);

    // Live Vitec was never asked about QA's home, and each system's ids are kept under its office.
    expect(paths(live).some((path) => path.includes('OBJ2'))).toBe(false);
    expect(paths(qa)).toContain(`/Advertising/Estate/${OFFICE}/OBJ2`);
    const qaOffice = { environment: 'qa' as const, officeId: OFFICE };
    const liveOffice = { environment: 'live' as const, officeId: OFFICE };
    expect(await store.isKnown(qaOffice, 'property', 'OBJ2')).toBe(true);
    expect(await store.isKnown(liveOffice, 'property', 'OBJ2')).toBe(false);
  });

  it('compares each system’s list with the ids seen in that system only', async () => {
    // Live Vitec never had OBJ2: its comparison takes nothing off QA's site.
    await compareNow(LIVE);
    await compareNow(QA);
    await runSchedules();
    await drainFetchList();
    expect((await homeOf(QA, 'OBJ2'))?.['deleted']).toBe(false);
    expect((await homeOf(LIVE, 'OBJ1'))?.['deleted']).toBe(false);

    // QA stops listing OBJ1: it leaves QA's site, and live Vitec's OBJ1 stays.
    qa.unlist(OFFICE, 'property', 'OBJ1');
    await compareNow(QA);
    await runSchedules();
    await drainFetchList();
    expect((await homeOf(QA, 'OBJ1'))?.['deleted']).toBe(true);
    expect((await homeOf(LIVE, 'OBJ1'))?.['deleted']).toBe(false);
  });

  it('takes a notification at QA’s address for the QA connection alone: an Update fetches from QA, a Remove takes nothing off live Vitec’s', async () => {
    qa.put(OFFICE, 'property', home('OBJ1', 'Testgatan 10'));
    live.requests.length = 0;
    qa.requests.length = 0;

    expect((await hook('qa', update('OBJ1'))).status).toBe(202);
    await drainFetchList();
    expect(paths(qa)).toEqual([`/Advertising/Estate/${OFFICE}/OBJ1`]);
    expect(paths(live)).toEqual([]);
    expect(streetOf(await homeOf(QA, 'OBJ1'))).toBe('Testgatan 10');
    expect(streetOf(await homeOf(LIVE, 'OBJ1'))).toBe('Storgatan 1');

    await hook('qa', { ...update('OBJ1'), event: 'Remove' });
    await drainFetchList();
    expect((await homeOf(QA, 'OBJ1'))?.['deleted']).toBe(true);
    expect((await homeOf(LIVE, 'OBJ1'))?.['deleted']).toBe(false);

    // The live address still serves live Vitec alone, and each arrival is on its own home's timeline.
    await hook('webhook', update('OBJ1'));
    await drainFetchList();
    expect(paths(live)).toEqual([`/Advertising/Estate/${OFFICE}/OBJ1`]);
    expect(paths(qa)).toEqual([`/Advertising/Estate/${OFFICE}/OBJ1`]);
    const arrivals = async (connectionId: string): Promise<unknown[]> =>
      (await queryEvents({ entity: { connectionId, datatype: 'property', remoteId: 'OBJ1' } }))
        .filter((row) => row.type === 'webhook.received')
        .map((row) => row.fields['path']);
    expect(await arrivals(QA)).toEqual(['/v1/hook/vitec/qa', '/v1/hook/vitec/qa']);
    expect(await arrivals(LIVE)).toEqual(['/v1/hook/vitec/webhook']);
  });

  it('blocks a QA office that Vitec’s QA refuses, while live Vitec’s office of the same id goes on syncing', async () => {
    qa.forbid(OFFICE);
    await hook('qa', update('OBJ2'));
    await drainFetchList();
    expect(await store.blockedOffices()).toMatchObject([{ environment: 'qa', officeId: OFFICE }]);

    live.put(OFFICE, 'property', home('OBJ3', 'Storgatan 3'));
    await hook('webhook', update('OBJ3'));
    await drainFetchList();
    expect(streetOf(await homeOf(LIVE, 'OBJ3'))).toBe('Storgatan 3');

    // Live Vitec's office check reads its own M1, and leaves QA's refusal where it is.
    await store.setState(QA, 'offices_check_at', new Date().toISOString());
    await checkSoon(LIVE);
    await runSchedules();
    expect(await store.blockedOffices()).toMatchObject([{ environment: 'qa', officeId: OFFICE }]);

    // Named with its system among the refused offices.
    const offices = (await healthReport()).checks['vitec.offices'];
    expect(offices?.names).toEqual([expect.stringMatching(/^M1 \(QA\): refused/)]);
    const page = await vitecAdmin.panel([await connection(LIVE), await connection(QA)]);
    const refused = page.find((section) => section.title === 'Refused offices');
    expect(refused?.table?.rows.map((row) => row.cells[0])).toEqual(['M1 (QA)']);
  });

  it('checks a typed QA login at QA’s address, and sends a QA connection’s forms there', async () => {
    live.requests.length = 0;
    qa.requests.length = 0;
    const probe = vitecAdmin.probe;
    if (!probe) throw new Error('the Vitec adapter has no probe');
    expect(await probe(login({ qa: 'yes' }), [])).toMatchObject({
      ok: true,
      detail: expect.stringContaining('M1: Vitec answers'),
    });
    expect(paths(qa)).toEqual([`/Advertising/Office/${OFFICE}`]);
    expect(paths(live)).toEqual([]);

    // A search profile takes both of Connect's calls, with the CRM function group's login.
    const response = await fetch(`${running.baseUrl}/v1/submissions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${TOKEN}`,
        'content-type': 'application/json',
        'x-core-human': HUMAN_TOKEN,
      },
      body: JSON.stringify({
        id: randomUUID(),
        kind: 'search_profile',
        person: {
          first_name: 'Anna',
          last_name: 'Svensson',
          email: 'anna@example.se',
          phone: '0701234567',
        },
        consent: { given: true, at: '2026-10-04T10:00:00Z' },
        record: { datatype: 'property', connection_id: QA, remote_id: 'OBJ1' },
        criteria: {
          object_type: 'apartment',
          rooms_min: 2,
          living_area_min: 75,
          areas: [{ id: 'A1', name: 'Centrum', county_municipality_code: '1280' }],
          county_municipality_code: '1280',
        },
      }),
    });
    expect(await response.json()).toMatchObject({ status: 'delivered' });
    expect(qa.forms.map((form) => form.path)).toEqual([
      '/Contacts/UpdatePerson',
      `/CRM/Contact/${OFFICE}/SearchProfile/Residential/P-1`,
    ]);
    expect(live.forms).toEqual([]);
  });

  it('marks QA on the Vitec page: the second notification address, and its fetch list rows, retried and dropped as QA’s', async () => {
    // The same home fails once in each system, so each waits on the fetch list for its retry.
    qa.failNext(1);
    await hook('qa', update('OBJ1'));
    await drainFetchList();
    live.failNext(1);
    await hook('webhook', update('OBJ1'));
    await drainFetchList();

    const connections = [await connection(LIVE), await connection(QA)];
    const page = await vitecAdmin.panel(connections);
    const items = page.find((section) => section.title === 'Notification URL')?.items ?? [];
    const valueOf = (label: string): unknown => items.find((item) => item.label === label)?.value;
    expect(valueOf('URL')).toContain(`/v1/hook/vitec/webhook/${HOOK_TOKEN}`);
    expect(valueOf('URL for Vitec’s QA')).toContain(`/v1/hook/vitec/qa/${HOOK_TOKEN}`);
    const schedules = page.find((section) => section.title === 'Connections and schedules');
    expect(schedules?.table?.rows.map((row) => row.cells.slice(0, 2))).toEqual([
      [LIVE, OFFICE],
      [QA, OFFICE],
    ]);
    const list = page.find((section) => section.title === 'Fetch list');
    expect(list?.table?.rows.map((row) => row.cells[0]).sort()).toEqual(['M1', 'M1 (QA)']);
    const queue = vitecAdmin.queue;
    if (!queue) throw new Error('the Vitec adapter has no queue');
    expect((await queue(connections)).map((row) => row.connectionId).sort()).toEqual([LIVE, QA]);
    // Asked about one connection, the queue lists only what waits in that connection's system.
    const waitingFor = async (id: string): Promise<unknown[]> =>
      (await queue([await connection(id)])).map((row) => row.connectionId);
    expect(await waitingFor(LIVE)).toEqual([LIVE]);
    expect(await waitingFor(QA)).toEqual([QA]);

    // Retry and Drop carry the system: they touch QA's row and leave live Vitec's alone.
    const qaRow = { office: OFFICE, environment: 'qa', datatype: 'property', id: 'OBJ1' };
    await vitecAdmin.act('retry', qaRow, connections);
    const attempts = (await store.entries()).map((entry) => [entry.environment, entry.attempts]);
    expect(attempts.sort()).toEqual([
      ['live', 1],
      ['qa', 0],
    ]);
    const dropped = await vitecAdmin.act('drop', qaRow, connections);
    expect(dropped.message).toContain('M1 (QA)');
    expect((await store.entries()).map((entry) => entry.environment)).toEqual(['live']);
  });

  it('takes everything QA gave off the sites when a saved login is switched to live Vitec, and loads live Vitec’s offices in its place', async () => {
    // A check saved before QA existed names no system: it was live Vitec's, so nothing switches.
    const saved = JSON.parse((await store.getState(LIVE, 'offices_check')) ?? '{}') as Record<
      string,
      unknown
    >;
    delete saved['environment'];
    await store.setState(LIVE, 'offices_check', JSON.stringify(saved));
    expect((await lastCheck(LIVE))?.environment).toBe('live');
    expect((await lastCheck(QA))?.environment).toBe('qa');
    // QA refuses its M1 first, so that QA's refusal is on the books when the login switches.
    qa.forbid(OFFICE);
    await hook('qa', update('OBJ2'));
    await drainFetchList();
    expect(await store.blockedOffices()).toHaveLength(1);

    await running.connection({ id: QA, provider: 'vitec', credentials: login({ qa: 'no' }) });
    // Until the worker checks the switched login again, it syncs no office: a Manual sync or a
    // "Fetch again" meanwhile asks live Vitec nothing about the offices QA gave.
    expect(await officesOf(await connection(QA))).toEqual([]);
    // An office change for the connection, arriving with the tick, waits for the tick's turn.
    await queueLifecycle(QA, 'connection_added');
    await Promise.all([runSchedules(), running.deliver()]);
    await drainFetchList();
    expect(await officesOf(await connection(QA))).toEqual([OFFICE]);
    expect((await homeOf(QA, 'OBJ2'))?.['deleted']).toBe(true);
    expect((await homeOf(QA, 'OBJ1'))?.['deleted']).toBe(false);
    expect(streetOf(await homeOf(QA, 'OBJ1'))).toBe('Storgatan 1');
    expect((await lastCheck(QA))?.environment).toBe('live');
    // QA's refusal guards nothing any more and is dropped; live Vitec's M1 was never refused.
    expect(await store.blockedOffices()).toEqual([]);
    const takenOff = async (connectionId: string): Promise<unknown[]> =>
      (await queryEvents({ type: 'office.taken_off', connectionId })).map(
        (row) => row.fields['reason'],
      );
    expect(await takenOff(QA)).toEqual(['the login was switched to live Vitec']);
    expect(await takenOff(LIVE)).toEqual([]);
  });

  it('runs the start-up round again only for a connection that failed it, so a QA that is down never makes live Vitec list everything each minute', async () => {
    qa.failNext(1_000);
    live.requests.length = 0;
    await running.restart();
    // The tick of the start, and one more: live Vitec listed everything once, QA failed twice.
    await runSchedules();
    const listed = listings(live);
    expect(listed).toBeGreaterThan(0);
    const failures = async (): Promise<number> =>
      (await queryEvents({ type: 'schedule.failed', connectionId: QA })).length;
    const failed = await failures();
    expect(failed).toBeGreaterThan(0);
    // QA's offices were checked once, at the start. A retry leaves the check to its own time,
    // since the check calls every office of the login, refused ones too.
    const checked = (await lastCheck(QA))?.at;

    await runSchedules();
    expect(listings(live)).toBe(listed);
    expect(await failures()).toBe(failed + 1);
    expect((await lastCheck(QA))?.at).toBe(checked);
  });

  // Last, because the hold outlasts the test, and no later test should wait it out.
  it('holds back only the system whose Connect asked for it with Retry-After', async () => {
    qa.retryAfterNext(3);
    await hook('qa', update('OBJ2'));
    await drainFetchList();
    // QA asked Core to wait three seconds: QA's next record, taken off the list, waits for that.
    qa.put(OFFICE, 'property', home('OBJ1', 'Testgatan 11'));
    await hook('qa', update('OBJ1'));
    const waiting = drainFetchList();
    await until(
      async () => !(await store.entries()).some((entry) => entry.remoteId === 'OBJ1'),
      'QA’s record taken off the list',
    );

    // Live Vitec's record arrives meanwhile, and is fetched at once.
    live.put(OFFICE, 'property', home('OBJ1', 'Storgatan 11'));
    const startedAt = Date.now();
    await hook('webhook', update('OBJ1'));
    await until(
      async () => streetOf(await homeOf(LIVE, 'OBJ1')) === 'Storgatan 11',
      'live Vitec’s record',
      2500,
    );
    expect(Date.now() - startedAt).toBeLessThan(2000);
    expect(streetOf(await homeOf(QA, 'OBJ1'))).toBe('Testgatan 9');
    await waiting;
    expect(streetOf(await homeOf(QA, 'OBJ1'))).toBe('Testgatan 11');
  });
});
