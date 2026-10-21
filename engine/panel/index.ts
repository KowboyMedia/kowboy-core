// The admin panel (design B): its JSON API under /v1/panel/ and its browser app under /admin. The
// API answers the app only: a request that changes something must be JSON, which a page on another
// site cannot send without asking first, and the session cookie never leaves Core's own pages.
import type { Config } from '../config.js';
import { report } from '../errors.js';
import { sendMail } from '../mail.js';
import { tenantById } from '../storage/connections.js';
import type { Request, Response, RouteTable } from '../http/server.js';
import {
  clearedCookie,
  endSession,
  looksLikeAddress,
  newLink,
  normalised,
  openLink,
  sessionCookie,
  sessionFor,
  tokenFrom,
  type AuthSettings,
} from './auth.js';
import { instanceName, signInMail } from './mail.js';
import { inbox } from './inbox.js';
import { panelApp } from './app.js';
import {
  addWebsite,
  brokerage,
  brokerageList,
  createBrokerage,
  crms,
  editWebsite,
  newBellSecret,
  removeWebsite,
  renameBrokerage,
  replaceToken,
  switchBrokerage,
} from './brokerages.js';
import {
  addConnection,
  editConnection,
  removeConnection,
  runAction,
  type Refusal,
} from './connections.js';
import { deleteBrokerage } from './deletion.js';
import { flow } from './flow.js';
import { actOn } from './problems.js';
import { retryRecords } from './records.js';
import { databaseFailed, databaseWords, failureWords } from './failure.js';
import { recordList, recordPage, RECORD_TYPES, type RecordFilter } from './recordlist.js';
import { choiceOf, startSync, syncState, type SyncTicket, type SyncWhat } from './sync.js';
import type { Datatype } from '../adapter-api/types.js';

type PanelConfig = AuthSettings & Pick<Config, 'environment' | 'port' | 'eventRetentionDays'>;

let config: PanelConfig | null = null;

export function configurePanel(next: PanelConfig): void {
  config = next;
}

const settings = (): PanelConfig => {
  if (!config) throw new Error('the panel is not configured; startEngine configures it');
  return config;
};

/** Nothing the panel's API answers is kept by a browser or a proxy. */
const answer = (status: number, body: unknown, headers: Record<string, string> = {}): Response => ({
  status,
  body,
  headers: { 'cache-control': 'no-store', ...headers },
});

const isJson = (request: Request): boolean =>
  (request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json');

function body(request: Request): Record<string, unknown> | null {
  if (!isJson(request)) return null;
  try {
    const parsed = request.json<unknown>();
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * An error before Core knows who asks: reported, and answered with the database's fixed words when
 * the database failed, since the error's own words are only for a signed-in person (failure.ts).
 */
function unusable(error: unknown, request: Request): Response {
  report(error, { where: 'panel', path: request.path });
  return databaseFailed(error)
    ? answer(503, {
        error: 'database',
        message: databaseWords({ reading: request.method === 'GET' }),
      })
    : answer(500, { error: 'internal error' });
}

/** A handler for anyone, signed in or not, that uses the database. */
const anyone =
  (handler: (request: Request) => Promise<Response>) =>
  async (request: Request): Promise<Response> => {
    try {
      return await handler(request);
    } catch (error) {
      return unusable(error, request);
    }
  };

/** Core's own address, where the link in the mail points: PUBLIC_URL, never a request's Host. */
const base = (): string => settings().publicUrl ?? `http://localhost:${String(settings().port)}`;

/** `GET /v1/panel/sign-in`: what the sign-in page says, from Core's settings. */
function signInFacts(): Response {
  const { environment, adminRememberDays, adminSessionDays, adminLinkMinutes } = settings();
  return answer(200, {
    instance: instanceName(environment),
    rememberDays: adminRememberDays,
    sessionDays: adminSessionDays,
    linkMinutes: adminLinkMinutes,
  });
}

/** Make the link and mail it. Never in the answer's path, so the answer takes as long for anyone. */
async function mailLink(email: string, remember: boolean): Promise<void> {
  try {
    const link = await newLink(email, remember, settings());
    if (!link) return;
    await sendMail(
      signInMail({
        to: link.email,
        link: `${base()}/admin/link#${link.token}`,
        base: base(),
        expiresAt: link.expiresAt,
        environment: settings().environment,
      }),
    );
  } catch (error) {
    report(error, { where: 'panel sign-in link' });
  }
}

/**
 * `POST /v1/panel/sign-in`: a link by email. The same answer for any address, whether it may sign
 * in or not; only an address that cannot be one is answered otherwise.
 */
function requestLink(request: Request): Response {
  const given = body(request);
  if (!given) return answer(415, { error: 'send JSON' });
  const email = normalised(typeof given['email'] === 'string' ? given['email'] : '');
  if (!looksLikeAddress(email)) return answer(400, { error: 'address' });
  void mailLink(email, given['remember'] === true);
  return answer(202, { ok: true });
}

/** `POST /v1/panel/sign-in/link`: open the link from the mail, which signs in this device. */
const useLink = anyone(async (request) => {
  const given = body(request);
  if (!given) return answer(415, { error: 'send JSON' });
  const token = typeof given['token'] === 'string' ? given['token'] : '';
  const device = (request.headers['user-agent'] ?? '').slice(0, 200) || null;
  const session = await openLink(token, device, settings());
  if (!session) return answer(410, { error: 'link' });
  return answer(
    200,
    { email: session.email, until: session.expiresAt.toISOString() },
    { 'set-cookie': sessionCookie(session, settings()) },
  );
});

type Signed = { email: string; expiresAt: Date };

/**
 * A handler for a signed-in person only; anyone else is told 401. An error nobody expected is
 * answered with what failed, whose fault it is and what to do, for the person to pass on.
 */
const signedIn =
  (handler: (request: Request, person: Signed) => Promise<Response> | Response) =>
  async (request: Request): Promise<Response> => {
    let person: Signed | null;
    try {
      person = await sessionFor(tokenFrom(request.headers['cookie']), settings());
    } catch (error) {
      return unusable(error, request);
    }
    if (!person) return answer(401, { error: 'signed out' });
    try {
      return await handler(request, person);
    } catch (error) {
      report(error, { where: 'panel', path: request.path });
      const message = failureWords(error, { reading: request.method === 'GET' });
      return databaseFailed(error)
        ? answer(503, { error: 'database', message })
        : answer(500, { error: 'internal error', message });
    }
  };

/** `GET /v1/panel/me`: who is signed in on this device, and until when. */
const me = signedIn((_request, person) =>
  answer(200, {
    email: person.email,
    until: person.expiresAt.toISOString(),
    instance: instanceName(settings().environment),
  }),
);

/** `POST /v1/panel/sign-out`: this device only. */
const signOut = anyone(async (request) => {
  if (!isJson(request)) return answer(415, { error: 'send JSON' });
  await endSession(tokenFrom(request.headers['cookie']), settings());
  return answer(200, { ok: true }, { 'set-cookie': clearedCookie(settings()) });
});

/** `GET /v1/panel/inbox`: what needs a person now. */
const inboxRoute = signedIn(async () => answer(200, await inbox()));

// ---- Brokerages, their websites and their CRM connections ----------------------------------------

const REFUSED: Record<Refusal, number> = { missing: 404, fields: 400, login: 422, crm: 502 };
/** A refusal, with the words of what failed when Core has them (failure.ts). */
const refusal = (why: Refusal, said?: string): Response =>
  answer(REFUSED[why], said ? { error: why, message: said } : { error: why });
const missing = (): Response => refusal('missing');

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** A website's bell address: an http or https address. */
function bellAddress(value: unknown): string | null {
  try {
    const url = new URL(text(value));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/** The part of a path after a prefix, split at its slashes: `/v1/panel/brokerages/3/token` → 3, token. */
const partsAfter = (prefix: string, path: string): string[] =>
  path
    .slice(prefix.length)
    .split('/')
    .filter((part) => part !== '')
    .map((part) => decodeURIComponent(part));

const numberOf = (part: string | undefined): number | null =>
  part && /^\d+$/.test(part) ? Number(part) : null;

/** A change: JSON from a signed-in person, handed the parsed body and the person. */
const change = (
  handler: (
    request: Request,
    given: Record<string, unknown>,
    person: Signed,
  ) => Promise<Response> | Response,
) =>
  signedIn((request, person) => {
    const given = body(request);
    if (!given) return answer(415, { error: 'send JSON' });
    return handler(request, given, person);
  });

const listRoute = signedIn(async () => answer(200, { brokerages: await brokerageList() }));

const crmsRoute = signedIn(() => answer(200, { crms: crms() }));

const createRoute = change(async (_request, given) => {
  const name = text(given['name']);
  if (name === '') return refusal('fields');
  return answer(201, { id: await createBrokerage(name) });
});

const pageRoute = signedIn(async (request) => {
  const [part, ...rest] = partsAfter('/v1/panel/brokerages/', request.path);
  const id = numberOf(part);
  if (id === null || rest.length > 0) return missing();
  const page = await brokerage(id, { coreUrl: base(), credentialsKey: settings().credentialsKey });
  return page ? answer(200, page) : missing();
});

type BrokerageChange = (
  id: number,
  given: Record<string, unknown>,
  person: Signed,
) => Promise<Response>;

/**
 * A website the bot check's list has no room for (171 a): nothing is saved, and the check's own
 * sentence says why.
 */
const botCheckRefusal = (why: string): Response =>
  answer(409, { error: 'bot check', message: why });

/** A website's label and bell address as a person typed them; null when one is missing or wrong. */
function websiteOf(given: Record<string, unknown>): { label: string; bellUrl: string } | null {
  const label = text(given['label']);
  const bellUrl = bellAddress(given['bellUrl']);
  return label === '' || !bellUrl ? null : { label, bellUrl };
}

/** What a person changes on a brokerage, by the last part of its address. */
const BROKERAGE_CHANGES: Record<string, BrokerageChange> = {
  switch: async (id, given) =>
    (await switchBrokerage(id, given['on'] === true)) ? answer(200, { ok: true }) : missing(),
  edit: async (id, given) => {
    const name = text(given['name']);
    if (name === '') return refusal('fields');
    return (await renameBrokerage(id, name)) ? answer(200, { ok: true }) : missing();
  },
  // Deleting a brokerage and everything of it takes its name, typed: the page asks for it.
  delete: async (id, given) => {
    const tenant = await tenantById(id);
    if (!tenant) return missing();
    if (text(given['name']) !== tenant.display_name.trim()) return refusal('fields');
    return (await deleteBrokerage(id)) ? answer(200, { ok: true }) : missing();
  },
  token: async (id) => {
    const token = await replaceToken(id);
    return token ? answer(200, { token }) : missing();
  },
  websites: async (id, given) => {
    const typed = websiteOf(given);
    if (!typed) return refusal('fields');
    const website = await addWebsite(id, typed);
    if (website === null) return missing();
    if ('refused' in website) return botCheckRefusal(website.refused);
    return answer(
      201,
      website.warning ? { id: website.id, warning: website.warning } : { id: website.id },
    );
  },
  connections: async (id, given) => {
    const done = await addConnection(
      id,
      {
        provider: text(given['provider']),
        login: given['login'],
        formsTestMode: given['formsTestMode'] === true,
      },
      settings().credentialsKey,
    );
    return done.ok ? answer(201, done.value) : refusal(done.why, done.said);
  },
  // The records of the brokerage an Inbox card says can't be loaded, fetched again by their CRM.
  retry: async (id, given, person) => {
    const key = text(given['key']);
    const done = await retryRecords(
      id,
      given['records'],
      key === '' ? null : { key, by: person.email },
    );
    return done.ok ? answer(200, { ok: true }) : refusal(done.why, done.said);
  },
};

const brokerageChange = change(async (request, given, person) => {
  const [part, what] = partsAfter('/v1/panel/brokerages/', request.path);
  const id = numberOf(part);
  const handler =
    what && Object.hasOwn(BROKERAGE_CHANGES, what) ? BROKERAGE_CHANGES[what] : undefined;
  if (id === null || !handler) return missing();
  return handler(id, given, person);
});

const connectionChange = change(async (request, given, person) => {
  const [id, what] = partsAfter('/v1/panel/connections/', request.path);
  if (!id) return missing();
  // The CRM screen's Save: the login, tested only when it changed, and forms test mode.
  if (what === 'edit') {
    const done = await editConnection(
      id,
      { login: given['login'], formsTestMode: given['formsTestMode'] },
      settings().credentialsKey,
      person.email,
    );
    return done.ok ? answer(200, done.value) : refusal(done.why, done.said);
  }
  if (what === 'act') {
    const done = await runAction(id, text(given['action']));
    return done.ok ? answer(200, done.value) : refusal(done.why, done.said);
  }
  if (what === 'remove') {
    const removed = await removeConnection(id);
    return removed ? answer(200, { removedAt: removed.removedAt }) : missing();
  }
  return missing();
});

const websiteChange = change(async (request, given) => {
  const [part, what] = partsAfter('/v1/panel/websites/', request.path);
  const id = numberOf(part);
  if (id === null) return missing();
  if (what === 'remove') return (await removeWebsite(id)) ? answer(200, { ok: true }) : missing();
  if (what === 'edit') {
    const typed = websiteOf(given);
    if (!typed) return refusal('fields');
    const saved = await editWebsite(id, typed);
    if (saved === null) return missing();
    if ('refused' in saved) return botCheckRefusal(saved.refused);
    return answer(200, saved.warning ? { ok: true, warning: saved.warning } : { ok: true });
  }
  if (what === 'bell-secret') {
    const secret = await newBellSecret(id);
    return secret ? answer(200, { bellSecret: secret }) : missing();
  }
  return missing();
});

/** The numbers among a query's values. */
const numbers = (values: string[]): number[] =>
  values.filter((value) => /^\d+$/.test(value)).map(Number);

/** `GET /v1/panel/flow?tenant=<id>&office=<connection>:<office>`: the Flow, filtered. */
const flowRoute = signedIn(async (request) =>
  answer(
    200,
    await flow({
      tenants: numbers(request.query.getAll('tenant')),
      offices: request.query.getAll('office').filter((office) => office.includes(':')),
    }),
  ),
);

/** `POST /v1/panel/problems/act`: a person did what an Inbox card asks ("Done, I've pasted it"). */
const actRoute = change(async (_request, given, person) =>
  (await actOn(text(given['key']), person.email)) ? answer(200, { ok: true }) : missing(),
);

// ---- Records and manual sync ---------------------------------------------------------------------

const isType = (value: string): value is Datatype =>
  (RECORD_TYPES as readonly string[]).includes(value);

/** The records filter as a page's address carries it. */
const filterOf = (query: URLSearchParams): RecordFilter => ({
  tenants: numbers(query.getAll('tenant')),
  offices: query.getAll('office').filter((office) => office.includes(':')),
  types: query.getAll('type').filter(isType),
  id: (query.get('id') ?? '').trim(),
  removed: query.get('removed') === '1',
});

/**
 * `GET /v1/panel/records?tenant=&office=&type=&id=&removed=1&page=`: one page of the records the
 * filter keeps, by name, with the filters' choices and their counts.
 */
const recordsRoute = signedIn(async (request) =>
  answer(
    200,
    await recordList(filterOf(request.query), numberOf(request.query.get('page') ?? '') ?? 1),
  ),
);

const SYNC_WHAT: readonly SyncWhat[] = ['fetch', 'recompute', 'send'];

/** A sync's ticket as the panel sends it back: `what`, `at`, `event`s, `job`, `tenant`s, `sent`. */
function ticketOf(query: URLSearchParams): SyncTicket | null {
  const what = query.get('what') ?? '';
  const at = query.get('at') ?? '';
  if (!(SYNC_WHAT as readonly string[]).includes(what) || Number.isNaN(Date.parse(at))) return null;
  return {
    what: what as SyncWhat,
    at: new Date(at).toISOString(),
    events: numbers(query.getAll('event')),
    job: numberOf(query.get('job') ?? ''),
    tenants: numbers(query.getAll('tenant')),
    sent: numberOf(query.get('sent') ?? ''),
  };
}

/**
 * `GET /v1/panel/records/sync?<ticket>`: how a sync is coming along. `GET
 * /v1/panel/records/<connection>/<datatype>/<id>`: one record's page.
 */
const recordRoute = signedIn(async (request) => {
  const parts = partsAfter('/v1/panel/records/', request.path);
  if (parts.length === 1 && parts[0] === 'sync') {
    const ticket = ticketOf(request.query);
    return ticket ? answer(200, await syncState(ticket)) : refusal('fields');
  }
  const [connection, datatype, id] = parts;
  if (parts.length !== 3 || !connection || !datatype || !id) return missing();
  const page = await recordPage(connection, datatype, id, settings().eventRetentionDays);
  return page ? answer(200, page) : missing();
});

/**
 * `POST /v1/panel/records/sync`: fetch again, recompute or send the picked records (at most 500)
 * or everything the filter keeps. It only reads from a CRM, through the CRM's own code.
 */
const syncRoute = change(async (request, given, person) => {
  if (partsAfter('/v1/panel/records/', request.path).join('/') !== 'sync') return missing();
  const what = text(given['what']);
  const choice = choiceOf(given);
  if (!(SYNC_WHAT as readonly string[]).includes(what) || !choice) return refusal('fields');
  const started = await startSync(choice, what as SyncWhat, person.email);
  return started ? answer(202, started) : missing();
});

export function panelRoutes(): RouteTable {
  return [
    { method: 'GET', path: '/v1/panel/sign-in', handler: () => signInFacts() },
    { method: 'POST', path: '/v1/panel/sign-in', handler: requestLink },
    { method: 'POST', path: '/v1/panel/sign-in/link', handler: useLink },
    { method: 'GET', path: '/v1/panel/me', handler: me },
    { method: 'POST', path: '/v1/panel/sign-out', handler: signOut },
    { method: 'GET', path: '/v1/panel/inbox', handler: inboxRoute },
    { method: 'POST', path: '/v1/panel/problems/act', handler: actRoute },
    { method: 'GET', path: '/v1/panel/crms', handler: crmsRoute },
    { method: 'GET', path: '/v1/panel/flow', handler: flowRoute },
    { method: 'GET', path: '/v1/panel/records', handler: recordsRoute },
    { method: 'GET', path: '/v1/panel/records/*', handler: recordRoute },
    { method: 'POST', path: '/v1/panel/records/*', handler: syncRoute },
    { method: 'GET', path: '/v1/panel/brokerages', handler: listRoute },
    { method: 'POST', path: '/v1/panel/brokerages', handler: createRoute },
    { method: 'GET', path: '/v1/panel/brokerages/*', handler: pageRoute },
    { method: 'POST', path: '/v1/panel/brokerages/*', handler: brokerageChange },
    { method: 'POST', path: '/v1/panel/connections/*', handler: connectionChange },
    { method: 'POST', path: '/v1/panel/websites/*', handler: websiteChange },
    { method: 'GET', path: '/admin', handler: panelApp },
    { method: 'GET', path: '/admin/*', handler: panelApp },
  ];
}
