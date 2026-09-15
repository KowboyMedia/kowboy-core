// A polling-style adapter (AC 12). No endpoint, no webhook: it asks the CRM on its own timer and
// reconciles deletes by comparing id lists.
import { mappers } from './mappers.js';
import * as crm from './crm.js';
import type { Adapter, AdapterApi, Connection, Datatype } from '../../engine/adapter-api/index.js';

const PROVIDER = 'fake-polling';
const POLL_MS = 100;
const DATATYPES: Datatype[] = ['office', 'agent', 'area', 'association', 'property'];

const ID_FIELD: Record<Datatype, string> = {
  property: 'object_id',
  office: 'branch_id',
  agent: 'staff_id',
  area: 'district_id',
  association: 'coop_id',
};

let api: AdapterApi | null = null;
let timer: NodeJS.Timeout | null = null;
let lastPollAt = Date.now();

async function pollOnce(): Promise<void> {
  if (!api) return;
  const connections = await api.connections();
  for (const connection of connections) {
    if (!connection.active) continue;
    await sweep(connection);
  }
  lastPollAt = Date.now();
}

async function sweep(connection: Connection): Promise<void> {
  if (!api) return;
  for (const datatype of DATATYPES) {
    const records = crm.all(datatype);
    for (const record of records) {
      const remoteId = String(record[ID_FIELD[datatype]] ?? '');
      if (!remoteId) continue;
      // Records that did not really change get the same hash, so no seq and no bell.
      await api.ingest(connection, datatype, remoteId, record);
    }
    // Deletes have no webhook here: whatever the CRM no longer lists is gone.
    await api.presentIds(connection, datatype, { officeId: null }, crm.ids(datatype));
  }
}

export const fakePollingAdapter: Adapter = {
  manifest: { provider: PROVIDER, datatypes: DATATYPES },
  mappers,

  start(given: AdapterApi): void {
    api = given;

    given.onLifecycle(async (event) => {
      if (event.type === 'connection_added' || event.type === 'resync')
        await sweep(event.connection);
    });

    given.healthCheck(`${PROVIDER}.poll`, () => {
      const age = Date.now() - lastPollAt;
      return age < POLL_MS * 20
        ? { ok: true }
        : { ok: false, detail: `last poll ${Math.round(age / 1000)} s ago` };
    });

    timer = setInterval(() => void pollOnce(), POLL_MS);
    timer.unref?.();
  },

  stop(): void {
    if (timer) clearInterval(timer);
    timer = null;
    api = null;
  },
};

/** Test and local use: one poll, synchronously. */
export const poll = pollOnce;
