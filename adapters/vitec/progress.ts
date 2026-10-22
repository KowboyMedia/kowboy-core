// How a connection is coming along (question 199 a), kept in the adapter's own state so the admin
// area can show it while a tenant is set up: when Vitec sent its first notice for the connection,
// how far its first load has come, and what the last office check changed. index.ts notes each as
// it happens, and admin/index.ts reads them for the engine. A connection is followed from its first
// office check on (a new connection, or a login switched to Vitec's other system, which starts
// again as a new one would); a connection whose offices were checked before this was kept is not,
// since Core cannot tell whether Vitec ever sent it a notice.
import * as store from './store.js';
import type { OfficesCheck } from './offices.js';
import type { Datatype } from '../../engine/adapter-api/index.js';

/** When Core began following the connection: its first office check. Null for one not followed. */
export const followedSince = async (connectionId: string): Promise<string | null> =>
  (await store.getState(connectionId, 'followed_since')) || null;

/** When Vitec's first notice for the connection came, null before. */
export const firstNoticeAt = async (connectionId: string): Promise<string | null> =>
  (await store.getState(connectionId, 'first_notice_at')) || null;

/** A notice from Vitec came for these connections' offices: the first one is kept. */
export async function noteNotice(connectionIds: readonly string[]): Promise<void> {
  const at = new Date().toISOString();
  for (const id of connectionIds) await store.setIfEmpty(id, 'first_notice_at', at);
}

/** What Vitec listed in the first load, per office and type, and whether the listing still runs. */
export type FirstLoad = {
  listed: Record<string, Partial<Record<Datatype, number>>>;
  listing: boolean;
  /** When the first load had nothing left to fetch; null before. */
  doneAt: string | null;
};

export async function firstLoadOf(connectionId: string): Promise<FirstLoad | null> {
  const [stored, listing, doneAt] = await Promise.all([
    store.getState(connectionId, 'first_load'),
    store.getState(connectionId, 'first_load_listing'),
    store.getState(connectionId, 'first_load_done'),
  ]);
  if (!stored) return null;
  try {
    const listed = JSON.parse(stored) as FirstLoad['listed'];
    return { listed, listing: listing === '1', doneAt: doneAt || null };
  } catch {
    return null;
  }
}

/** The connection's first office check: Core follows it from now. */
export async function follow(connectionId: string): Promise<void> {
  await store.setIfEmpty(connectionId, 'followed_since', new Date().toISOString());
}

/**
 * The first check that gives a followed connection offices to load begins its first load, once.
 */
export async function startFirstLoad(connectionId: string): Promise<void> {
  if (await followedSince(connectionId)) await store.setIfEmpty(connectionId, 'first_load', '{}');
}

type Listed = ReadonlyMap<Datatype, ReadonlyMap<string, ReadonlyMap<string, unknown>>>;

/**
 * A load, counted into the first load while that is not done: what it lists is kept per office,
 * so an office listed again after a hold cut its listing short replaces its own counts, and the
 * first load is not done while a listing runs.
 */
export async function counting(connectionId: string, run: () => Promise<Listed>): Promise<void> {
  const before = await firstLoadOf(connectionId);
  if (!before || before.doneAt) {
    await run();
    return;
  }
  await store.setState(connectionId, 'first_load_listing', '1');
  try {
    const listed = await run();
    const load = (await firstLoadOf(connectionId)) ?? before;
    for (const [datatype, perOffice] of listed) {
      for (const [officeId, ids] of perOffice) {
        load.listed[officeId] = { ...load.listed[officeId], [datatype]: ids.size };
      }
    }
    await store.setState(connectionId, 'first_load', JSON.stringify(load.listed));
  } finally {
    await store.setState(connectionId, 'first_load_listing', '');
  }
}

/** The first load has nothing left to fetch: kept, so later notices never make it unfinished. */
export async function noteLoaded(connectionId: string): Promise<void> {
  await store.setIfEmpty(connectionId, 'first_load_done', new Date().toISOString());
}

/** What the last office check changed: the offices it added by id, those it took off by name. */
export type Changes = { at: string; added: string[]; removed: string[] };

/**
 * An office check finished: what it changed against the check before it, and when each office it
 * added came. The first check changes nothing: its offices came with the connection.
 */
export async function noteCheck(
  connectionId: string,
  before: OfficesCheck | null,
  check: OfficesCheck,
): Promise<void> {
  const previous = before?.offices ?? [];
  const added = before ? check.offices.filter((office) => !previous.includes(office)) : [];
  const removed = previous
    .filter((office) => !check.offices.includes(office))
    .map((office) => before?.names[office] ?? office);
  const changes: Changes = { at: check.at, added, removed };
  await store.setState(connectionId, 'offices_changes', JSON.stringify(changes));
  const since = await addedAt(connectionId);
  const kept = Object.fromEntries(
    check.offices.flatMap((office) => {
      const at = added.includes(office) ? check.at : since[office];
      return at ? [[office, at]] : [];
    }),
  );
  await store.setState(connectionId, 'offices_added', JSON.stringify(kept));
}

export async function changesOf(connectionId: string): Promise<Changes | null> {
  const stored = await store.getState(connectionId, 'offices_changes');
  if (!stored) return null;
  try {
    return JSON.parse(stored) as Changes;
  } catch {
    return null;
  }
}

/** When each synced office that a check added came, by its id. */
export async function addedAt(connectionId: string): Promise<Record<string, string>> {
  const stored = await store.getState(connectionId, 'offices_added');
  try {
    return stored ? (JSON.parse(stored) as Record<string, string>) : {};
  } catch {
    return {};
  }
}
