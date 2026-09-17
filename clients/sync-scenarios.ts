// The sync scenario suite (strategy AC 20): the same scenarios for every client, each run as the
// real client against the real Core, which is started in this process with the fake polling
// adapter. A client joins by supplying a driver: how to start it against a Core, how to poke it,
// and how to look at its local copy.
import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { harness, until, TENANT, TOKEN, type Harness } from '../acceptance/harness.js';
import { addSubscriber } from '../engine/storage/connections.js';
import { db } from '../engine/storage/db.js';
import { purgeTombstones } from '../engine/storage/items.js';
import { fakePollingAdapter, poll } from '../adapters/fake-polling/index.js';
import * as crm from '../adapters/fake-polling/crm.js';

export const BELL_SECRET = 'client-bell-secret';
export const CONNECTION = 'polling-acme';

/** A real client crosses a process boundary on every look, so it gets longer than the fake one. */
const PATIENCE_MS = 30_000;
const SCENARIO_TIMEOUT_MS = 90_000;

export type Kind = 'delta' | 'forcerefresh';

export type ClientItem = {
  connection_id: string;
  remote_id: string;
  content_hash: string;
  /** The client's own write time: bookkeeping these tests read, and nothing else may. */
  synced_at: string;
  data: Record<string, unknown> | null;
};

export type ClientStatus = {
  runs: number;
  pending: string | null;
  running_since: string | null;
  last_success_at: string | null;
  last_error: string | null;
  after: Record<string, number>;
};

export type CoreDetails = { url: string; token: string; bellSecret: string };

export type ClientDriver = {
  /** Where Core rings. */
  bellUrl: string;
  /** Ring the client yourself; resolves to the HTTP status. */
  bell(kind: Kind, secret: string): Promise<number>;
  /** Start a sync the way the client's own trigger would. May return before the sync is done. */
  trigger(kind: Kind): Promise<void>;
  /** Run the client's scheduled backstop once. May return before the sync is done. */
  backstop(): Promise<void>;
  items(datatype: string): Promise<ClientItem[]>;
  status(): Promise<ClientStatus>;
  /** Corrupt one stored item's data without touching its hash: damage a delta sync never sees. */
  damage(datatype: string, remoteId: string): Promise<void>;
};

export type ClientSetup = {
  /** Start the client against this Core. Called before every scenario. */
  start(core: CoreDetails): Promise<ClientDriver>;
  /** Stop it. Called after every scenario. */
  stop(): Promise<void>;
};

/** A property as the fake polling CRM holds it. */
export const fakeProperty = (id: string): Record<string, unknown> => ({
  object_id: id,
  stage: 'active',
  object_type: 'flat',
  street: `Kungsgatan ${id}`,
  price: 7250000,
  branch_id: 'B-1',
  districts: [],
  staff: [],
  coop_id: null,
});

export function syncScenarios(name: string, client: ClientSetup): void {
  describe(`${name} against Core`, () => {
    let core: Harness;
    let site: ClientDriver;
    let coreStopped = false;

    beforeEach(async () => {
      crm.reset();
      coreStopped = false;
      core = await harness({
        adapters: [fakePollingAdapter],
        connections: [{ id: CONNECTION, provider: 'fake-polling' }],
        subscriber: false,
      });
      site = await client.start({ url: core.baseUrl, token: TOKEN, bellSecret: BELL_SECRET });
      await addSubscriber({
        tenantId: TENANT,
        label: name,
        bellUrl: site.bellUrl,
        bellSecret: BELL_SECRET,
      });
    });

    afterEach(async () => {
      await client.stop();
      if (!coreStopped) await core.stop();
    });

    const remoteIds = async (datatype: string): Promise<string[]> =>
      (await site.items(datatype)).map((item) => item.remote_id).sort();

    const item = async (datatype: string, remoteId: string): Promise<ClientItem | undefined> =>
      (await site.items(datatype)).find((stored) => stored.remote_id === remoteId);

    const seed = async (...ids: string[]): Promise<void> => {
      for (const id of ids) crm.put('property', id, fakeProperty(id));
      await poll();
    };

    /** Wait until the client has run again and has nothing left to do. */
    const settled = async (runsBefore: number): Promise<ClientStatus> => {
      let status = await site.status();
      await until(
        async () => {
          status = await site.status();
          return (
            status.runs > runsBefore && status.pending === null && status.running_since === null
          );
        },
        'the client to finish syncing',
        PATIENCE_MS,
      );
      return status;
    };

    /** Trigger a sync the client's own way and wait for it to settle. */
    const sync = async (kind: Kind = 'delta'): Promise<ClientStatus> => {
      const before = (await site.status()).runs;
      await site.trigger(kind);
      return settled(before);
    };

    it(
      'pulls when Core rings, and refuses a bell with the wrong secret',
      async () => {
        expect(await site.bell('delta', 'not the secret')).toBe(401);

        await seed('P-1'); // one write, one bell, rung by Core itself
        await until(
          async () => (await site.items('property')).length === 1,
          'the bell to be answered',
          PATIENCE_MS,
        );
        const { rows } = await db().query<{ last_bell_status: string }>(
          'select last_bell_status from subscribers',
        );
        expect(rows[0]?.last_bell_status).toBe('ok');
      },
      SCENARIO_TIMEOUT_MS,
    );

    it(
      'converges from seq 0 to everything Core holds (AC 5, AC 34)',
      async () => {
        await seed('P-1', 'P-2', 'P-3');
        crm.put('office', 'B-1', { branch_id: 'B-1', branch_name: 'Main street' });
        await poll();

        const status = await sync();
        expect(await remoteIds('property')).toEqual(['P-1', 'P-2', 'P-3']);
        expect(await remoteIds('office')).toEqual(['B-1']);
        expect(status.last_error).toBeNull();
        expect(status.last_success_at).not.toBeNull();
        expect(status.after['property']).toBeGreaterThan(0);

        // data is stored verbatim, and identity is connection plus remote id (AC 6).
        const stored = await item('property', 'P-1');
        expect(stored?.connection_id).toBe(CONNECTION);
        expect(stored?.data?.['fake_label']).toBe('Kungsgatan P-1');
        expect(stored?.data?.['display']).toEqual({});
      },
      SCENARIO_TIMEOUT_MS,
    );

    it(
      'skips unchanged items and carries on from its cursor (AC 2)',
      async () => {
        await seed('P-1');
        const first = await sync();
        const stored = await item('property', 'P-1');

        await poll(); // the CRM holds the same record: Core gives it no new seq
        const second = await sync();
        expect(second.after).toEqual(first.after);
        expect((await item('property', 'P-1'))?.synced_at).toBe(stored?.synced_at);

        await seed('P-2');
        const third = await sync();
        expect(await remoteIds('property')).toEqual(['P-1', 'P-2']);
        expect(third.after['property']).toBeGreaterThan(first.after['property'] ?? 0);
        expect((await item('property', 'P-1'))?.synced_at).toBe(stored?.synced_at);
      },
      SCENARIO_TIMEOUT_MS,
    );

    it(
      "keeps its copy and carries on when Core's sequence jumps ahead, as after a restore (AC 41)",
      async () => {
        await seed('P-1');
        const first = await sync();
        const stored = await item('property', 'P-1');

        // What every engine start does (strategy §7.2), here by hand.
        await db().query("select setval('item_seq', last_value + 1000000000) from item_seq");
        await seed('P-2');
        const second = await sync();

        expect(await remoteIds('property')).toEqual(['P-1', 'P-2']);
        expect(second.after['property']).toBeGreaterThan(
          (first.after['property'] ?? 0) + 1_000_000_000,
        );
        expect((await item('property', 'P-1'))?.synced_at).toBe(stored?.synced_at);
        expect(second.last_error).toBeNull();
      },
      SCENARIO_TIMEOUT_MS,
    );

    it(
      'drops an item locally when Core tombstones it (AC 3)',
      async () => {
        await seed('P-1', 'P-2');
        await sync();

        crm.remove('property', 'P-1');
        await poll();
        await sync();
        expect(await remoteIds('property')).toEqual(['P-2']);
      },
      SCENARIO_TIMEOUT_MS,
    );

    it(
      'rewrites everything on forcerefresh, repairing damage a delta sync never sees (AC 5)',
      async () => {
        await seed('P-1', 'P-2');
        await sync();

        await site.damage('property', 'P-1');
        await sync();
        expect((await item('property', 'P-1'))?.data).toEqual({ damaged: true });

        await sync('forcerefresh');
        expect((await item('property', 'P-1'))?.data?.['fake_label']).toBe('Kungsgatan P-1');
      },
      SCENARIO_TIMEOUT_MS,
    );

    it(
      'stores a field it has never seen, verbatim (AC 10, AC 30)',
      async () => {
        await seed('P-1');
        await sync();

        // A Core release added a field: served with a new hash and seq, as the write path would.
        // The adapter is stopped first, or its next poll would put the CRM's version back.
        await fakePollingAdapter.stop?.();
        await db().query(
          `update items
           set data = data || '{"fake_new_field": "new"}'::jsonb,
               content_hash = 'changed-' || content_hash,
               seq = nextval('item_seq')
           where remote_id = 'P-1'`,
        );
        await sync();
        expect((await item('property', 'P-1'))?.data?.['fake_new_field']).toBe('new');
      },
      SCENARIO_TIMEOUT_MS,
    );

    it(
      'skips an item it cannot use, and keeps going (AC 30)',
      async () => {
        await db().query('update subscribers set active = false'); // Core rings nobody
        await seed('P-1', 'P-2', 'P-3');
        // One served item is broken, and stays broken: the adapter must not repair it meanwhile.
        await fakePollingAdapter.stop?.();
        await db().query(
          `update items set data = null, content_hash = 'broken', seq = nextval('item_seq')
           where remote_id = 'P-2'`,
        );

        const status = await sync();
        expect(await remoteIds('property')).toEqual(['P-1', 'P-3']);
        expect(status.last_error).toBeNull();

        const { rows } = await db().query<{ seq: string }>('select max(seq) as seq from items');
        expect(status.after['property']).toBe(Number(rows[0]?.seq));
      },
      SCENARIO_TIMEOUT_MS,
    );

    it(
      'rebuilds without ever emptying when Core says resync_required (AC 31)',
      async () => {
        await seed('P-1', 'P-2', 'P-3');
        await sync();

        // Core rings nobody from here on, so the client's cursor stays where it is.
        await db().query('update subscribers set active = false');
        crm.remove('property', 'P-1');
        await poll();
        // The tombstone ages out and is purged: the cursor is now below the watermark.
        await db().query(
          "update items set tombstoned_at = now() - interval '91 days' where deleted",
        );
        expect(await purgeTombstones(90)).toBe(1);
        expect(await remoteIds('property')).toEqual(['P-1', 'P-2', 'P-3']);

        const status = await sync();
        expect(status.last_error).toBeNull();
        expect(await remoteIds('property')).toEqual(['P-2', 'P-3']);
      },
      SCENARIO_TIMEOUT_MS,
    );

    it(
      'keeps its copy and reports the failure when Core is down (AC 8)',
      async () => {
        await seed('P-1');
        await sync();

        await core.stop();
        coreStopped = true;

        const status = await sync();
        expect(status.last_error).not.toBeNull();
        expect(await remoteIds('property')).toEqual(['P-1']);
      },
      SCENARIO_TIMEOUT_MS,
    );

    it(
      'misses no item while writes and bells keep coming (AC 19)',
      async () => {
        const ids = Array.from({ length: 30 }, (_, index) => `P-${String(index).padStart(3, '0')}`);
        const writing = (async () => {
          for (const id of ids) {
            crm.put('property', id, fakeProperty(id));
            await poll();
          }
        })();
        const ringing = (async () => {
          for (let round = 0; round < 5; round += 1) {
            expect(await site.bell('delta', BELL_SECRET)).toBe(202);
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        })();
        await Promise.all([writing, ringing]);

        await sync();
        expect(await remoteIds('property')).toEqual(ids);
      },
      SCENARIO_TIMEOUT_MS,
    );

    it(
      'converges on its own schedule when bells never arrive (AC 22)',
      async () => {
        await db().query('update subscribers set active = false'); // Core rings nobody
        await seed('P-1');

        const before = (await site.status()).runs;
        await site.backstop();
        await settled(before);
        expect(await remoteIds('property')).toEqual(['P-1']);
      },
      SCENARIO_TIMEOUT_MS,
    );
  });
}

/** A port nobody is listening on, for a client process to take. */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}
