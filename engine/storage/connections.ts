import { db } from './db.js';
import { decrypt, encrypt, tokenHmac } from './crypto.js';
import type { Connection } from '../adapter-api/types.js';

type ConnectionRow = {
  id: string;
  tenant_id: string;
  provider: string;
  credentials: string | null;
  licensed_offices: string[];
  active: boolean;
};

let credentialsKey = '';

export function configureCredentials(key: string): void {
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

export async function upsertTenant(input: {
  id: string;
  displayName: string;
  token: string;
}): Promise<void> {
  await db().query(
    `insert into tenants (id, display_name, token_hmac) values ($1,$2,$3)
     on conflict (id) do update set display_name = excluded.display_name, token_hmac = excluded.token_hmac`,
    [input.id, input.displayName, tokenHmac(input.token, credentialsKey)],
  );
}

export async function tenantForToken(token: string): Promise<string | null> {
  const { rows } = await db().query<{ id: string }>(
    'select id from tenants where token_hmac = $1 and active = true',
    [tokenHmac(token, credentialsKey)],
  );
  return rows[0]?.id ?? null;
}

export async function upsertConnection(input: {
  id: string;
  tenantId: string;
  provider: string;
  credentials?: string | null;
  licensedOffices?: string[];
  active?: boolean;
}): Promise<void> {
  await db().query(
    `insert into connections (id, tenant_id, provider, credentials, licensed_offices, active)
     values ($1,$2,$3,$4,$5,$6)
     on conflict (id) do update set
       tenant_id = excluded.tenant_id,
       provider = excluded.provider,
       credentials = coalesce(excluded.credentials, connections.credentials),
       licensed_offices = excluded.licensed_offices,
       active = excluded.active`,
    [
      input.id,
      input.tenantId,
      input.provider,
      input.credentials ? encrypt(input.credentials, credentialsKey) : null,
      input.licensedOffices ?? [],
      input.active ?? true,
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
  tenant_id: string;
  label: string;
  bell_url: string;
  active: boolean;
  last_bell_at: Date | null;
  last_bell_status: string | null;
  last_pull_at: Date | null;
  last_client: string | null;
};

export async function addSubscriber(input: {
  tenantId: string;
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

export async function recordPull(tenantId: string, client: string | null): Promise<void> {
  await db().query(
    'update subscribers set last_pull_at = now(), last_client = coalesce($2, last_client) where tenant_id = $1',
    [tenantId, client],
  );
}

export async function subscribers(): Promise<SubscriberRow[]> {
  const { rows } = await db().query<SubscriberRow>(
    'select id, tenant_id, label, bell_url, active, last_bell_at, last_bell_status, last_pull_at, last_client from subscribers order by id',
  );
  return rows;
}
