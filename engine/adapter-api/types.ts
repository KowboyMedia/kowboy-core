// The types an adapter may use. Protected path: changing this surface needs approval
// (AGENTS.md rule 3, strategy §3.1 E3).

export type Datatype = 'property' | 'agent' | 'office' | 'area' | 'association' | 'project';

export const DATATYPES: readonly Datatype[] = [
  'property',
  'agent',
  'office',
  'area',
  'association',
  'project',
] as const;

/** One canonical record's `data`, matching `schemas/<datatype>.v1.json`. */
export type Canonical = Record<string, unknown>;

/** What an adapter is told about a connection. Credentials are the adapter's to use, never logged. */
export type Connection = {
  id: string;
  tenantId: number;
  provider: string;
  credentials: string | null;
  /** Empty means every office the credential can see (SRS §3). */
  licensedOffices: string[];
  active: boolean;
};

export type Manifest = {
  provider: string;
  datatypes: Datatype[];
};

/** A mapper is a pure translation: no I/O, no clock, no side effects (SRS §4). */
export type Mapper = (raw: unknown) => MappedRecord;

export type MappedRecord = {
  data: Canonical;
  /** Null for datatypes that are tenant-wide rather than office-scoped. */
  officeId: string | null;
  /** The CRM's own last-change time, never the local write time. */
  remoteUpdatedAt: string | null;
};

export type Mappers = Partial<Record<Datatype, Mapper>>;

export type IngestResult =
  | { outcome: 'written'; seq: number }
  | { outcome: 'unchanged' }
  | { outcome: 'dropped'; reason: 'unlicensed' | 'malformed' | 'unknown-datatype' | 'inactive' };

export type LifecycleEvent =
  | { type: 'connection_added'; connection: Connection }
  | { type: 'connection_removed'; connection: Connection }
  | { type: 'offices_added'; connection: Connection; officeIds: string[] }
  | { type: 'offices_removed'; connection: Connection; officeIds: string[] }
  | { type: 'resync'; connection: Connection; datatype?: Datatype }
  /** Fetch these records again from the CRM (the panel's "fetch again"); records the CRM no longer has are removed. */
  | { type: 'refetch'; connection: Connection; records: AdminRecord[] };

export type LifecycleHandler = (event: LifecycleEvent) => Promise<void> | void;

/**
 * One health check's answer. `detail` is for anyone: counts and plain words, never a customer's
 * name, a connection or an office id, because `/v1/health` is public (Patric, 2026-09-20,
 * question 62). What the detail counts goes in `names`, which the public answer leaves out and
 * the alerts and the panel carry.
 */
export type HealthResult = { ok: boolean; detail?: string; names?: string[] };

/** One HTTP route an adapter mounts itself (strategy §5.1). The engine never inspects the body. */
export type Route = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Mounted under /v1/hook/<provider>/, e.g. "webhook" or "webhook/:connection". */
  path: string;
  /** The adapter's API comes along, so a handler can log events and read its connections. */
  handler: (request: RouteRequest, api: AdapterApi) => Promise<RouteResponse> | RouteResponse;
};

export type RouteRequest = {
  method: string;
  url: string;
  headers: Record<string, string | undefined>;
  /** The untouched request body. Signature checks need the exact bytes. */
  body: Buffer;
};

export type RouteResponse = {
  status: number;
  body?: string | Record<string, unknown>;
  headers?: Record<string, string>;
};

/** Where an adapter's event belongs: a record's timeline, and the chain one notification started. */
export type EventContext = {
  correlationId?: string | null;
  connectionId?: string | null;
  datatype?: Datatype | null;
  remoteId?: string | null;
};

/** Everything the engine offers an adapter. Every call is idempotent (strategy §5.1). */
export type AdapterApi = {
  register(manifest: Manifest, mappers: Mappers): void;
  ingest(
    connection: Connection,
    datatype: Datatype,
    remoteId: string,
    raw: unknown,
    options?: { correlationId?: string },
  ): Promise<IngestResult>;
  notFound(connection: Connection, datatype: Datatype, remoteId: string): Promise<void>;
  presentIds(
    connection: Connection,
    datatype: Datatype,
    scope: { officeId: string | null },
    ids: string[],
  ): Promise<{ tombstoned: string[] }>;
  onLifecycle(handler: LifecycleHandler): void;
  /**
   * Record an adapter's own event. With a context it lands on that record's timeline and in the
   * chain the notification started (AC 16; question 9, approved 2026-09-18).
   */
  logEvent(type: string, fields: Record<string, unknown>, context?: EventContext): Promise<void>;
  healthCheck(name: string, check: () => Promise<HealthResult> | HealthResult): void;
  /** The connections this provider owns, so an adapter can resume its own work at startup. */
  connections(): Promise<Connection[]>;
  /** Report an unexpected error to the error tracker (Sentry once wired). Never pass credentials. */
  report(error: unknown, context?: Record<string, unknown>): void;
};

// ---- The admin panel (docs/admin-panel.md): an adapter describes what it shows as data ---------
//
// The panel is a browser app the engine serves; it draws every adapter's pages, directions and
// actions from these descriptions with the same components as its own pages, and never runs
// adapter code in the browser. Approved 2026-09-20 (register questions 57 and 61 with the rebuild).

/** A field the panel asks a person to fill: a connection's login, or an action's parameters. */
export type AdminField = {
  key: string;
  label: string;
  /** Typed hidden, stored encrypted, never shown back. */
  secret?: boolean;
  /** One line under the field. */
  help?: string;
  /** A fixed set of values instead of free text. */
  options?: { value: string; label?: string }[];
  required?: boolean;
};

/** A value the panel shows. A state colours it; a moment is an ISO time the panel formats. */
export type AdminValue =
  | string
  | number
  | boolean
  | null
  | { text: string; state: 'ok' | 'bad' | 'warn' | 'muted' }
  | { moment: string | null };

/** A button on a section or on a row: the panel hands `id` and `params` to the adapter's `act`. */
export type AdminAction = {
  id: string;
  label: string;
  /**
   * What the button does and when a person would press it, in one sentence the panel shows next
   * to it (Patric, 2026-09-21: a button nobody can explain is a button nobody should press).
   * Required in practice: the acceptance test refuses an action without it.
   */
  help?: string;
  /** Parameters the button carries, fixed. */
  params?: Record<string, string>;
  /** Parameters a person types first, asked in a dialog. */
  fields?: AdminField[];
  /** Asked before running, with this text. */
  confirm?: string;
  danger?: boolean;
};

/** One block of an adapter's page, or of its view under a connection. */
export type AdminSection = {
  title: string;
  /** One line on what the block shows or does. */
  help?: string;
  items?: { label: string; value: AdminValue }[];
  table?: {
    columns: string[];
    rows: { cells: AdminValue[]; actions?: AdminAction[] }[];
    /** Shown instead of an empty table. */
    empty?: string;
  };
  actions?: AdminAction[];
};

/** Setup directions: what a cold reader does, in order, and the settings as they are. */
export type AdminDirections = {
  steps: { title: string; text: string }[];
  settings: { key: string; value: AdminValue; help: string }[];
};

/** A record on an adapter's own fetch list, for the panel's live activity list. */
export type AdminQueued = {
  connectionId: string | null;
  officeId: string;
  datatype: Datatype;
  remoteId: string;
  queuedAt: string;
  reason: string;
  attempts: number;
  nextAt: string | null;
  lastError: string | null;
};

/** One record named for a fetch that writes nothing, or for a fetch again. */
export type AdminRecord = { datatype: Datatype; remoteId: string; officeId: string | null };

/** What an adapter shows and does in the admin panel. */
export type AdapterAdmin = {
  /** The login form of a connection; the values become one JSON document, never shown back. */
  credentials: AdminField[];
  /** The directions at the top of the adapter's page, built from what the adapter reads. */
  directions(): AdminDirections;
  /** The adapter's page: what it knows and can do, given its connections as the engine holds them. */
  panel(connections: Connection[]): Promise<AdminSection[]>;
  /** What the adapter knows about one connection, shown on its tenant's page. */
  connection?(connection: Connection): Promise<AdminSection[]>;
  /** Run an action a section declared. The message goes to the person who pressed it. */
  act(
    action: string,
    params: Record<string, string>,
    connections: Connection[],
  ): Promise<{ message: string }>;
  /** Try the CRM with a login before it is saved: yes or no, and why. */
  probe?(credentials: string, officeIds: string[]): Promise<{ ok: boolean; detail: string }>;
  /** Fetch one record and map it, writing nothing; null when the CRM has no such record. */
  inspect?(
    connection: Connection,
    record: AdminRecord,
  ): Promise<{ raw: unknown; mapped: MappedRecord | null } | null>;
  /** What waits on the adapter's own fetch list, oldest first. */
  queue?(connections: Connection[]): Promise<AdminQueued[]>;
};

/** What an adapter directory exports. */
export type Adapter = {
  manifest: Manifest;
  mappers: Mappers;
  /** Endpoints the entrypoint mounts. The engine never sees the requests. */
  routes?: Route[];
  /** What it shows and does in the admin panel, as data the panel draws. */
  admin?: AdapterAdmin;
  /** Sets up the adapter's own timers, loops and queues. */
  start(api: AdapterApi): Promise<void> | void;
  /** Called on shutdown, so timers stop cleanly. */
  stop?(): Promise<void> | void;
};
