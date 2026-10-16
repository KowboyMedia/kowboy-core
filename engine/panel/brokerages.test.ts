// Brokerages (design B, images 06 to 12 and 23 to 38): the list, one brokerage's page, and the
// changes a person makes there. A stand-in CRM, "somecrm", declares a login, a login test, one
// action and a form handler; each records what it was asked and calls nothing, and its form
// handler must never be reached while forms test mode is on.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { harness, TENANT, type Harness } from '../../acceptance/harness.js';
import { db } from '../storage/db.js';
import { decrypt, tokenHmac } from '../storage/crypto.js';
import { createTenant, upsertConnection, tenantForToken } from '../storage/connections.js';
import { heartbeat } from '../health.js';
import { NOT_LIVE, submissionsFor } from '../registry.js';
import type { Adapter, Connection, Submission } from '../adapter-api/types.js';
import { COOKIE } from './auth.js';
import type { Brokerage, BrokerageRow, Crm, Office } from './brokerages.js';

let core: Harness;
const SESSION = 'brokerages-test-session';

/** What the stand-in CRM was asked. */
const asked: {
  probes: string[];
  acts: { action: string; params: Record<string, string>; connections: string[] }[];
  sent: string[];
} = { probes: [], acts: [], sent: [] };

/** The password the stand-in CRM takes. */
const GOOD = 'right-password';

const somecrm: Adapter = {
  manifest: { provider: 'somecrm', datatypes: ['property', 'agent', 'office'] },
  mappers: {},
  start() {},
  admin: {
    credentials: [
      { key: 'account', label: 'Account', required: true },
      { key: 'password', label: 'Password', secret: true, required: true },
      { key: 'system', label: 'System', options: [{ value: 'live' }, { value: 'test' }] },
    ],
    directions: () => ({ steps: [], settings: [] }),
    panel: () => Promise.resolve([]),
    connection: (connection: Connection) =>
      Promise.resolve([
        {
          title: 'Offices',
          actions: [
            { id: 'check_offices', label: 'Check', params: { connection: connection.id } },
            { id: 'rename_office', label: 'Rename', fields: [{ key: 'name', label: 'Name' }] },
          ],
        },
      ]),
    act: (action, params, connections) => {
      asked.acts.push({ action, params, connections: connections.map((one) => one.id) });
      return Promise.resolve({ message: 'queued' });
    },
    probe: (credentials) => {
      asked.probes.push(credentials);
      const login = JSON.parse(credentials) as Record<string, string>;
      return Promise.resolve({ ok: login['password'] === GOOD, detail: '' });
    },
  },
  submit: (connection) => {
    asked.sent.push(connection.id);
    return Promise.resolve({ outcome: 'delivered' });
  },
};

beforeAll(async () => {
  core = await harness({ adapters: [somecrm], connections: [] });
});
afterAll(async () => {
  await core.stop();
});
beforeEach(async () => {
  asked.probes = [];
  asked.acts = [];
  asked.sent = [];
  await db().query(
    'truncate submissions, events, alert_state, admin_sessions, heartbeats, health_results, lifecycle_events',
  );
  await db().query('delete from items');
  await db().query('delete from connections');
  await db().query('delete from subscribers where tenant_id <> $1', [TENANT]);
  await db().query('delete from tenants where id <> $1', [TENANT]);
  await db().query(
    'update tenants set active = true, token_replaced_at = null, display_name = $2 where id = $1',
    [TENANT, 'Lindqvist & Holm Mäkleri'],
  );
  await db().query(
    `insert into admin_sessions (token_hmac, email, expires_at) values ($1, 'tester@kowboy.se', now() + interval '1 day')`,
    [tokenHmac(SESSION, core.engine.config.credentialsKey)],
  );
  await heartbeat();
});

async function call(
  path: string,
  body?: unknown,
  signedIn = true,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(`${core.baseUrl}/v1/panel${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(signedIn ? { cookie: `${COOKIE}=${SESSION}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

async function page(id = TENANT): Promise<Brokerage> {
  const { status, json } = await call(`/brokerages/${String(id)}`);
  expect(status).toBe(200);
  return json as unknown as Brokerage;
}

async function list(): Promise<BrokerageRow[]> {
  const { status, json } = await call('/brokerages');
  expect(status).toBe(200);
  return json['brokerages'] as BrokerageRow[];
}

/** A connection of the test brokerage with a saved login, as Core keeps one. */
async function connection(id = 'main', password = GOOD): Promise<void> {
  await upsertConnection({
    id,
    tenantId: TENANT,
    provider: 'somecrm',
    name: 'Lindqvist & Holm Somecrm',
    credentials: JSON.stringify({ account: 'G12', password, system: 'live' }),
  });
}

/** Records of a connection: an office with properties, and agents. */
async function records(connectionId: string, office: string, properties: number, agents = 0) {
  const rows: [string, string, string | null, Record<string, unknown>][] = [
    ['office', office, office, { name: office }],
  ];
  for (let n = 0; n < properties; n += 1)
    rows.push(['property', `${office}-p${String(n)}`, office, {}]);
  for (let n = 0; n < agents; n += 1) rows.push(['agent', `${office}-a${String(n)}`, office, {}]);
  for (const [datatype, remoteId, officeId, data] of rows) {
    await db().query(
      `insert into items (tenant_id, connection_id, datatype, remote_id, office_id, seq, content_hash, data, rules_version)
       values ($1, $2, $3, $4, $5, nextval('item_seq'), 'h', $6, '1')`,
      [TENANT, connectionId, datatype, remoteId, officeId, data],
    );
  }
}

const submission = (): Submission => ({
  id: randomUUID(),
  kind: 'interest',
  person: { first_name: 'Test', last_name: 'Person', email: 'test@example.test', phone: '0' },
  consent: { given: true, at: new Date().toISOString() },
});

describe('the brokerages list and a brokerage’s page', () => {
  it('answers a signed-in person only', async () => {
    expect((await call('/brokerages', undefined, false)).status).toBe(401);
    expect((await call('/brokerages/1', undefined, false)).status).toBe(401);
    expect((await call('/brokerages', { name: 'X' }, false)).status).toBe(401);
  });

  it('lists every brokerage by name with its status, websites and offices on them', async () => {
    await connection();
    await records('main', 'Södermalm', 2);
    const off = await createTenant({ displayName: 'Norrsken Mäkleri', token: randomUUID() });
    await db().query('update tenants set active = false where id = $1', [off]);
    const rows = await list();
    expect(rows.map((row) => row.name)).toEqual(['Lindqvist & Holm Mäkleri', 'Norrsken Mäkleri']);
    expect(rows[0]).toMatchObject({ status: 'ok', websites: 1, offices: 1, formsTestMode: false });
    expect(rows[1]).toMatchObject({ status: 'off', websites: 0, offices: 0 });
  });

  it('shows a brokerage’s websites, its token, and its connections without their secrets', async () => {
    await connection();
    await records('main', 'Södermalm', 3, 2);
    await db().query(
      "update subscribers set last_pull_at = now(), last_client = 'wordpress/2.4.1' where tenant_id = $1",
      [TENANT],
    );
    const shown = await page();
    expect(shown.name).toBe('Lindqvist & Holm Mäkleri');
    expect(shown.token).toBe('test-tenant-token');
    expect(shown.coreUrl).toMatch(/^https?:\/\//);
    expect(shown.websites[0]).toMatchObject({
      label: 'test site',
      client: { platform: 'wordpress', version: '2.4.1' },
      waitingForToken: false,
    });
    const [main] = shown.connections;
    expect(main?.login).toEqual({ account: 'G12', system: 'live' });
    expect(JSON.stringify(shown)).not.toContain(GOOD);
    expect(main?.counts).toMatchObject({ property: 3, agent: 2, office: 1 });
    expect(main?.offices).toEqual(['Södermalm']);
    expect(main?.actions).toEqual(['check_offices', 'rename_office']);
    expect(shown.crms.map((crm) => crm.provider)).toEqual(['somecrm']);
  });

  it('says a page that does not exist is missing', async () => {
    expect((await call('/brokerages/999')).status).toBe(404);
    expect((await call('/brokerages/abc')).status).toBe(404);
    expect((await call('/connections/none/offices')).status).toBe(404);
  });

  it('lists a connection’s offices with their properties', async () => {
    await connection();
    await records('main', 'Vasastan', 2);
    await records('main', 'Bromma', 1);
    const { json } = await call('/connections/main/offices');
    expect(json['offices'] as Office[]).toEqual([
      { id: 'Bromma', name: 'Bromma', properties: 1 },
      { id: 'Vasastan', name: 'Vasastan', properties: 2 },
    ]);
  });
});

describe('a new brokerage and its CRM login', () => {
  it('makes a brokerage with a token that a website can use', async () => {
    const { status, json } = await call('/brokerages', { name: '  Fyrbåk Fastigheter ' });
    expect(status).toBe(201);
    const made = await page(json['id'] as number);
    expect(made.name).toBe('Fyrbåk Fastigheter');
    expect(made.token).toBeTruthy();
    expect(await tenantForToken(made.token ?? '')).toMatchObject({ id: made.id });
    expect((await call('/brokerages', { name: ' ' })).status).toBe(400);
  });

  it('takes changes as JSON only', async () => {
    const response = await fetch(`${core.baseUrl}/v1/panel/brokerages`, {
      method: 'POST',
      headers: { cookie: `${COOKIE}=${SESSION}`, 'content-type': 'text/plain' },
      body: 'name=X',
    });
    expect(response.status).toBe(415);
  });

  it('lists the CRMs Core can connect to with the fields of their login', async () => {
    const { json } = await call('/crms');
    const [crm] = json['crms'] as Crm[];
    expect(crm?.provider).toBe('somecrm');
    expect(crm?.fields.map((field) => [field.key, field.secret, field.required])).toEqual([
      ['account', false, true],
      ['password', true, true],
      ['system', false, false],
    ]);
    expect(crm?.fields[2]?.options).toEqual(['live', 'test']);
  });

  it('saves nothing when the CRM refuses the login', async () => {
    const { status, json } = await call(`/brokerages/${String(TENANT)}/connections`, {
      provider: 'somecrm',
      name: 'Lindqvist & Holm Somecrm',
      login: { account: 'G12', password: 'wrong', system: 'live' },
    });
    expect(status).toBe(422);
    expect(json['error']).toBe('login');
    expect(asked.probes).toHaveLength(1);
    const { rows } = await db().query('select 1 from connections');
    expect(rows).toHaveLength(0);
  });

  it('refuses a login missing a required field or with a value the CRM does not offer', async () => {
    for (const login of [
      { account: 'G12' },
      { account: 'G12', password: GOOD, system: 'staging' },
    ]) {
      const { status } = await call(`/brokerages/${String(TENANT)}/connections`, {
        provider: 'somecrm',
        name: 'Main',
        login,
      });
      expect(status).toBe(400);
    }
    expect(asked.probes).toHaveLength(0);
    expect(
      (
        await call(`/brokerages/${String(TENANT)}/connections`, {
          provider: 'nocrm',
          name: 'Main',
          login: {},
        })
      ).status,
    ).toBe(404);
  });

  it('saves a login the CRM accepts, encrypted, and tells the CRM’s code about it', async () => {
    const { status, json } = await call(`/brokerages/${String(TENANT)}/connections`, {
      provider: 'somecrm',
      name: 'Lindqvist & Holm Somecrm',
      login: { account: ' G12 ', password: GOOD, system: 'live' },
    });
    expect(status).toBe(201);
    const id = json['id'] as string;
    expect(id).toBe('lindqvist-holm-somecrm');
    const { rows } = await db().query<{ credentials: string; name: string }>(
      'select credentials, name from connections where id = $1',
      [id],
    );
    expect(rows[0]?.credentials).not.toContain(GOOD);
    expect(
      JSON.parse(decrypt(rows[0]?.credentials ?? '', core.engine.config.credentialsKey)),
    ).toEqual({ account: 'G12', password: GOOD, system: 'live' });
    expect(rows[0]?.name).toBe('Lindqvist & Holm Somecrm');
    const { rows: told } = await db().query<{ event: string }>(
      'select event from lifecycle_events where connection_id = $1',
      [id],
    );
    expect(told.map((row) => row.event)).toEqual(['connection_added']);

    const again = await call(`/brokerages/${String(TENANT)}/connections`, {
      provider: 'somecrm',
      name: 'Lindqvist & Holm Somecrm',
      login: { account: 'G13', password: GOOD },
    });
    expect(again.json['id']).toBe('lindqvist-holm-somecrm-2');
  });

  it('saves a new login only when the CRM accepts it', async () => {
    await connection('main', 'old-password');
    const refused = await call('/connections/main/login', {
      login: { account: 'G12', password: 'wrong' },
    });
    expect(refused.status).toBe(422);
    const read = async () => {
      const { rows } = await db().query<{ credentials: string }>(
        "select credentials from connections where id = 'main'",
      );
      return JSON.parse(decrypt(rows[0]?.credentials ?? '', core.engine.config.credentialsKey)) as {
        password: string;
      };
    };
    expect((await read()).password).toBe('old-password');
    const accepted = await call('/connections/main/login', {
      login: { account: 'G12', password: GOOD, system: 'test' },
    });
    expect(accepted.status).toBe(200);
    expect(await read()).toEqual({ account: 'G12', password: GOOD, system: 'test' });
  });
});

describe('what a person does on a brokerage’s page', () => {
  it('runs an action the CRM’s code declares for the connection, and no other', async () => {
    await connection();
    const ran = await call('/connections/main/act', { action: 'check_offices' });
    expect(ran.status).toBe(200);
    expect(asked.acts).toEqual([
      { action: 'check_offices', params: { connection: 'main' }, connections: ['main'] },
    ]);
    // One that asks for typed fields, or one the code never declared, does not run.
    expect((await call('/connections/main/act', { action: 'rename_office' })).status).toBe(404);
    expect((await call('/connections/main/act', { action: 'drop_everything' })).status).toBe(404);
    expect(asked.acts).toHaveLength(1);
  });

  it('holds every form in Core while forms test mode is on, and keeps when it was turned on', async () => {
    await connection();
    const handlers = submissionsFor('somecrm');
    const main = {
      id: 'main',
      tenantId: TENANT,
      provider: 'somecrm',
      credentials: null,
      licensedOffices: [],
    };

    expect((await call('/connections/main/forms-test-mode', { on: true })).status).toBe(200);
    const first = (await page()).connections[0];
    expect(first?.formsTestMode).toBe(true);
    expect(first?.formsTestModeSince).not.toBeNull();
    expect(await handlers?.submit?.(main, submission())).toEqual({
      outcome: 'refused',
      reason: NOT_LIVE,
    });
    expect(asked.sent).toEqual([]);
    expect((await list())[0]?.formsTestMode).toBe(true);

    await db().query(
      "update connections set forms_dry_run_since = now() - interval '1 hour' where id = 'main'",
    );
    await call('/connections/main/forms-test-mode', { on: true });
    const kept = (await page()).connections[0]?.formsTestModeSince ?? '';
    expect(Date.now() - Date.parse(kept)).toBeGreaterThan(50 * 60_000);

    await call('/connections/main/forms-test-mode', { on: false });
    const off = (await page()).connections[0];
    expect(off).toMatchObject({ formsTestMode: false, formsTestModeSince: null });
    expect(await handlers?.submit?.(main, submission())).toEqual({ outcome: 'delivered' });
    expect(asked.sent).toEqual(['main']);
  });

  it('replaces the token: the old one stops at once, and each website waits until it fetches again', async () => {
    const { status, json } = await call(`/brokerages/${String(TENANT)}/token`, {});
    expect(status).toBe(200);
    const token = json['token'] as string;
    expect(await tenantForToken('test-tenant-token')).toBeNull();
    expect(await tenantForToken(token)).toMatchObject({ id: TENANT });
    const waiting = await page();
    expect(waiting.token).toBe(token);
    expect(waiting.tokenReplacedAt).not.toBeNull();
    expect(waiting.websites[0]?.waitingForToken).toBe(true);
    expect(waiting.status).toBe('look');

    await db().query('update subscribers set last_pull_at = now() where tenant_id = $1', [TENANT]);
    const fetched = await page();
    expect(fetched.websites[0]?.waitingForToken).toBe(false);
    expect(fetched.status).toBe('ok');
    // Put the harness's token back for the other tests.
    await db().query('update tenants set token_hmac = $2 where id = $1', [
      TENANT,
      tokenHmac('test-tenant-token', core.engine.config.credentialsKey),
    ]);
  });

  it('adds a website with a bell secret Core makes, and removes it', async () => {
    const bad = await call(`/brokerages/${String(TENANT)}/websites`, {
      label: 'fyrbak.se',
      bellUrl: 'ftp://fyrbak.se/bell',
    });
    expect(bad.status).toBe(400);
    const { status, json } = await call(`/brokerages/${String(TENANT)}/websites`, {
      label: 'fyrbak.se',
      bellUrl: 'https://fyrbak.se/wp-json/core/v1/bell',
    });
    expect(status).toBe(201);
    const id = json['id'] as number;
    const added = (await page()).websites.find((website) => website.id === id);
    expect(added).toMatchObject({
      label: 'fyrbak.se',
      bellUrl: 'https://fyrbak.se/wp-json/core/v1/bell',
      client: null,
      lastFetchAt: null,
    });
    expect(added?.bellSecret.length).toBeGreaterThan(20);

    expect((await call(`/websites/${String(id)}/remove`, {})).status).toBe(200);
    expect((await page()).websites.map((website) => website.id)).not.toContain(id);
    expect((await call(`/websites/${String(id)}/remove`, {})).status).toBe(404);
  });

  it('removes a connection: its records and forms go, and the websites fetch everything again', async () => {
    await connection('main');
    await connection('qa-test');
    await records('main', 'Södermalm', 2);
    await records('qa-test', 'Testkontoret', 12, 3);
    const { rows: before } = await db().query<{ purge_watermark: string }>(
      'select purge_watermark from tenants where id = $1',
      [TENANT],
    );
    const bells = core.bells.length;

    const { status, json } = await call('/connections/qa-test/remove', {});
    expect(status).toBe(200);
    expect(Date.parse(json['removedAt'] as string)).not.toBeNaN();

    const { rows: left } = await db().query<{ connection_id: string }>(
      'select distinct connection_id from items',
    );
    expect(left.map((row) => row.connection_id)).toEqual(['main']);
    const { rows: after } = await db().query<{ purge_watermark: string }>(
      'select purge_watermark from tenants where id = $1',
      [TENANT],
    );
    expect(Number(after[0]?.purge_watermark)).toBeGreaterThan(Number(before[0]?.purge_watermark));
    expect(core.bells.length).toBeGreaterThan(bells);
    const { rows: rung } = await db().query<{ kind: string }>(
      "select fields->>'kind' as kind from events where type = 'bell' order by at desc limit 1",
    );
    expect(rung[0]?.kind).toBe('forcerefresh');
    expect((await page()).connections.map((one) => one.id)).toEqual(['main']);
    expect((await call('/connections/qa-test/remove', {})).status).toBe(404);
  });

  it('switches a brokerage off and on: off, its token no longer works', async () => {
    expect((await call(`/brokerages/${String(TENANT)}/switch`, { on: false })).status).toBe(200);
    expect(await tenantForToken('test-tenant-token')).toBeNull();
    expect((await page()).status).toBe('off');
    expect((await list())[0]?.status).toBe('off');
    const bells = core.bells.length;
    expect((await call(`/brokerages/${String(TENANT)}/switch`, { on: true })).status).toBe(200);
    expect((await page()).active).toBe(true);
    expect(core.bells.length).toBeGreaterThan(bells);
    expect((await call('/brokerages/999/switch', { on: true })).status).toBe(404);
  });
});
