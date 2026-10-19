// The Inbox (design B, images 05, 19 and 44): what needs a person now, one card per problem,
// urgent first, then oldest first, from what Core already knows. A stand-in CRM, "somecrm", brings
// a health check the test sets; nothing here calls a CRM or sends a form.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { harness, TENANT, type Harness } from '../../acceptance/harness.js';
import { db } from '../storage/db.js';
import { tokenHmac } from '../storage/crypto.js';
import { addSubscriber, createTenant, upsertConnection } from '../storage/connections.js';
import { heartbeat } from '../health.js';
import { logEvent } from '../events.js';
import { NOT_LIVE } from '../registry.js';
import { writeSetting, MAINTENANCE } from '../storage/settings.js';
import { KEPT_DAYS } from '../storage/submissions.js';
import type { Adapter, HealthResult } from '../adapter-api/types.js';
import { COOKIE } from './auth.js';
import type { Card, CheckCard, FormsCard, Inbox, LoginCard, SiteCard } from './inbox.js';

let core: Harness;
let other: number;
let retries: HealthResult = { ok: true };

const somecrm: Adapter = {
  manifest: { provider: 'somecrm', datatypes: ['property', 'office'] },
  mappers: {},
  start(api) {
    api.healthCheck('somecrm.retries', () => retries);
  },
};

const SESSION = 'inbox-test-session';

beforeAll(async () => {
  core = await harness({
    adapters: [somecrm],
    connections: [{ id: 'somecrm-1', provider: 'somecrm' }],
    subscriber: false,
  });
});
afterAll(async () => {
  await core.stop();
});
beforeEach(async () => {
  retries = { ok: true };
  await db().query(
    'truncate submissions, events, alert_state, admin_sessions, heartbeats, settings, health_results, panel_problems',
  );
  await db().query('delete from subscribers');
  await db().query('delete from connections where id <> $1', ['somecrm-1']);
  await db().query('delete from tenants where id <> $1', [TENANT]);
  other = await createTenant({ displayName: 'Granstedt Bostad', token: `t-${randomUUID()}` });
  await upsertConnection({ id: 'somecrm-2', tenantId: other, provider: 'somecrm', name: 'Main' });
  await db().query(
    `insert into admin_sessions (token_hmac, email, expires_at) values ($1, 'tester@kowboy.se', now() + interval '1 day')`,
    [tokenHmac(SESSION, core.engine.config.credentialsKey)],
  );
  await heartbeat();
});

async function read(): Promise<Inbox> {
  const response = await fetch(`${core.baseUrl}/v1/panel/inbox`, {
    headers: { cookie: `${COOKIE}=${SESSION}` },
  });
  expect(response.status).toBe(200);
  return (await response.json()) as Inbox;
}

const ago = (ms: number): Date => new Date(Date.now() - ms);
const HOUR = 3_600_000;

/** A form as Core keeps it: its details stand in as any text, since the Inbox never reads them. */
async function form(input: {
  tenantId: number;
  connectionId: string;
  outcome: 'failed' | 'refused' | 'delivered';
  receivedAt: Date;
  detail?: string;
  site?: number;
}): Promise<string> {
  const id = randomUUID();
  await db().query(
    `insert into submissions (id, tenant_id, connection_id, kind, outcome, detail, received_at, answered_at)
     values ($1, $2, $3, 'interest', $4, $5, $6, $6::timestamptz + interval '20 seconds')`,
    [id, input.tenantId, input.connectionId, input.outcome, input.detail ?? null, input.receivedAt],
  );
  if (input.site) {
    await logEvent({
      type: 'submission.received',
      correlationId: id,
      tenantId: input.tenantId,
      connectionId: input.connectionId,
      subscriberId: input.site,
    });
  }
  return id;
}

const kinds = (cards: Card[]): string[] => cards.map((card) => card.key);

describe('the Inbox lists what needs a person now', () => {
  it('says nothing needs you when every check passes and nothing waits', async () => {
    const inbox = await read();
    expect(inbox.cards).toEqual([]);
    expect(inbox.worker.ok).toBe(true);
    expect(inbox.database.ok).toBe(true);
    expect(inbox.maintenance).toEqual({ on: false, since: null, by: null });
    expect(inbox.crms).toEqual(['Somecrm']);
  });

  it('shows maintenance with since when and by whom', async () => {
    await writeSetting(MAINTENANCE, 'on', 'anna@kowboy.se');
    const { maintenance } = await read();
    expect(maintenance.on).toBe(true);
    expect(maintenance.by).toBe('anna@kowboy.se');
    expect(maintenance.since).not.toBeNull();
  });

  it('puts Core down first while the worker has stopped, with when it last checked in', async () => {
    await db().query("update heartbeats set at = now() - interval '8 minutes'");
    await logEvent({ type: 'login.refused', connectionId: 'somecrm-1', fields: { detail: 'No.' } });
    const inbox = await read();
    expect(inbox.worker.ok).toBe(false);
    const [first] = inbox.cards;
    expect(first?.kind).toBe('worker');
    expect(first?.level).toBe('P0');
    expect(first?.since).toBe(inbox.worker.lastSeenAt);
    expect(Date.now() - Date.parse(first?.since ?? '')).toBeGreaterThan(7 * 60_000);
    expect(kinds(inbox.cards)).toEqual(['worker', 'login:somecrm-1']);
  });

  it('shows one card per brokerage for the forms the CRM did not take, and leaves out test forms', async () => {
    const site = await addSubscriber({
      tenantId: other,
      label: 'granstedtbostad.se',
      bellUrl: 'https://granstedtbostad.se/bell',
      bellSecret: 'secret',
    });
    const first = ago(12 * HOUR);
    await form({
      tenantId: other,
      connectionId: 'somecrm-2',
      outcome: 'failed',
      receivedAt: first,
      site,
    });
    await form({
      tenantId: other,
      connectionId: 'somecrm-2',
      outcome: 'failed',
      receivedAt: ago(11 * HOUR),
      site,
    });
    await form({
      tenantId: other,
      connectionId: 'somecrm-2',
      outcome: 'refused',
      receivedAt: ago(10 * HOUR),
      detail: NOT_LIVE,
    });
    await form({
      tenantId: TENANT,
      connectionId: 'somecrm-1',
      outcome: 'refused',
      receivedAt: ago(HOUR),
      detail: 'No such home.',
    });

    let inbox = await read();
    expect(kinds(inbox.cards)).toEqual([`forms:${String(other)}`, `forms:${String(TENANT)}`]);
    const granstedt = inbox.cards[0] as FormsCard;
    expect(granstedt).toMatchObject({
      level: 'P1',
      tenant: { id: other, name: 'Granstedt Bostad' },
      count: 2,
      crms: ['Somecrm'],
      sites: ['granstedtbostad.se'],
      unanswered: 2,
      refused: 0,
      answeredAgainAt: null,
      since: first.toISOString(),
      keptUntil: new Date(first.getTime() + KEPT_DAYS * 86_400_000).toISOString(),
    });
    expect(granstedt.sentAt).toHaveLength(2);
    expect(inbox.cards[1]).toMatchObject({ count: 1, refused: 1, unanswered: 0, sites: [] });
    // The CRM not answering is this card, not a check card beside it.
    expect(inbox.cards.some((card) => card.key === 'submissions.failing')).toBe(false);

    const answered = ago(3 * HOUR);
    await form({
      tenantId: other,
      connectionId: 'somecrm-2',
      outcome: 'delivered',
      receivedAt: answered,
    });
    inbox = await read();
    expect((inbox.cards[0] as FormsCard).answeredAgainAt).toBe(
      new Date(answered.getTime() + 20_000).toISOString(),
    );
  });

  it('shows a CRM refusing a login, without the CRM code’s words, for the days Core lists such events', async () => {
    await logEvent({
      type: 'login.refused',
      connectionId: 'somecrm-1',
      fields: { detail: 'Somecrm no longer lets this login in.' },
    });
    await logEvent({
      type: 'login.refused',
      connectionId: 'somecrm-2',
      fields: { detail: 'Long ago.' },
    });
    await db().query(
      "update events set at = now() - interval '8 days' where connection_id = 'somecrm-2'",
    );
    const { cards } = await read();
    expect(cards).toHaveLength(1);
    expect(cards[0] as LoginCard).toMatchObject({
      kind: 'login',
      level: 'P1',
      crm: 'Somecrm',
      tenant: { id: TENANT, name: 'Test tenant' },
    });
    expect(JSON.stringify(cards)).not.toContain('no longer lets');
  });

  it('shows a website that stopped updating, with how it last answered Core', async () => {
    const site = await addSubscriber({
      tenantId: other,
      label: 'ekdahlfastighet.se',
      bellUrl: 'https://ekdahlfastighet.se/bell',
      bellSecret: 'secret',
    });
    await db().query(
      `update subscribers set last_pull_at = now() - interval '3 hours',
         last_bell_at = now() - interval '2 hours', last_bell_status = 'http 401' where id = $1`,
      [site],
    );
    const { cards } = await read();
    expect(kinds(cards)).toEqual([`subscribers:${String(site)}`]);
    const card = cards[0] as SiteCard;
    expect(card).toMatchObject({
      kind: 'site',
      level: 'P1',
      site: 'ekdahlfastighet.se',
      tenant: { id: other, name: 'Granstedt Bostad' },
      lastAnswer: 'http 401',
    });
    expect(card.lastAnswerAt).toBe(card.since);
    expect(Date.parse(card.lastFetchAt ?? '')).toBeLessThan(Date.parse(card.since ?? ''));
  });

  it('shows any other failing check by its title, its brokerages and the things it names, never its own words', async () => {
    retries = {
      ok: false,
      level: 'P2',
      detail: 'Two records failed to fetch.',
      names: [
        { connection: 'somecrm-2' },
        { connection: 'somecrm-2', office: 'O1', note: 'refused' },
        'See the fetch list.',
      ],
    };
    await db().query(
      "insert into alert_state (name, ok, since) values ('somecrm.retries', false, now() - interval '30 minutes')",
    );
    const { cards } = await read();
    expect(cards).toHaveLength(1);
    const card = cards[0] as CheckCard;
    expect(card).toMatchObject({
      kind: 'check',
      level: 'P2',
      about: 'Somecrm',
      tenants: [{ id: other, name: 'Granstedt Bostad' }],
      names: [
        'Granstedt Bostad’s Somecrm connection “Main”',
        'Office with Somecrm id O1, of Granstedt Bostad’s Somecrm connection “Main”',
      ],
    });
    for (const words of ['Two records failed', 'refused', 'fetch list']) {
      expect(JSON.stringify(card)).not.toContain(words);
    }
    expect(card.since).not.toBeNull();

    retries = { ok: false, level: 'P3', detail: 'Only recorded.' };
    expect((await read()).cards).toEqual([]);
  });

  it('puts urgent first, then oldest first', async () => {
    retries = { ok: false, level: 'P2', detail: 'Two records failed to fetch.' };
    await form({
      tenantId: other,
      connectionId: 'somecrm-2',
      outcome: 'refused',
      receivedAt: ago(HOUR),
      detail: 'No.',
    });
    await form({
      tenantId: TENANT,
      connectionId: 'somecrm-1',
      outcome: 'refused',
      receivedAt: ago(2 * HOUR),
      detail: 'No.',
    });
    await logEvent({
      type: 'login.refused',
      connectionId: 'somecrm-2',
      fields: { detail: 'Refused.' },
    });
    const { cards } = await read();
    expect(kinds(cards)).toEqual([
      `forms:${String(TENANT)}`,
      `forms:${String(other)}`,
      'login:somecrm-2',
      'somecrm.retries',
    ]);
  });
});
