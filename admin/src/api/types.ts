// The shapes the admin API answers with (engine/admin-api/). The app never guesses a field.

export type Session = {
  user: string;
  version: string;
  environment: string;
  maintenanceLogin: boolean;
};

export type EventRow = {
  id: string;
  at: string;
  type: string;
  correlation_id: string | null;
  tenant_id: number | null;
  connection_id: string | null;
  datatype: string | null;
  remote_id: string | null;
  subscriber_id: string | null;
  fields: Record<string, unknown>;
};

export type EventsPage = { events: EventRow[]; problems: string[]; next: number | null };

export type Check = { ok: boolean; detail?: string };
export type Health = { ok: boolean; checks: Record<string, Check> };

export type Hourly = { hours: string[]; series: Record<string, number[]> };

export type Dashboard = {
  hours: number;
  health: Health;
  figures: {
    live: number;
    tombstoned: number;
    written: number;
    unchanged: number;
    bells: number;
    bellsFailed: number;
    waiting: number;
    jobs: number;
  };
  sites: {
    active: number;
    fresh: number;
    waiting: { id: string; tenant_id: number; label: string; last_pull_at: string | null }[];
  };
  pulls: { pulls: number; p50: number; p95: number };
  charts: { records: Hourly; sites: Hourly };
  perDatatype: { datatype: string; live: number; tombstoned: number }[];
  perTenant: { tenant_id: number; datatype: string; live: number; tombstoned: number }[];
  other: { type: string; count: number }[];
  jobs: Job[];
  events: EventRow[];
  about: { environment: string; migrations: string[]; rulesVersion: string; schemaVersion: string };
};

export type Scope = {
  provider?: string;
  tenantId?: number;
  connectionId?: string;
  officeId?: string;
  datatype?: string;
  remoteId?: string;
  keys?: { connectionId: string; datatype: string; remoteId: string }[];
  staleRulesOnly?: boolean;
};

export type Report = {
  total: number;
  examined: number;
  changed: number;
  unchanged: number;
  failed: number;
  failures: { remoteId: string; datatype: string; connectionId: string; errors: string[] }[];
  examples: {
    remoteId: string;
    datatype: string;
    connectionId: string;
    changed: Record<string, { from: unknown; to: unknown }>;
  }[];
};

export type JobState = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

export type Job = {
  id: number;
  kind: 'recompute';
  scope: Scope;
  dry_run: boolean;
  state: JobState;
  progress: Partial<Report> & { updated_at?: string };
  result: Report | null;
  error: string | null;
  requested_by: string | null;
  cancel_requested: boolean;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export type AdminField = {
  key: string;
  label: string;
  secret?: boolean;
  help?: string;
  options?: { value: string; label?: string }[];
  required?: boolean;
};

export type AdminValue =
  | string
  | number
  | boolean
  | null
  | { text: string; state: 'ok' | 'bad' | 'warn' | 'muted' }
  | { moment: string | null };

export type AdminAction = {
  id: string;
  label: string;
  params?: Record<string, string>;
  fields?: AdminField[];
  confirm?: string;
  danger?: boolean;
};

export type AdminSection = {
  title: string;
  help?: string;
  items?: { label: string; value: AdminValue }[];
  table?: {
    columns: string[];
    rows: { cells: AdminValue[]; actions?: AdminAction[] }[];
    empty?: string;
  };
  actions?: AdminAction[];
};

export type AdminDirections = {
  steps: { title: string; text: string }[];
  settings: { key: string; value: AdminValue; help: string }[];
};

export type Provider = {
  provider: string;
  credentials: AdminField[];
  can: { probe: boolean; inspect: boolean; queue: boolean };
};

export type ProviderPage = {
  provider: string;
  credentials: AdminField[];
  directions: AdminDirections;
  sections: AdminSection[];
};

export type TenantListRow = {
  id: number;
  name: string;
  active: boolean;
  created_at: string;
  provider: string | null;
  offices: number;
  has_credentials: boolean;
  last_ingest_at: string | null;
  last_error: string | null;
  sites: number;
  records: number;
};

export type SiteView = {
  id: number;
  label: string;
  url: string;
  secret: string;
  active: boolean;
  last_bell_at: string | null;
  last_bell_status: string | null;
  last_pull_at: string | null;
  last_client: string | null;
  bell_answered_at: string | null;
};

export type LoadProgress = {
  startedAt: string;
  event: string;
  written: number;
  unchanged: number;
  dropped: number;
  removed: number;
};

export type ConnectionView = {
  id: string;
  provider: string;
  has_credentials: boolean;
  offices: string[];
  active: boolean;
  last_ingest_at: string | null;
  last_error: string | null;
  credentials: AdminField[];
  can: { probe: boolean; inspect: boolean };
  load: LoadProgress | null;
  sections: AdminSection[];
};

export type TenantView = {
  tenant: {
    id: number;
    name: string;
    active: boolean;
    token: string | null;
    created_at: string;
    purge_watermark: number;
  };
  connection: ConnectionView | null;
  sites: SiteView[];
  checklist: { first_pull_at: string | null; first_applied_at: string | null };
  records: { datatype: string; live: number; tombstoned: number }[];
  outcomes: { datatype: string; applied: number; failed: number }[];
  failures: {
    datatype: string;
    remote_id: string;
    at: string;
    detail: string | null;
    client: string | null;
  }[];
  errors: EventRow[];
  events: EventRow[];
};

export type TenantSaved = TenantView & { id: number; notes: string[] };

export type TenantInput = {
  name: string;
  active: boolean;
  connection: {
    provider: string;
    credentials: Record<string, string> | null;
    offices: string[];
    active: boolean;
  } | null;
  sites: { id?: number; label: string; url: string; active: boolean; removed?: boolean }[];
};

export type ItemRow = {
  tenant_id: number;
  connection_id: string;
  datatype: string;
  remote_id: string;
  office_id: string | null;
  seq: number;
  deleted: boolean;
  updated_at: string;
  remote_updated_at: string | null;
  tombstoned_at: string | null;
  rules_version: string;
  schema_version: string;
  content_hash: string;
  display: Record<string, unknown> | null;
};

export type ItemsPage = { rows: ItemRow[]; total: number; sortable: string[]; datatypes: string[] };

export type ItemFigures = {
  hours: number;
  live: number;
  tombstoned: number;
  written: number;
  removed: number;
  dropped: number;
  unchanged: number;
  applied: number;
  failed: number;
};

export type ActivityState = 'queued' | 'written' | 'applied' | 'error';

export type ActivityRow = {
  key: string;
  at: string;
  state: ActivityState;
  what: string;
  tenant_id: number | null;
  connection_id: string | null;
  datatype: string | null;
  remote_id: string | null;
  office_id: string | null;
  correlation_id: string | null;
  detail: string | null;
  seq?: number | null;
  attempts?: number;
  next_at?: string | null;
  error?: string | null;
  provider?: string;
  site: { result: string; at: string | null; client: string | null; detail: string | null } | null;
};

export type Activity = { rows: ActivityRow[]; queued: ActivityRow[] };

export type ItemDetail = {
  item: ItemRow;
  raw: unknown;
  unified: unknown;
  display: unknown;
  timeline: EventRow[];
};

export type Inspection = {
  raw: unknown;
  unified: unknown;
  display: unknown;
  officeId: string | null;
  remoteUpdatedAt: string | null;
};

export type Settings = {
  settings: { key: string; value: string | number; help: string }[];
  providers: Provider[];
  startOver: { id: number; name: string; active: boolean; watermark: number }[];
};

export type SearchResult = {
  tenants: { id: number; name: string; active: boolean }[];
  records: {
    tenant_id: number;
    connection_id: string;
    datatype: string;
    remote_id: string;
    deleted: boolean;
  }[];
};

export type TryChanges = {
  items: Record<string, unknown>[];
  next_after: number;
  has_more: boolean;
  bytes: number;
  gzipBytes: number;
};
