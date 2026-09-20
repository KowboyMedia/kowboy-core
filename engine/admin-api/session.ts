// Who may use the panel: whoever reads mail at an allowed domain (Patric, 2026-09-18: no shared
// password). The login form takes an address; when its domain is on the list a link goes there by
// mail, and the answer is the same whatever the address, so the list stays private. The link
// carries a signed token good for 15 minutes; opening it sets a signed session cookie for 12
// hours or, with "remember this device", for 30 days. While the mailbox is in maintenance
// (Patric, 2026-09-19) an allowed address logs in straight from the form. Both tokens are signed
// with the admin secret, so any web process recognises them and rotating the secret logs everyone
// out. Every attempt is logged.
import { createHmac } from 'node:crypto';
import { logEvent } from '../events.js';
import { report } from '../errors.js';
import { sendMail } from '../mail.js';
import { sameSecret } from '../storage/crypto.js';
import type { Request } from '../http/server.js';

export const COOKIE = 'core_admin_session';
export const LINK_MINUTES = 15;
const SESSION_HOURS = 12;
export const REMEMBER_DAYS = 30;
/** One link per address per minute, and ten a day in all, whatever the form is fed. */
const AGAIN_MS = 60_000;
export const DAY_CAP = 10;

export type Session = { email: string; expires: number; remember: boolean };

const sign = (secret: string, purpose: string, payload: string): string =>
  createHmac('sha256', secret).update(`${purpose}\n${payload}`).digest('hex');

/** `payload.signature`, the payload base64url so it survives a URL and a cookie. */
function seal(secret: string, purpose: string, session: Session): string {
  const payload = JSON.stringify(session);
  return `${Buffer.from(payload).toString('base64url')}.${sign(secret, purpose, payload)}`;
}

/** The session inside a token signed for this purpose and not past its time, else null. */
function unseal(secret: string, purpose: string, token: string): Session | null {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const payload = Buffer.from(encoded, 'base64url').toString();
  if (!sameSecret(signature, sign(secret, purpose, payload))) return null;
  try {
    const session = JSON.parse(payload) as Session;
    return session.expires > Date.now() ? session : null;
  } catch {
    return null;
  }
}

function cookieOf(request: Request): string | null {
  for (const part of (request.headers['cookie'] ?? '').split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE) return rest.join('=');
  }
  return null;
}

/** The session this request carries, or null. */
export function sessionOf(request: Request, secret: string): Session | null {
  const cookie = cookieOf(request);
  return cookie ? unseal(secret, 'session', cookie) : null;
}

const isHttps = (request: Request): boolean =>
  (request.headers['x-forwarded-proto'] ?? '').split(',')[0] === 'https';

/** The Set-Cookie value that logs this address in. */
export function sessionCookie(
  request: Request,
  secret: string,
  grant: { email: string; remember: boolean },
): string {
  const lifetimeS = grant.remember ? REMEMBER_DAYS * 86_400 : SESSION_HOURS * 3_600;
  const token = seal(secret, 'session', { ...grant, expires: Date.now() + lifetimeS * 1000 });
  const maxAge = grant.remember ? `; Max-Age=${lifetimeS}` : '';
  const secure = isHttps(request) ? '; Secure' : '';
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax${maxAge}${secure}`;
}

export const CLEARED_COOKIE = `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

const allowedAddress = (email: string, domains: string[]): boolean => {
  const at = email.lastIndexOf('@');
  return at > 0 && domains.includes(email.slice(at + 1));
};

const asked = new Map<string, number>();
let today = '';
let sentToday = 0;

/** Test helper: forget who asked for a link recently. */
export function forgetLoginRequests(): void {
  asked.clear();
  sentToday = 0;
}

/** Why no link goes out, for the event log only; the answer never says. */
function refusal(email: string, domains: string[]): string | null {
  if (!allowedAddress(email, domains)) return 'not an allowed address';
  const last = asked.get(email);
  if (last !== undefined && Date.now() - last < AGAIN_MS) return 'asked again within a minute';
  const day = new Date().toISOString().slice(0, 10);
  if (day !== today) {
    today = day;
    sentToday = 0;
  }
  if (sentToday >= DAY_CAP) return `already ${DAY_CAP} links today`;
  for (const [address, when] of asked) if (Date.now() - when >= AGAIN_MS) asked.delete(address);
  return null;
}

/** Where the link points: this request's host, which the platform's router vouches for. */
const origin = (request: Request): string =>
  `${isHttps(request) ? 'https' : 'http'}://${request.headers['host'] ?? 'localhost'}`;

export type LoginOptions = { secret: string; domains: string[]; directLogin: boolean };

export type LoginOutcome =
  /** A link went out, or would have; the answer is the same either way. */
  | { kind: 'sent' }
  /** Maintenance mode: the address is in. */
  | { kind: 'session'; email: string; remember: boolean }
  | { kind: 'refused' };

/** The login form's POST. */
export async function login(
  request: Request,
  input: { email: string; remember: boolean },
  options: LoginOptions,
): Promise<LoginOutcome> {
  const email = input.email.trim().toLowerCase();
  if (options.directLogin) {
    const ok = allowedAddress(email, options.domains);
    await logEvent({
      type: 'admin.login',
      fields: { email, via: 'maintenance', ok, remember: input.remember },
    });
    return ok ? { kind: 'session', email, remember: input.remember } : { kind: 'refused' };
  }
  const reason = refusal(email, options.domains);
  if (reason) {
    await logEvent({ type: 'admin.login_link', fields: { email, sent: false, reason } });
    return { kind: 'sent' };
  }
  asked.set(email, Date.now());
  sentToday += 1;
  const expires = Date.now() + LINK_MINUTES * 60_000;
  const token = seal(options.secret, 'link', { email, expires, remember: input.remember });
  const link = `${origin(request)}/v1/admin/login/${token}`;
  try {
    await sendMail({
      to: email,
      subject: 'Log in to Core admin',
      text: `Open this link within ${LINK_MINUTES} minutes to log in to Core admin:\n\n${link}\n\nIf you did not ask for it, ignore this mail.\n`,
    });
    await logEvent({
      type: 'admin.login_link',
      fields: { email, sent: true, remember: input.remember },
    });
  } catch (error) {
    report(error, { where: 'admin login link', email });
    await logEvent({
      type: 'admin.login_link',
      fields: { email, sent: false, reason: String(error) },
    });
  }
  return { kind: 'sent' };
}

/** The link from the mail: the session it grants, or null when it is stale. */
export async function openLink(
  secret: string,
  token: string,
): Promise<{ email: string; remember: boolean } | null> {
  const grant = unseal(secret, 'link', token);
  if (!grant) return null;
  await logEvent({ type: 'admin.login', fields: { email: grant.email, remember: grant.remember } });
  return { email: grant.email, remember: grant.remember };
}
