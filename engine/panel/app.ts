// The admin panel's browser app, built by `npm run build:panel` into dist/panel and served under
// /admin. Every address under /admin that is not one of the app's files gets the app's page, which
// draws the right screen itself. Without a build the answer is 503 with a page that says how to
// make one, never a 404, so a missing build is not mistaken for a missing page.
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import type { Request, Response } from '../http/server.js';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/** The page never sits in a frame, and gives no address away to the sites it links to. */
const GUARDS = {
  'x-frame-options': 'DENY',
  'content-security-policy': "frame-ancestors 'none'",
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
};

let built = resolve(process.cwd(), 'dist/panel');

/** Where the built app is: dist/panel from where Core runs, or another folder in a test. */
export function configurePanelApp(directory: string): void {
  built = resolve(directory);
}

const NOT_BUILT = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Kowboy Core</title></head>
<body style="font-family:Inter,system-ui,sans-serif;background:#fafafa;color:#373a3e;padding:48px 16px;text-align:center">
<h1 style="font-size:20px;font-weight:600">The admin panel isn’t built</h1>
<p style="color:#6b7280">Core has no build of the panel to show. Build it where Core runs with <code>npm run build</code>, then reload this page.</p>
</body>
</html>
`;

async function file(path: string): Promise<Buffer | null> {
  try {
    const found = await stat(path);
    return found.isFile() ? await readFile(path) : null;
  } catch {
    return null;
  }
}

/** One of the app's own files, by its path under /admin/, or null when there is no such file. */
async function asset(path: string): Promise<Response | null> {
  const relative = normalize(decodeURIComponent(path.replace(/^\/admin\/?/, '')));
  if (!relative || relative === '.' || relative.startsWith('..') || relative.includes(`${sep}..`))
    return null;
  const target = join(built, relative);
  if (!target.startsWith(built + sep)) return null;
  const body = await file(target);
  if (!body) return null;
  // Vite names its files by their content, so a file under assets/ never changes.
  const forever = relative.startsWith(`assets${sep}`);
  return {
    status: 200,
    body,
    headers: {
      ...GUARDS,
      'content-type': TYPES[extname(target)] ?? 'application/octet-stream',
      'cache-control': forever ? 'public, max-age=31536000, immutable' : 'no-cache',
    },
  };
}

/** `GET /admin` and `GET /admin/*`: a file of the app, or the app's page for any other address. */
export async function panelApp(request: Request): Promise<Response> {
  let found: Response | null = null;
  try {
    found = await asset(request.path);
  } catch {
    found = null;
  }
  if (found) return found;
  const page = await file(join(built, 'index.html'));
  if (!page) {
    return {
      status: 503,
      body: NOT_BUILT,
      headers: { ...GUARDS, 'content-type': TYPES['.html'] ?? '', 'cache-control': 'no-store' },
    };
  }
  return {
    status: 200,
    body: page,
    headers: { ...GUARDS, 'content-type': TYPES['.html'] ?? '', 'cache-control': 'no-cache' },
  };
}
