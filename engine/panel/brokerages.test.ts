// Tenants (design B, images 06 to 12 and 23 to 38, and the tenant mockups): the list, one tenant's
// page, and the changes a person makes there, deleting a tenant and everything of it, and the Flow.
// A stand-in CRM, "somecrm", declares a login, a line under a connection's name, its own sections
// with one action, a fetch list, a login test and a form handler; each records what it was asked
// and calls nothing, and its form handler must never be reached while forms test mode is on. Its
// action fails when a test says.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { harness, TENANT, type Harness } from '../../acceptance/harness.js';
import { db } from '../storage/db.js';
import { decrypt, tokenHmac } from '../storage/crypto.js';
import { createTenant, upsertConnection, tenantForToken } from '../storage/connections.js';
import { heartbeat } from '../health.js';
import { NOT_LIVE, submissionsFor } from '../registry.js';
import type { Adapter, AdminQueued, Connection, Submission } from '../adapter-api/types.js';
import { MAINTENANCE, writeSetting } from '../storage/settings.js';
import { logEvent } from '../events.js';
import { COOKIE } from './auth.js';
import type { Brokerage, BrokerageRow, Crm } from './brokerages.js';
import type { Flow } from './flow.js';

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

/** What the stand-in CRM's action fails with, when a test makes it fail. */
let actFails: Error | null = null;

/** What the stand-in CRM's fetch list holds, as its code would answer `queue`. */
let listed: AdminQueued[] = [];

const somecrm: Adapter = {
  manifest: { provider: 'somecrm', datatypes: ['property', 'agent', 'office'] },
  mappers: {},
  start() {},
  admin: {
    credentials: [
      { key: 'account', label: 'Account', required: true },
      { key: 'password', label: 'Password', secret: true, required: true },
      {
        key: 'system',
        label: 'System',
        options: [{ value: 'live', label: 'Live system' }, { value: 'test' }],
      },
    ],
    directions: () => ({ steps: [], settings: [] }),
    panel: () => Promise.resolve([]),
    describe: (connection: Connection) => {
      const login = JSON.parse(connection.credentials ?? '{}') as Record<string, string>;
      return `Live system · ${login['account'] ?? ''}`;
    },
    connection: (connection: Connection) =>
      Promise.resolve([
        {
          title: 'Offices',
          help: 'The offices the system lists.',
          items: [
            { label: 'Last check', value: { moment: '2026-10-19T06:02:00.000Z' } },
            { label: 'First office', value: { connection: connection.id, office: 'Södermalm' } },
          ],
          table: {
            columns: ['Office', 'Status'],
            rows: [{ cells: ['Södermalm', { text: 'On the websites', state: 'ok' as const }] }],
          },
          actions: [
            {
              id: 'check_offices',
              label: 'Check',
              help: 'When an office joined.',
              params: { connection: connection.id },
            },
            { id: 'rename_office', label: 'Rename', fields: [{ key: 'name', label: 'Name' }] },
          ],
        },
      ]),
    act: (action, params, connections) => {
      asked.acts.push({ action, params, connections: connections.map((one) => one.id) });
      return actFails ? Promise.reject(actFails) : Promise.resolve({ message: 'queued' });
    },
    queue: (connections) => {
      const ids = new Set(connections.map((one) => one.id));
      return Promise.resolve(listed.filter((one) => ids.has(one.connectionId ?? '')));
    },
    queueCount: (connections, scope) => {
      const ids = new Set(connections.map((one) => one.id));
      const mine = listed.filter(
        (one) =>
          ids.has(one.connectionId ?? '') &&
          (!scope.officeIds || scope.officeIds.includes(one.officeId)),
      );
      return Promise.resolve({
        waiting: mine.filter((one) => one.attempts === 0).length,
        failed: mine.filter((one) => one.attempts > 0).length,
      });
    },
    probe: (credentials) => {
      asked.probes.push(credentials);
      const login = JSON.parse(credentials) as Record<string, string>;
      const ok = login['password'] === GOOD;
      return Promise.resolve({ ok, detail: ok ? '' : 'Somecrm does not know this password.' });
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
  actFails = null;
  listed = [];
  await writeSetting(MAINTENANCE, 'off', null);
  await db().query(
    'truncate submissions, events, alert_state, admin_sessions, heartbeats, health_results, lifecycle_events, jobs, panel_problems',
  );
  await db().query('delete from items');
  await db().query('delete from connections');
  await db().query('delete from subscribers where tenant_id <> $1', [TENANT]);
  // The harness's own website stays, the first the tenant got; a test's others go.
  await db().query(
    `delete from subscribers where tenant_id = $1
       and id <> (select min(id) from subscribers where tenant_id = $1)`,
    [TENANT],
  );
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

  it('lists every tenant by name with its status, websites and entities', async () => {
    await connection();
    await records('main', 'Södermalm', 2, 1);
    const off = await createTenant({ displayName: 'Norrsken Mäkleri', token: randomUUID() });
    await db().query('update tenants set active = false where id = $1', [off]);
    const rows = await list();
    expect(rows.map((row) => row.name)).toEqual(['Lindqvist & Holm Mäkleri', 'Norrsken Mäkleri']);
    // Entities: every live record of every type, the office, its 2 properties and its agent.
    expect(rows[0]).toMatchObject({ status: 'ok', websites: 1, entities: 4, formsTestMode: false });
    expect(rows[1]).toMatchObject({ status: 'off', websites: 0, entities: 0 });
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
    expect(main?.status).toBe('ok');
    expect(shown.crms.map((crm) => crm.provider)).toEqual(['somecrm']);
  });

  it('draws a connection from what its CRM’s code declares: its line and its own sections', async () => {
    await connection();
    await records('main', 'Södermalm', 1);
    await db().query(
      `update items set data = '{"name": "Södermalm office"}' where datatype = 'office'`,
    );
    const [main] = (await page()).connections;
    expect(main?.describe).toBe('Live system · G12');
    expect(main?.sectionsFailed).toBeNull();
    // The code's words as it gave them; a thing it names by Core's name for it; no action that
    // asks for typed fields, which the panel cannot offer.
    expect(main?.sections).toEqual([
      {
        title: 'Offices',
        help: 'The offices the system lists.',
        items: [
          { label: 'Last check', value: { moment: '2026-10-19T06:02:00.000Z' } },
          { label: 'First office', value: 'Södermalm office' },
        ],
        table: {
          columns: ['Office', 'Status'],
          rows: [['Södermalm', { text: 'On the websites', state: 'ok' }]],
          empty: null,
        },
        actions: [
          {
            id: 'check_offices',
            label: 'Check',
            help: 'When an office joined.',
            confirm: null,
            danger: false,
          },
        ],
      },
    ]);
  });

  it('says a page that does not exist is missing', async () => {
    expect((await call('/brokerages/999')).status).toBe(404);
    expect((await call('/brokerages/abc')).status).toBe(404);
    expect((await call('/connections/none/edit', { login: {} })).status).toBe(404);
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
    // Each choice with the CRM's code's words for it, or its value where the code gives none.
    expect(crm?.fields[2]?.options).toEqual([
      { value: 'live', label: 'Live system' },
      { value: 'test', label: 'test' },
    ]);
  });

  it('saves nothing when the CRM refuses the login', async () => {
    const { status, json } = await call(`/brokerages/${String(TENANT)}/connections`, {
      provider: 'somecrm',
      login: { account: 'G12', password: 'wrong', system: 'live' },
    });
    expect(status).toBe(422);
    // The words of the CRM's code say why, for the login window to show.
    expect(json).toEqual({ error: 'login', message: 'Somecrm does not know this password.' });
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
        login,
      });
      expect(status).toBe(400);
    }
    expect(asked.probes).toHaveLength(0);
    expect(
      (
        await call(`/brokerages/${String(TENANT)}/connections`, {
          provider: 'nocrm',
          login: {},
        })
      ).status,
    ).toBe(404);
  });

  it('saves a login the CRM accepts, encrypted, and tells the CRM’s code about it', async () => {
    const { status, json } = await call(`/brokerages/${String(TENANT)}/connections`, {
      provider: 'somecrm',
      name: 'Typed names are ignored',
      login: { account: ' G12 ', password: GOOD, system: 'live' },
    });
    expect(status).toBe(201);
    const id = json['id'] as string;
    expect(id).toBe('lindqvist-holm-makleri-somecrm');
    expect(json['name']).toBe('Lindqvist & Holm Mäkleri-somecrm');
    const { rows } = await db().query<{ credentials: string; name: string }>(
      'select credentials, name from connections where id = $1',
      [id],
    );
    expect(rows[0]?.credentials).not.toContain(GOOD);
    expect(
      JSON.parse(decrypt(rows[0]?.credentials ?? '', core.engine.config.credentialsKey)),
    ).toEqual({ account: 'G12', password: GOOD, system: 'live' });
    expect(rows[0]?.name).toBe('Lindqvist & Holm Mäkleri-somecrm');
    const { rows: told } = await db().query<{ event: string }>(
      'select event from lifecycle_events where connection_id = $1',
      [id],
    );
    expect(told.map((row) => row.event)).toEqual(['connection_added']);

    const again = await call(`/brokerages/${String(TENANT)}/connections`, {
      provider: 'somecrm',
      login: { account: 'G13', password: GOOD },
    });
    expect(again.json).toEqual({
      id: 'lindqvist-holm-makleri-somecrm-2',
      name: 'Lindqvist & Holm Mäkleri-somecrm-2',
    });
    const { rows: held } = await db().query<{ forms_dry_run: boolean }>(
      'select forms_dry_run from connections order by id',
    );
    expect(held.map((row) => row.forms_dry_run)).toEqual([false, false]);
  });

  it('adds a connection with forms test mode on, from the moment it is saved', async () => {
    const { status } = await call(`/brokerages/${String(TENANT)}/connections`, {
      provider: 'somecrm',
      login: { account: 'G31', password: GOOD },
      formsTestMode: true,
    });
    expect(status).toBe(201);
    const [added] = (await page()).connections;
    expect(added?.formsTestMode).toBe(true);
    expect(added?.formsTestModeSince).not.toBeNull();
  });
});

describe('the CRM screen: a connection’s login and forms test mode on one screen', () => {
  const read = async () => {
    const { rows } = await db().query<{ credentials: string }>(
      "select credentials from connections where id = 'main'",
    );
    return JSON.parse(decrypt(rows[0]?.credentials ?? '', core.engine.config.credentialsKey)) as {
      password: string;
    };
  };

  it('saves a new login only when the CRM accepts it', async () => {
    await connection('main', 'old-password');
    const refused = await call('/connections/main/edit', {
      login: { account: 'G12', password: 'wrong' },
    });
    expect(refused.status).toBe(422);
    expect(refused.json).toEqual({
      error: 'login',
      message: 'Somecrm does not know this password.',
    });
    expect((await read()).password).toBe('old-password');
    const accepted = await call('/connections/main/edit', {
      login: { account: 'G12', password: GOOD, system: 'test' },
    });
    expect(accepted).toEqual({ status: 200, json: { tested: true } });
    expect(await read()).toEqual({ account: 'G12', password: GOOD, system: 'test' });
  });

  it('keeps the saved secret when it is left empty, and tests only a login that changed', async () => {
    await connection('main');
    // Nothing of the login changed: forms test mode alone is saved, and the CRM is not asked.
    const kept = await call('/connections/main/edit', {
      login: { account: 'G12', password: '', system: 'live' },
      formsTestMode: true,
    });
    expect(kept).toEqual({ status: 200, json: { tested: false } });
    expect(asked.probes).toEqual([]);
    expect((await page()).connections[0]?.formsTestMode).toBe(true);
    expect(await read()).toEqual({ account: 'G12', password: GOOD, system: 'live' });

    // A field changed: the CRM tests the login with the saved password merged in.
    const moved = await call('/connections/main/edit', {
      login: { account: 'G13', system: 'live' },
    });
    expect(moved).toEqual({ status: 200, json: { tested: true } });
    expect(asked.probes.map((one) => JSON.parse(one) as unknown)).toEqual([
      { account: 'G13', password: GOOD, system: 'live' },
    ]);
    expect(await read()).toEqual({ account: 'G13', password: GOOD, system: 'live' });
    // Left out, forms test mode stays as it was.
    expect((await page()).connections[0]?.formsTestMode).toBe(true);

    // A required field emptied is refused before anything is asked.
    const emptied = await call('/connections/main/edit', { login: { account: '', password: '' } });
    expect(emptied.status).toBe(400);
    expect(asked.probes).toHaveLength(1);
  });
});

describe('what a person does on a brokerage’s page', () => {
  it('runs an action the CRM’s code declares for the connection, and no other', async () => {
    await connection();
    const ran = await call('/connections/main/act', { action: 'check_offices' });
    // The code's message goes to the person who pressed it.
    expect(ran).toEqual({ status: 200, json: { message: 'queued' } });
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

    const on = { login: { account: 'G12', system: 'live' }, formsTestMode: true };
    expect((await call('/connections/main/edit', on)).status).toBe(200);
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
    await call('/connections/main/edit', on);
    const kept = (await page()).connections[0]?.formsTestModeSince ?? '';
    expect(Date.now() - Date.parse(kept)).toBeGreaterThan(50 * 60_000);

    await call('/connections/main/edit', { ...on, formsTestMode: false });
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

  it('edits a website’s label and bell address, and gives it a new bell secret', async () => {
    const [site] = (await page()).websites;
    const id = site?.id ?? 0;
    const bad = await call(`/websites/${String(id)}/edit`, { label: 'x', bellUrl: 'nope' });
    expect(bad.status).toBe(400);
    const edited = await call(`/websites/${String(id)}/edit`, {
      label: ' lindqvistholm.se ',
      bellUrl: 'https://lindqvistholm.se/wp-json/core/v1/bell',
    });
    expect(edited.status).toBe(200);
    const after = (await page()).websites[0];
    expect(after).toMatchObject({
      label: 'lindqvistholm.se',
      bellUrl: 'https://lindqvistholm.se/wp-json/core/v1/bell',
      bellSecret: site?.bellSecret,
    });

    const { status, json } = await call(`/websites/${String(id)}/bell-secret`, {});
    expect(status).toBe(200);
    expect(json['bellSecret']).not.toBe(site?.bellSecret);
    expect((await page()).websites[0]?.bellSecret).toBe(json['bellSecret']);
    expect((await call('/websites/9999/bell-secret', {})).status).toBe(404);
    expect(
      (await call('/websites/9999/edit', { label: 'x', bellUrl: 'https://x.se' })).status,
    ).toBe(404);
    // The harness's website as it was, so its change notices reach the harness again.
    await db().query('update subscribers set label = $2, bell_url = $3 where id = $1', [
      id,
      site?.label,
      site?.bellUrl,
    ]);
  });

  it('renames a tenant', async () => {
    expect((await call(`/brokerages/${String(TENANT)}/edit`, { name: ' ' })).status).toBe(400);
    expect(
      (await call(`/brokerages/${String(TENANT)}/edit`, { name: ' Lindqvist & Holm ' })).status,
    ).toBe(200);
    expect((await page()).name).toBe('Lindqvist & Holm');
    expect((await call('/brokerages/999/edit', { name: 'X' })).status).toBe(404);
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

describe('what a person is told when Core fails at what they asked', () => {
  it('says what failed in the words of the part of Core that failed, whose fault it is and what to do', async () => {
    await connection();
    actFails = new Error('relation "somecrm_state" does not exist');
    const failed = await call('/connections/main/act', { action: 'check_offices' });
    expect(failed.status).toBe(502);
    expect(failed.json).toEqual({
      error: 'crm',
      message:
        'The part of Core that talks to Somecrm failed, and its error said “relation "somecrm_state" does not exist”. This is a fault in Core, not at Somecrm or in the login, so pass these words on to Core’s developers.',
    });

    // Core's database refusing it is no fault in Core's code, and the press can be tried again.
    actFails = Object.assign(new Error('sorry, too many clients already'), { code: '53300' });
    expect((await call('/connections/main/act', { action: 'check_offices' })).json).toEqual({
      error: 'crm',
      message:
        'Core couldn’t use its database, and the database’s error said “sorry, too many clients already”. This is Core’s own database, not Somecrm or its login. Try again in a few minutes; if it still fails, pass these words on to Core’s developers.',
    });
  });

  it('says Core’s database failed before Core knew who asks, without the database’s own words', async () => {
    // The session lookup is the first thing every signed-in request asks the database.
    await db().query(
      `create function panel_test_full() returns trigger language plpgsql as $$
       begin raise exception 'sorry, too many clients already' using errcode = '53300'; end $$`,
    );
    await db().query(
      `create trigger panel_test_full before update on admin_sessions
       for each row execute function panel_test_full()`,
    );
    try {
      const whose =
        'Core couldn’t use its database just now. This is Core’s own database, not a CRM or a CRM login.';
      expect(await call('/inbox')).toEqual({
        status: 503,
        json: {
          error: 'database',
          message: `${whose} If this lasts more than a few minutes, pass these words on to Core’s developers.`,
        },
      });
      expect(await call('/problems/act', { key: 'site:1' })).toEqual({
        status: 503,
        json: {
          error: 'database',
          message: `${whose} Try again in a few minutes; if it still fails, pass these words on to Core’s developers.`,
        },
      });
    } finally {
      await db().query('drop trigger panel_test_full on admin_sessions');
      await db().query('drop function panel_test_full()');
    }
    // Any other failure there is answered without words: Core doesn't know who is asking.
    await db().query('alter table admin_sessions rename to admin_sessions_away');
    try {
      expect(await call('/inbox')).toEqual({ status: 500, json: { error: 'internal error' } });
    } finally {
      await db().query('alter table admin_sessions_away rename to admin_sessions');
    }
  });

  it('answers an error nobody expected with Core’s own words, to a person signed in only', async () => {
    await db().query('alter table panel_problems rename to panel_problems_away');
    try {
      const failed = await call('/problems/act', { key: 'site:1' });
      expect(failed.status).toBe(500);
      expect(failed.json).toEqual({
        error: 'internal error',
        message:
          'Core failed with an error in its own code, which said “relation "panel_problems" does not exist”. This is a fault in Core, not in a CRM or a login, so pass these words on to Core’s developers.',
      });
      expect(await call('/problems/act', { key: 'site:1' }, false)).toEqual({
        status: 401,
        json: { error: 'signed out' },
      });
    } finally {
      await db().query('alter table panel_problems_away rename to panel_problems');
    }
  });
});

describe('deleting a tenant and everything of it', () => {
  /** Every table of Core's that holds a tenant's or a connection's id, as the database lists them. */
  async function holding(column: 'tenant_id' | 'connection_id'): Promise<string[]> {
    const { rows } = await db().query<{ table_name: string }>(
      `select c.table_name from information_schema.columns c
       join information_schema.tables t using (table_schema, table_name)
       where c.table_schema = current_schema() and c.column_name = $1 and t.table_type = 'BASE TABLE'
       order by c.table_name`,
      [column],
    );
    return rows.map((row) => row.table_name);
  }

  /** How many rows of each such table hold the tenant or one of its connections. */
  async function left(tenantId: number, connections: string[]): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const table of await holding('tenant_id')) {
      const { rows } = await db().query<{ n: string }>(
        `select count(*) as n from ${table} where tenant_id::text = $1`,
        [String(tenantId)],
      );
      counts[`${table}.tenant_id`] = Number(rows[0]?.n);
    }
    for (const table of await holding('connection_id')) {
      const { rows } = await db().query<{ n: string }>(
        `select count(*) as n from ${table} where connection_id = any($1::text[])`,
        [connections],
      );
      counts[`${table}.connection_id`] = Number(rows[0]?.n);
    }
    return counts;
  }

  /** A tenant with a website, a connection with records, a form, events, a problem and a reload. */
  async function filled(tenantId: number, connectionId: string, site: string): Promise<void> {
    await upsertConnection({
      id: connectionId,
      tenantId,
      provider: 'somecrm',
      name: `${connectionId} name`,
      credentials: JSON.stringify({ account: 'M1', password: GOOD }),
    });
    await db().query(
      `insert into subscribers (tenant_id, label, bell_url, bell_secret) values ($1, $2, $3, 'secret')`,
      [tenantId, site, `https://${site}/bell`],
    );
    await db().query(
      `insert into items (tenant_id, connection_id, datatype, remote_id, office_id, seq, content_hash, data, rules_version)
       values ($1, $2, 'property', $3, null, nextval('item_seq'), 'h', '{}', '1')`,
      [tenantId, connectionId, `${connectionId}-p1`],
    );
    await db().query(
      `insert into submissions (id, tenant_id, connection_id, kind, outcome, content)
       values ($1, $2, $3, 'interest', 'failed', 'kept')`,
      [randomUUID(), tenantId, connectionId],
    );
    await logEvent({ type: 'entity.written', tenantId, connectionId, datatype: 'property' });
    await logEvent({ type: 'crm.call', connectionId, fields: {} });
    await db().query(`insert into lifecycle_events (connection_id, event) values ($1, 'resync')`, [
      connectionId,
    ]);
    await db().query(
      `insert into panel_problems (key, tenant_id, facts) values ($1, $2, '{"kind": "forms"}')`,
      [`forms:${String(tenantId)}`, tenantId],
    );
    await db().query(`insert into panel_problems (key, facts) values ($1, '{"kind": "login"}')`, [
      `login:${connectionId}`,
    ]);
    await db().query(`insert into jobs (kind, scope) values ('recompute', $1)`, [
      JSON.stringify({ tenantId }),
    ]);
  }

  it('asks for the tenant’s name, then leaves nothing of it and touches no other tenant', async () => {
    const gone = await createTenant({ displayName: 'Hjortronet Fastighetsbyrå', token: 'gone' });
    await filled(gone, 'hjortronet', 'hjortronet.se');
    await filled(TENANT, 'main', 'lindqvistholm.se');
    // A check naming things of both tenants, and a problem about both.
    await db().query(
      `insert into health_results (name, ok, names) values ('somecrm.retries', false, $1)`,
      [JSON.stringify([{ connection: 'hjortronet' }, { connection: 'main' }, 'a site'])],
    );
    await db().query(`insert into panel_problems (key, facts) values ('somecrm.offices', $1)`, [
      JSON.stringify({ kind: 'check', title: 'x', tenants: [gone, TENANT], about: null }),
    ]);
    const before = await left(TENANT, ['main']);

    expect((await call(`/brokerages/${String(gone)}/delete`, {})).status).toBe(400);
    expect((await call(`/brokerages/${String(gone)}/delete`, { name: 'Hjortronet' })).status).toBe(
      400,
    );
    expect((await list()).map((row) => row.id)).toContain(gone);

    const deleted = await call(`/brokerages/${String(gone)}/delete`, {
      name: ' Hjortronet Fastighetsbyrå ',
    });
    expect(deleted.status).toBe(200);

    // Every table of Core's that holds a tenant's or a connection's id holds none of this one's.
    const after = await left(gone, ['hjortronet']);
    expect(Object.keys(after)).toEqual(
      expect.arrayContaining([
        'connections.tenant_id',
        'subscribers.tenant_id',
        'items.tenant_id',
        'items.connection_id',
        'events.tenant_id',
        'events.connection_id',
        'submissions.tenant_id',
        'lifecycle_events.connection_id',
        'panel_problems.tenant_id',
      ]),
    );
    expect(Object.values(after).every((n) => n === 0)).toBe(true);
    const { rows: tenant } = await db().query('select 1 from tenants where id = $1', [gone]);
    expect(tenant).toHaveLength(0);
    const { rows: jobs } = await db().query<{ scope: { tenantId?: number } }>(
      'select scope from jobs',
    );
    expect(jobs.map((job) => job.scope.tenantId)).toEqual([TENANT]);
    const { rows: problems } = await db().query<{ key: string; facts: { tenants?: number[] } }>(
      'select key, facts from panel_problems order by key',
    );
    expect(problems.map((one) => one.key)).toEqual(
      expect.arrayContaining([`forms:${String(TENANT)}`, 'login:main', 'somecrm.offices']),
    );
    expect(problems.map((one) => one.key)).not.toContain('login:hjortronet');
    expect(problems.map((one) => one.key)).not.toContain(`forms:${String(gone)}`);
    expect(problems.find((one) => one.key === 'somecrm.offices')?.facts.tenants).toEqual([TENANT]);
    const { rows: checks } = await db().query<{ names: unknown[] }>(
      "select names from health_results where name = 'somecrm.retries'",
    );
    expect(checks[0]?.names).toEqual([{ connection: 'main' }, 'a site']);

    // The other tenant keeps everything it had.
    expect(await left(TENANT, ['main'])).toEqual(before);
    expect((await page()).connections.map((one) => one.id)).toEqual(['main']);
    expect((await call(`/brokerages/${String(gone)}/delete`, { name: 'x' })).status).toBe(404);
  });
});

describe('the Flow', () => {
  const at = (minutesAgo: number): string =>
    new Date(Date.now() - minutesAgo * 60_000).toISOString();

  async function flowOf(query = ''): Promise<Flow> {
    const { status, json } = await call(`/flow${query}`);
    expect(status).toBe(200);
    return json as unknown as Flow;
  }

  beforeEach(async () => {
    await connection('main');
    await records('main', 'Bromma', 1);
    await db().query(`update items set data = '{"name": "Bromma"}' where datatype = 'office'`);
    await db().query(
      `update items set data = '{"address": {"street": "Alviksvägen 44"}}' where datatype = 'property'`,
    );
    const other = await createTenant({ displayName: 'Granstedt Bostad', token: randomUUID() });
    await upsertConnection({ id: 'granstedt', tenantId: other, provider: 'somecrm', name: 'g' });
    listed = [
      {
        connectionId: 'main',
        officeId: 'Bromma',
        datatype: 'property',
        remoteId: 'Bromma-p0',
        queuedAt: at(1),
        reason: 'Notice',
        attempts: 1,
        nextAt: at(-2),
        lastError: 'The system didn’t answer within 30 seconds.',
      },
      {
        connectionId: 'main',
        officeId: 'Bromma',
        datatype: 'property',
        remoteId: 'OBJ1',
        queuedAt: at(0.5),
        reason: 'Notice',
        attempts: 0,
        nextAt: at(0),
        lastError: null,
      },
      {
        connectionId: 'main',
        officeId: 'Bromma',
        datatype: 'property',
        remoteId: 'OBJ2',
        queuedAt: at(300),
        reason: 'Catch-up',
        attempts: 6,
        nextAt: null,
        lastError: 'Answered 500.',
      },
      {
        connectionId: 'granstedt',
        officeId: 'Lund',
        datatype: 'agent',
        remoteId: 'A1',
        queuedAt: at(0.2),
        reason: 'Notice',
        attempts: 0,
        nextAt: null,
        lastError: null,
      },
    ];
    await logEvent({
      type: 'entity.written',
      tenantId: TENANT,
      connectionId: 'main',
      datatype: 'property',
      remoteId: 'Bromma-p0',
      fields: {},
    });
    // A recompute writes too, but nothing a CRM listed.
    await logEvent({
      type: 'entity.written',
      tenantId: TENANT,
      connectionId: 'main',
      datatype: 'office',
      remoteId: 'Bromma',
      fields: { cause: 'recompute' },
    });
  });

  it('lists what the CRMs’ code has queued and what Core wrote, newest first, with the totals', async () => {
    const shown = await flowOf();
    expect(shown.rows.map((row) => [row.state, row.id, row.tenant.name])).toEqual([
      ['written', 'Bromma-p0', 'Lindqvist & Holm Mäkleri'],
      ['waiting', 'A1', 'Granstedt Bostad'],
      ['waiting', 'OBJ1', 'Lindqvist & Holm Mäkleri'],
      ['failed', 'Bromma-p0', 'Lindqvist & Holm Mäkleri'],
      ['given-up', 'OBJ2', 'Lindqvist & Holm Mäkleri'],
    ]);
    expect(shown).toMatchObject({ waiting: 2, failed: 2 });
    const failed = shown.rows.find((row) => row.state === 'failed');
    expect(failed).toMatchObject({
      name: 'Alviksvägen 44',
      office: 'Bromma',
      why: 'Notice',
      attempts: 1,
      lastError: 'The system didn’t answer within 30 seconds.',
      writtenAt: null,
    });
    // A record Core doesn't hold yet goes by the CRM's id; a written one has no queued time.
    expect(shown.rows.find((row) => row.id === 'OBJ1')?.name).toBeNull();
    const written = shown.rows.find((row) => row.state === 'written');
    expect(written).toMatchObject({ queuedAt: null, name: 'Alviksvägen 44', office: 'Bromma' });
    expect(written?.sites).toEqual([{ label: 'test site', state: 'waiting', at: null }]);
    expect(failed?.sites).toEqual([]);
    expect(shown.tenants.map((tenant) => tenant.name)).toEqual([
      'Granstedt Bostad',
      'Lindqvist & Holm Mäkleri',
    ]);
    expect(shown.offices).toEqual([{ key: 'main:Bromma', name: 'Bromma', tenant: TENANT }]);
    expect(shown.maintenance.on).toBe(false);
  });

  it('says whether each website fetched a written record, is held by maintenance or is off', async () => {
    const state = async () =>
      (await flowOf()).rows.find((row) => row.state === 'written')?.sites[0]?.state;
    await writeSetting(MAINTENANCE, 'on', 'anna@kowboy.se');
    expect(await state()).toBe('held');
    expect((await flowOf()).maintenance).toMatchObject({ on: true, by: 'anna@kowboy.se' });
    await db().query('update tenants set active = false where id = $1', [TENANT]);
    expect(await state()).toBe('off');
    await db().query("update subscribers set last_pull_at = now() + interval '1 second'");
    expect(await state()).toBe('fetched');
  });

  it('keeps to the tenants and offices chosen', async () => {
    const mine = await flowOf(`?tenant=${String(TENANT)}`);
    expect(new Set(mine.rows.map((row) => row.tenant.id))).toEqual(new Set([TENANT]));
    expect(mine).toMatchObject({ waiting: 1, failed: 2 });
    const office = await flowOf('?office=main:Bromma');
    expect(office.rows.map((row) => row.id)).toEqual(['Bromma-p0', 'OBJ1', 'Bromma-p0', 'OBJ2']);
    const none = await flowOf('?office=main:Nacka');
    expect(none).toMatchObject({ rows: [], waiting: 0, failed: 0 });
  });
});
