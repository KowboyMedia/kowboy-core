// Records (docs/admin-panel.md): the figures, a search with server-side filters, sort and pages,
// the live activity list with what waits on the adapters' own lists, one record with its three
// faces and its timeline, and "fetch again" by any scope.
import { connectionById, connections, connectionsForProvider } from '../storage/connections.js';
import { readItem, searchItems, itemsForScope, SORTABLE, type ItemRow } from '../storage/items.js';
import { queryEvents } from '../events.js';
import { queueLifecycle } from '../lifecycle.js';
import { DATATYPES, type AdminQueued, type AdminRecord } from '../adapter-api/types.js';
import type { Scope } from '../recompute.js';
import { itemFigures, writePath, HOURS, type ActivityRow } from './stats.js';
import { scopeOf } from './jobs.js';
import {
  datatypeOf,
  HttpError,
  json,
  momentOf,
  numberOf,
  stringOf,
  type Ctx,
  type Route,
} from './context.js';

/** A record as a search lists it: everything but the three faces, plus its display strings. */
function rowView(item: ItemRow): Record<string, unknown> {
  const display = (item.data?.['display'] ?? null) as Record<string, unknown> | null;
  const { sections: _sections, ...strings } = display ?? {};
  return {
    tenant_id: item.tenant_id,
    connection_id: item.connection_id,
    datatype: item.datatype,
    remote_id: item.remote_id,
    office_id: item.office_id,
    seq: Number(item.seq),
    deleted: item.deleted,
    updated_at: item.updated_at,
    remote_updated_at: item.remote_updated_at,
    tombstoned_at: item.tombstoned_at,
    rules_version: item.rules_version,
    schema_version: item.schema_version,
    content_hash: item.content_hash,
    display: display ? strings : null,
  };
}

export type ActivityState = 'queued' | 'written' | 'applied' | 'error';

/** One row of the activity list, coloured by its state. */
function activityView(row: ActivityRow): Record<string, unknown> {
  const failed = row.type === 'entity.dropped' || row.site_type === 'site.failed';
  const state: ActivityState = failed
    ? 'error'
    : row.site_type === 'site.applied'
      ? 'applied'
      : 'written';
  return {
    key: `event/${row.id}`,
    at: row.at,
    state,
    what: row.type.replace('entity.', ''),
    tenant_id: row.tenant_id,
    connection_id: row.connection_id,
    datatype: row.datatype,
    remote_id: row.remote_id,
    office_id: row.office_id,
    correlation_id: row.correlation_id,
    detail:
      (row.fields['cause'] as string | undefined) ??
      (row.fields['reason'] as string | undefined) ??
      null,
    seq: (row.fields['seq'] as number | undefined) ?? null,
    site: row.site_type
      ? {
          result: row.site_type.replace('site.', ''),
          at: row.site_at,
          client: (row.site_fields?.['client'] as string | undefined) ?? null,
          detail: (row.site_fields?.['detail'] as string | undefined) ?? null,
        }
      : null,
  };
}

const queuedView = (entry: AdminQueued, provider: string): Record<string, unknown> => ({
  key: `queued/${provider}/${entry.officeId}/${entry.datatype}/${entry.remoteId}`,
  at: entry.queuedAt,
  state: entry.lastError ? 'error' : 'queued',
  what: entry.attempts > 0 ? 'retrying' : 'queued',
  tenant_id: null,
  connection_id: entry.connectionId,
  datatype: entry.datatype,
  remote_id: entry.remoteId,
  office_id: entry.officeId,
  correlation_id: null,
  detail: entry.reason,
  attempts: entry.attempts,
  next_at: entry.nextAt,
  error: entry.lastError,
  provider,
  site: null,
});

/** What waits on every adapter's own list, oldest first. */
async function queued(ctx: Ctx): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (const adapter of ctx.adapters) {
    if (!adapter.admin?.queue) continue;
    const entries = await adapter.admin.queue(await connectionsForProvider(adapter.provider));
    for (const entry of entries) rows.push(queuedView(entry, adapter.provider));
  }
  return rows;
}

type Queued = { connectionId: string; event: string; records?: number };

/** Records named outright, stored or not: a listing that is new at the CRM, say. */
async function refetchNamed(scope: Scope, given: unknown[]): Promise<Queued[]> {
  if (!scope.connectionId) throw new HttpError(400, 'named records need a connectionId');
  const records: AdminRecord[] = [];
  for (const item of given as Record<string, unknown>[]) {
    const datatype = datatypeOf(item['datatype']);
    const remoteId = stringOf(item['remoteId']);
    if (!datatype || !remoteId)
      throw new HttpError(400, 'every record needs a datatype and a remoteId');
    records.push({ datatype, remoteId, officeId: stringOf(item['officeId']) ?? null });
  }
  if (records.length === 0) throw new HttpError(400, 'no records named');
  if ((await queueLifecycle(scope.connectionId, 'refetch', { records })) === null) {
    throw new HttpError(404, 'no such connection');
  }
  return [{ connectionId: scope.connectionId, event: 'refetch', records: records.length }];
}

/** Stored records, by their keys or one id: a refetch per connection they belong to. */
async function refetchStored(scope: Scope): Promise<Queued[]> {
  const items = await itemsForScope(scope);
  if (items.length === 0) throw new HttpError(404, 'no live record matches');
  const byConnection = new Map<string, AdminRecord[]>();
  for (const item of items) {
    const records = byConnection.get(item.connection_id) ?? [];
    records.push({ datatype: item.datatype, remoteId: item.remote_id, officeId: item.office_id });
    byConnection.set(item.connection_id, records);
  }
  const queued: Queued[] = [];
  for (const [connectionId, records] of byConnection) {
    await queueLifecycle(connectionId, 'refetch', { records });
    queued.push({ connectionId, event: 'refetch', records: records.length });
  }
  return queued;
}

/** Anything wider: every active connection in the scope lists its records again, or one office of them. */
async function refetchWide(scope: Scope): Promise<Queued[]> {
  const rows = (await connections()).filter(
    (row) =>
      row.active &&
      (!scope.provider || row.provider === scope.provider) &&
      (!scope.tenantId || row.tenant_id === scope.tenantId) &&
      (!scope.connectionId || row.id === scope.connectionId) &&
      (!scope.officeId || row.licensed_offices.includes(scope.officeId)),
  );
  if (rows.length === 0) throw new HttpError(404, 'no active connection matches');
  const queued: Queued[] = [];
  for (const row of rows) {
    const event = scope.officeId ? 'offices_added' : 'resync';
    await queueLifecycle(
      row.id,
      event,
      scope.officeId ? { officeIds: [scope.officeId] } : { datatype: scope.datatype },
    );
    queued.push({ connectionId: row.id, event });
  }
  return queued;
}

/** "Fetch again" for a scope: named records go to their adapter as a refetch; anything wider is a resync of every connection in it. */
async function refetch(ctx: Ctx): Promise<Record<string, unknown>> {
  const body = ctx.body<{ scope?: unknown; records?: unknown }>();
  const scope = scopeOf(body.scope);
  const queued = Array.isArray(body.records)
    ? await refetchNamed(scope, body.records)
    : scope.keys || scope.remoteId
      ? await refetchStored(scope)
      : await refetchWide(scope);
  await ctx.audit(
    'refetch',
    { scope, queued },
    {
      tenantId: scope.tenantId ?? null,
      connectionId: scope.connectionId ?? null,
    },
  );
  return { queued };
}

export const itemRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/v1\/admin\/items$/,
    handle: async (ctx) => {
      const q = ctx.request.query;
      const value = (name: string): string | undefined => stringOf(q.get(name));
      const sort = SORTABLE.find((column) => column === value('sort'));
      const { rows, total } = await searchItems({
        tenantId: numberOf(q.get('tenant')),
        provider: value('provider'),
        connectionId: value('connection'),
        datatype: datatypeOf(value('datatype')),
        officeId: value('office'),
        remoteId: value('id'),
        text: value('q'),
        writtenFrom: momentOf(value('from')),
        writtenTo: momentOf(value('to')),
        deleted: value('removed') === 'yes' ? true : value('removed') === 'no' ? false : undefined,
        sort,
        dir: value('dir') === 'asc' ? 'asc' : 'desc',
        page: numberOf(q.get('page')),
        size: numberOf(q.get('size')),
      });
      return json({ rows: rows.map(rowView), total, sortable: SORTABLE, datatypes: DATATYPES });
    },
  },
  {
    method: 'GET',
    pattern: /^\/v1\/admin\/items\/figures$/,
    handle: async () => json({ hours: HOURS, ...(await itemFigures()) }),
  },
  {
    method: 'GET',
    pattern: /^\/v1\/admin\/items\/activity$/,
    handle: async (ctx) => {
      const [rows, waiting] = await Promise.all([writePath(100), queued(ctx)]);
      return json({ rows: rows.map(activityView), queued: waiting });
    },
  },
  {
    method: 'POST',
    pattern: /^\/v1\/admin\/refetch$/,
    handle: async (ctx) => json(await refetch(ctx), 202),
  },
  {
    method: 'GET',
    pattern: /^\/v1\/admin\/items\/([^/]+)\/([^/]+)\/([^/]+)$/,
    handle: async (ctx) => {
      const [connectionId = '', datatypeGiven = '', remoteId = ''] = ctx.params;
      const datatype = datatypeOf(datatypeGiven);
      const connection = await connectionById(connectionId);
      if (!datatype || !connection) throw new HttpError(404, 'no such record');
      const item = await readItem({
        tenantId: connection.tenantId,
        connectionId,
        datatype,
        remoteId,
      });
      if (!item) throw new HttpError(404, 'no such record');
      const timeline = await queryEvents({
        entity: { connectionId, datatype, remoteId },
        limit: 500,
        newestFirst: true,
      });
      const { display: _display, ...unified } = item.data ?? {};
      return json({
        item: rowView(item),
        raw: item.raw,
        unified: item.data ? unified : null,
        display: item.data?.['display'] ?? null,
        timeline,
      });
    },
  },
];
