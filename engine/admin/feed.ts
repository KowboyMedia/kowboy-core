// The Flow list and the live stream (docs/admin-panel.md). Flow is one list of the records in
// flight, in the state each reached last, the whole row coloured by state (Patric's rule 3, and
// 2026-10-06: filters on tenant and office, sorted by when each was queued, the top 100, updated
// every second); its rows are the engine's write path read from the event log, plus what each
// adapter reports waiting on its own fetch list. The stream is one server-sent connection that
// every live page listens to, so a browser holds one connection and not six.
import type { ServerResponse } from 'node:http';
import { db } from '../storage/db.js';
import { latestEventId, queryEvents, type EventFields, type EventRow } from '../events.js';
import { connections, connectionsForProvider, tenants } from '../storage/connections.js';
import { itemKey } from '../storage/items.js';
import { adminFor, adminProviders } from '../registry.js';
import { openJobs } from '../jobs.js';
import { healthReport } from '../health.js';
import { report } from '../errors.js';
import { summarise } from './summary.js';
import { counted, sentence } from './words.js';
import type { Scope } from './scope.js';
import type { AdminQueued } from '../adapter-api/types.js';
import type { Response } from '../http/server.js';

/** The four states of Patric's rule 3, and the only ones a row can be in. */
export type FlowState = 'queued' | 'fetched' | 'applied' | 'error';

export type FlowRow = {
  key: string;
  state: FlowState;
  tenantId: number | null;
  tenant: string | null;
  connectionId: string | null;
  officeId: string | null;
  datatype: string | null;
  remoteId: string | null;
  /** The record's address or name, as Records shows it; null before Core holds the record. */
  name: string | null;
  queuedAt: string;
  what: string;
  attempt: number | null;
  site: string | null;
};

/** Which state each engine event puts a record in. What it says comes from summary.ts. */
const FROM_EVENT: Record<string, FlowState> = {
  'entity.written': 'fetched',
  'entity.unchanged': 'fetched',
  'entity.tombstoned': 'fetched',
  'entity.dropped': 'error',
  'site.applied': 'applied',
  'site.failed': 'error',
};

/**
 * How far back, and how many of the newest events in the scope, the rows are read from; a
 * record's newest one wins. Both bounds keep the read Flow repeats every second cheap whatever
 * the scope: the day bounds a narrow scope, the count a busy one.
 */
const RECENT = { window: '1 day', events: 1000 } as const;

const keyOf = (row: {
  connectionId: string | null;
  datatype: string | null;
  remoteId: string | null;
}): string =>
  itemKey({
    connectionId: row.connectionId ?? '',
    datatype: row.datatype ?? '',
    remoteId: row.remoteId ?? '',
  });

/** Whether a value is one of those chosen; nothing chosen means every value. */
const within = <T>(chosen: readonly T[] | undefined, value: T | null): boolean =>
  !chosen?.length || (value !== null && chosen.includes(value));

/**
 * What waits on each adapter's own fetch list, as the adapters report it, for the connections of
 * the tenants in scope only: an adapter's answer is bounded, so a busy tenant must not crowd the
 * scoped tenant's records out of it.
 */
async function fromAdapters(scope: Scope): Promise<AdminQueued[]> {
  const queued: AdminQueued[] = [];
  for (const provider of adminProviders()) {
    const admin = adminFor(provider);
    if (!admin?.queue) continue;
    const asked = (await connectionsForProvider(provider)).filter((connection) =>
      within(scope.tenantIds, connection.tenantId),
    );
    if (asked.length === 0) continue;
    try {
      queued.push(...(await admin.queue(asked)));
    } catch (error) {
      report(error, { where: 'admin.queue', provider });
    }
  }
  return queued;
}

/** Whether a record waiting on an adapter is inside the scope. */
const inScope = (
  scope: Scope,
  row: Pick<FlowRow, 'tenantId' | 'officeId' | 'datatype' | 'remoteId'>,
): boolean =>
  within(scope.tenantIds, row.tenantId) &&
  within(scope.officeIds, row.officeId) &&
  within<string>(scope.datatypes, row.datatype) &&
  within(scope.remoteId ? [scope.remoteId] : undefined, row.remoteId);

/** One row for a record waiting on a CRM, as the adapter reports it. */
const waitingRow = (entry: AdminQueued, tenant: { id: number; name: string } | null): FlowRow => ({
  key: keyOf(entry),
  state: entry.lastError !== null || entry.nextAt === null ? 'error' : 'queued',
  tenantId: tenant?.id ?? null,
  tenant: tenant?.name ?? null,
  connectionId: entry.connectionId,
  officeId: entry.officeId,
  datatype: entry.datatype,
  remoteId: entry.remoteId,
  name: null,
  queuedAt: entry.queuedAt,
  what: waiting(entry),
  attempt: entry.attempts,
  site: null,
});

/**
 * Why a record waits on its CRM, in a sentence: the adapter says why, the engine what follows. Not
 * every wait is a fetch: a record the CRM no longer lists waits its turn to leave the sites.
 */
function waiting(entry: AdminQueued): string {
  const tries = counted(entry.attempts, 'try', 'tries');
  const why = `It waits because ${entry.reason}.`;
  if (entry.nextAt === null)
    return entry.lastError === null
      ? `Core stopped trying after ${tries}. ${why}`
      : `Core stopped trying after ${tries}. The last try failed: ${sentence(entry.lastError)} ${why}`;
  if (entry.lastError !== null)
    return `The last try failed, and Core tries again: ${sentence(entry.lastError)} ${why}`;
  return `Waiting its turn. ${why}`;
}

type MovedRow = {
  id: string;
  at: Date;
  type: string;
  fields: EventFields;
  tenant_id: number | null;
  tenant: string | null;
  connection_id: string | null;
  datatype: string | null;
  remote_id: string | null;
  office_id: string | null;
  name: string | null;
};

/** One row for a record that has moved, from the event that moved it. */
const movedRow = (event: MovedRow): FlowRow => ({
  key: keyOf({
    connectionId: event.connection_id,
    datatype: event.datatype,
    remoteId: event.remote_id,
  }),
  state: FROM_EVENT[event.type] ?? 'fetched',
  tenantId: event.tenant_id,
  tenant: event.tenant,
  connectionId: event.connection_id,
  // The office is on the record, never on the event, so the query reads it from the record
  // itself, which is also what makes two tenants holding the same office plain to read.
  officeId: event.office_id,
  datatype: event.datatype,
  remoteId: event.remote_id,
  name: event.name,
  queuedAt: event.at.toISOString(),
  what: summarise(event.type, event.fields),
  attempt: null,
  site: typeof event.fields['client'] === 'string' ? event.fields['client'] : null,
});

/**
 * The newest event per record among the newest events of the write path inside the scope, with
 * the record's office, the `limit` records that moved last, each named as Records names it. The
 * scan runs backwards over the time index and stops at the day's start or at the count, whichever
 * comes first; only the rows shown read the record's name.
 */
async function moved(scope: Scope, limit: number): Promise<MovedRow[]> {
  const { rows } = await db().query<MovedRow>(
    `with recent as (
       select e.id, e.at, e.type, e.fields, e.tenant_id, e.connection_id, e.datatype,
              e.remote_id, i.office_id
       from events e
       left join items i on i.tenant_id = e.tenant_id and i.connection_id = e.connection_id
                        and i.datatype = e.datatype and i.remote_id = e.remote_id
       where e.at > now() - $7::interval
         and e.type = any($1::text[]) and e.remote_id is not null
         and ($2::int[] is null or e.tenant_id = any($2::int[]))
         and ($3::text[] is null or i.office_id = any($3::text[]))
         and ($4::text[] is null or e.datatype = any($4::text[]))
         and ($5::text is null or e.remote_id = $5)
       order by e.at desc
       limit $6),
     newest as (
       select distinct on (r.connection_id, r.datatype, r.remote_id) r.*
       from recent r
       order by r.connection_id, r.datatype, r.remote_id, r.id desc),
     top as (select n.* from newest n order by n.at desc limit $8)
     select top.*, t.display_name as tenant,
            coalesce(i.data->'display'->>'address_line', i.data->>'name') as name
     from top
     left join tenants t on t.id = top.tenant_id
     left join items i on i.tenant_id = top.tenant_id and i.connection_id = top.connection_id
                      and i.datatype = top.datatype and i.remote_id = top.remote_id
     order by top.at desc`,
    [
      Object.keys(FROM_EVENT),
      scope.tenantIds?.length ? scope.tenantIds : null,
      scope.officeIds?.length ? scope.officeIds : null,
      scope.datatypes?.length ? scope.datatypes : null,
      scope.remoteId ?? null,
      RECENT.events,
      RECENT.window,
      limit,
    ],
  );
  return rows;
}

/**
 * The list: what waits on a CRM, and what has moved since, inside the scope. One row per record,
 * in the state it reached last, the newest queued first. A record waiting on a CRM right now wins
 * over whatever it did before; otherwise the newest event for it is the state it is in.
 */
export async function flow(scope: Scope, limit = 100): Promise<FlowRow[]> {
  const top = Math.min(Math.max(Math.trunc(limit), 1), 100);
  // One read after the other: Flow repeats this every second, so it holds one database connection
  // at a time and leaves the rest of the pool to the rest of Core.
  const events = await moved(scope, top);
  const queued = await fromAdapters(scope);
  const connectionRows = await connections();
  const everyTenant = await tenants();
  const rows = new Map<string, FlowRow>();
  for (const event of events) {
    const row = movedRow(event);
    rows.set(row.key, row);
  }
  const tenantOf = new Map(connectionRows.map((row) => [row.id, row.tenant_id]));
  const names = new Map(everyTenant.map((tenant) => [tenant.id, tenant.display_name]));
  for (const entry of queued) {
    const tenantId = entry.connectionId ? (tenantOf.get(entry.connectionId) ?? null) : null;
    const waiting = waitingRow(
      entry,
      tenantId === null ? null : { id: tenantId, name: names.get(tenantId) ?? '' },
    );
    if (!inScope(scope, waiting)) continue;
    rows.set(waiting.key, waiting);
  }
  return [...rows.values()]
    .sort((left, right) => (left.queuedAt < right.queuedAt ? 1 : -1))
    .slice(0, top);
}

// ---- The live stream ---------------------------------------------------------------------------

/** How often the stream looks for something new. */
const TICK_MS = 2_000;
/** A comment every so often, so a proxy in between does not close a quiet stream. */
const KEEPALIVE_MS = 20_000;

/**
 * One server-sent stream per open browser: new events since the last id, the open jobs, and the
 * health verdict. The app's live provider turns each message into the query it invalidates, which
 * is how Refine's `liveMode: "auto"` is meant to be fed.
 */
export function stream(afterId: number): Response {
  return {
    raw: (outgoing: ServerResponse) => {
      outgoing.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        // The stream is proxied on the platform; without this some proxies hold it back.
        'x-accel-buffering': 'no',
      });
      let after = afterId;
      let lastJobs = '';
      let lastHealth = '';
      let sending = false;

      const send = (kind: string, payload: unknown): void => {
        outgoing.write(`event: ${kind}\ndata: ${JSON.stringify(payload)}\n\n`);
      };

      const tick = async (): Promise<void> => {
        if (sending) return;
        sending = true;
        try {
          if (after === 0) after = await latestEventId();
          const fresh = await queryEvents({ afterId: after, limit: 200 });
          if (fresh.length > 0) {
            after = Number(fresh[fresh.length - 1]?.id ?? after);
            send('events', fresh.map(toStreamEvent));
          }
          const jobs = await openJobs();
          const asJson = JSON.stringify(jobs);
          if (asJson !== lastJobs) {
            lastJobs = asJson;
            send('jobs', jobs);
          }
        } catch (error) {
          report(error, { where: 'admin.stream' });
        } finally {
          sending = false;
        }
      };

      const heartbeat = async (): Promise<void> => {
        try {
          const health = await healthReport();
          const asJson = JSON.stringify(health);
          if (asJson !== lastHealth) {
            lastHealth = asJson;
            send('health', health);
          }
          outgoing.write(': still here\n\n');
        } catch (error) {
          report(error, { where: 'admin.stream' });
        }
      };

      const ticker = setInterval(() => void tick(), TICK_MS);
      const keepalive = setInterval(() => void heartbeat(), KEEPALIVE_MS);
      ticker.unref?.();
      keepalive.unref?.();
      void tick();
      void heartbeat();

      outgoing.on('close', () => {
        clearInterval(ticker);
        clearInterval(keepalive);
      });
    },
  };
}

export const toStreamEvent = (event: EventRow): Record<string, unknown> => ({
  id: Number(event.id),
  at: event.at.toISOString(),
  type: event.type,
  correlationId: event.correlation_id,
  tenantId: event.tenant_id,
  connectionId: event.connection_id,
  datatype: event.datatype,
  remoteId: event.remote_id,
  subscriberId: event.subscriber_id === null ? null : Number(event.subscriber_id),
  // The same sentence the timeline reads, so one event never says two things.
  said: summarise(event.type, event.fields),
  fields: event.fields,
});
