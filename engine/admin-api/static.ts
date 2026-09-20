// The panel itself: the browser app built into static files by `npm run build` (admin/dist),
// served by the web process under /admin. Every path that is not a file is the app's page, which
// routes on the browser side. Hashed assets are cached for good; the page is not.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import type { Response, RouteTable } from '../http/server.js';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

/** Only what the app needs: its own scripts and styles, the API on the same host, no framing. */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const PAGE_HEADERS: Record<string, string> = {
  'cache-control': 'no-cache',
  'content-security-policy': CSP,
  'referrer-policy': 'same-origin',
  'x-content-type-options': 'nosniff',
};

/** Where the built app is: the repository's admin/dist, from the working directory the process runs in. */
export const appDir = (): string => resolve(process.cwd(), 'admin', 'dist');

const missing: Response = {
  status: 503,
  body: { error: 'the admin app is not built: run npm run build' },
};

function file(dir: string, path: string): Response | null {
  const target = resolve(dir, `.${path}`);
  if (!target.startsWith(dir + sep) || !existsSync(target) || !statSync(target).isFile()) {
    return null;
  }
  const type = TYPES[extname(target)] ?? 'application/octet-stream';
  const immutable = path.startsWith('/assets/');
  return {
    status: 200,
    body: readFileSync(target),
    headers: {
      'content-type': type,
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
      'x-content-type-options': 'nosniff',
    },
  };
}

/** GET /admin and everything under it. */
export function appRoutes(dir = appDir()): RouteTable {
  const handler = (path: string): Response => {
    if (!existsSync(join(dir, 'index.html'))) return missing;
    const within = path.replace(/^\/admin/, '') || '/';
    const asset = within !== '/' && within !== '/index.html' ? file(dir, within) : null;
    if (asset) return asset;
    return {
      status: 200,
      body: readFileSync(join(dir, 'index.html')),
      headers: { 'content-type': TYPES['.html'] ?? 'text/html', ...PAGE_HEADERS },
    };
  };
  return [
    { method: 'GET', path: '/admin', handler: (request) => handler(request.path) },
    { method: 'GET', path: '/admin/*', handler: (request) => handler(request.path) },
  ];
}
