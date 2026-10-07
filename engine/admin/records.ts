// Records (§3 C): the search behind the grid, and everything one record's page shows. The grid's
// rows are small on purpose — a page of 500 records must not carry 500 CRM payloads — and the
// record's page carries the payload, the unified record, the prepared strings, the timeline and
// what each site of its tenant last said about it.
import { readItem, searchItems, type ItemRow, type ItemSearch } from '../storage/items.js';
import { connectionById, connections, subscribers } from '../storage/connections.js';
import { db } from '../storage/db.js';
import { queryEvents, type EventFields, type EventRow } from '../events.js';
import { namedFor, summarise, type Names } from './summary.js';
import { namesInTurn } from './feed.js';
import { currentConfig } from './auth.js';
import { crmName } from './words.js';
import { adminFor } from '../registry.js';
import { RULES_VERSION } from '../rules/run.js';
import { changedFields } from '../ingest.js';
import { TOMBSTONE_RETENTION_DAYS } from '../version.js';
import type { AdminRecord, Canonical, Datatype, MappedRecord } from '../adapter-api/types.js';

export type RecordRow = {
  tenantId: number;
  connectionId: string;
  /** The connection by the name a person gave it; its id is for addresses only. */
  connectionName: string;
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

/** A record by the name a person knows it by: its address, else its name. */
export const recordName = (data: Canonical | null): string | null =>
  displayLine(data) ?? read(data, 'name');

/** The connection a record came through, as the admin area names it. */
type Through = { provider: string; name: string };

export const toRow = (item: ItemRow, through: Through | undefined): RecordRow => ({
  tenantId: item.tenant_id,
  connectionId: item.connection_id,
  connectionName: through?.name ?? item.connection_id,
  provider: through?.provider ?? '',
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
  const through = new Map(everyConnection.map((row) => [row.id, row]));
  return { rows: rows.map((row) => toRow(row, through.get(row.connection_id))), total };
}

/**
 * One line of a record's timeline. It carries no payload on purpose (Patric, 2026-09-21): the
 * engine says in words what happened, so the page reads at a glance and the answer stays small.
 * The whole event, payload and all, is still in the log and on the Events page.
 */
export type TimelineEvent = {
  id: number;
  at: string;
  type: string;
  correlationId: string | null;
  /** What happened, in one sentence. */
  said: string;
  /** The site the event is about, by the name its tenant's page gives it. */
  site: { id: number; name: string } | null;
  /**
   * The record's place in the order of changes: the one a write gave it, or the one a site says
   * it took. A site's report carries no chain of its own, so the page joins it to the write by this.
   */
  seq: number | null;
};

const seqOf = (fields: EventFields): number | null => {
  const value = fields['seq'];
  return typeof value === 'number' ? value : null;
};

/** One step of the history, in the same sentence Flow and the event log give it, names and all. */
const toEvent = (event: EventRow, names: Names): TimelineEvent => {
  const named = namedFor(event, names);
  const siteId = event.subscriber_id === null ? null : Number(event.subscriber_id);
  return {
    id: Number(event.id),
    at: event.at.toISOString(),
    type: event.type,
    correlationId: event.correlation_id,
    said: summarise(event.type, event.fields, named),
    // A site since removed has no place to link to; its sentence says "a site".
    site: siteId === null || !named.site ? null : { id: siteId, name: named.site },
    seq: seqOf(event.fields),
  };
};

/**
 * What one site of the tenant last said about this record: the last time it took it, and the last
 * time it could not. Read from the sites' own reports, which the event log keeps for a while only.
 */
export type SiteReport = {
  id: number;
  name: string;
  took: { at: string; seq: number } | null;
  failed: { at: string; seq: number; detail: string | null } | null;
};

/** Each site's newest report of each kind on one record, in one bounded query. */
async function siteReports(
  tenantId: number,
  entity: { connectionId: string; datatype: Datatype; remoteId: string },
): Promise<SiteReport[]> {
  const [everySite, { rows }] = await Promise.all([
    subscribers(),
    db().query<{ subscriber_id: string; type: string; at: Date; fields: EventFields }>(
      `select distinct on (subscriber_id, type) subscriber_id, type, at, fields
       from events
       where connection_id = $1 and datatype = $2 and remote_id = $3
         and type in ('site.applied', 'site.failed') and subscriber_id is not null
       order by subscriber_id, type, id desc`,
      [entity.connectionId, entity.datatype, entity.remoteId],
    ),
  ]);
  return everySite
    .filter((site) => site.tenant_id === tenantId)
    .map((site) => {
      const report = (type: string) =>
        rows.find((row) => row.subscriber_id === site.id && row.type === type);
      const took = report('site.applied');
      const failed = report('site.failed');
      const detail = failed?.fields['detail'];
      return {
        id: Number(site.id),
        name: site.label,
        took: took ? { at: took.at.toISOString(), seq: seqOf(took.fields) ?? 0 } : null,
        failed: failed
          ? {
              at: failed.at.toISOString(),
              seq: seqOf(failed.fields) ?? 0,
              detail: typeof detail === 'string' && detail !== '' ? detail : null,
            }
          : null,
      };
    });
}

export type RecordView = {
  row: RecordRow;
  /** The CRM's payload, untouched. */
  raw: unknown;
  /** The unified record, `display` and all. */
  data: Canonical | null;
  /** The prepared strings on their own, so the page can show them side by side. */
  display: Record<string, unknown> | null;
  timeline: TimelineEvent[];
  /** Every site of the record's tenant, with what it last said about the record. */
  sites: SiteReport[];
  /** The rules Core runs today; the record's own `rulesVersion` says which made its texts. */
  rulesVersion: string;
  /** How many days the event log keeps, which is as far back as the timeline and reports reach. */
  keptDays: number;
  /** How many days Core keeps a removed record, so a page can say so. */
  removedKeptDays: number;
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
  const entity = { connectionId, datatype, remoteId };
  const [events, sites, names] = await Promise.all([
    queryEvents({ entity, newestFirst: true, limit: 200 }),
    siteReports(connection.tenantId, entity),
    namesInTurn(),
  ]);
  const display = item.data?.['display'];
  return {
    row: toRow(item, {
      provider: connection.provider,
      name: names.connections.get(connectionId)?.name ?? connectionId,
    }),
    raw: item.raw,
    data: item.data,
    display: display && typeof display === 'object' ? (display as Record<string, unknown>) : null,
    timeline: events.map((event) => toEvent(event, names)),
    sites,
    rulesVersion: RULES_VERSION,
    keptDays: currentConfig().eventRetentionDays,
    removedKeptDays: TOMBSTONE_RETENTION_DAYS,
  };
}

/** One field of the unified record whose value in the CRM's answer differs from Core's copy. */
export type Difference = { field: string; core: unknown; crm: unknown };

export type Inspection = {
  raw: unknown;
  mapped: MappedRecord | null;
  /**
   * The fields of the unified record that differ between the CRM's answer now and the copy Core
   * holds. The texts are left out: they follow the rules, and the question is what the CRM says.
   * Null when the answer cannot be mapped.
   */
  differs: Difference[] | null;
} | null;

/**
 * Ask the CRM for this record now and map it, writing nothing (§3 G, Must). Null when the CRM has
 * no such record; a refusal in words when the CRM cannot be asked.
 */
export async function inspect(
  connectionId: string,
  record: AdminRecord,
): Promise<{ inspection: Inspection } | { error: string }> {
  const connection = await connectionById(connectionId);
  if (!connection)
    return {
      error:
        'Core no longer holds the CRM connection this record came through, so it cannot ask the CRM about it.',
    };
  const admin = adminFor(connection.provider);
  if (!admin?.inspect) {
    return { error: `Core cannot ask ${crmName(connection.provider)} for one record.` };
  }
  const held = await readItem({ tenantId: connection.tenantId, connectionId, ...record });
  try {
    const answer = await admin.inspect(connection, {
      ...record,
      officeId: record.officeId ?? held?.office_id ?? null,
    });
    return { inspection: compared(answer, held?.data ?? null) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/** The CRM's answer with the fields that differ from Core's copy; null when it has no record. */
const compared = (
  answer: { raw: unknown; mapped: MappedRecord | null } | null,
  held: Canonical | null,
): Inspection =>
  answer === null
    ? null
    : { ...answer, differs: answer.mapped ? differences(held, answer.mapped) : null };

/** Core's copy without its texts, which the CRM's answer does not carry. */
const withoutTexts = (data: Canonical | null): Canonical | null => {
  if (!data) return null;
  const { display: _texts, ...unified } = data;
  return unified;
};

/** The CRM's answer, mapped, against Core's copy of the unified record, field by field. */
const differences = (held: Canonical | null, mapped: MappedRecord): Difference[] =>
  Object.entries(changedFields(withoutTexts(held), mapped.data)).map(([field, change]) => ({
    field,
    core: change.from,
    crm: change.to,
  }));
