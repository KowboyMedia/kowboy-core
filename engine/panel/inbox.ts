// The Inbox (design B, images 05, 13 to 16, 19 to 22 and 44): what needs a person now, one card per
// problem, urgent first, then oldest first; what waits after someone acted; and what was fixed
// today. Built from what Core already knows: the failing health checks (health.ts; a check's start
// from the alerts' `alert_state`), the forms Core keeps because the CRM did not take them
// (storage/submissions.ts), and a CRM refusing a login, from the event log (the `login.refused`
// kind, attention.ts). A check that names records a CRM's code can't load is one card per
// brokerage, whose records can be tried again (records.ts). Each card is a problem Core keeps until
// it is solved (problems.ts). The engine sends facts; the panel words them. No CRM is named here:
// a CRM's name is its provider's, as the connection carries it.
import { db } from '../storage/db.js';
import {
  aboutCheck,
  healthReport,
  levelOf,
  sitesFound,
  SITES_CHECK,
  type HealthReport,
} from '../health.js';
import { ATTENTION_DAYS } from '../attention.js';
import { NOT_LIVE, providers } from '../registry.js';
import { KEPT_DAYS, keptSubmissions } from '../storage/submissions.js';
import { NO_ANSWER, SUBMISSION_TIMEOUT_MS, UNANSWERED_MS } from '../http/submissions.js';
import { MAINTENANCE, settings } from '../storage/settings.js';
import type { AdminThing, Datatype, HealthResult, SubmissionKind } from '../adapter-api/types.js';
import { reconcile, type Acted, type Fixed } from './problems.js';

/** The levels the Inbox shows: Down, Urgent and Needs a look. P3 stays in the event log. */
export type InboxLevel = 'P0' | 'P1' | 'P2';

export type Tenant = { id: number; name: string };

type Base = {
  key: string;
  level: InboxLevel;
  since: string | null;
  /** Someone acted on it since its evidence, so it waits; null while it needs a person. */
  acted: Acted | null;
};

/** Core's background worker stopped: Core is down for every customer. */
export type WorkerCard = Base & { kind: 'worker'; lastSeenAt: string | null };

/** One form Core keeps, as the resend window lists it; nothing the visitor typed. */
export type KeptForm = {
  id: string;
  kind: SubmissionKind;
  /** The record it was about, by its address or name; null when it named none. */
  record: string | null;
  sentAt: string;
  /** The website it came from, where Core knows it. */
  site: string | null;
  /** The CRM refused it, did not answer in time, or answered with an error. */
  answer: 'refused' | 'none' | 'error';
  /** The CRM's own words for why it refused the form, when it gave them; null otherwise. */
  said: string | null;
};

/** The forms one brokerage's websites sent that the CRM did not take, which Core keeps. */
export type FormsCard = Base & {
  kind: 'forms';
  tenant: Tenant;
  count: number;
  /** Each form, oldest first. */
  forms: KeptForm[];
  /** How long Core waits for the CRM's answer to a form. */
  waitSeconds: number;
  /** The CRMs the forms were for, by name. */
  crms: string[];
  /** The websites they came from, where Core knows it. */
  sites: string[];
  /** When each was sent, oldest first. */
  sentAt: string[];
  /** How many the CRM did not answer, and how many it refused. */
  unanswered: number;
  refused: number;
  /** When the CRM first answered a form again after the last one it did not answer; null if not yet. */
  answeredAgainAt: string | null;
  /** Core keeps a form's details this long, and the oldest goes first. */
  keptUntil: string;
};

/** A CRM refused a connection's login. The CRM's code's own sentence about it is not shown. */
export type LoginCard = Base & {
  kind: 'login';
  tenant: Tenant | null;
  crm: string;
  /** Core's id for the connection, for the window that takes a new login; no page shows it. */
  connectionId: string;
  /** The brokerage's websites. */
  sites: string[];
  /**
   * How many of its offices leave the websites, and when, if the CRM still refuses then, as the
   * CRM's code tells it; null when none would leave or the code does not say.
   */
  leaving: { offices: number; at: string } | null;
};

/** A website has not fetched the changes Core told it about, with its last answer to Core. */
export type SiteCard = Base & {
  kind: 'site';
  tenant: Tenant | null;
  site: string;
  siteId: number;
  /** The platform the website named on its last fetch ("wordpress"), or null before its first. */
  platform: string | null;
  /** Its bell secret, while it refuses Core's bell (401 or 403), for the window that fixes it. */
  bellSecret: string | null;
  lastFetchAt: string | null;
  /** How the site answered Core's last call: `http 401`, `failed` (no answer), `ok`. */
  lastAnswer: string | null;
  lastAnswerAt: string | null;
};

/**
 * Any other failing check: its title and the things it names, as Core names them. The check's own
 * sentences (its detail, its texts and its notes on things) are not shown: a CRM's code writes them,
 * and they can name places the panel does not have.
 */
export type CheckCard = Base & {
  kind: 'check';
  tenants: Tenant[];
  /** What the card is about when no brokerage is: a CRM's name, or null for Core itself. */
  about: string | null;
  title: string;
  names: string[];
};

/** A record a check says can't be loaded, as a person knows it. */
export type FailingRecord = {
  connection: string;
  datatype: Datatype;
  id: string;
  /** Its address or name, from what Core holds of it; null for a record Core has never loaded. */
  name: string | null;
  /**
   * What the CRM's code says about it, in full: where it stands and why it failed ("given up after
   * 6 failed tries. …"). The card shows it under the record's name; null when the code says nothing.
   */
  note: string | null;
  /**
   * Where it stands, as the start of the note says: Core gave up on it, tries it again by itself,
   * or fetches it again now; null when the note says none of these.
   */
  state: 'given-up' | 'retrying' | 'fetching' | null;
};

/**
 * A brokerage's records a check says can't be loaded from a CRM (row 38), which a person can have
 * tried again (row 39). Each record's note shows under its name, so the card says why it failed
 * (Patric, 2026-10-16); the check's detail is not shown.
 */
export type RecordsCard = Base & {
  kind: 'records';
  tenant: Tenant;
  crm: string;
  /** As the check names them, at most as many as it does. */
  records: FailingRecord[];
  /** The brokerage's websites, which miss the records' changes until they load. */
  sites: string[];
  /** When the check last looked, so that a try again is judged by a look after it. */
  checkedAt: string | null;
};

export type Card = WorkerCard | FormsCard | LoginCard | SiteCard | CheckCard | RecordsCard;

export type Inbox = {
  now: string;
  /** The CRMs Core has, by name, for the words that speak of them all. */
  crms: string[];
  worker: { ok: boolean; lastSeenAt: string | null };
  database: { ok: boolean };
  maintenance: { on: boolean; since: string | null; by: string | null };
  /** What needs a person: urgent first, then oldest first. */
  cards: Card[];
  /** What someone acted on, until it is solved or needs a person again. */
  waiting: Card[];
  /** Solved in the last day and a little more, newest first; the panel keeps today's. */
  fixed: Fixed[];
};

/** A CRM's name, from its provider's: what the panel writes for it. */
export const crmName = (provider: string): string =>
  provider.charAt(0).toUpperCase() + provider.slice(1);

const iso = (at: Date | null | undefined): string | null => (at ? at.toISOString() : null);

type Known = {
  tenants: Map<number, string>;
  connections: Map<string, { tenantId: number; provider: string; name: string }>;
};

async function known(): Promise<Known> {
  const [tenants, connections] = await Promise.all([
    db().query<{ id: number; display_name: string }>('select id, display_name from tenants'),
    db().query<{ id: string; tenant_id: number; provider: string; name: string }>(
      'select id, tenant_id, provider, name from connections',
    ),
  ]);
  return {
    tenants: new Map(tenants.rows.map((row) => [Number(row.id), row.display_name])),
    connections: new Map(
      connections.rows.map((row) => [
        row.id,
        { tenantId: Number(row.tenant_id), provider: row.provider, name: row.name },
      ]),
    ),
  };
}

const tenantOf = (id: number | null | undefined, names: Known): Tenant | null => {
  if (id === null || id === undefined) return null;
  const name = names.tenants.get(Number(id));
  return name === undefined ? null : { id: Number(id), name };
};

const ORDER: InboxLevel[] = ['P0', 'P1', 'P2'];

/** Urgent first, then oldest first; a problem whose start Core does not know goes last in its level. */
export function sorted(cards: Card[]): Card[] {
  return [...cards].sort(
    (a, b) =>
      ORDER.indexOf(a.level) - ORDER.indexOf(b.level) ||
      (a.since ?? '￿').localeCompare(b.since ?? '￿'),
  );
}

export async function inbox(): Promise<Inbox> {
  const [health, names] = await Promise.all([healthReport(), known()]);
  const forms = await formsCards(names);
  const cards = [
    ...(await workerCards(health)),
    ...forms,
    ...(await loginCards(names)),
    ...(await siteCards(health, names)),
    ...(await recordsCards(health, names)),
    ...(await checkCards(health, names, new Set(forms.map((card) => card.tenant.id)))),
  ];
  const split = await reconcile(cards, names.tenants);
  const lastSeen = await workerLastSeen();
  const maintenance = (await settings()).find((row) => row.key === MAINTENANCE);
  const on = maintenance?.value === 'on';
  return {
    now: new Date().toISOString(),
    crms: providers().map(crmName),
    worker: { ok: health.checks['worker']?.ok === true, lastSeenAt: iso(lastSeen) },
    database: { ok: health.checks['database']?.ok === true },
    maintenance: {
      on,
      since: on ? iso(maintenance?.updated_at) : null,
      by: on ? (maintenance?.updated_by ?? null) : null,
    },
    cards: sorted(split.needs),
    waiting: sorted(split.waiting),
    fixed: split.fixed,
  };
}

async function workerLastSeen(): Promise<Date | null> {
  const { rows } = await db().query<{ at: Date }>(
    "select at from heartbeats where name = 'worker'",
  );
  return rows[0]?.at ?? null;
}

/** The worker stopped: since it last reported, or since Core first saw it fail when it never has. */
async function workerCards(health: HealthReport): Promise<WorkerCard[]> {
  const check = health.checks['worker'];
  if (!check || check.ok) return [];
  const lastSeen = await workerLastSeen();
  return [
    {
      kind: 'worker',
      key: 'worker',
      level: 'P0',
      since: iso(lastSeen) ?? (await problemSince(['worker'])).get('worker') ?? null,
      acted: null,
      lastSeenAt: iso(lastSeen),
    },
  ];
}

/** When each open problem began, as the alerts' round first saw it. */
async function problemSince(keys: string[]): Promise<Map<string, string>> {
  if (keys.length === 0) return new Map();
  const { rows } = await db().query<{ name: string; since: Date }>(
    'select name, since from alert_state where not ok and name = any($1::text[])',
    [keys],
  );
  return new Map(rows.map((row) => [row.name, row.since.toISOString()]));
}

type KeptRow = Awaited<ReturnType<typeof keptSubmissions>>[number];

const unansweredForm = (row: KeptRow): boolean => row.outcome !== 'refused';

/** How the CRM answered a form Core keeps: it refused it, did not answer in time, or failed. */
const answerOf = (row: KeptRow): KeptForm['answer'] =>
  row.outcome === 'refused'
    ? 'refused'
    : row.outcome === 'failed' && !(row.detail ?? '').startsWith(NO_ANSWER)
      ? 'error'
      : 'none';

/**
 * One card per brokerage for the forms Core keeps because the CRM did not take them. A form the
 * guard held back as a test (forms test mode, or a Core that is not the live service) is no problem.
 */
async function formsCards(names: Known): Promise<FormsCard[]> {
  const kept = (await keptSubmissions(UNANSWERED_MS)).filter((row) => row.detail !== NOT_LIVE);
  if (kept.length === 0) return [];
  const sites = await sitesOfForms(kept.map((row) => row.id));
  const records = await formRecords(kept);
  const byTenant = new Map<number, KeptRow[]>();
  for (const row of kept) {
    const tenantId = Number(row.tenant_id);
    byTenant.set(tenantId, [...(byTenant.get(tenantId) ?? []), row]);
  }
  const cards: FormsCard[] = [];
  for (const [tenantId, rows] of byTenant) {
    const oldest = rows.reduce((a, b) => (a.received_at <= b.received_at ? a : b));
    const unanswered = rows.filter(unansweredForm);
    cards.push({
      kind: 'forms',
      key: `forms:${String(tenantId)}`,
      level: 'P1',
      since: oldest.received_at.toISOString(),
      acted: null,
      tenant: tenantOf(tenantId, names) ?? { id: tenantId, name: oldest.tenant },
      count: rows.length,
      forms: [...rows]
        .sort((a, b) => a.received_at.getTime() - b.received_at.getTime())
        .map((row) => ({
          id: row.id,
          kind: row.kind,
          record: records.get(row.id) ?? null,
          sentAt: row.received_at.toISOString(),
          site: sites.get(row.id) ?? null,
          answer: answerOf(row),
          said: row.outcome === 'refused' ? row.detail?.trim() || null : null,
        })),
      waitSeconds: SUBMISSION_TIMEOUT_MS / 1000,
      crms: [...new Set(rows.map((row) => crmName(row.provider ?? '')).filter(Boolean))],
      sites: [...new Set(rows.flatMap((row) => sites.get(row.id) ?? []))],
      sentAt: rows.map((row) => row.received_at.toISOString()).sort(),
      unanswered: unanswered.length,
      refused: rows.length - unanswered.length,
      answeredAgainAt: unanswered.length > 0 ? await answeredAgain(unanswered) : null,
      keptUntil: new Date(oldest.received_at.getTime() + KEPT_DAYS * 86_400_000).toISOString(),
    });
  }
  return cards;
}

/** The website each form came from, by the site its server named when it sent the form. */
async function sitesOfForms(ids: string[]): Promise<Map<string, string>> {
  const { rows } = await db().query<{ id: string; label: string }>(
    `select distinct on (e.correlation_id) e.correlation_id as id, s.label
     from events e join subscribers s on s.id = e.subscriber_id
     where e.type = 'submission.received' and e.correlation_id = any($1::text[])
     order by e.correlation_id, e.id desc`,
    [ids],
  );
  return new Map(rows.map((row) => [row.id, row.label]));
}

/** The record each form was about, by its address ("Lindängsvägen 12, Malmö") or its name. */
async function formRecords(kept: KeptRow[]): Promise<Map<string, string>> {
  const about = kept.filter((row) => row.datatype && row.remote_id);
  if (about.length === 0) return new Map();
  const { rows } = await db().query<{
    key: string;
    street: string | null;
    city: string | null;
    name: string | null;
  }>(
    `select connection_id || ' ' || datatype || ' ' || remote_id as key,
       data->'address'->>'street' as street, data->'address'->>'city' as city,
       data->>'name' as name
     from items
     where (connection_id, datatype, remote_id) in (
       select * from unnest($1::text[], $2::text[], $3::text[]))`,
    [
      about.map((row) => row.connection_id),
      about.map((row) => row.datatype ?? ''),
      about.map((row) => row.remote_id ?? ''),
    ],
  );
  const named = new Map(
    rows.map((row) => [row.key, [row.street, row.city].filter(Boolean).join(', ') || row.name]),
  );
  const found = new Map<string, string>();
  for (const row of about) {
    const name = named.get(`${row.connection_id} ${row.datatype ?? ''} ${row.remote_id ?? ''}`);
    if (name) found.set(row.id, name);
  }
  return found;
}

/**
 * When the CRM answered again: for each connection with a form it did not answer, the first form
 * it took or refused after the last one it did not answer. Null until every such connection has.
 */
async function answeredAgain(unanswered: KeptRow[]): Promise<string | null> {
  const lastMiss = new Map<string, Date>();
  for (const row of unanswered) {
    const at = row.answered_at ?? row.received_at;
    const before = lastMiss.get(row.connection_id);
    if (!before || at > before) lastMiss.set(row.connection_id, at);
  }
  let latest: Date | null = null;
  for (const [connectionId, miss] of lastMiss) {
    const { rows } = await db().query<{ at: Date | null }>(
      `select min(answered_at) as at from submissions
       where connection_id = $1 and answered_at > $2
         and (outcome = 'delivered' or (outcome = 'refused' and detail is distinct from $3))`,
      [connectionId, miss, NOT_LIVE],
    );
    const at = rows[0]?.at ?? null;
    if (!at) return null;
    if (!latest || at > latest) latest = at;
  }
  return iso(latest);
}

/** Each brokerage's websites, by their names, oldest first. */
async function sitesOf(tenantIds: number[]): Promise<Map<number, string[]>> {
  if (tenantIds.length === 0) return new Map();
  const { rows } = await db().query<{ tenant_id: number; label: string }>(
    'select tenant_id, label from subscribers where tenant_id = any($1::int[]) order by id',
    [tenantIds],
  );
  const sites = new Map<number, string[]>();
  for (const row of rows) {
    const id = Number(row.tenant_id);
    sites.set(id, [...(sites.get(id) ?? []), row.label]);
  }
  return sites;
}

/** The offices that leave the websites and when, as the refusal's event says it; null for none. */
function leavingOf(fields: Record<string, unknown>): LoginCard['leaving'] {
  const offices = Number(fields['offices']);
  const at = fields['leaves_at'];
  if (!Number.isInteger(offices) || offices <= 0 || typeof at !== 'string') return null;
  const time = Date.parse(at);
  return Number.isNaN(time) ? null : { offices, at: new Date(time).toISOString() };
}

/**
 * A CRM refused a connection's login (the `login.refused` kind an adapter logs, attention.ts): the
 * newest per connection from the days the attention list covers. It closes when the CRM's code
 * reads one of the connection's offices again after it (`office.unblocked`), and when a person
 * saves a new login the CRM accepts (problems.ts); otherwise it stays for those days.
 */
async function loginCards(names: Known): Promise<LoginCard[]> {
  const { rows } = await db().query<{
    id: string;
    at: Date;
    connection_id: string;
    tenant_id: number | null;
    fields: Record<string, unknown>;
  }>(
    `select r.* from (
       select distinct on (connection_id) id, at, connection_id, tenant_id, fields from events
       where type = 'login.refused' and connection_id is not null
         and at >= now() - ($1 || ' days')::interval
       order by connection_id, id desc) r
     where not exists (
       select 1 from events u
       where u.type = 'office.unblocked' and u.connection_id = r.connection_id and u.id > r.id)`,
    [ATTENTION_DAYS],
  );
  const sites = await sitesOf([...names.tenants.keys()]);
  const cards: LoginCard[] = [];
  for (const row of rows) {
    const connection = names.connections.get(row.connection_id);
    if (!connection) continue;
    const tenant = tenantOf(row.tenant_id ?? connection.tenantId, names);
    cards.push({
      kind: 'login',
      key: `login:${row.connection_id}`,
      level: 'P1',
      since: row.at.toISOString(),
      acted: null,
      tenant,
      crm: crmName(connection.provider),
      connectionId: row.connection_id,
      sites: tenant ? (sites.get(tenant.id) ?? []) : [],
      leaving: leavingOf(row.fields),
    });
  }
  return cards;
}

/** One card per website the sites check finds behind, with how it last answered Core. */
async function siteCards(health: HealthReport, names: Known): Promise<SiteCard[]> {
  const check = health.checks[SITES_CHECK];
  const sites = check && !check.ok ? sitesFound(check) : null;
  if (!check || !sites || sites.length === 0) return [];
  const { rows } = await db().query<{
    id: string;
    last_bell_at: Date | null;
    last_client: string | null;
    bell_secret: string;
  }>(
    'select id, last_bell_at, last_client, bell_secret from subscribers where id = any($1::bigint[])',
    [sites.map((site) => site.id)],
  );
  const byId = new Map(rows.map((row) => [Number(row.id), row]));
  return sites.map((site) => ({
    kind: 'site',
    key: `${SITES_CHECK}:${String(site.id)}`,
    level: inboxLevel(check) ?? 'P1',
    since: site.toldAt.toISOString(),
    acted: null,
    tenant: tenantOf(site.tenantId, names),
    site: site.label,
    siteId: site.id,
    platform: byId.get(site.id)?.last_client?.split('/')[0]?.toLowerCase() || null,
    bellSecret: /^http (401|403)$/.test(site.lastBellStatus ?? '')
      ? (byId.get(site.id)?.bell_secret ?? null)
      : null,
    lastFetchAt: iso(site.lastPullAt),
    lastAnswer: site.lastBellStatus,
    lastAnswerAt: iso(byId.get(site.id)?.last_bell_at),
  }));
}

const inboxLevel = (check: HealthResult): InboxLevel | null => {
  const level = levelOf(check);
  return level === 'P3' ? null : level;
};

/** A failing check that names records and nothing else: a card per brokerage of them. */
const namesRecords = (check: HealthResult): boolean =>
  (check.names ?? []).length > 0 &&
  (check.names ?? []).every(
    (thing) => typeof thing !== 'string' && thing.record !== undefined && !thing.office,
  );

/**
 * Where a record stands, from the start of the note the CRM's code writes after it, before any
 * reason: "given up after 6 failed tries", "3 failed tries, tried again by itself", "6 failed
 * tries, fetched again now".
 */
function standing(note: string | undefined): Pick<FailingRecord, 'note' | 'state'> {
  const start = (note ?? '').split('. ')[0] ?? '';
  return {
    note: note?.trim() || null,
    state: /^given up\b/.test(start)
      ? 'given-up'
      : /\bagain by itself\b/.test(start)
        ? 'retrying'
        : /\bagain now\b/.test(start)
          ? 'fetching'
          : null,
  };
}

/** When each check was last run, as its process recorded it. */
async function checkedAt(checks: string[]): Promise<Map<string, string>> {
  if (checks.length === 0) return new Map();
  const { rows } = await db().query<{ name: string; at: Date }>(
    'select name, at from health_results where name = any($1::text[])',
    [checks],
  );
  return new Map(rows.map((row) => [row.name, row.at.toISOString()]));
}

/** The records a check names, by the brokerage of their connection, named as Core knows them. */
function recordsByTenant(
  check: HealthResult,
  names: Known,
  recordNamed: Map<string, string>,
): Map<number, { crm: string; records: FailingRecord[] }> {
  const byTenant = new Map<number, { crm: string; records: FailingRecord[] }>();
  for (const thing of thingsOf(check)) {
    const connection = names.connections.get(thing.connection);
    if (!connection || !thing.record) continue;
    const { datatype, id } = thing.record;
    const mine = byTenant.get(connection.tenantId) ?? {
      crm: crmName(connection.provider),
      records: [],
    };
    mine.records.push({
      connection: thing.connection,
      datatype,
      id,
      name: recordNamed.get(`${thing.connection} ${datatype} ${id}`) ?? null,
      ...standing(thing.note),
    });
    byTenant.set(connection.tenantId, mine);
  }
  return byTenant;
}

/**
 * Each failing check that names records a CRM's code can't load: one card per brokerage, its
 * records named by address or name, with where each stands and the websites that miss them.
 */
async function recordsCards(health: HealthReport, names: Known): Promise<RecordsCard[]> {
  const failing = Object.entries(health.checks).filter(
    ([, check]) => !check.ok && inboxLevel(check) !== null && namesRecords(check),
  );
  if (failing.length === 0) return [];
  const since = await problemSince(failing.map(([name]) => name));
  const looked = await checkedAt(failing.map(([name]) => name));
  const recordNamed = await recordNames(failing.flatMap(([, check]) => thingsOf(check)));
  const sites = await sitesOf([...names.tenants.keys()]);
  const cards: RecordsCard[] = [];
  for (const [name, check] of failing) {
    for (const [tenantId, { crm, records }] of recordsByTenant(check, names, recordNamed)) {
      const tenant = tenantOf(tenantId, names);
      if (!tenant) continue;
      cards.push({
        kind: 'records',
        key: `${name}:${String(tenantId)}`,
        level: inboxLevel(check) ?? 'P2',
        since: since.get(name) ?? null,
        acted: null,
        tenant,
        crm,
        records,
        sites: sites.get(tenantId) ?? [],
        checkedAt: looked.get(name) ?? null,
      });
    }
  }
  return cards;
}

/**
 * Every other failing check, by its title and what it names. The worker, each site behind and
 * the records a check can't load have cards of their own, and a CRM not answering forms is the
 * forms card when there is one for its brokerages.
 */
async function checkCards(
  health: HealthReport,
  names: Known,
  formsTenants: Set<number>,
): Promise<CheckCard[]> {
  const failing = Object.entries(health.checks).filter(([name, check]) => {
    if (check.ok || inboxLevel(check) === null || name === 'worker') return false;
    if (name === SITES_CHECK && sitesFound(check)) return false;
    if (namesRecords(check)) return false;
    if (name === 'submissions.failing') {
      const tenants = thingsOf(check).map((thing) => names.connections.get(thing.connection));
      return !tenants.every((connection) => connection && formsTenants.has(connection.tenantId));
    }
    return true;
  });
  const since = await problemSince(failing.map(([name]) => name));
  const records = await recordNames(failing.flatMap(([, check]) => thingsOf(check)));
  const registered = new Set(providers());
  return failing.map(([name, check]) => {
    const tenants = new Map<number, Tenant>();
    for (const thing of thingsOf(check)) {
      const tenant = tenantOf(names.connections.get(thing.connection)?.tenantId, names);
      if (tenant) tenants.set(tenant.id, tenant);
    }
    const provider = name.split('.')[0] ?? '';
    return {
      kind: 'check',
      key: name,
      level: inboxLevel(check) ?? 'P2',
      since: since.get(name) ?? null,
      acted: null,
      tenants: [...tenants.values()],
      about: registered.has(provider) ? crmName(provider) : null,
      title: aboutCheck(name).title,
      names: thingsOf(check).map((thing) => thingWords(thing, names, records)),
    };
  });
}

const thingsOf = (check: HealthResult): AdminThing[] =>
  (check.names ?? []).filter((thing): thing is AdminThing => typeof thing !== 'string');

/** The names of the offices and records the checks name: an office's name, a record's street or name. */
export async function recordNames(things: AdminThing[]): Promise<Map<string, string>> {
  const wanted = things.flatMap((thing) =>
    thing.office
      ? [{ connection: thing.connection, datatype: 'office', id: thing.office }]
      : thing.record
        ? [{ connection: thing.connection, datatype: thing.record.datatype, id: thing.record.id }]
        : [],
  );
  if (wanted.length === 0) return new Map();
  const { rows } = await db().query<{ key: string; name: string | null }>(
    `select connection_id || ' ' || datatype || ' ' || remote_id as key,
       coalesce(data->'address'->>'street', data->>'name') as name
     from items
     where (connection_id, datatype, remote_id) in (
       select * from unnest($1::text[], $2::text[], $3::text[]))`,
    [
      wanted.map((one) => one.connection),
      wanted.map((one) => one.datatype),
      wanted.map((one) => one.id),
    ],
  );
  return new Map(rows.flatMap((row) => (row.name ? [[row.key, row.name]] : [])));
}

/**
 * A thing a check names, as a person knows it: a connection by its brokerage, CRM and name; an
 * office by its name, then the CRM's id for it; a record by its address or name.
 */
function thingWords(thing: AdminThing, names: Known, records: Map<string, string>): string {
  const connection = names.connections.get(thing.connection);
  const tenant = connection ? names.tenants.get(connection.tenantId) : undefined;
  const crm = connection ? crmName(connection.provider) : 'the CRM';
  const through = `${tenant ? `${tenant}’s` : 'a'} ${crm} connection “${connection?.name ?? thing.connection}”`;
  const named = (datatype: string, id: string): string | undefined =>
    records.get(`${thing.connection} ${datatype} ${id}`);
  if (thing.office) {
    const name = named('office', thing.office);
    return `Office ${name ? `${name} (${crm} id ${thing.office})` : `with ${crm} id ${thing.office}`}, of ${through}`;
  }
  if (thing.record) {
    const name = named(thing.record.datatype, thing.record.id);
    const kind = thing.record.datatype.charAt(0).toUpperCase() + thing.record.datatype.slice(1);
    return `${kind} ${name ?? `with ${crm} id ${thing.record.id}`}, of ${through}`;
  }
  return through.charAt(0).toUpperCase() + through.slice(1);
}
