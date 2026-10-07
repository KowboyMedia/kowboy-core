// A tenant is one page and one Save (§3 A, Must; Patric three times: a connection is a setting of
// a tenant, never a page of its own). This file is that page's whole back end: read the tenant
// with everything under it, and write the whole thing back in one call, queueing whatever
// lifecycle events the difference asks for.
import { newSecret } from '../storage/crypto.js';
import {
  addSubscriber,
  connectionById,
  connections as allConnections,
  createTenant,
  deleteConnection,
  deleteSubscriber,
  subscribers,
  tenantById,
  tenants,
  updateSubscriber,
  updateTenant,
  upsertConnection,
  type ConnectionListRow,
} from '../storage/connections.js';
import { queueLifecycle } from '../lifecycle.js';
import { mergedLogin, shownLogin, type ShownLogin } from './login.js';
import { itemCounts } from '../storage/items.js';
import { adminFor, manifestFor } from '../registry.js';
import { connectionNamed, listed, officeNamed, sentence } from './words.js';
import { officeNamesOf } from './scope.js';
import { shownSections, type ShownSection } from './things.js';

export type ConnectionInput = {
  /** Core's own id for a saved connection; absent for one being added, which Core makes. */
  id?: string;
  /** What a person reads it by; they can change it at any time (Patric, 2026-10-07). */
  name: string;
  provider: string;
  /** The adapter's login fields as typed. Absent or empty: the stored login stays. */
  credentials?: Record<string, string> | null;
  licensedOffices: string[];
};

export type SiteInput = {
  /** Absent for a site being added. */
  id?: number;
  label: string;
  bellUrl: string;
};

export type TenantInput = {
  displayName: string;
  active: boolean;
  connections: ConnectionInput[];
  sites: SiteInput[];
};

export type SiteView = {
  id: number;
  label: string;
  bellUrl: string;
  bellSecret: string;
};

export type ConnectionView = ShownLogin & {
  id: string;
  name: string;
  provider: string;
  licensedOffices: string[];
  /** What the adapter itself reports about this connection, as data the panel draws. */
  sections: ShownSection[];
};

export type TenantView = {
  id: number;
  displayName: string;
  active: boolean;
  token: string | null;
  connections: ConnectionView[];
  sites: SiteView[];
};

export type TenantSummary = {
  id: number;
  displayName: string;
  active: boolean;
  connections: number;
  sites: number;
  records: number;
  lastPullAt: string | null;
};

/** The list page: one row per tenant, with the figures that say whether it is working. */
export async function listTenants(): Promise<TenantSummary[]> {
  const [rows, everyConnection, everySite, counts] = await Promise.all([
    tenants(),
    allConnections(),
    subscribers(),
    itemCounts(),
  ]);
  return rows.map((tenant) => {
    const sites = everySite.filter((site) => site.tenant_id === tenant.id);
    const pulls = sites.map((site) => site.last_pull_at?.getTime() ?? 0).filter((time) => time > 0);
    return {
      id: tenant.id,
      displayName: tenant.display_name,
      active: tenant.active,
      connections: everyConnection.filter((one) => one.tenant_id === tenant.id).length,
      sites: sites.length,
      records: counts
        .filter((count) => count.tenant_id === tenant.id)
        .reduce((total, count) => total + Number(count.live), 0),
      lastPullAt: pulls.length > 0 ? new Date(Math.max(...pulls)).toISOString() : null,
    };
  });
}

const siteView = (site: Awaited<ReturnType<typeof subscribers>>[number]): SiteView => ({
  id: Number(site.id),
  label: site.label,
  bellUrl: site.bell_url,
  bellSecret: site.bell_secret,
});

async function connectionView(row: ConnectionListRow): Promise<ConnectionView> {
  const admin = adminFor(row.provider);
  let sections: ShownSection[] = [];
  let stored: string | null = null;
  try {
    // The adapter gets the connection as it is stored, login included: what it reports about a
    // connection often depends on whether the login it holds still reads.
    const connection = await connectionById(row.id);
    stored = connection?.credentials ?? null;
    if (admin?.connection && connection)
      sections = await shownSections(await admin.connection(connection));
  } catch (error) {
    const cause = sentence(error instanceof Error ? error.message : String(error));
    sections = [
      {
        title: 'The CRM’s own report',
        help: `Core could not put this report together just now: ${cause} Nothing changes on the sites. Reload the page in a minute; if this shows again, tell whoever maintains Core.`,
      },
    ];
  }
  return {
    ...shownLogin(stored, row.provider),
    id: row.id,
    name: row.name,
    provider: row.provider,
    licensedOffices: row.licensed_offices,
    sections,
  };
}

/** One tenant with everything its page shows. Null when there is no such tenant. */
export async function readTenant(id: number): Promise<TenantView | null> {
  const tenant = await tenantById(id);
  if (!tenant) return null;
  const [everyConnection, everySite] = await Promise.all([allConnections(), subscribers()]);
  const mine = everyConnection.filter((row) => row.tenant_id === id);
  return {
    id: tenant.id,
    displayName: tenant.display_name,
    active: tenant.active,
    token: tenant.token,
    connections: await Promise.all(mine.map(connectionView)),
    sites: everySite.filter((site) => site.tenant_id === id).map(siteView),
  };
}

/**
 * Nothing typed keeps what is stored; anything typed goes over the stored fields, so one field
 * typed never loses the others. A connection moved to another CRM starts from what is typed.
 */
async function credentialsOf(
  input: Placed,
  before: ConnectionListRow | undefined,
): Promise<string | null> {
  const stored =
    before && before.provider === input.provider
      ? ((await connectionById(input.id))?.credentials ?? null)
      : null;
  return mergedLogin(input.credentials, stored, input.provider);
}

export type SaveResult = { id: number; changes: string[] };

/**
 * An id on the page that is not one of this tenant's own connections, or one sent twice, refused
 * before anything is saved. The page sends an id only for a connection Core gave it, so anything
 * else is a page left open while the tenant changed elsewhere, or a hand-made call: saving it
 * would bring back a removed connection, or move another tenant's, stored login and all.
 */
export async function refuseForeignConnections(
  tenantId: number | null,
  wanted: ConnectionInput[],
): Promise<string | null> {
  const ids = wanted.map((connection) => connection.id).filter((id) => id !== undefined);
  const own = new Set(
    (await allConnections())
      .filter((row) => Number(row.tenant_id) === tenantId)
      .map((row) => row.id),
  );
  if (ids.some((id) => !own.has(id)) || new Set(ids).size !== ids.length)
    return 'Core saved nothing, because this page no longer matches what Core holds. Reload the page and make the change again.';
  return null;
}

/** A connection with its id: the one it has, or the one Core makes for it from its name. */
type Placed = ConnectionInput & { id: string };

/**
 * Core's id for a new connection, made from its name: lower-case letters, digits and dashes,
 * with a number added when another connection has it. Nobody reads it; it only has to last.
 */
function idFrom(name: string, taken: Set<string>): string {
  const base =
    name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'connection';
  let id = base;
  for (let number = 2; taken.has(id); number += 1) id = `${base}-${String(number)}`;
  taken.add(id);
  return id;
}

/** Every connection on the page with an id, new ones given theirs. */
async function placed(wanted: ConnectionInput[]): Promise<Placed[]> {
  const taken = new Set([
    ...(await allConnections()).map((row) => row.id),
    ...wanted.map((connection) => connection.id).filter((id) => id !== undefined),
  ]);
  return wanted.map((connection) => ({
    ...connection,
    name: connection.name.trim(),
    id: connection.id ?? idFrom(connection.name, taken),
  }));
}

/**
 * One Save for the whole page. What changed decides what the adapters are told: a new connection
 * is loaded, offices added or removed are loaded or tombstoned, a connection taken off the page is
 * removed with its records. Nothing here knows a CRM.
 */
export async function saveTenant(id: number | null, input: TenantInput): Promise<SaveResult> {
  const changes: string[] = [];
  let tenantId = id;

  if (tenantId === null) {
    tenantId = await createTenant({ displayName: input.displayName, token: newSecret() });
    changes.push(`Core made the tenant ${input.displayName}; its token is on the page.`);
  } else {
    const before = await tenantById(tenantId);
    if (!before) throw new Error(`There is no tenant number ${tenantId}.`);
    if (before.display_name !== input.displayName)
      changes.push(`The tenant is now called ${input.displayName}.`);
    if (before.active !== input.active)
      changes.push(
        input.active
          ? 'The tenant is enabled: its sites can fetch from Core again.'
          : 'The tenant is disabled: its sites can no longer fetch from Core.',
      );
    await updateTenant(tenantId, { displayName: input.displayName, active: input.active });
  }

  const named = { tenant: input.displayName, id: tenantId };
  changes.push(...(await saveConnections(tenantId, await placed(input.connections), named)));
  changes.push(...(await saveSites(tenantId, input.sites)));
  return { id: tenantId, changes };
}

/** A connection as a person reads it: its tenant and CRM, then its name. */
const connectionName = (tenant: string, provider: string, name: string): string =>
  connectionNamed(name, tenant, provider);

/** The tenant's connections as the page left them, and what each difference asks of the adapter. */
async function saveConnections(
  tenantId: number,
  wanted: Placed[],
  named: { tenant: string; id: number },
): Promise<string[]> {
  const changes: string[] = [];
  const existing = (await allConnections()).filter((row) => row.tenant_id === tenantId);
  const keep = new Set(wanted.map((connection) => connection.id));

  for (const gone of existing.filter((row) => !keep.has(row.id))) {
    // The event tombstones the connection's records before the row goes.
    await queueLifecycle(gone.id, 'connection_removed');
    await deleteConnection(gone.id);
    changes.push(
      `${connectionName(named.tenant, gone.provider, gone.name)} is removed, and its records are being taken off the sites.`,
    );
  }

  for (const given of wanted) {
    // An adapter that takes its offices from the CRM keeps the list empty, whatever was sent.
    const connection = manifestFor(given.provider)?.officesFromCrm
      ? { ...given, licensedOffices: [] }
      : given;
    const before = existing.find((row) => row.id === connection.id);
    await upsertConnection({
      id: connection.id,
      tenantId,
      provider: connection.provider,
      name: connection.name,
      credentials: await credentialsOf(connection, before),
      licensedOffices: connection.licensedOffices,
    });
    if (!before) {
      await queueLifecycle(connection.id, 'connection_added');
      changes.push(
        `${connectionName(named.tenant, connection.provider, connection.name)} is added and loading its records.`,
      );
      continue;
    }
    if (before.name !== connection.name)
      changes.push(
        `${connectionName(named.tenant, before.provider, before.name)} is now called “${connection.name}”.`,
      );
    changes.push(...(await officeChanges(connection, before.licensed_offices, named)));
  }
  return changes;
}

/** An office added is loaded; an office removed takes its records with it. */
async function officeChanges(
  connection: Placed,
  before: string[],
  named: { tenant: string; id: number },
): Promise<string[]> {
  const changes: string[] = [];
  const added = connection.licensedOffices.filter((office) => !before.includes(office));
  const removed = before.filter((office) => !connection.licensedOffices.includes(office));
  const name = connectionName(named.tenant, connection.provider, connection.name);
  if (added.length > 0) {
    await queueLifecycle(connection.id, 'offices_added', { officeIds: added });
    changes.push(`${name} is loading the records of ${await officesNamed(added, named.id)}.`);
  }
  if (removed.length > 0) {
    await queueLifecycle(connection.id, 'offices_removed', { officeIds: removed });
    changes.push(
      `${name} is taking the records of ${await officesNamed(removed, named.id)} off the sites.`,
    );
  }
  return changes;
}

/** Offices by their names, then the CRM's ids for them: "the office Lidingö (the CRM’s office id 100)". */
async function officesNamed(ids: string[], tenantId: number): Promise<string> {
  const names = await officeNamesOf(ids, [tenantId]);
  return listed(
    ids.map((id) => officeNamed(id, names.get(id))),
    ids.length,
  );
}

/** The tenant's sites as the page left them. A new site gets its bell secret here. */
async function saveSites(tenantId: number, wanted: SiteInput[]): Promise<string[]> {
  const changes: string[] = [];
  const existing = (await subscribers()).filter((site) => site.tenant_id === tenantId);
  const keep = new Set(wanted.map((site) => site.id).filter(Boolean));
  for (const gone of existing.filter((site) => !keep.has(Number(site.id)))) {
    await deleteSubscriber(Number(gone.id));
    changes.push(`The site ${gone.label} is removed, with its history.`);
  }
  for (const site of wanted) {
    if (site.id === undefined) {
      await addSubscriber({
        tenantId,
        label: site.label,
        bellUrl: site.bellUrl,
        bellSecret: newSecret(),
      });
      changes.push(`The site ${site.label} is added; its bell secret is on the page.`);
      continue;
    }
    await updateSubscriber(site.id, { label: site.label, bellUrl: site.bellUrl });
  }
  return changes;
}
