// Records (§3 C): the search behind the grid, and everything one record's page shows. The grid's
// rows are small on purpose — a page of 500 records must not carry 500 CRM payloads — and the
// record's page carries the payload, the unified record, the prepared strings and the timeline.
import { readItem, searchItems, type ItemRow, type ItemSearch } from '../storage/items.js';
import { connectionById, connections } from '../storage/connections.js';
import { queryEvents, type EventRow } from '../events.js';
import { adminFor } from '../registry.js';
import { recompute } from '../recompute.js';
import type { AdminRecord, Canonical, Datatype, MappedRecord } from '../adapter-api/types.js';

/** The columns the grid can show and sort by, in the order they appear by default. */
export const COLUMNS = [
  'tenant_id',
  'connection_id',
  'datatype',
  'remote_id',
  'office_id',
  'seq',
  'updated_at',
  'remote_updated_at',
  'deleted',
] as const;

export type RecordRow = {
  tenantId: number;
  connectionId: string;
  provider: string;
  datatype: Datatype;
  remoteId: string;
  officeId: string | null;
  seq: number;
  deleted: boolean;
  contentHash: string;
  updatedAt: string;
  remoteUpdatedAt: string | null;
  rulesVersion: string;
  schemaVersion: string;
  /** The record's own universal name, and the address line the ledger prepared; either may be absent. */
  name: string | null;
  addressLine: string | null;
};

const read = (data: Canonical | null, key: string): string | null => {
  const value = data?.[key];
  return typeof value === 'string' && value !== '' ? value : null;
};

const displayLine = (data: Canonical | null): string | null => {
  const display = data?.['display'];
  if (!display || typeof display !== 'object') return null;
  const line = (display as Record<string, unknown>)['address_line'];
  return typeof line === 'string' && line !== '' ? line : null;
};

export const toRow = (item: ItemRow, provider: string): RecordRow => ({
  tenantId: item.tenant_id,
  connectionId: item.connection_id,
  provider,
  datatype: item.datatype,
  remoteId: item.remote_id,
  officeId: item.office_id,
  seq: Number(item.seq),
  deleted: item.deleted,
  contentHash: item.content_hash,
  updatedAt: item.updated_at.toISOString(),
  remoteUpdatedAt: item.remote_updated_at?.toISOString() ?? null,
  rulesVersion: item.rules_version,
  schemaVersion: item.schema_version,
  name: read(item.data, 'name'),
  addressLine: displayLine(item.data),
});

/** One page of the grid, with the total behind it. */
export async function search(query: ItemSearch): Promise<{ rows: RecordRow[]; total: number }> {
  const [{ rows, total }, everyConnection] = await Promise.all([searchItems(query), connections()]);
  const providers = new Map(everyConnection.map((row) => [row.id, row.provider]));
  return { rows: rows.map((row) => toRow(row, providers.get(row.connection_id) ?? '')), total };
}

export type TimelineEvent = {
  id: number;
  at: string;
  type: string;
  correlationId: string | null;
  fields: Record<string, unknown>;
};

const toEvent = (event: EventRow): TimelineEvent => ({
  id: Number(event.id),
  at: event.at.toISOString(),
  type: event.type,
  correlationId: event.correlation_id,
  fields: event.fields,
});

export type RecordView = {
  row: RecordRow;
  /** The CRM's payload, untouched. */
  raw: unknown;
  /** The unified record, `display` and all. */
  data: Canonical | null;
  /** The prepared strings on their own, so the page can show them side by side. */
  display: Record<string, unknown> | null;
  timeline: TimelineEvent[];
};

export async function readRecord(
  connectionId: string,
  datatype: Datatype,
  remoteId: string,
): Promise<RecordView | null> {
  const connection = await connectionById(connectionId);
  if (!connection) return null;
  const item = await readItem({
    tenantId: connection.tenantId,
    connectionId,
    datatype,
    remoteId,
  });
  if (!item) return null;
  const events = await queryEvents({
    entity: { connectionId, datatype, remoteId },
    newestFirst: true,
    limit: 200,
  });
  const display = item.data?.['display'];
  return {
    row: toRow(item, connection.provider),
    raw: item.raw,
    data: item.data,
    display: display && typeof display === 'object' ? (display as Record<string, unknown>) : null,
    timeline: events.map(toEvent),
  };
}

/**
 * What a recompute would do to this one record, writing nothing (§3 C, Should). The same code
 * path as a release's impact preview, scoped to a record.
 */
export async function previewRecord(
  connectionId: string,
  datatype: Datatype,
  remoteId: string,
): Promise<Awaited<ReturnType<typeof recompute>>> {
  return recompute({ connectionId, datatype, remoteId }, { dryRun: true });
}

export type Inspection = { raw: unknown; mapped: MappedRecord | null } | null;

/**
 * Ask the CRM for this record now and map it, writing nothing (§3 G, Must). Null when the CRM has
 * no such record; a refusal when the adapter offers no such capability.
 */
export async function inspect(
  connectionId: string,
  record: AdminRecord,
): Promise<{ inspection: Inspection } | { error: string }> {
  const connection = await connectionById(connectionId);
  if (!connection) return { error: `There is no connection ${connectionId}.` };
  const admin = adminFor(connection.provider);
  if (!admin?.inspect) {
    return { error: `The ${connection.provider} adapter cannot look a record up on demand.` };
  }
  try {
    return { inspection: await admin.inspect(connection, record) };
  } catch (error) {
    return { error: String(error) };
  }
}
