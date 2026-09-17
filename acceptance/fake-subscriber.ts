// A subscriber, implemented exactly as SRS §8 describes one: a cursor per datatype, a bell that
// triggers a sync, and a local copy that is the only thing the site ever renders.
import { DATATYPES, type Datatype } from '../engine/adapter-api/types.js';

export type StoredItem = {
  remote_id: string;
  connection_id: string;
  seq: number;
  content_hash: string;
  data: Record<string, unknown> | null;
};

export type FakeSubscriber = {
  /** The local copy, keyed by connection and remote id, as a site would hold it. */
  store: Map<string, StoredItem>;
  cursors: Map<Datatype, number>;
  syncs: number;
  sync(kind?: 'delta' | 'forcerefresh'): Promise<void>;
  items(datatype: Datatype): StoredItem[];
  /** Point at a restarted Core, keeping the local copy and the cursors. */
  retarget(baseUrl: string): void;
};

export function fakeSubscriber(initialUrl: string, token: string): FakeSubscriber {
  let baseUrl = initialUrl;
  const store = new Map<string, StoredItem>();
  const cursors = new Map<Datatype, number>();
  const datatypeOf = new Map<string, Datatype>();
  let syncing: Promise<void> | null = null;

  const subscriber: FakeSubscriber = {
    store,
    cursors,
    syncs: 0,

    /** One sync at a time, like a real client (SRS §8). */
    async sync(kind: 'delta' | 'forcerefresh' = 'delta'): Promise<void> {
      if (syncing) {
        await syncing;
        return;
      }
      syncing = (async () => {
        subscriber.syncs += 1;
        if (kind === 'forcerefresh') {
          await rebuild();
          return;
        }
        // office and agent before property, so references resolve on a first sync (SRS §6.9).
        for (const datatype of DATATYPES) {
          const outcome = await syncOne(datatype);
          if (outcome === 'resync_required') {
            await rebuild();
            return;
          }
        }
      })().finally(() => (syncing = null));
      await syncing;
    },

    items(datatype: Datatype): StoredItem[] {
      return [...store.entries()]
        .filter(([key]) => datatypeOf.get(key) === datatype)
        .map(([, item]) => item);
    },

    retarget(url: string): void {
      baseUrl = url;
    },
  };

  /**
   * Pull everything from seq 0 into a fresh copy and swap it in only once every page succeeded
   * (strategy §7): the site keeps serving the old copy until then, and is never emptied.
   */
  async function rebuild(): Promise<void> {
    const fresh = { store: new Map<string, StoredItem>(), datatypeOf: new Map<string, Datatype>() };
    const freshCursors = new Map<Datatype, number>();
    for (const datatype of DATATYPES) {
      const outcome = await pullFrom(0, datatype, fresh, freshCursors);
      if (outcome === 'resync_required') throw new Error('resync required from seq 0');
    }
    store.clear();
    datatypeOf.clear();
    for (const [key, item] of fresh.store) store.set(key, item);
    for (const [key, datatype] of fresh.datatypeOf) datatypeOf.set(key, datatype);
    for (const [datatype, seq] of freshCursors) cursors.set(datatype, seq);
  }

  function syncOne(datatype: Datatype): Promise<'ok' | 'resync_required'> {
    return pullFrom(cursors.get(datatype) ?? 0, datatype, { store, datatypeOf }, cursors);
  }

  async function pullFrom(
    start: number,
    datatype: Datatype,
    into: { store: Map<string, StoredItem>; datatypeOf: Map<string, Datatype> },
    cursorsOut: Map<Datatype, number>,
  ): Promise<'ok' | 'resync_required'> {
    let after = start;
    for (;;) {
      const response = await fetch(`${baseUrl}/v1/changes?datatype=${datatype}&after=${after}`, {
        headers: { authorization: `Bearer ${token}`, 'x-core-client': 'fake/1.0.0' },
      });
      if (response.status === 409) return 'resync_required';
      if (!response.ok) throw new Error(`pull failed: ${response.status}`);
      const page = (await response.json()) as {
        items: (StoredItem & { deleted: boolean })[];
        next_after: number;
        has_more: boolean;
      };

      for (const item of page.items) {
        const key = `${item.connection_id}/${item.remote_id}`;
        if (item.deleted) {
          into.store.delete(key);
          into.datatypeOf.delete(key);
          continue;
        }
        // The hash is the skip test: an item that has not changed is not rewritten locally.
        if (into.store.get(key)?.content_hash === item.content_hash) continue;
        into.store.set(key, {
          remote_id: item.remote_id,
          connection_id: item.connection_id,
          seq: item.seq,
          content_hash: item.content_hash,
          data: item.data,
        });
        into.datatypeOf.set(key, datatype);
      }

      after = page.next_after;
      cursorsOut.set(datatype, after);
      if (!page.has_more) return 'ok';
    }
  }

  return subscriber;
}
