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
  tenantId: string;
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
  | { type: 'resync'; connection: Connection; datatype?: Datatype };

export type LifecycleHandler = (event: LifecycleEvent) => Promise<void> | void;

export type HealthResult = { ok: boolean; detail?: string };

/** One HTTP route an adapter mounts itself (strategy §5.1). The engine never inspects the body. */
export type Route = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Mounted under /v1/hook/<provider>/, e.g. "webhook" or "webhook/:connection". */
  path: string;
  handler: (request: RouteRequest) => Promise<RouteResponse> | RouteResponse;
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
  logEvent(type: string, fields: Record<string, unknown>): Promise<void>;
  healthCheck(name: string, check: () => Promise<HealthResult> | HealthResult): void;
  /** The connections this provider owns, so an adapter can resume its own work at startup. */
  connections(): Promise<Connection[]>;
};

/** What an adapter directory exports. */
export type Adapter = {
  manifest: Manifest;
  mappers: Mappers;
  /** Endpoints the entrypoint mounts. The engine never sees the requests. */
  routes?: Route[];
  /** Sets up the adapter's own timers, loops and queues. */
  start(api: AdapterApi): Promise<void> | void;
  /** Called on shutdown, so timers stop cleanly. */
  stop?(): Promise<void> | void;
};
