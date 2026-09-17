// AC 41: Core's database restored to an earlier point, then the app restarted. No subscriber
// skips a change, none deletes or rewrites what it should keep, every seq served afterwards is
// above every cursor handed out before, and Core converges to the CRM again, deletions included.
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { harness, pull, TOKEN, type Harness } from './harness.js';
import { fakeSubscriber, type FakeSubscriber } from './fake-subscriber.js';
import { fakePollingAdapter, poll } from '../adapters/fake-polling/index.js';
import * as crm from '../adapters/fake-polling/crm.js';
import { startAdapter } from '../engine/adapter-api/index.js';
import { startEngine, SEQUENCE_JUMP, type Engine } from '../engine/index.js';
import { db } from '../engine/storage/db.js';

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
let restarted: Engine | null = null;
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
  await restarted?.stop();
  restarted = null;
  await running.stop();
});

/** What the platform does: the database as it was at the snapshot, then the app starts again. */
async function restoreAndRestart(snapshotSeq: number): Promise<string> {
  await fakePollingAdapter.stop?.();
  await running.engine.stop();
  restarted = await startEngine({ port: 0 });
  await db().query('truncate items');
  await db().query('insert into items select * from items_backup');
  await db().query("select setval('item_seq', $1)", [snapshotSeq]);
  // The jump happens at start, before anything is written; the restore itself moved the sequence
  // back, so put it where the restored database has it, then start as the platform would.
  await restarted.stop();
  restarted = await startEngine({ port: 0 });
  const server = restarted.listen();
  await startAdapter(fakePollingAdapter);
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe('restore (AC 41)', () => {
  it('recovers a restored database without a subscriber deleting or rewriting anything', async () => {
    // Day 29.
    crm.put('property', 'P-1', property('P-1', 'Kungsgatan 1'));
    crm.put('property', 'P-2', property('P-2', 'Kungsgatan 2'));
    crm.put('property', 'P-3', property('P-3', 'Kungsgatan 3'));
    await poll();
    await site.sync();
    await db().query('drop table if exists items_backup');
    await db().query('create table items_backup as select * from items');
    const snapshotSeq = Number(
      (await db().query<{ last_value: string }>('select last_value from item_seq')).rows[0]
        ?.last_value,
    );

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

    // The database goes back to day 29, the app restarts.
    const url = await restoreAndRestart(snapshotSeq);
    site.retarget(url);
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
    expect(site.items('property').map((item) => item.data?.['fake_label'])).toEqual(
      expect.arrayContaining(['Nygatan 2', 'Kungsgatan 4']),
    );

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
    const health = async (): Promise<{ ok: boolean; detail?: string }> => {
      const response = await fetch(`${running.baseUrl}/v1/health`);
      const body = (await response.json()) as {
        checks: Record<string, { ok: boolean; detail?: string }>;
      };
      return body.checks['schema'] ?? { ok: false, detail: 'no schema check' };
    };
    expect(await health()).toEqual({ ok: true });

    await db().query("insert into migrations (name) values ('999_from_a_newer_app.sql')");
    expect(await health()).toMatchObject({
      ok: false,
      detail: expect.stringContaining('999_from_a_newer_app.sql'),
    });

    await db().query("delete from migrations where name = '999_from_a_newer_app.sql'");
    expect(await health()).toEqual({ ok: true });
  });
});
