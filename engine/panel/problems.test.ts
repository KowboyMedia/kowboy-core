// The Inbox's problems and its windows (design B, images 13 to 16, 20 to 22 and 39 to 43): a
// problem stays open until it is solved, waits while someone acted on it, and is listed as fixed
// today; the forms a CRM did not take are counted; records
// a CRM can't load are fetched again; a refused login says when its offices leave the websites. A
// stand-in CRM, "somecrm", records what it is asked and calls nothing: its form handler takes every
// form, and its check of failing records says what the test sets. No real CRM is reached, and
// every website's bell address is the harness's own.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { harness, TENANT, type Harness } from '../../acceptance/harness.js';
import { db } from '../storage/db.js';
import { tokenHmac } from '../storage/crypto.js';
import { addSubscriber, createTenant, upsertConnection } from '../storage/connections.js';
import { heartbeat } from '../health.js';
import { logEvent } from '../events.js';
import type { Adapter, Canonical, HealthResult } from '../adapter-api/types.js';
import { COOKIE } from './auth.js';
import type { FormsCard, Inbox, LoginCard, RecordsCard, SiteCard } from './inbox.js';

let core: Harness;
let other: number;
const SESSION = 'problems-test-session';
const GOOD = 'right-password';
/** A port nothing listens on: a website that never answers, and is never anyone's real address. */
const NOWHERE = 'http://127.0.0.1:9/bell';

const asked: {
  sent: string[];
  acts: { action: string; params: Record<string, string>; connections: string[] }[];
} = { sent: [], acts: [] };
/** What the stand-in's check of the records it can't load says. */
let retries: HealthResult = { ok: true };
/** What the stand-in's action fails with, when a test makes it fail. */
let actFails: Error | null = null;

const somecrm: Adapter = {
  manifest: {
    provider: 'somecrm',
    datatypes: ['property', 'office'],
    submissions: ['interest', 'viewing'],
  },
  mappers: {
    property: (raw) => {
      const { street, city } = raw as { street: string; city: string };
      return {
        data: { address: { street, city } } as unknown as Canonical,
        officeId: null,
        remoteUpdatedAt: null,
      };
    },
  },
  start(api) {
    api.healthCheck('somecrm.retries', () => retries);
  },
  admin: {
    credentials: [
      { key: 'account', label: 'Account', required: true },
      { key: 'password', label: 'Password', secret: true, required: true },
    ],
    directions: () => ({ steps: [], settings: [] }),
    panel: () => Promise.resolve([]),
    connection: () => Promise.resolve([]),
    act: (action, params, connections) => {
      asked.acts.push({ action, params, connections: connections.map((one) => one.id) });
      return actFails ? Promise.reject(actFails) : Promise.resolve({ message: 'queued' });
    },
    probe: (credentials) => {
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
  asked.sent = [];
  asked.acts = [];
  retries = { ok: true };
  actFails = null;
  core.bells.length = 0;
  await db().query(
    'truncate submissions, events, alert_state, admin_sessions, heartbeats, health_results, lifecycle_events, panel_problems',
  );
  await db().query('delete from items');
  await db().query('delete from connections');
  await db().query('delete from subscribers where tenant_id <> $1', [TENANT]);
  await db().query('delete from tenants where id <> $1', [TENANT]);
  await db().query(
    `update subscribers set last_pull_at = null, last_bell_at = null, last_bell_status = null,
       bell_pending = null where tenant_id = $1`,
    [TENANT],
  );
  await db().query('update tenants set active = true, display_name = $2 where id = $1', [
    TENANT,
    'Granstedt Bostad',
  ]);
  await upsertConnection({ id: 'somecrm-1', tenantId: TENANT, provider: 'somecrm', name: 'Main' });
  other = await createTenant({ displayName: 'Ekdahl Fastighetsbyrå', token: `t-${randomUUID()}` });
  await db().query(
    `insert into admin_sessions (token_hmac, email, expires_at) values ($1, 'tester@kowboy.se', now() + interval '1 day')`,
    [tokenHmac(SESSION, core.engine.config.credentialsKey)],
  );
  await heartbeat();
});

async function call<T = Record<string, unknown>>(
  path: string,
  body?: unknown,
): Promise<{ status: number; json: T }> {
  const response = await fetch(`${core.baseUrl}/v1/panel${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      cookie: `${COOKIE}=${SESSION}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, json: (await response.json()) as T };
}

const inbox = async (): Promise<Inbox> => (await call<Inbox>('/inbox')).json;

async function property(remoteId: string, street: string, city: string): Promise<void> {
  await db().query(
    `insert into items (tenant_id, connection_id, datatype, remote_id, seq, content_hash, raw, data, rules_version)
     values ($1, 'somecrm-1', 'property', $2, nextval('item_seq'), $3, $4, $5, 'test')`,
    [
      TENANT,
      remoteId,
      `hash-${remoteId}`,
      JSON.stringify({ street, city }),
      JSON.stringify({ address: { street, city } }),
    ],
  );
}

/** A form the CRM did not answer, as Core keeps it: its outcome, never what the visitor wrote. */
async function keptForm(kind: 'interest' | 'viewing', remoteId: string, hoursAgo: number) {
  const id = randomUUID();
  await db().query(
    `insert into submissions (id, tenant_id, connection_id, kind, datatype, remote_id, outcome, detail, received_at, answered_at)
     values ($1, $2, 'somecrm-1', $3, 'property', $4, 'failed', 'the CRM did not answer within 20 s',
             now() - ($5 || ' hours')::interval, now() - ($5 || ' hours')::interval)`,
    [id, TENANT, kind, remoteId, String(hoursAgo)],
  );
  return id;
}

describe('a problem stays open until it is solved', () => {
  it('waits after someone pasted the bell secret, comes back while the website still refuses, and is fixed once it fetches', async () => {
    const site = await addSubscriber({
      tenantId: other,
      label: 'ekdahlfastighet.se',
      bellUrl: NOWHERE,
      bellSecret: 'the-bell-secret',
    });
    await db().query(
      `update subscribers set last_pull_at = now() - interval '3 hours', last_client = 'WordPress/2.4.1',
         last_bell_at = now() - interval '2 hours', last_bell_status = 'http 401' where id = $1`,
      [site],
    );
    await logEvent({ type: 'bell', tenantId: other, subscriberId: site, fields: {} });
    await db().query("update events set at = now() - interval '2 hours' where type = 'bell'");

    let read = await inbox();
    const card = read.cards[0] as SiteCard;
    expect(card).toMatchObject({
      kind: 'site',
      siteId: site,
      platform: 'wordpress',
      bellSecret: 'the-bell-secret',
      acted: null,
    });

    expect((await call('/problems/act', { key: card.key })).status).toBe(200);
    read = await inbox();
    expect(read.cards).toEqual([]);
    expect(read.waiting).toHaveLength(1);
    expect(read.waiting[0]?.acted?.by).toBe('tester@kowboy.se');

    // The website refuses Core's next bell too: the card needs a person again.
    await db().query(
      "update subscribers set last_bell_at = now(), last_bell_status = 'http 401' where id = $1",
      [site],
    );
    read = await inbox();
    expect(read.waiting).toEqual([]);
    expect(read.cards.map((one) => one.key)).toEqual([card.key]);

    await call('/problems/act', { key: card.key });
    await db().query('update subscribers set last_pull_at = now() where id = $1', [site]);
    read = await inbox();
    expect(read.cards).toEqual([]);
    expect(read.waiting).toEqual([]);
    expect(read.fixed).toHaveLength(1);
    expect(read.fixed[0]).toMatchObject({
      key: card.key,
      tenants: [{ id: other, name: 'Ekdahl Fastighetsbyrå' }],
      about: 'ekdahlfastighet.se',
      facts: { kind: 'site', site: 'ekdahlfastighet.se' },
    });

    // Fixed once: another read lists it once and opens nothing.
    expect((await inbox()).fixed).toHaveLength(1);
    expect((await call('/problems/act', { key: card.key })).status).toBe(404);
    expect((await call('/problems/act', { key: 'no-such-problem' })).status).toBe(404);
  });

  it('closes a refused login once a new one the CRM accepts is saved, until the CRM refuses again', async () => {
    await logEvent({ type: 'login.refused', connectionId: 'somecrm-1', fields: { detail: 'No.' } });
    let read = await inbox();
    expect(read.cards[0]).toMatchObject({ kind: 'login', connectionId: 'somecrm-1' });

    const refused = await call('/connections/somecrm-1/edit', {
      login: { account: 'acme', password: 'wrong' },
    });
    expect(refused.status).toBe(422);
    expect((await inbox()).cards).toHaveLength(1);

    const saved = await call('/connections/somecrm-1/edit', {
      login: { account: 'acme', password: GOOD },
    });
    expect(saved.status).toBe(200);
    read = await inbox();
    expect(read.cards).toEqual([]);
    expect(read.fixed.map((one) => one.facts)).toEqual([
      { kind: 'login', crm: 'Somecrm', saved: true },
    ]);

    await logEvent({ type: 'login.refused', connectionId: 'somecrm-1', fields: { detail: 'No.' } });
    expect((await inbox()).cards.map((one) => one.key)).toEqual(['login:somecrm-1']);
  });

  it('solves a refusal no Inbox has read yet, and a new login without a refusal fixes nothing', async () => {
    await call('/connections/somecrm-1/edit', { login: { account: 'acme', password: GOOD } });
    expect((await inbox()).fixed).toEqual([]);

    await logEvent({ type: 'login.refused', connectionId: 'somecrm-1', fields: { detail: 'No.' } });
    await call('/connections/somecrm-1/edit', { login: { account: 'acme', password: GOOD } });
    const read = await inbox();
    expect(read.cards).toEqual([]);
    expect(read.fixed).toHaveLength(1);
  });
});

describe('a refused login', () => {
  it('says how many offices leave the websites and when, and closes once the CRM reads an office again', async () => {
    const leaves = new Date(Date.now() + 86_400_000).toISOString();
    await logEvent({
      type: 'login.refused',
      connectionId: 'somecrm-1',
      fields: { offices: 2, leaves_at: leaves, detail: 'No.' },
    });
    let read = await inbox();
    expect(read.cards[0] as LoginCard).toMatchObject({
      kind: 'login',
      sites: ['test site'],
      leaving: { offices: 2, at: leaves },
    });
    expect(JSON.stringify(read)).not.toContain('No.');

    // The CRM's next office check reads an office of the connection again: the card closes.
    await logEvent({
      type: 'office.unblocked',
      connectionId: 'somecrm-1',
      fields: { office_id: 'o-1' },
    });
    read = await inbox();
    expect(read.cards).toEqual([]);
    expect(read.fixed.map((one) => one.facts)).toEqual([
      { kind: 'login', crm: 'Somecrm', saved: false },
    ]);

    // Refused again with no office to lose: the card is back, and says nothing of offices.
    await logEvent({
      type: 'login.refused',
      connectionId: 'somecrm-1',
      fields: { offices: 0, leaves_at: null, detail: 'No.' },
    });
    read = await inbox();
    expect(read.cards).toHaveLength(1);
    expect((read.cards[0] as LoginCard).leaving).toBeNull();
  });
});

describe('records a CRM can’t load', () => {
  const failing = (
    names: { connection: string; datatype: 'property' | 'agent'; id: string; note: string }[],
  ): HealthResult => ({
    ok: false,
    level: 'P2',
    detail: `${String(names.length)} records failed.`,
    names: names.map(({ connection, datatype, id, note }) => ({
      connection,
      record: { datatype, id },
      note,
    })),
  });

  it('names them per brokerage, has them fetched again, waits, and lists them loaded', async () => {
    await property('P-1', 'Ringvägen 52', 'Stockholm');
    await property('P-2', 'Lidingövägen 12', 'Lidingö');
    await upsertConnection({ id: 'somecrm-2', tenantId: other, provider: 'somecrm', name: 'Two' });
    // The note goes to the card in full; where the record stands is read from its start alone.
    const given =
      'given up after 6 failed tries. The service did not answer, so it is tried again now';
    retries = failing([
      { connection: 'somecrm-1', datatype: 'property', id: 'P-1', note: given },
      { connection: 'somecrm-1', datatype: 'property', id: 'P-2', note: given },
      {
        connection: 'somecrm-1',
        datatype: 'property',
        id: 'P-3',
        note: '3 failed tries, tried again by itself',
      },
      {
        connection: 'somecrm-2',
        datatype: 'agent',
        id: 'A-9',
        note: '6 failed tries, fetched again now',
      },
    ]);
    let read = await inbox();
    expect(read.cards.map((card) => card.kind)).toEqual(['records', 'records']);
    const card = read.cards.find(
      (one) => one.key === `somecrm.retries:${String(TENANT)}`,
    ) as RecordsCard;
    expect(card).toMatchObject({
      level: 'P2',
      tenant: { id: TENANT, name: 'Granstedt Bostad' },
      crm: 'Somecrm',
      sites: ['test site'],
      records: [
        {
          connection: 'somecrm-1',
          datatype: 'property',
          id: 'P-1',
          name: 'Ringvägen 52',
          note: given,
          state: 'given-up',
        },
        { id: 'P-2', name: 'Lidingövägen 12', note: given, state: 'given-up' },
        { id: 'P-3', name: null, note: '3 failed tries, tried again by itself', state: 'retrying' },
      ],
    });
    expect(read.cards.find((one) => one.key === `somecrm.retries:${String(other)}`)).toMatchObject({
      tenant: { id: other },
      records: [{ datatype: 'agent', id: 'A-9', state: 'fetching' }],
    });

    // Only the brokerage's own records, and only records, go to the CRM's code.
    const retry = (records: unknown) =>
      call(`/brokerages/${String(TENANT)}/retry`, { key: card.key, records });
    expect((await retry([{ connection: 'somecrm-2', datatype: 'agent', id: 'A-9' }])).status).toBe(
      404,
    );
    expect((await retry([{ connection: 'somecrm-1', datatype: 'house', id: 'P-1' }])).status).toBe(
      400,
    );
    expect((await retry([])).status).toBe(400);
    expect(asked.acts).toEqual([]);

    const mine = card.records.map(({ connection, datatype, id }) => ({ connection, datatype, id }));
    expect((await retry(mine)).status).toBe(200);
    expect(asked.acts).toEqual([
      {
        action: 'retry_records',
        params: { records: JSON.stringify(mine) },
        connections: ['somecrm-1'],
      },
    ]);

    // The CRM's code tries them again: the card waits, by the person who pressed.
    const again = '6 failed tries, tried again by itself';
    retries = failing([
      { connection: 'somecrm-1', datatype: 'property', id: 'P-1', note: again },
      {
        connection: 'somecrm-1',
        datatype: 'property',
        id: 'P-2',
        note: '6 failed tries, fetched again now',
      },
      { connection: 'somecrm-1', datatype: 'property', id: 'P-3', note: again },
    ]);
    read = await inbox();
    expect(read.cards).toEqual([]);
    expect(read.waiting.map((one) => [one.key, one.acted?.by])).toEqual([
      [card.key, 'tester@kowboy.se'],
    ]);
    // The other brokerage's records no longer fail: its card is fixed, counted by type.
    expect(read.fixed.map((one) => one.facts)).toEqual([
      { kind: 'records', crm: 'Somecrm', counts: { agent: 1 }, name: null },
    ]);

    // Core gives up on one again: the card needs a person again.
    retries = failing([
      {
        connection: 'somecrm-1',
        datatype: 'property',
        id: 'P-1',
        note: 'given up after 7 failed tries',
      },
    ]);
    read = await inbox();
    expect(read.waiting).toEqual([]);
    expect(read.cards.map((one) => one.key)).toEqual([card.key]);

    // Every record loads: listed as fixed, all of them it ever named.
    retries = { ok: true };
    read = await inbox();
    expect(read.cards).toEqual([]);
    expect(read.fixed.find((one) => one.key === card.key)).toMatchObject({
      tenants: [{ id: TENANT, name: 'Granstedt Bostad' }],
      facts: { kind: 'records', crm: 'Somecrm', counts: { property: 3 }, name: null },
    });
  });

  it('says what failed, whose fault it is and what to do when the CRM’s code can’t fetch them again', async () => {
    actFails = new Error('relation "somecrm_list" does not exist');
    const failed = await call(`/brokerages/${String(TENANT)}/retry`, {
      records: [{ connection: 'somecrm-1', datatype: 'property', id: 'P-1' }],
    });
    expect(failed).toEqual({
      status: 502,
      json: {
        error: 'crm',
        message:
          'The part of Core that talks to Somecrm failed, and its error said “relation "somecrm_list" does not exist”. This is a fault in Core, not at Somecrm or in the login, so pass these words on to Core’s developers.',
      },
    });
  });
});

describe('the forms a CRM did not take', () => {
  it('lists them on their brokerage’s card, with the record each was about and the CRM’s answer', async () => {
    await property('P-1', 'Lindängsvägen 12', 'Malmö');
    await property('P-2', 'Södra Förstadsgatan 40', 'Lund');
    const viewing = await keptForm('viewing', 'P-1', 12);
    const interest = await keptForm('interest', 'P-2', 11);

    const card = (await inbox()).cards[0] as FormsCard;
    expect(card).toMatchObject({ kind: 'forms', count: 2, crms: ['Somecrm'] });
    expect(card.forms).toMatchObject([
      { id: viewing, kind: 'viewing', record: 'Lindängsvägen 12, Malmö', answer: 'none' },
      { id: interest, kind: 'interest', record: 'Södra Förstadsgatan 40, Lund', answer: 'none' },
    ]);
    expect(card.waitSeconds).toBe(20);
  });
});
