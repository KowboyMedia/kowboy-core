// A polling-style adapter (AC 12). No endpoint, no webhook: it asks the CRM on its own timer and
// reconciles deletes by comparing id lists.
import { mappers } from './mappers.js';
import * as crm from './crm.js';
import { SUBMISSION_KINDS } from '../../engine/adapter-api/index.js';
import type {
  Adapter,
  AdapterApi,
  Connection,
  Slots,
  Submission,
  SubmissionKind,
} from '../../engine/adapter-api/index.js';

const PROVIDER = 'fake-polling';
const POLL_MS = 100;
/** The datatypes this fake CRM has; it knows no projects. */
const DATATYPES = ['office', 'agent', 'area', 'association', 'property'] as const;
type Polled = (typeof DATATYPES)[number];

const ID_FIELD: Record<Polled, string> = {
  property: 'object_id',
  office: 'branch_id',
  agent: 'staff_id',
  area: 'district_id',
  association: 'coop_id',
};

let api: AdapterApi | null = null;
let timer: NodeJS.Timeout | null = null;
let lastPollAt = Date.now();
/** Polls run one after another, so two never overlap and shutdown can wait for the last one. */
let polling: Promise<void> = Promise.resolve();
/** Whether a poll is already waiting its turn. A second one would see nothing the first will not. */
let waiting = false;

/**
 * Queue one poll behind whatever is running, unless one is already waiting, and hand back a
 * promise for it. Without the cap, a machine where a sweep outlasts the timer interval builds an
 * ever-growing backlog, and whoever waits for "the next poll" waits behind all of it.
 */
const schedulePoll = (): Promise<void> => {
  if (!waiting) {
    waiting = true;
    const run = (): Promise<void> => {
      waiting = false;
      return pollOnce();
    };
    polling = polling.then(run, run);
  }
  return polling;
};

async function pollOnce(): Promise<void> {
  // Held for the whole pass: stop() may null `api` between two awaits, and a pass that has
  // started finishes against the API it started with.
  const current = api;
  if (!current) return;
  for (const connection of await current.connections()) await sweep(connection, current);
  lastPollAt = Date.now();
}

async function sweep(connection: Connection, current: AdapterApi): Promise<void> {
  for (const datatype of DATATYPES) {
    const records = crm.all(datatype);
    for (const record of records) {
      const remoteId = String(record[ID_FIELD[datatype]] ?? '');
      if (!remoteId) continue;
      // Records that did not really change get the same hash, so no seq and no bell.
      await current.ingest(connection, datatype, remoteId, record);
    }
    // Deletes have no webhook here: whatever the CRM no longer lists is gone.
    await current.presentIds(connection, datatype, { officeId: null }, crm.ids(datatype));
  }
}

// ---- Forms (docs/forms.md): the universal submission onto this CRM's own form vocabulary ------

/** This CRM's name for each kind of form. */
const FORM: Record<SubmissionKind, string> = {
  lead: 'CONTACT',
  interest: 'INTEREST',
  viewing: 'SHOWING_BOOKING',
  search_profile: 'WATCH',
};

/** The person as this CRM names them, with the address when there is one. */
const personFields = (person: Submission['person']): Record<string, unknown> => ({
  given_name: person.first_name,
  family_name: person.last_name,
  mail: person.email,
  mobile: person.phone,
  street: person.address?.street ?? null,
  zip: person.address?.postal_code ?? null,
  town: person.address?.city ?? null,
});

/** The search profile as this CRM's "watch". */
const wants = (criteria: Submission['criteria']): Record<string, unknown> | null =>
  criteria
    ? {
        type: criteria.object_type,
        min_rooms: criteria.rooms_min,
        min_sqm: criteria.living_area_min,
        districts: criteria.areas.map((area) => area.id),
        muni: criteria.county_municipality_code,
      }
    : null;

/** Every universal field copied onto this CRM's names; nothing read to decide anything. */
const toForm = (submission: Submission): Record<string, unknown> => ({
  ...personFields(submission.person),
  note: submission.message ?? null,
  consent_at: submission.consent.at,
  page: submission.source?.page ?? null,
  tags: submission.source?.utm ?? {},
  object_id: submission.record?.remote_id ?? null,
  branch_id: submission.office_id ?? null,
  showing_time_id: submission.slot_id ?? null,
  wants: wants(submission.criteria),
  sell_current: submission.contact_about_current_home ?? null,
});

const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const bool = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null);
const int = (value: unknown): number | null => (Number.isInteger(value) ? (value as number) : null);

/** A showing with its times, as this CRM lists them, onto the universal viewing and slots. */
const toViewing = (showing: Record<string, unknown>): Slots['viewings'][number] => ({
  id: String(showing['showing_id'] ?? ''),
  starts_at: str(showing['from']),
  ends_at: str(showing['to']),
  deadline_at: str(showing['book_before']),
  self_registration: bool(showing['open_booking']),
  visible: bool(showing['shown']),
  slots: ((showing['times'] as Record<string, unknown>[] | undefined) ?? []).map((time) => ({
    id: String(time['time_id'] ?? ''),
    starts_at: str(time['from']),
    ends_at: str(time['to']),
    available: bool(time['open']),
    free_spots: int(time['places_left']),
  })),
});

export const fakePollingAdapter: Adapter = {
  manifest: { provider: PROVIDER, datatypes: [...DATATYPES], submissions: [...SUBMISSION_KINDS] },
  mappers,

  submit(_connection: Connection, submission: Submission) {
    const answer = crm.takeForm(FORM[submission.kind], toForm(submission));
    return Promise.resolve(
      answer.taken
        ? { outcome: 'delivered' as const, reference: answer.contact_no }
        : { outcome: 'refused' as const, reason: answer.why },
    );
  },

  slots(_connection: Connection, record: { remoteId: string }) {
    return Promise.resolve({ viewings: crm.showingsOf(record.remoteId).map(toViewing) });
  },

  start(given: AdapterApi): void {
    api = given;

    given.onLifecycle(async (event) => {
      if (event.type === 'connection_added' || event.type === 'resync') {
        await sweep(event.connection, given);
      }
    });

    given.healthCheck(`${PROVIDER}.poll`, () => {
      const age = Date.now() - lastPollAt;
      return age < POLL_MS * 20
        ? { ok: true }
        : { ok: false, detail: `last poll ${Math.round(age / 1000)} s ago` };
    });

    timer = setInterval(() => void schedulePoll(), POLL_MS);
    timer.unref?.();
  },

  async stop(): Promise<void> {
    if (timer) clearInterval(timer);
    timer = null;
    await polling;
    api = null;
  },
};

/** Test and local use: run a poll after any in flight, and wait for it. */
export const poll = schedulePoll;
