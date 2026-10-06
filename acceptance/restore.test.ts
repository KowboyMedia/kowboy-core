// AC 41: Core's database restored to an earlier point, then the app started again. No subscriber
// skips a change, none deletes or rewrites what it should keep, every seq served afterwards is
// above every cursor handed out before, Core converges to the CRM again, deletions included, and
// health says so until then.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { harness, pull, TOKEN, type Harness } from './harness.js';
import { fakeSubscriber, type FakeSubscriber } from './fake-subscriber.js';
import { fakePollingAdapter, poll } from '../adapters/fake-polling/index.js';
import * as crm from '../adapters/fake-polling/crm.js';
import { SEQUENCE_JUMP } from '../engine/index.js';
import { db } from '../engine/storage/db.js';
import { pruneHealth } from '../engine/health.js';
import { queueLifecycle } from '../engine/lifecycle.js';

const CONNECTION = 'polling-acme';

const property = (id: string, street: string): Record<string, unknown> => ({
  object_id: id,
  stage: 'active',
  object_type: 'flat',
  street,
  price: 1,
  branch_id: 'B-1',
  districts: [],
  staff: [],
  coop_id: null,
});

let running: Harness;
let site: FakeSubscriber;

beforeEach(async () => {
  crm.reset();
  running = await harness({
    adapters: [fakePollingAdapter],
    connections: [{ id: CONNECTION, provider: 'fake-polling' }],
  });
  site = fakeSubscriber(running.baseUrl, TOKEN);
});

afterEach(async () => {
  await db().query('drop table if exists items_backup');
  await running.stop();
});

/** A snapshot of Core's items, the way a backup holds them. */
async function snapshot(): Promise<number> {
  await db().query('drop table if exists items_backup');
  await db().query('create table items_backup as select * from items');
  const { rows } = await db().query<{ last_value: string }>('select last_value from item_seq');
  return Number(rows[0]?.last_value);
}

/** What the platform does: the database as it was at the snapshot, then the app starts again. */
async function restoreAndRestart(snapshotSeq: number): Promise<void> {
  await running.restart(async () => {
    await db().query('truncate items');
    await db().query('insert into items select * from items_backup');
    await db().query("select setval('item_seq', $1)", [snapshotSeq]);
  });
}

describe('restore (AC 41)', () => {
  it('recovers a restored database without a subscriber deleting or rewriting anything', async () => {
    // Day 29.
    crm.put('property', 'P-1', property('P-1', 'Kungsgatan 1'));
    crm.put('property', 'P-2', property('P-2', 'Kungsgatan 2'));
    crm.put('property', 'P-3', property('P-3', 'Kungsgatan 3'));
    await poll();
    await site.sync();
    const snapshotSeq = await snapshot();

    // Day 30: one change, one new record, one delete. The subscriber sees all of it.
    crm.put('property', 'P-2', property('P-2', 'Nygatan 2'));
    crm.put('property', 'P-4', property('P-4', 'Kungsgatan 4'));
    crm.remove('property', 'P-3');
    await poll();
    await site.sync();
    const before = new Map(site.store);
    const cursor = site.cursors.get('property') ?? 0;
    expect([...before.keys()].sort()).toEqual([
      `${CONNECTION}/P-1`,
      `${CONNECTION}/P-2`,
      `${CONNECTION}/P-4`,
    ]);

    // The database goes back to day 29, the app starts again.
    await restoreAndRestart(snapshotSeq);
    const url = running.baseUrl;
    expect((await pull(url, 'property')).items.map((item) => item['remote_id']).sort()).toEqual([
      'P-1',
      'P-2',
      'P-3',
    ]);

    // The subscriber pulls: nothing arrives, nothing is lost, nothing is deleted.
    await site.sync();
    expect(new Map(site.store)).toEqual(before);

    // The adapter's next pass brings Core back to the CRM's current state.
    await poll();
    await site.sync();
    expect(new Map(site.store)).toEqual(before);
    expect(
      site
        .items('property')
        .map((item) => (item.data?.['address'] as Record<string, unknown> | undefined)?.['street']),
    ).toEqual(expect.arrayContaining(['Nygatan 2', 'Kungsgatan 4']));

    // Everything served after the restart sits above the cursor from before it.
    const served = (await pull(url, 'property', cursor)).items;
    expect(served.map((item) => [item['remote_id'], item['deleted']]).sort()).toEqual([
      ['P-2', false],
      ['P-3', true],
      ['P-4', false],
    ]);
    expect(served.every((item) => Number(item['seq']) > Math.max(cursor, SEQUENCE_JUMP))).toBe(
      true,
    );

    // The start is on record, with the jump.
    const { rows } = await db().query<{ fields: { seq_from: number; seq_to: number } }>(
      "select fields from events where type = 'engine.started' order by at desc limit 1",
    );
    expect(rows[0]?.fields.seq_to).toBe(rows[0]!.fields.seq_from + SEQUENCE_JUMP);
  });

  it('reports when the database is ahead of the app', async () => {
    const schema = async (): Promise<{ ok: boolean; detail?: string }> => {
      const response = await fetch(`${running.baseUrl}/v1/ready`);
      const body = (await response.json()) as {
        checks: Record<string, { ok: boolean; detail?: string }>;
      };
      return body.checks['schema'] ?? { ok: false, detail: 'no schema check' };
    };
    expect(await schema()).toEqual({ ok: true });

    await db().query("insert into migrations (name) values ('999_from_a_newer_app.sql')");
    expect(await schema()).toMatchObject({
      ok: false,
      detail: expect.stringContaining('999_from_a_newer_app.sql'),
    });
    expect((await fetch(`${running.baseUrl}/v1/ready`)).status).toBe(500);

    await db().query("delete from migrations where name = '999_from_a_newer_app.sql'");
    expect(await schema()).toEqual({ ok: true });
  });

  it("turns health red while the worker's last report is stale, and keeps readiness green", async () => {
    // What a restored database holds: the worker's checks as it recorded them long ago.
    await db().query(
      `insert into health_results (name, ok, detail, at)
       values ('someone.catch_up', true, null, now() - interval '10 minutes')`,
    );
    const health = (await (await fetch(`${running.baseUrl}/v1/health`)).json()) as {
      ok: boolean;
      checks: Record<string, { ok: boolean; detail?: string }>;
    };
    expect(health.ok).toBe(false);
    expect(health.checks['someone.catch_up']).toMatchObject({
      ok: false,
      detail: expect.stringContaining('has not run this check for'),
    });
    expect((await fetch(`${running.baseUrl}/v1/ready`)).status).toBe(200);
  });

  it("forgets, at the worker's next round, a check nobody runs any more", async () => {
    // An adapter that left the app: its last report would otherwise stay red as "no report".
    await db().query(
      `insert into health_results (name, ok, detail, at)
       values ('someone.catch_up', true, null, now() - interval '10 minutes')`,
    );
    await pruneHealth();
    const health = (await (await fetch(`${running.baseUrl}/v1/health`)).json()) as {
      checks: Record<string, { ok: boolean }>;
    };
    expect(health.checks['someone.catch_up']).toBeUndefined();
    expect(health.checks['fake-polling.poll']).toBeDefined();
  });

  it('delivers a queued lifecycle event, and counts one nobody takes', async () => {
    crm.put('property', 'P-1', property('P-1', 'Kungsgatan 1'));
    expect(await queueLifecycle(CONNECTION, 'resync')).not.toBeNull();
    expect((await pull(running.baseUrl, 'property')).items).toHaveLength(0);

    await running.deliver();
    expect((await pull(running.baseUrl, 'property')).items).toHaveLength(1);

    expect(await queueLifecycle('nobody', 'resync')).toBeNull();

    await db().query(
      `insert into lifecycle_events (connection_id, event, created_at)
       values ($1, 'resync', now() - interval '6 minutes')`,
      [CONNECTION],
    );
    const health = (await (await fetch(`${running.baseUrl}/v1/health`)).json()) as {
      checks: Record<string, { ok: boolean; detail?: string }>;
    };
    expect(health.checks['lifecycle']).toMatchObject({ ok: false });
  });
});
