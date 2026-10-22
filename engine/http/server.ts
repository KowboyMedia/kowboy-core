import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { promisify } from 'node:util';
import { gunzip as gunzipCallback, gzip as gzipCallback, gzipSync } from 'node:zlib';
import { report } from '../errors.js';
import type { Route } from '../adapter-api/types.js';
import { adapterApi } from '../adapter-api/index.js';

/**
 * A small HTTP server: a route table, JSON in and out, gzip on the way out. No framework, because
 * an endpoint should be readable from one file (AGENTS.md).
 */
export type Handler = (request: Request) => Promise<Response> | Response;

export type Request = {
  method: string;
  path: string;
  query: URLSearchParams;
  headers: Record<string, string | undefined>;
  body: Buffer;
  json<T>(): T;
};

export type Response =
  | {
      status: number;
      /** JSON, a string, or a Buffer sent as is (a file). */
      body?: unknown;
      /** A JSON body compressed already, as gzip: sent as it is, or unpacked for a client without gzip. */
      gzipped?: Buffer;
      headers?: Record<string, string>;
    }
  /** A handler that writes the response itself: a stream that stays open, such as the panel's live feed. */
  | { raw: (outgoing: ServerResponse) => void };

export type RouteTable = { method: string; path: string; handler: Handler }[];

let compressionLevel = 3;
const gzip = promisify(gzipCallback);
const gunzip = promisify(gunzipCallback);
/** A body this large is compressed off the event loop; a smaller one at once, quicker than a hand-off. */
const GZIP_OFF_LOOP_BYTES = 64 * 1024;

export function configureCompression(level: number): void {
  compressionLevel = level;
}

/** The level replies are compressed at (GZIP_LEVEL). */
export const gzipLevel = (): number => compressionLevel;

export function jsonResponse(status: number, body: unknown): Response {
  return { status, body };
}

/** Mount an adapter's own routes under /v1/hook/<provider>/ (strategy §5.1). */
export function adapterRoutes(provider: string, routes: Route[]): RouteTable {
  const api = adapterApi(provider);
  return routes.map((route) => ({
    method: route.method,
    path: `/v1/hook/${provider}/${route.path.replace(/^\//, '')}`,
    handler: async (request: Request): Promise<Response> => {
      const response = await route.handler(
        {
          method: request.method,
          url: request.path + (request.query.size ? `?${request.query}` : ''),
          headers: request.headers,
          body: request.body,
        },
        api,
      );
      return { status: response.status, body: response.body, headers: response.headers };
    },
  }));
}

export function startServer(routes: RouteTable, port: number): Server {
  const server = createServer((incoming, outgoing) => {
    void handle(routes, incoming, outgoing);
  });
  server.listen(port);
  return server;
}

async function handle(
  routes: RouteTable,
  incoming: IncomingMessage,
  outgoing: ServerResponse,
): Promise<void> {
  const url = new URL(incoming.url ?? '/', 'http://core.local');
  const route = routes.find(
    (candidate) => candidate.method === incoming.method && matches(candidate.path, url.pathname),
  );

  if (!route) {
    await write(incoming, outgoing, { status: 404, body: { error: 'not found' } });
    return;
  }

  try {
    const body = await readBody(incoming);
    const request: Request = {
      method: incoming.method ?? 'GET',
      path: url.pathname,
      query: url.searchParams,
      headers: incoming.headers as Record<string, string | undefined>,
      body,
      json<T>(): T {
        return body.length === 0 ? ({} as T) : (JSON.parse(body.toString('utf8')) as T);
      },
    };
    const response = await route.handler(request);
    if ('raw' in response) response.raw(outgoing);
    else await write(incoming, outgoing, response);
  } catch (error) {
    report(error, { where: 'http', path: url.pathname });
    // A body cut off after its head went out can only end there; the site's parser sees it.
    if (outgoing.headersSent) outgoing.destroy();
    else await write(incoming, outgoing, { status: 500, body: { error: 'internal error' } });
  }
}

/** Exact match, or a trailing "/*" prefix so an adapter can own a subtree. */
function matches(pattern: string, path: string): boolean {
  if (pattern.endsWith('/*')) return path.startsWith(pattern.slice(0, -1));
  return pattern === path;
}

function readBody(incoming: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    incoming.on('data', (chunk: Buffer) => chunks.push(chunk));
    incoming.on('end', () => resolve(Buffer.concat(chunks)));
    incoming.on('error', reject);
  });
}

/** A body as bytes, with the type it is sent as unless the handler named one. */
function bytesOf(body: unknown, headers: Record<string, string>): Buffer {
  if (body === undefined) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) {
    headers['content-type'] ??= 'application/octet-stream';
    return body;
  }
  if (typeof body === 'string') {
    headers['content-type'] ??= 'text/plain; charset=utf-8';
    return Buffer.from(body, 'utf8');
  }
  headers['content-type'] ??= 'application/json; charset=utf-8';
  return Buffer.from(JSON.stringify(body), 'utf8');
}

async function write(
  incoming: IncomingMessage,
  outgoing: ServerResponse,
  response: Exclude<Response, { raw: unknown }>,
): Promise<void> {
  const headers: Record<string, string> = { ...response.headers };
  const accepts = (incoming.headers['accept-encoding'] ?? '').includes('gzip');
  let payload: Buffer;

  if (response.gzipped) {
    payload = accepts ? response.gzipped : await gunzip(response.gzipped);
    if (accepts) headers['content-encoding'] = 'gzip';
    headers['content-type'] ??= 'application/json; charset=utf-8';
  } else {
    payload = bytesOf(response.body, headers);
  }

  // gzip at a low, fast level (strategy §2, AC 40); a large body off the event loop, so it does
  // not hold up the requests that arrive while it is compressed.
  if (accepts && payload.length > 0 && !response.gzipped) {
    payload =
      payload.length < GZIP_OFF_LOOP_BYTES
        ? gzipSync(payload, { level: compressionLevel })
        : await gzip(payload, { level: compressionLevel });
    headers['content-encoding'] = 'gzip';
  }
  headers['vary'] = 'accept-encoding';
  headers['content-length'] = String(payload.length);

  outgoing.writeHead(response.status, headers);
  outgoing.end(payload);
}
