// The panel's calls to Core's API under /v1/panel/. The session is a cookie the browser keeps and
// the page never reads; a 401 means this device is signed out.

// The Inbox's shape is the engine's own (engine/panel/inbox.ts), so the two cannot drift apart.
import type { Inbox, InboxLevel } from '../../engine/panel/inbox.js';

export type {
  Card,
  CheckCard,
  FormsCard,
  Inbox,
  LoginCard,
  SiteCard,
  Tenant,
  WorkerCard,
} from '../../engine/panel/inbox.js';
export type Level = InboxLevel;

export type SignInFacts = {
  instance: string;
  rememberDays: number;
  sessionDays: number;
  linkMinutes: number;
};

export type Me = { email: string; until: string; instance: string };

/** Core answered with something other than what the page asked for. */
export class Refused extends Error {
  constructor(
    readonly status: number,
    readonly reason: string,
  ) {
    super(`Core answered ${String(status)}: ${reason}`);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/v1/panel${path}`, {
    credentials: 'same-origin',
    ...init,
    headers: { accept: 'application/json', ...(init?.headers ?? {}) },
  });
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Refused(response.status, body.error ?? '');
  return body as T;
}

const post = <T>(path: string, body: unknown): Promise<T> =>
  call<T>(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

export const api = {
  signInFacts: () => call<SignInFacts>('/sign-in'),
  askForLink: (email: string, remember: boolean) =>
    post<{ ok: true }>('/sign-in', { email, remember }),
  openLink: (token: string) => post<{ email: string; until: string }>('/sign-in/link', { token }),
  me: () => call<Me>('/me'),
  signOut: () => post<{ ok: true }>('/sign-out', {}),
  inbox: () => call<Inbox>('/inbox'),
};

export const signedOut = (error: unknown): boolean =>
  error instanceof Refused && error.status === 401;

/** What this browser remembers of the last link it asked for, to fill in a new request. */
const LAST = 'kowboy-core-panel:last-sign-in';

export function rememberRequest(email: string, remember: boolean): void {
  try {
    localStorage.setItem(LAST, JSON.stringify({ email, remember }));
  } catch {
    // A browser that keeps nothing fills in nothing.
  }
}

export function lastRequest(): { email: string; remember: boolean } | null {
  try {
    const kept = JSON.parse(localStorage.getItem(LAST) ?? 'null') as {
      email?: unknown;
      remember?: unknown;
    } | null;
    if (typeof kept?.email !== 'string') return null;
    return { email: kept.email, remember: kept.remember === true };
  } catch {
    return null;
  }
}
