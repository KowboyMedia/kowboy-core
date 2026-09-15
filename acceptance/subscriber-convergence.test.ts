// A subscriber converges on Core's state: from zero, from a cursor, after a forcerefresh, and
// while writes are happening (AC 5, AC 19, AC 22).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { harness, until, TOKEN, type Harness } from './harness.js';
import { fakeSubscriber } from './fake-subscriber.js';
import { fakePollingAdapter, poll } from '../adapters/fake-polling/index.js';
import * as crm from '../adapters/fake-polling/crm.js';

const CONNECTION = 'polling-acme';

const property = (
  id: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  object_id: id,
  stage: 'active',
  object_type: 'flat',
  street: `Kungsgatan ${id}`,
  city: 'Stockholm',
  postcode: '11143',
  price: 7250000,
  area_sqm: 96,
  secondary_sqm: null,
  rooms: 4,
  lat: 59.3326,
  lon: 18.0649,
  branch_id: 'B-1',
  districts: [],
  staff: [],
  coop_id: null,
  listed_at: '2026-09-02T09:00:00Z',
  closed_at: null,
  ...overrides,
});

let running: Harness;

beforeEach(async () => {
  crm.reset();
  running = await harness({
    adapters: [fakePollingAdapter],
    connections: [{ id: CONNECTION, provider: 'fake-polling' }],
  });
});

afterEach(async () => {
  await running.stop();
});

describe('a subscriber', () => {
  it('converges from seq 0 to everything Core holds (AC 5)', async () => {
    for (const id of ['P-1', 'P-2', 'P-3']) crm.put('property', id, property(id));
    await poll();

    const site = fakeSubscriber(running.baseUrl, TOKEN);
    await site.sync();

    expect(
      site
        .items('property')
        .map((item) => item.remote_id)
        .sort(),
    ).toEqual(['P-1', 'P-2', 'P-3']);
  });

  it('carries on from its cursor and pulls nothing when nothing changed', async () => {
    crm.put('property', 'P-1', property('P-1'));
    await poll();

    const site = fakeSubscriber(running.baseUrl, TOKEN);
    await site.sync();
    const cursorAfterFirst = site.cursors.get('property');

    await poll();
    await site.sync();
    expect(site.cursors.get('property')).toBe(cursorAfterFirst);

    crm.put('property', 'P-2', property('P-2'));
    await poll();
    await site.sync();
    expect(site.items('property')).toHaveLength(2);
    expect(Number(site.cursors.get('property'))).toBeGreaterThan(Number(cursorAfterFirst));
  });

  it('drops an item locally when Core tombstones it', async () => {
    crm.put('property', 'P-1', property('P-1'));
    await poll();
    const site = fakeSubscriber(running.baseUrl, TOKEN);
    await site.sync();
    expect(site.items('property')).toHaveLength(1);

    crm.remove('property', 'P-1');
    await poll();
    await site.sync();
    expect(site.items('property')).toHaveLength(0);
  });

  it('rebuilds its whole copy on forcerefresh (AC 5)', async () => {
    for (const id of ['P-1', 'P-2']) crm.put('property', id, property(id));
    await poll();
    const site = fakeSubscriber(running.baseUrl, TOKEN);
    await site.sync();

    site.store.delete(`${CONNECTION}/P-1`); // local damage a delta sync would never repair
    await site.sync();
    expect(site.items('property')).toHaveLength(1);

    await site.sync('forcerefresh');
    expect(site.items('property')).toHaveLength(2);
  });

  it('misses no item while writes keep arriving (AC 19)', async () => {
    const ids = Array.from({ length: 40 }, (_, index) => `P-${String(index).padStart(3, '0')}`);
    const site = fakeSubscriber(running.baseUrl, TOKEN);

    // Write and pull at the same time: a cursor must never step over an invisible item.
    const writing = (async () => {
      for (const id of ids) {
        crm.put('property', id, property(id));
        await poll();
      }
    })();
    const pulling = (async () => {
      for (let round = 0; round < 12; round += 1) await site.sync();
    })();
    await Promise.all([writing, pulling]);

    await site.sync();
    expect(
      site
        .items('property')
        .map((item) => item.remote_id)
        .sort(),
    ).toEqual(ids);
  });

  it('converges on its own schedule when bells never arrive (AC 22)', async () => {
    await running.stop();
    crm.reset();
    // No subscriber row means no bell is ever sent; the client's own loop is the only path.
    running = await harness({
      adapters: [fakePollingAdapter],
      connections: [{ id: CONNECTION, provider: 'fake-polling' }],
      subscriber: false,
    });

    crm.put('property', 'P-1', property('P-1'));
    await poll();

    // The client's own schedule, driven one sync at a time: a timer left running here would
    // outlive the test and fetch against a closed server.
    const site = fakeSubscriber(running.baseUrl, TOKEN);
    await until(async () => {
      await site.sync();
      return site.items('property').length === 1;
    }, 'the backstop sync');

    expect(site.syncs).toBeGreaterThan(0);
    expect(running.bells).toHaveLength(0);
  });
});
