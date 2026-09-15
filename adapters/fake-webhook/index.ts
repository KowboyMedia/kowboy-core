// A webhook-style adapter (AC 12). It owns its endpoint, its fetch list, its dedupe and its
// retries, and talks to the engine only through the adapter API.
//
//   webhook ──► signature check ──► fetch list ──► 202
//   drain loop ──► fetch from the CRM ──► found: ingest · gone: notFound · failed: retry later
import { mappers } from './mappers.js';
import * as crm from './crm.js';
import type {
  Adapter,
  AdapterApi,
  Connection,
  Datatype,
  Route,
} from '../../engine/adapter-api/index.js';

const PROVIDER = 'fake-webhook';
const SIGNATURE_HEADER = 'x-fake-signature';
const MAX_ATTEMPTS = 3;
const DRAIN_MS = 50;
/** A queued record not ingested within this window turns the lag check red. */
const LAG_LIMIT_MS = 5 * 60_000;

type Queued = {
  connectionId: string;
  datatype: Datatype;
  remoteId: string;
  queuedAt: number;
  attempts: number;
};

const fetchList = new Map<string, Queued>();
const signatures = new Map<string, string>();
let api: AdapterApi | null = null;
let drain: NodeJS.Timeout | null = null;
/** Drains run one after another, so two never overlap and shutdown can wait for the last one. */
let draining: Promise<void> = Promise.resolve();

/** Queue another drain behind whatever is running, and hand back a promise for it. */
const scheduleDrain = (): Promise<void> => {
  draining = draining.then(drainOnce, drainOnce);
  return draining;
};

const key = (queued: Pick<Queued, 'connectionId' | 'datatype' | 'remoteId'>): string =>
  `${queued.connectionId}/${queued.datatype}/${queued.remoteId}`;

/** Duplicates collapse: the same record listed twice is kept once (strategy §5.3). */
function enqueue(connectionId: string, datatype: Datatype, remoteId: string): void {
  const queued = { connectionId, datatype, remoteId, queuedAt: Date.now(), attempts: 0 };
  if (!fetchList.has(key(queued))) fetchList.set(key(queued), queued);
}

/** The webhook secret this adapter expects for a connection. A real one would come from credentials. */
export function setWebhookSecret(connectionId: string, secret: string): void {
  signatures.set(connectionId, secret);
}

const routes: Route[] = [
  {
    method: 'POST',
    path: 'webhook',
    handler: (request) => {
      let body: { connection_id?: string; datatype?: Datatype; remote_id?: string };
      try {
        body = JSON.parse(request.body.toString('utf8')) as typeof body;
      } catch {
        return { status: 400, body: { error: 'malformed body' } };
      }
      const { connection_id: connectionId, datatype, remote_id: remoteId } = body;
      if (!connectionId || !datatype || !remoteId) {
        return {
          status: 400,
          body: { error: 'connection_id, datatype and remote_id are required' },
        };
      }
      const expected = signatures.get(connectionId);
      if (expected && request.headers[SIGNATURE_HEADER] !== expected) {
        return { status: 401, body: { error: 'bad signature' } };
      }
      // Never fetch inside the request: a burst must not become a burst of CRM calls.
      enqueue(connectionId, datatype, remoteId);
      return { status: 202, body: { queued: true } };
    },
  },
];

async function drainOnce(): Promise<void> {
  const current = api;
  if (!current) return;

  for (const queued of [...fetchList.values()]) {
    // Claim the entry before fetching: two passes must never fetch one record twice, and a
    // record queued again while a fetch is running gets its own later pass.
    if (!fetchList.delete(key(queued))) continue;
    if (!api) return;

    const connection = (await current.connections()).find(
      (item) => item.id === queued.connectionId,
    );
    if (!connection) continue;

    try {
      const payload = crm.get(queued.datatype, queued.remoteId);
      if (payload === null) {
        await current.notFound(connection, queued.datatype, queued.remoteId);
      } else {
        await current.ingest(connection, queued.datatype, queued.remoteId, payload);
      }
    } catch (error) {
      // A failed fetch is retried, never treated as a delete (strategy §5.3).
      queued.attempts += 1;
      if (queued.attempts < MAX_ATTEMPTS) {
        fetchList.set(key(queued), queued);
      } else {
        await current.logEvent('fetch.failed', {
          connection_id: queued.connectionId,
          datatype: queued.datatype,
          remote_id: queued.remoteId,
          attempts: queued.attempts,
          detail: String(error),
        });
      }
    }
  }
}

async function loadEverything(connection: Connection, datatypes: Datatype[]): Promise<void> {
  for (const datatype of datatypes) {
    for (const remoteId of crm.ids(datatype)) enqueue(connection.id, datatype, remoteId);
  }
}

export const fakeWebhookAdapter: Adapter = {
  manifest: {
    provider: PROVIDER,
    datatypes: ['property', 'agent', 'office', 'area', 'association'],
  },
  mappers,
  routes,

  start(given: AdapterApi): void {
    api = given;

    given.onLifecycle(async (event) => {
      if (event.type === 'connection_added' || event.type === 'resync') {
        await loadEverything(event.connection, [
          'office',
          'agent',
          'area',
          'association',
          'property',
        ]);
      }
      if (event.type === 'offices_added') {
        await loadEverything(event.connection, ['office', 'agent', 'property']);
      }
    });

    given.healthCheck(`${PROVIDER}.webhook_lag`, () => {
      const oldest = [...fetchList.values()].reduce(
        (worst, queued) => Math.min(worst, queued.queuedAt),
        Date.now(),
      );
      const lag = Date.now() - oldest;
      return lag <= LAG_LIMIT_MS
        ? { ok: true }
        : { ok: false, detail: `a record has waited ${Math.round(lag / 1000)} s` };
    });

    drain = setInterval(() => void scheduleDrain(), DRAIN_MS);
    drain.unref?.();
  },

  async stop(): Promise<void> {
    if (drain) clearInterval(drain);
    drain = null;
    await draining;
    api = null;
    fetchList.clear();
  },
};

/** Test and local use: drain everything queued now, and wait for it. */
export const drainFetchList = scheduleDrain;
export const queueDepth = (): number => fetchList.size;
