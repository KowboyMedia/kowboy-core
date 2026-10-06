// Form submissions (docs/forms.md, approved with question 130; AC 43 to 47 and 49): a site's
// form reaches the CRM through Core and the CRM's answer reaches the visitor, proved against the
// fake polling CRM, which takes every kind, and the fake webhook CRM, which takes none.
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harness, healthReport, pull, until, HUMAN_TOKEN, TOKEN, type Harness } from './harness.js';
import { fakePollingAdapter, poll } from '../adapters/fake-polling/index.js';
import { fakeWebhookAdapter } from '../adapters/fake-webhook/index.js';
import * as crm from '../adapters/fake-polling/crm.js';
import { queryEvents } from '../engine/events.js';
import { createTenant, upsertConnection } from '../engine/storage/connections.js';
import { validateSlots } from '../engine/contract.js';
import {
  configureSubmissions,
  NOT_LIVE,
  SUBMISSIONS_PER_MINUTE,
  UNANSWERED_MS,
} from '../engine/http/submissions.js';
import { db } from '../engine/storage/db.js';
import {
  claimAgain,
  contentOf,
  deleteExpiredSubmissions,
  KEPT_DAYS,
  type SubmissionRow,
} from '../engine/storage/submissions.js';
import type { FailedForm } from '../engine/admin/forms.js';
import { registerSubmissions } from '../engine/registry.js';
import { configureHumanCheck } from '../engine/human.js';

const CONNECTION = 'polling-acme';
const OTHER = 'webhook-acme';
const HOME = 'P-1';
const OFFICE = 'B-1';

const home = {
  object_id: HOME,
  stage: 'active',
  object_type: 'flat',
  street: 'Kungsgatan 1',
  price: 7250000,
  branch_id: OFFICE,
  districts: ['D-1'],
  staff: [],
  coop_id: null,
};

const person = {
  first_name: 'Anna',
  last_name: 'Svensson',
  email: 'anna@example.se',
  phone: '0701234567',
  address: { street: 'Storgatan 1', postal_code: '211 22', city: 'Malmö' },
};

const record = { datatype: 'property', connection_id: CONNECTION, remote_id: HOME };

const criteria = {
  object_type: 'apartment',
  rooms_min: 2,
  living_area_min: 75,
  areas: [{ id: 'D-1', name: 'Centrum', county_municipality_code: '1280' }],
  county_municipality_code: '1280',
};

const submission = (
  kind: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> => ({
  id: randomUUID(),
  kind,
  person,
  message: 'Hej! Jag vill veta mer.',
  consent: { given: true, at: '2026-10-04T10:00:00Z' },
  source: {
    page: 'https://site.example/objekt/till-salu-malmo-kungsgatan-1-P-1',
    utm: { utm_source: 'hemnet' },
  },
  ...extra,
});

let running: Harness;
let posted = 0;

/** A form as the site's server passes it on: the token, and the proof the window earned. */
const post = async (
  body: unknown,
  human: string | null = HUMAN_TOKEN,
): Promise<{ status: number; body: Record<string, unknown> }> => {
  posted += 1;
  const response = await fetch(`${running.baseUrl}/v1/submissions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${TOKEN}`,
      'content-type': 'application/json',
      'x-core-client': 'test-site/1.0',
      ...(human === null ? {} : { 'x-core-human': human }),
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
};

const slots = async (
  query: Record<string, string>,
): Promise<{ status: number; body: Record<string, unknown> }> => {
  const response = await fetch(
    `${running.baseUrl}/v1/submissions/slots?${new URLSearchParams(query).toString()}`,
    { headers: { authorization: `Bearer ${TOKEN}` } },
  );
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
};

const timeline = () =>
  queryEvents({ entity: { connectionId: CONNECTION, datatype: 'property', remoteId: HOME } });

/**
 * Every character Core wrote about the forms in plain text: the events, the outcomes table. A form
 * the CRM has not taken is kept encrypted (question 160 a); that text is proved unreadable on its
 * own, so here it counts only as kept or not.
 */
const everythingStored = async (): Promise<string> => {
  const events = await queryEvents({ tenantId: 1, limit: 5000 });
  const rows = (await db().query<SubmissionRow>('select * from submissions')).rows.map(
    ({ content, ...row }) => ({ ...row, kept: content !== null }),
  );
  return JSON.stringify({ events, rows });
};

/** A person signed in to the admin area the way the admin suite does it: the mailed link's cookie. */
async function adminCookie(): Promise<string> {
  const before = running.mails.length;
  await fetch(`${running.baseUrl}/v1/admin/sign-in`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'tester@kowboy.se' }),
  });
  const path = /\/v1\/admin\/sign-in\/[A-Za-z0-9_-]+/.exec(running.mails[before]?.text ?? '')?.[0];
  if (!path) throw new Error('no sign-in link was mailed');
  const opened = await fetch(`${running.baseUrl}${path}`, { redirect: 'manual' });
  return (opened.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
}

/** One call to the admin area's API with that cookie. */
const admin = async <T>(
  cookie: string,
  path: string,
  method: 'GET' | 'POST' = 'GET',
): Promise<{ status: number; body: T }> => {
  const response = await fetch(`${running.baseUrl}/v1/admin${path}`, {
    method,
    headers: { cookie },
  });
  return { status: response.status, body: (await response.json()) as T };
};

beforeEach(async () => {
  crm.reset();
  posted = 0;
  running = await harness({
    adapters: [fakePollingAdapter, fakeWebhookAdapter],
    connections: [{ id: CONNECTION, provider: 'fake-polling', licensedOffices: [OFFICE] }],
  });
  crm.put('property', HOME, home);
  await poll();
  await until(
    async () => (await pull(running.baseUrl, 'property')).items.length === 1,
    'the home to be in Core',
  );
});

afterEach(async () => {
  vi.restoreAllMocks();
  await running.stop();
});

describe('submissions', () => {
  it('a lead, an interest and a viewing reach the CRM with every field mapped, and answer delivered with the CRM’s reference', async () => {
    // The tenant has one office, so the lead names none and Core fills it in.
    const lead = await post(submission('lead'));
    expect(lead.status).toBe(200);
    expect(lead.body).toMatchObject({ status: 'delivered', reference: 'C-1' });

    const interest = await post(submission('interest', { record }));
    expect(interest.status).toBe(200);
    expect(interest.body).toMatchObject({ status: 'delivered', reference: 'C-2' });

    const viewing = await post(
      submission('viewing', { record, slot_id: 'T-1', contact_about_current_home: true }),
    );
    expect(viewing.status).toBe(200);
    expect(viewing.body).toMatchObject({ status: 'delivered', reference: 'C-3' });

    const forms = crm.formsTaken();
    expect(forms.map((form) => form.form)).toEqual(['CONTACT', 'INTEREST', 'SHOWING_BOOKING']);
    for (const form of forms) {
      expect(form.payload).toMatchObject({
        given_name: 'Anna',
        family_name: 'Svensson',
        mail: 'anna@example.se',
        mobile: '0701234567',
        street: 'Storgatan 1',
        zip: '211 22',
        town: 'Malmö',
        note: 'Hej! Jag vill veta mer.',
        consent_at: '2026-10-04T10:00:00Z',
        page: 'https://site.example/objekt/till-salu-malmo-kungsgatan-1-P-1',
        tags: { utm_source: 'hemnet' },
      });
    }
    expect(forms[0]?.payload).toMatchObject({ branch_id: OFFICE, object_id: null });
    expect(forms[1]?.payload).toMatchObject({ object_id: HOME, showing_time_id: null });
    expect(forms[2]?.payload).toMatchObject({
      object_id: HOME,
      showing_time_id: 'T-1',
      sell_current: true,
    });

    // The home's timeline carries the interest and the viewing, each in its own chain.
    const events = await timeline();
    const types = events.filter((event) => event.type.startsWith('submission.')).map((e) => e.type);
    expect(types).toEqual([
      'submission.received',
      'submission.delivered',
      'submission.received',
      'submission.delivered',
    ]);
    const chain = events.filter((event) => event.correlation_id === interest.body['id']);
    expect(chain.map((event) => event.type)).toEqual([
      'submission.received',
      'submission.delivered',
    ]);
    expect(chain[1]?.fields).toMatchObject({ kind: 'interest', reference: 'C-2' });
  });

  it('a refusal and a failure reach the visitor and the timeline without the person, and submissions.failing turns red then green', async () => {
    const printed = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    crm.answerNext({ refuse: 'The showing is fully booked' });
    const refused = await post(submission('viewing', { record, slot_id: 'T-1' }));
    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({
      status: 'refused',
      reason: 'The showing is fully booked',
    });
    expect((await healthReport()).checks['submissions.failing']?.ok).toBe(true);

    crm.answerNext({ fail: 'connection refused' });
    const failed = await post(submission('interest', { record }));
    expect(failed.status).toBe(502);
    expect(failed.body).toMatchObject({ status: 'failed' });
    expect(failed.body['reason']).toBeUndefined();

    const events = await timeline();
    const said = events.filter((event) => event.type.startsWith('submission.'));
    expect(said.map((event) => event.type)).toEqual([
      'submission.received',
      'submission.refused',
      'submission.received',
      'submission.failed',
    ]);
    expect(said[1]?.fields).toMatchObject({
      kind: 'viewing',
      reason: 'The showing is fully booked',
    });
    expect(said[3]?.fields).toMatchObject({ kind: 'interest', detail: 'connection refused' });

    // Nothing about the person in plain text anywhere Core writes: the events, the table, the
    // error tracker.
    const stored = await everythingStored();
    const tracker = printed.mock.calls.map((call) => call.map(String).join(' ')).join('\n');
    expect(tracker).toContain('connection refused');
    for (const personal of ['Anna', 'Svensson', 'anna@example.se', '0701234567', 'Storgatan']) {
      expect(stored).not.toContain(personal);
      expect(tracker).not.toContain(personal);
    }
    expect(crm.formsTaken()).toHaveLength(0);

    // Red while the latest submission to the connection failed; green on the next delivery.
    const red = (await healthReport()).checks['submissions.failing'];
    expect(red?.ok).toBe(false);
    expect(red?.names).toEqual([CONNECTION]);
    expect(red?.detail).not.toContain(CONNECTION);

    const delivered = await post(submission('lead'));
    expect(delivered.status).toBe(200);
    expect((await healthReport()).checks['submissions.failing']?.ok).toBe(true);
  });

  it('a form keeps its details encrypted until the CRM takes it, and one the CRM refused or did not take keeps them for 30 days', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const row = async (body: Record<string, unknown>): Promise<SubmissionRow | undefined> =>
      (await db().query<SubmissionRow>('select * from submissions where id = $1', [body['id']]))
        .rows[0];

    // Taken: the outcome stays, the details go.
    const taken = submission('interest', { record });
    expect((await post(taken)).status).toBe(200);
    expect(await row(taken)).toMatchObject({ outcome: 'delivered', content: null });

    // Refused, and not answered: each keeps the form as the site sent it, with the office Core
    // found for it, and none of it reads without the key.
    crm.answerNext({ refuse: 'The showing is fully booked' });
    const refused = submission('viewing', { record, slot_id: 'T-1' });
    expect((await post(refused)).status).toBe(409);
    crm.answerNext({ fail: 'connection refused' });
    const failed = submission('interest', { record });
    expect((await post(failed)).status).toBe(502);
    for (const body of [refused, failed]) {
      const kept = await row(body);
      expect(kept?.content).toEqual(expect.any(String));
      for (const plain of ['anna@example.se', 'Malmö', '211 22', 'Hej! Jag vill veta mer.']) {
        expect(kept?.content).not.toContain(plain);
      }
      expect(kept && contentOf(kept)).toEqual({ ...body, office_id: OFFICE });
    }

    // After 30 days the details go, whatever the log's retention; the outcome stays with the log.
    await db().query(
      `update submissions set received_at = now() - ($2 || ' days')::interval where id = $1`,
      [refused['id'], KEPT_DAYS + 1],
    );
    await deleteExpiredSubmissions(KEPT_DAYS * 3);
    expect(await row(refused)).toMatchObject({ outcome: 'refused', content: null });
    expect((await row(failed))?.content).toEqual(expect.any(String));
  });

  it('the admin area lists the forms the CRM did not take, with what the visitor wrote and why, and sends one again once at a time', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    crm.answerNext({ refuse: 'The showing is fully booked' });
    const refused = submission('viewing', { record, slot_id: 'T-1' });
    expect((await post(refused)).status).toBe(409);
    crm.answerNext({ fail: 'connection refused' });
    const failed = submission('interest', { record });
    expect((await post(failed)).status).toBe(502);
    expect((await post(submission('lead'))).status).toBe(200);

    // Newest first; a form the CRM took is not listed. Each with the whole form and what was said.
    const cookie = await adminCookie();
    expect((await admin(cookie.replace(/=.*/, '=nobody'), '/forms')).status).toBe(401);
    const listed = await admin<{ data: FailedForm[] }>(cookie, '/forms');
    expect(listed.status).toBe(200);
    expect(listed.body.data.map((form) => form.id)).toEqual([failed['id'], refused['id']]);
    expect(listed.body.data[0]).toMatchObject({
      outcome: 'failed',
      said: 'connection refused',
      kind: 'interest',
      tenantId: 1,
      connectionId: CONNECTION,
      remoteId: HOME,
      form: { ...failed, office_id: OFFICE },
    });
    expect(listed.body.data[1]).toMatchObject({
      outcome: 'refused',
      said: 'The showing is fully booked',
      form: { ...refused, office_id: OFFICE },
    });

    // Sent again and taken: it leaves the list, its details go, and the chain says who sent it.
    const sent = await admin<{ data: Record<string, unknown> }>(
      cookie,
      `/forms/${String(failed['id'])}/send-again`,
      'POST',
    );
    expect(sent.status).toBe(200);
    expect(sent.body.data).toMatchObject({ outcome: 'delivered', reference: 'C-2' });
    expect(crm.formsTaken().map((form) => form.form)).toEqual(['CONTACT', 'INTEREST']);
    expect(
      (await admin<{ data: FailedForm[] }>(cookie, '/forms')).body.data.map((form) => form.id),
    ).toEqual([refused['id']]);
    const chain = await queryEvents({ correlationId: failed['id'] as string });
    expect(chain.map((event) => event.type)).toEqual([
      'submission.received',
      'submission.failed',
      'submission.delivered',
      'admin.form_sent_again',
    ]);
    expect(chain[3]?.fields).toMatchObject({ by: 'tester@kowboy.se', outcome: 'delivered' });
    const again = await admin<{ error: string }>(
      cookie,
      `/forms/${String(failed['id'])}/send-again`,
      'POST',
    );
    expect(again.status).toBe(404);
    expect((await admin(cookie, '/forms/no-such-form/send-again', 'POST')).status).toBe(404);

    // Refused again: it stays, with the CRM's new reason.
    crm.answerNext({ refuse: 'Still fully booked' });
    const still = await admin<{ data: Record<string, unknown> }>(
      cookie,
      `/forms/${String(refused['id'])}/send-again`,
      'POST',
    );
    expect(still.body.data).toMatchObject({ outcome: 'refused', detail: 'Still fully booked' });
    expect((await admin<{ data: FailedForm[] }>(cookie, '/forms')).body.data).toMatchObject([
      { id: refused['id'], outcome: 'refused', said: 'Still fully booked' },
    ]);

    // One send at a time: a second claim while the first is on its way gets nothing, and a press
    // then says so; Core stopping before the CRM answered lists it again after twice the CRM's time.
    expect(await claimAgain(refused['id'] as string, UNANSWERED_MS)).not.toBeNull();
    expect(await claimAgain(refused['id'] as string, UNANSWERED_MS)).toBeNull();
    const busy = await admin<{ error: string }>(
      cookie,
      `/forms/${String(refused['id'])}/send-again`,
      'POST',
    );
    expect(busy.status).toBe(409);
    expect((await admin<{ data: FailedForm[] }>(cookie, '/forms')).body.data).toEqual([]);
    await db().query(
      `update submissions set answered_at = now() - ($2 || ' milliseconds')::interval where id = $1`,
      [refused['id'], UNANSWERED_MS + 1000],
    );
    expect((await admin<{ data: FailedForm[] }>(cookie, '/forms')).body.data).toMatchObject([
      { id: refused['id'], outcome: 'unanswered', answeredAt: null },
    ]);
    const recovered = await admin<{ data: Record<string, unknown> }>(
      cookie,
      `/forms/${String(refused['id'])}/send-again`,
      'POST',
    );
    expect(recovered.body.data).toMatchObject({ outcome: 'delivered' });
    expect((await admin<{ data: FailedForm[] }>(cookie, '/forms')).body.data).toEqual([]);
  });

  it('the same id posted twice sends once and answers the same outcome', async () => {
    const body = submission('interest', { record });
    // A double click: both requests in flight at once.
    const [first, second] = await Promise.all([post(body), post(body)]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    // And a retry later.
    const third = await post(body);
    expect(third.body).toEqual(first.body);
    expect(crm.formsTaken()).toHaveLength(1);

    const chain = await queryEvents({ correlationId: body['id'] as string });
    expect(chain.map((event) => event.type)).toEqual([
      'submission.received',
      'submission.delivered',
    ]);
  });

  it('another tenant’s record, a body outside the schema, a lead without an office, a kind the CRM does not take and the 61st in a minute are refused before any CRM call', async () => {
    // A record of another tenant: the connection is not this tenant's.
    const other = await createTenant({ displayName: 'Other tenant', token: 'other-token' });
    await upsertConnection({
      id: 'other-polling',
      tenantId: other,
      provider: 'fake-polling',
      licensedOffices: ['B-9'],
      credentials: null,
    });
    const foreign = await post(
      submission('interest', { record: { ...record, connection_id: 'other-polling' } }),
    );
    expect(foreign.status).toBe(400);
    expect(foreign.body['error']).toContain('not one of this tenant');

    // A record Core does not hold.
    const unknown = await post(
      submission('interest', { record: { ...record, remote_id: 'P-404' } }),
    );
    expect(unknown.status).toBe(400);

    // Outside the schema: a value off the whitelist, a missing consent, an unknown field.
    const offList = await post(
      submission('search_profile', { record, criteria: { ...criteria, living_area_min: 78 } }),
    );
    expect(offList.status).toBe(400);
    expect(JSON.stringify(offList.body['detail'])).toContain('living_area_min');
    const noConsent = await post(
      submission('lead', { consent: { given: false, at: '2026-10-04T10:00:00Z' } }),
    );
    expect(noConsent.status).toBe(400);
    const extra = await post(submission('lead', { lead_source: 'web' }));
    expect(extra.status).toBe(400);

    // A tenant with several offices needs the office named on a lead.
    await running.connection({ id: OTHER, provider: 'fake-webhook', licensedOffices: ['100'] });
    const noOffice = await post(submission('lead'));
    expect(noOffice.status).toBe(400);
    expect(noOffice.body['error']).toContain('office_id is required');

    // A kind the CRM does not take: the webhook CRM lists no submissions at all.
    const notTaken = await post(submission('lead', { office_id: '100' }));
    expect(notTaken.status).toBe(501);
    expect(notTaken.body['error']).toContain('takes no lead');

    expect(crm.formsTaken()).toHaveLength(0);

    // The limit: every post from this token counts, the refused ones above included.
    while (posted < SUBMISSIONS_PER_MINUTE) {
      const taken = await post(submission('interest', { record }));
      expect(taken.status).toBe(200);
    }
    const over = await post(submission('interest', { record }));
    expect(over.status).toBe(429);
    expect(crm.formsTaken()).toHaveLength(SUBMISSIONS_PER_MINUTE - 7);
  });

  it('a Core that is not the live service refuses every form before any CRM call, and the visitor reads that it was not sent', async () => {
    configureSubmissions({ live: false });
    // Every call the engine makes to the stand-in's send goes through this.
    const send = vi.fn(fakePollingAdapter.submit);
    registerSubmissions(fakePollingAdapter.manifest.provider, {
      ...fakePollingAdapter,
      submit: send,
    });

    const body = submission('interest', { record });
    const answer = await post(body);
    expect(answer.status).toBe(409);
    expect(answer.body).toEqual({ id: body['id'], status: 'refused', reason: NOT_LIVE });
    // The same id again gets the same answer, and a lead to the office the same.
    expect((await post(body)).body).toEqual(answer.body);
    expect((await post(submission('lead'))).body).toMatchObject({ reason: NOT_LIVE });
    expect(send).not.toHaveBeenCalled();
    expect(crm.formsTaken()).toHaveLength(0);

    // Everything before the CRM call ran as on the live service: the chain is in the timeline.
    const chain = await queryEvents({ correlationId: body['id'] as string });
    expect(chain.map((event) => event.type)).toEqual(['submission.received', 'submission.refused']);
    expect(chain[1]?.fields).toMatchObject({ kind: 'interest', reason: NOT_LIVE });

    // Reading a viewing's times is no write, so it still asks the CRM.
    crm.setShowings(HOME, []);
    expect((await slots({ connection_id: CONNECTION, remote_id: HOME })).status).toBe(200);
  });

  it('the site’s server reads the bot check’s key, and a form without the window’s proof or with a failed one is refused before any CRM call, as is every form on a live Core without the check', async () => {
    const send = vi.fn(fakePollingAdapter.submit);
    registerSubmissions(fakePollingAdapter.manifest.provider, {
      ...fakePollingAdapter,
      submit: send,
    });

    const key = await fetch(`${running.baseUrl}/v1/submissions/bot-check`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(key.status).toBe(200);
    expect(await key.json()).toEqual({
      human: { provider: 'turnstile', site_key: '1x00000000000000000000AA' },
    });
    const anonymous = await fetch(`${running.baseUrl}/v1/submissions/bot-check`);
    expect(anonymous.status).toBe(401);

    const body = submission('interest', { record });
    const missing = await post(body, null);
    expect(missing.status).toBe(403);
    expect(missing.body).toEqual({ error: 'the bot check did not pass' });
    expect((await post(body, 'a-bot')).status).toBe(403);
    // Nothing was kept of either: the same id with the proof goes through.
    expect((await post(body)).status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);

    // The live service with no check set up takes no form at all, and says so to the tracker.
    const printed = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    configureHumanCheck(null);
    const unguarded = await post(submission('interest', { record }));
    expect(unguarded.status).toBe(503);
    expect(unguarded.body).toEqual({ error: 'the bot check is not set up' });
    expect(printed.mock.calls.map(String).join('\n')).toContain('the bot check is not set up');
    expect(send).toHaveBeenCalledTimes(1);
    expect(
      await (
        await fetch(`${running.baseUrl}/v1/submissions/bot-check`, {
          headers: { authorization: `Bearer ${TOKEN}` },
        })
      ).json(),
    ).toEqual({ human: null });
  });

  it('the slots call answers the stand-in’s viewings and slots under the universal names', async () => {
    crm.setShowings(HOME, [
      {
        showing_id: 'S-1',
        from: '2026-10-10T10:00:00Z',
        to: '2026-10-10T11:00:00Z',
        book_before: '2026-10-09T12:00:00Z',
        open_booking: true,
        shown: true,
        times: [
          {
            time_id: 'T-1',
            from: '2026-10-10T10:00:00Z',
            to: '2026-10-10T10:15:00Z',
            open: true,
            places_left: 3,
          },
          {
            time_id: 'T-2',
            from: '2026-10-10T10:15:00Z',
            to: '2026-10-10T10:30:00Z',
            open: false,
            places_left: 0,
          },
        ],
      },
    ]);
    const answer = await slots({ connection_id: CONNECTION, remote_id: HOME });
    expect(answer.status).toBe(200);
    expect(validateSlots(answer.body)).toEqual({ valid: true });
    expect(answer.body).toEqual({
      viewings: [
        {
          id: 'S-1',
          starts_at: '2026-10-10T10:00:00Z',
          ends_at: '2026-10-10T11:00:00Z',
          deadline_at: '2026-10-09T12:00:00Z',
          self_registration: true,
          visible: true,
          slots: [
            {
              id: 'T-1',
              starts_at: '2026-10-10T10:00:00Z',
              ends_at: '2026-10-10T10:15:00Z',
              available: true,
              free_spots: 3,
            },
            {
              id: 'T-2',
              starts_at: '2026-10-10T10:15:00Z',
              ends_at: '2026-10-10T10:30:00Z',
              available: false,
              free_spots: 0,
            },
          ],
        },
      ],
    });

    // Only this tenant's records, and only records Core holds.
    expect((await slots({ connection_id: 'nobody', remote_id: HOME })).status).toBe(400);
    expect((await slots({ connection_id: CONNECTION, remote_id: 'P-404' })).status).toBe(400);
    expect((await slots({ connection_id: CONNECTION })).status).toBe(400);
  });

  it('a search profile reaches the CRM with the criteria mapped, from a home or after a lead', async () => {
    const fromHome = await post(
      submission('search_profile', { record, criteria, contact_about_current_home: false }),
    );
    expect(fromHome.status).toBe(200);
    expect(fromHome.body).toMatchObject({ status: 'delivered', reference: 'C-1' });

    // After the footer's lead: no home, and the tenant's one office receives it.
    const afterLead = await post(
      submission('search_profile', {
        criteria: { ...criteria, object_type: null, county_municipality_code: null },
      }),
    );
    expect(afterLead.status).toBe(200);

    const forms = crm.formsTaken();
    expect(forms.map((form) => form.form)).toEqual(['WATCH', 'WATCH']);
    expect(forms[0]?.payload).toMatchObject({
      object_id: HOME,
      wants: { type: 'apartment', min_rooms: 2, min_sqm: 75, districts: ['D-1'], muni: '1280' },
      sell_current: false,
    });
    expect(forms[1]?.payload).toMatchObject({
      object_id: null,
      branch_id: OFFICE,
      wants: { type: null, min_rooms: 2, min_sqm: 75, districts: ['D-1'], muni: null },
    });
  });
});
