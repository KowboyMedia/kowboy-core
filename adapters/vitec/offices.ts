// Which offices a Vitec connection syncs (questions 147 a, 154 and 158 b, Patric, 2026-10-06). A
// login reads one customer id (M30011) or group id (G12): Vitec's office list for that id names
// each office with its own customer id, and each one is read on its own, so an office this login
// may not read is never used. Of the offices that read, those in the brokerage's office group
// "webbplats" in Vitec are used; with no such group, or none of its offices readable, every one
// is. The tenant page draws no office field for Vitec (question 156 a). An answer Vitec did not
// give (down, busy, broken) never changes the choice: the last one is kept and the check is tried
// again within the hour. An office Vitec refuses (401 or 403, the office or its whole id) stays
// synced for one more day and is taken off when the refusal still stands at the next daily check,
// so a short outage or a password changed by mistake empties no site. This check is the only call
// that asks about a refused office (question 161 a): an id whose own list fails is asked nothing
// more, so a cancelled brokerage costs one call a day, which also brings it back by itself once
// Vitec answers again. Reads only. The answer is
// kept in the adapter's state and shown on the tenant's page; index.ts loads the offices that came
// and takes off the ones that went.
import * as connect from './api.js';
import * as store from './store.js';

/** The office group in Vitec whose offices reach the sites, matched regardless of case. */
export const WEBSITE_GROUP = 'webbplats';

/** How often the offices are checked, and how soon a check Vitec did not answer is tried again. */
export const CHECK_EVERY_MS = 24 * 3_600_000;
export const RETRY_AFTER_MS = 3_600_000;

/**
 * How long a refused office stays synced: a day, less a minute so that the daily check following
 * the check that first saw the refusal takes the office off.
 */
export const REFUSAL_GRACE_MS = CHECK_EVERY_MS - 60_000;

/** One office Vitec listed behind an id, and whether it read on its own. */
export type OfficeSeen = {
  customerId: string;
  officeId: string;
  name: string | null;
  readable: boolean;
  detail: string | null;
  /** When Vitec first refused this office in the checks since, null while it reads. */
  refusedSince: string | null;
};

/** What Vitec answered for one id: its offices, and its office groups by name. */
export type IdChecked = {
  id: string;
  offices: OfficeSeen[];
  error: string | null;
  /** When Vitec first refused the id's own office list in the checks since, null while it lists. */
  refusedSince: string | null;
  groups: { name: string; officeIds: string[] }[];
  groupsError: string | null;
};

/**
 * Where the synced offices came from: the group "webbplats", every office that read, or the last
 * answer, kept because Vitec did not answer this time.
 */
export type Source = 'group' | 'all' | 'kept';

export type OfficesCheck = {
  at: string;
  ids: IdChecked[];
  /** The offices synced, by the customer id their records carry. */
  offices: string[];
  source: Source;
};

/** A failed call: what to show, whether it was a refusal, and whether Vitec answered at all. */
const failure = (
  error: unknown,
  refused: string,
): { detail: string; refused: boolean; answered: boolean } => {
  const kind = connect.kindOf(error);
  if (kind === 'forbidden') return { detail: refused, refused: true, answered: true };
  return {
    detail: error instanceof Error ? error.message : String(error),
    refused: false,
    answered: kind === 'other',
  };
};

type Answer<T> = { value: T; answered: boolean };

async function readOne(
  auth: connect.Auth,
  row: connect.ListRow,
  at: string,
): Promise<Answer<OfficeSeen>> {
  const seen = {
    customerId: row.customerId,
    officeId: row.id,
    name: null,
    detail: null,
    refusedSince: null,
  };
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
    const { detail, refused, answered } = failure(error, 'Vitec refuses this login');
    return {
      value: { ...seen, readable: false, detail, refusedSince: refused ? at : null },
      answered,
    };
  }
}

async function checkId(
  auth: connect.Auth,
  crmAuth: connect.Auth,
  id: string,
  at: string,
): Promise<Answer<IdChecked>> {
  const checked: IdChecked = {
    id,
    offices: [],
    error: null,
    refusedSince: null,
    groups: [],
    groupsError: null,
  };
  let answered = true;
  try {
    for await (const row of connect.list(auth, 'office', id)) {
      const one = await readOne(auth, row, at);
      checked.offices.push(one.value);
      answered &&= one.answered;
    }
  } catch (error) {
    const refused = failure(error, 'Vitec refuses this login');
    checked.error = refused.detail;
    if (refused.refused) checked.refusedSince = at;
    answered &&= refused.answered;
  }
  // The groups only when the id's own list answered: a refused or silent id gets one call a day.
  if (checked.error !== null) return { value: checked, answered };
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

/** A refusal seen at the last check too keeps its first date, so the day of grace counts on. */
function carryRefusals(ids: IdChecked[], last: OfficesCheck | null): void {
  const seenBefore = new Map(
    (last?.ids ?? []).flatMap((one) => one.offices).map((office) => [office.customerId, office]),
  );
  for (const checked of ids) {
    const before = last?.ids.find((one) => one.id === checked.id);
    if (checked.refusedSince && before?.refusedSince) checked.refusedSince = before.refusedSince;
    for (const office of checked.offices) {
      const seen = seenBefore.get(office.customerId);
      if (office.refusedSince && seen?.refusedSince) office.refusedSince = seen.refusedSince;
    }
  }
}

/**
 * The offices of the last answer that Vitec refuses now, on their own or with their whole id,
 * for less than the day of grace: they stay synced until the refusal has stood a day.
 */
function graced(ids: IdChecked[], last: OfficesCheck | null, at: string): string[] {
  if (!last) return [];
  const listed = new Map(
    ids.flatMap((one) => one.offices).map((office) => [office.customerId, office]),
  );
  const young = (since: string | null): boolean =>
    since !== null && new Date(at).getTime() - new Date(since).getTime() < REFUSAL_GRACE_MS;
  return last.offices.filter((office) => {
    const seen = listed.get(office);
    if (seen) return young(seen.refusedSince);
    // Not listed now: refused with its whole id, when the id that listed it before is refused.
    const under = last.ids.find((one) => one.offices.some((o) => o.customerId === office));
    const now = ids.find((one) => one.id === under?.id);
    return young(now?.refusedSince ?? null);
  });
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
 * for the tenant's page. When Vitec did not answer every call, or listed no office that reads
 * without refusing, the last offices are kept; a refused office stays for its day of grace.
 */
export async function checkOffices(
  connectionId: string,
  auth: connect.Auth,
  crmAuth: connect.Auth,
  ids: readonly string[],
): Promise<OfficesCheck> {
  const at = new Date().toISOString();
  const checked: IdChecked[] = [];
  let answered = true;
  for (const id of ids) {
    const one = await checkId(auth, crmAuth, id, at);
    checked.push(one.value);
    answered &&= one.answered;
  }
  const last = await lastCheck(connectionId);
  carryRefusals(checked, last);
  const fresh = choose(checked);
  const kept = graced(checked, last, at).filter((office) => !fresh.offices.includes(office));
  const offices = [...fresh.offices, ...kept];
  const refused = checked.length > 0 && checked.every((one) => one.refusedSince !== null);
  const choice =
    answered && (offices.length > 0 || refused)
      ? { offices, source: fresh.source }
      : { offices: last?.offices ?? [], source: 'kept' as const };
  const result: OfficesCheck = { at, ids: checked, ...choice };
  await store.setState(connectionId, 'offices_check', JSON.stringify(result));
  // Unanswered: due again within the hour instead of tomorrow.
  const due = answered ? Date.now() : Date.now() - CHECK_EVERY_MS + RETRY_AFTER_MS;
  await store.setState(connectionId, 'offices_check_at', new Date(due).toISOString());
  return result;
}

/** The offices a connection syncs: the ones the last check chose from Vitec, none before it. */
export async function officesOf(connection: { id: string }): Promise<string[]> {
  return (await lastCheck(connection.id))?.offices ?? [];
}

/** Make the worker's next tick check the offices, as the button "Check offices now" does. */
export async function checkSoon(connectionId: string): Promise<void> {
  await store.setState(connectionId, 'offices_check_at', new Date(0).toISOString());
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
        refusedSince: checked.refusedSince ?? null,
        offices: (checked.offices ?? []).map((office) => ({
          ...office,
          refusedSince: office.refusedSince ?? null,
        })),
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
