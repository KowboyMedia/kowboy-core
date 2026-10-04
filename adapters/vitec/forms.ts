// The forms (docs/forms.md, "The Vitec adapter's part"): the universal submission copied onto
// Connect's form calls, and the form endpoint's viewings copied onto the universal slots. Nothing
// is kept here: the person goes to Vitec and the answer goes back to the engine. The brokerage's
// own knobs (a lead source, an intake source, a status, the confirmations, a reminder) are typed
// on the connection's page beside the key pair and copied through; Core decides none of them.
import * as connect from './api.js';
import type {
  Connection,
  EventContext,
  SearchCriteria,
  Slots,
  Submission,
  SubmissionResult,
} from '../../engine/adapter-api/index.js';

/** The settings stored in the connection's login document, beside `username` and `password`. */
export type FormSettings = {
  /**
   * Whether forms are sent to this office at all. False (the default, and "no") refuses every
   * form before any call, so a connection that reads a client's production office for testing is
   * never written to (Patric, 2026-10-04); yes is for a confirmed demo or test customer
   * (question 54 f) or a customer gone live.
   */
  sendForms: boolean;
  /** Vitec's id of the lead source the website's leads are filed under; null leaves it to Vitec. */
  leadSourceId: string | null;
  /** Vitec's id of the intake source for a seller's valuation request; null leaves it unset. */
  assignmentSourceId: string | null;
  /** The status an interest from the website gets (Interested, VeryInterested); null leaves it to Vitec. */
  interestStatus: string | null;
  confirmByEmail: boolean;
  confirmBySms: boolean;
  /** Minutes before the viewing Vitec reminds the visitor; null means no reminder. */
  reminderMinutes: number | null;
  /** The CRM function group's password, when Vitec issued a separate one; null uses the Connect password. */
  crmPassword: string | null;
};

export const FORM_SETTING_KEYS = [
  'send_forms',
  'lead_source_id',
  'assignment_source_id',
  'interest_status',
  'confirm_by_email',
  'confirm_by_sms',
  'reminder_minutes',
  'crm_password',
] as const;

const text = (document: Record<string, unknown>, key: string): string | null => {
  const value = document[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
};

/** "yes" or "no" as the panel's choice stores it; a boolean as a test may store it. */
const yesNo = (document: Record<string, unknown>, key: string, fallback: boolean): boolean => {
  const value = document[key];
  if (typeof value === 'boolean') return value;
  if (value === 'yes') return true;
  if (value === 'no') return false;
  return fallback;
};

/** The settings as stored; a login document that cannot be read gives the defaults. */
export function settingsOf(stored: string | null): FormSettings {
  let document: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(stored ?? '{}') as unknown;
    if (parsed && typeof parsed === 'object') document = parsed as Record<string, unknown>;
  } catch {
    // the defaults
  }
  const reminder = Number(text(document, 'reminder_minutes'));
  return {
    sendForms: yesNo(document, 'send_forms', false),
    leadSourceId: text(document, 'lead_source_id'),
    assignmentSourceId: text(document, 'assignment_source_id'),
    interestStatus: text(document, 'interest_status'),
    confirmByEmail: yesNo(document, 'confirm_by_email', true),
    confirmBySms: yesNo(document, 'confirm_by_sms', false),
    reminderMinutes: Number.isInteger(reminder) && reminder > 0 ? reminder : null,
    crmPassword: text(document, 'crm_password'),
  };
}

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
  auth: connect.Auth;
  settings: FormSettings;
  customerId: string;
  submission: Submission;
  trace: EventContext;
};

/** What the visitor reads while the connection's "Send forms to Vitec" is not yes. */
export const NOT_SENT = 'Formulär skickas inte till det här kontoret än.';

/**
 * Send one submission to Vitec and say what Vitec said. Never throws. Nothing leaves while the
 * connection's "Send forms to Vitec" is not yes: the refusal comes before any call.
 */
export async function submit(
  connection: Connection,
  auth: connect.Auth,
  submission: Submission,
): Promise<SubmissionResult> {
  const settings = settingsOf(connection.credentials);
  if (!settings.sendForms) return { outcome: 'refused', reason: NOT_SENT };
  const customerId = submission.office_id;
  if (!customerId) return { outcome: 'failed', detail: 'no office (customer id) to send to' };
  const sending: Sending = {
    auth,
    settings,
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
  const { auth, settings, customerId, submission, trace } = sending;
  const answer = await connect.post(
    auth,
    `v2/Advertising/Form/${segment(customerId)}/Valuation`,
    {
      firstName: submission.person.first_name,
      lastName: submission.person.last_name,
      email: submission.person.email,
      cellPhone: submission.person.phone,
      address: address(submission),
      gdpr: { hasApproved: submission.consent.given },
      lead: {
        assignmentSourceId: settings.assignmentSourceId,
        leadSourceId: settings.leadSourceId,
        message: submission.message ?? null,
      },
      marketing: marketing(submission),
    },
    trace,
  );
  return contactIdOf(answer);
}

/** `POST Advertising/Estate/{customerId}/{estateId}/interest`: answers nothing (204). */
async function interest(sending: Sending): Promise<void> {
  const { auth, settings, customerId, submission, trace } = sending;
  await connect.post(
    auth,
    `Advertising/Estate/${segment(customerId)}/${segment(estateOf(submission))}/interest`,
    {
      leadSourceId: settings.leadSourceId,
      marketing: marketing(submission),
      firstName: submission.person.first_name,
      lastName: submission.person.last_name,
      address: address(submission),
      telephone: { cell: submission.person.phone },
      email: { emailAddress: submission.person.email },
      gdprApprovalDate: submission.consent.at,
      contactMessage: submission.message ?? null,
      ...(settings.interestStatus ? { status: settings.interestStatus } : {}),
    },
    trace,
  );
}

/** `POST v2/Advertising/Form/{customerId}/Estate/{estateId}/Viewing/Attend`: answers the contact's id. */
async function booking(sending: Sending): Promise<string | null> {
  const { auth, settings, customerId, submission, trace } = sending;
  const answer = await connect.post(
    auth,
    `v2/Advertising/Form/${segment(customerId)}/Estate/${segment(estateOf(submission))}/Viewing/Attend`,
    {
      timeSlotId: submission.slot_id,
      firstName: submission.person.first_name,
      lastName: submission.person.last_name,
      email: submission.person.email,
      cellPhone: submission.person.phone,
      address: address(submission),
      gdpr: { hasApproved: submission.consent.given },
      lead: { leadSourceId: settings.leadSourceId, message: submission.message ?? null },
      confirmation: {
        isEmailEnabled: settings.confirmByEmail,
        isSmsEnabled: settings.confirmBySms,
      },
      marketing: marketing(submission),
      reminderTime: settings.reminderMinutes,
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
  const { auth, settings, customerId, submission, trace } = sending;
  const criteria = submission.criteria;
  if (!criteria) throw new Error('a search profile without criteria');
  const crmAuth = settings.crmPassword ? { ...auth, password: settings.crmPassword } : auth;
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

const moment = (value: unknown): string | null => {
  if (typeof value !== 'string' || value === '') return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
};
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
