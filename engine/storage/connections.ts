import { db } from './db.js';
import { decrypt, encrypt, tokenHmac } from './crypto.js';
import type { Connection } from '../adapter-api/types.js';

type ConnectionRow = {
  id: string;
  tenant_id: number;
  provider: string;
  credentials: string | null;
  licensed_offices: string[];
  active: boolean;
};

let credentialsKey = '';

export function configureCredentials(key: string): void {
  tokenHmac('startup check', key); // throws with the fix if the key is not 32 bytes
  credentialsKey = key;
}

const toConnection = (row: ConnectionRow): Connection => ({
  id: row.id,
  tenantId: row.tenant_id,
  provider: row.provider,
  credentials: row.credentials ? decrypt(row.credentials, credentialsKey) : null,
  licensedOffices: row.licensed_offices,
  active: row.active,
});

export async function connectionsForProvider(provider: string): Promise<Connection[]> {
  const { rows } = await db().query<ConnectionRow>(
    'select * from connections where provider = $1 order by id',
    [provider],
  );
  return rows.map(toConnection);
}

export async function connectionById(id: string): Promise<Connection | null> {
  const { rows } = await db().query<ConnectionRow>('select * from connections where id = $1', [id]);
  return rows[0] ? toConnection(rows[0]) : null;
}

/** A new tenant: Core assigns the number, the name is the only thing a person types. */
export async function createTenant(input: { displayName: string; token: string }): Promise<number> {
  const { rows } = await db().query<{ id: number }>(
    'insert into tenants (display_name, token_hmac, token_enc) values ($1, $2, $3) returning id',
    [
      input.displayName,
      tokenHmac(input.token, credentialsKey),
      encrypt(input.token, credentialsKey),
    ],
  );
  return Number(rows[0]?.id);
}

export async function tenantForToken(
  token: string,
): Promise<{ id: number; purgeWatermark: number } | null> {
  const { rows } = await db().query<{ id: number; purge_watermark: string }>(
    'select id, purge_watermark from tenants where token_hmac = $1 and active = true',
    [tokenHmac(token, credentialsKey)],
  );
  return rows[0] ? { id: rows[0].id, purgeWatermark: Number(rows[0].purge_watermark) } : null;
}

/**
 * Add or change a connection. Its name is what a person reads it by; one added without a name
 * takes its id as its name, and one changed without a name keeps the one it has.
 */
export async function upsertConnection(input: {
  id: string;
  tenantId: number;
  provider: string;
  name?: string;
  credentials?: string | null;
  licensedOffices?: string[];
  active?: boolean;
}): Promise<void> {
  await db().query(
    `insert into connections (id, tenant_id, provider, credentials, licensed_offices, active, name)
     values ($1,$2,$3,$4,$5,$6, coalesce($7, $1))
     on conflict (id) do update set
       tenant_id = excluded.tenant_id,
       provider = excluded.provider,
       credentials = coalesce(excluded.credentials, connections.credentials),
       licensed_offices = excluded.licensed_offices,
       active = excluded.active,
       name = coalesce($7, connections.name)`,
    [
      input.id,
      input.tenantId,
      input.provider,
      input.credentials ? encrypt(input.credentials, credentialsKey) : null,
      input.licensedOffices ?? [],
      input.active ?? true,
      input.name ?? null,
    ],
  );
}

export async function setLicensedOffices(connectionId: string, officeIds: string[]): Promise<void> {
  await db().query('update connections set licensed_offices = $2 where id = $1', [
    connectionId,
    officeIds,
  ]);
}

export async function recordIngest(connectionId: string, error?: string): Promise<void> {
  await db().query('update connections set last_ingest_at = now(), last_error = $2 where id = $1', [
    connectionId,
    error ?? null,
  ]);
}

export type SubscriberRow = {
  id: string;
  tenant_id: number;
  label: string;
  bell_url: string;
  /** Stored as sent to the site, so the tenant's page can show it (Patric, 2026-09-20). */
  bell_secret: string;
  active: boolean;
  last_bell_at: Date | null;
  last_bell_status: string | null;
  last_pull_at: Date | null;
  last_client: string | null;
};

const SUBSCRIBER_COLUMNS =
  'id, tenant_id, label, bell_url, bell_secret, active, last_bell_at, last_bell_status, last_pull_at, last_client';

export async function addSubscriber(input: {
  tenantId: number;
  label: string;
  bellUrl: string;
  bellSecret: string;
}): Promise<number> {
  const { rows } = await db().query<{ id: string }>(
    `insert into subscribers (tenant_id, label, bell_url, bell_secret) values ($1,$2,$3,$4) returning id`,
    [input.tenantId, input.label, input.bellUrl, input.bellSecret],
  );
  return Number(rows[0]?.id);
}

/**
 * A pull names the site it came from (Patric, 2026-09-20, "add name"): the `X-Core-Site` header
 * carries the site's own bell URL, and the site with that URL under the tenant is the one that
 * pulled. Without the header, or with one no site of the tenant carries, every site of the tenant
 * counts as pulling, as before. Answers the site's number when one site matched.
 */
export async function recordPull(
  tenantId: number,
  client: string | null,
  site: string | null,
): Promise<number | null> {
  const { rows } = await db().query<{ id: string }>(
    `update subscribers set last_pull_at = now(), last_client = coalesce($2, last_client)
     where tenant_id = $1
       and ($3::text is null
            or bell_url = $3
            or not exists (select 1 from subscribers where tenant_id = $1 and bell_url = $3))
     returning id`,
    [tenantId, client, site],
  );
  return site !== null && rows.length === 1 ? Number(rows[0]?.id) : null;
}

/**
 * The site of a tenant whose bell URL is the one in the `X-Core-Site` header, so a report names
 * the site that sent it exactly as a pull does. Null when the header is absent or matches none.
 */
export async function subscriberByBellUrl(
  tenantId: number,
  site: string | null,
): Promise<number | null> {
  if (!site) return null;
  const { rows } = await db().query<{ id: string }>(
    'select id from subscribers where tenant_id = $1 and bell_url = $2',
    [tenantId, site],
  );
  return rows.length === 1 ? Number(rows[0]?.id) : null;
}

export async function subscribers(): Promise<SubscriberRow[]> {
  const { rows } = await db().query<SubscriberRow>(
    `select ${SUBSCRIBER_COLUMNS} from subscribers order by id`,
  );
  return rows;
}

// ---- What the admin panel lists and changes (docs/admin-panel.md) --------------------------------

export type TenantRow = {
  id: number;
  display_name: string;
  active: boolean;
  purge_watermark: string;
  created_at: Date;
  /** The token its sites pull with, for display on the tenant page; null for tenants made before
   * the token was kept recoverable (they show it again only when it is rotated). */
  token: string | null;
};

export async function tenants(): Promise<TenantRow[]> {
  const { rows } = await db().query<Omit<TenantRow, 'token'> & { token_enc: string | null }>(
    'select id, display_name, active, purge_watermark, created_at, token_enc from tenants order by id',
  );
  return rows.map(({ token_enc, ...tenant }) => ({
    ...tenant,
    token: token_enc ? decrypt(token_enc, credentialsKey) : null,
  }));
}

/** Rename a tenant, give it a new token (hashed like the script does), or switch it off. */
export async function updateTenant(
  id: number,
  changes: { displayName?: string; token?: string; active?: boolean },
): Promise<void> {
  const sets: string[] = [];
  const values: unknown[] = [id];
  const set = (column: string, value: unknown) => {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  };
  if (changes.displayName !== undefined) set('display_name', changes.displayName);
  if (changes.token !== undefined) {
    set('token_hmac', tokenHmac(changes.token, credentialsKey));
    set('token_enc', encrypt(changes.token, credentialsKey));
  }
  if (changes.active !== undefined) set('active', changes.active);
  if (sets.length === 0) return;
  await db().query(`update tenants set ${sets.join(', ')} where id = $1`, values);
}

export type ConnectionListRow = {
  id: string;
  tenant_id: number;
  provider: string;
  /** What a person reads it by; the id is Core's own. */
  name: string;
  licensed_offices: string[];
  active: boolean;
  last_ingest_at: Date | null;
  last_error: string | null;
};

/** Every connection, without its credentials. */
export async function connections(): Promise<ConnectionListRow[]> {
  const { rows } = await db().query<ConnectionListRow>(
    `select id, tenant_id, provider, name, licensed_offices, active, last_ingest_at, last_error
     from connections order by tenant_id, id`,
  );
  return rows;
}

/** Change a site's label, bell URL or secret, or switch it off. */
export async function updateSubscriber(
  id: number,
  changes: {
    label?: string;
    bellUrl?: string;
    bellSecret?: string;
    active?: boolean;
  },
): Promise<void> {
  const sets: string[] = [];
  const values: unknown[] = [id];
  const set = (column: string, value: unknown) => {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  };
  if (changes.label !== undefined) set('label', changes.label);
  if (changes.bellUrl !== undefined) set('bell_url', changes.bellUrl);
  if (changes.bellSecret !== undefined) set('bell_secret', changes.bellSecret);
  if (changes.active !== undefined) set('active', changes.active);
  if (sets.length === 0) return;
  await db().query(`update subscribers set ${sets.join(', ')} where id = $1`, values);
}

/** One tenant, with its token. */
export async function tenantById(id: number): Promise<TenantRow | null> {
  return (await tenants()).find((tenant) => tenant.id === id) ?? null;
}

/** A site is deleted with its row and its history in the event log (Patric, 2026-09-20). */
export async function deleteSubscriber(id: number): Promise<void> {
  await db().query('delete from events where subscriber_id = $1', [id]);
  await db().query('delete from subscribers where id = $1', [id]);
}

/** One connection's row. Its records go with it; the caller tombstones them first. */
export async function deleteConnection(id: string): Promise<void> {
  await db().query('delete from lifecycle_events where connection_id = $1', [id]);
  await db().query('delete from connections where id = $1', [id]);
}
