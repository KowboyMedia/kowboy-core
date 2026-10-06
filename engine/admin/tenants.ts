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
  deleteTenant,
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
import { queryEvents } from '../events.js';
import { itemCounts } from '../storage/items.js';
import { submissionCounts, type SubmissionCounts } from '../storage/submissions.js';
import { adminFor, manifestFor } from '../registry.js';
import type { AdminSection } from '../adapter-api/types.js';
import { connectionNamed, crmName, listed, officeNamed, sentence } from './words.js';
import { officeNamesOf } from './scope.js';

export type ConnectionInput = {
  id: string;
  provider: string;
  /** The adapter's login fields as typed. Absent or empty: the stored login stays. */
  credentials?: Record<string, string> | null;
  licensedOffices: string[];
  active: boolean;
};

export type SiteInput = {
  /** Absent for a site being added. */
  id?: number;
  label: string;
  bellUrl: string;
  active: boolean;
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
  active: boolean;
  lastPullAt: string | null;
  lastBellAt: string | null;
  lastBellStatus: string | null;
  lastClient: string | null;
  /** What is done and what is left before the site is live (§3 E, Should). */
  checklist: { step: string; done: boolean; detail: string }[];
  /** What this site reported it applied and could not, from its own reports. */
  applied: { applied: number; failed: number };
  /** The last errors this site reported through POST /v1/errors. */
  errors: { at: string; message: string; where: string; detail: string | null }[];
};

export type ConnectionView = ShownLogin & {
  id: string;
  provider: string;
  licensedOffices: string[];
  active: boolean;
  hasCredentials: boolean;
  lastIngestAt: string | null;
  lastError: string | null;
  /** Records loaded so far for this connection, per datatype: the first load's progress. */
  loaded: { datatype: string; live: number }[];
  /** The forms sites sent through Core to this CRM in the last day, by outcome (docs/forms.md). */
  submissions: SubmissionCounts;
  /** What the adapter itself reports about this connection, as data the panel draws. */
  sections: AdminSection[];
};

const DAY_MS = 24 * 60 * 60_000;

export type TenantView = {
  id: number;
  displayName: string;
  active: boolean;
  token: string | null;
  createdAt: string;
  connections: ConnectionView[];
  sites: SiteView[];
  records: { datatype: string; live: number; tombstoned: number }[];
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

async function siteView(site: Awaited<ReturnType<typeof subscribers>>[number]): Promise<SiteView> {
  const id = Number(site.id);
  const [applied, failed, errors] = await Promise.all([
    queryEvents({ subscriberId: id, type: 'site.applied', limit: 1000 }),
    queryEvents({ subscriberId: id, type: 'site.failed', limit: 1000 }),
    queryEvents({ subscriberId: id, type: 'site.error', newestFirst: true, limit: 20 }),
  ]);
  const bellOk = site.last_bell_status === 'ok';
  return {
    id,
    label: site.label,
    bellUrl: site.bell_url,
    bellSecret: site.bell_secret,
    active: site.active,
    lastPullAt: site.last_pull_at?.toISOString() ?? null,
    lastBellAt: site.last_bell_at?.toISOString() ?? null,
    lastBellStatus: site.last_bell_status,
    lastClient: site.last_client,
    checklist: [
      {
        step: 'The token is in the site',
        done: site.last_pull_at !== null,
        detail:
          site.last_pull_at === null
            ? 'Paste the tenant token into the site and let it sync once.'
            : `It pulled ${site.last_client ? `as ${site.last_client}` : ''}.`.trim(),
      },
      {
        step: 'The bell secret is in the site',
        done: bellOk,
        detail: bellOk
          ? 'The site answered the last bell.'
          : site.last_bell_at === null
            ? 'Nothing has been rung yet. Press Ring to try it.'
            : `The site answered “${site.last_bell_status}”.`,
      },
      {
        step: 'It has taken records',
        done: applied.length > 0,
        detail:
          applied.length > 0
            ? `${applied.length} record(s) reported applied.`
            : 'No applied report has arrived yet.',
      },
    ],
    applied: { applied: applied.length, failed: failed.length },
    errors: errors.map((event) => ({
      at: event.at.toISOString(),
      message: String(event.fields['message'] ?? ''),
      where: String(event.fields['where'] ?? ''),
      detail: event.fields['detail'] === null ? null : String(event.fields['detail'] ?? ''),
    })),
  };
}

async function connectionView(
  row: ConnectionListRow,
  counts: Awaited<ReturnType<typeof itemCounts>>,
): Promise<ConnectionView> {
  const admin = adminFor(row.provider);
  let sections: AdminSection[] = [];
  let stored: string | null = null;
  try {
    // The adapter gets the connection as it is stored, login included: what it reports about a
    // connection often depends on whether the login it holds still reads.
    const connection = await connectionById(row.id);
    stored = connection?.credentials ?? null;
    if (admin?.connection && connection) sections = await admin.connection(connection);
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
    provider: row.provider,
    licensedOffices: row.licensed_offices,
    active: row.active,
    hasCredentials: row.has_credentials,
    lastIngestAt: row.last_ingest_at?.toISOString() ?? null,
    lastError: row.last_error,
    submissions: await submissionCounts(row.id, DAY_MS),
    loaded: counts
      .filter((count) => count.tenant_id === row.tenant_id)
      .map((count) => ({ datatype: count.datatype, live: Number(count.live) })),
    sections,
  };
}

/** One tenant with everything its page shows. Null when there is no such tenant. */
export async function readTenant(id: number): Promise<TenantView | null> {
  const tenant = await tenantById(id);
  if (!tenant) return null;
  const [everyConnection, everySite, counts] = await Promise.all([
    allConnections(),
    subscribers(),
    itemCounts(),
  ]);
  const mine = everyConnection.filter((row) => row.tenant_id === id);
  const sites = everySite.filter((site) => site.tenant_id === id);
  return {
    id: tenant.id,
    displayName: tenant.display_name,
    active: tenant.active,
    token: tenant.token,
    createdAt: tenant.created_at.toISOString(),
    connections: await Promise.all(mine.map((row) => connectionView(row, counts))),
    sites: await Promise.all(sites.map(siteView)),
    records: counts
      .filter((count) => count.tenant_id === id)
      .map((count) => ({
        datatype: count.datatype,
        live: Number(count.live),
        tombstoned: Number(count.tombstoned),
      })),
  };
}

/**
 * Nothing typed keeps what is stored; anything typed goes over the stored fields, so one field
 * typed never loses the others. A connection moved to another CRM starts from what is typed.
 */
async function credentialsOf(
  input: ConnectionInput,
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
 * A short name another tenant's connection holds, or one typed twice, refused before anything is
 * saved: Core files a connection by its short name alone, so saving it here would move the other
 * tenant's connection, with its stored login, to this tenant.
 */
export async function refuseShortNames(
  tenantId: number | null,
  wanted: ConnectionInput[],
): Promise<string | null> {
  const seen = new Set<string>();
  for (const { id } of wanted) {
    if (seen.has(id))
      return `Two connections on this page have the short name ${id}, so Core saved nothing. Give each its own short name.`;
    seen.add(id);
  }
  const everyConnection = await allConnections();
  for (const { id } of wanted) {
    const owner = everyConnection.find((row) => row.id === id);
    if (!owner || Number(owner.tenant_id) === tenantId) continue;
    const tenant = (await tenantById(owner.tenant_id))?.display_name ?? 'another tenant';
    return `The short name ${id} already belongs to ${tenant}’s ${crmName(owner.provider)} connection, so Core saved nothing. Type another short name for this connection.`;
  }
  return null;
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
  changes.push(...(await saveConnections(tenantId, input.connections, named)));
  changes.push(...(await saveSites(tenantId, input.sites)));
  return { id: tenantId, changes };
}

/** A connection as a person reads it: its tenant and CRM, then its short name. */
const connectionName = (tenant: string, provider: string, id: string): string =>
  connectionNamed(id, tenant, provider);

/** The tenant's connections as the page left them, and what each difference asks of the adapter. */
async function saveConnections(
  tenantId: number,
  wanted: ConnectionInput[],
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
      `${connectionName(named.tenant, gone.provider, gone.id)}, is removed, and its records are being taken off the sites.`,
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
      credentials: await credentialsOf(connection, before),
      licensedOffices: connection.licensedOffices,
      active: connection.active,
    });
    if (!before) {
      await queueLifecycle(connection.id, 'connection_added');
      changes.push(
        `${connectionName(named.tenant, connection.provider, connection.id)}, is added and loading its records.`,
      );
      continue;
    }
    changes.push(...(await officeChanges(connection, before.licensed_offices, named)));
  }
  return changes;
}

/** An office added is loaded; an office removed takes its records with it. */
async function officeChanges(
  connection: ConnectionInput,
  before: string[],
  named: { tenant: string; id: number },
): Promise<string[]> {
  const changes: string[] = [];
  const added = connection.licensedOffices.filter((office) => !before.includes(office));
  const removed = before.filter((office) => !connection.licensedOffices.includes(office));
  const name = connectionName(named.tenant, connection.provider, connection.id);
  if (added.length > 0) {
    await queueLifecycle(connection.id, 'offices_added', { officeIds: added });
    changes.push(`${name}, is loading the records of ${await officesNamed(added, named.id)}.`);
  }
  if (removed.length > 0) {
    await queueLifecycle(connection.id, 'offices_removed', { officeIds: removed });
    changes.push(
      `${name}, is taking the records of ${await officesNamed(removed, named.id)} off the sites.`,
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
    await updateSubscriber(site.id, {
      label: site.label,
      bellUrl: site.bellUrl,
      active: site.active,
    });
  }
  return changes;
}

/** "Remove everything": the tenant, its connections, its sites, its records and its history. */
export async function removeTenant(id: number): Promise<void> {
  for (const connection of (await allConnections()).filter((row) => row.tenant_id === id)) {
    await queueLifecycle(connection.id, 'connection_removed');
  }
  await deleteTenant(id);
}
