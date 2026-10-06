// What the Vitec adapter shows and does in the admin panel (docs/admin-panel.md), as data the
// panel draws. Every action carries `help`, one sentence saying what it does and when a person
// would press it; `directions.test.ts` refuses an action without one, so a button added later
// cannot arrive unexplained (Patric, 2026-09-21). What it draws: the notification URL, each connection's schedules and fetch list with "run now"
// actions, the refused offices, the fetch list itself; under a tenant's connection, what Vitec
// knows about it; a probe of a typed login; one record fetched and mapped without writing; and
// what waits on the fetch list. Nothing here knows the engine beyond the adapter API.
import * as connect from '../api.js';
import * as store from '../store.js';
import { mappers } from '../mappers.js';
import { directions } from './directions.js';
import { checkSoon, lastCheck, officesOf, type OfficesCheck } from '../offices.js';
import type {
  AdapterAdmin,
  AdminAction,
  AdminQueued,
  AdminSection,
  AdminValue,
  Connection,
} from '../../../engine/adapter-api/index.js';

type Credentials = { username: string; password: string; customerId: string | null };

/** The reset that makes the worker's next tick run a schedule now. */
const LONG_AGO = '1970-01-01T00:00:00.000Z';

/** The login as stored: a JSON document with the Connect key pair, or null when unreadable. */
export function credentialsOf(stored: string | null): Credentials | null {
  try {
    const parsed = JSON.parse(stored ?? '') as Record<string, unknown>;
    const customerId = parsed['customer_id'];
    return typeof parsed['username'] === 'string' && typeof parsed['password'] === 'string'
      ? {
          username: parsed['username'],
          password: parsed['password'],
          customerId:
            typeof customerId === 'string' && customerId.trim() !== '' ? customerId.trim() : null,
        }
      : null;
  } catch {
    return null;
  }
}

const moment = (value: string | Date | null | undefined): AdminValue =>
  value && new Date(value).toISOString() === LONG_AGO
    ? { text: 'due at the worker’s next tick', state: 'warn' }
    : { moment: value ? new Date(value).toISOString() : null };

const webhookUrl = (): AdminValue => {
  const token = process.env['VITEC_WEBHOOK_TOKEN'];
  return token
    ? `/v1/hook/vitec/webhook/${token} on this app’s domain`
    : { text: 'VITEC_WEBHOOK_TOKEN is not set; the listener answers 503', state: 'bad' };
};

type Schedule = {
  catchUpAt: string | null;
  compareAt: string | null;
  until: string | null;
  pausedUntil: string | null;
  counts: store.Summary;
  paused: boolean;
};

async function scheduleOf(connection: Connection): Promise<Schedule> {
  const [catchUpAt, compareAt, until, pausedUntil, counts] = await Promise.all([
    store.getState(connection.id, 'catch_up_at'),
    store.getState(connection.id, 'compare_at'),
    store.getState(connection.id, 'catch_up_until'),
    store.getState(connection.id, 'paused_until'),
    officesOf(connection).then((offices) => store.summary(offices)),
  ]);
  const paused = Boolean(pausedUntil) && new Date(pausedUntil ?? 0).getTime() > Date.now();
  return { catchUpAt, compareAt, until, pausedUntil, counts, paused };
}

const scheduleActions = (connection: Connection, schedule: Schedule): AdminAction[] => [
  {
    id: 'catch_up',
    label: 'Catch up now',
    help: 'Asks Vitec for everything that changed since the last catch-up and fetches it. This runs by itself every few minutes; press it when a notification looks to have been missed and you do not want to wait.',
    params: { connection: connection.id },
  },
  {
    id: 'compare',
    label: 'Compare now',
    help: 'Fetches Vitec’s own list of what is marketed and removes from Core anything no longer on it. This runs by itself once a day; press it when a listing has been taken off the website and should disappear from the sites now.',
    params: { connection: connection.id },
  },
  ...(schedule.paused
    ? [
        {
          id: 'resume',
          label: 'Resume now',
          help: 'This connection stopped asking Vitec after five failures in a row and is waiting out its pause. Press this to start again at once, once you believe Vitec is answering.',
          params: { connection: connection.id },
        },
      ]
    : []),
];

const fetchListText = (counts: store.Summary): string =>
  `${counts.waiting} waiting · ${counts.retrying} retrying · ${counts.givenUp} given up`;

// ---- The Vitec page ---------------------------------------------------------------------------

async function connectionsSection(connections: Connection[]): Promise<AdminSection> {
  const rows = [];
  for (const connection of connections) {
    const schedule = await scheduleOf(connection);
    rows.push({
      cells: [
        connection.id,
        (await officesOf(connection)).join(', '),
        connection.active,
        schedule.paused
          ? {
              text: `paused until ${new Date(schedule.pausedUntil ?? 0).toISOString()}`,
              state: 'bad' as const,
            }
          : { text: 'fetching', state: 'ok' as const },
        moment(schedule.catchUpAt),
        moment(schedule.until),
        moment(schedule.compareAt),
        fetchListText(schedule.counts),
      ],
      actions: scheduleActions(connection, schedule),
    });
  }
  return {
    title: 'Connections and schedules',
    help: 'A catch-up fetches everything that changed since the last one, in case a notification was missed; a comparison fetches Vitec’s list and removes what is no longer on it. Both run on their own; the buttons run them at the worker’s next tick.',
    table: {
      columns: [
        'Connection',
        'Offices',
        'Active',
        'State',
        'Last catch-up',
        'Changes since',
        'Last comparison',
        'Fetch list',
      ],
      rows,
      empty: 'No Vitec connections yet: make a tenant with the CRM vitec.',
    },
  };
}

async function blockedSection(): Promise<AdminSection> {
  const rows = (await store.blockedOffices()).map((office) => ({
    cells: [
      office.officeId,
      moment(office.blockedAt),
      office.reason,
      office.probes,
      moment(office.blockedUntil),
    ],
    actions: [
      {
        id: 'probe',
        label: 'Probe now',
        help: 'Asks Vitec once for this office to see whether it answers again. A probe runs by itself each cool-down; this one runs at the worker’s next tick.',
        params: { office: office.officeId },
      },
      {
        id: 'forget',
        label: 'Forget',
        danger: true,
        help: 'Drops the block without asking Vitec at all. For an office that has genuinely left the licence, so Core stops probing for it.',
        confirm: `Drop the block on ${office.officeId} without a probe? For an office that left the licence.`,
        params: { office: office.officeId },
      },
    ],
  }));
  return {
    title: 'Refused offices',
    help: 'An office Vitec answers 403 for is blocked at the first refusal: nothing is asked for it, its waiting records stay parked, and one probe per cool-down (an hour, doubling to a day) checks whether it is back; back means loaded again in full.',
    table: {
      columns: ['Office', 'Refused since', 'What Vitec said', 'Failed probes', 'Next probe'],
      rows,
      empty: 'No office is refused: Vitec answers for every licensed office.',
    },
  };
}

async function fetchListSection(): Promise<AdminSection> {
  const rows = (await store.entries(50)).map((entry) => {
    const params = { office: entry.officeId, datatype: entry.datatype, id: entry.remoteId };
    return {
      cells: [
        entry.officeId,
        entry.datatype,
        entry.remoteId,
        entry.reason,
        entry.attempts,
        entry.nextAt ? moment(entry.nextAt) : { text: 'given up', state: 'bad' as const },
        entry.lastError,
      ],
      actions: [
        {
          id: 'retry',
          label: 'Retry now',
          help: 'Puts this record at the front of the fetch list, whatever its attempt count. For a record that was given up on after six failures and that you believe Vitec can answer for now.',
          params,
        },
        {
          id: 'drop',
          label: 'Drop',
          danger: true,
          help: 'Takes this record off the fetch list without fetching it. Core keeps whatever it already holds for it; the next notification or comparison will put it back.',
          params,
        },
      ],
    };
  });
  return {
    title: 'Fetch list',
    help: 'Records Core is about to fetch: notifications and “fetch again” first, then loads and catch-ups. A retrying record failed and waits for its next attempt; after six failures it is given up, and Retry or Drop is yours. A connection that fails five times in a row pauses, two minutes doubling to thirty, and probes its way back.',
    table: {
      columns: ['Office', 'Datatype', 'Record', 'Reason', 'Attempts', 'Due', 'Last error'],
      rows,
      empty: 'The fetch list is empty: nothing is waiting to be fetched.',
    },
  };
}

/** What the page's buttons do; a schedule is run by making it overdue for the worker's next tick. */
const ACTIONS: Record<string, (params: Record<string, string>) => Promise<string>> = {
  catch_up: async ({ connection }) => {
    if (!connection) throw new Error('which connection?');
    await store.setState(connection, 'catch_up_at', LONG_AGO);
    return `${connection} catches up at the worker’s next tick.`;
  },
  compare: async ({ connection }) => {
    if (!connection) throw new Error('which connection?');
    await store.setState(connection, 'compare_at', LONG_AGO);
    return `${connection} compares its list at the worker’s next tick.`;
  },
  check_offices: async ({ connection }) => {
    if (!connection) throw new Error('which connection?');
    await checkSoon(connection);
    return `${connection} asks Vitec for its offices at the worker’s next tick; reload the page in a minute to see the answer.`;
  },
  resume: async ({ connection }) => {
    if (!connection) throw new Error('which connection?');
    await store.setState(connection, 'paused_until', '');
    await store.setState(connection, 'failures', '0');
    return `${connection} fetches again.`;
  },
  retry: async ({ office, datatype, id }) => {
    const known = mappers[datatype as keyof typeof mappers]
      ? (datatype as store.Entry['datatype'])
      : null;
    if (!office || !known || !id) throw new Error('which record?');
    await store.expediteOne(office, known, id);
    return `${datatype} ${id} of ${office} is fetched next.`;
  },
  drop: async ({ office, datatype, id }) => {
    const known = mappers[datatype as keyof typeof mappers]
      ? (datatype as store.Entry['datatype'])
      : null;
    if (!office || !known || !id) throw new Error('which record?');
    await store.drop(office, known, id);
    return `${datatype} ${id} of ${office} is off the list.`;
  },
  probe: async ({ office }) => {
    if (!office) throw new Error('which office?');
    await store.expediteProbe(office);
    return `${office} is probed at the worker’s next tick.`;
  },
  forget: async ({ office }) => {
    if (!office) throw new Error('which office?');
    await store.unblockOffice(office);
    return `${office} is no longer blocked.`;
  },
};

// ---- Trying a login, looking at one record ---------------------------------------------------

/**
 * One list request for the customer or group id with the typed login (or per office the engine
 * passed, for a connection saved before the id existed): a yes says Vitec answered for every one.
 */
async function probe(
  stored: string,
  officeIds: string[],
): Promise<{ ok: boolean; detail: string }> {
  const auth = credentialsOf(stored);
  if (!auth) return { ok: false, detail: 'The login needs a username and a password.' };
  const ids = auth.customerId ? [auth.customerId] : officeIds;
  if (ids.length === 0) {
    return { ok: false, detail: 'Type the customer or group id the login was issued for.' };
  }
  const answers: string[] = [];
  let ok = true;
  for (const officeId of ids) {
    try {
      const page = await connect.page(auth, 'office', officeId, 0, undefined, 1);
      answers.push(
        `${officeId}: Vitec answers, ${page?.totalRowCount ?? 0} office record(s) listed`,
      );
    } catch (error) {
      ok = false;
      const kind = connect.kindOf(error);
      answers.push(
        kind === 'forbidden'
          ? `${officeId}: Vitec refuses this login for that office (${String(error)})`
          : `${officeId}: ${String(error)}`,
      );
    }
  }
  return { ok, detail: answers.join('; ') };
}

/** The office a record was seen under, when the caller does not know it. */
async function officeFor(
  connection: Connection,
  datatype: store.Entry['datatype'],
  remoteId: string,
  given: string | null,
): Promise<string | null> {
  if (given) return given;
  const offices = await officesOf(connection);
  for (const officeId of offices) {
    if (await store.isKnown(officeId, datatype, remoteId)) return officeId;
  }
  return offices[0] ?? null;
}

/** A Swedish date and time for a sentence: `2026-10-06 14:31`, Stockholm time. */
const when = (iso: string): string =>
  new Date(iso)
    .toLocaleString('sv-SE', {
      timeZone: 'Europe/Stockholm',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    .replace(',', '');

/** The last check's time, carrying the warning when Vitec did not answer it. */
function lastCheckText(check: OfficesCheck | null): AdminValue {
  if (!check) return moment(null);
  if (check.source !== 'kept') return moment(check.at);
  return check.offices.length > 0
    ? {
        text: `${when(check.at)}: Vitec did not answer, so the offices of the last answer stay synced and Core asks again within the hour`,
        state: 'warn',
      }
    : { text: `${when(check.at)}: Vitec has listed no office that reads`, state: 'bad' };
}

/** A refused office's cell: since when, and what follows (question 158 b). */
function refusedText(since: string, synced: boolean): AdminValue {
  return synced
    ? {
        text: `no: Vitec refuses this login since ${when(since)}; taken off the sites if still refused at the next daily check`,
        state: 'warn',
      }
    : {
        text: `no: Vitec refuses this login since ${when(since)}; taken off the sites`,
        state: 'bad',
      };
}

/** The office groups Vitec answered, by name, or why there are none. */
function groupsText(check: OfficesCheck | null): AdminValue {
  if (!check) return null;
  const refused = check.ids.find((checked) => checked.groupsError)?.groupsError;
  const names = check.ids.flatMap((checked) =>
    checked.groups.map((group) => `${group.name} (${group.officeIds.length})`),
  );
  if (names.length > 0) return names.join(', ');
  return refused ? { text: refused, state: 'bad' } : 'none';
}

/**
 * Which offices reach the sites and why, for a cold reader who must explain it to the brokerage
 * (Patric, 2026-10-06): the rule, the answer of the last check, and each office Vitec listed.
 */
async function officesSection(connection: Connection): Promise<AdminSection> {
  const check = await lastCheck(connection.id);
  const synced = new Set(check?.offices ?? []);
  const rows = (check?.ids ?? []).flatMap((checked) =>
    checked.error
      ? [
          {
            cells: [
              checked.id,
              checked.refusedSince
                ? refusedText(checked.refusedSince, synced.size > 0)
                : { text: checked.error, state: 'bad' as const },
              null,
              null,
              null,
            ],
          },
        ]
      : checked.offices.map((office) => ({
          cells: [
            checked.id,
            `${office.customerId} (${office.officeId})`,
            office.name,
            office.readable
              ? { text: 'yes', state: 'ok' as const }
              : office.refusedSince
                ? refusedText(office.refusedSince, synced.has(office.customerId))
                : { text: office.detail ?? 'no', state: 'bad' as const },
            synced.has(office.customerId),
          ],
        })),
  );
  return {
    title: 'Offices Vitec lists',
    help: 'Which offices reach this tenant’s sites is decided in Vitec, not here. Once a day, Core asks Vitec which offices sit behind the customer or group id above and reads each one with this login. If the brokerage has made an office group called “Webbplats” in Vitec and put some of those offices in it, only those offices reach the sites. If there is no such group, or it holds none of these offices, every office does. So, to choose which offices show on the website, the brokerage makes the office group “Webbplats” in Vitec and puts the website’s offices in it; nothing is changed here. When an office leaves the group, everything of that office (its homes, its agents and the office itself) is taken off the sites at the next check. When Vitec stops letting this login read an office, for example after a cancelled subscription, Core checks again within a minute and keeps the office on the sites for one more day; if Vitec still refuses it at the next daily check, everything of that office is taken off the sites in the same way. Each site deletes it when it next updates, and Core remembers the removal, so a site that was offline deletes it too. One more thing: Vitec only shows office groups to a login that also has access to its CRM part, which Vitec grants separately (with its own password, typed below as the CRM password when Vitec issued one). Without that access Core cannot see any group and uses every office.',
    items: [
      { label: 'Last check', value: lastCheckText(check) },
      { label: 'Office groups in Vitec', value: groupsText(check) },
    ],
    table: {
      columns: ['Id typed', 'Office', 'Name', 'Readable with this login', 'Synced to the sites'],
      rows,
      empty: 'Not checked yet: the first check runs at the worker’s next tick.',
    },
    actions: [
      {
        id: 'check_offices',
        label: 'Check offices now',
        help: 'Asks Vitec now, instead of waiting for the daily check, which offices sit behind the id and which are in the group “Webbplats”, and acts on the answer: an office that came is loaded, one that left the group is taken off the sites, and one Vitec refuses is taken off once the refusal has stood a day. Press it after the brokerage changed its offices or its group “Webbplats” in Vitec. It runs within a minute; reload the page to see the answer.',
        params: { connection: connection.id },
      },
    ],
  };
}

export const vitecAdmin: AdapterAdmin = {
  credentials: [
    {
      key: 'username',
      label: 'Connect username',
      help: 'The key pair Vitec issues per customer in its partner portal.',
      required: true,
    },
    { key: 'password', label: 'Connect password', secret: true, required: true },
    {
      key: 'customer_id',
      label: 'Customer or group id',
      help: 'The id Vitec issued this login for: a customer id such as M30011, or a group id such as G2. Core asks Vitec once a day which offices sit behind it; “Offices Vitec lists” below shows which ones reach the sites, and why.',
    },
    // The forms (docs/forms.md): first whether they are sent at all, then the brokerage's own
    // knobs in Vitec, copied through with every form a site sends. Core decides none of the
    // knobs; empty leaves each to Vitec as described.
    {
      key: 'send_forms',
      label: 'Send forms to Vitec',
      help: 'Whether a site’s forms are sent to this office at all. Empty or no: every form is refused before any call to Vitec and nothing is written, while the sites still read the viewing slots. Yes only for an office confirmed as a demo or test customer or a customer that has gone live; a connection that reads a client’s production office for testing stays at no.',
      options: [{ value: 'yes' }, { value: 'no' }],
    },
    {
      key: 'lead_source_id',
      label: 'Lead source for website leads',
      help: 'Vitec’s id of the lead source the website’s forms are filed under; empty lets Vitec use its preselected one.',
    },
    {
      key: 'assignment_source_id',
      label: 'Intake source for valuations',
      help: 'Vitec’s id of the intake source a seller’s valuation request is filed under; empty leaves it unset.',
    },
    {
      key: 'interest_status',
      label: 'Status of a website interest',
      help: 'The status an interest sent from the website gets in Vitec; empty leaves it to Vitec.',
      options: [
        { value: 'Interested', label: 'Interested (Intresserad)' },
        { value: 'VeryInterested', label: 'Very interested (Mycket intresserad)' },
      ],
    },
    {
      key: 'confirm_by_email',
      label: 'Confirm a booking by e-mail',
      help: 'Whether Vitec e-mails the visitor a confirmation of a viewing booking; empty means yes.',
      options: [{ value: 'yes' }, { value: 'no' }],
    },
    {
      key: 'confirm_by_sms',
      label: 'Confirm a booking by SMS',
      help: 'Whether Vitec sends the visitor an SMS confirmation of a viewing booking; empty means no.',
      options: [{ value: 'yes' }, { value: 'no' }],
    },
    {
      key: 'reminder_minutes',
      label: 'Reminder before a viewing (minutes)',
      help: 'How many minutes before the viewing Vitec reminds the visitor; empty means no reminder.',
    },
    {
      key: 'crm_password',
      label: 'CRM password',
      secret: true,
      help: 'The password of Vitec’s CRM function group for this customer, when Vitec issued a separate one; it makes the search profile. Empty uses the Connect password.',
    },
  ],

  directions,

  async panel(connections) {
    return [
      {
        title: 'Notification URL',
        help: 'Give this address to Vitec for the subscription. Vitec then calls it for every Update and Remove of an estate advertised on the website, and Core fetches or removes the record.',
        items: [
          { label: 'URL', value: webhookUrl() },
          { label: 'Vitec Connect', value: connect.baseUrl() },
          { label: 'Requests at once', value: connect.concurrency() },
          { label: 'Requests per second', value: connect.requestsPerSecond() },
        ],
      },
      await connectionsSection(connections),
      await blockedSection(),
      await fetchListSection(),
    ];
  },

  async connection(connection) {
    const schedule = await scheduleOf(connection);
    return [
      {
        title: 'What Vitec knows',
        help: 'The schedules and the fetch list of this connection, as the adapter reports them.',
        items: [
          {
            label: 'State',
            value: schedule.paused
              ? {
                  text: `paused until ${new Date(schedule.pausedUntil ?? 0).toISOString()}`,
                  state: 'bad',
                }
              : credentialsOf(connection.credentials)
                ? { text: 'fetching', state: 'ok' }
                : { text: 'the login is not readable', state: 'bad' },
          },
          { label: 'Last catch-up', value: moment(schedule.catchUpAt) },
          { label: 'Changes since', value: moment(schedule.until) },
          { label: 'Last comparison', value: moment(schedule.compareAt) },
          { label: 'Fetch list', value: fetchListText(schedule.counts) },
        ],
        actions: scheduleActions(connection, schedule),
      },
      await officesSection(connection),
    ];
  },

  async act(action, params) {
    const run = ACTIONS[action];
    if (!run) throw new Error(`no such action: ${action}`);
    return { message: await run(params) };
  },

  probe,

  async inspect(connection, record) {
    const auth = credentialsOf(connection.credentials);
    if (!auth) throw new Error('the connection’s login is not readable');
    const officeId = await officeFor(connection, record.datatype, record.remoteId, record.officeId);
    if (!officeId) throw new Error('the connection has no office to ask for');
    const raw = await connect.getOne(auth, record.datatype, officeId, record.remoteId);
    if (raw === null) return null;
    const mapper = mappers[record.datatype];
    return { raw, mapped: mapper ? mapper(raw) : null };
  },

  async queue(connections): Promise<AdminQueued[]> {
    const offices = await Promise.all(connections.map((connection) => officesOf(connection)));
    return (await store.entries(200)).map((entry) => ({
      connectionId:
        connections.find((_, index) => offices[index]?.includes(entry.officeId))?.id ?? null,
      officeId: entry.officeId,
      datatype: entry.datatype,
      remoteId: entry.remoteId,
      queuedAt: entry.queuedAt.toISOString(),
      reason: entry.reason,
      attempts: entry.attempts,
      nextAt: entry.nextAt?.toISOString() ?? null,
      lastError: entry.lastError,
    }));
  },
};

/** The office a "fetch again" goes to: the one the record was seen under, else the connection's first. */
export const refetchOffice = officeFor;
