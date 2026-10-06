// Which offices a Vitec connection syncs (questions 147 a and 154, Patric, 2026-10-06). A login
// reads one customer id (M30011) or group id (G12): Vitec's office list for that id names each
// office with its own customer id, and each one is read on its own, so an office this login may
// not read is never used. Of the offices that read, those in the brokerage's office group
// "webbplats" in Vitec are used; with no such group, or none of its offices readable, every one
// is. Offices typed on the connection still win while there are any. An answer Vitec did not give
// (down, busy, broken) never changes the choice: the last one is kept and the check is tried again
// within the hour. Reads only. The answer is kept in the adapter's state and shown on the
// tenant's page; index.ts loads the offices that came and takes off the ones that went.
import * as connect from './api.js';
import * as store from './store.js';

/** The office group in Vitec whose offices reach the sites, matched regardless of case. */
export const WEBSITE_GROUP = 'webbplats';

/** How often the offices are checked, and how soon a check Vitec did not answer is tried again. */
export const CHECK_EVERY_MS = 24 * 3_600_000;
export const RETRY_AFTER_MS = 3_600_000;

/** One office Vitec listed behind an id, and whether it read on its own. */
export type OfficeSeen = {
  customerId: string;
  officeId: string;
  name: string | null;
  readable: boolean;
  detail: string | null;
};

/** What Vitec answered for one id: its offices, and its office groups by name. */
export type IdChecked = {
  id: string;
  offices: OfficeSeen[];
  error: string | null;
  groups: { name: string; officeIds: string[] }[];
  groupsError: string | null;
};

/**
 * Where the synced offices came from: the group "webbplats", every office that read, the offices
 * typed on the connection, or the last answer, kept because Vitec did not answer this time.
 */
export type Source = 'group' | 'all' | 'typed' | 'kept';

export type OfficesCheck = {
  at: string;
  ids: IdChecked[];
  /** The offices synced, by the customer id their records carry. */
  offices: string[];
  source: Source;
};

/** A failed call: what to show, and whether Vitec answered at all (a refusal is an answer). */
const failure = (error: unknown, refused: string): { detail: string; answered: boolean } => {
  const kind = connect.kindOf(error);
  if (kind === 'forbidden') return { detail: refused, answered: true };
  return {
    detail: error instanceof Error ? error.message : String(error),
    answered: kind === 'other',
  };
};

type Answer<T> = { value: T; answered: boolean };

async function readOne(auth: connect.Auth, row: connect.ListRow): Promise<Answer<OfficeSeen>> {
  const seen = { customerId: row.customerId, officeId: row.id, name: null, detail: null };
  try {
    const office = (await connect.getOne(auth, 'office', row.customerId, row.id)) as {
      name?: unknown;
    } | null;
    if (!office) {
      return {
        value: { ...seen, readable: false, detail: 'Vitec has no such office' },
        answered: true,
      };
    }
    const name = typeof office.name === 'string' ? office.name : null;
    return { value: { ...seen, readable: true, name }, answered: true };
  } catch (error) {
    const { detail, answered } = failure(error, 'Vitec refuses this login');
    return { value: { ...seen, readable: false, detail }, answered };
  }
}

async function checkId(
  auth: connect.Auth,
  crmAuth: connect.Auth,
  id: string,
): Promise<Answer<IdChecked>> {
  const checked: IdChecked = { id, offices: [], error: null, groups: [], groupsError: null };
  let answered = true;
  try {
    for await (const row of connect.list(auth, 'office', id)) {
      const one = await readOne(auth, row);
      checked.offices.push(one.value);
      answered &&= one.answered;
    }
  } catch (error) {
    const refused = failure(error, 'Vitec refuses this login');
    checked.error = refused.detail;
    answered &&= refused.answered;
  }
  try {
    checked.groups = (await connect.officeGroups(crmAuth, id)).map(({ name, officeIds }) => ({
      name,
      officeIds,
    }));
  } catch (error) {
    const refused = failure(error, 'Vitec refuses this login its office groups');
    checked.groupsError = refused.detail;
    answered &&= refused.answered;
  }
  return { value: checked, answered };
}

/** The offices to sync from what Vitec answered: the group "webbplats" when it has any, else all. */
function choose(ids: IdChecked[]): { offices: string[]; source: Source } {
  const readable = ids.flatMap((checked) => checked.offices.filter((office) => office.readable));
  const unique = (offices: OfficeSeen[]): string[] => [
    ...new Set(offices.map((office) => office.customerId)),
  ];
  const inGroup = new Set(
    ids
      .flatMap((checked) => checked.groups)
      .filter((group) => group.name.trim().toLowerCase() === WEBSITE_GROUP)
      .flatMap((group) => group.officeIds),
  );
  const chosen = readable.filter(
    (office) => inGroup.has(office.officeId) || inGroup.has(office.customerId),
  );
  return chosen.length > 0
    ? { offices: unique(chosen), source: 'group' }
    : { offices: unique(readable), source: 'all' };
}

/**
 * Ask Vitec about every id, one after the other, choose the offices to sync and keep the answer
 * for the tenant's page. Offices typed on the connection are used as they are. When Vitec did not
 * answer every call, or answered with no office that reads, the last offices are kept.
 */
export async function checkOffices(
  connectionId: string,
  auth: connect.Auth,
  crmAuth: connect.Auth,
  ids: readonly string[],
  typed: readonly string[],
): Promise<OfficesCheck> {
  const checked: IdChecked[] = [];
  let answered = true;
  for (const id of ids) {
    const one = await checkId(auth, crmAuth, id);
    checked.push(one.value);
    answered &&= one.answered;
  }
  const last = await lastCheck(connectionId);
  const fresh = choose(checked);
  const choice =
    typed.length > 0
      ? { offices: [...typed], source: 'typed' as const }
      : answered && fresh.offices.length > 0
        ? fresh
        : { offices: last?.offices ?? [], source: 'kept' as const };
  const result: OfficesCheck = { at: new Date().toISOString(), ids: checked, ...choice };
  await store.setState(connectionId, 'offices_check', JSON.stringify(result));
  // Unanswered: due again within the hour instead of tomorrow.
  const due = answered ? Date.now() : Date.now() - CHECK_EVERY_MS + RETRY_AFTER_MS;
  await store.setState(connectionId, 'offices_check_at', new Date(due).toISOString());
  return result;
}

/**
 * The offices a connection syncs: the ones typed on it while there are any, else the ones the
 * last check chose from Vitec: the group "webbplats", or every office.
 */
export async function officesOf(connection: {
  id: string;
  licensedOffices: string[];
}): Promise<string[]> {
  if (connection.licensedOffices.length > 0) return connection.licensedOffices;
  return (await lastCheck(connection.id))?.offices ?? [];
}

/** The last answer kept for a connection, or null before the first check. */
export async function lastCheck(connectionId: string): Promise<OfficesCheck | null> {
  const stored = await store.getState(connectionId, 'offices_check');
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as Partial<OfficesCheck>;
    return {
      at: parsed.at ?? '',
      ids: (parsed.ids ?? []).map((checked) => ({
        ...checked,
        groups: checked.groups ?? [],
        groupsError: checked.groupsError ?? null,
      })),
      offices: parsed.offices ?? [],
      source: parsed.source ?? 'kept',
    };
  } catch {
    return null;
  }
}
