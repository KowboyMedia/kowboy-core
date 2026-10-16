// Signing in to the admin panel (design B, images 01 to 04, 45 and 46): a link by email that
// works once and for a short while, a session per device, and only hashes of either in the
// database. Mail goes to the harness's sink, never out.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { harness, until, type Harness } from '../../acceptance/harness.js';
import { db } from '../storage/db.js';
import { tokenHmac } from '../storage/crypto.js';
import { COOKIE, LINKS_PER_WINDOW } from './auth.js';

let core: Harness;

beforeAll(async () => {
  core = await harness({ subscriber: false });
});
afterAll(async () => {
  await core.stop();
});
beforeEach(async () => {
  core.mails.length = 0;
  await db().query('truncate admin_logins, admin_sessions');
});

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${core.baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

const get = (path: string, cookie?: string) =>
  fetch(`${core.baseUrl}${path}`, { headers: cookie ? { cookie } : {} });

/** Ask for a link and take its token from the mail, as the person's mail program shows it. */
async function linkFor(email: string, remember = false): Promise<string> {
  const before = core.mails.length;
  expect((await post('/v1/panel/sign-in', { email, remember })).status).toBe(202);
  await until(() => core.mails.length > before, 'the sign-in mail');
  const mail = core.mails.at(-1);
  const token = /\/admin\/link#([A-Za-z0-9_-]+)/.exec(mail?.text ?? '')?.[1];
  if (!token) throw new Error(`no link in the mail: ${mail?.text ?? ''}`);
  return token;
}

/** Open a link; the session cookie as the browser would keep it. */
async function open(token: string): Promise<{ status: number; cookie: string; setCookie: string }> {
  const response = await post('/v1/panel/sign-in/link', { token });
  const setCookie = response.headers.get('set-cookie') ?? '';
  return { status: response.status, cookie: setCookie.split(';')[0] ?? '', setCookie };
}

const days = (setCookie: string): number =>
  Number(/Max-Age=(\d+)/.exec(setCookie)?.[1] ?? 0) / 86_400;

describe('the admin panel signs a person in by a link in an email', () => {
  it('tells the sign-in page the instance and the days from Core’s settings', async () => {
    const response = await get('/v1/panel/sign-in');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      instance: 'Local',
      rememberDays: 30,
      sessionDays: 14,
      linkMinutes: 15,
    });
  });

  it('mails a link that works once, signs in the device, and keeps only hashes', async () => {
    const token = await linkFor('Tester@Kowboy.se', true);
    const mail = core.mails.at(-1);
    expect(mail?.to).toBe('tester@kowboy.se');
    expect(mail?.subject).toBe('Your sign-in link for Kowboy Core');
    expect(mail?.html).toContain(`href="https://core.example/admin/link#${token}"`);
    expect(mail?.html).toContain('>Sign in</a>');
    expect(mail?.text).toMatch(
      /The link works once, until \d\d:\d\d, and signs in the device you open it on\. Didn’t ask for it\? Ignore this email\./,
    );
    expect(mail?.text).toContain('Kowboy Core’s admin panel: core.example/admin');
    expect(mail?.text).toContain('Sign in to Kowboy Core (Local).');

    const logins = await db().query<{ token_hmac: string }>('select token_hmac from admin_logins');
    expect(logins.rows.map((row) => row.token_hmac)).toEqual([
      tokenHmac(token, core.engine.config.credentialsKey),
    ]);

    const first = await open(token);
    expect(first.status).toBe(200);
    expect(first.setCookie).toContain(`${COOKIE}=`);
    expect(first.setCookie).toContain('HttpOnly');
    expect(first.setCookie).toContain('SameSite=Strict');
    expect(first.setCookie).toContain('Path=/v1/panel');
    expect(first.setCookie).toContain('Secure');
    expect(Math.round(days(first.setCookie))).toBe(30);
    const sessions = await db().query<{ token_hmac: string; remembered: boolean }>(
      'select token_hmac, remembered from admin_sessions',
    );
    const value = first.cookie.split('=')[1] ?? '';
    expect(sessions.rows).toHaveLength(1);
    expect(sessions.rows[0]?.token_hmac).not.toBe(value);
    expect(sessions.rows[0]?.remembered).toBe(true);

    expect((await open(token)).status).toBe(410);

    const me = await get('/v1/panel/me', first.cookie);
    expect(me.status).toBe(200);
    const who = (await me.json()) as { email: string; until: string };
    expect(who.email).toBe('tester@kowboy.se');
    expect(Math.round((Date.parse(who.until) - Date.now()) / 86_400_000)).toBe(30);
  });

  it('keeps a device signed in for 14 days when the person did not tick to be kept', async () => {
    const signed = await open(await linkFor('tester@kowboy.se'));
    expect(Math.round(days(signed.setCookie))).toBe(14);
  });

  it('answers any address alike, and mails only one that may sign in', async () => {
    const stranger = await post('/v1/panel/sign-in', { email: 'someone@example.com' });
    const colleague = await post('/v1/panel/sign-in', { email: 'colleague@kowboy.se' });
    expect(stranger.status).toBe(202);
    expect(await stranger.json()).toEqual(await colleague.json());
    await until(() => core.mails.length === 1, 'the colleague’s mail');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(core.mails.map((mail) => mail.to)).toEqual(['colleague@kowboy.se']);
    expect((await post('/v1/panel/sign-in', { email: 'not an address' })).status).toBe(400);
  });

  it('stops a link after its minutes, and a newer link ends an older one', async () => {
    const older = await linkFor('tester@kowboy.se');
    const newer = await linkFor('tester@kowboy.se');
    expect((await open(older)).status).toBe(410);
    await db().query("update admin_logins set expires_at = now() - interval '1 minute'");
    expect((await open(newer)).status).toBe(410);
    expect((await open('')).status).toBe(410);
  });

  it(`mails no more than ${String(LINKS_PER_WINDOW)} links to one address within a link’s minutes`, async () => {
    for (let i = 0; i <= LINKS_PER_WINDOW; i++) {
      expect((await post('/v1/panel/sign-in', { email: 'tester@kowboy.se' })).status).toBe(202);
    }
    await until(() => core.mails.length === LINKS_PER_WINDOW, 'the mails');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(core.mails).toHaveLength(LINKS_PER_WINDOW);
  });

  it('signs one device out, and its session stops working', async () => {
    const one = await open(await linkFor('tester@kowboy.se'));
    const two = await open(await linkFor('tester@kowboy.se'));
    const out = await post('/v1/panel/sign-out', {}, { cookie: one.cookie });
    expect(out.status).toBe(200);
    expect(out.headers.get('set-cookie')).toContain('Max-Age=0');
    expect((await get('/v1/panel/me', one.cookie)).status).toBe(401);
    expect((await get('/v1/panel/me', two.cookie)).status).toBe(200);
  });

  it('lets nobody in without a session, nor a session whose address may no longer sign in', async () => {
    expect((await get('/v1/panel/me')).status).toBe(401);
    expect((await get('/v1/panel/inbox')).status).toBe(401);
    expect((await get('/v1/panel/inbox', `${COOKIE}=made-up`)).status).toBe(401);
    await db().query(
      `insert into admin_sessions (token_hmac, email, expires_at) values ($1, 'gone@example.com', now() + interval '1 day')`,
      [tokenHmac('left-the-list', core.engine.config.credentialsKey)],
    );
    expect((await get('/v1/panel/me', `${COOKIE}=left-the-list`)).status).toBe(401);
  });

  it('takes changes as JSON only, which a page on another site cannot send unasked', async () => {
    const asForm = await fetch(`${core.baseUrl}/v1/panel/sign-in`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'email=tester@kowboy.se',
    });
    expect(asForm.status).toBe(415);
    const signOut = await fetch(`${core.baseUrl}/v1/panel/sign-out`, { method: 'POST' });
    expect(signOut.status).toBe(415);
  });
});
