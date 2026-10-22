// What the Vitec adapter shows and does in the admin panel, as data the panel draws: under a
// tenant's connection, the offices Vitec lists, with a button to check them now; how a new
// connection is coming along; a probe of a typed login; what waits on the fetch list, and one more
// try for the records a check names. Every action carries `help`, one sentence saying what it does
// and when a person would press it (Patric, 2026-09-21). Nothing here knows the engine beyond the
// adapter API.
import * as connect from '../api.js';
import * as store from '../store.js';
import * as progress from '../progress.js';
import { mappers } from '../mappers.js';
import {
  checkSoon,
  lastCheck,
  NO_SUCH_OFFICE,
  officesOf,
  type OfficeSeen,
  type OfficesCheck,
} from '../offices.js';
import { counted, failureInWords, sentence, when } from '../words.js';
import type {
  AdapterAdmin,
  AdminQueued,
  AdminSection,
  AdminStep,
  AdminValue,
  Connection,
  ConnectionProgress,
  Datatype,
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

/** The names of the offices the connections' last checks kept, by system and office id. */
type OfficeNames = Map<string, string>;
const placeOf = ({ environment, officeId }: store.Office): string => `${environment}:${officeId}`;

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

const NO_CONNECTION =
  'Nothing was done, because the button did not say which connection it is for. Reload the page and press it again.';
const NO_RECORD =
  'Nothing was done, because the button did not say which record it is for. Reload the page and press it again.';

/**
 * Records named as `vitec.retries` names them, as one parameter `records`: a JSON list of
 * `{ connection, datatype, id }`. Null when the list cannot be read.
 */
function recordsIn(
  given: string | undefined,
): { connection: string; datatype: store.Entry['datatype']; id: string }[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(given ?? '');
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  const records = [];
  for (const one of parsed as Record<string, unknown>[]) {
    const { connection, datatype, id } = one ?? {};
    if (typeof connection !== 'string' || typeof id !== 'string' || !id) return null;
    if (typeof datatype !== 'string' || !mappers[datatype as keyof typeof mappers]) return null;
    records.push({ connection, datatype: datatype as store.Entry['datatype'], id });
  }
  return records;
}

/** What the admin area's buttons do. */
const ACTIONS: Record<
  string,
  (params: Record<string, string>, connections: Connection[]) => Promise<string>
> = {
  check_offices: async ({ connection }) => {
    if (!connection) throw new Error(NO_CONNECTION);
    await checkSoon(connection);
    return 'Core asks Vitec within a minute which offices reach the sites through this connection. Reload this page in a minute to see the answer.';
  },
  // The records `vitec.retries` names, each tried once more now through the fetch list, its
  // count of failed tries kept, so the check names it until it has loaded.
  retry_records: async ({ records }, connections) => {
    const wanted = recordsIn(records);
    if (!wanted) throw new Error(NO_RECORD);
    let found = 0;
    for (const { connection, datatype, id } of wanted) {
      const owner = connections.find((one) => one.id === connection);
      if (!owner) continue;
      const environment = environmentOf(owner);
      const offices = (await officesOf(owner)).map((officeId) => ({ environment, officeId }));
      found += await store.tryOnceMore(offices, datatype, id);
    }
    if (found === 0) {
      return 'Nothing was fetched again, because none of these records waits on the fetch list any more. They may have loaded meanwhile.';
    }
    return `${counted(found, 'record is', 'records are')} fetched again now.`;
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
        'Vitec was not asked, because the field “Username” or “Password” is empty. Type both and try again.',
    };
  }
  const ids = auth.customerId ? [auth.customerId] : officeIds;
  if (ids.length === 0) {
    return {
      ok: false,
      detail:
        'Vitec was not asked, because the field “Customer or group id” is empty. Without the id, nothing reaches the sites. Type the id Vitec issued the login for, such as M30011 or G2, and try again.',
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
            ? `Vitec does not let this username and password read ${officeId}. Check both with the brokerage or in Vitec’s partner portal, then type them again.`
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
    help: 'Vitec decides which offices reach this tenant’s sites, and nothing is chosen here. Core asks Vitec which offices sit behind the customer or group id above once a day, and within seconds after a new id or a new login is saved. When the brokerage keeps an office group called “Webbplats” in Vitec, only the offices in that group reach the sites. When there is no such group, or it holds none of these offices, every office behind the id reaches the sites. An office that leaves the group leaves the sites at the next check, with its homes, new-build projects, agents, areas and housing associations, except what another office on the sites also has, such as an agent who works at both. An office Vitec refuses to let this login read stays on the sites for one more day, and leaves them if Vitec still refuses it then.',
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

// ---- How a connection is coming along (question 199 a) -------------------------------------------

/** How changes reach the sites until Vitec's first notice comes: the end of the panel's sentence. */
const UNTIL_NOTICES = 'only at Core’s twice-daily catch-up, and Core doesn’t warn about it';

/** What the brokerage's Vitec admin does so that Vitec sends Core its notices, in order. */
function noticeSteps(environment: connect.Environment, check: OfficesCheck | null): AdminStep[] {
  const qa = environment === 'qa';
  const address = webhookUrl(environment);
  const listed = check?.ids.filter((checked) => checked.error === null) ?? [];
  const groups: AdminStep['note'] =
    listed.length === 0
      ? undefined
      : listed.some((checked) => checked.groupsError)
        ? { text: 'Office groups: Vitec doesn’t let Core read them yet.', state: 'warn' }
        : { text: 'Office groups: Core can already read them.', state: 'ok' };
  return [
    {
      text: qa
        ? 'Send the notices of Vitec’s QA environment to this address:'
        : 'Send Vitec’s notices to this address:',
      value: address,
      secret: typeof address === 'object' && address !== null && 'address' in address,
      help: `The same address for every ${qa ? 'connection to Vitec’s QA environment' : 'live Vitec connection'}; its end is Core’s secret. Copy gives the whole address; send it only to the brokerage’s Vitec admin.`,
    },
    {
      text: 'Subscribe it to Estate, Project, User, Office and Area, for Update and Remove. For Estate, include only the properties the brokerage shows on its website.',
    },
    { text: 'Keep the website’s offices in Vitec’s office group “Webbplats”.' },
    {
      text: 'Give the Vitec login Core uses Vitec’s CRM function group: Core reads the office groups with it, and sends search-profile forms.',
      ...(groups ? { note: groups } : {}),
    },
  ];
}

/** Why an office Vitec listed behind the id is not on the sites: the end of "<office> stays off: …". */
function offBecause(office: OfficeSeen, check: OfficesCheck): string | null {
  if (office.readable) {
    return check.source === 'group' ? 'it isn’t in Vitec’s office group “Webbplats”' : null;
  }
  if (office.refusedSince) return 'Vitec doesn’t let this login read it';
  if (office.detail === NO_SUCH_OFFICE) return 'Vitec answers that it doesn’t exist';
  return `Core couldn’t read it, because ${office.detail ?? 'the call to Vitec failed'}`;
}

/** The last office check: the offices on the sites, those left off and why, and what it changed. */
async function officeCheckOf(
  connection: Connection,
  check: OfficesCheck,
): Promise<ConnectionProgress['officeCheck']> {
  const [changes, added] = await Promise.all([
    progress.changesOf(connection.id),
    progress.addedAt(connection.id),
  ]);
  const seen = new Map<string, OfficeSeen>();
  for (const office of check.ids.flatMap((checked) => checked.offices)) {
    if (!check.offices.includes(office.customerId)) seen.set(office.customerId, office);
  }
  const current = changes?.at === check.at ? changes : null;
  return {
    at: check.at,
    on: check.offices.map((office) => ({
      office,
      name: check.names[office] ?? null,
      addedAt: added[office] ?? null,
    })),
    off: [...seen.values()].flatMap((office) => {
      const why = offBecause(office, check);
      return why ? [{ name: office.name ?? office.customerId, why }] : [];
    }),
    added: current?.added ?? [],
    removed: current?.removed ?? [],
  };
}

/** An office list kept in the state that holds no office. */
const EMPTY_LIST = new Set(['', '[]']);

const total = (counts: Partial<Record<Datatype, number>>): number =>
  Object.values(counts).reduce((sum, n) => sum + n, 0);

/**
 * The first load: what Vitec listed, by type, and what still waits on the fetch list. It is done
 * once no listing runs, no office's load waits for the office check, and nothing waits to be
 * fetched; that is kept, so the notices that follow never make it unfinished.
 */
async function firstLoadOf(
  connection: Connection,
  offices: readonly string[],
): Promise<ConnectionProgress['firstLoad']> {
  const load = await progress.firstLoadOf(connection.id);
  if (!load) return null;
  const listed: Partial<Record<Datatype, number>> = {};
  for (const counts of Object.values(load.listed)) {
    for (const [datatype, n] of Object.entries(counts) as [Datatype, number][]) {
      listed[datatype] = (listed[datatype] ?? 0) + n;
    }
  }
  if (load.doneAt) return { listed, waiting: {}, done: true };
  const environment = environmentOf(connection);
  const [waiting, pending] = await Promise.all([
    store.waitingByType(offices.map((officeId) => ({ environment, officeId }))),
    store.getState(connection.id, 'load_after_check'),
  ]);
  const done =
    Object.keys(load.listed).length > 0 &&
    !load.listing &&
    EMPTY_LIST.has(pending ?? '') &&
    total(waiting) === 0;
  if (done) await progress.noteLoaded(connection.id);
  return { listed, waiting: done ? {} : waiting, done };
}

/** Since when the login's changes are held back: its hold, or the first of its offices blocked. */
async function heldSinceOf(
  connection: Connection,
  offices: readonly string[],
): Promise<string | null> {
  const environment = environmentOf(connection);
  const [held, blocked] = await Promise.all([
    store.getState(connection.id, 'held'),
    store.blockedOffices(),
  ]);
  const since = blocked
    .filter((office) => office.environment === environment && offices.includes(office.officeId))
    .map((office) => office.blockedAt.toISOString());
  return [held || null, ...since].filter((at): at is string => at !== null).sort()[0] ?? null;
}

async function connectionProgress(connection: Connection): Promise<ConnectionProgress> {
  const environment = environmentOf(connection);
  const [check, offices, followed, noticed] = await Promise.all([
    lastCheck(connection.id),
    officesOf(connection),
    progress.followedSince(connection.id),
    progress.firstNoticeAt(connection.id),
  ]);
  const current = check?.environment === environment ? check : null;
  return {
    firstNotice:
      followed && !noticed
        ? {
            since: followed,
            steps: noticeSteps(environment, current),
            meanwhile: UNTIL_NOTICES,
          }
        : null,
    firstLoad: await firstLoadOf(connection, offices),
    officeCheck: current ? await officeCheckOf(connection, current) : null,
    heldSince: await heldSinceOf(connection, offices),
  };
}

export const vitecAdmin: AdapterAdmin = {
  // Each check's title; the admin area and the alerts show it, never the check's name (AGENTS.md,
  // definition of done 5).
  checks: {
    'vitec.webhook_lag': { title: 'Changes Vitec told Core about' },
    'vitec.retries': { title: 'Records fetched from Vitec' },
    'vitec.login': { title: 'Vitec logins Core can read' },
    'vitec.no_offices': { title: 'Offices to fetch from Vitec' },
    'vitec.catch_up': { title: 'Catching up with Vitec' },
    'vitec.offices': { title: 'Offices Vitec lets Core read' },
    'vitec.connect': { title: 'Vitec answering Core' },
  },

  // The words the admin panel shows for this login, field by field, in the order it shows them.
  credentials: [
    {
      key: 'qa',
      label: 'Vitec system',
      // Exactly no and yes, the system's words on each: a QA login reads Vitec's test system.
      options: [
        { value: 'no', label: 'Live Vitec' },
        { value: 'yes', label: 'Vitec QA (test system)' },
      ],
    },
    {
      key: 'customer_id',
      label: 'Customer or group id',
      help: 'From Vitec: an office’s customer id (M…) or the id of a group of offices (G…).',
    },
    { key: 'username', label: 'Username', required: true },
    {
      key: 'password',
      label: 'Password',
      secret: true,
      required: true,
      help: 'From the Vitec Connect key pair',
    },
  ],

  // The line under a connection's name: the Vitec system it reads and the id it reads.
  describe(connection) {
    const login = connect.loginOf(connection.credentials);
    const system = login?.environment === 'qa' ? 'Vitec QA (test system)' : 'Live Vitec';
    return login?.customerId ? `${system} · ${login.customerId}` : system;
  },

  async connection(connection) {
    return [await officesSection(connection)];
  },

  async act(action, params, connections) {
    const run = ACTIONS[action];
    if (!run)
      throw new Error(
        'Nothing was done, because Vitec’s page has no such button any more. Reload the page.',
      );
    return { message: await run(params, connections) };
  },

  probe,

  progress: connectionProgress,

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
