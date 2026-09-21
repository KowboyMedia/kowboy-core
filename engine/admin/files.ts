// The built browser app, served by the web process under /admin (docs/admin-panel-design.md §3).
// `npm run build` puts it in `dist/admin`; nothing else serves it and nothing is hosted elsewhere.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Request, Response } from '../http/server.js';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

const here = dirname(fileURLToPath(import.meta.url));
/** Built: `dist/engine/admin` sits beside `dist/admin`. Run from source: `dist/admin` under the cwd. */
const CANDIDATES = [join(here, '..', '..', 'admin'), join(process.cwd(), 'dist', 'admin')];

let root: string | null = null;

/** Where the built app is, or null while it has not been built. */
function appRoot(): string | null {
  if (root && existsSync(join(root, 'index.html'))) return root;
  root = CANDIDATES.find((candidate) => existsSync(join(candidate, 'index.html'))) ?? null;
  return root;
}

const NOT_BUILT =
  '<!doctype html><meta charset="utf-8"><title>Kowboy Core</title>' +
  '<body style="font:16px system-ui;margin:3rem;max-width:34rem">' +
  '<h1>The admin area is not built</h1>' +
  '<p>Run <code>npm run build</code> and start Core again. The app is compiled into ' +
  '<code>dist/admin</code> and served from there.</p>';

/**
 * One file of the app, or its `index.html` for any address the app routes itself. Everything is
 * inside the built folder: a path that climbs out of it is refused rather than resolved.
 */
export function file(request: Request): Response {
  const base = appRoot();
  if (!base)
    return { status: 503, body: NOT_BUILT, headers: { 'content-type': TYPES['.html'] ?? '' } };

  const wanted = normalize(request.path.replace(/^\/admin\/?/, '')).replace(/^(\.\.[/\\])+/, '');
  const path = join(base, wanted);
  const inside = path.startsWith(base);
  const asFile =
    inside && existsSync(path) && statSync(path).isFile() ? path : join(base, 'index.html');
  const extension = /\.[a-z0-9]+$/i.exec(asFile)?.[0]?.toLowerCase() ?? '.html';

  return {
    status: 200,
    body: readFileSync(asFile),
    headers: {
      'content-type': TYPES[extension] ?? 'application/octet-stream',
      // The app's own files carry their hash in the name; the page that loads them never caches.
      'cache-control': asFile.endsWith('index.html')
        ? 'no-store'
        : 'public, max-age=31536000, immutable',
    },
  };
}
