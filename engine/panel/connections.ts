// A brokerage's CRM connections as the panel changes them (design B, images 07, 12, 15, 24 to 26
// and 34 to 36): connect one after the CRM accepts its login, enter a new login, hold its forms
// in Core, run what the CRM's code offers for it, and remove it. The engine knows a CRM by its
// provider only: the login's fields, the test and the actions are the adapter's, declared through
// the adapter API, and the engine hands them on without knowing what they mean.
import { db } from '../storage/db.js';
import { encrypt } from '../storage/crypto.js';
import { connectionById, deleteConnection, tenantById } from '../storage/connections.js';
import { resyncTenant } from '../storage/items.js';
import { queueLifecycle } from '../lifecycle.js';
import { ring } from '../bells.js';
import { report } from '../errors.js';
import { adminFor } from '../registry.js';
import type { AdminField, Connection } from '../adapter-api/types.js';
import { crmName } from './inbox.js';
import { solveLogin } from './problems.js';
import { failureWords } from './failure.js';

/** Why a change was not made: no such thing, a login missing a field, or the CRM refused it. */
export type Refusal = 'missing' | 'fields' | 'login' | 'crm';

/** A change made, or why not, with the words of what failed when Core has them (failure.ts). */
type Done<T> = { ok: true; value: T } | { ok: false; why: Refusal; said?: string };

const refused = <T>(why: Refusal, said?: string): Done<T> => ({ ok: false, why, said });

/**
 * The login as the CRM's code takes it: one JSON document of its declared fields. A field the
 * code requires must be there, and a field with fixed values must hold one of them.
 */
function loginDocument(fields: AdminField[], given: unknown): string | null {
  if (!given || typeof given !== 'object') return null;
  const values = given as Record<string, unknown>;
  const document: Record<string, string> = {};
  for (const field of fields) {
    const raw = values[field.key];
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (field.required && value === '') return null;
    if (value !== '' && field.options && !field.options.some((one) => one.value === value)) {
      return null;
    }
    if (value !== '') document[field.key] = value;
  }
  return JSON.stringify(document);
}

/** Ask the CRM whether it takes a login, before anything is saved. A CRM without a test takes it. */
async function crmTakes(provider: string, login: string): Promise<boolean | null> {
  const admin = adminFor(provider);
  if (!admin?.probe) return true;
  try {
    return (await admin.probe(login, [])).ok;
  } catch (error) {
    report(error, { where: 'panel login test', provider });
    return null;
  }
}

/** Core's id for a new connection, made from its name; no page shows it. */
async function newConnectionId(name: string): Promise<string> {
  const base =
    name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'connection';
  const { rows } = await db().query<{ id: string }>(
    `select id from connections where id = $1 or id like $2`,
    [base, `${base}-%`],
  );
  const taken = new Set(rows.map((row) => row.id));
  let id = base;
  for (let n = 2; taken.has(id); n += 1) id = `${base}-${String(n)}`;
  return id;
}

/**
 * A new connection's name: the brokerage's name, a dash and the CRM's id, with "-2", "-3" and on
 * when a connection already has it (Patric, 2026-10-18). Nobody types it.
 */
async function newConnectionName(tenantName: string, provider: string): Promise<string> {
  const base = `${tenantName.trim()}-${provider}`;
  const { rows } = await db().query<{ name: string }>(
    'select name from connections where starts_with(name, $1)',
    [base],
  );
  const taken = new Set(rows.map((row) => row.name));
  let name = base;
  for (let n = 2; taken.has(name); n += 1) name = `${base}-${String(n)}`;
  return name;
}

/**
 * Connect a brokerage to a CRM: Core tests the login with the CRM and saves it only if the CRM
 * accepts it. The CRM's code is then told of the new connection and starts loading its data.
 */
export async function addConnection(
  tenantId: number,
  input: { provider: string; login: unknown },
  key: string,
): Promise<Done<{ id: string; name: string }>> {
  const admin = adminFor(input.provider);
  const tenant = await tenantById(tenantId);
  if (!admin || !tenant) return refused('missing');
  const login = loginDocument(admin.credentials, input.login);
  if (!login) return refused('fields');
  const takes = await crmTakes(input.provider, login);
  if (takes === null) return refused('crm');
  if (!takes) return refused('login');
  for (;;) {
    const name = await newConnectionName(tenant.display_name, input.provider);
    const id = await newConnectionId(name);
    const { rows } = await db().query(
      `insert into connections (id, tenant_id, provider, credentials, licensed_offices, name)
       values ($1, $2, $3, $4, '{}', $5) on conflict (id) do nothing returning id`,
      [id, tenantId, input.provider, encrypt(login, key), name],
    );
    if (rows.length === 0) continue;
    await queueLifecycle(id, 'connection_added');
    return { ok: true, value: { id, name } };
  }
}

/**
 * A new login for a connection, saved only if the CRM accepts it. A login the CRM refused is then
 * put right, by the person who saved the new one: the Inbox lists it as fixed.
 */
export async function changeLogin(
  connectionId: string,
  given: unknown,
  key: string,
  by: string,
): Promise<Done<null>> {
  const connection = await connectionById(connectionId);
  const admin = connection ? adminFor(connection.provider) : null;
  if (!connection || !admin) return refused('missing');
  const login = loginDocument(admin.credentials, given);
  if (!login) return refused('fields');
  const takes = await crmTakes(connection.provider, login);
  if (takes === null) return refused('crm');
  if (!takes) return refused('login');
  await db().query('update connections set credentials = $2 where id = $1', [
    connectionId,
    encrypt(login, key),
  ]);
  await solveLogin(connectionId, crmName(connection.provider), by);
  return { ok: true, value: null };
}

/**
 * Hold a connection's forms in Core, or let them through again. The forms guard reads the switch
 * at every send, so it holds from the moment it is saved. Turned on, Core keeps when; a second
 * "on" keeps the first time.
 */
export async function setFormsTestMode(connectionId: string, on: boolean): Promise<boolean> {
  const { rows } = await db().query(
    `update connections set
       forms_dry_run_since = case
         when $2 then (case when forms_dry_run then coalesce(forms_dry_run_since, now()) else now() end)
         else null end,
       forms_dry_run = $2
     where id = $1 returning id`,
    [connectionId, on],
  );
  return rows.length === 1;
}

/**
 * Run an action the CRM's code offers for a connection, such as checking its offices now, with
 * the parameters the code gave it. Only an action the code declares for the connection runs.
 */
export async function runAction(connectionId: string, action: string): Promise<Done<null>> {
  const connection = await connectionById(connectionId);
  const admin = connection ? adminFor(connection.provider) : null;
  if (!connection || !admin?.connection) return refused('missing');
  try {
    const declared = (await admin.connection(connection))
      .flatMap((section) => section.actions ?? [])
      .find((one) => one.id === action && !one.fields?.length);
    if (!declared) return refused('missing');
    await admin.act(declared.id, declared.params ?? {}, [connection]);
    return { ok: true, value: null };
  } catch (error) {
    report(error, { where: 'panel action', provider: connection.provider, action });
    return refused('crm', failureWords(error, crmName(connection.provider)));
  }
}

/**
 * Remove a connection: its records leave the brokerage's websites, which Core tells at once to
 * fetch everything again, and its form history goes with it. Answers when it was removed.
 */
export async function removeConnection(
  connectionId: string,
): Promise<{ tenantId: number; removedAt: string } | null> {
  const connection: Connection | null = await connectionById(connectionId);
  if (!connection) return null;
  await deleteConnection(connectionId);
  await resyncTenant(connection.tenantId);
  await ring(connection.tenantId, 'forcerefresh');
  return { tenantId: connection.tenantId, removedAt: new Date().toISOString() };
}
