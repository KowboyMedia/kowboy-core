// Who may open the admin area, and how they get in: a link mailed to an address on the list
// (§3 H, Must). There is no password to share and nothing to phish out of a person; the link is
// good once, for fifteen minutes, and makes a session cookie that lasts a fortnight.
import { db } from '../storage/db.js';
import { newSecret, tokenHmac } from '../storage/crypto.js';
import { mailConfigured, sendMail } from '../mail.js';
import { logEvent } from '../events.js';
import type { Config } from '../config.js';

export type Session = { email: string };

export const COOKIE = 'core_admin';

let config: Config | null = null;

/** The engine hands the admin area its settings at start. */
export function configureAdmin(next: Config): void {
  config = next;
}

const settings = (): Config => {
  if (!config) throw new Error('the admin area has not been configured');
  return config;
};

/** The engine's settings, for the pages that show or use them. Never for a secret's value. */
export const currentConfig = (): Config => settings();

/** Where the app is reached: the public address when one is set, else a relative link. */
const adminUrl = (path: string): string => `${settings().publicUrl ?? ''}${path}`;

const hash = (token: string): string => tokenHmac(token, settings().credentialsKey);

/**
 * Whether an address may open the area: it is on the list by name, or its domain is on the list
 * of whole domains. Nothing the sign-in page shows depends on the answer (Patric, 2026-09-21).
 */
export function mayOpen(email: string): boolean {
  const address = email.trim().toLowerCase();
  if (settings().adminEmails.includes(address)) return true;
  const domain = address.slice(address.lastIndexOf('@') + 1);
  return domain !== '' && address.includes('@') && settings().adminEmailDomains.includes(domain);
}

export type SignInOutcome = { sent: boolean; detail: string; link?: string };

/**
 * Make a sign-in link for an allowed address and mail it. An address that may not open the area
 * gets the same answer as one that may, so the panel never tells a stranger who works here, nor
 * which addresses or domains are let in; the attempt is in the event log either way.
 *
 * `remember` is the person's choice on the sign-in page, carried on the link because the session
 * is made when the link is opened, not when it is asked for.
 */
export async function requestSignIn(rawEmail: string, remember = false): Promise<SignInOutcome> {
  const email = rawEmail.trim().toLowerCase();
  const allowed = mayOpen(email);
  const same = {
    sent: true,
    detail: 'If that address may open the admin area, the link is on its way.',
  };
  await logEvent({ type: 'admin.sign_in_requested', fields: { email, allowed, remember } });
  if (!allowed) return same;

  const token = newSecret();
  await db().query(
    `insert into admin_logins (token_hmac, email, expires_at, remember)
     values ($1, $2, now() + ($3 || ' minutes')::interval, $4)`,
    [hash(token), email, String(settings().adminLinkMinutes), remember],
  );
  const link = adminUrl(`/v1/admin/sign-in/${token}`);

  // Locally there is no mail sender, and the link in the answer is the only way in. Anywhere
  // else it is mailed and never returned, whoever asked.
  if (settings().environment === 'local' && !mailConfigured()) return { ...same, link };
  if (!mailConfigured()) {
    return {
      sent: false,
      detail: 'Core cannot send mail: POSTMARK_SERVER_TOKEN and MAIL_FROM are not set.',
    };
  }
  await sendMail({
    to: email,
    subject: `Sign in to Kowboy Core (${settings().environment})`,
    text: `Open this link within ${settings().adminLinkMinutes} minutes to sign in:\n\n${link}\n\nIf you did not ask for it, nothing happens when you ignore it.`,
  });
  return same;
}

export type SignedIn = { session: Session; cookie: string; seconds: number };

/**
 * Spend a link and make the session behind it. Null when the link is unknown, used or too old.
 * A remembered device keeps its session for thirty days instead of a fortnight; every device gets
 * a row of its own, so a person may be remembered on as many as they like and signing out of one
 * leaves the others alone.
 */
export async function signIn(token: string, device: string | null): Promise<SignedIn | null> {
  const { rows } = await db().query<{ email: string; remember: boolean }>(
    `update admin_logins set used_at = now()
     where token_hmac = $1 and used_at is null and expires_at > now()
     returning email, remember`,
    [hash(token)],
  );
  const login = rows[0];
  if (!login || !mayOpen(login.email)) return null;

  const days = login.remember ? settings().adminRememberDays : settings().adminSessionDays;
  const cookie = newSecret();
  await db().query(
    `insert into admin_sessions (token_hmac, email, expires_at, remembered, device)
     values ($1, $2, now() + ($3 || ' days')::interval, $4, $5)`,
    [hash(cookie), login.email, String(days), login.remember, device],
  );
  await logEvent({
    type: 'admin.signed_in',
    fields: { email: login.email, remembered: login.remember, days },
  });
  return { session: { email: login.email }, cookie, seconds: days * 24 * 60 * 60 };
}

export type DeviceRow = {
  device: string | null;
  remembered: boolean;
  created_at: Date;
  last_seen_at: Date;
  expires_at: Date;
  /** True for the device reading this, so the Settings page can say "this one". */
  current: boolean;
};

/** The devices a person is signed in on, newest first, for the Settings page. */
export async function devicesOf(email: string, cookie: string | null): Promise<DeviceRow[]> {
  const { rows } = await db().query<DeviceRow>(
    `select device, remembered, created_at, last_seen_at, expires_at,
            token_hmac = $2 as current
     from admin_sessions where email = $1 and expires_at > now()
     order by last_seen_at desc`,
    [email, cookie ? hash(cookie) : ''],
  );
  return rows;
}

/** Forget every device but the one asking. Used from Settings when a laptop goes missing. */
export async function forgetOtherDevices(email: string, cookie: string | null): Promise<number> {
  const { rowCount } = await db().query(
    'delete from admin_sessions where email = $1 and token_hmac <> $2',
    [email, cookie ? hash(cookie) : ''],
  );
  await logEvent({ type: 'admin.devices_forgotten', fields: { email, sessions: rowCount ?? 0 } });
  return rowCount ?? 0;
}

/** The session a cookie stands for, or null. Every read moves the session's last-seen time. */
export async function sessionFor(cookie: string | null): Promise<Session | null> {
  if (!cookie) return null;
  const { rows } = await db().query<{ email: string }>(
    `update admin_sessions set last_seen_at = now()
     where token_hmac = $1 and expires_at > now() returning email`,
    [hash(cookie)],
  );
  const email = rows[0]?.email;
  return email && mayOpen(email) ? { email } : null;
}

export async function signOut(cookie: string | null, email: string): Promise<void> {
  if (cookie) await db().query('delete from admin_sessions where token_hmac = $1', [hash(cookie)]);
  await logEvent({ type: 'admin.signed_out', fields: { email } });
}

/** The cookie as the browser should keep it: not readable by script, not sent across sites. */
export function cookieHeader(value: string, seconds: number): string {
  const secure = settings().environment === 'local' ? '' : ' Secure;';
  return `${COOKIE}=${value}; Path=/; HttpOnly;${secure} SameSite=Strict; Max-Age=${seconds}`;
}

/** The cookie value the browser sent, if any. */
export function cookieFrom(header: string | undefined): string | null {
  for (const part of (header ?? '').split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE) return rest.join('=') || null;
  }
  return null;
}

/** Sign-in links and sessions past their time, cleared by the worker's housekeeping. */
export async function deleteExpiredSessions(): Promise<number> {
  const links = await db().query('delete from admin_logins where expires_at < now()');
  const sessions = await db().query('delete from admin_sessions where expires_at < now()');
  return (links.rowCount ?? 0) + (sessions.rowCount ?? 0);
}
