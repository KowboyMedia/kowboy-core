// Trying a brokerage's records again from the Inbox (design B, rows 38 and 39): the records a
// check says can't be loaded go back to the CRM's code, which fetches each one again. A fetch is a
// read from the CRM, never a write. The engine names no CRM: any CRM's code that tries records
// again takes the action RETRY_RECORDS through its `act`, as the panel's other actions reach it
// (connections.ts), with the records as one parameter.
import { connectionById } from '../storage/connections.js';
import { report } from '../errors.js';
import { adminFor } from '../registry.js';
import type { Connection, Datatype } from '../adapter-api/types.js';
import type { Refusal } from './connections.js';
import { failureWords } from './failure.js';
import { crmName } from './inbox.js';
import { actOn } from './problems.js';

/**
 * The action a CRM's code takes to fetch records again now. Its one parameter, `records`, is a
 * JSON list of `{ connection, datatype, id }`: Core's id for the connection, the record's type
 * and the CRM's id for it, as the check named them.
 */
export const RETRY_RECORDS = 'retry_records';

/** How many records one press sends: as many as a check names, and some to spare. */
const MOST = 500;

const DATATYPES: readonly string[] = [
  'property',
  'agent',
  'office',
  'area',
  'association',
  'project',
] satisfies Datatype[];

type Wanted = { connection: string; datatype: Datatype; id: string };

/** The records asked for, as the panel sent them; null when one is not a record. */
function wantedOf(given: unknown): Wanted[] | null {
  if (!Array.isArray(given) || given.length === 0 || given.length > MOST) return null;
  const wanted: Wanted[] = [];
  for (const one of given as unknown[]) {
    if (!one || typeof one !== 'object') return null;
    const { connection, datatype, id } = one as Record<string, unknown>;
    if (typeof connection !== 'string' || typeof id !== 'string' || id === '') return null;
    if (typeof datatype !== 'string' || !DATATYPES.includes(datatype)) return null;
    wanted.push({ connection, datatype: datatype as Datatype, id });
  }
  return wanted;
}

/** The connections the records are of, each the brokerage's own; null when one is not. */
async function connectionsOf(
  tenantId: number,
  wanted: Wanted[],
): Promise<Map<string, Connection> | null> {
  const connections = new Map<string, Connection>();
  for (const { connection: id } of wanted) {
    if (connections.has(id)) continue;
    const connection = await connectionById(id);
    if (!connection || connection.tenantId !== tenantId) return null;
    connections.set(id, connection);
  }
  return connections;
}

type Failed = { ok: false; why: Refusal; said?: string };

/**
 * Ask each CRM's code to fetch its records again: null when each took the request, else why not,
 * with the words of what failed (failure.ts).
 */
async function askEach(
  wanted: Wanted[],
  connections: Map<string, Connection>,
): Promise<Failed | null> {
  const byProvider = new Map<string, Wanted[]>();
  for (const one of wanted) {
    const provider = connections.get(one.connection)?.provider ?? '';
    byProvider.set(provider, [...(byProvider.get(provider) ?? []), one]);
  }
  for (const [provider, records] of byProvider) {
    const admin = adminFor(provider);
    if (!admin) return { ok: false, why: 'missing' };
    const theirs = [...connections.values()].filter((one) => one.provider === provider);
    try {
      await admin.act(RETRY_RECORDS, { records: JSON.stringify(records) }, theirs);
    } catch (error) {
      report(error, { where: 'panel retry records', provider, records: records.length });
      return { ok: false, why: 'crm', said: failureWords(error, crmName(provider)) };
    }
  }
  return null;
}

/**
 * Have the brokerage's records fetched again, each by the code of its connection's CRM. Only
 * records of the brokerage's own connections go. With the key of the Inbox's card, its problem
 * waits, by the person who pressed, until the records load or Core gives up on one again.
 */
export async function retryRecords(
  tenantId: number,
  given: unknown,
  card: { key: string; by: string } | null,
): Promise<{ ok: true } | Failed> {
  const wanted = wantedOf(given);
  if (!wanted) return { ok: false, why: 'fields' };
  const connections = await connectionsOf(tenantId, wanted);
  if (!connections) return { ok: false, why: 'missing' };
  const asked = await askEach(wanted, connections);
  if (asked !== null) return asked;
  if (card) await actOn(card.key, card.by, tenantId);
  return { ok: true };
}
