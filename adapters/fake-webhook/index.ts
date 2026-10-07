// A webhook-style adapter (AC 12). It owns its endpoint, its fetch list, its dedupe and its
// retries, and talks to the engine only through the adapter API.
//
//   webhook ──► signature check ──► fetch list ──► 202
//   drain loop ──► fetch from the CRM ──► found: ingest · gone: notFound · failed: retry later
import { randomUUID } from 'node:crypto';
import { mappers } from './mappers.js';
import * as crm from './crm.js';
import type {
  Adapter,
  AdapterAdmin,
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
  /** Links the webhook to the fetch and the write in the event log (SRS §11). */
  correlationId: string;
};

const fetchList = new Map<string, Queued>();
const signatures = new Map<string, string>();
let api: AdapterApi | null = null;
let drain: NodeJS.Timeout | null = null;
/** Drains run one after another, so two never overlap and shutdown can wait for the last one. */
let draining: Promise<void> = Promise.resolve();
/** Whether a drain is already waiting its turn. A second one would find nothing the first will not. */
let waiting = false;

/**
 * Queue one drain behind whatever is running, unless one is already waiting, and hand back a
 * promise for it. Without the cap, a machine where a drain outlasts the timer interval builds an
 * ever-growing backlog, and whoever waits for "the next drain" waits behind all of it.
 */
const scheduleDrain = (): Promise<void> => {
  if (!waiting) {
    waiting = true;
    const run = (): Promise<void> => {
      waiting = false;
      return drainOnce();
    };
    draining = draining.then(run, run);
  }
  return draining;
};

const key = (queued: Pick<Queued, 'connectionId' | 'datatype' | 'remoteId'>): string =>
  `${queued.connectionId}/${queued.datatype}/${queued.remoteId}`;

/** Duplicates collapse: the same record listed twice is kept once (strategy §5.3). */
function enqueue(
  connectionId: string,
  datatype: Datatype,
  remoteId: string,
  correlationId: string,
): void {
  const queued = {
    connectionId,
    datatype,
    remoteId,
    queuedAt: Date.now(),
    attempts: 0,
    correlationId,
  };
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
      const correlationId = randomUUID();
      enqueue(connectionId, datatype, remoteId, correlationId);
      return { status: 202, body: { queued: true, correlation_id: correlationId } };
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
        await current.ingest(connection, queued.datatype, queued.remoteId, payload, {
          correlationId: queued.correlationId,
        });
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

/** Everything the CRM has for a connection, in reference order: offices and agents before properties. */
async function loadEverything(connection: Connection, datatypes: Datatype[]): Promise<void> {
  const correlationId = randomUUID();
  for (const datatype of datatypes) {
    for (const remoteId of crm.ids(datatype)) {
      enqueue(connection.id, datatype, remoteId, correlationId);
    }
  }
}

/**
 * Only the named offices' records, plus the tenant-wide entities they reference (AC 14). Other
 * offices are not touched, so their items get no new seq.
 */
function loadOffices(connection: Connection, officeIds: string[]): void {
  const correlationId = randomUUID();
  const queue = (datatype: Datatype, remoteId: string): void =>
    enqueue(connection.id, datatype, remoteId, correlationId);

  for (const officeId of officeIds) {
    if (crm.get('office', officeId)) queue('office', officeId);
  }

  const referenced = new Map<Datatype, Set<string>>([
    ['area', new Set()],
    ['association', new Set()],
  ]);

  for (const datatype of ['agent', 'property'] as Datatype[]) {
    for (const payload of recordsForOffices(datatype, officeIds)) {
      queue(datatype, String(payload['ref']));
      for (const [refDatatype, remoteId] of referencesOf(payload)) {
        referenced.get(refDatatype)?.add(remoteId);
      }
    }
  }

  for (const [datatype, ids] of referenced) {
    for (const remoteId of ids) queue(datatype, remoteId);
  }
}

/** This CRM's records for the given offices. Knowing `officeRef` is adapter knowledge. */
function recordsForOffices(datatype: Datatype, officeIds: string[]): Record<string, unknown>[] {
  const wanted = new Set(officeIds);
  return crm
    .ids(datatype)
    .map((remoteId) => crm.get(datatype, remoteId))
    .filter((payload): payload is Record<string, unknown> => payload !== null)
    .filter((payload) => {
      const officeRef = payload['officeRef'];
      return typeof officeRef === 'string' && wanted.has(officeRef);
    });
}

/** The tenant-wide entities a record points at, which a new office may not have loaded yet. */
function referencesOf(payload: Record<string, unknown>): [Datatype, string][] {
  const areas = Array.isArray(payload['areaRefs']) ? payload['areaRefs'] : [];
  const association = payload['associationRef'];
  return [
    ...areas.map((ref): [Datatype, string] => ['area', String(ref)]),
    ...(typeof association === 'string'
      ? ([['association', association]] as [Datatype, string][])
      : []),
  ];
}

/** What this adapter shows in the panel: its login, its fetch list, and one action. */
const admin: AdapterAdmin = {
  checks: {
    [`${PROVIDER}.webhook_lag`]: {
      title: 'Changes the fake CRM told Core about',
      fine: 'Core fetched every change the fake CRM told it about within five minutes.',
    },
  },
  credentials: [
    {
      key: 'key',
      label: 'Pretend key',
      help: 'This CRM is a stand-in; any key it is given is accepted, and every office it knows answers.',
      required: true,
    },
  ],
  directions: () => ({
    steps: [
      {
        title: 'Tenant',
        text: 'On Tenants, make a tenant with the CRM fake-webhook and its offices; no login is needed, and every record is loaded on save (the event connection_added).',
      },
      {
        title: 'Notifications',
        text: 'POST /v1/hook/fake-webhook/webhook with the connection, datatype and record id; the record is fetched and written. offices_added, resync and refetch are handled as for any CRM.',
      },
      {
        title: 'Check',
        text: 'The check “Changes the fake CRM told Core about” shows Fine on the Overview.',
      },
    ],
    settings: [],
  }),
  panel: async (connections) => [
    {
      title: 'Fetch list',
      help: 'Records waiting to be fetched from the fake CRM, and the connections that would fetch them.',
      items: [
        { label: 'Waiting', value: fetchList.size },
        { label: 'Where notifications go', value: { address: `/v1/hook/${PROVIDER}/webhook` } },
      ],
      table: {
        columns: ['Connection', 'Record waiting'],
        rows: [...fetchList.values()].map((queued) => ({
          cells: [
            { connection: queued.connectionId },
            {
              connection: queued.connectionId,
              record: { datatype: queued.datatype, id: queued.remoteId },
            },
          ],
        })),
        empty: connections.length
          ? 'Nothing is waiting to be fetched.'
          : 'No tenant has a connection to the fake CRM.',
      },
      actions: [
        {
          id: 'drain',
          label: 'Fetch everything waiting now',
          help: 'Fetches every record on this CRM’s list at once instead of waiting for the next tick.',
        },
      ],
    },
  ],
  connection: async (connection) => [
    {
      title: 'What the fake CRM knows',
      items: [
        {
          label: 'Waiting for this connection',
          value: [...fetchList.values()].filter((queued) => queued.connectionId === connection.id)
            .length,
        },
      ],
      actions: [
        {
          id: 'drain',
          label: 'Fetch everything waiting now',
          help: 'Fetches every record waiting for this connection at once instead of waiting for the next tick.',
          params: { connection: connection.id },
        },
      ],
    },
  ],
  act: async (action) => {
    if (action !== 'drain') throw new Error(`no such action: ${action}`);
    await scheduleDrain();
    return { message: 'Everything waiting is fetched.' };
  },
  /** A login tried before it is saved: this CRM asks only that a key is typed and the offices exist. */
  probe: async (credentials, officeIds) => {
    let key: unknown;
    try {
      key = (JSON.parse(credentials) as { key?: unknown }).key;
    } catch {
      return { ok: false, detail: 'The login is not readable.' };
    }
    if (typeof key !== 'string' || key === '') {
      return { ok: false, detail: 'This CRM needs a key.' };
    }
    const unknownOffices = officeIds.filter((officeId) => crm.get('office', officeId) === null);
    return unknownOffices.length === 0
      ? { ok: true, detail: 'The CRM takes the key and knows every office picked.' }
      : { ok: false, detail: `The CRM has no office ${unknownOffices.join(', ')}.` };
  },
  /** One record fetched from the CRM and mapped on the spot, writing nothing. */
  inspect: async (_connection, record) => {
    const raw = crm.get(record.datatype, record.remoteId);
    if (raw === null) return null;
    const mapper = mappers[record.datatype];
    return { raw, mapped: mapper ? mapper(raw) : null };
  },
  queue: async () =>
    [...fetchList.values()].map((queued) => ({
      connectionId: queued.connectionId,
      officeId: '',
      datatype: queued.datatype,
      remoteId: queued.remoteId,
      queuedAt: new Date(queued.queuedAt).toISOString(),
      reason: 'webhook',
      attempts: queued.attempts,
      nextAt: null,
      lastError: null,
    })),
};

export const fakeWebhookAdapter: Adapter = {
  manifest: {
    provider: PROVIDER,
    datatypes: ['property', 'agent', 'office', 'area', 'association'],
  },
  mappers,
  routes,
  admin,

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
        loadOffices(event.connection, event.officeIds);
      }
      if (event.type === 'refetch') {
        const correlationId = randomUUID();
        for (const record of event.records) {
          enqueue(event.connection.id, record.datatype, record.remoteId, correlationId);
        }
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
