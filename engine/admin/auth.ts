// Who may use the admin panel: whoever knows the admin secret, once, at the login form. The
// session is a cookie holding an HMAC of the secret, so any web process recognises it and
// rotating the secret logs everyone out. Every POST carries the same value as a CSRF token.
import { createHmac } from 'node:crypto';
import { sameSecret } from '../storage/crypto.js';
import { escape, field } from './html.js';
import type { Request, Response } from '../http/server.js';

const COOKIE = 'core_admin';
const MAX_AGE_S = 12 * 3600;

export const sessionToken = (secret: string): string =>
  createHmac('sha256', secret).update('admin session').digest('hex');

function cookieOf(request: Request): string | null {
  const header = request.headers['cookie'] ?? '';
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE) return rest.join('=');
  }
  return null;
}

export function signedIn(request: Request, secret: string): boolean {
  const cookie = cookieOf(request);
  return cookie !== null && sameSecret(cookie, sessionToken(secret));
}

export const csrfOk = (form: Record<string, string>, secret: string): boolean =>
  sameSecret(form['csrf'] ?? '', sessionToken(secret));

export function loginPage(error?: string): string {
  const flash = error ? `<div class="flash bad">${escape(error)}</div>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Log in · Core admin</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font:15px system-ui,sans-serif;max-width:24rem;margin:4rem auto;padding:0 1rem}label{display:block;margin:.6rem 0 .2rem}input{width:100%;padding:.4rem}button{margin-top:.8rem;padding:.4rem .9rem}.flash{border:1px solid #b91c1c;background:#fef2f2;padding:.5rem}</style></head><body><h1>Core admin</h1>${flash}<form method="post" action="/admin/login">${field('secret', 'Admin secret', { type: 'password', required: true })}<button>Log in</button></form></body></html>`;
}

/** The login form's POST: a cookie on success, the form again on failure. */
export function login(request: Request, secret: string, given: string): Response {
  if (!sameSecret(given, secret)) {
    return { status: 401, body: loginPage('That is not the admin secret.'), headers: HTML };
  }
  const secure = request.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  return {
    status: 303,
    headers: {
      location: '/admin',
      'set-cookie': `${COOKIE}=${sessionToken(secret)}; Path=/admin; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_S}${secure}`,
    },
  };
}

export const logout = (): Response => ({
  status: 303,
  headers: { location: '/admin/login', 'set-cookie': `${COOKIE}=; Path=/admin; Max-Age=0` },
});

export const HTML: Record<string, string> = { 'content-type': 'text/html; charset=utf-8' };
