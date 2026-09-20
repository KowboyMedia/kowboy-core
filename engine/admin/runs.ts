// Runs (§3 D): one scope, then a preview that writes nothing, then a job that does the work with
// progress and a cancel. Recompute and fetch-again take the same scope, so a person learns it
// once. The engine already recomputes any scope; this file is only the translation from what a
// person picked to what the engine and the adapters are asked to do.
import { recompute, type Progress, type Scope } from '../recompute.js';
import { cancelJob, createJob, getJob, listJobs, type JobRow } from '../jobs.js';
import { connections, connectionById } from '../storage/connections.js';
import { itemsForScope, purgeTombstones, type ItemKey } from '../storage/items.js';
import { queueLifecycle } from '../lifecycle.js';
import { deleteExpiredEvents } from '../events.js';
import { deleteExpiredSessions, currentConfig } from './auth.js';
import { TOMBSTONE_RETENTION_DAYS } from '../version.js';
import type { AdminRecord, Datatype } from '../adapter-api/types.js';

/** A scope as the page builds it. `records` is the grid's ticked rows. */
export type ScopeInput = {
  provider?: string;
  tenantId?: number;
  connectionId?: string;
  officeId?: string;
  datatype?: Datatype;
  remoteId?: string;
  records?: { connectionId: string; datatype: Datatype; remoteId: string }[];
  staleRulesOnly?: boolean;
};

/** The ticked rows as the engine's keys. A record's tenant comes from its connection. */
async function keysOf(records: NonNullable<ScopeInput['records']>): Promise<ItemKey[]> {
  const tenants = new Map<string, number>();
  const keys: ItemKey[] = [];
  for (const record of records) {
    if (!tenants.has(record.connectionId)) {
      const connection = await connectionById(record.connectionId);
      tenants.set(record.connectionId, connection?.tenantId ?? 0);
    }
    keys.push({
      tenantId: tenants.get(record.connectionId) ?? 0,
      connectionId: record.connectionId,
      datatype: record.datatype,
      remoteId: record.remoteId,
    });
  }
  return keys;
}

/** The fields a scope may narrow by, each left out when the person did not pick it. */
const NARROWED = [
  'provider',
  'tenantId',
  'connectionId',
  'officeId',
  'datatype',
  'remoteId',
] as const;

/** The scope in the engine's own terms. */
export async function toScope(input: ScopeInput): Promise<Scope> {
  const scope: Scope = {};
  for (const field of NARROWED) {
    const value = input[field];
    if (value !== undefined && value !== '') Object.assign(scope, { [field]: value });
  }
  if (input.staleRulesOnly) scope.staleRulesOnly = true;
  if (input.records && input.records.length > 0) scope.keys = await keysOf(input.records);
  return scope;
}

/** What a scope says, in the words the confirmation shows before anything runs. */
export function describe(input: ScopeInput): string {
  const parts: string[] = [];
  if (input.records && input.records.length > 0)
    parts.push(`${input.records.length} chosen record(s)`);
  if (input.remoteId) parts.push(`the record ${input.remoteId}`);
  if (input.datatype) parts.push(`the ${input.datatype} records`);
  if (input.officeId) parts.push(`the office ${input.officeId}`);
  if (input.connectionId) parts.push(`the connection ${input.connectionId}`);
  if (input.tenantId) parts.push(`tenant ${input.tenantId}`);
  if (input.provider) parts.push(`every ${input.provider} connection`);
  if (input.staleRulesOnly) parts.push('only records an older rules version made');
  return parts.length === 0 ? 'every record in Core' : parts.join(', ');
}

/** The impact preview (AC 36): everything examined, nothing written. */
export const preview = (scope: Scope): Promise<Progress> => recompute(scope, { dryRun: true });

/** A recompute as a job the worker takes, so a long run has progress, a cancel and a history. */
export const queueRecompute = (scope: Scope, by: string): Promise<number> =>
  createJob({ kind: 'recompute', scope, dryRun: false, requestedBy: by });

export type FetchAgain = { queued: number; detail: string };

/** Named records go to their adapters as one `refetch` each, with the office they were seen under. */
async function refetchRecords(records: NonNullable<ScopeInput['records']>): Promise<FetchAgain> {
  const byConnection = new Map<string, AdminRecord[]>();
  for (const record of records) {
    const stored = await itemsForScope({
      connectionId: record.connectionId,
      datatype: record.datatype,
      remoteId: record.remoteId,
    });
    const list = byConnection.get(record.connectionId) ?? [];
    list.push({
      datatype: record.datatype,
      remoteId: record.remoteId,
      officeId: stored[0]?.office_id ?? null,
    });
    byConnection.set(record.connectionId, list);
  }
  let queued = 0;
  for (const [connectionId, queuedRecords] of byConnection) {
    if (await queueLifecycle(connectionId, 'refetch', { records: queuedRecords })) {
      queued += queuedRecords.length;
    }
  }
  return { queued, detail: `${queued} record(s) will be fetched from the CRM again.` };
}

/**
 * Fetch the scope again from the CRM. Named records go to the adapters as a `refetch`; an office
 * is loaded as an office is loaded; anything wider is a `resync` of every connection in the scope.
 * The adapter decides how; the engine only says what.
 */
export async function fetchAgain(input: ScopeInput): Promise<FetchAgain> {
  if (input.records && input.records.length > 0) return refetchRecords(input.records);

  const wanted = (await connections()).filter(
    (row) =>
      (!input.connectionId || row.id === input.connectionId) &&
      (!input.tenantId || row.tenant_id === input.tenantId) &&
      (!input.provider || row.provider === input.provider) &&
      (!input.officeId || row.licensed_offices.includes(input.officeId)),
  );
  if (wanted.length === 0) return { queued: 0, detail: 'No connection matches that scope.' };

  let queued = 0;
  for (const connection of wanted) {
    const event = input.officeId
      ? await queueLifecycle(connection.id, 'offices_added', { officeIds: [input.officeId] })
      : await queueLifecycle(
          connection.id,
          'resync',
          input.datatype ? { datatype: input.datatype } : {},
        );
    if (event) queued += 1;
  }
  return {
    queued,
    detail: `${queued} connection(s) will load ${describe(input)} from the CRM again.`,
  };
}

export type Housekeeping = { events: number; tombstones: number; sessions: number };

/** What the worker does every hour, on demand (§3 D, Must). */
export async function housekeeping(): Promise<Housekeeping> {
  return {
    events: await deleteExpiredEvents(currentConfig().eventRetentionDays),
    tombstones: await purgeTombstones(TOMBSTONE_RETENTION_DAYS),
    sessions: await deleteExpiredSessions(),
  };
}

export { cancelJob, getJob, listJobs };
export type { JobRow };
