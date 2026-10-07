// The admin area's own little router (docs/admin-panel-design.md §3). The engine's HTTP server
// matches a path exactly or by prefix; the admin API needs `/v1/admin/tenants/:id`, so the whole
// subtree is one route per method and this file picks the handler inside it. No framework: an
// endpoint stays readable from one file (AGENTS.md).
import { jsonResponse, type Request, type Response } from '../http/server.js';
import type { Session } from './auth.js';

export type AdminRequest = Request & {
  /** The `:name` pieces of the matched path. */
  params: Record<string, string>;
  /** Who is signed in. Absent only on the open routes. */
  session: Session;
};

export type AdminRoute = {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** Without the `/v1/admin` prefix: `/tenants/:id`. */
  path: string;
  handler: (request: AdminRequest) => Promise<Response> | Response;
  /** Reachable without a session: the sign-in routes alone. */
  open?: boolean;
};

export const PREFIX = '/v1/admin';

/** A refusal the app can show as it stands. */
export const fail = (status: number, message: string): Response =>
  jsonResponse(status, { error: message });

/** What every list answers, so one Refine data provider reads them all. */
export const page = <T>(data: T[], total: number): Response => jsonResponse(200, { data, total });

/** What every single record answers. */
export const one = <T>(data: T): Response => jsonResponse(200, { data });

/** Match one route pattern against a path, giving back its `:name` pieces. */
export function match(pattern: string, path: string): Record<string, string> | null {
  const wanted = pattern.split('/').filter(Boolean);
  const got = path.split('/').filter(Boolean);
  if (wanted.length !== got.length) return null;
  const params: Record<string, string> = {};
  for (const [index, piece] of wanted.entries()) {
    const actual = got[index] ?? '';
    if (piece.startsWith(':')) params[piece.slice(1)] = decodeURIComponent(actual);
    else if (piece !== actual) return null;
  }
  return params;
}

/** A whole number from the query string, or the fallback. */
export const number = (request: Request, key: string, fallback: number): number => {
  const raw = request.query.get(key);
  const value = raw === null || raw === '' ? Number.NaN : Number(raw);
  return Number.isFinite(value) ? value : fallback;
};

/** A query parameter, or undefined when absent or empty, so a filter is simply left out. */
export const text = (request: Request, key: string): string | undefined => {
  const value = request.query.get(key);
  return value === null || value === '' ? undefined : value;
};

/**
 * The filters a person types: a moment must be a date and a number must be a number, or the page
 * says so in words. Without this, a slip in a filter box reached the database as a cast error
 * (seen on staging, 2026-09-20).
 */
export function refuseBadFilters(
  request: Request,
  moments: string[],
  numbers: string[],
): Response | null {
  for (const key of moments) {
    const value = text(request, key);
    if (value !== undefined && Number.isNaN(new Date(value).getTime())) {
      return fail(400, `“${value}” is not a date. Write it as 2026-09-20 or 2026-09-20T14:00:00Z.`);
    }
  }
  for (const key of numbers) {
    const value = text(request, key);
    if (value !== undefined && !/^\d+$/.test(value)) {
      return fail(400, `“${value}” is not a number.`);
    }
  }
  return null;
}

/** The body as an object, or a refusal when it is not JSON. */
export function body<T>(request: Request): { value: T } | { error: Response } {
  try {
    return { value: request.json<T>() };
  } catch {
    return { error: fail(400, 'The body is not JSON.') };
  }
}
