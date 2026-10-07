// Runs: a scope, then what to do with it. The engine already recomputes any scope and the
// adapters fetch what they are told to; this file is only the translation from what a person
// picked to what the engine and the adapters are asked to do. Recompute and fetch again take the
// same scope, so a person learns it once.
import type { Scope as RecomputeScope } from '../recompute.js';
import { createJob } from '../jobs.js';
import { connections, connectionById, subscribers } from '../storage/connections.js';
import { itemsForScope, renumber, type ItemKey, type ItemRow } from '../storage/items.js';
import { queueLifecycle } from '../lifecycle.js';
import { ring } from '../bells.js';
import { describeScope, tenantNamesOf, type Scope } from './scope.js';
import { recordName } from './records.js';
import type { AuditContext } from './audit.js';
import { counted, entity, listed } from './words.js';
import { DATATYPES, type AdminRecord, type Datatype } from '../adapter-api/types.js';

/**
 * A scope as a page sends it: the shared scope (tenants, offices, entity types, one id), or a list
 * of records, as a record's page names itself.
 */
export type ScopeInput = Scope & {
  records?: { connectionId: string; datatype: Datatype; remoteId: string }[];
};

/** At most this many named records in one run; a larger set is a scope. */
const MOST_RECORDS = 500;

/**
 * The records a run's body names (`records: [{ connectionId, datatype, remoteId }]`), as a
 * record's page sends itself. A slip is a refusal in words, never a database error.
 */
export function recordsFromBody(
  given: unknown,
): { records: NonNullable<ScopeInput['records']> } | { error: string } {
  if (!Array.isArray(given) || given.length === 0 || given.length > MOST_RECORDS)
    return { error: `“records” must list from 1 to ${String(MOST_RECORDS)} records.` };
  const records: NonNullable<ScopeInput['records']> = [];
  for (const one of given as unknown[]) {
    const record = (one ?? {}) as Record<string, unknown>;
    const datatype = DATATYPES.find((known) => known === record['datatype']);
    const { connectionId, remoteId } = record;
    if (typeof connectionId !== 'string' || connectionId === '' || !datatype)
      return {
        error: 'Each record needs the CRM connection it came through and a known entity type.',
      };
    if (typeof remoteId !== 'string' || remoteId === '')
      return { error: 'Each record needs the CRM’s id for it.' };
    records.push({ connectionId, datatype, remoteId });
  }
  return { records };
}

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
const NARROWED = ['tenantIds', 'officeIds', 'datatypes', 'remoteId'] as const;

/** The scope in the engine's own terms. */
async function toScope(input: ScopeInput): Promise<RecomputeScope> {
  const scope: RecomputeScope = {};
  for (const field of NARROWED) {
    const value = input[field];
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0))
      continue;
    Object.assign(scope, { [field]: value });
  }
  if (input.records && input.records.length > 0) scope.keys = await keysOf(input.records);
  return scope;
}

/** What a scope says, in words, for the audit event: one record by its name, else the scope. */
export async function describe(input: ScopeInput): Promise<string> {
  const records = input.records ?? [];
  const only = records.length === 1 ? records[0] : undefined;
  if (only) {
    const [item] = await itemsForScope({ keys: await keysOf([only]) });
    const name = recordName(item?.data ?? null);
    return name
      ? `the ${entity(only.datatype)} ${name}`
      : `the ${entity(only.datatype)} with the CRM’s id ${only.remoteId}`;
  }
  if (records.length > 0)
    return counted(records.length, 'record picked by name', 'records picked by name');
  return describeScope(input);
}

/** A recompute as a job the worker takes, so a long run has progress and a history. */
const queueRecompute = (scope: RecomputeScope, by: string): Promise<number> =>
  createJob({ kind: 'recompute', scope, dryRun: false, requestedBy: by });

export type FetchAgain = { queued: number; detail: string };

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
  return {
    queued,
    detail:
      queued === 0
        ? 'Core holds no record among those picked, so the CRM is not asked.'
        : `Core asks the CRM for ${counted(queued, 'record', 'records')} again.`,
  };
}

/** The tenants' names, for a sentence: "Acme and Bravo", or how many when there are more. */
async function tenantNames(ids: number[]): Promise<string> {
  const names = await tenantNamesOf(ids);
  return listed(ids.map((id) => names.get(id) ?? 'a tenant since removed'));
}

/**
 * Fetch the scope again from the CRM. Named records, one record id or offices are lists of the
 * records Core holds, and go to the adapters as a `refetch`; tenants and entity types alone are a
 * `resync` of every connection in the scope, one per entity type when types are named. The
 * adapter decides how; the engine only says what.
 */
async function fetchAgain(input: ScopeInput): Promise<FetchAgain> {
  if (input.records && input.records.length > 0) {
    return refetch(await itemsForScope({ keys: await keysOf(input.records) }));
  }
  if (input.remoteId || (input.officeIds ?? []).length > 0) {
    return refetch(await itemsForScope(await toScope(input)));
  }
  return resync(input.tenantIds ?? [], input.datatypes ?? []);
}

/** Every connection of the tenants (all when none is named) lists again, one entity type at a time. */
async function resync(tenantIds: number[], datatypes: Datatype[]): Promise<FetchAgain> {
  const wanted = (await connections()).filter(
    (row) => tenantIds.length === 0 || tenantIds.includes(row.tenant_id),
  );
  if (wanted.length === 0)
    return {
      queued: 0,
      detail: 'No CRM connection belongs to the tenants picked, so the CRM is not asked.',
    };
  let queued = 0;
  const loading = new Set<string>();
  for (const connection of wanted) {
    for (const datatype of datatypes.length > 0 ? datatypes : [undefined]) {
      if (await queueLifecycle(connection.id, 'resync', datatype ? { datatype } : {})) {
        queued += 1;
        loading.add(connection.id);
      }
    }
  }
  const what =
    datatypes.length > 0
      ? `the ${listed(datatypes.map((datatype) => entity(datatype, true)))}`
      : 'every record';
  const of = [...new Set(wanted.map((row) => Number(row.tenant_id)))];
  return {
    queued,
    detail: `Core fetches ${what} of ${await tenantNames(of)} from the CRM again, through ${counted(loading.size, 'CRM connection', 'CRM connections')}.`,
  };
}

/** Send the scope to the sites again: new places for its records, then a ring for each tenant. */
export async function send(input: ScopeInput): Promise<{ records: number; detail: string }> {
  const moved = await renumber(await toScope(input));
  for (const tenantId of moved.tenantIds) await ring(tenantId, 'delta');
  return { records: moved.records, detail: await sent(moved) };
}

/** What a send did, in words: how many records went to whose sites, or why none did. */
async function sent(moved: { records: number; tenantIds: number[] }): Promise<string> {
  if (moved.records === 0)
    return 'Core holds no live record among those picked, so no site was sent anything.';
  const names = await tenantNames(moved.tenantIds);
  const withSites = new Set((await subscribers()).map((site) => Number(site.tenant_id)));
  if (!moved.tenantIds.some((tenantId) => withSites.has(tenantId)))
    return moved.tenantIds.length === 1
      ? `${names} has no site yet, so no site was sent anything.`
      : `None of ${names} has a site yet, so no site was sent anything.`;
  return `Core sent ${counted(moved.records, 'record', 'records')} to the sites of ${names} again, and told them to fetch ${moved.records === 1 ? 'it' : 'them'}.`;
}

/** Where a run goes in the event log: on its record when it names one record. */
export async function auditedOn(input: ScopeInput): Promise<AuditContext> {
  const only = input.records?.length === 1 ? input.records[0] : undefined;
  if (!only) return {};
  const connection = await connectionById(only.connectionId);
  return {
    tenantId: connection?.tenantId ?? null,
    connectionId: only.connectionId,
    datatype: only.datatype,
    remoteId: only.remoteId,
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
    said.push(
      input.records?.length === 1
        ? 'Core recomputes it in the background.'
        : 'Core recomputes them in the background.',
    );
  }
  said.push((await send(input)).detail);
  return said.join(' ');
}
