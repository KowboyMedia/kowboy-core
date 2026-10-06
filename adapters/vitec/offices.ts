// Which offices sit behind the ids a connection names, and whether this login may read each one
// (question 147, answered a on 2026-10-06; built as a proof first). Vitec has no call that lists
// what a login may read: every call names a customer id (M30011) or a group id (G12), and the
// office list of such an id returns one row per office with that office's own customer id. Each
// listed office is then read on its own, so the answer never names an office the login cannot
// read. Reads only. The answer is kept in the adapter's state and shown on the tenant's page.
import * as connect from './api.js';
import * as store from './store.js';

/** One office Vitec listed behind an id, and whether it read on its own. */
export type OfficeSeen = {
  customerId: string;
  officeId: string;
  name: string | null;
  readable: boolean;
  detail: string | null;
};

/** What Vitec answered for one id the connection names. */
export type IdChecked = { id: string; offices: OfficeSeen[]; error: string | null };

export type OfficesCheck = { at: string; ids: IdChecked[] };

const describe = (error: unknown): string =>
  connect.kindOf(error) === 'forbidden'
    ? 'Vitec refuses this login'
    : error instanceof Error
      ? error.message
      : String(error);

async function readOne(auth: connect.Auth, row: connect.ListRow): Promise<OfficeSeen> {
  const seen = { customerId: row.customerId, officeId: row.id, name: null, detail: null };
  try {
    const office = (await connect.getOne(auth, 'office', row.customerId, row.id)) as {
      name?: unknown;
    } | null;
    if (!office) return { ...seen, readable: false, detail: 'Vitec has no such office' };
    return { ...seen, readable: true, name: typeof office.name === 'string' ? office.name : null };
  } catch (error) {
    return { ...seen, readable: false, detail: describe(error) };
  }
}

async function checkId(auth: connect.Auth, id: string): Promise<IdChecked> {
  const offices: OfficeSeen[] = [];
  try {
    for await (const row of connect.list(auth, 'office', id))
      offices.push(await readOne(auth, row));
    return { id, offices, error: null };
  } catch (error) {
    return { id, offices, error: describe(error) };
  }
}

/** Ask Vitec about every id, one after the other, and keep the answer for the tenant's page. */
export async function checkOffices(
  connectionId: string,
  auth: connect.Auth,
  ids: readonly string[],
): Promise<OfficesCheck> {
  const checked: IdChecked[] = [];
  for (const id of ids) checked.push(await checkId(auth, id));
  const result = { at: new Date().toISOString(), ids: checked };
  await store.setState(connectionId, 'offices_check', JSON.stringify(result));
  await store.setState(connectionId, 'offices_check_at', result.at);
  return result;
}

/** The last answer kept for a connection, or null before the first check. */
export async function lastCheck(connectionId: string): Promise<OfficesCheck | null> {
  const stored = await store.getState(connectionId, 'offices_check');
  if (!stored) return null;
  try {
    return JSON.parse(stored) as OfficesCheck;
  } catch {
    return null;
  }
}
