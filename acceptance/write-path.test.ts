// The engine write path: map, rules, licensing, change detection, tombstones, event log.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { harness, pull, until, type Harness, TENANT } from './harness.js';
import { fakeWebhookAdapter, drainFetchList } from '../adapters/fake-webhook/index.js';
import * as crm from '../adapters/fake-webhook/crm.js';
import { validateItem } from '../engine/contract.js';
import { queryEvents } from '../engine/events.js';
import { flushBells } from '../engine/bells.js';

const CONNECTION = 'fake-acme';

const property = (
  ref: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  ref,
  state: 'FOR_SALE',
  kind: 'APARTMENT',
  streetAddress: 'Storgatan 12',
  town: 'Lidingö',
  zip: '18131',
  askingPrice: 4950000,
  livingArea: 82,
  extraArea: 12,
  roomCount: 3,
  latitude: 59.3667,
  longitude: 18.1333,
  officeRef: '100',
  areaRefs: [],
  brokerRefs: [],
  associationRef: null,
  photos: [],
  showings: [],
  publishedUtc: '2026-09-01T08:00:00Z',
  soldUtc: null,
  updatedUtc: '2026-09-08T10:02:00Z',
  internalCode: 1,
  ...overrides,
});

const webhook = async (
  base: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
): Promise<Response> =>
  fetch(`${base}/v1/hook/fake-webhook/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

let running: Harness;

beforeEach(async () => {
  crm.reset();
  running = await harness({
    adapters: [fakeWebhookAdapter],
    connections: [{ id: CONNECTION, provider: 'fake-webhook' }],
  });
});

afterEach(async () => {
  await running.stop();
});

describe('ingest', () => {
  it('turns a webhook into a served item (AC 2, AC 3)', async () => {
    crm.put('property', 'OBJ-1', property('OBJ-1'));
    const response = await webhook(running.baseUrl, {
      connection_id: CONNECTION,
      datatype: 'property',
      remote_id: 'OBJ-1',
    });
    expect(response.status).toBe(202);

    await drainFetchList();
    const page = await pull(running.baseUrl, 'property');
    expect(page.items).toHaveLength(1);

    const item = page.items[0] as Record<string, unknown>;
    expect(validateItem(item).valid).toBe(true);
    expect(item['remote_id']).toBe('OBJ-1');
    expect(item['office_id']).toBe('100');
    expect(item['deleted']).toBe(false);
    expect(item['remote_updated_at']).toBe('2026-09-08T10:02:00.000Z');
    const data = item['data'] as Record<string, unknown>;
    expect((data['display'] as Record<string, string>)['price']).toBe('4 950 000 kr');
  });

  it('gives an unchanged record no new seq and no bell (AC 15)', async () => {
    crm.put('property', 'OBJ-1', property('OBJ-1'));
    await webhook(running.baseUrl, {
      connection_id: CONNECTION,
      datatype: 'property',
      remote_id: 'OBJ-1',
    });
    await drainFetchList();
    await flushBells();
    const first = await pull(running.baseUrl, 'property');
    const bellsAfterFirst = running.bells.length;

    await webhook(running.baseUrl, {
      connection_id: CONNECTION,
      datatype: 'property',
      remote_id: 'OBJ-1',
    });
    await drainFetchList();
    await flushBells();

    const second = await pull(running.baseUrl, 'property');
    expect(second.items[0]?.['seq']).toBe(first.items[0]?.['seq']);
    expect(running.bells.length).toBe(bellsAfterFirst);
  });

  it('gives a real change a new seq and logs what changed', async () => {
    crm.put('property', 'OBJ-1', property('OBJ-1'));
    await webhook(running.baseUrl, {
      connection_id: CONNECTION,
      datatype: 'property',
      remote_id: 'OBJ-1',
    });
    await drainFetchList();
    const before = await pull(running.baseUrl, 'property');

    crm.put('property', 'OBJ-1', property('OBJ-1', { askingPrice: 4750000 }));
    await webhook(running.baseUrl, {
      connection_id: CONNECTION,
      datatype: 'property',
      remote_id: 'OBJ-1',
    });
    await drainFetchList();

    const after = await pull(running.baseUrl, 'property');
    expect(Number(after.items[0]?.['seq'])).toBeGreaterThan(Number(before.items[0]?.['seq']));

    const events = await queryEvents({ type: 'entity.written', limit: 10 });
    const latest = events[events.length - 1];
    const changed = (
      latest?.fields as Record<string, Record<string, { from: unknown; to: unknown }>>
    )['changed'];
    expect(changed?.['price']).toEqual({ from: 4950000, to: 4750000 });
    expect(changed?.['display.price']).toEqual({ from: '4 950 000 kr', to: '4 750 000 kr' });
  });

  it('drops a record from an unlicensed office and says why (AC 9)', async () => {
    await running.stop();
    crm.reset();
    running = await harness({
      adapters: [fakeWebhookAdapter],
      connections: [{ id: CONNECTION, provider: 'fake-webhook', licensedOffices: ['200'] }],
    });

    crm.put('property', 'OBJ-1', property('OBJ-1', { officeRef: '100' }));
    crm.put('property', 'OBJ-2', property('OBJ-2', { officeRef: '200' }));
    for (const remoteId of ['OBJ-1', 'OBJ-2']) {
      await webhook(running.baseUrl, {
        connection_id: CONNECTION,
        datatype: 'property',
        remote_id: remoteId,
      });
    }
    await drainFetchList();

    const page = await pull(running.baseUrl, 'property');
    expect(page.items.map((item) => item['remote_id'])).toEqual(['OBJ-2']);

    const dropped = await queryEvents({ type: 'entity.dropped', limit: 10 });
    expect(dropped[0]?.fields['reason']).toBe('unlicensed');
  });

  it('drops one malformed record and still writes the others (AC 11)', async () => {
    crm.put('property', 'OBJ-BAD', property('OBJ-BAD', { state: 'NOT_A_STATE' }));
    crm.put('property', 'OBJ-GOOD', property('OBJ-GOOD'));
    for (const remoteId of ['OBJ-BAD', 'OBJ-GOOD']) {
      await webhook(running.baseUrl, {
        connection_id: CONNECTION,
        datatype: 'property',
        remote_id: remoteId,
      });
    }
    await drainFetchList();

    const page = await pull(running.baseUrl, 'property');
    expect(page.items.map((item) => item['remote_id'])).toEqual(['OBJ-GOOD']);

    const dropped = await queryEvents({ type: 'entity.dropped', limit: 10 });
    expect(dropped.some((event) => event.fields['reason'] === 'malformed')).toBe(true);
  });

  it('tombstones a record the CRM no longer has (AC 26)', async () => {
    crm.put('property', 'OBJ-1', property('OBJ-1'));
    await webhook(running.baseUrl, {
      connection_id: CONNECTION,
      datatype: 'property',
      remote_id: 'OBJ-1',
    });
    await drainFetchList();

    crm.remove('property', 'OBJ-1');
    await webhook(running.baseUrl, {
      connection_id: CONNECTION,
      datatype: 'property',
      remote_id: 'OBJ-1',
    });
    await drainFetchList();

    const page = await pull(running.baseUrl, 'property');
    expect(page.items[0]?.['deleted']).toBe(true);
    expect(page.items[0]?.['data']).toBeNull();
  });

  it('rings a bell for a change, throttled to one per window (AC 5)', async () => {
    for (let index = 0; index < 5; index += 1) {
      const ref = `OBJ-${index}`;
      crm.put('property', ref, property(ref));
      await webhook(running.baseUrl, {
        connection_id: CONNECTION,
        datatype: 'property',
        remote_id: ref,
      });
    }
    await drainFetchList();
    await until(() => running.bells.length > 0, 'a bell');
    await flushBells();

    expect(running.bells.length).toBeGreaterThan(0);
    expect(running.bells.length).toBeLessThan(5);
    expect(running.bells[0]?.secret).toBe('bell-secret');
  });

  it('rejects a webhook with a bad signature', async () => {
    const { setWebhookSecret } = await import('../adapters/fake-webhook/index.js');
    setWebhookSecret(CONNECTION, 'right');
    const response = await webhook(
      running.baseUrl,
      { connection_id: CONNECTION, datatype: 'property', remote_id: 'OBJ-1' },
      { 'x-fake-signature': 'wrong' },
    );
    expect(response.status).toBe(401);
    setWebhookSecret(CONNECTION, '');
  });

  it('links a webhook to the write it caused by correlation id (AC 16)', async () => {
    crm.put('property', 'OBJ-1', property('OBJ-1'));
    const response = await webhook(running.baseUrl, {
      connection_id: CONNECTION,
      datatype: 'property',
      remote_id: 'OBJ-1',
    });
    const { correlation_id: correlationId } = (await response.json()) as { correlation_id: string };
    await drainFetchList();

    const chain = await queryEvents({ correlationId });
    expect(chain.map((event) => event.type)).toContain('entity.written');
    expect(chain.every((event) => event.correlation_id === correlationId)).toBe(true);
  });

  it('keeps the whole timeline of an entity in the event log (AC 16)', async () => {
    crm.put('property', 'OBJ-1', property('OBJ-1'));
    await webhook(running.baseUrl, {
      connection_id: CONNECTION,
      datatype: 'property',
      remote_id: 'OBJ-1',
    });
    await drainFetchList();
    await pull(running.baseUrl, 'property');

    const timeline = await queryEvents({
      entity: { connectionId: CONNECTION, datatype: 'property', remoteId: 'OBJ-1' },
    });
    expect(timeline.map((event) => event.type)).toContain('entity.written');
    expect(timeline.every((event) => event.tenant_id === TENANT)).toBe(true);
  });
});
