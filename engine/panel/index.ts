// The admin panel (design B): its JSON API under /v1/panel/ and its browser app under /admin. The
// API answers the app only: a request that changes something must be JSON, which a page on another
// site cannot send without asking first, and the session cookie never leaves Core's own pages.
import type { Config } from '../config.js';
import { report } from '../errors.js';
import { sendMail } from '../mail.js';
import { MAINTENANCE, writeSetting } from '../storage/settings.js';
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
  officesOf,
  removeWebsite,
  replaceToken,
  switchBrokerage,
} from './brokerages.js';
import {
  addConnection,
  changeLogin,
  removeConnection,
  runAction,
  setFormsTestMode,
  type Refusal,
} from './connections.js';
import { actOn } from './problems.js';
import { resendForms } from './forms.js';
import { startReload } from './reload.js';
import { retryRecords } from './records.js';
import { databaseFailed, databaseWords, failureWords } from './failure.js';

type PanelConfig = AuthSettings & Pick<Config, 'environment' | 'port'>;

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

/** What a person changes on a brokerage, by the last part of its address. */
const BROKERAGE_CHANGES: Record<string, BrokerageChange> = {
  switch: async (id, given) =>
    (await switchBrokerage(id, given['on'] === true)) ? answer(200, { ok: true }) : missing(),
  token: async (id) => {
    const token = await replaceToken(id);
    return token ? answer(200, { token }) : missing();
  },
  websites: async (id, given) => {
    const label = text(given['label']);
    const bellUrl = bellAddress(given['bellUrl']);
    if (label === '' || !bellUrl) return refusal('fields');
    const website = await addWebsite(id, { label, bellUrl });
    return website === null ? missing() : answer(201, { id: website });
  },
  connections: async (id, given) => {
    const done = await addConnection(
      id,
      { provider: text(given['provider']), login: given['login'] },
      settings().credentialsKey,
    );
    return done.ok ? answer(201, done.value) : refusal(done.why, done.said);
  },
  // The forms of the brokerage the Inbox listed, sent to the CRM again one at a time.
  resend: async (id, given) => {
    const ids = Array.isArray(given['ids'])
      ? given['ids'].filter((one): one is string => typeof one === 'string')
      : [];
    const results = await resendForms(id, ids);
    return results ? answer(200, { results }) : missing();
  },
  reload: async (id, _given, person) =>
    (await startReload(id, person.email)) ? answer(202, { ok: true }) : missing(),
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

const connectionRead = signedIn(async (request) => {
  const [id, what] = partsAfter('/v1/panel/connections/', request.path);
  if (!id || what !== 'offices') return missing();
  const offices = await officesOf(id);
  return offices ? answer(200, { offices }) : missing();
});

const connectionChange = change(async (request, given, person) => {
  const [id, what] = partsAfter('/v1/panel/connections/', request.path);
  if (!id) return missing();
  if (what === 'login') {
    const done = await changeLogin(id, given['login'], settings().credentialsKey, person.email);
    return done.ok ? answer(200, { ok: true }) : refusal(done.why, done.said);
  }
  if (what === 'forms-test-mode') {
    return (await setFormsTestMode(id, given['on'] === true))
      ? answer(200, { ok: true })
      : missing();
  }
  if (what === 'act') {
    const done = await runAction(id, text(given['action']));
    return done.ok ? answer(200, { ok: true }) : refusal(done.why, done.said);
  }
  if (what === 'remove') {
    const removed = await removeConnection(id);
    return removed ? answer(200, { removedAt: removed.removedAt }) : missing();
  }
  return missing();
});

const websiteChange = change(async (request) => {
  const [part, what] = partsAfter('/v1/panel/websites/', request.path);
  const id = numberOf(part);
  if (id === null || what !== 'remove') return missing();
  return (await removeWebsite(id)) ? answer(200, { ok: true }) : missing();
});

/** `POST /v1/panel/problems/act`: a person did what an Inbox card asks ("Done, I've pasted it"). */
const actRoute = change(async (_request, given, person) =>
  (await actOn(text(given['key']), person.email)) ? answer(200, { ok: true }) : missing(),
);

/**
 * `POST /v1/panel/maintenance`: turn maintenance on or off. Off, the worker sends the held change
 * notices within a second and takes the queued jobs again.
 */
const maintenanceRoute = change(async (_request, given, person) => {
  if (typeof given['on'] !== 'boolean') return refusal('fields');
  await writeSetting(MAINTENANCE, given['on'] ? 'on' : 'off', person.email);
  return answer(200, { ok: true });
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
    { method: 'POST', path: '/v1/panel/maintenance', handler: maintenanceRoute },
    { method: 'GET', path: '/v1/panel/crms', handler: crmsRoute },
    { method: 'GET', path: '/v1/panel/brokerages', handler: listRoute },
    { method: 'POST', path: '/v1/panel/brokerages', handler: createRoute },
    { method: 'GET', path: '/v1/panel/brokerages/*', handler: pageRoute },
    { method: 'POST', path: '/v1/panel/brokerages/*', handler: brokerageChange },
    { method: 'GET', path: '/v1/panel/connections/*', handler: connectionRead },
    { method: 'POST', path: '/v1/panel/connections/*', handler: connectionChange },
    { method: 'POST', path: '/v1/panel/websites/*', handler: websiteChange },
    { method: 'GET', path: '/admin', handler: panelApp },
    { method: 'GET', path: '/admin/*', handler: panelApp },
  ];
}
