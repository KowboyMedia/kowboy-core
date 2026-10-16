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

export function panelRoutes(): RouteTable {
  return [
    { method: 'GET', path: '/v1/panel/sign-in', handler: () => signInFacts() },
    { method: 'POST', path: '/v1/panel/sign-in', handler: requestLink },
    { method: 'POST', path: '/v1/panel/sign-in/link', handler: useLink },
    { method: 'GET', path: '/v1/panel/me', handler: me },
    { method: 'POST', path: '/v1/panel/sign-out', handler: signOut },
    { method: 'GET', path: '/v1/panel/inbox', handler: inboxRoute },
    { method: 'GET', path: '/admin', handler: panelApp },
    { method: 'GET', path: '/admin/*', handler: panelApp },
  ];
}
