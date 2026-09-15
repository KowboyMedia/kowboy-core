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
};

export function fakeSubscriber(baseUrl: string, token: string): FakeSubscriber {
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
          cursors.clear();
          store.clear();
          datatypeOf.clear();
        }
        // office and agent before property, so references resolve on a first sync (SRS §6.9).
        for (const datatype of DATATYPES) await syncOne(datatype);
      })().finally(() => (syncing = null));
      await syncing;
    },

    items(datatype: Datatype): StoredItem[] {
      return [...store.entries()]
        .filter(([key]) => datatypeOf.get(key) === datatype)
        .map(([, item]) => item);
    },
  };

  async function syncOne(datatype: Datatype): Promise<void> {
    for (;;) {
      const after = cursors.get(datatype) ?? 0;
      const response = await fetch(`${baseUrl}/v1/changes?datatype=${datatype}&after=${after}`, {
        headers: { authorization: `Bearer ${token}`, 'x-core-client': 'fake/1.0.0' },
      });
      if (!response.ok) throw new Error(`pull failed: ${response.status}`);
      const page = (await response.json()) as {
        items: (StoredItem & { datatype: Datatype; deleted: boolean })[];
        next_after: number;
        has_more: boolean;
      };

      for (const item of page.items) {
        const key = `${item.connection_id}/${item.remote_id}`;
        if (item.deleted) {
          store.delete(key);
          datatypeOf.delete(key);
          continue;
        }
        // The hash is the skip test: an item that has not changed is not rewritten locally.
        if (store.get(key)?.content_hash === item.content_hash) continue;
        store.set(key, {
          remote_id: item.remote_id,
          connection_id: item.connection_id,
          seq: item.seq,
          content_hash: item.content_hash,
          data: item.data,
        });
        datatypeOf.set(key, datatype);
      }

      cursors.set(datatype, page.next_after);
      if (!page.has_more) return;
    }
  }

  return subscriber;
}
