// The admin panel (design B): its JSON API under /v1/panel/ and its browser app under /admin. The
// API answers the app only: a request that changes something must be JSON, which a page on another
// site cannot send without asking first, and the session cookie never leaves Core's own pages.
import type { Config } from '../config.js';
import { report } from '../errors.js';
import { sendMail } from '../mail.js';
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
async function useLink(request: Request): Promise<Response> {
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
}

type Signed = { email: string; expiresAt: Date };

/** A handler for a signed-in person only; anyone else is told 401. */
const signedIn =
  (handler: (request: Request, person: Signed) => Promise<Response> | Response) =>
  async (request: Request): Promise<Response> => {
    const person = await sessionFor(tokenFrom(request.headers['cookie']), settings());
    if (!person) return answer(401, { error: 'signed out' });
    return handler(request, person);
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
async function signOut(request: Request): Promise<Response> {
  if (!isJson(request)) return answer(415, { error: 'send JSON' });
  await endSession(tokenFrom(request.headers['cookie']), settings());
  return answer(200, { ok: true }, { 'set-cookie': clearedCookie(settings()) });
}

/** `GET /v1/panel/inbox`: what needs a person now. */
const inboxRoute = signedIn(async () => answer(200, await inbox()));

// ---- Brokerages, their websites and their CRM connections ----------------------------------------

const REFUSED: Record<Refusal, number> = { missing: 404, fields: 400, login: 422, crm: 502 };
const refusal = (why: Refusal): Response => answer(REFUSED[why], { error: why });
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

/** A change: JSON from a signed-in person, handed the parsed body. */
const change = (
  handler: (request: Request, given: Record<string, unknown>) => Promise<Response> | Response,
) =>
  signedIn((request) => {
    const given = body(request);
    if (!given) return answer(415, { error: 'send JSON' });
    return handler(request, given);
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

const brokerageChange = change(async (request, given) => {
  const [part, what] = partsAfter('/v1/panel/brokerages/', request.path);
  const id = numberOf(part);
  if (id === null) return missing();
  if (what === 'switch') {
    return (await switchBrokerage(id, given['on'] === true))
      ? answer(200, { ok: true })
      : missing();
  }
  if (what === 'token') {
    const token = await replaceToken(id);
    return token ? answer(200, { token }) : missing();
  }
  if (what === 'websites') {
    const label = text(given['label']);
    const bellUrl = bellAddress(given['bellUrl']);
    if (label === '' || !bellUrl) return refusal('fields');
    const website = await addWebsite(id, { label, bellUrl });
    return website === null ? missing() : answer(201, { id: website });
  }
  if (what === 'connections') {
    const done = await addConnection(
      id,
      { provider: text(given['provider']), name: text(given['name']), login: given['login'] },
      settings().credentialsKey,
    );
    return done.ok ? answer(201, { id: done.value }) : refusal(done.why);
  }
  return missing();
});

const connectionRead = signedIn(async (request) => {
  const [id, what] = partsAfter('/v1/panel/connections/', request.path);
  if (!id || what !== 'offices') return missing();
  const offices = await officesOf(id);
  return offices ? answer(200, { offices }) : missing();
});

const connectionChange = change(async (request, given) => {
  const [id, what] = partsAfter('/v1/panel/connections/', request.path);
  if (!id) return missing();
  if (what === 'login') {
    const done = await changeLogin(id, given['login'], settings().credentialsKey);
    return done.ok ? answer(200, { ok: true }) : refusal(done.why);
  }
  if (what === 'forms-test-mode') {
    return (await setFormsTestMode(id, given['on'] === true))
      ? answer(200, { ok: true })
      : missing();
  }
  if (what === 'act') {
    const done = await runAction(id, text(given['action']));
    return done.ok ? answer(200, { ok: true }) : refusal(done.why);
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

export function panelRoutes(): RouteTable {
  return [
    { method: 'GET', path: '/v1/panel/sign-in', handler: () => signInFacts() },
    { method: 'POST', path: '/v1/panel/sign-in', handler: requestLink },
    { method: 'POST', path: '/v1/panel/sign-in/link', handler: useLink },
    { method: 'GET', path: '/v1/panel/me', handler: me },
    { method: 'POST', path: '/v1/panel/sign-out', handler: signOut },
    { method: 'GET', path: '/v1/panel/inbox', handler: inboxRoute },
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
