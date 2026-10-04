import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { gzipSync } from 'node:zlib';
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
  /** The socket's address, for the forms door's limit per address; a proxy's is in the headers. */
  remoteAddress: string | null;
  json<T>(): T;
};

export type Response =
  | {
      status: number;
      /** JSON, a string, or a Buffer sent as is (a file). */
      body?: unknown;
      headers?: Record<string, string>;
    }
  /** A handler that writes the response itself: a stream that stays open, such as the panel's live feed. */
  | { raw: (outgoing: ServerResponse) => void };

export type RouteTable = { method: string; path: string; handler: Handler }[];

let gzipLevel = 3;

export function configureCompression(level: number): void {
  gzipLevel = level;
}

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
    write(incoming, outgoing, { status: 404, body: { error: 'not found' } });
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
      remoteAddress: incoming.socket.remoteAddress ?? null,
      json<T>(): T {
        return body.length === 0 ? ({} as T) : (JSON.parse(body.toString('utf8')) as T);
      },
    };
    const response = await route.handler(request);
    if ('raw' in response) response.raw(outgoing);
    else write(incoming, outgoing, response);
  } catch (error) {
    report(error, { where: 'http', path: url.pathname });
    write(incoming, outgoing, { status: 500, body: { error: 'internal error' } });
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

function write(
  incoming: IncomingMessage,
  outgoing: ServerResponse,
  response: Exclude<Response, { raw: unknown }>,
): void {
  const headers: Record<string, string> = { ...response.headers };
  let payload: Buffer;

  if (response.body === undefined) {
    payload = Buffer.alloc(0);
  } else if (Buffer.isBuffer(response.body)) {
    payload = response.body;
    headers['content-type'] ??= 'application/octet-stream';
  } else if (typeof response.body === 'string') {
    payload = Buffer.from(response.body, 'utf8');
    headers['content-type'] ??= 'text/plain; charset=utf-8';
  } else {
    payload = Buffer.from(JSON.stringify(response.body), 'utf8');
    headers['content-type'] ??= 'application/json; charset=utf-8';
  }

  // gzip at a low, fast level (strategy §2, AC 40).
  const accepts = (incoming.headers['accept-encoding'] ?? '').includes('gzip');
  if (accepts && payload.length > 0) {
    payload = gzipSync(payload, { level: gzipLevel });
    headers['content-encoding'] = 'gzip';
  }
  headers['vary'] = headers['vary'] ? `${headers['vary']}, accept-encoding` : 'accept-encoding';
  headers['content-length'] = String(payload.length);

  outgoing.writeHead(response.status, headers);
  outgoing.end(payload);
}
