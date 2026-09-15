// Storage-level rules: identity across connections, and the tombstone retention window.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { harness, pull, type Harness } from './harness.js';
import { fakeWebhookAdapter, drainFetchList } from '../adapters/fake-webhook/index.js';
import * as crm from '../adapters/fake-webhook/crm.js';
import { db } from '../engine/storage/db.js';
import { purgeTombstones } from '../engine/storage/items.js';

const property = (ref: string, officeRef: string): Record<string, unknown> => ({
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

beforeEach(async () => {
  crm.reset();
  running = await harness({
    adapters: [fakeWebhookAdapter],
    connections: [
      { id: 'acme-north', provider: 'fake-webhook' },
      { id: 'acme-south', provider: 'fake-webhook' },
    ],
  });
});

afterEach(async () => {
  await running.stop();
});

const webhook = (connectionId: string, remoteId: string): Promise<Response> =>
  fetch(`${running.baseUrl}/v1/hook/fake-webhook/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      connection_id: connectionId,
      datatype: 'property',
      remote_id: remoteId,
    }),
  });

describe('identity', () => {
  it('keeps two connections of one provider apart, even with the same remote id (AC 6)', async () => {
    // Both CRMs hand out "OBJ-1"; only the connection tells them apart.
    crm.put('property', 'OBJ-1', property('OBJ-1', '100'));
    await webhook('acme-north', 'OBJ-1');
    await drainFetchList();

    crm.put('property', 'OBJ-1', property('OBJ-1', '200'));
    await webhook('acme-south', 'OBJ-1');
    await drainFetchList();

    const page = await pull(running.baseUrl, 'property');
    expect(page.items).toHaveLength(2);
    expect(page.items.map((item) => item['connection_id']).sort()).toEqual([
      'acme-north',
      'acme-south',
    ]);
    expect(page.items.map((item) => item['office_id']).sort()).toEqual(['100', '200']);
  });
});

describe('tombstone retention', () => {
  it('hard-deletes a tombstone after the retention window, and keeps a fresh one (AC 26)', async () => {
    crm.put('property', 'OBJ-OLD', property('OBJ-OLD', '100'));
    crm.put('property', 'OBJ-NEW', property('OBJ-NEW', '100'));
    await webhook('acme-north', 'OBJ-OLD');
    await webhook('acme-north', 'OBJ-NEW');
    await drainFetchList();

    crm.remove('property', 'OBJ-OLD');
    crm.remove('property', 'OBJ-NEW');
    await webhook('acme-north', 'OBJ-OLD');
    await webhook('acme-north', 'OBJ-NEW');
    await drainFetchList();

    expect((await pull(running.baseUrl, 'property')).items).toHaveLength(2);

    // Age one tombstone past the window; a tombstone is only ever purged by time.
    await db().query(
      "update items set tombstoned_at = now() - interval '91 days' where remote_id = 'OBJ-OLD'",
    );
    const purged = await purgeTombstones(90);
    expect(purged).toBe(1);

    const page = await pull(running.baseUrl, 'property');
    expect(page.items.map((item) => item['remote_id'])).toEqual(['OBJ-NEW']);
  });
});
