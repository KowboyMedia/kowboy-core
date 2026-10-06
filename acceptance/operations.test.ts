// The engine's operations, as the admin panel will call them: lifecycle events, replay and
// recompute, the event timeline, bells, and health.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { harness, pull, until, TENANT, type Harness } from './harness.js';
import { fakeWebhookAdapter, drainFetchList } from '../adapters/fake-webhook/index.js';
import * as crm from '../adapters/fake-webhook/crm.js';
import { db } from '../engine/storage/db.js';
import { healthReport, heartbeat } from '../engine/health.js';
import { checkAlerts } from '../engine/alerts.js';
import { flushBells, ring } from '../engine/bells.js';
import { queueLifecycle } from '../engine/lifecycle.js';
import type { LifecycleEvent } from '../engine/adapter-api/types.js';
import { logEvent, queryEvents } from '../engine/events.js';
import { recompute } from '../engine/recompute.js';

const CONNECTION = 'fake-acme';

const property = (ref: string, officeRef = '100'): Record<string, unknown> => ({
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

/** Queue a lifecycle event for the test connection and deliver it, as the worker's tick would. */
const event = async (
  type: LifecycleEvent['type'],
  officeIds?: string[],
): Promise<number | null> => {
  const id = await queueLifecycle(CONNECTION, type, officeIds ? { officeIds } : {});
  await running.deliver();
  return id;
};

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

describe('operations', () => {
  it('loads a new connection end to end on connection_added (AC 34)', async () => {
    crm.put('office', '100', { ref: '100', title: 'Lidingö', updatedUtc: '2026-08-30T09:00:00Z' });
    crm.put('property', 'OBJ-1', property('OBJ-1'));

    expect(await event('connection_added')).not.toBeNull();

    await until(async () => {
      await drainFetchList();
      return (await pull(running.baseUrl, 'property')).items.length === 1;
    }, 'the initial load');

    expect((await pull(running.baseUrl, 'office')).items).toHaveLength(1);
  });

  it('tombstones an office that is removed (AC 26)', async () => {
    crm.put('property', 'OBJ-1', property('OBJ-1', '100'));
    crm.put('property', 'OBJ-2', property('OBJ-2', '200'));
    await event('connection_added');
    await until(async () => {
      await drainFetchList();
      return (await pull(running.baseUrl, 'property')).items.length === 2;
    }, 'both properties');

    await event('offices_removed', ['100']);

    const page = await pull(running.baseUrl, 'property');
    const tombstoned = page.items.filter((item) => item['deleted'] === true);
    expect(tombstoned.map((item) => item['remote_id'])).toEqual(['OBJ-1']);
  });

  it('loads only the added office, and gives other offices no new seq (AC 14)', async () => {
    crm.put('office', '100', { ref: '100', title: 'Lidingö', updatedUtc: '2026-08-30T09:00:00Z' });
    crm.put('office', '200', { ref: '200', title: 'Nacka', updatedUtc: '2026-08-30T09:00:00Z' });
    crm.put('property', 'OBJ-100', property('OBJ-100', '100'));
    await event('connection_added');
    await until(async () => {
      await drainFetchList();
      return (await pull(running.baseUrl, 'property')).items.length === 1;
    }, 'the first office');

    const before = await pull(running.baseUrl, 'property');
    const seqBefore = before.items[0]?.['seq'];

    // A second office is licensed later, and its records arrive.
    crm.put('property', 'OBJ-200', property('OBJ-200', '200'));
    await event('offices_added', ['200']);
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
    await event('connection_added');
    await until(async () => {
      await drainFetchList();
      return (await pull(running.baseUrl, 'property')).items.length === 1;
    }, 'the property');

    const before = await pull(running.baseUrl, 'property');

    // Pretend the stored row came from older rules: its data and its hash are both stale, which
    // is exactly what a rules change looks like to the preview.
    await db().query(
      `update items set data = jsonb_set(data, '{price}', '1'), content_hash = 'produced-by-older-rules'
       where remote_id = 'OBJ-1'`,
    );

    const preview = await recompute({}, { dryRun: true });
    expect(preview.examined).toBe(1);
    expect(preview.changed).toBe(1);
    expect(preview.failed).toBe(0);
    expect(preview.examples[0]?.changed['price']).toEqual({ from: 1, to: 4950000 });

    const afterPreview = await pull(running.baseUrl, 'property');
    expect(afterPreview.items[0]?.['seq']).toBe(before.items[0]?.['seq']);
  });

  it('recomputes from stored raw with no CRM traffic, and gives a new seq (AC 13)', async () => {
    crm.put('property', 'OBJ-1', property('OBJ-1'));
    await event('connection_added');
    await until(async () => {
      await drainFetchList();
      return (await pull(running.baseUrl, 'property')).items.length === 1;
    }, 'the property');

    const before = await pull(running.baseUrl, 'property');
    await db().query(
      `update items set data = jsonb_set(data, '{price}', '1'), content_hash = 'stale' where remote_id = 'OBJ-1'`,
    );

    // The CRM is emptied first: a recompute that needed it would fail this test.
    crm.reset();
    const report = await recompute({ connectionId: CONNECTION });
    expect(report.changed).toBe(1);

    const after = await pull(running.baseUrl, 'property');
    const data = after.items[0]?.['data'] as Record<string, unknown>;
    expect(data['price']).toBe(4950000);
    expect(Number(after.items[0]?.['seq'])).toBeGreaterThan(Number(before.items[0]?.['seq']));
  });

  it('recomputes sold properties last, whatever the CRM (question 74)', async () => {
    // The sold one is written first, so by seq alone it would be recomputed first.
    crm.put('property', 'OBJ-SOLD', { ...property('OBJ-SOLD'), soldUtc: '2026-09-01T10:00:00Z' });
    await event('connection_added');
    await until(async () => {
      await drainFetchList();
      return (await pull(running.baseUrl, 'property')).items.length === 1;
    }, 'the sold property');
    crm.put('property', 'OBJ-FOR-SALE', property('OBJ-FOR-SALE'));
    await event('resync');
    await until(async () => {
      await drainFetchList();
      return (await pull(running.baseUrl, 'property')).items.length === 2;
    }, 'both properties');

    await db().query(`update items set content_hash = 'stale'`);
    const report = await recompute({});
    expect(report.changed).toBe(2);

    const after = await pull(running.baseUrl, 'property');
    const seqOf = (id: string): number =>
      Number(after.items.find((item) => item['remote_id'] === id)?.['seq']);
    expect(seqOf('OBJ-FOR-SALE')).toBeLessThan(seqOf('OBJ-SOLD'));
  });

  it('fires a bell on demand', async () => {
    await ring(TENANT, 'forcerefresh');
    await until(() => running.bells.length > 0, 'the bell');
    await flushBells();
  });

  it('answers the event timeline query', async () => {
    crm.put('property', 'OBJ-1', property('OBJ-1'));
    await event('connection_added');
    await until(async () => {
      await drainFetchList();
      return (await pull(running.baseUrl, 'property')).items.length === 1;
    }, 'the property');

    const timeline = await queryEvents({
      entity: { connectionId: CONNECTION, datatype: 'property', remoteId: 'OBJ-1' },
    });
    expect(timeline.map((row) => row.type)).toContain('entity.written');
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

  it('answers anyone with counts and plain words, and keeps the names for the alerts (question 62)', async () => {
    await heartbeat();
    await db().query("update subscribers set last_pull_at = now() - interval '2 hours'");

    const response = await fetch(`${running.baseUrl}/v1/health`);
    const text = await response.text();
    const body = JSON.parse(text) as { checks: Record<string, { detail?: string }> };
    expect(response.status).toBe(500);
    expect(body.checks['subscribers']).toEqual({
      ok: false,
      detail: '1 site(s) have not pulled for an hour',
    });
    expect(text).not.toContain('test site');

    expect((await healthReport()).checks['subscribers']?.names).toEqual(['test site']);
  });
});

describe('alerts', () => {
  const config = {
    environment: 'test',
    publicUrl: 'https://core.example',
    email: 'ops@example.test',
    slackWebhookUrl: null,
  };

  it('tells a change of a health check once, by mail with the names, and its recovery once', async () => {
    await heartbeat();
    await db().query("update subscribers set last_pull_at = now() - interval '2 hours'");

    const red = await checkAlerts(config);
    expect(red.map((change) => change.name)).toContain('subscribers');
    expect(running.mails).toHaveLength(1);
    expect(running.mails[0]?.subject).toContain('1 check(s) failing');
    expect(running.mails[0]?.text).toContain(
      'the check subscribers turned red: 1 site(s) have not pulled for an hour (test site)',
    );
    expect(running.mails[0]?.text).toContain('https://core.example/v1/health');
    // Each site it names, with its tenant and its place on the tenant's page (question 163).
    expect(running.mails[0]?.text).toContain(
      'site test site, tenant Test tenant: https://core.example/admin/tenants/1#site:1',
    );

    // Still red: told once, not every minute.
    expect(await checkAlerts(config)).toEqual([]);
    expect(running.mails).toHaveLength(1);

    await pull(running.baseUrl, 'property');
    const green = await checkAlerts(config);
    expect(green).toEqual([{ name: 'subscribers', ok: true, detail: null, names: [] }]);
    expect(running.mails[1]?.subject).toContain('all checks green again');
    // A check turning green names no thing: the message is its sentence and the health page.
    expect(running.mails[1]?.text).toBe(
      'the check subscribers is green again\n\nhttps://core.example/v1/health',
    );

    // Each change is an event too, so the Overview can list a site that stopped pulling for a week.
    const changes = await queryEvents({ type: 'check.failed' });
    expect(changes.map((event) => event.fields)).toEqual([
      {
        name: 'subscribers',
        detail: '1 site(s) have not pulled for an hour',
        names: ['test site'],
        sites: [{ id: 1, tenantId: 1, label: 'test site' }],
      },
    ]);
    expect((await queryEvents({ type: 'check.recovered' })).map((event) => event.fields)).toEqual([
      { name: 'subscribers', detail: null, names: [] },
    ]);
  });

  it('tells an event that needs attention the moment it is written, naming the thing, where it is, and its link (questions 159 and 163)', async () => {
    await logEvent({
      type: 'office.taken_off',
      connectionId: CONNECTION,
      fields: { office_id: '100', reason: 'it is no longer in the office group the sites use' },
    });
    await until(() => running.mails.length === 1, 'the alert mail');
    expect(running.mails[0]).toEqual({
      to: 'ops@example.test',
      subject: 'Core local: an office was taken off the sites',
      text: [
        `Which: office 100, tenant Test tenant, connection ${CONNECTION}`,
        'What happened: office 100 was taken off the sites: it is no longer in the office group the sites use',
        `Open it: https://core.example/admin/records?connection=${CONNECTION}&office=100&deleted=true&tenant=1`,
      ].join('\n'),
    });
    const sent = await queryEvents({ type: 'alert.sent' });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.fields).toMatchObject({
      type: 'office.taken_off',
      outcomes: { email: 'sent' },
    });

    // An event nobody needs told about stays where it is: in the log alone. A second one that
    // does is told again: once each, not once per kind.
    await logEvent({ type: 'entity.unchanged', connectionId: CONNECTION, fields: {} });
    await logEvent({
      type: 'office.taken_off',
      connectionId: CONNECTION,
      fields: { office_id: '200', reason: 'the id on the connection no longer lists it' },
    });
    await until(() => running.mails.length === 2, 'the second alert mail');
    expect(running.mails[1]?.text).toContain('office 200 was taken off the sites');
    const told = await queryEvents({ type: 'alert.sent' });
    expect(told.map((event) => event.fields['type'])).toEqual([
      'office.taken_off',
      'office.taken_off',
    ]);
  });
});
