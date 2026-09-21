// The Flow page and the live stream (docs/admin-panel-design.md §2). Flow is one list of the
// records in flight, the whole row coloured by state (Patric's rule 3); its data is the engine's
// write path, read from the event log, plus what each adapter reports waiting on its own fetch
// list. The stream is one server-sent connection that every live page listens to, so a browser
// holds one connection and not six.
import type { ServerResponse } from 'node:http';
import { latestEventId, queryEvents, type EventRow } from '../events.js';
import { connections, connectionsForProvider, tenants } from '../storage/connections.js';
import { adminFor, adminProviders } from '../registry.js';
import { openJobs } from '../jobs.js';
import { healthReport } from '../health.js';
import { report } from '../errors.js';
import { summarise } from './summary.js';
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

const keyOf = (row: {
  connectionId: string | null;
  datatype: string | null;
  remoteId: string | null;
}): string => `${row.connectionId ?? ''}|${row.datatype ?? ''}|${row.remoteId ?? ''}`;

/** Every adapter's own fetch list, as the adapters report it. */
async function fromAdapters(): Promise<AdminQueued[]> {
  const queued: AdminQueued[] = [];
  for (const provider of adminProviders()) {
    const admin = adminFor(provider);
    if (!admin?.queue) continue;
    try {
      queued.push(...(await admin.queue(await connectionsForProvider(provider))));
    } catch (error) {
      report(error, { where: 'admin.queue', provider });
    }
  }
  return queued;
}

/** A tenant's name by its number, for the rows. */
type Names = Map<number, string>;

/** One row for a record waiting on a CRM, as the adapter reports it. */
const waitingRow = (entry: AdminQueued, tenantId: number | null, names: Names): FlowRow => ({
  key: keyOf(entry),
  state: entry.lastError !== null || entry.nextAt === null ? 'error' : 'queued',
  tenantId,
  tenant: tenantId === null ? null : (names.get(tenantId) ?? null),
  connectionId: entry.connectionId,
  officeId: entry.officeId,
  datatype: entry.datatype,
  remoteId: entry.remoteId,
  queuedAt: entry.queuedAt,
  what:
    entry.lastError ??
    (entry.nextAt === null ? 'given up' : `waiting for the CRM (${entry.reason})`),
  attempt: entry.attempts,
  site: null,
});

/** One row for a record that has moved, from the event that moved it. */
const movedRow = (event: EventRow, state: FlowState, names: Names): FlowRow => ({
  key: keyOf({
    connectionId: event.connection_id,
    datatype: event.datatype,
    remoteId: event.remote_id,
  }),
  state,
  tenantId: event.tenant_id,
  tenant: event.tenant_id === null ? null : (names.get(event.tenant_id) ?? null),
  connectionId: event.connection_id,
  officeId: null,
  datatype: event.datatype,
  remoteId: event.remote_id,
  queuedAt: event.at.toISOString(),
  what: summarise(event.type, event.fields),
  attempt: null,
  site: typeof event.fields['client'] === 'string' ? event.fields['client'] : null,
});

/**
 * The list: what waits on a CRM, and what has moved since. One row per record, in the state it
 * reached last, newest first. A record waiting on a CRM right now wins over whatever it did
 * before; otherwise the newest event for it is the state it is in.
 */
export async function flow(limit = 200): Promise<FlowRow[]> {
  const [everyTenant, connectionRows, events] = await Promise.all([
    tenants(),
    connections(),
    queryEvents({ newestFirst: true, limit: Math.min(limit * 4, 2000) }),
  ]);
  const names: Names = new Map(everyTenant.map((tenant) => [tenant.id, tenant.display_name]));
  const tenantOf = new Map(connectionRows.map((row) => [row.id, row.tenant_id]));

  const rows = new Map<string, FlowRow>();
  // Newest first, so the first event seen for a record is the state it is in now.
  for (const event of events) {
    const state = FROM_EVENT[event.type];
    if (!state || !event.remote_id) continue;
    const row = movedRow(event, state, names);
    if (!rows.has(row.key)) rows.set(row.key, row);
  }
  for (const entry of await fromAdapters()) {
    const tenantId = entry.connectionId ? (tenantOf.get(entry.connectionId) ?? null) : null;
    const row = waitingRow(entry, tenantId, names);
    rows.set(row.key, row);
  }

  return [...rows.values()]
    .sort((left, right) => (left.queuedAt < right.queuedAt ? 1 : -1))
    .slice(0, limit);
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
