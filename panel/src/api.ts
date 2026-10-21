// The panel's calls to Core's API under /v1/panel/. The session is a cookie the browser keeps and
// the page never reads; a 401 means this device is signed out.

// The Inbox's shape is the engine's own (engine/panel/inbox.ts), so the two cannot drift apart.
import type { Inbox, InboxLevel } from '../../engine/panel/inbox.js';

export type {
  Card,
  CheckCard,
  FailingRecord,
  FormsCard,
  Inbox,
  KeptForm,
  LoginCard,
  RecordsCard,
  SiteCard,
  Tenant,
  WorkerCard,
} from '../../engine/panel/inbox.js';
export type { Fixed, FixedFacts } from '../../engine/panel/problems.js';
export type Level = InboxLevel;

export type {
  Brokerage,
  BrokerageRow,
  ConnectionView,
  Crm,
  CrmField,
  Status,
  Website,
} from '../../engine/panel/brokerages.js';
import type { Brokerage, BrokerageRow, Crm } from '../../engine/panel/brokerages.js';
export type { ShownAction, ShownSection, ShownValue } from '../../engine/panel/sections.js';
export type { Flow, FlowOffice, FlowRow, FlowSite } from '../../engine/panel/flow.js';
import type { Flow } from '../../engine/panel/flow.js';
export type {
  OfficeChoice,
  RecordChange,
  RecordField,
  RecordFilter,
  RecordList,
  RecordPage,
  RecordRow,
  TenantChoice,
} from '../../engine/panel/recordlist.js';
import type { RecordFilter, RecordList, RecordPage } from '../../engine/panel/recordlist.js';
export type {
  PickedRecord,
  SyncChoice,
  SyncSite,
  SyncStarted,
  SyncTicket,
  SyncView,
  SyncWhat,
} from '../../engine/panel/sync.js';
import type {
  SyncChoice,
  SyncStarted,
  SyncTicket,
  SyncView,
  SyncWhat,
} from '../../engine/panel/sync.js';

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
    /** Core's own words for what failed, whose fault it is and what to do, when it gave them. */
    readonly said = '',
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
  const body = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
  if (!response.ok) throw new Refused(response.status, body.error ?? '', body.message ?? '');
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
  editBrokerage: (id: number, name: string) =>
    post<{ ok: true }>(`/brokerages/${String(id)}/edit`, { name }),
  /** Deletes the tenant and everything of it; Core asks for its name, typed. */
  deleteBrokerage: (id: number, name: string) =>
    post<{ ok: true }>(`/brokerages/${String(id)}/delete`, { name }),
  switchBrokerage: (id: number, on: boolean) =>
    post<{ ok: true }>(`/brokerages/${String(id)}/switch`, { on }),
  replaceToken: (id: number) => post<{ token: string }>(`/brokerages/${String(id)}/token`, {}),
  /** A warning is the bot check's own sentence: the website is saved, its forms may not pass. */
  addWebsite: (id: number, website: { label: string; bellUrl: string }) =>
    post<{ id: number; warning?: string }>(`/brokerages/${String(id)}/websites`, website),
  removeWebsite: (id: number) => post<{ ok: true }>(`/websites/${String(id)}/remove`, {}),
  editWebsite: (id: number, website: { label: string; bellUrl: string }) =>
    post<{ ok: true; warning?: string }>(`/websites/${String(id)}/edit`, website),
  newBellSecret: (id: number) =>
    post<{ bellSecret: string }>(`/websites/${String(id)}/bell-secret`, {}),
  addConnection: (
    id: number,
    connection: { provider: string; login: Record<string, string>; formsTestMode: boolean },
  ) => post<{ id: string; name: string }>(`/brokerages/${String(id)}/connections`, connection),
  /** The CRM screen's Save: a login field changed or a secret typed is tested with the CRM first. */
  editConnection: (
    connection: string,
    change: { login: Record<string, string>; formsTestMode: boolean },
  ) => post<{ tested: boolean }>(`/connections/${encodeURIComponent(connection)}/edit`, change),
  act: (connection: string, action: string) =>
    post<{ message: string }>(`/connections/${encodeURIComponent(connection)}/act`, { action }),
  removeConnection: (connection: string) =>
    post<{ removedAt: string }>(`/connections/${encodeURIComponent(connection)}/remove`, {}),
  flow: (tenants: number[], offices: string[]) => {
    const query = new URLSearchParams();
    for (const tenant of tenants) query.append('tenant', String(tenant));
    for (const office of offices) query.append('office', office);
    const asked = query.toString();
    return call<Flow>(`/flow${asked ? `?${asked}` : ''}`);
  },
  /** "Done, I've pasted it": the Inbox card waits until the problem is solved. */
  acted: (key: string) => post<{ ok: true }>('/problems/act', { key }),
  /** One page of the records the filter keeps, by name, with the filters' choices counted. */
  records: (filter: Partial<RecordFilter>, page = 1) => {
    const query = recordQuery(filter);
    if (page > 1) query.set('page', String(page));
    const asked = query.toString();
    return call<RecordList>(`/records${asked ? `?${asked}` : ''}`);
  },
  record: (connection: string, datatype: string, id: string) =>
    call<RecordPage>(`/records/${[connection, datatype, id].map(encodeURIComponent).join('/')}`),
  /** Fetch again, recompute or send: it only reads from a CRM, through the CRM's own code. */
  sync: (what: SyncWhat, choice: SyncChoice) =>
    post<SyncStarted>('/records/sync', { what, ...choice }),
  syncState: (ticket: SyncTicket) => {
    const query = new URLSearchParams({ what: ticket.what, at: ticket.at });
    for (const id of ticket.events) query.append('event', String(id));
    for (const id of ticket.tenants) query.append('tenant', String(id));
    if (ticket.job !== null) query.set('job', String(ticket.job));
    if (ticket.sent !== null) query.set('sent', String(ticket.sent));
    return call<SyncView>(`/records/sync?${query.toString()}`);
  },
  /** "Retry 3 properties": the CRM fetches the records again, and the card waits meanwhile. */
  retry: (
    id: number,
    key: string,
    records: { connection: string; datatype: string; id: string }[],
  ) => post<{ ok: true }>(`/brokerages/${String(id)}/retry`, { key, records }),
};

/** The records filter as an address carries it: `tenant`, `office`, `type`, `id`, `removed=1`. */
export function recordQuery(filter: Partial<RecordFilter>): URLSearchParams {
  const query = new URLSearchParams();
  for (const tenant of filter.tenants ?? []) query.append('tenant', String(tenant));
  for (const office of filter.offices ?? []) query.append('office', office);
  for (const type of filter.types ?? []) query.append('type', type);
  if (filter.id) query.set('id', filter.id);
  if (filter.removed) query.set('removed', '1');
  return query;
}

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
