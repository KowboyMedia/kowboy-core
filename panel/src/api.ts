// The panel's calls to Core's API under /v1/panel/. The session is a cookie the browser keeps and
// the page never reads; a 401 means this device is signed out.

// The Inbox's shape is the engine's own (engine/panel/inbox.ts), so the two cannot drift apart.
import type { Inbox, InboxLevel } from '../../engine/panel/inbox.js';

export type {
  Card,
  CheckCard,
  FormsCard,
  Inbox,
  KeptForm,
  LoginCard,
  SiteCard,
  Tenant,
  WorkerCard,
} from '../../engine/panel/inbox.js';
export type { Fixed, FixedFacts } from '../../engine/panel/problems.js';
export type { Removed, ReloadView } from '../../engine/panel/reload.js';
import type { Resent } from '../../engine/panel/forms.js';
export type { Resent };
export type Level = InboxLevel;

export type {
  Brokerage,
  BrokerageRow,
  ConnectionView,
  Crm,
  CrmField,
  Office,
  Status,
  Website,
} from '../../engine/panel/brokerages.js';
import type { Brokerage, BrokerageRow, Crm, Office } from '../../engine/panel/brokerages.js';

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
  crms: () => call<{ crms: Crm[] }>('/crms'),
  brokerages: () => call<{ brokerages: BrokerageRow[] }>('/brokerages'),
  createBrokerage: (name: string) => post<{ id: number }>('/brokerages', { name }),
  brokerage: (id: number) => call<Brokerage>(`/brokerages/${String(id)}`),
  switchBrokerage: (id: number, on: boolean) =>
    post<{ ok: true }>(`/brokerages/${String(id)}/switch`, { on }),
  replaceToken: (id: number) => post<{ token: string }>(`/brokerages/${String(id)}/token`, {}),
  addWebsite: (id: number, website: { label: string; bellUrl: string }) =>
    post<{ id: number }>(`/brokerages/${String(id)}/websites`, website),
  removeWebsite: (id: number) => post<{ ok: true }>(`/websites/${String(id)}/remove`, {}),
  addConnection: (
    id: number,
    connection: { provider: string; name: string; login: Record<string, string> },
  ) => post<{ id: string }>(`/brokerages/${String(id)}/connections`, connection),
  changeLogin: (connection: string, login: Record<string, string>) =>
    post<{ ok: true }>(`/connections/${encodeURIComponent(connection)}/login`, { login }),
  formsTestMode: (connection: string, on: boolean) =>
    post<{ ok: true }>(`/connections/${encodeURIComponent(connection)}/forms-test-mode`, { on }),
  act: (connection: string, action: string) =>
    post<{ ok: true }>(`/connections/${encodeURIComponent(connection)}/act`, { action }),
  removeConnection: (connection: string) =>
    post<{ removedAt: string }>(`/connections/${encodeURIComponent(connection)}/remove`, {}),
  offices: (connection: string) =>
    call<{ offices: Office[] }>(`/connections/${encodeURIComponent(connection)}/offices`),
  /** "Done, I've pasted it": the Inbox card waits until the problem is solved. */
  acted: (key: string) => post<{ ok: true }>('/problems/act', { key }),
  maintenance: (on: boolean) => post<{ ok: true }>('/maintenance', { on }),
  resend: (id: number, ids: string[]) =>
    post<{ results: Resent[] }>(`/brokerages/${String(id)}/resend`, { ids }),
  reload: (id: number) => post<{ ok: true }>(`/brokerages/${String(id)}/reload`, {}),
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
