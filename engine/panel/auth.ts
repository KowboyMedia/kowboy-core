// Signing in to the admin panel (design B, images 01 to 04, 45 and 46): a link by email, good once
// and for a short while, that signs in the device it is opened on. Written fresh for the panel; it
// shares the tables of migrations 008 and 009 and keeps only hashes of the link's and the
// session's tokens there, so a leaked row opens nothing.
import { db, transaction } from '../storage/db.js';
import { newSecret, tokenHmac } from '../storage/crypto.js';
import type { Config } from '../config.js';

/** The panel's own cookie. It reaches the panel's API only, never the app's files. */
export const COOKIE = 'core_panel_session';
const COOKIE_PATH = '/v1/panel';

/**
 * At most this many links per address within one link's lifetime. Past it no mail goes, and the
 * page answers as it always does, so nobody can fill a colleague's inbox with links.
 */
export const LINKS_PER_WINDOW = 5;

export type AuthSettings = Pick<
  Config,
  | 'adminEmails'
  | 'adminEmailDomains'
  | 'adminLinkMinutes'
  | 'adminSessionDays'
  | 'adminRememberDays'
  | 'credentialsKey'
  | 'publicUrl'
>;

const hash = (token: string, settings: AuthSettings): string =>
  tokenHmac(token, settings.credentialsKey);

/** The address as Core compares it: trimmed and in lower case. */
export const normalised = (email: string): string => email.trim().toLowerCase();

/** A plausible address: something, an @, a domain with a dot. The rest is the mail service's. */
export const looksLikeAddress = (email: string): boolean =>
  email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/** Whether an address may sign in: named in ADMIN_EMAILS, or at a domain in ADMIN_EMAIL_DOMAINS. */
export function maySignIn(email: string, settings: AuthSettings): boolean {
  const address = normalised(email);
  const domain = address.split('@')[1] ?? '';
  return settings.adminEmails.includes(address) || settings.adminEmailDomains.includes(domain);
}

export type Link = { token: string; email: string; expiresAt: Date };

/**
 * A new sign-in link for an address that may sign in, or null when it may not or has asked for
 * too many lately. A new link ends the address's older unused ones: the newest email is the one
 * that works. The remember choice travels with the link, since the session is made when it opens.
 */
export async function newLink(
  email: string,
  remember: boolean,
  settings: AuthSettings,
): Promise<Link | null> {
  const address = normalised(email);
  if (!maySignIn(address, settings)) return null;
  const window = `${String(settings.adminLinkMinutes)} minutes`;
  const token = newSecret();
  // One address at a time, so two requests at once cannot both pass the count.
  const expiresAt = await transaction(async (client) => {
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [`panel-link:${address}`]);
    const { rows } = await client.query<{ count: string }>(
      `select count(*) as count from admin_logins
       where email = $1 and created_at > now() - $2::interval`,
      [address, window],
    );
    if (Number(rows[0]?.count ?? 0) >= LINKS_PER_WINDOW) return null;
    await client.query(
      `update admin_logins set expires_at = least(expires_at, now())
       where email = $1 and used_at is null and expires_at > now()`,
      [address],
    );
    const made = await client.query<{ expires_at: Date }>(
      `insert into admin_logins (token_hmac, email, expires_at, remember)
       values ($1, $2, now() + $3::interval, $4) returning expires_at`,
      [hash(token, settings), address, window, remember],
    );
    return made.rows[0]?.expires_at ?? null;
  });
  return expiresAt ? { token, email: address, expiresAt } : null;
}

export type Session = { token: string; email: string; expiresAt: Date; remembered: boolean };

/**
 * Open a link: spent in the same statement that reads it, so it works once, and only within its
 * minutes and for an address that may still sign in. Null when it no longer works.
 */
export async function openLink(
  token: string,
  device: string | null,
  settings: AuthSettings,
): Promise<Session | null> {
  if (!token) return null;
  const { rows } = await db().query<{ email: string; remember: boolean }>(
    `update admin_logins set used_at = now()
     where token_hmac = $1 and used_at is null and expires_at > now()
     returning email, remember`,
    [hash(token, settings)],
  );
  const login = rows[0];
  if (!login || !maySignIn(login.email, settings)) return null;
  const days = login.remember ? settings.adminRememberDays : settings.adminSessionDays;
  const session = newSecret();
  const made = await db().query<{ expires_at: Date }>(
    `insert into admin_sessions (token_hmac, email, expires_at, remembered, device)
     values ($1, $2, now() + $3::interval, $4, $5) returning expires_at`,
    [hash(session, settings), login.email, `${String(days)} days`, login.remember, device],
  );
  return {
    token: session,
    email: login.email,
    expiresAt: made.rows[0]?.expires_at ?? new Date(),
    remembered: login.remember,
  };
}

/** The person a session token belongs to, while it lasts and their address may still sign in. */
export async function sessionFor(
  token: string | null,
  settings: AuthSettings,
): Promise<{ email: string; expiresAt: Date } | null> {
  if (!token) return null;
  const { rows } = await db().query<{ email: string; expires_at: Date }>(
    `update admin_sessions set last_seen_at = now()
     where token_hmac = $1 and expires_at > now()
     returning email, expires_at`,
    [hash(token, settings)],
  );
  const session = rows[0];
  if (!session || !maySignIn(session.email, settings)) return null;
  return { email: session.email, expiresAt: session.expires_at };
}

/** Sign one device out: its session ends; the person's other devices stay signed in. */
export async function endSession(token: string | null, settings: AuthSettings): Promise<void> {
  if (!token) return;
  await db().query('delete from admin_sessions where token_hmac = $1', [hash(token, settings)]);
}

/** The session token a request carries in the panel's cookie. */
export function tokenFrom(cookieHeader: string | undefined): string | null {
  for (const part of (cookieHeader ?? '').split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === COOKIE) return value.join('=') || null;
  }
  return null;
}

/** Secure whenever Core is reached over https, which is everywhere but a local run. */
const secure = (settings: AuthSettings): string =>
  settings.publicUrl?.startsWith('https:') ? '; Secure' : '';

/** The cookie that keeps a device signed in until its session ends. */
export function sessionCookie(session: Session, settings: AuthSettings): string {
  const seconds = Math.max(0, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000));
  return `${COOKIE}=${session.token}; Path=${COOKIE_PATH}; Max-Age=${String(seconds)}; HttpOnly; SameSite=Strict${secure(settings)}`;
}

/** The cookie that forgets the session on this device. */
export const clearedCookie = (settings: AuthSettings): string =>
  `${COOKIE}=; Path=${COOKIE_PATH}; Max-Age=0; HttpOnly; SameSite=Strict${secure(settings)}`;
