// A polling-style adapter (AC 12). No endpoint, no webhook: it asks the CRM on its own timer and
// reconciles deletes by comparing id lists.
import { mappers } from './mappers.js';
import * as crm from './crm.js';
import type { Adapter, AdapterApi, Connection } from '../../engine/adapter-api/index.js';

const PROVIDER = 'fake-polling';
const POLL_MS = 100;
/** The datatypes this fake CRM has; it knows no projects. */
const DATATYPES = ['office', 'agent', 'area', 'association', 'property'] as const;
type Polled = (typeof DATATYPES)[number];

const ID_FIELD: Record<Polled, string> = {
  property: 'object_id',
  office: 'branch_id',
  agent: 'staff_id',
  area: 'district_id',
  association: 'coop_id',
};

let api: AdapterApi | null = null;
let timer: NodeJS.Timeout | null = null;
let lastPollAt = Date.now();
/** Polls run one after another, so two never overlap and shutdown can wait for the last one. */
let polling: Promise<void> = Promise.resolve();
/** Whether a poll is already waiting its turn. A second one would see nothing the first will not. */
let waiting = false;

/**
 * Queue one poll behind whatever is running, unless one is already waiting, and hand back a
 * promise for it. Without the cap, a machine where a sweep outlasts the timer interval builds an
 * ever-growing backlog, and whoever waits for "the next poll" waits behind all of it.
 */
const schedulePoll = (): Promise<void> => {
  if (!waiting) {
    waiting = true;
    const run = (): Promise<void> => {
      waiting = false;
      return pollOnce();
    };
    polling = polling.then(run, run);
  }
  return polling;
};

async function pollOnce(): Promise<void> {
  // Held for the whole pass: stop() may null `api` between two awaits, and a pass that has
  // started finishes against the API it started with.
  const current = api;
  if (!current) return;
  for (const connection of await current.connections()) {
    if (!connection.active) continue;
    await sweep(connection, current);
  }
  lastPollAt = Date.now();
}

async function sweep(connection: Connection, current: AdapterApi): Promise<void> {
  for (const datatype of DATATYPES) {
    const records = crm.all(datatype);
    for (const record of records) {
      const remoteId = String(record[ID_FIELD[datatype]] ?? '');
      if (!remoteId) continue;
      // Records that did not really change get the same hash, so no seq and no bell.
      await current.ingest(connection, datatype, remoteId, record);
    }
    // Deletes have no webhook here: whatever the CRM no longer lists is gone.
    await current.presentIds(connection, datatype, { officeId: null }, crm.ids(datatype));
  }
}

export const fakePollingAdapter: Adapter = {
  manifest: { provider: PROVIDER, datatypes: [...DATATYPES] },
  mappers,

  start(given: AdapterApi): void {
    api = given;

    given.onLifecycle(async (event) => {
      if (event.type === 'connection_added' || event.type === 'resync') {
        await sweep(event.connection, given);
      }
    });

    given.healthCheck(`${PROVIDER}.poll`, () => {
      const age = Date.now() - lastPollAt;
      return age < POLL_MS * 20
        ? { ok: true }
        : { ok: false, detail: `last poll ${Math.round(age / 1000)} s ago` };
    });

    timer = setInterval(() => void schedulePoll(), POLL_MS);
    timer.unref?.();
  },

  async stop(): Promise<void> {
    if (timer) clearInterval(timer);
    timer = null;
    await polling;
    api = null;
  },
};

/** Test and local use: run a poll after any in flight, and wait for it. */
export const poll = schedulePoll;
