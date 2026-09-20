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

export const mayOpen = (email: string): boolean =>
  settings().adminEmails.includes(email.trim().toLowerCase());

export type SignInOutcome = { sent: boolean; detail: string; link?: string };

/**
 * Make a sign-in link for an allowed address and mail it. An address that may not open the area
 * gets the same answer as one that may, so the panel never tells a stranger who works here; the
 * attempt is in the event log either way.
 */
export async function requestSignIn(rawEmail: string): Promise<SignInOutcome> {
  const email = rawEmail.trim().toLowerCase();
  const allowed = mayOpen(email);
  const same = {
    sent: true,
    detail: 'If that address may open the admin area, the link is on its way.',
  };
  await logEvent({ type: 'admin.sign_in_requested', fields: { email, allowed } });
  if (!allowed) return same;

  const token = newSecret();
  await db().query(
    `insert into admin_logins (token_hmac, email, expires_at)
     values ($1, $2, now() + ($3 || ' minutes')::interval)`,
    [hash(token), email, String(settings().adminLinkMinutes)],
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

/** Spend a link and make the session behind it. Null when the link is unknown, used or too old. */
export async function signIn(token: string): Promise<{ session: Session; cookie: string } | null> {
  const { rows } = await db().query<{ email: string }>(
    `update admin_logins set used_at = now()
     where token_hmac = $1 and used_at is null and expires_at > now()
     returning email`,
    [hash(token)],
  );
  const email = rows[0]?.email;
  if (!email) return null;
  if (!mayOpen(email)) return null;

  const cookie = newSecret();
  await db().query(
    `insert into admin_sessions (token_hmac, email, expires_at)
     values ($1, $2, now() + ($3 || ' days')::interval)`,
    [hash(cookie), email, String(settings().adminSessionDays)],
  );
  await logEvent({ type: 'admin.signed_in', fields: { email } });
  return { session: { email }, cookie };
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

export const sessionSeconds = (): number => settings().adminSessionDays * 24 * 60 * 60;

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
