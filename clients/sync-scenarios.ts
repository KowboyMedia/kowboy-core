// The sync scenario suite (strategy AC 20): the same scenarios for every client, each run as the
// real client against the real Core, which is started in this process with the fake polling
// adapter. A client joins by supplying a driver: how to start it against a Core, how to poke it,
// and how to look at its local copy.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { harness, until, TENANT, TOKEN, type Harness } from '../acceptance/harness.js';
import { addSubscriber } from '../engine/storage/connections.js';
import { queryEvents } from '../engine/events.js';
import { db } from '../engine/storage/db.js';
import { purgeTombstones } from '../engine/storage/items.js';
import { fakePollingAdapter, poll } from '../adapters/fake-polling/index.js';
import * as crm from '../adapters/fake-polling/crm.js';
import {
  BELL_SECRET,
  CONNECTION,
  type ClientDriver,
  type ClientItem,
  type ClientSetup,
  type ClientStatus,
  type Kind,
} from './client-driver.js';

// The driver's shape and names live in client-driver.ts (no test runner there, so a journey's
// site script can use them); the clients' suites keep importing them from here.
export { BELL_SECRET, CONNECTION, freePort } from './client-driver.js';
export type {
  ClientDriver,
  ClientItem,
  ClientSetup,
  ClientStatus,
  CoreDetails,
  Kind,
} from './client-driver.js';

/** A real client crosses a process boundary on every look, so it gets longer than the fake one. */
const PATIENCE_MS = 30_000;
const SCENARIO_TIMEOUT_MS = 90_000;

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
      'names itself on every pull, so Core knows which of the tenant’s sites pulled (Patric, 2026-09-20)',
      async () => {
        await seed('P-1');
        await sync();
        // A second site of the tenant that never pulls: Core must not count it as pulling.
        const decoy = await addSubscriber({
          tenantId: TENANT,
          label: 'another site',
          bellUrl: 'http://127.0.0.1:9/bell',
          bellSecret: BELL_SECRET,
        });
        await sync();

        const { rows } = await db().query<{ id: string; last_pull_at: Date | null }>(
          'select id, last_pull_at from subscribers order by id',
        );
        expect(rows.find((row) => Number(row.id) === decoy)?.last_pull_at).toBeNull();
        const own = rows.find((row) => Number(row.id) !== decoy);
        expect(own?.last_pull_at).not.toBeNull();

        const pulls = await queryEvents({ type: 'pull', subscriberId: Number(own?.id) });
        expect(pulls.length).toBeGreaterThan(0);
        expect(pulls[0]?.fields['site']).toBe(site.bellUrl);
      },
      SCENARIO_TIMEOUT_MS,
    );

    it(
      'a disabled licence stops bells and pulls, and the site keeps what it shows (Patric, 2026-09-18)',
      async () => {
        await seed('P-1');
        await sync();
        expect(await remoteIds('property')).toEqual(['P-1']);

        const bellAt = async (): Promise<number | null> => {
          const { rows } = await db().query<{ last_bell_at: Date | null }>(
            'select last_bell_at from subscribers',
          );
          return rows[0]?.last_bell_at?.getTime() ?? null;
        };
        await db().query('update tenants set active = false where id = $1', [TENANT]);
        const rungBefore = await bellAt();
        await seed('P-2'); // Core writes it, and rings no site whose licence is off
        expect(await bellAt()).toBe(rungBefore);

        const status = await sync(); // the site's own backstop: refused, and nothing removed
        expect(status.last_error).toMatch(/licence/);
        expect(await remoteIds('property')).toEqual(['P-1']);

        await db().query('update tenants set active = true where id = $1', [TENANT]);
        await sync();
        expect(await remoteIds('property')).toEqual(['P-1', 'P-2']);
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
        expect((stored?.data?.['address'] as Record<string, unknown>)['street']).toBe(
          'Kungsgatan P-1',
        );
        // So is display, the strings Core prepared (rules-ledger/).
        expect(stored?.data?.['display']).toMatchObject({
          price: '7\u00a0250\u00a0000\u00a0kr',
          address_line: 'Kungsgatan P-1',
        });
        // So is raw: the CRM payload exactly as Core served it.
        expect(stored?.raw).toMatchObject(fakeProperty('P-1'));
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
      'keeps its copy through a database restore and converges again without deleting or rewriting anything (AC 41)',
      async () => {
        const byId = (items: ClientItem[]): ClientItem[] =>
          [...items].sort((a, b) => a.remote_id.localeCompare(b.remote_id));

        // Day 29.
        await seed('P-1', 'P-2', 'P-3');
        await sync();
        await db().query('drop table if exists items_backup');
        await db().query('create table items_backup as select * from items');
        const snapshotSeq = Number(
          (await db().query<{ last_value: string }>('select last_value from item_seq')).rows[0]
            ?.last_value,
        );

        // Day 30: one change, one new record, one delete, all on the site.
        crm.put('property', 'P-2', { ...fakeProperty('P-2'), street: 'Nygatan 2' });
        crm.put('property', 'P-4', fakeProperty('P-4'));
        crm.remove('property', 'P-3');
        await poll();
        await sync();
        const before = byId(await site.items('property'));
        expect(before.map((stored) => stored.remote_id)).toEqual(['P-1', 'P-2', 'P-4']);

        // The platform restores the database to day 29 while Core is down, then starts it again.
        await core.restart(async () => {
          await db().query('truncate items');
          await db().query('insert into items select * from items_backup');
          await db().query("select setval('item_seq', $1)", [snapshotSeq]);
        });

        // Nothing arrives, nothing is lost, nothing is deleted.
        const paused = await sync();
        expect(paused.last_error).toBeNull();
        expect(byId(await site.items('property'))).toEqual(before);

        // The adapter's next pass brings Core back; the site rewrites nothing it already holds.
        await poll();
        await sync();
        expect(byId(await site.items('property'))).toEqual(before);
        expect(
          ((await item('property', 'P-2'))?.data?.['address'] as Record<string, unknown>)['street'],
        ).toBe('Nygatan 2');
        await db().query('drop table items_backup');
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
        expect(
          ((await item('property', 'P-1'))?.data?.['address'] as Record<string, unknown>)['street'],
        ).toBe('Kungsgatan P-1');
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

        // And Core was told: the broken record failed at this site, the others were applied.
        const failed = await queryEvents({ tenantId: TENANT, type: 'site.failed', limit: 10 });
        expect(failed.map((event) => event.remote_id)).toEqual(['P-2']);
        const applied = await queryEvents({ tenantId: TENANT, type: 'site.applied', limit: 10 });
        expect(applied.map((event) => event.remote_id).sort()).toEqual(['P-1', 'P-3']);
        // And the skip reached Core's error gate as one bug (question 46), whichever client.
        await until(
          async () =>
            (
              await db().query<{ fingerprint: string }>(
                "select fingerprint from error_reports where fingerprint like '%skipped an item%'",
              )
            ).rows.length === 1,
          "the site's error report to reach Core",
          PATIENCE_MS,
        );
      },
      SCENARIO_TIMEOUT_MS,
    );

    it(
      'reports back what it applied, on each record\u2019s timeline in Core (AC 16)',
      async () => {
        await seed('P-1', 'P-2');
        await sync();
        const applied = await queryEvents({ tenantId: TENANT, type: 'site.applied', limit: 10 });
        expect(applied.map((event) => event.remote_id).sort()).toEqual(['P-1', 'P-2']);
        for (const event of applied) {
          expect(event.connection_id).toBe(CONNECTION);
          expect(typeof event.fields['client']).toBe('string');
          expect(typeof event.fields['seq']).toBe('number');
        }
        // Nothing changed: the next sync has nothing to report.
        await sync();
        expect(
          (await queryEvents({ tenantId: TENANT, type: 'site.applied', limit: 10 })).length,
        ).toBe(2);
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
