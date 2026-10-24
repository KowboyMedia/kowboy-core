// AC 32: near-instant under normal load. Vitec's notifications arrive under one a second, each for
// another brokerage, while a third brokerage's 30,000 records load; from a notification received
// to its site's bell takes under 2 s, p95, less the time Vitec took to answer. Core runs at its
// live speed limit to Vitec (10 calls a second, 5 at once), which is where a notification could
// wait behind a load: the work Core does itself per notification is a few milliseconds.
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { harness, queryEvents, queueLifecycle, until, type Harness } from './harness.js';
import { addSubscriber, createTenant, upsertConnection } from '../engine/storage/connections.js';
import { deliverLifecycleEvents } from '../engine/lifecycle.js';
import { db } from '../engine/storage/db.js';
import { vitecAdapter } from '../adapters/vitec/index.js';
import * as store from '../adapters/vitec/store.js';
import * as connect from '../adapters/vitec/api.js';
import {
  PASSWORD,
  USERNAME,
  startFakeConnect,
  type FakeConnect,
} from '../adapters/vitec/test/connect.js';

const TOKEN = 'hook-token';
const CHANGED = '2026-09-10T08:00:00.1234567+02:00';
/** The brokerages notified, one notification each, so every bell is the first after a quiet spell. */
const SITES = 20;
/** Under one notification a second. */
const EVERY_MS = 1_200;
const LOAD = 30_000;
const BIG = 'M900';

/** One office with an agent, an area, a project and an association, as Connect publishes them. */
function office(fake: FakeConnect, id: string): void {
  fake.put(id, 'office', { id, customerId: id, name: `Kontor ${id}`, changedAt: CHANGED });
  fake.put(id, 'agent', {
    id: `U-${id}`,
    name: 'Anna',
    offices: [{ id, customerId: id, orderNumber: 1 }],
    changedAt: CHANGED,
  });
  fake.put(id, 'area', { id: `A-${id}`, name: 'Centrum', changedAt: CHANGED });
  fake.put(id, 'association', { id: `F-${id}`, name: 'Brf Solen', changedAt: CHANGED });
  fake.put(id, 'project', {
    id: `PR-${id}`,
    office: { id, customerId: id },
    primaryAgentId: `U-${id}`,
    address: { area: { id: `A-${id}` } },
    changedAt: CHANGED,
  });
}

const estate = (id: string, officeId: string) => ({
  id,
  office: { id: officeId, customerId: officeId },
  primaryAgentId: `U-${officeId}`,
  secondaryAgentId: null,
  projectId: `PR-${officeId}`,
  address: { streetAddress: 'Storgatan 1', area: { id: `A-${officeId}`, name: 'Centrum' } },
  extensions: { housingCooperative: { association: { id: `F-${officeId}` } } },
  changedAt: CHANGED,
});

const login = (officeId: string): string =>
  JSON.stringify({ username: USERNAME, password: PASSWORD, customer_id: officeId });

/** A Vitec connection of a brokerage of its own. */
async function brokerage(n: string, officeId: string): Promise<{ tenant: number; id: string }> {
  const tenant = await createTenant({ displayName: `Brokerage ${n}`, token: `token-${n}` });
  const id = `vitec-${n}`;
  await upsertConnection({
    id,
    tenantId: tenant,
    provider: 'vitec',
    licensedOffices: [],
    credentials: login(officeId),
  });
  await queueLifecycle(id, 'connection_added', {});
  return { tenant, id };
}

const stored = async (connectionId: string): Promise<number> =>
  Number(
    (
      await db().query<{ count: string }>(
        `select count(*) from items where connection_id = $1 and datatype = 'property'`,
        [connectionId],
      )
    ).rows[0]?.count,
  );

/** The office's records waiting on the adapter's fetch list. */
const waiting = async (officeId: string): Promise<number> =>
  Number(
    (
      await db().query<{ count: string }>(
        `select count(*) from vitec_fetch_list where office_id like '%' || $1`,
        [officeId],
      )
    ).rows[0]?.count,
  );

let fake: FakeConnect;
let running: Harness;
let bellServer: Server;
const rungAt = new Map<number, number[]>();

beforeEach(async () => {
  fake = await startFakeConnect();
  process.env['VITEC_BASE_URL'] = fake.url;
  process.env['VITEC_WEBHOOK_TOKEN'] = TOKEN;
  connect.forgetNewLoginTests();
  await store.reset();
  rungAt.clear();
  bellServer = await new Promise<Server>((resolve) => {
    const server = createServer((request, response) => {
      request.resume();
      const tenant = Number(/\/bell\/(\d+)/.exec(request.url ?? '')?.[1]);
      rungAt.set(tenant, [...(rungAt.get(tenant) ?? []), Date.now()]);
      response.writeHead(200);
      response.end();
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
});

afterEach(async () => {
  // Let what is left of the load list quickly, so stopping does not wait for it at live speed.
  process.env['VITEC_REQUESTS_PER_SECOND'] = '1000';
  await running.stop();
  await fake.close();
  await new Promise<void>((resolve) => bellServer.close(() => resolve()));
});

describe('near-instant under normal load (Vitec)', () => {
  it('rings a site within 2 s of its notification, p95, less Vitec’s time, while another brokerage’s 30,000 records load (AC 32)', async () => {
    running = await harness({ adapters: [vitecAdapter], subscriber: false });
    const bellBase = `http://127.0.0.1:${(bellServer.address() as AddressInfo).port}/bell`;

    // The brokerages that get notifications, loaded first, as Core runs before the new one comes.
    const sites: { tenant: number; id: string; office: string }[] = [];
    for (let n = 1; n <= SITES; n += 1) {
      const officeId = `M${n}`;
      office(fake, officeId);
      fake.put(officeId, 'property', estate(`OBJ-${officeId}`, officeId));
      const added = await brokerage(String(n), officeId);
      await addSubscriber({
        tenantId: added.tenant,
        label: `site ${n}`,
        bellUrl: `${bellBase}/${added.tenant}`,
        bellSecret: 'bell-secret',
      });
      sites.push({ ...added, office: officeId });
    }
    await deliverLifecycleEvents();
    for (const site of sites) {
      await until(async () => (await stored(site.id)) === 1, `${site.id} loaded`, 30_000);
    }

    // The new brokerage: 30,000 records. Its list is read at full speed, so the test does not wait
    // the 30 s that 300 pages take at the live limit; its records are then fetched at Core's live
    // speed to Vitec, with most of them still waiting their turn.
    office(fake, BIG);
    for (let n = 1; n <= LOAD; n += 1) fake.put(BIG, 'property', estate(`L${n}`, BIG));
    const big = await brokerage('big', BIG);
    // Not awaited: the load goes on through the notifications and past the test's end.
    const loading = deliverLifecycleEvents().catch(() => undefined);
    await until(async () => (await waiting(BIG)) >= LOAD / 2, 'the load listed', 60_000);
    process.env['VITEC_REQUESTS_PER_SECOND'] = '10';
    const callsBefore = fake.requests.length;

    // One notification for each brokerage's new home, under one a second.
    const sentAt = new Map<number, number>();
    for (const site of sites) {
      const id = `NEW-${site.office}`;
      fake.put(site.office, 'property', estate(id, site.office));
      sentAt.set(site.tenant, Date.now());
      const response = await fetch(`${running.baseUrl}/v1/hook/vitec/webhook/${TOKEN}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'Estate', event: 'Update', customerId: site.office, id }),
      });
      expect(response.status).toBe(202);
      await new Promise((resolve) => setTimeout(resolve, EVERY_MS));
    }
    const rungSince = (tenant: number): number | undefined =>
      (rungAt.get(tenant) ?? []).find((at) => at >= (sentAt.get(tenant) ?? Infinity));
    await until(
      () => sites.every((site) => rungSince(site.tenant) !== undefined),
      'every site rung',
      30_000,
    );

    // The load ran the whole time: Vitec was busy with it, and it had not finished.
    expect(fake.requests.length - callsBefore).toBeGreaterThan(SITES * 5);
    expect(await stored(big.id)).toBeLessThan(LOAD);
    expect(await waiting(BIG)).toBeGreaterThan(0);

    const took: number[] = [];
    for (const site of sites) {
      const calls = (
        await queryEvents({
          entity: { connectionId: site.id, datatype: 'property', remoteId: `NEW-${site.office}` },
        })
      ).filter((event) => event.type === 'crm.call');
      const vitecMs = calls.reduce((sum, call) => sum + Number(call.fields['duration_ms'] ?? 0), 0);
      const rung = rungSince(site.tenant);
      took.push((rung ?? Infinity) - (sentAt.get(site.tenant) ?? 0) - vitecMs);
    }
    took.sort((a, b) => a - b);
    const p95 = took[Math.ceil(took.length * 0.95) - 1] ?? Infinity;
    console.log(
      `AC 32: notification to bell, less Vitec's time: median ${took[Math.floor(took.length / 2)]} ms, p95 ${p95} ms, while the load made ${fake.requests.length - callsBefore} calls`,
    );
    expect(p95).toBeLessThan(2_000);
    void loading;
  }, 120_000);
});
