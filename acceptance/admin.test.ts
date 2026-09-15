// /v1/admin/*: lifecycle events, replay and recompute, the event timeline, bells, and health.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { harness, pull, until, ADMIN_SECRET, TENANT, type Harness } from './harness.js';
import { fakeWebhookAdapter, drainFetchList } from '../adapters/fake-webhook/index.js';
import * as crm from '../adapters/fake-webhook/crm.js';
import { db } from '../engine/storage/db.js';
import { heartbeat } from '../engine/health.js';
import { flushBells } from '../engine/bells.js';
import type { ImpactReport } from '../engine/recompute.js';

const CONNECTION = 'fake-acme';

const property = (ref: string, officeRef = '100'): Record<string, unknown> => ({
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
  officeRef,
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

const admin = async (path: string, body: unknown): Promise<Response> =>
  fetch(`${running.baseUrl}/v1/admin/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-secret': ADMIN_SECRET },
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

describe('admin', () => {
  it('needs the admin secret', async () => {
    const response = await fetch(`${running.baseUrl}/v1/admin/bell`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tenant_id: TENANT }),
    });
    expect(response.status).toBe(401);
  });

  it('loads a new connection end to end on connection_added (AC 34)', async () => {
    crm.put('office', '100', { ref: '100', title: 'Lidingö', updatedUtc: '2026-08-30T09:00:00Z' });
    crm.put('property', 'OBJ-1', property('OBJ-1'));

    const response = await admin('event', { connection_id: CONNECTION, event: 'connection_added' });
    expect(response.status).toBe(202);

    await until(async () => {
      await drainFetchList();
      return (await pull(running.baseUrl, 'property')).items.length === 1;
    }, 'the initial load');

    expect((await pull(running.baseUrl, 'office')).items).toHaveLength(1);
  });

  it('tombstones an office that is removed (AC 26)', async () => {
    crm.put('property', 'OBJ-1', property('OBJ-1', '100'));
    crm.put('property', 'OBJ-2', property('OBJ-2', '200'));
    await admin('event', { connection_id: CONNECTION, event: 'connection_added' });
    await until(async () => {
      await drainFetchList();
      return (await pull(running.baseUrl, 'property')).items.length === 2;
    }, 'both properties');

    await admin('event', {
      connection_id: CONNECTION,
      event: 'offices_removed',
      office_ids: ['100'],
    });

    const page = await pull(running.baseUrl, 'property');
    const tombstoned = page.items.filter((item) => item['deleted'] === true);
    expect(tombstoned.map((item) => item['remote_id'])).toEqual(['OBJ-1']);
  });

  it('loads only the added office, and gives other offices no new seq (AC 14)', async () => {
    crm.put('office', '100', { ref: '100', title: 'Lidingö', updatedUtc: '2026-08-30T09:00:00Z' });
    crm.put('office', '200', { ref: '200', title: 'Nacka', updatedUtc: '2026-08-30T09:00:00Z' });
    crm.put('property', 'OBJ-100', property('OBJ-100', '100'));
    await admin('event', { connection_id: CONNECTION, event: 'connection_added' });
    await until(async () => {
      await drainFetchList();
      return (await pull(running.baseUrl, 'property')).items.length === 1;
    }, 'the first office');

    const before = await pull(running.baseUrl, 'property');
    const seqBefore = before.items[0]?.['seq'];

    // A second office is licensed later, and its records arrive.
    crm.put('property', 'OBJ-200', property('OBJ-200', '200'));
    await admin('event', {
      connection_id: CONNECTION,
      event: 'offices_added',
      office_ids: ['200'],
    });
    await until(async () => {
      await drainFetchList();
      return (await pull(running.baseUrl, 'property')).items.length === 2;
    }, 'the second office');

    const after = await pull(running.baseUrl, 'property');
    const untouched = after.items.find((item) => item['remote_id'] === 'OBJ-100');
    expect(untouched?.['seq']).toBe(seqBefore);
    expect(after.items.map((item) => item['remote_id']).sort()).toEqual(['OBJ-100', 'OBJ-200']);
  });

  it('previews a recompute without writing anything (AC 36)', async () => {
    crm.put('property', 'OBJ-1', property('OBJ-1'));
    await admin('event', { connection_id: CONNECTION, event: 'connection_added' });
    await until(async () => {
      await drainFetchList();
      return (await pull(running.baseUrl, 'property')).items.length === 1;
    }, 'the property');

    const before = await pull(running.baseUrl, 'property');

    // Pretend the stored row came from older rules: its data and its hash are both stale, which
    // is exactly what a rules change looks like to the preview.
    await db().query(
      `update items set data = jsonb_set(data, '{display,price}', '"wrong"'), content_hash = 'produced-by-older-rules'
       where remote_id = 'OBJ-1'`,
    );

    const preview = (await (await admin('recompute', { dry_run: true })).json()) as ImpactReport;
    expect(preview.examined).toBe(1);
    expect(preview.changed).toBe(1);
    expect(preview.failed).toBe(0);
    expect(preview.examples[0]?.changed['display.price']).toEqual({
      from: 'wrong',
      to: '4 950 000 kr',
    });

    const afterPreview = await pull(running.baseUrl, 'property');
    expect(afterPreview.items[0]?.['seq']).toBe(before.items[0]?.['seq']);
  });

  it('recomputes from stored raw with no CRM traffic, and gives a new seq (AC 13)', async () => {
    crm.put('property', 'OBJ-1', property('OBJ-1'));
    await admin('event', { connection_id: CONNECTION, event: 'connection_added' });
    await until(async () => {
      await drainFetchList();
      return (await pull(running.baseUrl, 'property')).items.length === 1;
    }, 'the property');

    const before = await pull(running.baseUrl, 'property');
    await db().query(
      `update items set data = jsonb_set(data, '{display,price}', '"wrong"'), content_hash = 'stale' where remote_id = 'OBJ-1'`,
    );

    // The CRM is emptied first: a recompute that needed it would fail this test.
    crm.reset();
    const report = (await (
      await admin('replay', { connection_id: CONNECTION })
    ).json()) as ImpactReport;
    expect(report.changed).toBe(1);

    const after = await pull(running.baseUrl, 'property');
    const data = after.items[0]?.['data'] as Record<string, unknown>;
    expect((data['display'] as Record<string, string>)['price']).toBe('4 950 000 kr');
    expect(Number(after.items[0]?.['seq'])).toBeGreaterThan(Number(before.items[0]?.['seq']));
  });

  it('fires a bell on demand', async () => {
    const response = await admin('bell', { tenant_id: TENANT, kind: 'forcerefresh' });
    expect(response.status).toBe(202);
    await until(() => running.bells.length > 0, 'the bell');
    await flushBells();
  });

  it('answers the event timeline query', async () => {
    crm.put('property', 'OBJ-1', property('OBJ-1'));
    await admin('event', { connection_id: CONNECTION, event: 'connection_added' });
    await until(async () => {
      await drainFetchList();
      return (await pull(running.baseUrl, 'property')).items.length === 1;
    }, 'the property');

    const response = await fetch(
      `${running.baseUrl}/v1/admin/events?entity=${CONNECTION}/property/OBJ-1`,
      { headers: { 'x-admin-secret': ADMIN_SECRET } },
    );
    const body = (await response.json()) as { events: { type: string }[] };
    expect(body.events.map((event) => event.type)).toContain('entity.written');
  });
});

describe('health', () => {
  it('is 500 while a check fails and 200 when everything passes (AC 17)', async () => {
    const failing = await fetch(`${running.baseUrl}/v1/health`);
    expect(failing.status).toBe(500);
    const failingBody = (await failing.json()) as {
      ok: boolean;
      checks: Record<string, { ok: boolean }>;
    };
    expect(failingBody.ok).toBe(false);
    expect(failingBody.checks['worker']?.ok).toBe(false);

    await heartbeat();
    await pull(running.baseUrl, 'property');

    const passing = await fetch(`${running.baseUrl}/v1/health`);
    const passingBody = (await passing.json()) as { ok: boolean; checks: Record<string, unknown> };
    expect(passing.status).toBe(200);
    expect(passingBody.ok).toBe(true);
    expect(Object.keys(passingBody.checks)).toContain('fake-webhook.webhook_lag');
  });
});
