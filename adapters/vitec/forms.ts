// The forms (docs/forms.md, "The Vitec adapter's part"): the universal submission copied onto
// Connect's form calls, and the form endpoint's viewings copied onto the universal slots. Nothing
// is kept here: the person goes to Vitec and the answer goes back to the engine. Nothing about
// forms is typed on a connection (question 155): Vitec's own defaults stand for the lead source,
// the intake source and an interest's status, and a booking asks Vitec for an e-mail
// confirmation, no SMS and no reminder.
import * as connect from './api.js';
import { isoDate } from './mappers.js';
import type {
  Connection,
  EventContext,
  SearchCriteria,
  Slots,
  Submission,
  SubmissionResult,
} from '../../engine/adapter-api/index.js';

/** The universal home type onto Vitec's residential subtype (SearchProfileV2_SubtypeResidential). */
const SUBTYPE: Record<NonNullable<SearchCriteria['object_type']>, string> = {
  apartment: 'Apartment',
  house: 'House',
  holiday_house: 'Cottage',
  plot: 'Plot',
};

const segment = encodeURIComponent;

/** `Marketing` as every form call takes it: the page the form was on and its UTM tags. */
const marketing = (submission: Submission): Record<string, unknown> => ({
  referrer: submission.source?.page ?? null,
  utmTags: Object.entries(submission.source?.utm ?? {}).map(([name, value]) => ({ name, value })),
});

/** `FormAddress`, when the visitor gave one. */
const address = (submission: Submission): Record<string, unknown> | null =>
  submission.person.address
    ? {
        streetAddress: submission.person.address.street,
        zipCode: submission.person.address.postal_code,
        city: submission.person.address.city,
      }
    : null;

/** The chain every Connect call of this submission lands in: the home's timeline, the form's id. */
const traceOf = (connection: Connection, submission: Submission): EventContext => ({
  correlationId: submission.id,
  connectionId: connection.id,
  datatype: submission.record?.datatype ?? null,
  remoteId: submission.record?.remote_id ?? null,
});

type Sending = {
  login: connect.Login;
  customerId: string;
  submission: Submission;
  trace: EventContext;
};

/** Send one submission to Vitec and say what Vitec said. Never throws. */
export async function submit(
  connection: Connection,
  login: connect.Login,
  submission: Submission,
): Promise<SubmissionResult> {
  const customerId = submission.office_id;
  if (!customerId) return { outcome: 'failed', detail: 'no office (customer id) to send to' };
  const sending: Sending = {
    login,
    customerId,
    submission,
    trace: traceOf(connection, submission),
  };
  try {
    const reference = await send(sending);
    // 141 a: the visitor wants to hear about their own home, so they are a seller lead too.
    if (submission.contact_about_current_home && submission.kind !== 'lead') {
      await valuation(sending);
    }
    return reference ? { outcome: 'delivered', reference } : { outcome: 'delivered' };
  } catch (error) {
    return outcomeOf(error);
  }
}

/** The call for the kind, and the CRM's reference for what it made, when it gives one. */
async function send(sending: Sending): Promise<string | null> {
  const { submission } = sending;
  switch (submission.kind) {
    case 'lead':
      return valuation(sending);
    case 'interest':
      await interest(sending);
      return null;
    case 'viewing':
      return booking(sending);
    case 'search_profile':
      return searchProfile(sending);
  }
}

/** `POST v2/Advertising/Form/{customerId}/Valuation`: the seller's lead. Answers the contact's id. */
async function valuation(sending: Sending): Promise<string | null> {
  const { login, customerId, submission, trace } = sending;
  const answer = await connect.post(
    login,
    `v2/Advertising/Form/${segment(customerId)}/Valuation`,
    {
      firstName: submission.person.first_name,
      lastName: submission.person.last_name,
      email: submission.person.email,
      cellPhone: submission.person.phone,
      address: address(submission),
      gdpr: { hasApproved: submission.consent.given },
      // Null leaves the lead source to Vitec's preselected one and the intake source unset.
      lead: { assignmentSourceId: null, leadSourceId: null, message: submission.message ?? null },
      marketing: marketing(submission),
    },
    trace,
  );
  return contactIdOf(answer);
}

/** `POST Advertising/Estate/{customerId}/{estateId}/interest`: answers nothing (204). */
async function interest(sending: Sending): Promise<void> {
  const { login, customerId, submission, trace } = sending;
  await connect.post(
    login,
    `Advertising/Estate/${segment(customerId)}/${segment(estateOf(submission))}/interest`,
    {
      leadSourceId: null,
      marketing: marketing(submission),
      firstName: submission.person.first_name,
      lastName: submission.person.last_name,
      address: address(submission),
      telephone: { cell: submission.person.phone },
      email: { emailAddress: submission.person.email },
      gdprApprovalDate: submission.consent.at,
      contactMessage: submission.message ?? null,
    },
    trace,
  );
}

/** `POST v2/Advertising/Form/{customerId}/Estate/{estateId}/Viewing/Attend`: answers the contact's id. */
async function booking(sending: Sending): Promise<string | null> {
  const { login, customerId, submission, trace } = sending;
  const answer = await connect.post(
    login,
    `v2/Advertising/Form/${segment(customerId)}/Estate/${segment(estateOf(submission))}/Viewing/Attend`,
    {
      timeSlotId: submission.slot_id,
      firstName: submission.person.first_name,
      lastName: submission.person.last_name,
      email: submission.person.email,
      cellPhone: submission.person.phone,
      address: address(submission),
      gdpr: { hasApproved: submission.consent.given },
      lead: { leadSourceId: null, message: submission.message ?? null },
      // The window tells the visitor the brokerage confirms by e-mail.
      confirmation: { isEmailEnabled: true, isSmsEnabled: false },
      marketing: marketing(submission),
      reminderTime: null,
      // No rules of our own: Vitec applies the viewing's booking limit and deadline as it has them.
      validation: null,
    },
    trace,
  );
  return contactIdOf(answer);
}

/**
 * The search profile (question 139), in the CRM function group: the contact first, through
 * `Contacts/UpdatePerson` (its duplicate check answers the existing or the new contact's id),
 * then `CRM/Contact/{customerId}/SearchProfile/Residential/{contactId}` with the criteria.
 */
async function searchProfile(sending: Sending): Promise<string | null> {
  const { login, customerId, submission, trace } = sending;
  const criteria = submission.criteria;
  if (!criteria) throw new Error('a search profile without criteria');
  const crmAuth = connect.crmAuthOf(login);
  const contact = await connect.post(
    crmAuth,
    'Contacts/UpdatePerson',
    {
      customerId,
      firstName: submission.person.first_name,
      lastName: submission.person.last_name,
      cellPhone: submission.person.phone,
      email: { emailAddress: submission.person.email },
      address: address(submission),
      approval: submission.consent.given,
      approvalDate: submission.consent.at,
      gdprApprovalDate: submission.consent.at,
      obtainThrough: 'Interest',
    },
    trace,
  );
  const contactId = typeof contact === 'string' ? contact : contactIdOf(contact);
  if (!contactId) throw new Error('UpdatePerson answered no contact id');
  const codes = criteria.areas
    .map((area) => area.county_municipality_code)
    .filter((code): code is string => typeof code === 'string' && code !== '');
  await connect.post(
    crmAuth,
    `CRM/Contact/${segment(customerId)}/SearchProfile/Residential/${segment(contactId)}`,
    {
      subtypes: criteria.object_type ? [SUBTYPE[criteria.object_type]] : [],
      areaIds: criteria.areas.map((area) => area.id),
      municipalityCodes:
        codes.length > 0
          ? [...new Set(codes)]
          : criteria.county_municipality_code
            ? [criteria.county_municipality_code]
            : [],
      livingSpace:
        criteria.living_area_min === null ? null : { minValue: criteria.living_area_min },
      numberOfRooms: criteria.rooms_min === null ? null : { minValue: criteria.rooms_min },
      isAutomaticProfile: false,
    },
    trace,
  );
  return contactId;
}

const estateOf = (submission: Submission): string => {
  const id = submission.record?.remote_id;
  if (!id) throw new Error(`a ${submission.kind} without a home`);
  return id;
};

/** `{ contactId }` as the form calls answer it. */
const contactIdOf = (answer: unknown): string | null => {
  if (!answer || typeof answer !== 'object') return null;
  const id = (answer as Record<string, unknown>)['contactId'];
  return typeof id === 'string' && id !== '' ? id : null;
};

/** The statuses with which Vitec says no to this form, as opposed to being down or shut. */
const REFUSALS = new Set([400, 404, 409, 422]);

/** Vitec's own words from an error, without the path and status Core put in front. */
const wordsOf = (error: connect.VitecError): string => {
  const quoted = /"message"\s*:\s*"([^"]*)"/.exec(error.message)?.[1];
  if (quoted) return connect.scrub(quoted);
  const after = error.message.replace(/^[^:]*: HTTP \d+ ?/, '');
  return connect.scrub(after || `Vitec answered HTTP ${String(error.status)}`);
};

function outcomeOf(error: unknown): SubmissionResult {
  if (error instanceof connect.VitecError && REFUSALS.has(error.status)) {
    return { outcome: 'refused', reason: wordsOf(error) };
  }
  const detail = error instanceof Error ? error.message : String(error);
  return { outcome: 'failed', detail: `${connect.kindOf(error)}: ${connect.scrub(detail)}` };
}

// ---- The slots -------------------------------------------------------------------------------

/** A viewing's moment: Connect gives Swedish wall-clock time, read in Vitec's zone as on the records. */
const moment = isoDate;
const flag = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null);
const rows = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter((row) => row && typeof row === 'object') : [];

/** The form endpoint's viewings and time slots under the universal names (schemas/slots.v1.json). */
export async function slots(
  auth: connect.Auth,
  officeId: string,
  estateId: string,
  trace?: EventContext,
): Promise<Slots> {
  const answer = await connect.form(auth, officeId, estateId, trace);
  const estate = answer && typeof answer === 'object' ? (answer as Record<string, unknown>) : {};
  return {
    viewings: rows(estate['viewings']).map((viewing) => ({
      id: String(viewing['id'] ?? ''),
      starts_at: moment(viewing['startsAt']),
      ends_at: moment(viewing['endsAt']),
      deadline_at: moment(viewing['deadlineAt']),
      self_registration: flag(viewing['isSelfRegistrationEnabled']),
      visible: flag(viewing['isVisible']),
      slots: rows(viewing['timeSlots']).map((slot) => ({
        id: String(slot['id'] ?? ''),
        starts_at: moment(slot['startsAt']),
        ends_at: moment(slot['endsAt']),
        available: flag(slot['isRegistrationAvailable']),
        // Connect says whether a booking is taken, never how many places are left.
        free_spots: null,
      })),
    })),
  };
}
