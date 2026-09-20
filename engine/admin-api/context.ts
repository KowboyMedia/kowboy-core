// What every route of the panel's API gets, and the small helpers they share.
import { logEvent } from '../events.js';
import { DATATYPES, type AdapterAdmin, type Datatype } from '../adapter-api/types.js';
import type { Request, Response } from '../http/server.js';
import type { Engine } from '../index.js';

export type AdminAdapter = { provider: string; admin?: AdapterAdmin };

export type Ctx = {
  request: Request;
  /** The captures of the route's pattern, decoded. */
  params: string[];
  /** Who is asking: the address logged in, or "agent" for the admin secret. */
  actor: string;
  engine: Engine;
  adapters: AdminAdapter[];
  /** The JSON body as an object; a body that is not one is a 400. */
  body<T extends object>(): T;
  /** Who did what: every change made through the panel is one `admin.action` event. */
  audit(
    action: string,
    fields?: Record<string, unknown>,
    context?: { tenantId?: number | null; connectionId?: string | null },
  ): Promise<void>;
};

export type Route = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  pattern: RegExp;
  handle(ctx: Ctx): Promise<Response>;
};

/** A failure the route wants shown as it is: a status, a message, and the fields at fault. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly errors?: Record<string, string>,
  ) {
    super(message);
  }
}

export const json = (body: unknown, status = 200): Response => ({ status, body });

export const datatypeOf = (value: unknown): Datatype | undefined =>
  DATATYPES.find((candidate) => candidate === value);

/** A whole number above zero, or undefined. */
export const numberOf = (value: unknown): number | undefined => {
  const n = Number(value);
  return value !== undefined && value !== null && value !== '' && Number.isInteger(n) && n > 0
    ? n
    : undefined;
};

export const stringOf = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

/** A date or moment as ISO, or undefined when it is not one. */
export const momentOf = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || value === '') return undefined;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : new Date(ms).toISOString();
};

export const auditEvent = (
  actor: string,
  action: string,
  fields: Record<string, unknown>,
  context: { tenantId?: number | null; connectionId?: string | null },
): Promise<void> =>
  logEvent({
    type: 'admin.action',
    tenantId: context.tenantId ?? null,
    connectionId: context.connectionId ?? null,
    fields: { actor, action, ...fields },
  });
