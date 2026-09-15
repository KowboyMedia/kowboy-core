// AC 12: two fake adapters, one webhook-style and one polling-style, work end to end through the
// adapter API alone, and the engine stays free of any provider's vocabulary.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { harness, pull, until, ADMIN_SECRET, type Harness } from './harness.js';
import { fakePollingAdapter, poll } from '../adapters/fake-polling/index.js';
import { fakeWebhookAdapter, drainFetchList, queueDepth } from '../adapters/fake-webhook/index.js';
import * as pollingCrm from '../adapters/fake-polling/crm.js';
import * as webhookCrm from '../adapters/fake-webhook/crm.js';

const POLLING = 'polling-acme';
const WEBHOOK = 'webhook-acme';

const pollingProperty = (
  id: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  object_id: id,
  stage: 'active',
  object_type: 'flat',
  street: 'Kungsgatan 1',
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

const webhookProperty = (ref: string): Record<string, unknown> => ({
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
  publishedUtc: null,
  soldUtc: null,
  updatedUtc: '2026-09-08T10:02:00Z',
  internalCode: 1,
});

let running: Harness;

beforeEach(async () => {
  pollingCrm.reset();
  webhookCrm.reset();
  running = await harness({
    adapters: [fakeWebhookAdapter, fakePollingAdapter],
    connections: [
      { id: WEBHOOK, provider: 'fake-webhook' },
      { id: POLLING, provider: 'fake-polling' },
    ],
  });
});

afterEach(async () => {
  await running.stop();
});

describe('two adapters, one engine', () => {
  it('serves items from both, side by side, with different payload shapes', async () => {
    pollingCrm.put('property', 'P-1', pollingProperty('P-1'));
    webhookCrm.put('property', 'OBJ-1', webhookProperty('OBJ-1'));

    await fetch(`${running.baseUrl}/v1/hook/fake-webhook/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ connection_id: WEBHOOK, datatype: 'property', remote_id: 'OBJ-1' }),
    });
    await drainFetchList();
    await poll();

    const page = await pull(running.baseUrl, 'property');
    const byId = Object.fromEntries(page.items.map((item) => [item['remote_id'], item]));
    expect(Object.keys(byId).sort()).toEqual(['OBJ-1', 'P-1']);

    const polled = byId['P-1']?.['data'] as Record<string, unknown>;
    expect(polled['listing_type']).toBe('apartment');
    expect((polled['display'] as Record<string, string>)['price']).toBe('7 250 000 kr');
    expect(byId['P-1']?.['connection_id']).toBe(POLLING);

    const pushed = byId['OBJ-1']?.['data'] as Record<string, unknown>;
    expect((pushed['display'] as Record<string, string>)['price']).toBe('4 950 000 kr');
  });

  it('tombstones through presentIds when a polled record disappears (AC 35)', async () => {
    pollingCrm.put('property', 'P-1', pollingProperty('P-1'));
    await poll();
    expect((await pull(running.baseUrl, 'property')).items).toHaveLength(1);

    pollingCrm.remove('property', 'P-1');
    await poll();

    const page = await pull(running.baseUrl, 'property');
    expect(page.items[0]?.['deleted']).toBe(true);
  });

  it('writes nothing new when a poll finds no change (AC 15)', async () => {
    pollingCrm.put('property', 'P-1', pollingProperty('P-1'));
    await poll();
    const before = await pull(running.baseUrl, 'property');

    await poll();
    await poll();

    const after = await pull(running.baseUrl, 'property');
    expect(after.items[0]?.['seq']).toBe(before.items[0]?.['seq']);
  });

  it('absorbs a burst of webhooks without a fetch per webhook (AC 29 in miniature)', async () => {
    webhookCrm.put('property', 'OBJ-1', webhookProperty('OBJ-1'));
    const sends = Array.from({ length: 100 }, () =>
      fetch(`${running.baseUrl}/v1/hook/fake-webhook/webhook`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ connection_id: WEBHOOK, datatype: 'property', remote_id: 'OBJ-1' }),
      }),
    );
    const responses = await Promise.all(sends);
    expect(responses.every((response) => response.status === 202)).toBe(true);
    // 100 webhooks for one record collapse into one queued fetch.
    expect(queueDepth()).toBe(1);

    await drainFetchList();
    expect((await pull(running.baseUrl, 'property')).items).toHaveLength(1);
  });

  it('reports the health check each adapter registered', async () => {
    const response = await fetch(`${running.baseUrl}/v1/health`);
    const body = (await response.json()) as { checks: Record<string, unknown> };
    expect(Object.keys(body.checks)).toEqual(
      expect.arrayContaining([
        'database',
        'worker',
        'subscribers',
        'fake-webhook.webhook_lag',
        'fake-polling.poll',
      ]),
    );
  });

  it('resyncs a connection on request (AC 14)', async () => {
    pollingCrm.put('property', 'P-1', pollingProperty('P-1'));
    await fetch(`${running.baseUrl}/v1/admin/event`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-secret': ADMIN_SECRET },
      body: JSON.stringify({ connection_id: POLLING, event: 'resync' }),
    });
    await until(
      async () => (await pull(running.baseUrl, 'property')).items.length === 1,
      'the resync',
    );
  });
});
