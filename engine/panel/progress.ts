// How a CRM connection is coming along (question 199 a; design B rows 33, 41, 56, 64, 71, 75, 91
// and 111): what the CRM's code tells through `progress()`, whether its CRM has sent the first
// notice, how far the first load has come and what the last office check found and changed, with
// the names Core holds and what Core itself knows of an office a check added: its properties, and
// whether the websites have them. Every word of a step, of why an office stays off and of how
// changes arrive meanwhile is the CRM's code's; the engine adds facts, never words, and names no CRM.
import { db } from '../storage/db.js';
import { connectionById } from '../storage/connections.js';
import { report } from '../errors.js';
import { adminFor } from '../registry.js';
import {
  DATATYPES,
  type AdminStep,
  type AdminValue,
  type Connection,
  type ConnectionProgress,
  type Datatype,
} from '../adapter-api/types.js';
import { crmName, recordNames } from './inbox.js';
import { shownValues, type ShownValue } from './sections.js';

/** A step the CRM's code asks of someone at the CRM, as the panel shows it. */
export type ShownStep = {
  text: string;
  value: ShownValue;
  /** The value is a secret: masked, with a way to show and copy it. */
  secret: boolean;
  help: string | null;
  note: { text: string; state: 'ok' | 'bad' | 'warn' | 'muted' } | null;
};

/** An office the last office check added, and how far its records have come. */
export type AddedOffice = {
  name: string;
  /** Its live properties in Core. */
  properties: number;
  /** Its records still waiting on the CRM's code's fetch list; null when the code does not say. */
  waiting: number | null;
  /** How many of the tenant's websites fetched since its records last changed. */
  websites: number;
};

export type Progress = {
  /** The CRM has sent no notice yet: since when Core waits, what to ask for, and the meanwhile. */
  firstNotice: { since: string; steps: ShownStep[]; meanwhile: string } | null;
  /** The first load: what the CRM listed, by type, how many of them are fetched, and if it is done. */
  firstLoad: {
    listed: Record<Datatype, number>;
    loaded: Record<Datatype, number>;
    done: boolean;
  } | null;
  /** The last office check: the offices on the websites, those left off and why, and its changes. */
  officeCheck: {
    at: string;
    on: { name: string; addedAt: string | null }[];
    off: { name: string; why: string }[];
    added: AddedOffice[];
    removed: string[];
  } | null;
  /** Since when the CRM's code holds back the connection's changes; null while it does not. */
  heldSince: string | null;
};

const counts = (given: Partial<Record<Datatype, number>> = {}): Record<Datatype, number> =>
  Object.fromEntries(DATATYPES.map((datatype) => [datatype, given[datatype] ?? 0])) as Record<
    Datatype,
    number
  >;

async function shownSteps(steps: AdminStep[], coreUrl: string): Promise<ShownStep[]> {
  const values = await shownValues(
    steps.map((step): AdminValue => step.value ?? null),
    coreUrl,
  );
  return steps.map((step, index) => ({
    text: step.text,
    value: values[index] ?? null,
    secret: step.secret === true,
    help: step.help ?? null,
    note: step.note ?? null,
  }));
}

function firstLoadShown(given: ConnectionProgress['firstLoad']): Progress['firstLoad'] {
  if (!given) return null;
  const listed = counts(given.listed);
  const waiting = counts(given.waiting);
  const loaded = counts(
    Object.fromEntries(
      DATATYPES.map((datatype) => [datatype, Math.max(0, listed[datatype] - waiting[datatype])]),
    ),
  );
  return { listed, loaded, done: given.done };
}

/** What Core holds of each added office: its live properties, and when its records last changed. */
async function heldOf(
  connection: Connection,
  offices: string[],
): Promise<Map<string, { properties: number; changed: Date | null }>> {
  if (offices.length === 0) return new Map();
  const { rows } = await db().query<{
    office_id: string;
    properties: string;
    changed: Date | null;
  }>(
    `select office_id,
       count(*) filter (where datatype = 'property' and not deleted) as properties,
       max(updated_at) filter (where not deleted) as changed
     from items where connection_id = $1 and office_id = any($2::text[])
     group by office_id`,
    [connection.id, offices],
  );
  return new Map(
    rows.map((row) => [
      row.office_id,
      { properties: Number(row.properties), changed: row.changed },
    ]),
  );
}

/** When each of the tenant's websites last fetched. */
async function fetchedAt(tenantId: number): Promise<(Date | null)[]> {
  const { rows } = await db().query<{ last_pull_at: Date | null }>(
    'select last_pull_at from subscribers where tenant_id = $1',
    [tenantId],
  );
  return rows.map((row) => row.last_pull_at);
}

/** The records of an office still on the CRM's code's fetch list; null when the code does not say. */
async function waitingIn(connection: Connection, office: string): Promise<number | null> {
  const admin = adminFor(connection.provider);
  if (!admin?.queueCount) return null;
  try {
    return (await admin.queueCount([connection], { officeIds: [office] })).waiting;
  } catch (error) {
    report(error, { where: 'panel office fetch list', provider: connection.provider });
    return null;
  }
}

async function officeCheckShown(
  connection: Connection,
  given: ConnectionProgress['officeCheck'],
): Promise<Progress['officeCheck']> {
  if (!given) return null;
  const names = await recordNames(
    given.on.map((one) => ({ connection: connection.id, office: one.office })),
  );
  const nameOf = (office: string): string =>
    names.get(`${connection.id} office ${office}`) ??
    given.on.find((one) => one.office === office)?.name ??
    office;
  const [held, fetched] = await Promise.all([
    heldOf(connection, given.added),
    fetchedAt(connection.tenantId),
  ]);
  const added: AddedOffice[] = [];
  for (const office of given.added) {
    const its = held.get(office);
    const changed = its?.changed ?? null;
    added.push({
      name: nameOf(office),
      properties: its?.properties ?? 0,
      waiting: await waitingIn(connection, office),
      websites: fetched.filter((at) => at !== null && (changed === null || at >= changed)).length,
    });
  }
  return {
    at: given.at,
    on: given.on.map((one) => ({ name: nameOf(one.office), addedAt: one.addedAt })),
    off: given.off,
    added,
    removed: given.removed,
  };
}

/** How a connection is coming along, as its CRM's code tells it; null when the code tells nothing. */
export async function progressOf(
  connection: Connection,
  coreUrl: string,
): Promise<Progress | null> {
  const admin = adminFor(connection.provider);
  if (!admin?.progress) return null;
  let given: ConnectionProgress;
  try {
    given = await admin.progress(connection);
  } catch (error) {
    report(error, { where: 'panel connection progress', provider: connection.provider });
    return null;
  }
  return {
    firstNotice: given.firstNotice
      ? {
          since: given.firstNotice.since,
          steps: await shownSteps(given.firstNotice.steps, coreUrl),
          meanwhile: given.firstNotice.meanwhile,
        }
      : null,
    firstLoad: firstLoadShown(given.firstLoad),
    officeCheck: await officeCheckShown(connection, given.officeCheck),
    heldSince: given.heldSince ?? null,
  };
}

/**
 * A CRM connection still being set up (rows 41 and 71): its CRM has sent no notice yet. The Inbox
 * shows it under "Waiting" until the first notice comes, with what to ask the CRM's admin for.
 */
export type SetupCard = {
  kind: 'setup';
  key: string;
  tenant: { id: number; name: string };
  crm: string;
  connectionId: string;
  /** When Core began waiting for the CRM's first notice. */
  since: string;
  /** The tenant's websites, which get changes only as the CRM's code says meanwhile. */
  sites: string[];
  steps: ShownStep[];
  meanwhile: string;
  /** Since when forms test mode holds the connection's forms; null while it is off. */
  formsTestMode: { since: string | null } | null;
};

/** Every connection of a tenant that is on whose CRM has sent no notice yet, oldest first. */
export async function setupCards(coreUrl: string): Promise<SetupCard[]> {
  const { rows } = await db().query<{
    id: string;
    tenant_id: number;
    tenant: string;
    provider: string;
    forms_dry_run: boolean;
    forms_dry_run_since: Date | null;
    sites: string[];
  }>(
    `select c.id, c.tenant_id, t.display_name as tenant, c.provider, c.forms_dry_run,
       c.forms_dry_run_since,
       array(select s.label from subscribers s where s.tenant_id = t.id order by s.id) as sites
     from connections c join tenants t on t.id = c.tenant_id
     where t.active order by c.id`,
  );
  const cards: SetupCard[] = [];
  for (const row of rows) {
    const admin = adminFor(row.provider);
    if (!admin?.progress) continue;
    const connection = await connectionById(row.id);
    if (!connection) continue;
    let waiting: ConnectionProgress['firstNotice'];
    try {
      waiting = (await admin.progress(connection)).firstNotice;
    } catch (error) {
      report(error, { where: 'panel setup card', provider: row.provider });
      continue;
    }
    if (!waiting) continue;
    cards.push({
      kind: 'setup',
      key: `setup:${row.id}`,
      tenant: { id: Number(row.tenant_id), name: row.tenant },
      crm: crmName(row.provider),
      connectionId: row.id,
      since: waiting.since,
      sites: row.sites,
      steps: await shownSteps(waiting.steps, coreUrl),
      meanwhile: waiting.meanwhile,
      formsTestMode: row.forms_dry_run
        ? { since: row.forms_dry_run_since ? row.forms_dry_run_since.toISOString() : null }
        : null,
    });
  }
  return cards.sort((a, b) => a.since.localeCompare(b.since));
}
