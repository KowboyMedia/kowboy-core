// What the Vitec adapter shows and does in the admin panel (docs/admin-panel.md), as data the
// panel draws. Every action carries `help`, one sentence saying what it does and when a person
// would press it; `directions.test.ts` refuses an action without one, so a button added later
// cannot arrive unexplained (Patric, 2026-09-21). What it draws: the notification URL, each connection's schedules and fetch list with "run now"
// actions, the refused offices, the fetch list itself; under a tenant's connection, the offices
// Vitec lists; a probe of a typed login; one record fetched and mapped without writing; and
// what waits on the fetch list. Nothing here knows the engine beyond the adapter API.
import * as connect from '../api.js';
import * as store from '../store.js';
import { mappers } from '../mappers.js';
import { directions } from './directions.js';
import {
  checkSoon,
  lastCheck,
  NO_SUCH_OFFICE,
  officesOf,
  type OfficeSeen,
  type OfficesCheck,
} from '../offices.js';
import { type AdminThing, counted, failureInWords, recordNamed, sentence, when } from '../words.js';
import type {
  AdapterAdmin,
  AdminAction,
  AdminQueued,
  AdminSection,
  AdminValue,
  Connection,
} from '../../../engine/adapter-api/index.js';

/** The reset that makes the worker's next tick run a schedule now. */
const LONG_AGO = '1970-01-01T00:00:00.000Z';

/**
 * Where each of Vitec's systems sends its notifications, under /v1/hook/vitec/: live Vitec to
 * `webhook/…` and its QA environment to `qa/…` (question 169 a). The routes in ../index.ts and the
 * address shown here both come from this.
 */
export const hookPath = (environment: connect.Environment): string =>
  environment === 'qa' ? 'qa' : 'webhook';

/** What follows an office of Vitec's QA environment, so it is never taken for live Vitec's. */
const QA_NOTE = 'in Vitec’s QA environment';

/**
 * An office as the panel writes it when no connection fetches it: its name as Vitec last gave it,
 * when a connection's office check kept it, then Vitec's id for it.
 */
export const officeLabel = (office: store.Office, names?: OfficeNames): string => {
  const name = names?.get(placeOf(office));
  const id = `Vitec’s office id ${office.officeId}${office.environment === 'qa' ? `, ${QA_NOTE}` : ''}`;
  return name ? `${name}, ${id}` : id;
};

/** Which connection fetches each office, by system and office id: the first that does. */
type Owners = Map<string, string>;

async function ownersOf(connections: Connection[]): Promise<Owners> {
  const owners: Owners = new Map();
  for (const connection of connections) {
    const environment = environmentOf(connection);
    for (const officeId of await officesOf(connection)) {
      const place = placeOf({ environment, officeId });
      if (!owners.has(place)) owners.set(place, connection.id);
    }
  }
  return owners;
}

/** What the page knows about the offices: who fetches each, and the names Vitec gave them. */
type Known = { owners: Owners; names: OfficeNames };

/**
 * An office as a thing Core names and links, under a connection that fetches it, so a QA office
 * is its QA login's; as text when no connection fetches it.
 */
function officeValue(office: store.Office, known: Known): AdminValue {
  const connection = known.owners.get(placeOf(office));
  if (!connection) return officeLabel(office, known.names);
  return {
    connection,
    office: office.officeId,
    ...(office.environment === 'qa' ? { note: QA_NOTE } : {}),
  };
}

/** A record on the fetch list as a thing Core names by its address and links to its page. */
function recordValue(entry: store.Entry, known: Known): AdminValue {
  const connection = known.owners.get(placeOf(entry));
  const thing: AdminThing | null = connection
    ? { connection, record: { datatype: entry.datatype, id: entry.remoteId } }
    : null;
  return thing ?? `Vitec’s id ${entry.remoteId}`;
}

/** The names of the offices the connections' last checks kept, by system and office id. */
type OfficeNames = Map<string, string>;
const placeOf = ({ environment, officeId }: store.Office): string => `${environment}:${officeId}`;

async function officeNames(connections: Connection[]): Promise<OfficeNames> {
  const names: OfficeNames = new Map();
  for (const connection of connections) {
    const check = await lastCheck(connection.id);
    if (!check) continue;
    const listed = check.ids.flatMap((checked) => checked.offices);
    for (const office of listed) {
      if (office.name)
        names.set(
          placeOf({ environment: check.environment, officeId: office.customerId }),
          office.name,
        );
    }
    for (const [officeId, name] of Object.entries(check.names)) {
      names.set(placeOf({ environment: check.environment, officeId }), name);
    }
  }
  return names;
}

/** Why a record waits on the fetch list, in words (the stored reason stays the code's). */
const WAITS: Record<store.Reason, string> = {
  webhook: 'Vitec sent a notification that it changed',
  remove: 'Vitec no longer lists it, so it leaves the sites',
  load: 'Core loads its office in full',
  catch_up: 'the catch-up found it changed',
  reference: 'another record names it, as a home names its housing cooperative',
  refetch: 'someone asked to fetch it again',
};
const waitsBecause = (reason: store.Reason): string => WAITS[reason] ?? reason;

/** The system a connection's login is for; an unreadable login counts as live Vitec's. */
const environmentOf = (connection: Connection): connect.Environment =>
  connect.loginOf(connection.credentials)?.environment ?? 'live';

/** The system an action's parameters name: QA only when they say so. */
const environmentIn = (params: Record<string, string>): connect.Environment =>
  params['environment'] === 'qa' ? 'qa' : 'live';

const moment = (value: string | Date | null | undefined): AdminValue =>
  value && new Date(value).toISOString() === LONG_AGO
    ? { text: 'Runs within a minute', state: 'warn' }
    : { moment: value ? new Date(value).toISOString() : null };

const webhookUrl = (environment: connect.Environment): AdminValue => {
  const token = process.env['VITEC_WEBHOOK_TOKEN'];
  return token
    ? { address: `/v1/hook/vitec/${hookPath(environment)}/${token}` }
    : {
        text: 'Not set up. The server setting VITEC_WEBHOOK_TOKEN is empty, so Core turns every notification from Vitec away, and changes reach the sites only with the catch-up, up to 12 hours later. Set it in Core’s server settings.',
        state: 'bad',
      };
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
    officesOf(connection).then((offices) => {
      const environment = environmentOf(connection);
      return store.summary(offices.map((officeId) => ({ environment, officeId })));
    }),
  ]);
  const paused = Boolean(pausedUntil) && new Date(pausedUntil ?? 0).getTime() > Date.now();
  return { catchUpAt, compareAt, until, pausedUntil, counts, paused };
}

const scheduleActions = (connection: Connection, schedule: Schedule): AdminAction[] => [
  {
    id: 'catch_up',
    label: 'Catch up now',
    help: 'Asks Vitec within a minute for everything that changed since the last catch-up, and fetches it. A catch-up runs by itself every 12 hours. Press it when a change made in Vitec has not reached the sites, for example because a notification went missing.',
    params: { connection: connection.id },
  },
  {
    id: 'compare',
    label: 'Compare now',
    help: 'Asks Vitec within a minute for its whole list of what is marketed, and takes off the sites every home, new-build project, agent, office or area no longer on it. A comparison runs by itself once a day. Press it when a home the brokerage stopped marketing in Vitec still shows on the sites.',
    params: { connection: connection.id },
  },
  ...(schedule.paused
    ? [
        {
          id: 'resume',
          label: 'Ask Vitec again now',
          help: 'Core stopped asking Vitec for this connection after five failed calls in a row, and asks again by itself at the time under State. Press this to ask again at once, for example when Vitec says its service is back.',
          params: { connection: connection.id },
        },
      ]
    : []),
];

const fetchListText = (counts: store.Summary): string => {
  const { waiting, retrying, givenUp } = counts;
  if (waiting + retrying + givenUp === 0) return 'Nothing waiting';
  const some = (n: number, words: string): string =>
    n === 0 ? `none ${words}` : `${counted(n, 'record', 'records')} ${words}`;
  return `${some(waiting, 'waiting')}, ${some(retrying, 'to be tried again')}, ${givenUp === 0 ? 'none' : String(givenUp)} given up`;
};

/** A connection's state: fetching, or why not. */
function stateOf(connection: Connection, schedule: Schedule, offices: string[]): AdminValue {
  if (!connect.loginOf(connection.credentials))
    return {
      text: 'Fetching nothing, because the login has no username or password',
      state: 'bad',
    };
  if (schedule.paused) {
    return {
      text: `Not asking Vitec until ${when(schedule.pausedUntil ?? new Date())}, after five failed calls in a row`,
      state: 'bad',
    };
  }
  if (offices.length === 0)
    return { text: 'Fetching nothing, because Vitec has given no office', state: 'warn' };
  return { text: 'Fetching', state: 'ok' };
}

// ---- The Vitec page ---------------------------------------------------------------------------

async function connectionsSection(connections: Connection[], known: Known): Promise<AdminSection> {
  const rows = [];
  for (const connection of connections) {
    const schedule = await scheduleOf(connection);
    const offices = await officesOf(connection);
    const environment = environmentOf(connection);
    rows.push({
      cells: [
        { connection: connection.id },
        offices.length === 0
          ? 'No office yet'
          : offices.length === 1
            ? officeValue({ environment, officeId: offices[0] ?? '' }, known)
            : offices
                .map((officeId) => officeLabel({ environment, officeId }, known.names))
                .join(' and '),
        stateOf(connection, schedule, offices),
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
    help: 'Every 12 hours, a catch-up asks Vitec for everything that changed since the last catch-up, in case a notification went missing. Once a day, a comparison reads Vitec’s whole list and takes off the sites whatever is no longer on it. Both run by themselves. The buttons in a row run them for that connection within a minute.',
    table: {
      columns: [
        'Connection',
        'Offices',
        'State',
        'Last catch-up',
        'Changes fetched up to',
        'Last comparison',
        'Fetch list',
      ],
      rows,
      empty:
        'No tenant has a Vitec connection yet. To add one, open Tenants, press “New tenant” and choose vitec as its CRM.',
    },
  };
}

async function blockedSection(known: Known): Promise<AdminSection> {
  const rows = (await store.blockedOffices()).map((office) => ({
    cells: [officeValue(office, known), moment(office.blockedAt), office.reason],
  }));
  return {
    title: 'Refused offices',
    help: 'An office shows here when Vitec refuses to let the login read it, for example after a cancelled subscription or a changed password. From then on, Core asks Vitec about the office only at the daily office check, and the office’s homes on the sites stop updating. The first refusal also stops every call with the same login until Core has checked the offices, within a minute. When Vitec lets the login read the office again, the office leaves this list and is loaded again in full. When Vitec still refuses it a day after the first refusal, the office leaves the sites with its homes and new-build projects, and its agents stay. Ask the brokerage about a refused office. After a fix, press “Fetch offices” on the tenant’s page, and Core checks within a minute.',
    table: {
      columns: ['Office', 'Refused since', 'What Vitec said'],
      rows,
      empty: 'No office is refused. Vitec answers for every office Core fetches.',
    },
  };
}

async function fetchListSection(known: Known): Promise<AdminSection> {
  const rows = (await store.entries(50)).map((entry) => {
    const params = {
      office: entry.officeId,
      environment: entry.environment,
      datatype: entry.datatype,
      id: entry.remoteId,
    };
    return {
      cells: [
        officeValue(entry, known),
        recordNamed(entry.datatype),
        recordValue(entry, known),
        waitsBecause(entry.reason),
        entry.attempts,
        entry.nextAt
          ? moment(entry.nextAt)
          : { text: 'Given up after six failed tries', state: 'bad' as const },
        entry.lastError,
      ],
      actions: [
        {
          id: 'retry',
          label: 'Retry now',
          help: 'Puts this record back in line to be fetched now, with its count of tries from zero. Press it for a record Core gave up on after six failed tries, once you believe Vitec answers for it again.',
          params,
        },
        {
          id: 'drop',
          label: 'Drop',
          danger: true,
          help: 'Takes this record off the fetch list without fetching it. The sites keep the record as they show it now. Vitec’s next notification about the record puts it back, and so does a catch-up after it changes again in Vitec. A dropped removal comes back with the next daily comparison. Press it for a record Core gave up on that should not be fetched, for example while you ask Vitec about it.',
          params,
        },
      ],
    };
  });
  return {
    title: 'Fetch list',
    help: 'The first 50 records Core is about to fetch from Vitec or take off the sites. Notifications, removals and “Fetch again” go first, then the loads of whole offices and the catch-ups. A record that failed is tried again after 10 seconds, and after twice as long each further time. After six failed tries Core gives the record up, and it waits here for “Retry now” or “Drop”. When five calls in a row fail for one connection, Core stops asking Vitec for that connection for two minutes, then for twice as long each time, at most 30 minutes.',
    table: {
      columns: ['Office', 'Type', 'Record', 'Why it waits', 'Tries', 'Next try', 'Last error'],
      rows,
      empty: 'Nothing is waiting to be fetched from Vitec or taken off the sites.',
    },
  };
}

const NO_CONNECTION =
  'Nothing was done, because the button did not say which connection it is for. Reload the page and press it again.';
const NO_RECORD =
  'Nothing was done, because the button did not say which record it is for. Reload the page and press it again.';

/** What the page's buttons do; a schedule is run by making it overdue for the worker's next tick. */
const ACTIONS: Record<string, (params: Record<string, string>) => Promise<string>> = {
  catch_up: async ({ connection }) => {
    if (!connection) throw new Error(NO_CONNECTION);
    await store.setState(connection, 'catch_up_at', LONG_AGO);
    return 'This connection asks Vitec for its changes within a minute.';
  },
  compare: async ({ connection }) => {
    if (!connection) throw new Error(NO_CONNECTION);
    await store.setState(connection, 'compare_at', LONG_AGO);
    return 'This connection compares Vitec’s list within a minute. Whatever Vitec no longer lists then leaves the sites.';
  },
  check_offices: async ({ connection }) => {
    if (!connection) throw new Error(NO_CONNECTION);
    await checkSoon(connection);
    return 'Core asks Vitec within a minute which offices reach the sites through this connection. Reload this page in a minute to see the answer.';
  },
  resume: async ({ connection }) => {
    if (!connection) throw new Error(NO_CONNECTION);
    await store.setState(connection, 'paused_until', '');
    await store.setState(connection, 'failures', '0');
    return 'This connection asks Vitec again now.';
  },
  retry: async (params) => {
    const { office, datatype, id } = params;
    const known = mappers[datatype as keyof typeof mappers]
      ? (datatype as store.Entry['datatype'])
      : null;
    if (!office || !known || !id) throw new Error(NO_RECORD);
    const where = { environment: environmentIn(params), officeId: office };
    await store.expediteOne(where, known, id);
    return `This ${recordNamed(known)} is fetched again now.`;
  },
  drop: async (params) => {
    const { office, datatype, id } = params;
    const known = mappers[datatype as keyof typeof mappers]
      ? (datatype as store.Entry['datatype'])
      : null;
    if (!office || !known || !id) throw new Error(NO_RECORD);
    const where = { environment: environmentIn(params), officeId: office };
    await store.drop(where, known, id);
    return `This ${recordNamed(known)} is off the fetch list. The sites keep it as they show it now.`;
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
  const auth = connect.loginOf(stored);
  if (!auth) {
    return {
      ok: false,
      detail:
        'Vitec was not asked, because the field “Username” or “Password” is empty. Type both and press “Check login” again.',
    };
  }
  const ids = auth.customerId ? [auth.customerId] : officeIds;
  if (ids.length === 0) {
    return {
      ok: false,
      detail:
        'Vitec was not asked, because the field “Customer or group id” is empty. Without the id, nothing reaches the sites. Type the id Vitec issued the login for, such as M30011 or G2, and press “Check login” again.',
    };
  }
  const answers: string[] = [];
  let ok = true;
  // A trial of a typed login: kept back from a refused office, and its refusals block nothing.
  await connect.asLoginTrial(async () => {
    for (const officeId of ids) {
      try {
        const page = await connect.page(auth, 'office', officeId, 0, undefined, 1);
        const listed = page?.totalRowCount ?? 0;
        // A yes with no office would mislead: nothing would reach the sites.
        if (listed === 0) ok = false;
        answers.push(
          listed === 0
            ? `Vitec accepts the login but lists no office behind ${officeId}, so nothing would reach the sites. Check the customer or group id with the brokerage.`
            : `Vitec accepts the login and lists ${counted(listed, 'office', 'offices')} behind ${officeId}.`,
        );
      } catch (error) {
        ok = false;
        const kind = connect.kindOf(error);
        answers.push(
          kind === 'forbidden'
            ? `Vitec does not let this username and password read ${officeId}. Check both with the brokerage or in Vitec’s partner portal, type them again and press “Check login” again.`
            : kind === 'blocked' && error instanceof Error
              ? error.message
              : `The login could not be checked, because ${failureInWords(error)}. Try again in a few minutes.`,
        );
      }
    }
  });
  return { ok, detail: answers.join(' ') };
}

/** The office a record was seen under, when the caller does not know it. */
async function officeFor(
  connection: Connection,
  environment: connect.Environment,
  datatype: store.Entry['datatype'],
  remoteId: string,
  given: string | null,
): Promise<string | null> {
  if (given) return given;
  const offices = await officesOf(connection);
  for (const officeId of offices) {
    if (await store.isKnown({ environment, officeId }, datatype, remoteId)) return officeId;
  }
  return offices[0] ?? null;
}

/** The last check: when, and what it means when Vitec did not answer or listed no office. */
function lastCheckText(check: OfficesCheck | null): AdminValue {
  if (!check) return moment(null);
  const at = when(check.at);
  if (check.ids.length === 0 && check.offices.length === 0) {
    return {
      text: 'No customer or group id is typed above, so Core has not asked Vitec, and nothing reaches the sites. Type the id Vitec issued the login for in the field “Customer or group id”, save, and press “Fetch offices”.',
      state: 'bad',
    };
  }
  if (check.source !== 'kept') return moment(check.at);
  if (!check.answered) {
    return check.offices.length > 0
      ? {
          text: `Vitec did not answer the check at ${at}. The offices of the last answer stay on the sites, and Core asks again within the hour. Nothing needs doing.`,
          state: 'warn',
        }
      : {
          text: `Vitec did not answer the check at ${at}, so nothing reaches the sites yet. Core asks again within the hour.`,
          state: 'bad',
        };
  }
  const ids = check.ids.map((checked) => checked.id).join(' and ');
  return check.offices.length > 0
    ? {
        text: `At the check at ${at}, Vitec listed no office this login may read behind ${ids}, so the offices of the last answer stay on the sites. Check the customer or group id and the login’s rights with the brokerage.`,
        state: 'warn',
      }
    : {
        text: `At the check at ${at}, Vitec listed no office this login may read behind ${ids}, so nothing reaches the sites. Check the customer or group id and the login’s rights with the brokerage.`,
        state: 'bad',
      };
}

/** A refused office's cell: since when, and what follows (question 158 b). */
function refusedText(since: string, synced: boolean): AdminValue {
  return synced
    ? {
        text: `No. Vitec has refused this login since ${when(since)}. The office stays on the sites until the next daily check, and leaves them if Vitec still refuses it then.`,
        state: 'warn',
      }
    : {
        text: `No. Vitec has refused this login since ${when(since)}, and the office is not on the sites.`,
        state: 'bad',
      };
}

/** A refused id's cell: the same, for every office behind it. */
function refusedIdText(since: string, synced: boolean): AdminValue {
  return synced
    ? {
        text: `Vitec has refused this login the whole id since ${when(since)}. The offices behind the id stay on the sites until the next daily check, and leave them if Vitec still refuses then.`,
        state: 'warn',
      }
    : {
        text: `Vitec has refused this login the whole id since ${when(since)}, and no office behind it is on the sites.`,
        state: 'bad',
      };
}

/** Whether an office Vitec listed reads with the login, and if not, why. */
function readableText(office: OfficeSeen, synced: boolean): AdminValue {
  if (office.readable) return { text: 'Yes', state: 'ok' };
  if (office.refusedSince) return refusedText(office.refusedSince, synced);
  if (office.detail === NO_SUCH_OFFICE)
    return { text: `No. ${office.detail}, so it does not reach the sites.`, state: 'bad' };
  return {
    text: `No. Core could not read it, because ${office.detail ?? 'the call to Vitec failed'}.`,
    state: 'bad',
  };
}

/** The office groups Vitec answered, by name, or why there are none. */
function groupsText(check: OfficesCheck | null): AdminValue {
  if (!check) return null;
  const refused = check.ids.find((checked) => checked.groupsError)?.groupsError;
  const names = check.ids.flatMap((checked) =>
    checked.groups.map(
      (group) => `${group.name} with ${counted(group.officeIds.length, 'office', 'offices')}`,
    ),
  );
  if (names.length > 0) return names.join(' and ');
  if (refused) return { text: sentence(refused), state: 'bad' };
  return 'None, so every office behind the id reaches the sites.';
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
              null,
              null,
              checked.refusedSince
                ? refusedIdText(checked.refusedSince, synced.size > 0)
                : { text: sentence(checked.error), state: 'bad' as const },
              null,
            ],
          },
        ]
      : checked.offices.map((office) => ({
          cells: [
            checked.id,
            office.customerId,
            office.name,
            readableText(office, synced.has(office.customerId)),
            synced.has(office.customerId),
          ],
        })),
  );
  return {
    title: 'Offices Vitec lists',
    help: 'Vitec decides which offices reach this tenant’s sites, and nothing is chosen here. Core asks Vitec which offices sit behind the customer or group id above once a day, and within seconds after a new id is saved. When the brokerage keeps an office group called “Webbplats” in Vitec, only the offices in that group reach the sites. When there is no such group, or it holds none of these offices, every office behind the id reaches the sites. An office that leaves the group leaves the sites at the next check, with its homes and new-build projects, and its agents stay. An office Vitec refuses to let this login read stays on the sites for one more day, and leaves them if Vitec still refuses it then.',
    items: [
      { label: 'Last check', value: lastCheckText(check) },
      { label: 'Office groups in Vitec', value: groupsText(check) },
    ],
    table: {
      columns: [
        'Customer or group id',
        'Vitec’s office id',
        'Office',
        'Readable with this login',
        'Synced to the sites',
      ],
      rows,
      empty: check
        ? 'No office to show, because no customer or group id is typed above.'
        : 'Core has not asked Vitec about the offices yet. The first check runs within a minute of the save. Reload the page to see it.',
    },
    actions: [
      {
        id: 'check_offices',
        label: 'Fetch offices',
        help: 'Asks Vitec within a minute, instead of at the daily check, which offices reach the sites, and loads or takes off offices by its answer. Press it after the brokerage changed its offices or its group “Webbplats” in Vitec, then reload the page in a minute.',
        params: { connection: connection.id },
      },
    ],
  };
}

export const vitecAdmin: AdapterAdmin = {
  // Each check's title and its sentence while it passes; the admin area and the alerts show
  // these, never the check's name (AGENTS.md, definition of done 5).
  checks: {
    'vitec.webhook_lag': {
      title: 'Changes Vitec told Core about',
      fine: 'Core handled every change Vitec told it about within five minutes.',
    },
    'vitec.retries': {
      title: 'Records fetched from Vitec',
      fine: 'No record has failed to fetch from Vitec three times in a row.',
    },
    'vitec.login': {
      title: 'Vitec logins Core can read',
      fine: 'Core can read the saved Vitec login of every connection that fetches.',
    },
    'vitec.no_offices': {
      title: 'Offices to fetch from Vitec',
      fine: 'Every Vitec connection that has been checked has offices to fetch.',
    },
    'vitec.catch_up': {
      title: 'Catching up with Vitec',
      fine: 'Every Vitec connection with offices has caught up with Vitec within the last 13 hours.',
    },
    'vitec.offices': {
      title: 'Offices Vitec lets Core read',
      fine: 'Vitec lets Core read every office Core fetches.',
    },
    'vitec.connect': {
      title: 'Vitec answering Core',
      fine: 'Vitec answers Core’s calls for every connection.',
    },
  },

  credentials: [
    {
      key: 'username',
      label: 'Username',
      help: 'The username Vitec issued for this brokerage, shown with its password in Vitec’s partner portal. The one username and password are used for every call to Vitec.',
      required: true,
    },
    { key: 'password', label: 'Password', secret: true, required: true },
    {
      key: 'customer_id',
      label: 'Customer or group id',
      help: 'The id Vitec issued this login for. Behind a group id, such as G2, are all the offices of the group; behind a customer id, such as M30011, only its own office, so a customer id loads only that office even when the brokerage has several. Without it, Core cannot ask Vitec for offices, and nothing reaches the sites. Core asks Vitec once a day which offices sit behind the id. After the save, the card “Offices Vitec lists” below shows which offices reach the sites. A changed id counts from the next daily check, or within a minute after “Fetch offices”.',
    },
    {
      key: 'qa',
      label: 'Use Vitec’s QA environment',
      help: `Tick this when the username and password above are a test account in Vitec’s QA environment, Vitec’s test system at ${connect.baseUrlOf('qa')}: every call then goes there, and its records are kept apart from live Vitec’s. The forms visitors send about this account’s homes go there too, even from a test copy of Core such as staging, which holds every other form back. Unticking it switches a saved connection back to live Vitec. A switch takes everything the other system gave off the sites, and the offices are loaded again from the system chosen. Give a test account a tenant of its own, so that test homes never reach a real website.`,
      // Exactly no and yes: the new tenant page draws such a field as a tickbox, ticked sending yes.
      options: [{ value: 'no' }, { value: 'yes' }],
    },
  ],

  directions,

  async panel(connections) {
    const known = { owners: await ownersOf(connections), names: await officeNames(connections) };
    return [
      {
        title: 'Notification addresses and call limits',
        help: 'Vitec tells Core at these addresses each time a home on the website, a new-build project, an agent, an office or an area changes or is removed. Core then fetches the record or takes it off the sites, usually within seconds. Ask Vitec to send the brokerage’s notifications to the address for live Vitec. For a login to Vitec’s QA environment, ask Vitec to send QA’s notifications to the address for Vitec’s QA. Without notifications, changes still reach the sites with the catch-up, up to 12 hours later.',
        items: [
          { label: 'Address for live Vitec', value: webhookUrl('live') },
          { label: 'Address for Vitec’s QA', value: webhookUrl('qa') },
          { label: 'Live Vitec’s address', value: connect.baseUrlOf('live') },
          { label: 'Calls to Vitec at once', value: connect.concurrency() },
          { label: 'Calls to Vitec per second', value: connect.requestsPerSecond() },
        ],
      },
      await connectionsSection(connections, known),
      await blockedSection(known),
      await fetchListSection(known),
    ];
  },

  async connection(connection) {
    return [await officesSection(connection)];
  },

  async act(action, params) {
    const run = ACTIONS[action];
    if (!run)
      throw new Error(
        'Nothing was done, because Vitec’s page has no such button any more. Reload the page.',
      );
    return { message: await run(params) };
  },

  probe,

  async inspect(connection, record) {
    const auth = connect.loginOf(connection.credentials);
    if (!auth) {
      throw new Error(
        'Vitec was not asked, because the connection has no username or password saved. Type them on the tenant’s page and save.',
      );
    }
    const officeId = await officeFor(
      connection,
      auth.environment,
      record.datatype,
      record.remoteId,
      record.officeId,
    );
    if (!officeId) {
      throw new Error(
        'Vitec was not asked, because Vitec has given this connection no office yet. The card “Offices Vitec lists” on the tenant’s page says why.',
      );
    }
    const raw = await connect.getOne(auth, record.datatype, officeId, record.remoteId);
    if (raw === null) return null;
    const mapper = mappers[record.datatype];
    return { raw, mapped: mapper ? mapper(raw) : null };
  },

  async queue(connections): Promise<AdminQueued[]> {
    // Only these connections' offices, each in its system: the answer is bounded, and the engine
    // asks for the connections it shows.
    const { offices, theirs } = await officesIn(connections);
    return (await store.entries(200, theirs)).map((entry) => ({
      connectionId:
        connections.find((connection, index) =>
          store.holds(environmentOf(connection), offices[index] ?? [], entry),
        )?.id ?? null,
      officeId: entry.officeId,
      datatype: entry.datatype,
      remoteId: entry.remoteId,
      queuedAt: entry.queuedAt.toISOString(),
      reason: waitsBecause(entry.reason),
      attempts: entry.attempts,
      nextAt: entry.nextAt?.toISOString() ?? null,
      lastError: entry.lastError,
    }));
  },

  async queueCount(connections, scope) {
    const { theirs } = await officesIn(connections);
    return store.count(
      theirs.filter(
        (office) => !scope.officeIds?.length || scope.officeIds.includes(office.officeId),
      ),
      scope.datatypes?.length ? scope.datatypes : null,
      scope.remoteId ?? null,
    );
  },
};

/** Each connection's offices, and all of them together, each in its connection's system. */
async function officesIn(
  connections: Connection[],
): Promise<{ offices: string[][]; theirs: store.Office[] }> {
  const offices = await Promise.all(connections.map((connection) => officesOf(connection)));
  const theirs = connections.flatMap((connection, index) =>
    (offices[index] ?? []).map((officeId) => ({
      environment: environmentOf(connection),
      officeId,
    })),
  );
  return { offices, theirs };
}

/** The office a "fetch again" goes to: the one the record was seen under, else the connection's first. */
export const refetchOffice = officeFor;
