// Who may use the admin panel: whoever reads mail at an allowed domain (Patric, 2026-09-18: no
// shared password). The login form takes an address; when its domain is on the list a link goes
// there by mail, and the page answers the same way whatever the address, so the list stays
// private. The link carries a signed token good for 15 minutes; opening it sets a signed session
// cookie for the browser session or, with "Remember this device" ticked, for 30 days. Both are
// signed with the admin secret, so any web process recognises them and rotating the secret logs
// everyone out. Every POST carries the session token again as its CSRF token.
import { createHmac } from 'node:crypto';
import { logEvent } from '../events.js';
import { report } from '../errors.js';
import { sendMail } from '../mail.js';
import { sameSecret } from '../storage/crypto.js';
import { escape, field } from './html.js';
import type { Request, Response } from '../http/server.js';

const COOKIE = 'core_admin';
const LINK_MINUTES = 15;
const SESSION_HOURS = 12;
const REMEMBER_DAYS = 30;
/** One link per address per minute, whatever the form is fed. */
const AGAIN_MS = 60_000;
const SENT = `If that address may log in, a link is on its way. It works for ${LINK_MINUTES} minutes.`;

export const HTML: Record<string, string> = { 'content-type': 'text/html; charset=utf-8' };

type Grant = { email: string; expires: number; remember: boolean };

const sign = (secret: string, purpose: string, payload: string): string =>
  createHmac('sha256', secret).update(`${purpose}\n${payload}`).digest('hex');

/** `payload.signature`, the payload base64url so it survives a URL and a cookie. */
function seal(secret: string, purpose: string, grant: Grant): string {
  const payload = JSON.stringify(grant);
  return `${Buffer.from(payload).toString('base64url')}.${sign(secret, purpose, payload)}`;
}

/** The grant inside a token signed for this purpose and not past its time, else null. */
function unseal(secret: string, purpose: string, token: string): Grant | null {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const payload = Buffer.from(encoded, 'base64url').toString();
  if (!sameSecret(signature, sign(secret, purpose, payload))) return null;
  const grant = JSON.parse(payload) as Grant;
  return grant.expires > Date.now() ? grant : null;
}

function cookieOf(request: Request): string | null {
  const header = request.headers['cookie'] ?? '';
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE) return rest.join('=');
  }
  return null;
}

/** The address logged in with this request, or null. */
export function userOf(request: Request, secret: string): string | null {
  const cookie = cookieOf(request);
  return cookie ? (unseal(secret, 'session', cookie)?.email ?? null) : null;
}

/** A form's CSRF token is the session cookie sent again; the shell puts it in every form. */
export const csrfOf = (request: Request): string => cookieOf(request) ?? '';

export const csrfOk = (request: Request, form: Record<string, string>): boolean =>
  sameSecret(form['csrf'] ?? '', csrfOf(request));

export function loginPage(notice?: string, bad = false): string {
  const flash = notice ? `<div class="flash${bad ? ' bad' : ''}">${escape(notice)}</div>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Log in · Core admin</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font:15px system-ui,sans-serif;max-width:24rem;margin:4rem auto;padding:0 1rem}label{display:block;margin:.6rem 0 .2rem}input{width:100%;padding:.4rem}.check{display:flex;gap:.5rem;align-items:center;margin-top:.8rem}.check input{width:auto}button{margin-top:.8rem;padding:.4rem .9rem}.flash{border:1px solid #15803d;background:#f0fdf4;padding:.5rem}.flash.bad{border-color:#b91c1c;background:#fef2f2}</style></head><body><h1>Core admin</h1>${flash}<form method="post" action="/admin/login">${field('email', 'Your email address', { type: 'email', required: true })}<label class="check"><input type="checkbox" name="remember" value="yes"> Remember this device</label><button>Send me a link</button></form></body></html>`;
}

const asked = new Map<string, number>();

/** Test helper: forget who asked for a link recently. */
export function forgetLoginRequests(): void {
  asked.clear();
}

/** Where the link points: this request's host, which the platform's router vouches for. */
const origin = (request: Request): string =>
  `${(request.headers['x-forwarded-proto'] ?? 'http').split(',')[0]}://${request.headers['host'] ?? 'localhost'}`;

/** Why no link goes out, for the event log only; the page never says. */
function refusal(email: string, domains: string[]): string | null {
  const at = email.lastIndexOf('@');
  if (at < 1 || !domains.includes(email.slice(at + 1))) return 'not an allowed address';
  const last = asked.get(email);
  if (last !== undefined && Date.now() - last < AGAIN_MS) return 'asked again within a minute';
  for (const [address, when] of asked) if (Date.now() - when >= AGAIN_MS) asked.delete(address);
  return null;
}

/** The login form's POST: a link by mail when the address may log in, the same page either way. */
export async function requestLink(
  request: Request,
  options: { secret: string; domains: string[]; form: Record<string, string> },
): Promise<Response> {
  const email = (options.form['email'] ?? '').trim().toLowerCase();
  const remember = options.form['remember'] === 'yes';
  const page: Response = { status: 200, headers: HTML, body: loginPage(SENT) };
  const reason = refusal(email, options.domains);
  if (reason) {
    await logEvent({ type: 'admin.login_link', fields: { email, sent: false, reason } });
    return page;
  }
  asked.set(email, Date.now());
  const expires = Date.now() + LINK_MINUTES * 60_000;
  const link = `${origin(request)}/admin/login/${seal(options.secret, 'link', { email, expires, remember })}`;
  try {
    await sendMail({
      to: email,
      subject: 'Log in to Core admin',
      text: `Open this link within ${LINK_MINUTES} minutes to log in to Core admin:\n\n${link}\n\nIf you did not ask for it, ignore this mail.\n`,
    });
    await logEvent({ type: 'admin.login_link', fields: { email, sent: true, remember } });
  } catch (error) {
    report(error, { where: 'admin login link', email });
    await logEvent({
      type: 'admin.login_link',
      fields: { email, sent: false, reason: String(error) },
    });
  }
  return page;
}

/** The link from the mail: a session cookie and the overview, or the form again when it is stale. */
export async function openLink(request: Request, secret: string, token: string): Promise<Response> {
  const grant = unseal(secret, 'link', token);
  if (!grant) {
    const body = loginPage('That link is no longer valid. Ask for a new one.', true);
    return { status: 401, headers: HTML, body };
  }
  const lifetimeS = grant.remember ? REMEMBER_DAYS * 86_400 : SESSION_HOURS * 3_600;
  const session = seal(secret, 'session', { ...grant, expires: Date.now() + lifetimeS * 1000 });
  const secure = request.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  const maxAge = grant.remember ? `; Max-Age=${lifetimeS}` : '';
  await logEvent({ type: 'admin.login', fields: { email: grant.email, remember: grant.remember } });
  return {
    status: 303,
    headers: {
      location: '/admin',
      'set-cookie': `${COOKIE}=${session}; Path=/admin; HttpOnly; SameSite=Lax${maxAge}${secure}`,
    },
  };
}

export const logout = (): Response => ({
  status: 303,
  headers: { location: '/admin/login', 'set-cookie': `${COOKIE}=; Path=/admin; Max-Age=0` },
});
