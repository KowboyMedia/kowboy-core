// The engine's operations, as the admin panel will call them: lifecycle events, replay and
// recompute, the event timeline, bells, and health.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harness, pull, until, TENANT, type Harness } from './harness.js';
import { fakeWebhookAdapter, drainFetchList } from '../adapters/fake-webhook/index.js';
import * as crm from '../adapters/fake-webhook/crm.js';
import { db } from '../engine/storage/db.js';
import { healthReport, heartbeat } from '../engine/health.js';
import { checkAlerts } from '../engine/alerts.js';
import { attention } from '../engine/attention.js';
import { summarise } from '../engine/admin/summary.js';
import { flushBells, ring } from '../engine/bells.js';
import { queueLifecycle } from '../engine/lifecycle.js';
import type { LifecycleEvent } from '../engine/adapter-api/types.js';
import { logEvent, queryEvents } from '../engine/events.js';
import { recompute } from '../engine/recompute.js';
import { NOT_LIVE } from '../engine/registry.js';

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
  /** The test site as Core last told it about changes and as it last fetched, so long ago. */
  const site = (told: string | null, fetched: string | null): Promise<unknown> =>
    db().query(
      `update subscribers set
         last_bell_at = case when $1::text is null then null else now() - $1::interval end,
         last_pull_at = case when $2::text is null then null else now() - $2::interval end`,
      [told, fetched],
    );

  it('is 500 only while Core is down for every customer, and 200 otherwise (AC 17, question 173)', async () => {
    // The worker has never reported: a P0, Core is down.
    const failing = await fetch(`${running.baseUrl}/v1/health`);
    expect(failing.status).toBe(500);
    const failingBody = (await failing.json()) as {
      ok: boolean;
      checks: Record<string, { ok: boolean }>;
    };
    expect(failingBody.ok).toBe(false);
    expect(failingBody.checks['worker']?.ok).toBe(false);

    await heartbeat();
    const passing = await fetch(`${running.baseUrl}/v1/health`);
    const passingBody = (await passing.json()) as { ok: boolean; checks: Record<string, unknown> };
    expect(passing.status).toBe(200);
    expect(passingBody.ok).toBe(true);
    expect(Object.keys(passingBody.checks)).toContain('fake-webhook.webhook_lag');

    // A site behind is one customer cut off, a P1: the payload says so, the answer stays 200.
    await site('2 hours', '3 hours');
    const behind = await fetch(`${running.baseUrl}/v1/health`);
    const behindBody = (await behind.json()) as {
      ok: boolean;
      checks: Record<string, { ok: boolean }>;
    };
    expect(behind.status).toBe(200);
    expect(behindBody.ok).toBe(false);
    expect(behindBody.checks['subscribers']?.ok).toBe(false);
  });

  it('answers anyone with counts and plain words, and keeps the names for the alerts (question 62)', async () => {
    await heartbeat();
    await site('2 hours', '3 hours');

    const response = await fetch(`${running.baseUrl}/v1/health`);
    const text = await response.text();
    const body = JSON.parse(text) as { checks: Record<string, { detail?: string }> };
    expect(body.checks['subscribers']).toEqual({
      ok: false,
      detail:
        'Core told 1 site about changes over an hour ago, and it has not fetched them since, so it may show homes that have changed or are gone.',
    });
    expect(text).not.toContain('test site');

    const report = await healthReport();
    expect(report.checks['subscribers']?.names).toEqual(['test site']);
    expect(report.checks['subscribers']?.level).toBe('P1');
  });

  it('finds a site behind only when Core told it about changes over an hour ago and it has not fetched since (question 172)', async () => {
    await heartbeat();
    const behind = async (): Promise<boolean> =>
      !((await healthReport()).checks['subscribers']?.ok ?? true);

    // A quiet site: nothing new, so it is not told, and does not fetch for hours. That is fine.
    await site(null, '3 hours');
    expect(await behind()).toBe(false);
    // Told five minutes ago, after a fetch three hours ago: it has the hour to fetch.
    await site('5 minutes', '3 hours');
    expect(await behind()).toBe(false);
    // Told over an hour ago and again since: the first message counts, from the event log.
    await logEvent({
      type: 'bell',
      tenantId: TENANT,
      subscriberId: 1,
      fields: { kind: 'delta', status: 'ok' },
    });
    await db().query("update events set at = now() - interval '2 hours' where type = 'bell'");
    expect(await behind()).toBe(true);
    // A message from before its last fetch counts for nothing.
    await site('5 minutes', '90 minutes');
    expect(await behind()).toBe(false);
    // It fetched after it was told.
    await site('2 hours', '1 minute');
    expect(await behind()).toBe(false);
    // Told two hours ago, and it never fetched at all.
    await site('2 hours', null);
    expect(await behind()).toBe(true);
  });
});

describe('alerts', () => {
  const config = {
    environment: 'test',
    publicUrl: 'https://core.example',
    email: 'ops@example.test',
    slackWebhookUrl: null,
  };

  /** Make a problem older, as if the round had first seen it that long ago. */
  const aged = (key: string, by: string): Promise<unknown> =>
    db().query(`update alert_state set since = since - $2::interval where name = $1`, [key, by]);

  const behind = (): Promise<unknown> =>
    db().query(
      "update subscribers set last_bell_at = now() - interval '2 hours', last_pull_at = now() - interval '3 hours'",
    );

  it('tells a problem once it has lasted its wait, once, and its end once (rules A and D)', async () => {
    await heartbeat();
    await behind();

    // P1 waits 15 minutes: the problem opens, and only the event log knows.
    expect((await checkAlerts(config)).opened).toEqual(['subscribers:1']);
    expect(running.mails).toHaveLength(0);

    await aged('subscribers:1', '16 minutes');
    await checkAlerts(config);
    expect(running.mails).toHaveLength(1);
    expect(running.mails[0]?.subject).toBe('Core test: P1 · A site is not fetching its changes');
    expect(running.mails[0]?.text).toBe(
      [
        'P1 · A site is not fetching its changes',
        'Which: site test site, of Test tenant',
        'What happened: Core told the site about changes over an hour ago, and it has not fetched them since, so it may show homes that have changed or are gone. Its last fetch was 3 hours ago. Check that the site is up and that its plugin reaches Core.',
        'Open it: https://core.example/admin/tenants/1#site:1',
      ].join('\n'),
    );

    // Still behind: told once, not every minute.
    await checkAlerts(config);
    expect(running.mails).toHaveLength(1);

    await pull(running.baseUrl, 'property');
    expect((await checkAlerts(config)).closed).toEqual(['subscribers:1']);
    expect(running.mails[1]?.subject).toBe(
      'Core test: Resolved · A site is not fetching its changes',
    );
    expect(running.mails[1]?.text.split('\n')[0]).toBe(
      'Resolved after 16 minutes · A site is not fetching its changes',
    );

    // The start and the end are events, so the Overview lists the site for a week.
    expect((await queryEvents({ type: 'check.failed' })).map((event) => event.fields)).toEqual([
      {
        name: 'subscribers',
        detail:
          'Core told the site about changes over an hour ago, and it has not fetched them since, so it may show homes that have changed or are gone. Its last fetch was 3 hours ago. Check that the site is up and that its plugin reaches Core.',
        names: ['test site'],
        which: 'site test site, of Test tenant',
        sites: [{ id: 1, tenantId: 1, label: 'test site' }],
      },
    ]);
    expect((await queryEvents({ type: 'check.recovered' })).map((event) => event.fields)).toEqual([
      {
        name: 'subscribers',
        detail: 'a site is not fetching its changes, site test site, of Test tenant',
      },
    ]);
  });

  it('holds everything but a P0 while Core is down, and tells nothing of a problem that ends before its wait (rules A and B)', async () => {
    // A site that catches up within its 15 minutes is only in the event log.
    await heartbeat();
    await behind();
    await checkAlerts(config);
    await pull(running.baseUrl, 'property');
    expect((await checkAlerts(config)).closed).toEqual(['subscribers:1']);
    expect(running.mails).toHaveLength(0);
    expect(await queryEvents({ type: 'check.recovered' })).toHaveLength(1);

    // The worker stops reporting (a P0) while a site is behind (a P1).
    await db().query("update heartbeats set at = now() - interval '10 minutes'");
    await behind();
    expect((await checkAlerts(config)).opened).toEqual(['worker', 'subscribers:1']);
    await aged('worker', '6 minutes');
    await aged('subscribers:1', '16 minutes');
    await checkAlerts(config);
    expect(running.mails).toHaveLength(1);
    expect(running.mails[0]?.subject).toBe('Core test: P0 · Core’s worker');
    expect(running.mails[0]?.text).toContain('Open it: https://core.example/admin/settings');
    expect(running.mails[0]?.text).not.toContain('test site');

    // Core is back: the end of the P0 and the site, held until now, go in one mail.
    await heartbeat();
    await checkAlerts(config);
    expect(running.mails).toHaveLength(2);
    expect(running.mails[1]?.subject).toBe(
      'Core test: 1 problem, the worst P1; 1 problem resolved',
    );
    expect(running.mails[1]?.text).toContain('Resolved after 6 minutes · Core’s worker');
    expect(running.mails[1]?.text).toContain('P1 · A site is not fetching its changes');
  });

  it('tells an event that needs attention by its level: P1 at the next round, one line per cause, P2 in the 07:00 mail (questions 163 and 164)', async () => {
    await heartbeat();
    // The first round starts reading the event log from now: nothing older is told again.
    await logEvent({ type: 'login.refused', connectionId: CONNECTION, fields: { detail: 'old' } });
    await db().query(
      "update events set at = now() - interval '5 minutes' where type = 'login.refused'",
    );
    await checkAlerts(config);
    expect(running.mails).toHaveLength(0);

    // Vitec refused office 100, and a day later both offices left with one cause: one line, P1,
    // because the CRM still refused one of them (row 20).
    await logEvent({
      type: 'office.blocked',
      connectionId: CONNECTION,
      fields: { office_id: '100', connection_id: CONNECTION, detail: 'refused' },
    });
    for (const [id, name] of [
      ['100', 'Lidingö'],
      ['200', ''],
    ]) {
      await logEvent({
        type: 'office.taken_off',
        connectionId: CONNECTION,
        correlationId: 'check-1',
        fields: {
          office_id: id,
          ...(name ? { office_name: name } : {}),
          reason: 'the CRM still refused them at the next daily check',
        },
      });
    }
    // Paused after failures: P2, for the 07:00 mail.
    await logEvent({
      type: 'connection.paused',
      connectionId: CONNECTION,
      fields: { failures: 5, detail: 'the CRM did not answer' },
    });
    // A visitor's form the CRM did not take: P1, linked to Failed forms (row 22).
    await logEvent({
      type: 'submission.failed',
      correlationId: 'form-1',
      tenantId: TENANT,
      connectionId: CONNECTION,
      fields: { kind: 'viewing', detail: 'it did not answer within 20 seconds' },
    });
    // A form Core held back outside production never left Core: no problem, told nowhere.
    await logEvent({
      type: 'submission.refused',
      correlationId: 'form-2',
      tenantId: TENANT,
      connectionId: CONNECTION,
      fields: { kind: 'interest', reason: NOT_LIVE },
    });
    // The round reads up to ten seconds ago, so an event being written is never passed over.
    await db().query(
      "update alert_state set since = since - interval '1 minute' where name = 'alerts:events'",
    );
    await db().query(
      "update events set at = at - interval '20 seconds' where type <> 'login.refused'",
    );

    await checkAlerts(config);
    expect(running.mails).toHaveLength(1);
    expect(running.mails[0]?.subject).toBe('Core test: 2 problems, the worst P1');
    expect(running.mails[0]?.text).toBe(
      [
        'P1 · An office was taken off the sites',
        'Which: offices Lidingö (the CRM’s office id 100) and the CRM’s office id 200',
        `Where: Test tenant’s Fake-webhook connection, short name ${CONNECTION}`,
        'What happened: 2 offices were taken off the sites, with their homes and agents: the CRM still refused them at the next daily check. Each office comes back on the sites, with its homes and agents, once the CRM lets this connection read it again, which Core checks once a day. Ask the brokerage to check the login’s access to it in the CRM.',
        'Open it: https://core.example/admin/records?tenant=1&office=100,200&deleted=true',
        '',
        'P1 · A visitor’s form did not reach the CRM',
        'Which: a viewing booking a visitor sent',
        `Where: Test tenant’s Fake-webhook connection, short name ${CONNECTION}`,
        'What happened: A viewing booking could not be sent to the CRM: it did not answer within 20 seconds. The brokerage does not have it yet. Failed forms keeps it for 30 days with what the visitor wrote; send it again there once the CRM answers.',
        'Open it: https://core.example/admin/forms',
      ].join('\n'),
    );
    const sent = await queryEvents({ type: 'alert.sent' });
    expect(sent[0]?.fields).toMatchObject({ outcomes: { email: 'sent' } });

    // Told once.
    await checkAlerts(config);
    expect(running.mails).toHaveLength(1);

    // The next 07:00 mail carries the P2 things written since the last one.
    await db().query(
      "update alert_state set since = now() - interval '2 days' where name = 'alerts:morning'",
    );
    await checkAlerts(config);
    expect(running.mails).toHaveLength(2);
    expect(running.mails[1]?.subject).toBe('Core test: 1 thing to look at');
    expect(running.mails[1]?.text).toContain(
      'P2 · Core paused a connection because the CRM kept failing',
    );
    expect(running.mails[1]?.text).not.toContain('office');
    // Once a day.
    await checkAlerts(config);
    expect(running.mails).toHaveLength(2);
  });

  it('keeps the sites behind open while the sites check cannot run, and counts that from its first failed run (rule E)', async () => {
    await heartbeat();
    await behind();
    await checkAlerts(config);
    await aged('subscribers:1', '16 minutes');
    await checkAlerts(config);
    expect(running.mails).toHaveLength(1);

    // The sites check's query fails: it cannot say which sites are behind.
    await db().query('alter table subscribers rename column last_bell_at to told_at');
    try {
      expect((await checkAlerts(config)).closed).toEqual([]);
      expect(running.mails).toHaveLength(1);
      // An old problem does not make it P1: its 15 minutes run from its own first failed run.
      await aged('subscribers', '3 days');
      expect((await healthReport()).checks['subscribers']).toMatchObject({
        ok: false,
        level: 'P2',
      });
      vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 16 * 60_000 });
      try {
        expect((await healthReport()).checks['subscribers']?.level).toBe('P1');
      } finally {
        vi.useRealTimers();
      }
      // The check that could not run names no site, so it is no line on "Needs attention".
      expect((await attention()).map((line) => line.what)).toEqual(['site test site']);
    } finally {
      await db().query('alter table subscribers rename column told_at to last_bell_at');
    }

    // It runs again and the site is still behind: still open, nothing told again.
    expect((await checkAlerts(config)).closed).toEqual(['subscribers']);
    expect(running.mails).toHaveLength(1);
  });

  it('ends a problem kept before the levels without a word, and gives one still open its words (review of question 172)', async () => {
    await db().query("update heartbeats set at = now() - interval '10 minutes'");
    await behind();
    await db().query(
      `insert into alert_state (name, ok, detail, since, notified_at) values
         ('subscribers', false, '1 site(s) have not pulled for an hour', now() - interval '3 days', now() - interval '3 days'),
         ('worker', false, 'worker heartbeat is stale', now() - interval '1 hour', now() - interval '1 hour')`,
    );
    expect(await checkAlerts(config)).toEqual({ opened: ['subscribers:1'], closed: [] });
    expect(running.mails).toHaveLength(0);
    expect(await queryEvents({ type: 'check.recovered' })).toHaveLength(0);
    const { rows } = await db().query<{ detail: string }>(
      "select detail from alert_state where name = 'worker'",
    );
    expect(JSON.parse(rows[0]?.detail ?? '')).toMatchObject({ title: 'Core’s worker' });

    // Told an hour ago, so its end is told, in its words now.
    await heartbeat();
    await checkAlerts(config);
    expect(running.mails).toHaveLength(1);
    expect(running.mails[0]?.subject).toBe('Core test: Resolved · Core’s worker');
  });

  it('runs one round at a time: one held by another worker is skipped, and taken over once it is held too long (rule D)', async () => {
    await heartbeat();
    await behind();
    await checkAlerts(config);
    await aged('subscribers:1', '16 minutes');
    // Another worker, during a deploy, is half way through a round.
    await db().query(
      "insert into alert_state (name, ok, since) values ('alerts:turn', true, now())",
    );
    expect(await checkAlerts(config)).toEqual({ opened: [], closed: [] });
    expect(running.mails).toHaveLength(0);
    // It stopped half way: two minutes later its turn is taken over.
    await aged('alerts:turn', '3 minutes');
    await checkAlerts(config);
    expect(running.mails).toHaveLength(1);
    // A round gives its turn back when it ends.
    const { rowCount } = await db().query("select 1 from alert_state where name = 'alerts:turn'");
    expect(rowCount).toBe(0);
  });

  it('says which channel an alert went by, and which it could not go by', () => {
    const subject = 'Core test: P1 · A site is not fetching its changes';
    expect(summarise('alert.sent', { subject, outcomes: { email: 'sent', slack: 'sent' } })).toBe(
      `Core sent the alert “${subject}” by mail and Slack`,
    );
    expect(
      summarise('alert.sent', {
        subject,
        outcomes: { email: 'sent', slack: 'failed: Error: slack answered 404' },
      }),
    ).toBe(
      `Core sent the alert “${subject}” by mail, but could not send it by Slack; Settings shows where alerts go`,
    );
    expect(summarise('alert.sent', { subject, outcomes: {} })).toBe(
      `Core had the alert “${subject}” to send, but neither mail nor Slack is set up in Settings`,
    );
  });
});
