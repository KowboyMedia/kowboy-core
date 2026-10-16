// The Inbox's problems (design B, rows 23, 36, 37 and 40): every card the Inbox shows is a problem
// that stays open until it is solved. Core keeps each one (migration 021) with who acted on it and
// when, so a card someone acted on waits in "Waiting" until it is solved or the evidence comes
// back, and a solved one is listed under "Fixed today". The cards are worked out afresh at every
// read; this module keeps the problems in step with them. No CRM is named here.
import { db } from '../storage/db.js';
import { ATTENTION_DAYS } from '../attention.js';
import type { Card, Tenant } from './inbox.js';

/** Who acted on a problem and when: "Done, I've pasted it". */
export type Acted = { by: string; at: string };

/**
 * What the Inbox says of a problem once it is solved. A login was put right by a new one a person
 * saved, or the CRM took the old one again; records loaded, counted by their type, and named when
 * there was one.
 */
export type FixedFacts =
  | { kind: 'worker' }
  | { kind: 'forms'; delivered: number; total: number; crms: string[] }
  | { kind: 'login'; crm: string; saved: boolean }
  | { kind: 'site'; site: string }
  | { kind: 'check'; title: string }
  | { kind: 'records'; crm: string; counts: Record<string, number>; name: string | null };

/** A record a problem named while it was open. */
type Seen = { key: string; datatype: string; name: string | null };

/** How many records a problem remembers; a check names at most as many as its code does. */
const SEEN_MOST = 500;

/** A problem solved lately: whose it was, when it was solved, and what put it right. */
export type Fixed = {
  key: string;
  /** Its brokerages, by name; empty for one that was Core's own or a CRM's. */
  tenants: Tenant[];
  /** What it was about when no brokerage: a CRM's name, a website, or null for Core itself. */
  about: string | null;
  solvedAt: string;
  facts: FixedFacts;
};

/** The facts a problem keeps while it is open, for the words once its card is gone. */
type OpenFacts =
  | { kind: 'worker' }
  | { kind: 'forms'; ids: string[]; crms: string[] }
  | { kind: 'login'; crm: string }
  | { kind: 'site'; site: string; siteId: number }
  | { kind: 'check'; title: string; tenants: number[]; about: string | null }
  | { kind: 'records'; crm: string; seen: Seen[] };

type Row = {
  id: string;
  key: string;
  tenant_id: number | null;
  opened_at: Date;
  facts: OpenFacts | (FixedFacts & { tenants?: number[]; about?: string | null });
  acted_by: string | null;
  acted_at: Date | null;
  solved_at: Date | null;
  solved_by: string | null;
};

/** The cards split as the Inbox shows them, and the problems solved in the last day and more. */
export type Split = { needs: Card[]; waiting: Card[]; fixed: Fixed[] };

/** How long a solved problem is kept. */
const KEPT_DAYS = 30;

/** "Fixed today" on any clock: the panel keeps those of its own day. */
const FIXED_HOURS = 26;

const tenantIdOf = (card: Card): number | null => {
  if (card.kind === 'forms' || card.kind === 'records') return card.tenant.id;
  if (card.kind === 'login' || card.kind === 'site') return card.tenant?.id ?? null;
  if (card.kind === 'check' && card.tenants.length === 1) return card.tenants[0]?.id ?? null;
  return null;
};

/** Every record a records card named while its problem was open, the newest names kept. */
function seenOf(card: Card & { kind: 'records' }, before: Row['facts'] | undefined): Seen[] {
  const known = before?.kind === 'records' && 'seen' in before ? before.seen : [];
  const seen = new Map(known.map((one) => [one.key, one]));
  for (const record of card.records) {
    const key = `${record.connection} ${record.datatype} ${record.id}`;
    if (seen.size < SEEN_MOST || seen.has(key)) {
      seen.set(key, { key, datatype: record.datatype, name: record.name });
    }
  }
  return [...seen.values()];
}

function factsOf(card: Card, before: Row['facts'] | undefined): OpenFacts {
  switch (card.kind) {
    case 'worker':
      return { kind: 'worker' };
    case 'forms': {
      const known = before?.kind === 'forms' && 'ids' in before ? before.ids : [];
      return {
        kind: 'forms',
        ids: [...new Set([...known, ...card.forms.map((form) => form.id)])],
        crms: card.crms,
      };
    }
    case 'login':
      return { kind: 'login', crm: card.crm };
    case 'site':
      return { kind: 'site', site: card.site, siteId: card.siteId };
    case 'check':
      return {
        kind: 'check',
        title: card.title,
        tenants: card.tenants.map((tenant) => tenant.id),
        about: card.about,
      };
    case 'records':
      return { kind: 'records', crm: card.crm, seen: seenOf(card, before) };
  }
}

/**
 * When the evidence of a problem is newer than a person's act on it, the act is spent and the card
 * needs a person again: a website that still refuses Core after someone pasted its secret, or a
 * record Core gave up on again after someone had it tried again.
 */
function spentAt(card: Card): number | null {
  if (card.kind === 'site' && card.lastAnswer !== 'ok' && card.lastAnswerAt) {
    return Date.parse(card.lastAnswerAt);
  }
  if (card.kind === 'records' && card.checkedAt) {
    return card.records.some((record) => record.state === 'given-up')
      ? Date.parse(card.checkedAt)
      : null;
  }
  return null;
}

/**
 * A card a person put right after its evidence stays away until there is newer evidence: a login
 * the CRM refused, once a new one the CRM accepts is saved.
 */
const evidenceAt = (card: Card): number | null =>
  card.kind === 'login' && card.since ? Date.parse(card.since) : null;

async function openRows(): Promise<Map<string, Row>> {
  const { rows } = await db().query<Row>('select * from panel_problems where solved_at is null');
  return new Map(rows.map((row) => [row.key, row]));
}

/** The cards a person has not put right since their evidence. */
async function stillOpen(cards: Card[]): Promise<Card[]> {
  const keys = cards.filter((card) => evidenceAt(card) !== null).map((card) => card.key);
  if (keys.length === 0) return cards;
  const { rows } = await db().query<{ key: string; at: Date }>(
    `select key, max(solved_at) as at from panel_problems
     where key = any($1::text[]) and solved_by is not null group by key`,
    [keys],
  );
  const solved = new Map(rows.map((row) => [row.key, row.at.getTime()]));
  return cards.filter((card) => {
    const evidence = evidenceAt(card);
    const at = solved.get(card.key);
    return evidence === null || at === undefined || evidence > at;
  });
}

async function open(card: Card): Promise<Row | null> {
  const { rows } = await db().query<Row>(
    `insert into panel_problems (key, tenant_id, opened_at, facts)
     values ($1, $2, coalesce($3::timestamptz, now()), $4)
     on conflict (key) where solved_at is null do nothing
     returning *`,
    [card.key, tenantIdOf(card), card.since, JSON.stringify(factsOf(card, undefined))],
  );
  if (rows[0]) return rows[0];
  const { rows: existing } = await db().query<Row>(
    'select * from panel_problems where key = $1 and solved_at is null',
    [card.key],
  );
  return existing[0] ?? null;
}

/** One time from the database, or null. */
async function timeOf(sql: string, values: unknown[]): Promise<Date | null> {
  const { rows } = await db().query<{ at: Date | null }>(sql, values);
  return rows[0]?.at ?? null;
}

/** The part of a problem's key before its last colon: the check of a brokerage's records. */
const before = (key: string): string => key.slice(0, Math.max(0, key.lastIndexOf(':')));

/**
 * When a problem whose card is gone was put right, as near as Core knows it: the website's fetch,
 * the CRM taking the last form, the alerts seeing the check pass, the check last looking, the CRM
 * reading an office of the connection again, the worker reporting again.
 */
function evidenceOfFix(row: Row): Promise<Date | null> {
  const facts = row.facts;
  if (facts.kind === 'records') {
    return timeOf('select at from health_results where name = $1', [before(row.key)]);
  }
  if (facts.kind === 'login') {
    return timeOf(
      `select min(at) as at from events
       where type = 'office.unblocked' and connection_id = $1 and at >= $2`,
      [row.key.slice('login:'.length), row.opened_at],
    );
  }
  if (facts.kind === 'site' && 'siteId' in facts) {
    return timeOf('select last_pull_at as at from subscribers where id = $1', [facts.siteId]);
  }
  if (facts.kind === 'forms' && 'ids' in facts) {
    return timeOf(
      `select max(answered_at) as at from submissions
       where id::text = any($1::text[]) and outcome = 'delivered'`,
      [facts.ids],
    );
  }
  if (facts.kind === 'check') {
    return timeOf('select since as at from alert_state where name = $1 and ok', [row.key]);
  }
  if (facts.kind === 'worker') {
    return timeOf("select at from heartbeats where name = 'worker'", []);
  }
  return Promise.resolve(null);
}

async function solvedTime(row: Row, now: Date): Promise<Date> {
  const at = await evidenceOfFix(row);
  return at && at >= row.opened_at && at <= now ? at : now;
}

/** The records a problem named, counted by their type, and the one's name when there was one. */
function recordsFacts(crm: string, seen: Seen[]): FixedFacts {
  const counts: Record<string, number> = {};
  for (const one of seen) counts[one.datatype] = (counts[one.datatype] ?? 0) + 1;
  return { kind: 'records', crm, counts, name: seen.length === 1 ? (seen[0]?.name ?? null) : null };
}

/**
 * What stays of a problem once solved: for forms, how many of them the CRM took; for records, how
 * many there were.
 */
async function solvedFacts(row: Row): Promise<Row['facts']> {
  const facts = row.facts;
  if (facts.kind === 'records' && 'seen' in facts) return recordsFacts(facts.crm, facts.seen);
  if (facts.kind !== 'forms' || !('ids' in facts)) return facts;
  const { rows } = await db().query<{ n: string }>(
    `select count(*) as n from submissions
     where id::text = any($1::text[]) and outcome = 'delivered'`,
    [facts.ids],
  );
  return {
    kind: 'forms',
    delivered: Number(rows[0]?.n ?? 0),
    total: facts.ids.length,
    crms: facts.crms,
  };
}

async function solve(row: Row, now: Date): Promise<void> {
  await db().query(
    'update panel_problems set solved_at = $2, facts = $3 where id = $1 and solved_at is null',
    [row.id, await solvedTime(row, now), JSON.stringify(await solvedFacts(row))],
  );
}

/**
 * Keep the problems in step with the cards: a new card opens a problem, a card that is gone
 * solves its problem, and each card is told whether someone acted on it since its evidence.
 */
export async function reconcile(cards: Card[], tenants: Map<number, string>): Promise<Split> {
  const now = new Date();
  const rows = await openRows();
  const fresh = await stillOpen(cards.filter((card) => !rows.has(card.key)));
  const shown = cards.filter((card) => rows.has(card.key) || fresh.includes(card));
  const needs: Card[] = [];
  const waiting: Card[] = [];
  for (const card of shown) {
    const acted = actedOn(card, await kept(card, rows.get(card.key)));
    if (acted) waiting.push({ ...card, acted });
    else needs.push(card);
  }
  const keys = new Set(shown.map((card) => card.key));
  for (const row of rows.values()) if (!keys.has(row.key)) await solve(row, now);
  await db().query(
    `delete from panel_problems where solved_at < now() - ($1 || ' days')::interval`,
    [KEPT_DAYS],
  );
  return { needs, waiting, fixed: await fixedLately(tenants) };
}

/** The card's open problem, opened now if it has none, its facts kept current. */
async function kept(card: Card, row: Row | undefined): Promise<Row | null> {
  if (!row) return open(card);
  const facts = factsOf(card, row.facts);
  if (JSON.stringify(facts) !== JSON.stringify(row.facts)) {
    await db().query('update panel_problems set facts = $2 where id = $1', [
      row.id,
      JSON.stringify(facts),
    ]);
  }
  return row;
}

/** Who acted on the card's problem and when, while the act is not spent; null when nobody did. */
function actedOn(card: Card, row: Row | null): Acted | null {
  if (!row?.acted_by || !row.acted_at) return null;
  const spent = spentAt(card);
  if (spent !== null && spent > row.acted_at.getTime()) return null;
  return { by: row.acted_by, at: row.acted_at.toISOString() };
}

/** The problems solved in the last day and a little more, newest first, as their lines say them. */
async function fixedLately(tenants: Map<number, string>): Promise<Fixed[]> {
  const { rows } = await db().query<Row>(
    `select * from panel_problems where solved_at >= now() - ($1 || ' hours')::interval
     order by solved_at desc, id desc`,
    [FIXED_HOURS],
  );
  const fixed: Fixed[] = [];
  for (const row of rows) {
    const facts = row.facts;
    // Forms none of which the CRM took were not put right: Core stopped keeping them.
    if (facts.kind === 'forms' && (!('delivered' in facts) || facts.delivered === 0)) continue;
    const ids =
      row.tenant_id !== null
        ? [Number(row.tenant_id)]
        : 'tenants' in facts
          ? (facts.tenants ?? [])
          : [];
    fixed.push({
      key: row.key,
      tenants: ids.flatMap((id) => {
        const name = tenants.get(Number(id));
        return name === undefined ? [] : [{ id: Number(id), name }];
      }),
      about: facts.kind === 'site' ? facts.site : 'about' in facts ? (facts.about ?? null) : null,
      solvedAt: (row.solved_at ?? new Date()).toISOString(),
      facts: shownFacts(row),
    });
  }
  return fixed;
}

function shownFacts(row: Row): FixedFacts {
  const facts = row.facts;
  switch (facts.kind) {
    case 'forms':
      return 'delivered' in facts
        ? { kind: 'forms', delivered: facts.delivered, total: facts.total, crms: facts.crms }
        : { kind: 'forms', delivered: 0, total: 0, crms: facts.crms };
    case 'login':
      return { kind: 'login', crm: facts.crm, saved: row.solved_by !== null };
    case 'records':
      return 'seen' in facts ? recordsFacts(facts.crm, facts.seen) : facts;
    case 'site':
      return { kind: 'site', site: facts.site };
    case 'check':
      return { kind: 'check', title: facts.title };
    default:
      return { kind: 'worker' };
  }
}

/**
 * A person acted on an open problem ("Done, I've pasted it", "Retry 3 properties"): it waits until
 * it is solved. With a brokerage, only a problem of that brokerage.
 */
export async function actOn(key: string, by: string, tenantId?: number): Promise<boolean> {
  const { rows } = await db().query(
    `update panel_problems set acted_by = $2, acted_at = now()
     where key = $1 and solved_at is null and ($3::int is null or tenant_id = $3) returning id`,
    [key, by, tenantId ?? null],
  );
  return rows.length === 1;
}

/**
 * A new login the CRM accepted solves the problem of the CRM refusing the old one, by the person
 * who saved it. When no Inbox has read the refusal yet, the problem is opened and solved at once,
 * so the card does not come back; a connection whose login was not refused has no problem.
 */
export async function solveLogin(connectionId: string, crm: string, by: string): Promise<void> {
  const key = `login:${connectionId}`;
  const { rows } = await db().query(
    `update panel_problems set solved_at = now(), solved_by = $2
     where key = $1 and solved_at is null returning id`,
    [key, by],
  );
  if (rows.length > 0) return;
  await db().query(
    `insert into panel_problems (key, tenant_id, opened_at, facts, solved_at, solved_by)
     select $1, c.tenant_id, e.at, $3, now(), $2
     from connections c,
       (select max(at) as at from events
        where type = 'login.refused' and connection_id = $4
          and at >= now() - ($5 || ' days')::interval) e
     where c.id = $4 and e.at is not null
       and not exists (select 1 from panel_problems p where p.key = $1 and p.solved_at >= e.at)`,
    [key, by, JSON.stringify({ kind: 'login', crm }), connectionId, ATTENTION_DAYS],
  );
}
