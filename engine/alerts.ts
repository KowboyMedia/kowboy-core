// Alerts (questions 159 and 164): what needs the super admin, told by mail, a Slack incoming
// webhook or both, by its level. A problem is a failing health check, or one site the sites check
// finds behind: it opens when the worker's round first sees it and closes when the round no longer
// does, each a `check.failed` or `check.recovered` event. P0 (Core down for every customer) is told
// once it has lasted 5 minutes and P1 (one customer disrupted) once it has lasted 15, each once,
// and its end once if its start was told; a problem that ends sooner is only in the event log
// (rules A and D). An event that needs attention (attention.ts) is told at the next round when it
// is P1. P2 goes in one mail at 07:00 Stockholm time, with what started since the last one, and
// none when nothing did. P3 stays in the event log. What is due in one round goes in one mail, and
// while a P0 is open nothing else is told (rule B). A round reads first, tells next and keeps what
// changed last, so a round that fails half way tells it again rather than never, and one round
// runs at a time, also while a deploy runs two workers.
import { db } from './storage/db.js';
import {
  aboutCheck,
  detailOf,
  healthReport,
  levelOf,
  sitesFound,
  SITES_CHECK,
  type SiteBehind,
} from './health.js';
import type { HealthResult, Level } from './adapter-api/types.js';
import { logEvent, type EventFields } from './events.js';
import { mailConfigured, sendMail } from './mail.js';
import { report } from './errors.js';
import { attentionBetween, connectionsNamed, KINDS, type AttentionRow } from './attention.js';
import { capital, counted, lasting, listed } from './admin/words.js';

export type AlertConfig = {
  environment: string;
  publicUrl: string | null;
  email: string | null;
  slackWebhookUrl: string | null;
};

/** How long a problem lasts before it is told (rule A), and a P2 before it counts for 07:00. */
const WAIT_MS: Record<Level, number> = {
  P0: 5 * 60_000,
  P1: 15 * 60_000,
  P2: 15 * 60_000,
  P3: Number.POSITIVE_INFINITY,
};

/** Events are read up to this long ago, so one still being written is never passed over. */
const SETTLE = '10 seconds';

/** The round's places, kept beside the problems: how far it read the event log, 07:00, and its turn. */
const READ_UP_TO = 'alerts:events';
const MORNING_MAIL = 'alerts:morning';
const TURN = 'alerts:turn';
/** A turn not given back within this long belonged to a worker that stopped half way through a round. */
const TURN_HELD = '2 minutes';

/** One thing to tell, in the words of its mail. */
type Words = {
  /** A short line naming what is wrong: the mail's subject when it is told alone. */
  title: string;
  /** The thing, when the title does not name it. */
  which: string | null;
  /** Where the thing is, when it does not say: its connection, or its tenant. */
  where: string | null;
  /** What happened, what it means for the sites, and what to do. */
  said: string;
  /** Its place in the admin area, a path under /admin. */
  link: string;
};

/** One open problem: which check found it, how much it matters, and the words it is told in. */
type Problem = Words & { key: string; level: Level; fields: EventFields };

type StateRow = {
  name: string;
  ok: boolean;
  detail: string | null;
  since: Date;
  notified_at: Date | null;
};

/** What a round opened and closed, by the problems' keys. */
export type Round = { opened: string[]; closed: string[] };

/** One thing a message tells: its level, or null for an end, its heading, its words, and its line in `alert.sent`. */
type Told = { level: Level | null; heading: string; words: Words; change: string };

/**
 * The worker's round, once a minute: open and close the problems, tell what is due, then the
 * events that need attention, then, once a day, the 07:00 mail.
 */
export async function checkAlerts(config: AlertConfig): Promise<Round> {
  if (!(await takeTurn())) return { opened: [], closed: [] };
  try {
    return await round(config);
  } finally {
    await db().query('delete from alert_state where name = $1', [TURN]);
  }
}

/** The round's turn, when no other round holds it, or the one holding it stopped (rule D). */
async function takeTurn(): Promise<boolean> {
  const { rowCount } = await db().query(
    `insert into alert_state (name, ok, since) values ($1, true, now())
     on conflict (name) do update set since = now() where alert_state.since < now() - $2::interval`,
    [TURN, TURN_HELD],
  );
  return rowCount === 1;
}

/** One round: read what is open now and what the last rounds kept, tell what is due, then keep it. */
async function round(config: AlertConfig): Promise<Round> {
  const { problems, sitesUnknown } = await problemsNow();
  const { rows } = await db().query<StateRow>(
    'select name, ok, detail, since, notified_at from alert_state',
  );
  const kept = new Map(rows.map((row) => [row.name, row]));
  const isDown = problems.some((problem) => problem.level === 'P0');
  // The events that need attention: held while Core is down, read from where the last round stopped.
  const events = isDown ? null : await eventsSince(READ_UP_TO);

  // A problem ends when the round no longer finds it. A site's stays open while the sites check
  // cannot run, since it cannot say then which sites are behind.
  const open = new Set(problems.map((problem) => problem.key));
  const ended = rows.filter(
    (row) =>
      !row.name.startsWith('alerts:') &&
      !open.has(row.name) &&
      !(sitesUnknown && row.name.startsWith(`${SITES_CHECK}:`)),
  );
  const dueNow = new Set(
    problems.filter((problem) => {
      const row = kept.get(problem.key);
      return row && !row.ok && !row.notified_at && due(problem.level, row.since, isDown);
    }),
  );
  const told = [
    ...ended.flatMap(endTold),
    ...[...dueNow].map(problemTold),
    ...eventsTold(events?.rows ?? [], 'P1'),
  ];
  if (told.length > 0) {
    await send(
      `Core ${config.environment}: ${subjectOf(told)}`,
      told.map((item) => paragraph(item.heading, item.words, config)),
      config,
      { changes: told.map((item) => item.change) },
    );
  }

  const result: Round = { opened: [], closed: [] };
  for (const row of ended) if (await close(row)) result.closed.push(row.name);
  for (const problem of problems) {
    if (await keep(problem, kept.get(problem.key), dueNow.has(problem)))
      result.opened.push(problem.key);
  }
  if (events) await keepPlace(READ_UP_TO, events.until);
  if (!isDown) await morningMail(problems, kept, config);
  return result;
}

/** The end of a problem, told when its start was, in the words its start kept. */
function endTold(row: StateRow): Told[] {
  const words = wordsOf(row);
  if (row.ok || !row.notified_at || !words) return [];
  return [
    {
      level: null,
      heading: `Resolved after ${lasting(Date.now() - row.since.getTime())}`,
      words,
      change: `${row.name} resolved`,
    },
  ];
}

const problemTold = (problem: Problem): Told => ({
  level: problem.level,
  heading: problem.level,
  words: problem,
  change: `${problem.key} ${problem.level}`,
});

/** The events that need attention at one level, as they are told. */
const eventsTold = (rows: AttentionRow[], level: Level): Told[] =>
  rows
    .filter((row) => row.level === level)
    .map((row) => ({
      level,
      heading: level,
      words: eventWords(row),
      change: `event ${row.ids.join(',')} ${level}`,
    }));

/**
 * Keep an open problem: a new one starts, with a `check.failed` event, and true; one told now is
 * marked told; one kept before the levels takes its words, and is told no more than it was.
 */
async function keep(problem: Problem, row: StateRow | undefined, told: boolean): Promise<boolean> {
  const words = JSON.stringify(wordsOnly(problem));
  if (!row || row.ok) {
    await db().query(
      `insert into alert_state (name, ok, detail, since, notified_at) values ($1, false, $2, now(), null)
       on conflict (name) do update set ok = false, detail = excluded.detail, since = now(), notified_at = null`,
      [problem.key, words],
    );
    await logEvent({ type: 'check.failed', fields: problem.fields });
    return true;
  }
  if (told) {
    await db().query('update alert_state set detail = $2, notified_at = now() where name = $1', [
      problem.key,
      words,
    ]);
  } else if (!wordsOf(row)) {
    await db().query('update alert_state set detail = $2 where name = $1', [problem.key, words]);
  }
  return false;
}

/**
 * Close a problem that ended, with a `check.recovered` event; false for a check's green state and
 * for a problem kept before the levels, which has no words to end in and goes without a word.
 */
async function close(row: StateRow): Promise<boolean> {
  await db().query('delete from alert_state where name = $1', [row.name]);
  const words = wordsOf(row);
  if (row.ok || !words) return false;
  // The thing it was about, when the check's title does not say it: "a site is not fetching its
  // changes, site acme.se, of Acme".
  await logEvent({
    type: 'check.recovered',
    fields: {
      name: row.name.split(':')[0] ?? row.name,
      ...(words.which ? { detail: `${words.title}, ${words.which}` } : {}),
    },
  });
  return true;
}

/** The subject: the one thing told, or how many started and ended, and the worst level. */
function subjectOf(told: Told[]): string {
  const [only] = told;
  if (told.length === 1 && only)
    return `${only.level ?? 'Resolved'} · ${capital(only.words.title)}`;
  let worst: Level | null = null;
  for (const item of told) if (item.level) worst = higher(worst, item.level);
  const fresh = told.filter((item) => item.level !== null).length;
  const resolved = told.length - fresh;
  return [
    fresh > 0 && `${counted(fresh, 'problem', 'problems')}, the worst ${worst ?? 'P1'}`,
    resolved > 0 && `${counted(resolved, 'problem', 'problems')} resolved`,
  ]
    .filter((part) => part)
    .join('; ');
}

/** Whether a problem is told now: P0 and P1 once they have lasted their wait, a P0 alone while one is open. */
const due = (level: Level, since: Date, isDown: boolean): boolean =>
  (level === 'P0' || (level === 'P1' && !isDown)) && Date.now() - since.getTime() >= WAIT_MS[level];

const ORDER: Level[] = ['P0', 'P1', 'P2', 'P3'];
const higher = (a: Level | null, b: Level): Level =>
  a === null || ORDER.indexOf(b) < ORDER.indexOf(a) ? b : a;

/**
 * The problems open now: one per failing check, and one per site the sites check finds behind;
 * `sitesUnknown` when the sites check failed without finding any, because it could not run.
 */
async function problemsNow(): Promise<{ problems: Problem[]; sitesUnknown: boolean }> {
  const health = await healthReport();
  const problems: Problem[] = [];
  let sitesUnknown = false;
  for (const [name, check] of Object.entries(health.checks)) {
    if (check.ok) continue;
    // The sites one by one, each with its own start and end (question 164, rule A per thing).
    const sites = name === SITES_CHECK ? sitesFound(check) : null;
    if (sites) {
      problems.push(...(await sitesProblems(check, sites)));
      continue;
    }
    if (name === SITES_CHECK) sitesUnknown = true;
    problems.push(await checkProblem(name, check));
  }
  return { problems, sitesUnknown };
}

/** A failing check as one problem; the things it names are its "Which", in words Core knows them by. */
async function checkProblem(name: string, check: HealthResult): Promise<Problem> {
  const about = aboutCheck(name);
  const names = check.names ?? [];
  const named =
    about.named === 'connections'
      ? (await connectionsNamed(names)).map((connection) => connection.label)
      : names;
  const which = named.length > 0 ? listed(named, named.length) : null;
  return {
    key: name,
    level: levelOf(check),
    title: about.title,
    which,
    where: null,
    said: detailOf(check) ?? 'The check fails.',
    link: about.page.to,
    fields: { name, detail: detailOf(check) ?? null, names, ...(which ? { which } : {}) },
  };
}

async function sitesProblems(check: HealthResult, sites: SiteBehind[]): Promise<Problem[]> {
  const { rows } = await db().query<{ id: number; display_name: string }>(
    'select id, display_name from tenants',
  );
  const tenants = new Map(rows.map((row) => [Number(row.id), row.display_name]));
  const title = KINDS.find((kind) => kind.name === SITES_CHECK)?.title ?? SITES_CHECK;
  return sites.map((site) => {
    const fetched = site.lastPullAt
      ? `Its last fetch was ${lasting(Date.now() - site.lastPullAt.getTime())} ago.`
      : 'It has never fetched.';
    const said = `Core told the site about changes over an hour ago, and it has not fetched them since, so it may show homes that have changed or are gone. ${fetched} Check that the site is up and that its plugin reaches Core.`;
    const tenant = tenants.get(site.tenantId);
    const which = `site ${site.label}${tenant ? `, of ${tenant}` : ''}`;
    return {
      key: `${SITES_CHECK}:${String(site.id)}`,
      level: levelOf(check),
      title,
      which,
      where: null,
      said,
      link: `/tenants/${String(site.tenantId)}#site:${String(site.id)}`,
      fields: {
        name: SITES_CHECK,
        detail: said,
        names: [site.label],
        which,
        sites: [{ id: site.id, tenantId: site.tenantId, label: site.label }],
      },
    };
  });
}

/** An event's line as a mail tells it. */
const eventWords = (row: AttentionRow): Words => ({
  title: row.kind.title,
  which: row.what,
  where: row.where,
  said: row.said,
  link: row.link,
});

const wordsOnly = ({ title, which, where, said, link }: Words): Words => ({
  title,
  which,
  where,
  said,
  link,
});

/** A problem's words as its start kept them, or null for a row kept before the levels, which kept none. */
function wordsOf(row: StateRow): Words | null {
  try {
    const kept = JSON.parse(row.detail ?? '') as Partial<Words> | null;
    if (typeof kept?.title !== 'string' || typeof kept.said !== 'string') return null;
    return {
      title: kept.title,
      which: kept.which ?? null,
      where: kept.where ?? null,
      said: kept.said,
      link: kept.link ?? '/',
    };
  } catch {
    return null;
  }
}

/** One thing told: its level or "Resolved", the thing and where it is, what happened, and the way to it. */
const paragraph = (heading: string, words: Words, config: AlertConfig): string =>
  [
    `${heading} · ${capital(words.title)}`,
    words.which && `Which: ${words.which}`,
    words.where && `Where: ${words.where}`,
    `What happened: ${words.said}`,
    `Open it: ${opened(words.link, config)}`,
  ]
    .filter((line) => line)
    .join('\n');

/** The place in the admin area, as a whole address when Core knows its own. */
const opened = (link: string, config: AlertConfig): string =>
  config.publicUrl ? `${config.publicUrl}/admin${link}` : `the admin area, ${link}`;

/**
 * The events that need attention since the place kept under `name`, up to a few seconds ago; the
 * first round starts from now, so nothing told before is told again.
 */
async function eventsSince(name: string): Promise<{ rows: AttentionRow[]; until: Date }> {
  const { rows } = await db().query<{ since: Date | null; until: Date }>(
    `select (select since from alert_state where name = $1) as since, now() - $2::interval as until`,
    [name, SETTLE],
  );
  const since = rows[0]?.since ?? null;
  const until = rows[0]?.until ?? new Date();
  return { rows: since ? await attentionBetween(since, until) : [], until };
}

async function keepPlace(name: string, at: Date): Promise<void> {
  await db().query(
    `insert into alert_state (name, ok, since) values ($1, true, $2)
     on conflict (name) do update set since = excluded.since`,
    [name, at],
  );
}

/**
 * The 07:00 mail (Stockholm time): the P2 problems that have lasted their 15 minutes and the P2
 * events written since the last one, none when nothing is new. It goes at the first round after
 * 07:00, so a worker that was down sends it when it is back.
 */
async function morningMail(
  problems: Problem[],
  kept: Map<string, StateRow>,
  config: AlertConfig,
): Promise<void> {
  const { rows } = await db().query<{ last: Date | null; due: Date; until: Date }>(
    `select (select since from alert_state where name = $1) as last,
       (((now() at time zone 'Europe/Stockholm') - interval '7 hours')::date + time '07:00')
         at time zone 'Europe/Stockholm' as due,
       now() - $2::interval as until`,
    [MORNING_MAIL, SETTLE],
  );
  const clock = rows[0];
  if (!clock) return;
  if (!clock.last) return keepPlace(MORNING_MAIL, clock.until);
  // Once a day, and only once the events read reach 07:00, so the next mail starts after it.
  if (clock.last >= clock.due || clock.until < clock.due) return;
  const told = [
    ...startedBetween(problems, kept, clock.last, clock.until),
    ...eventsTold(await attentionBetween(clock.last, clock.until), 'P2'),
  ];
  if (told.length > 0) {
    await send(
      `Core ${config.environment}: ${counted(told.length, 'thing', 'things')} to look at`,
      told.map((item) => paragraph(item.heading, item.words, config)),
      config,
      { changes: told.map((item) => item.change) },
    );
  }
  await keepPlace(MORNING_MAIL, clock.until);
}

/** The open P2 problems whose 15 minutes ran out after `after` and up to `until`, for the 07:00 mail. */
function startedBetween(
  problems: Problem[],
  kept: Map<string, StateRow>,
  after: Date,
  until: Date,
): Told[] {
  const told: Told[] = [];
  for (const problem of problems) {
    const row = kept.get(problem.key);
    if (problem.level !== 'P2' || !row || row.notified_at) continue;
    const counts = row.since.getTime() + WAIT_MS.P2;
    if (counts <= after.getTime() || counts > until.getTime()) continue;
    told.push(problemTold(problem));
  }
  return told;
}

/** The message, then where it goes; every send is one `alert.sent` event, delivered or not. */
async function send(
  subject: string,
  paragraphs: string[],
  config: AlertConfig,
  fields: EventFields,
): Promise<void> {
  const text = paragraphs.join('\n\n');
  const outcomes: Record<string, string> = {};
  if (config.email && mailConfigured()) {
    outcomes['email'] = await attempt(() => sendMail({ to: config.email ?? '', subject, text }));
  }
  if (config.slackWebhookUrl) {
    outcomes['slack'] = await attempt(async () => {
      const response = await fetch(config.slackWebhookUrl ?? '', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: `*${subject}*\n${text}` }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`slack answered ${response.status}`);
    });
  }
  await logEvent({
    type: 'alert.sent',
    fields: { subject, ...fields, outcomes, channels: Object.keys(outcomes).length },
  });
}

async function attempt(send: () => Promise<void>): Promise<string> {
  try {
    await send();
    return 'sent';
  } catch (error) {
    report(error, { where: 'alert' });
    return `failed: ${String(error)}`;
  }
}
