// Runs: a scope, then what to do with it. The engine already recomputes any scope and the
// adapters fetch what they are told to; this file is only the translation from what a person
// picked to what the engine and the adapters are asked to do. Recompute and fetch again take the
// same scope, so a person learns it once.
import { recompute, type Progress, type Scope as RecomputeScope } from '../recompute.js';
import { cancelJob, createJob, getJob, listJobs, type JobRow } from '../jobs.js';
import { connections, connectionById } from '../storage/connections.js';
import { itemsForScope, renumber, type ItemKey, type ItemRow } from '../storage/items.js';
import { queueLifecycle } from '../lifecycle.js';
import { ring } from '../bells.js';
import { describeScope, type Scope } from './scope.js';
import type { AdminRecord, Datatype } from '../adapter-api/types.js';

/**
 * A scope as a page sends it: the shared scope (tenants, offices, entity types, one id), or one
 * record's own connection, or a list of records as a record's page names itself. The single
 * `tenantId`, `officeId`, `datatype` and `staleRulesOnly` are what the Manual sync page being
 * replaced sends; they go with it.
 */
export type ScopeInput = Scope & {
  tenantId?: number;
  connectionId?: string;
  officeId?: string;
  datatype?: Datatype;
  records?: { connectionId: string; datatype: Datatype; remoteId: string }[];
  staleRulesOnly?: boolean;
};

/** The named records as the engine's keys. A record's tenant comes from its connection. */
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
  'tenantIds',
  'officeIds',
  'datatypes',
  'tenantId',
  'connectionId',
  'officeId',
  'datatype',
  'remoteId',
] as const;

/** The scope in the engine's own terms. */
export async function toScope(input: ScopeInput): Promise<RecomputeScope> {
  const scope: RecomputeScope = {};
  for (const field of NARROWED) {
    const value = input[field];
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0))
      continue;
    Object.assign(scope, { [field]: value });
  }
  if (input.staleRulesOnly) scope.staleRulesOnly = true;
  if (input.records && input.records.length > 0) scope.keys = await keysOf(input.records);
  return scope;
}

/** What a scope says, in the words the confirmation shows before anything runs. */
export function describe(input: ScopeInput): string {
  const parts: string[] = [];
  if (input.records && input.records.length > 0)
    parts.push(`${String(input.records.length)} chosen record(s)`);
  if (input.connectionId) parts.push(`the connection ${input.connectionId}`);
  if (input.datatype) parts.push(`the ${input.datatype} records`);
  if (input.officeId) parts.push(`the office ${input.officeId}`);
  if (input.tenantId) parts.push(`tenant ${String(input.tenantId)}`);
  if (input.staleRulesOnly) parts.push('only records an older rules version made');
  const shared = describeScope(input);
  if (shared !== 'every record in Core') parts.push(shared);
  return parts.length === 0 ? 'every record in Core' : parts.join(', ');
}

/** The impact preview (AC 36): everything examined, nothing written. */
export const preview = (scope: RecomputeScope): Promise<Progress> =>
  recompute(scope, { dryRun: true });

/** A recompute as a job the worker takes, so a long run has progress, a cancel and a history. */
export const queueRecompute = (scope: RecomputeScope, by: string): Promise<number> =>
  createJob({ kind: 'recompute', scope, dryRun: false, requestedBy: by });

export type FetchAgain = { queued: number; detail: string };

/** One or several of a thing: the page sends lists, a record's own page and the old page one. */
const many = <T>(list: T[] | undefined, one: T | undefined): T[] =>
  list && list.length > 0 ? list : one === undefined ? [] : [one];

/** Stored records go to their adapters as one `refetch` per connection, with their offices. */
async function refetch(items: ItemRow[]): Promise<FetchAgain> {
  const byConnection = new Map<string, AdminRecord[]>();
  for (const item of items) {
    const list = byConnection.get(item.connection_id) ?? [];
    list.push({ datatype: item.datatype, remoteId: item.remote_id, officeId: item.office_id });
    byConnection.set(item.connection_id, list);
  }
  let queued = 0;
  for (const [connectionId, records] of byConnection) {
    if (await queueLifecycle(connectionId, 'refetch', { records })) queued += records.length;
  }
  return { queued, detail: `${String(queued)} record(s) will be fetched from the CRM again.` };
}

/**
 * Fetch the scope again from the CRM. Named records, one record id or offices are lists of the
 * records Core holds, and go to the adapters as a `refetch`; tenants and entity types alone are a
 * `resync` of every connection in the scope, one per entity type when types are named. The
 * adapter decides how; the engine only says what.
 */
export async function fetchAgain(input: ScopeInput): Promise<FetchAgain> {
  if (input.records && input.records.length > 0) {
    return refetch(await itemsForScope({ keys: await keysOf(input.records) }));
  }
  if (input.remoteId || many(input.officeIds, input.officeId).length > 0) {
    return refetch(await itemsForScope(await toScope(input)));
  }
  const tenantIds = many(input.tenantIds, input.tenantId);
  const wanted = (await connections()).filter(
    (row) =>
      (!input.connectionId || row.id === input.connectionId) &&
      (tenantIds.length === 0 || tenantIds.includes(row.tenant_id)),
  );
  if (wanted.length === 0) return { queued: 0, detail: 'No connection matches that scope.' };
  const datatypes = many(input.datatypes, input.datatype);
  let queued = 0;
  for (const connection of wanted) {
    for (const datatype of datatypes.length > 0 ? datatypes : [undefined]) {
      if (await queueLifecycle(connection.id, 'resync', datatype ? { datatype } : {})) queued += 1;
    }
  }
  return {
    queued,
    detail: `${String(queued)} connection(s) will load ${describe(input)} from the CRM again.`,
  };
}

/** Send the scope to the sites again: new places for its records, then a ring for each tenant. */
export async function send(input: ScopeInput): Promise<{ records: number; detail: string }> {
  const moved = await renumber(await toScope(input));
  for (const tenantId of moved.tenantIds) await ring(tenantId, 'delta');
  return {
    records: moved.records,
    detail: `${String(moved.records)} record(s) go to the sites of ${String(moved.tenantIds.length)} tenant(s) again.`,
  };
}

/** How far a manual sync goes: each level does its own step and every step after it. */
export const LEVELS = ['fetch', 'recompute', 'send'] as const;
export type Level = (typeof LEVELS)[number];

/**
 * Manual sync (Patric, 2026-10-06): fetch from the CRM, recompute and send to the sites; or
 * recompute and send; or send only. The fetch and the recompute run in the background, and what
 * either changes is sent as it is written; the send gives the sites the whole scope at once.
 */
export async function sync(level: Level, input: ScopeInput, by: string): Promise<string> {
  const said: string[] = [];
  if (level === 'fetch') said.push((await fetchAgain(input)).detail);
  if (level !== 'send') {
    await queueRecompute(await toScope(input), by);
    said.push('The recompute runs in the background.');
  }
  said.push((await send(input)).detail);
  return said.join(' ');
}

export { cancelJob, getJob, listJobs };
export type { JobRow };
