// The forms through the Vitec adapter (docs/forms.md, "The Vitec adapter's part"): a site's
// lead, interest, viewing booking and search profile reach the stand-in Connect as the calls the
// documentation gives, with the brokerage's settings copied through, and Connect's answers come
// back as delivered, refused or failed. The slots are the form endpoint under the universal
// names. The real send waits on a demo or test customer (question 54 f).
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  HUMAN_TOKEN,
  harness,
  pull,
  queryEvents,
  queueLifecycle,
  until,
  TOKEN,
  type Harness,
} from '../../acceptance/harness.js';
import type { Submission } from '../../engine/adapter-api/index.js';
import * as forms from './forms.js';
import { drainFetchList, runSchedules, vitecAdapter } from './index.js';
import * as store from './store.js';
import { PASSWORD, USERNAME, startFakeConnect, type FakeConnect } from './test/connect.js';

const CONNECTION = 'vitec-acme';
const OFFICE = 'M1';
const ESTATE = 'OBJ1';
const CHANGED = '2026-09-10T08:00:00.1234567+02:00';

/** The key pair and the brokerage's own knobs, as the connection's page stores them. */
const credentials = JSON.stringify({
  username: USERNAME,
  password: PASSWORD,
  customer_id: OFFICE,
  send_forms: 'yes',
  lead_source_id: 'LS-web',
  assignment_source_id: 'IS-val',
  interest_status: 'VeryInterested',
  confirm_by_email: 'yes',
  confirm_by_sms: 'no',
  reminder_minutes: '60',
});

const person = {
  first_name: 'Anna',
  last_name: 'Svensson',
  email: 'anna@example.se',
  phone: '0701234567',
  address: { street: 'Storgatan 1', postal_code: '211 22', city: 'Malmö' },
};

const record = { datatype: 'property', connection_id: CONNECTION, remote_id: ESTATE };

const submission = (
  kind: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> => ({
  id: randomUUID(),
  kind,
  person,
  message: 'Hej!',
  consent: { given: true, at: '2026-10-04T10:00:00Z' },
  source: { page: 'https://site.example/objekt/1', utm: { utm_source: 'hemnet' } },
  ...extra,
});

/** One office with one of everything, the way Connect would publish it. */
function seed(fake: FakeConnect): void {
  fake.put(OFFICE, 'office', {
    id: OFFICE,
    customerId: OFFICE,
    name: 'Kontor 1',
    changedAt: CHANGED,
  });
  fake.put(OFFICE, 'agent', {
    id: 'U1',
    name: 'Anna',
    offices: [{ id: OFFICE, customerId: OFFICE, orderNumber: 1 }],
    changedAt: CHANGED,
  });
  fake.put(OFFICE, 'area', { id: 'A1', name: 'Centrum', changedAt: CHANGED });
  fake.put(OFFICE, 'project', {
    id: 'PR1',
    office: { id: OFFICE, customerId: OFFICE },
    primaryAgentId: 'U1',
    address: { area: { id: 'A1' } },
    changedAt: CHANGED,
  });
  fake.put(OFFICE, 'association', { id: 'F1', name: 'Brf Solen', changedAt: CHANGED });
  fake.put(OFFICE, 'property', {
    id: ESTATE,
    office: { id: OFFICE, customerId: OFFICE },
    primaryAgentId: 'U1',
    secondaryAgentId: null,
    projectId: 'PR1',
    address: { streetAddress: 'Storgatan 1', area: { id: 'A1', name: 'Centrum' } },
    extensions: { housingCooperative: { association: { id: 'F1' } } },
    changedAt: CHANGED,
  });
}

let fake: FakeConnect;
let running: Harness;

const post = async (body: unknown): Promise<{ status: number; body: Record<string, unknown> }> => {
  const response = await fetch(`${running.baseUrl}/v1/submissions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${TOKEN}`,
      'content-type': 'application/json',
      'x-core-human': HUMAN_TOKEN,
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
};

const formsSent = (): string[] => fake.forms.map((form) => form.path);

beforeEach(async () => {
  fake = await startFakeConnect();
  process.env['VITEC_BASE_URL'] = fake.url;
  process.env['VITEC_WEBHOOK_TOKEN'] = 'hook-token';
  await store.reset();
  seed(fake);
  running = await harness({
    adapters: [vitecAdapter],
    connections: [{ id: CONNECTION, provider: 'vitec', credentials, licensedOffices: [] }],
  });
  await runSchedules();
  await queueLifecycle(CONNECTION, 'connection_added', {});
  await running.deliver();
  await drainFetchList();
  await until(
    async () =>
      (await pull(running.baseUrl, 'property')).items.some((item) => item['remote_id'] === ESTATE),
    'the home to be in Core',
  );
  fake.forms.length = 0;
});

afterEach(async () => {
  await running.stop();
  await fake.close();
});

describe('the Vitec adapter’s forms', () => {
  it('sends a lead as the valuation request with the brokerage’s sources, and answers Vitec’s contact id', async () => {
    const answer = await post(submission('lead'));
    expect(answer.status).toBe(200);
    expect(answer.body).toMatchObject({ status: 'delivered', reference: 'C-1' });

    expect(formsSent()).toEqual([`/v2/Advertising/Form/${OFFICE}/Valuation`]);
    expect(fake.forms[0]?.body).toEqual({
      firstName: 'Anna',
      lastName: 'Svensson',
      email: 'anna@example.se',
      cellPhone: '0701234567',
      address: { streetAddress: 'Storgatan 1', zipCode: '211 22', city: 'Malmö' },
      gdpr: { hasApproved: true },
      lead: { assignmentSourceId: 'IS-val', leadSourceId: 'LS-web', message: 'Hej!' },
      marketing: {
        referrer: 'https://site.example/objekt/1',
        utmTags: [{ name: 'utm_source', value: 'hemnet' }],
      },
    });
  });

  it('sends an interest on the home with the status setting, and the valuation too when the visitor ticked the current-home box', async () => {
    const answer = await post(submission('interest', { record, contact_about_current_home: true }));
    expect(answer.status).toBe(200);
    expect(answer.body).toMatchObject({ status: 'delivered', reference: null });

    expect(formsSent()).toEqual([
      `/Advertising/Estate/${OFFICE}/${ESTATE}/interest`,
      `/v2/Advertising/Form/${OFFICE}/Valuation`,
    ]);
    expect(fake.forms[0]?.body).toEqual({
      leadSourceId: 'LS-web',
      marketing: {
        referrer: 'https://site.example/objekt/1',
        utmTags: [{ name: 'utm_source', value: 'hemnet' }],
      },
      firstName: 'Anna',
      lastName: 'Svensson',
      address: { streetAddress: 'Storgatan 1', zipCode: '211 22', city: 'Malmö' },
      telephone: { cell: '0701234567' },
      email: { emailAddress: 'anna@example.se' },
      gdprApprovalDate: '2026-10-04T10:00:00Z',
      contactMessage: 'Hej!',
      status: 'VeryInterested',
    });
    expect(fake.forms[1]?.body).toMatchObject({
      firstName: 'Anna',
      lead: { leadSourceId: 'LS-web' },
    });

    // Both Connect calls sit in the form's chain on the home's timeline, without the person.
    const chain = await queryEvents({ correlationId: answer.body['id'] as string });
    const calls = chain.filter((event) => event.type === 'crm.call');
    expect(calls.map((event) => event.fields['endpoint'])).toEqual([
      `/Advertising/Estate/${OFFICE}/${ESTATE}/interest`,
      `/v2/Advertising/Form/${OFFICE}/Valuation`,
    ]);
    expect(JSON.stringify(chain)).not.toContain('anna@example.se');
    expect(chain.map((event) => event.type)).toContain('submission.delivered');
  });

  it('books a viewing slot with the confirmation and reminder settings, and relays Vitec’s refusal and silence', async () => {
    const booked = await post(submission('viewing', { record, slot_id: 'T-1' }));
    expect(booked.status).toBe(200);
    expect(booked.body).toMatchObject({ status: 'delivered', reference: 'C-1' });
    expect(formsSent()).toEqual([`/v2/Advertising/Form/${OFFICE}/Estate/${ESTATE}/Viewing/Attend`]);
    expect(fake.forms[0]?.body).toEqual({
      timeSlotId: 'T-1',
      firstName: 'Anna',
      lastName: 'Svensson',
      email: 'anna@example.se',
      cellPhone: '0701234567',
      address: { streetAddress: 'Storgatan 1', zipCode: '211 22', city: 'Malmö' },
      gdpr: { hasApproved: true },
      lead: { leadSourceId: 'LS-web', message: 'Hej!' },
      confirmation: { isEmailEnabled: true, isSmsEnabled: false },
      marketing: {
        referrer: 'https://site.example/objekt/1',
        utmTags: [{ name: 'utm_source', value: 'hemnet' }],
      },
      reminderTime: 60,
      validation: null,
    });

    // Vitec says no: the visitor hears why, in Vitec's words.
    fake.refuseNext('Visningen är fullbokad, kontakta anna@example.se');
    const refused = await post(submission('viewing', { record, slot_id: 'T-1' }));
    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({
      status: 'refused',
      reason: 'Visningen är fullbokad, kontakta [e-mail]',
    });

    // Vitec is down: a failure, and nothing sent.
    fake.failNext(1);
    const failed = await post(submission('viewing', { record, slot_id: 'T-1' }));
    expect(failed.status).toBe(502);
    expect(failed.body).toMatchObject({ status: 'failed' });
  });

  it('makes a search profile: the contact through UpdatePerson, then the residential profile with the criteria', async () => {
    const answer = await post(
      submission('search_profile', {
        record,
        criteria: {
          object_type: 'apartment',
          rooms_min: 2,
          living_area_min: 75,
          areas: [
            { id: 'A1', name: 'Centrum', county_municipality_code: '1280' },
            { id: 'A2', name: 'Väster', county_municipality_code: '1280' },
          ],
          county_municipality_code: '1280',
        },
        contact_about_current_home: false,
      }),
    );
    expect(answer.status).toBe(200);
    expect(answer.body).toMatchObject({ status: 'delivered', reference: 'P-1' });

    expect(formsSent()).toEqual([
      '/Contacts/UpdatePerson',
      `/CRM/Contact/${OFFICE}/SearchProfile/Residential/P-1`,
    ]);
    expect(fake.forms[0]?.body).toEqual({
      customerId: OFFICE,
      firstName: 'Anna',
      lastName: 'Svensson',
      cellPhone: '0701234567',
      email: { emailAddress: 'anna@example.se' },
      address: { streetAddress: 'Storgatan 1', zipCode: '211 22', city: 'Malmö' },
      approval: true,
      approvalDate: '2026-10-04T10:00:00Z',
      gdprApprovalDate: '2026-10-04T10:00:00Z',
      obtainThrough: 'Interest',
    });
    expect(fake.forms[1]?.body).toEqual({
      subtypes: ['Apartment'],
      areaIds: ['A1', 'A2'],
      municipalityCodes: ['1280'],
      livingSpace: { minValue: 75 },
      numberOfRooms: { minValue: 2 },
      isAutomaticProfile: false,
    });

    // After the footer's lead: no home, no type, no requirement on size; the home's office.
    const open = await post(
      submission('search_profile', {
        criteria: {
          object_type: null,
          rooms_min: null,
          living_area_min: null,
          areas: [],
          county_municipality_code: null,
        },
      }),
    );
    expect(open.status).toBe(200);
    expect(fake.forms[3]?.body).toEqual({
      subtypes: [],
      areaIds: [],
      municipalityCodes: [],
      livingSpace: null,
      numberOfRooms: null,
      isAutomaticProfile: false,
    });
  });

  it('answers the slots from Connect’s form endpoint under the universal names', async () => {
    // Connect gives bare Swedish wall-clock times, as on the records (staging, 2026-10-06: a
    // viewing at 17.50 on the home's page read 19.50 in the booking window); an offset, when
    // given, is honoured.
    fake.setForm(OFFICE, ESTATE, {
      id: ESTATE,
      office: { customerId: OFFICE, name: 'Kontor 1' },
      viewings: [
        {
          id: 'V1',
          startsAt: '2026-10-10T12:00:00',
          endsAt: '2026-10-10T13:00:00',
          deadlineAt: '2026-10-09T12:00:00',
          isSelfRegistrationEnabled: true,
          isVisible: true,
          comment: 'Välkommen',
          timeSlots: [
            {
              id: 'T1',
              startsAt: '2026-10-10T12:00:00',
              endsAt: '2026-10-10T12:15:00',
              isRegistrationAvailable: true,
            },
            {
              id: 'T2',
              startsAt: '2026-10-10T12:15:00+02:00',
              endsAt: '2026-10-10T12:30:00+02:00',
              isRegistrationAvailable: false,
            },
          ],
        },
      ],
    });
    const response = await fetch(
      `${running.baseUrl}/v1/submissions/slots?connection_id=${CONNECTION}&remote_id=${ESTATE}`,
      { headers: { authorization: `Bearer ${TOKEN}` } },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      viewings: [
        {
          id: 'V1',
          starts_at: '2026-10-10T10:00:00.000Z',
          ends_at: '2026-10-10T11:00:00.000Z',
          deadline_at: '2026-10-09T10:00:00.000Z',
          self_registration: true,
          visible: true,
          slots: [
            {
              id: 'T1',
              starts_at: '2026-10-10T10:00:00.000Z',
              ends_at: '2026-10-10T10:15:00.000Z',
              available: true,
              free_spots: null,
            },
            {
              id: 'T2',
              starts_at: '2026-10-10T10:15:00.000Z',
              ends_at: '2026-10-10T10:30:00.000Z',
              available: false,
              free_spots: null,
            },
          ],
        },
      ],
    });
    expect(
      fake.requests.some(
        (request) => request.path === `/v2/Advertising/Form/${OFFICE}/Estate/${ESTATE}`,
      ),
    ).toBe(true);
  });

  it('refuses every form before any call while “Send forms to Vitec” on the connection is not yes, so an unconfirmed office is never written to', async () => {
    const auth = { username: USERNAME, password: PASSWORD };
    const connection = (document: Record<string, unknown>) => ({
      id: 'vitec-quiet',
      tenantId: 1,
      provider: 'vitec',
      credentials: JSON.stringify({
        username: USERNAME,
        password: PASSWORD,
        customer_id: OFFICE,
        ...document,
      }),
      licensedOffices: [],
      active: true,
    });
    const lead = submission('lead', { office_id: OFFICE }) as unknown as Submission;
    const booking = submission('viewing', {
      record,
      office_id: OFFICE,
      slot_id: 'T-1',
    }) as unknown as Submission;

    // Nothing typed, and "no": refused, the stand-in saw nothing.
    expect(await forms.submit(connection({}), auth, lead)).toEqual({
      outcome: 'refused',
      reason: forms.NOT_SENT,
    });
    expect(await forms.submit(connection({ send_forms: 'no' }), auth, booking)).toEqual({
      outcome: 'refused',
      reason: forms.NOT_SENT,
    });
    expect(formsSent()).toEqual([]);

    // "yes": the same lead leaves as the valuation request.
    expect(await forms.submit(connection({ send_forms: 'yes' }), auth, lead)).toEqual({
      outcome: 'delivered',
      reference: expect.any(String),
    });
    expect(formsSent()).toEqual([`/v2/Advertising/Form/${OFFICE}/Valuation`]);
  });
});
