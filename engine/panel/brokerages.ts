// Brokerages (design B, images 06 to 12 and 23 to 38): the list of tenants, one tenant's page with
// its websites, its CRM connections, its token and its switch, and the changes a person makes
// there. B says "brokerage" for a tenant and "website" for a site. The engine sends facts and the
// panel words them; no CRM is named here. What a CRM's login holds is the adapter's: the engine
// hands on the fields the adapter declares and never knows what one of them means.
import { db } from '../storage/db.js';
import { decrypt, newSecret } from '../storage/crypto.js';
import {
  createTenant,
  deleteSubscriber,
  addSubscriber,
  tenantById,
  updateTenant,
} from '../storage/connections.js';
import { ring } from '../bells.js';
import { healthReport, sitesFound, SITES_CHECK } from '../health.js';
import { adminFor, adminProviders } from '../registry.js';
import { DATATYPES, type Connection, type Datatype } from '../adapter-api/types.js';
import { crmName, inbox, type Card } from './inbox.js';

/** A brokerage as the list and its page badge it: OK, Needs a look, or Off. */
export type Status = 'ok' | 'look' | 'off';

export type BrokerageRow = {
  id: number;
  name: string;
  status: Status;
  /** One of its connections holds its forms in Core. */
  formsTestMode: boolean;
  websites: number;
  /** The offices on its websites: the office records Core holds for it. */
  offices: number;
};

/** A field of a CRM's login, as the CRM's code declares it. */
export type CrmField = {
  key: string;
  label: string;
  help: string | null;
  secret: boolean;
  required: boolean;
  /** A fixed set of values instead of free text. */
  options: string[] | null;
};

/** A CRM Core can connect to, by its provider, with what its login asks. */
export type Crm = { provider: string; name: string; fields: CrmField[] };

export type Website = {
  id: number;
  label: string;
  bellUrl: string;
  bellSecret: string;
  /** What fetched last, as the site said it: its platform and version. Null before its first fetch. */
  client: { platform: string; version: string | null } | null;
  lastFetchAt: string | null;
  /** The sites check finds it behind: told about changes over an hour ago and not fetched since. */
  behind: boolean;
  /** It has not fetched since the brokerage's token was last replaced. */
  waitingForToken: boolean;
};

export type ConnectionView = {
  id: string;
  provider: string;
  crm: string;
  name: string;
  /** The login's fields that are not secret, by key, as saved. */
  login: Record<string, string>;
  /** Live records by type. */
  counts: Record<Datatype, number>;
  /** The office records Core holds, by name. */
  offices: string[];
  formsTestMode: boolean;
  formsTestModeSince: string | null;
  /** The actions the CRM's code offers for this connection, by id. */
  actions: string[];
};

export type Brokerage = {
  now: string;
  id: number;
  name: string;
  active: boolean;
  status: Status;
  /** Null for a brokerage made before Core kept its token recoverable. */
  token: string | null;
  tokenReplacedAt: string | null;
  /** Core's address, which a website needs with the token. */
  coreUrl: string;
  websites: Website[];
  crms: Crm[];
  connections: ConnectionView[];
};

/** An office of one connection, with its properties. */
export type Office = { id: string; name: string; properties: number };

const iso = (at: Date | null | undefined): string | null => (at ? at.toISOString() : null);

/** The CRMs registered with a panel, in registration order, with their login fields. */
export function crms(): Crm[] {
  return adminProviders().map((provider) => ({
    provider,
    name: crmName(provider),
    fields: (adminFor(provider)?.credentials ?? []).map((field) => ({
      key: field.key,
      label: field.label,
      help: field.help ?? null,
      secret: field.secret === true,
      required: field.required === true,
      options: field.options ? field.options.map((option) => option.value) : null,
    })),
  }));
}

/** The brokerages an Inbox card names, which therefore need a look. */
function tenantsOf(cards: Card[]): Set<number> {
  const ids = new Set<number>();
  for (const card of cards) {
    if (card.kind === 'forms') ids.add(card.tenant.id);
    if ((card.kind === 'login' || card.kind === 'site') && card.tenant) ids.add(card.tenant.id);
    if (card.kind === 'check') for (const tenant of card.tenants) ids.add(tenant.id);
  }
  return ids;
}

/** Brokerages with a site that has not fetched since their token was replaced. */
async function waitingForToken(): Promise<Set<number>> {
  const { rows } = await db().query<{ id: number }>(
    `select distinct t.id from tenants t join subscribers s on s.tenant_id = t.id
     where t.token_replaced_at is not null
       and coalesce(s.last_pull_at, '-infinity') < t.token_replaced_at`,
  );
  return new Set(rows.map((row) => Number(row.id)));
}

const statusOf = (id: number, active: boolean, look: Set<number>): Status =>
  !active ? 'off' : look.has(id) ? 'look' : 'ok';

async function needingALook(): Promise<Set<number>> {
  const [{ cards }, waiting] = await Promise.all([inbox(), waitingForToken()]);
  return new Set([...tenantsOf(cards), ...waiting]);
}

/** `GET /v1/panel/brokerages`: every brokerage, by name. */
export async function brokerageList(): Promise<BrokerageRow[]> {
  const [{ rows }, look] = await Promise.all([
    db().query<{
      id: number;
      display_name: string;
      active: boolean;
      websites: string;
      offices: string;
      test_mode: boolean;
    }>(
      `select t.id, t.display_name, t.active,
         (select count(*) from subscribers s where s.tenant_id = t.id) as websites,
         (select count(*) from items i
          where i.tenant_id = t.id and i.datatype = 'office' and not i.deleted) as offices,
         exists (select 1 from connections c where c.tenant_id = t.id and c.forms_dry_run) as test_mode
       from tenants t order by lower(t.display_name), t.id`,
    ),
    needingALook(),
  ]);
  return rows.map((row) => ({
    id: Number(row.id),
    name: row.display_name,
    status: statusOf(Number(row.id), row.active, look),
    formsTestMode: row.test_mode,
    websites: Number(row.websites),
    offices: Number(row.offices),
  }));
}

/** `platform/version`, as a site's client names itself on a fetch. */
function clientOf(given: string | null): Website['client'] {
  if (!given) return null;
  const [platform = '', version] = given.split('/');
  return { platform: platform.toLowerCase(), version: version ?? null };
}

/** The login's fields that are not secret, as saved: what the panel may show of a login. */
function shownLogin(
  provider: string,
  credentials: string | null,
  key: string,
): Record<string, string> {
  if (!credentials) return {};
  let saved: unknown;
  try {
    saved = JSON.parse(decrypt(credentials, key));
  } catch {
    return {};
  }
  if (!saved || typeof saved !== 'object') return {};
  const shown: Record<string, string> = {};
  for (const field of adminFor(provider)?.credentials ?? []) {
    const value = (saved as Record<string, unknown>)[field.key];
    if (!field.secret && (typeof value === 'string' || typeof value === 'number')) {
      shown[field.key] = String(value);
    }
  }
  return shown;
}

/** The actions a CRM's code offers for one connection, by id; none when it offers no view. */
async function actionsOf(provider: string, connection: Connection): Promise<string[]> {
  const admin = adminFor(provider);
  if (!admin?.connection) return [];
  try {
    const sections = await admin.connection(connection);
    return sections.flatMap((section) => (section.actions ?? []).map((action) => action.id));
  } catch {
    return [];
  }
}

const zeroCounts = (): Record<Datatype, number> =>
  Object.fromEntries(DATATYPES.map((datatype) => [datatype, 0])) as Record<Datatype, number>;

/** `GET /v1/panel/brokerages/<id>`: one brokerage's page. */
export async function brokerage(
  id: number,
  settings: { coreUrl: string; credentialsKey: string },
): Promise<Brokerage | null> {
  const tenant = await tenantById(id);
  if (!tenant) return null;
  const [{ rows: replaced }, sites, connections, counts, offices, health, look] = await Promise.all(
    [
      db().query<{ token_replaced_at: Date | null }>(
        'select token_replaced_at from tenants where id = $1',
        [id],
      ),
      db().query<{
        id: string;
        label: string;
        bell_url: string;
        bell_secret: string;
        last_pull_at: Date | null;
        last_client: string | null;
      }>(
        `select id, label, bell_url, bell_secret, last_pull_at, last_client
         from subscribers where tenant_id = $1 order by id`,
        [id],
      ),
      db().query<{
        id: string;
        provider: string;
        name: string;
        credentials: string | null;
        licensed_offices: string[];
        forms_dry_run: boolean;
        forms_dry_run_since: Date | null;
      }>(
        `select id, provider, name, credentials, licensed_offices, forms_dry_run, forms_dry_run_since
         from connections where tenant_id = $1 order by id`,
        [id],
      ),
      db().query<{ connection_id: string; datatype: Datatype; n: string }>(
        `select connection_id, datatype, count(*) as n from items
         where tenant_id = $1 and not deleted group by connection_id, datatype`,
        [id],
      ),
      db().query<{ connection_id: string; name: string | null }>(
        `select connection_id, data->>'name' as name from items
         where tenant_id = $1 and datatype = 'office' and not deleted
         order by lower(coalesce(data->>'name', remote_id))`,
        [id],
      ),
      healthReport(),
      needingALook(),
    ],
  );
  const replacedAt = replaced[0]?.token_replaced_at ?? null;
  const behind = new Set((sitesFound(health.checks[SITES_CHECK]) ?? []).map((site) => site.id));
  const views: ConnectionView[] = [];
  for (const row of connections.rows) {
    const count = zeroCounts();
    for (const one of counts.rows) {
      if (one.connection_id === row.id) count[one.datatype] = Number(one.n);
    }
    const connection: Connection = {
      id: row.id,
      tenantId: id,
      provider: row.provider,
      credentials: row.credentials ? decrypt(row.credentials, settings.credentialsKey) : null,
      licensedOffices: row.licensed_offices,
    };
    views.push({
      id: row.id,
      provider: row.provider,
      crm: crmName(row.provider),
      name: row.name,
      login: shownLogin(row.provider, row.credentials, settings.credentialsKey),
      counts: count,
      offices: offices.rows
        .filter((office) => office.connection_id === row.id && office.name)
        .map((office) => office.name ?? ''),
      formsTestMode: row.forms_dry_run,
      formsTestModeSince: row.forms_dry_run ? iso(row.forms_dry_run_since) : null,
      actions: await actionsOf(row.provider, connection),
    });
  }
  return {
    now: new Date().toISOString(),
    id,
    name: tenant.display_name,
    active: tenant.active,
    status: statusOf(id, tenant.active, look),
    token: tenant.token,
    tokenReplacedAt: iso(replacedAt),
    coreUrl: settings.coreUrl,
    websites: sites.rows.map((site) => ({
      id: Number(site.id),
      label: site.label,
      bellUrl: site.bell_url,
      bellSecret: site.bell_secret,
      client: clientOf(site.last_client),
      lastFetchAt: iso(site.last_pull_at),
      behind: behind.has(Number(site.id)),
      waitingForToken:
        replacedAt !== null && (site.last_pull_at === null || site.last_pull_at < replacedAt),
    })),
    crms: crms(),
    connections: views,
  };
}

/** `GET /v1/panel/connections/<id>/offices`: the offices on the websites, with their properties. */
export async function officesOf(connectionId: string): Promise<Office[] | null> {
  const { rows: exists } = await db().query('select 1 from connections where id = $1', [
    connectionId,
  ]);
  if (exists.length === 0) return null;
  const { rows } = await db().query<{ id: string; name: string | null; properties: string }>(
    `select o.remote_id as id, o.data->>'name' as name,
       (select count(*) from items p
        where p.connection_id = o.connection_id and p.datatype = 'property'
          and p.office_id = o.remote_id and not p.deleted) as properties
     from items o
     where o.connection_id = $1 and o.datatype = 'office' and not o.deleted
     order by lower(coalesce(o.data->>'name', o.remote_id))`,
    [connectionId],
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name ?? row.id,
    properties: Number(row.properties),
  }));
}

// ---- Changes ---------------------------------------------------------------------------------------

/** A new brokerage and its token. */
export async function createBrokerage(name: string): Promise<number> {
  return createTenant({ displayName: name, token: newSecret() });
}

/**
 * Switch a brokerage on or off. Off, its websites can no longer fetch or send forms and keep their
 * last copy; Core goes on reading its CRMs. Switched on again, its websites are told to fetch what
 * changed meanwhile.
 */
export async function switchBrokerage(id: number, on: boolean): Promise<boolean> {
  if (!(await tenantById(id))) return false;
  await updateTenant(id, { active: on });
  if (on) await ring(id);
  return true;
}

/** A new token for a brokerage; the old one stops working at once. */
export async function replaceToken(id: number): Promise<string | null> {
  if (!(await tenantById(id))) return null;
  const token = newSecret();
  await updateTenant(id, { token });
  await db().query('update tenants set token_replaced_at = now() where id = $1', [id]);
  return token;
}

/** A website for a brokerage, with a bell secret Core makes. */
export async function addWebsite(
  tenantId: number,
  input: { label: string; bellUrl: string },
): Promise<number | null> {
  if (!(await tenantById(tenantId))) return null;
  return addSubscriber({
    tenantId,
    label: input.label,
    bellUrl: input.bellUrl,
    bellSecret: newSecret(),
  });
}

/** Remove a website: Core stops telling it about changes and deletes its history. */
export async function removeWebsite(id: number): Promise<boolean> {
  const { rows } = await db().query('select 1 from subscribers where id = $1', [id]);
  if (rows.length === 0) return false;
  await deleteSubscriber(id);
  return true;
}
