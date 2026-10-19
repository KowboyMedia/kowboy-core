// What needs the super admin's attention (docs/next-steps.md item 26, questions 159, 163 and 164):
// a few kinds of event, listed on the Overview for seven days and told by their level (alerts.ts):
// P1 by mail and Slack within a minute, P2 in the mail at 07:00. The event log is the one source:
// nothing here is kept twice.
import { db } from './storage/db.js';
import { aboutCheck, SITES_CHECK, type SiteBehind } from './health.js';
import { form, namedFor, namesNow, summarise, type Names } from './admin/summary.js';
import {
  capital,
  connectionNamed,
  lasting,
  listed,
  number,
  officeNamed,
  sentence,
  siteNamed,
} from './admin/words.js';
import { NOT_LIVE } from './registry.js';
import type { EventFields } from './events.js';
import type { Level } from './adapter-api/types.js';

/** One kind of event that needs attention: its type, its level, and the words of its line. */
export type Kind = {
  type: string;
  /** Only an event of this type whose `fields.name` is this one; for the sites check. */
  name?: string;
  /** A short line in plain words, the alert's subject and the list's label. */
  title: string;
  /**
   * Its level (question 164). An office taken off the sites is P1 while the CRM still refused it
   * (row 20), and this level, P2, when it was taken off by choice (row 21).
   */
  level: Level;
  /** What it means for the sites and what to do, after the sentence of what happened. */
  todo: string;
  /** What to do instead for an office the CRM still refused, which makes the line P1 (row 20). */
  refused?: string;
  /** What to do instead when the line opens the website's own page of its forms, "Formulär". */
  onSite?: string;
};

/**
 * What a form that did not reach the brokerage means: Core never sends a form again; the visitor
 * was told so on the website, and to contact the brokerage directly.
 */
const NOT_SENT =
  'The brokerage does not have it, and Core does not send it again: the visitor was told it was not sent and to contact the brokerage directly.';

/** Where a WordPress website keeps a form that was not sent. */
const KEPT = 'The website keeps what the visitor wrote for 30 days, on its page “Formulär”.';

/**
 * The kinds the super admin is told about. An adapter logs the first three through the adapter
 * API with the connection in the context: `office.taken_off` (`office_id`, `office_name` when the
 * adapter knows it, `reason` in plain words; the offices one cause takes off share a correlation
 * id), `connection.paused` (`failures`, `detail`) and `login.refused` (`detail`, and when the
 * adapter knows them `offices` and `leaves_at`, how many offices leave the sites and when). The
 * engine logs a form the CRM did not take or refused (rows 22 and 23; the form's id is the
 * correlation id), and the start of each site the sites check finds behind (alerts.ts), which is
 * told as a problem.
 */
export const KINDS: readonly Kind[] = [
  {
    type: 'office.taken_off',
    title: 'Office taken off the sites',
    level: 'P2',
    todo: 'If that was meant, nothing needs doing. If not, undo the change the reason names; each office then comes back on the sites with its homes and new-build projects.',
    refused:
      'Each office comes back on the sites, with its homes and new-build projects, once the CRM lets the login read it again, which Core checks once a day. Ask the brokerage to check the login’s access to it in the CRM.',
  },
  {
    type: 'connection.paused',
    title: 'Core stopped asking a CRM after failures',
    level: 'P2',
    todo: 'Nothing needs doing unless it keeps happening: Core asks the CRM again by itself.',
  },
  {
    type: 'login.refused',
    title: 'Login refused by the CRM',
    level: 'P1',
    todo: 'Until the CRM accepts the login again, the sites get no changes through this connection. Press “Check login” under the connection on the tenant’s page, and ask the brokerage whether the CRM still allows the login.',
  },
  {
    type: 'submission.failed',
    title: 'A visitor’s form did not reach the CRM',
    level: 'P1',
    todo: NOT_SENT,
    onSite: `${NOT_SENT} ${KEPT}`,
  },
  {
    type: 'submission.refused',
    title: 'The CRM refused a visitor’s form',
    level: 'P1',
    todo: `${NOT_SENT} Put right the reason the CRM gave, so the next form gets through.`,
    onSite: `${NOT_SENT} Put right the reason the CRM gave, so the next form gets through. The website keeps what the visitor wrote and the CRM’s reason for 30 days, on its page “Formulär”.`,
  },
  {
    type: 'check.failed',
    name: SITES_CHECK,
    title: aboutCheck(SITES_CHECK).title,
    level: 'P1',
    // The check's own sentences say what it means and what to do.
    todo: '',
  },
];

/** What to do when the bot check could not run, whatever the website's forms page. */
const BOT_CHECK_TODO =
  'While the bot check cannot run, the site’s forms stop there: the brokerage gets none of them, and each visitor reads that the form was not sent and to contact the brokerage directly. When Core has no keys for the bot check, or Cloudflare does not know or refuses them, give Core the bot check’s two keys from Cloudflare, the settings TURNSTILE_SITE_KEY and TURNSTILE_SECRET where Core is hosted. When the website’s address is not on the bot check’s list at Cloudflare, save the website in the admin area, which puts it there. When Cloudflare did not answer or had an error, wait: the forms work again once it answers.';

/**
 * A form the bot check could not run for (`fields.bot_check`, the cause): not the CRM's doing, so
 * its own words. The site's forms stop until the check runs, so it is P1 like any form that did
 * not reach the brokerage.
 */
const BOT_CHECK: Kind = {
  type: 'submission.failed',
  title: 'The bot check stopped a site’s forms',
  level: 'P1',
  todo: BOT_CHECK_TODO,
  onSite: `${BOT_CHECK_TODO} The website keeps what each visitor wrote for 30 days, on its page “Formulär”.`,
};

/**
 * A form Core stopped before asking any CRM (`fields.stopped`, why, from engine/http/submissions.ts).
 * No CRM failed, so each why has its own words of what to do. The brokerage does not get the form,
 * so each is P1 like any form that did not reach it.
 */
const STOPPED: Record<string, Kind> = Object.fromEntries(
  (
    [
      [
        'unreadable',
        'Core could not read a visitor’s form',
        'The website’s form window and Core disagree on what the form holds: update the website’s plugin, and if it already runs the newest one, the fault is for a developer to fix.',
        '',
      ],
      [
        'foreign',
        'A visitor’s form was about another tenant’s home',
        'The website showed a home its tenant does not have, as a website does after it moved to another tenant or the connection the home came through was deleted: check on the tenant’s page that the website is under the right tenant.',
        '',
      ],
      [
        'gone',
        'A visitor’s form was about a home that is gone',
        'Core sends no form about a home that is not on the CRM’s list. If the home left the list a while ago, the website is not fetching its changes: see the website on its tenant’s page.',
        '',
      ],
      [
        'office',
        'A visitor’s form named an office the tenant does not have',
        'If that office left the sites a while ago, the website is not fetching its changes: see the website on its tenant’s page.',
        '',
      ],
      [
        'which-office',
        'A visitor’s form named no office',
        'Give the website’s button that opened the form its office, in the website’s theme.',
        '',
      ],
      [
        'no-office',
        'A visitor’s form found no office to go to',
        'Every form of the tenant that names no home stops the same way until the tenant has an office in Core, which comes with a CRM connection that syncs one: see the connections on the tenant’s page.',
        '',
      ],
      [
        'kind',
        'A visitor sent a form the CRM does not take',
        'Every visitor who sends this form is answered the same way: remove its button from the website.',
        ' Turning the website’s forms off on that page makes every form button lead to the brokerage’s contact details instead.',
      ],
    ] as const
  ).map(([why, title, what, onPage]) => [
    why,
    {
      type: 'submission.failed',
      title,
      level: 'P1',
      todo: `${NOT_SENT} ${what}`,
      onSite: `${NOT_SENT} ${what} ${KEPT}${onPage}`,
    },
  ]),
);

/** A form Core stopped for a why these words do not know yet: the sentence says why. */
const STOPPED_OTHERWISE: Kind = {
  type: 'submission.failed',
  title: 'Core stopped a visitor’s form',
  level: 'P1',
  todo: NOT_SENT,
  onSite: `${NOT_SENT} ${KEPT}`,
};

/** How long an event stays on the Overview. */
export const ATTENTION_DAYS = 7;

/** How long before an office is taken off a refusal of it still counts (row 20). */
const REFUSED_DAYS = 7;

/** The kind an event is, or null when it needs no attention. */
function kindOf(type: string, fields: EventFields): Kind | null {
  // A form Core held back as a dry run (outside production, or through a connection ticked to
  // dry-run its forms) is no problem.
  if (type === 'submission.refused' && fields['reason'] === NOT_LIVE) return null;
  // A sites check that could not run names no site; its problem is the check's, not a site's.
  if (type === 'check.failed' && !named(fields, 'sites') && !named(fields, 'names')) return null;
  if (type === BOT_CHECK.type && fields['bot_check']) return BOT_CHECK;
  if (type === 'submission.failed' && typeof fields['stopped'] === 'string') {
    return STOPPED[fields['stopped']] ?? STOPPED_OTHERWISE;
  }
  return (
    KINDS.find(
      (kind) => kind.type === type && (kind.name === undefined || fields['name'] === kind.name),
    ) ?? null
  );
}

const named = (fields: EventFields, key: string): boolean =>
  Array.isArray(fields[key]) && (fields[key] as unknown[]).length > 0;

/**
 * One thing that needs attention: the thing in words ("office Lidingö (the CRM's office id
 * M30011)", "Acme's Somecrm connection “Main”", "site acme.se"), its place in the
 * admin area (a path under /admin), where it is in words when the thing does not say it, and its
 * tenant. A form's place is the website's own page of its forms when Core knows it, a whole
 * address (decision of 2026-10-07: the website keeps its forms).
 */
type Place = {
  what: string;
  link: string;
  where: string | null;
  tenantId: number | null;
  tenant: string | null;
};

/** One line: what happened, to which thing, how much it matters, and the events it stands for. */
export type AttentionRow = Place & {
  key: string;
  /** The newest of its events. */
  id: number;
  at: Date;
  type: string;
  kind: Kind;
  level: Level;
  /** What happened, in a sentence, then what it means for the sites and what to do. */
  said: string;
  /** Every event the line stands for: several offices one cause took off are one line. */
  ids: number[];
};

type EventRow = {
  id: string;
  at: Date;
  type: string;
  fields: EventFields;
  correlation_id: string | null;
  tenant_id: number | null;
  connection_id: string | null;
  subscriber_id: string | null;
};

const COLUMNS = 'id, at, type, fields, correlation_id, tenant_id, connection_id, subscriber_id';

/** Leaves out a form Core held back as a dry run: its reason is Core's own sentence, the parameter. */
const notHeldBack = (reason: string): string =>
  `not (type = 'submission.refused' and fields->>'reason' is not distinct from ${reason})`;

/**
 * The things that need attention, newest first, from the last seven days, one line per thing, each
 * named and placed as the alert names and places it (Patric, question 163: "state specifically
 * which entity where, and link to it").
 */
export async function attention(): Promise<AttentionRow[]> {
  const { rows } = await db().query<EventRow>(
    `select ${COLUMNS} from events
     where at >= now() - ($1 || ' days')::interval and type = any($2::text[]) and ${notHeldBack('$3')}
     order by id desc
     limit 500`,
    [ATTENTION_DAYS, [...new Set(KINDS.map((kind) => kind.type))], NOT_LIVE],
  );
  return lines(rows);
}

/**
 * The events that need attention written after `after` and up to `until`, oldest first: what the
 * alerts' round tells. A site behind is told as a problem of the checks, not here.
 */
export async function attentionBetween(after: Date, until: Date): Promise<AttentionRow[]> {
  const { rows } = await db().query<EventRow>(
    `select ${COLUMNS} from events
     where at > $1 and at <= $2 and type = any($3::text[]) and ${notHeldBack('$4')}
     order by id`,
    [
      after,
      until,
      KINDS.filter((kind) => kind.name === undefined).map((kind) => kind.type),
      NOT_LIVE,
    ],
  );
  return lines(rows);
}

/** The events as lines: grouped by cause, named, placed, and each with its level. */
async function lines(rows: EventRow[]): Promise<AttentionRow[]> {
  const known = await namesNow();
  const formsPages = await formsPagesOf(rows);
  const refused = await stillRefused(rows.filter((row) => row.type === 'office.taken_off'));
  const ends = await endings(rows.filter((row) => row.type === 'check.failed'));
  const found: AttentionRow[] = [];
  for (const group of byCause(rows)) {
    const [first] = group;
    const kind = first ? kindOf(first.type, first.fields) : null;
    if (!first || !kind) continue;
    const refusedNow = group.some((row) => refused.has(row.id));
    const level = refusedNow ? 'P1' : kind.level;
    const places =
      first.type === 'office.taken_off'
        ? [officesTogether(group, known)]
        : placesOf(first, known, formsPages);
    const onSite = places.some((place) => /^https?:/.test(place.link));
    const todo = refusedNow
      ? (kind.refused ?? kind.todo)
      : onSite
        ? (kind.onSite ?? kind.todo)
        : kind.todo;
    const said = [sentence(happened(group, first, known)), todo, ends.get(first.id)]
      .filter((part) => part)
      .join(' ');
    const newest = group.reduce((a, b) => (Number(b.id) > Number(a.id) ? b : a));
    for (const [index, place] of places.entries()) {
      found.push({
        ...place,
        key: `${newest.id}-${String(index)}`,
        id: Number(newest.id),
        at: newest.at,
        type: first.type,
        kind,
        level,
        said,
        ids: group.map((row) => Number(row.id)),
      });
    }
  }
  return found;
}

/** The events that need attention, one group per thing: the offices one cause took off share its correlation id (rule B). */
function byCause(rows: EventRow[]): EventRow[][] {
  const groups = new Map<string, EventRow[]>();
  for (const row of rows) {
    if (!kindOf(row.type, row.fields)) continue;
    const key =
      row.type === 'office.taken_off' && row.correlation_id
        ? `cause:${row.correlation_id}`
        : `event:${row.id}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()];
}

/** What happened, in the event log's sentence; several offices one cause took off in one. */
function happened(group: EventRow[], first: EventRow, known: Names): string {
  const named = namedFor({ ...first, datatype: null }, known);
  if (group.length > 1) {
    const reason = text(first.fields, 'reason');
    return `${number(group.length)} of ${named.tenant ?? 'the tenant'}’s offices were taken off the sites, with their homes and new-build projects. ${reason ? sentence(reason) : 'No reason was recorded.'}`;
  }
  if (first.type === 'check.failed') return siteBehind(first.fields, known);
  return summarise(first.type, first.fields, named);
}

/**
 * A site behind, in its own sentences, which say what it means and what to do. A line written
 * before Core kept how such a problem ends kept other words: it says what it was, and where to see
 * whether it lasts.
 */
function siteBehind(fields: EventFields, known: Names): string {
  if (text(fields, 'problem')) return text(fields, 'detail');
  const sites = Array.isArray(fields['sites']) ? (fields['sites'] as SiteBehind[]) : [];
  const names =
    sites.length > 0
      ? sites.map((site) => siteNamed(site.label, known.tenants.get(site.tenantId)))
      : (Array.isArray(fields['names']) ? (fields['names'] as string[]) : []).map(
          (name) => `the site ${name}`,
        );
  const many = names.length > 1;
  return `${capital(listed(names, names.length) || 'a site')} had not fetched the changes Core told ${many ? 'them' : 'it'} about more than an hour before. When that ended was not recorded; the check “${aboutCheck(SITES_CHECK).title}” on the Overview shows each site still behind.`;
}

/**
 * How each problem a check's line stands for ended: resolved, and after how long, or still open.
 * A problem is found by its key, the events' `problem` (`alerts.ts`), which a line kept before
 * the keys has not got.
 */
async function endings(failed: EventRow[]): Promise<Map<string, string>> {
  const ends = new Map<string, string>();
  const keyOf = (row: EventRow): string => text(row.fields, 'problem');
  const keys = [...new Set(failed.map(keyOf).filter((key) => key))];
  if (keys.length === 0) return ends;
  const [open, recovered] = await Promise.all([
    db().query<{ name: string }>(
      'select name from alert_state where name = any($1::text[]) and not ok',
      [keys],
    ),
    db().query<{ id: string; key: string; lasted_ms: number | null }>(
      `select id, fields->>'problem' as key, (fields->>'lasted_ms')::bigint as lasted_ms from events
       where type = 'check.recovered' and fields->>'problem' = any($1::text[]) and id > $2
       order by id`,
      [keys, Math.min(...failed.map((row) => Number(row.id)))],
    ),
  ]);
  const stillOpen = new Set(open.rows.map((row) => row.name));
  for (const row of failed) {
    const key = keyOf(row);
    if (!key) continue;
    const end = recovered.rows.find(
      (candidate) => candidate.key === key && Number(candidate.id) > Number(row.id),
    );
    if (end) {
      ends.set(
        row.id,
        end.lasted_ms === null ? 'Resolved.' : `Resolved after ${lasting(Number(end.lasted_ms))}.`,
      );
    } else if (stillOpen.has(key)) {
      ends.set(row.id, 'Still open.');
    }
  }
  return ends;
}

/**
 * The offices taken off while the CRM still refused them (row 20): within a week after an
 * `office.blocked` for the same office and connection, with no `office.unblocked` after it. The CRM's
 * code logs both once per connection that syncs the office, and settles them before it takes an
 * office off, so the last one before the take-off is the office's state then. "Before" is the
 * log's order, its ids: a date here holds whole milliseconds and the log microseconds, so a
 * refusal logged in the take-off's millisecond would fall after a bound by time.
 */
async function stillRefused(takenOff: EventRow[]): Promise<Set<string>> {
  if (takenOff.length === 0) return new Set();
  const { rows } = await db().query<{
    id: string;
    at: Date;
    type: string;
    connection_id: string;
    office_id: string;
  }>(
    `select id, at, type, connection_id, fields->>'office_id' as office_id from events
     where type in ('office.blocked', 'office.unblocked')
       and at > $1::timestamptz - ($3 || ' days')::interval and id < $2
       and connection_id = any($4::text[])
     order by id`,
    [
      new Date(Math.min(...takenOff.map((row) => row.at.getTime()))),
      Math.max(...takenOff.map((row) => Number(row.id))),
      REFUSED_DAYS,
      [...new Set(takenOff.map((row) => row.connection_id ?? ''))],
    ],
  );
  const refused = new Set<string>();
  for (const row of takenOff) {
    const since = row.at.getTime() - REFUSED_DAYS * 86_400_000;
    const last = rows
      .filter(
        (block) =>
          block.connection_id === row.connection_id &&
          block.office_id === text(row.fields, 'office_id') &&
          Number(block.id) < Number(row.id) &&
          block.at.getTime() > since,
      )
      .at(-1);
    if (last?.type === 'office.blocked') refused.add(row.id);
  }
  return refused;
}

const text = (fields: EventFields, key: string): string =>
  typeof fields[key] === 'string' ? (fields[key] as string) : '';

/** A connection as a person knows it: "Acme's Somecrm connection “Main”". */
function connectionWords(id: string, known: Names): string {
  const connection = known.connections.get(id);
  const tenant = connection ? known.tenants.get(connection.tenantId) : undefined;
  return connectionNamed(connection?.name ?? id, tenant, connection?.provider);
}

/** Connections by their ids, each as a person knows it and with its block on its tenant's page. */
export async function connectionsNamed(ids: string[]): Promise<{ label: string; to: string }[]> {
  if (ids.length === 0) return [];
  const known = await namesNow();
  return ids.map((id) => {
    const tenantId = known.connections.get(id)?.tenantId;
    return {
      label: connectionWords(id, known),
      to: tenantId === undefined ? '/tenants' : `/tenants/${String(tenantId)}#connection:${id}`,
    };
  });
}

/** An event's tenant: its own, or its connection's. */
function tenantOf(row: EventRow, known: Names): { tenantId: number | null; tenant: string | null } {
  const tenantId =
    row.tenant_id === null
      ? (known.connections.get(row.connection_id ?? '')?.tenantId ?? null)
      : Number(row.tenant_id);
  return { tenantId, tenant: tenantId === null ? null : (known.tenants.get(tenantId) ?? null) };
}

/**
 * The offices one cause took off, as one thing: named by their names and the CRM's office ids,
 * their removed records on Records, on their connection.
 */
function officesTogether(rows: EventRow[], known: Names): Place {
  const [first] = rows;
  const { tenantId, tenant } = first ? tenantOf(first, known) : { tenantId: null, tenant: null };
  const ids = rows.map((row) => text(row.fields, 'office_id'));
  // One office as the admin area names it; several by their names, each with the CRM's id.
  const named = rows.map((row) => {
    const name = text(row.fields, 'office_name');
    const id = text(row.fields, 'office_id');
    return name ? `${name} (the CRM’s office id ${id})` : `the one with the CRM’s office id ${id}`;
  });
  // Records reads several offices as one list, `office=A,B`; the commas stay readable in a mail.
  const scope = [
    ...(tenantId === null ? [] : [`tenant=${String(tenantId)}`]),
    `office=${ids.map(encodeURIComponent).join(',')}`,
  ];
  return {
    // Every office by name: the alert and the line say which, and the link opens them all.
    what:
      rows.length === 1 && first
        ? officeNamed(text(first.fields, 'office_id'), text(first.fields, 'office_name'), tenant)
        : `${tenant ? `${tenant}’s` : 'the'} offices ${listed(named, named.length)}`,
    // The offices' records, where each one's state says whether it left the sites with them.
    link: `/records?${scope.join('&')}`,
    where: first?.connection_id ? `Through ${connectionWords(first.connection_id, known)}.` : null,
    tenantId,
    tenant,
  };
}

/**
 * The website's own page of its forms, "Formulär", from the address Core tells it about changes
 * at: the WordPress plugin's, whose address runs through `/wp-json/` or `?rest_route=`. None for a
 * website that is not WordPress, or an address that is not one.
 */
export function formsPage(bellUrl: string | null): string | null {
  if (!bellUrl) return null;
  try {
    const url = new URL(bellUrl);
    const at = url.pathname.indexOf('/wp-json/');
    const base =
      at >= 0
        ? url.pathname.slice(0, at)
        : url.searchParams.has('rest_route')
          ? url.pathname.replace(/\/(?:index\.php)?$/, '')
          : null;
    return base === null ? null : `${url.origin}${base}/wp-admin/admin.php?page=core-client-forms`;
  } catch {
    return null;
  }
}

/** The forms pages of the websites the form events came from, by the site's id. */
async function formsPagesOf(rows: EventRow[]): Promise<Map<number, string | null>> {
  const ids = [
    ...new Set(
      rows.flatMap((row) =>
        row.type.startsWith('submission.') && row.subscriber_id !== null
          ? [Number(row.subscriber_id)]
          : [],
      ),
    ),
  ];
  if (ids.length === 0) return new Map();
  const { rows: sites } = await db().query<{ id: number; bell_url: string | null }>(
    'select id, bell_url from subscribers where id = any($1::int[])',
    [ids],
  );
  return new Map(sites.map((site) => [Number(site.id), formsPage(site.bell_url)]));
}

/**
 * A form a visitor sent, from the website when Core knows it, opening that website's page of its
 * forms, which keeps what the visitor wrote; otherwise the website's place on its tenant's page,
 * since Core keeps no form that was not sent.
 */
function formPlace(row: EventRow, known: Names, formsPages: Map<number, string | null>): Place {
  const { tenantId, tenant } = tenantOf(row, known);
  const siteId = row.subscriber_id === null ? null : Number(row.subscriber_id);
  const site = siteId === null ? undefined : known.sites.get(siteId);
  const from = site ? ` from ${siteNamed(site.label, known.tenants.get(site.tenantId))}` : '';
  return {
    what: `${capital(form(row.fields))} a visitor sent${from}`,
    link: (siteId === null ? null : formsPages.get(siteId)) ?? sitePlace(siteId, tenantId),
    where: row.connection_id ? `Through ${connectionWords(row.connection_id, known)}.` : null,
    tenantId,
    tenant,
  };
}

/** A website's place on its tenant's page, or the tenant's page, or Tenants. */
function sitePlace(siteId: number | null, tenantId: number | null): string {
  if (tenantId === null) return '/tenants';
  return `/tenants/${String(tenantId)}${siteId === null ? '' : `#site:${String(siteId)}`}`;
}

/** Which things one event is about, where each is, and its place: one, or one per site. */
function placesOf(row: EventRow, known: Names, formsPages: Map<number, string | null>): Place[] {
  const { tenantId, tenant } = tenantOf(row, known);
  const connection = row.connection_id ?? '';
  if (row.type === 'check.failed') return sitesOf(row.fields, known);
  if (row.type.startsWith('submission.')) return [formPlace(row, known, formsPages)];
  return [
    {
      what: connectionWords(connection, known),
      link:
        tenantId === null ? '/tenants' : `/tenants/${String(tenantId)}#connection:${connection}`,
      where: null,
      tenantId,
      tenant,
    },
  ];
}

/**
 * The sites a sites check's event names, each on its tenant's page. One written without them (one
 * from before they were kept) is one line with the names it gave, on the Tenants page.
 */
function sitesOf(fields: EventFields, known: Names): Place[] {
  const sites = Array.isArray(fields['sites']) ? (fields['sites'] as SiteBehind[]) : [];
  if (sites.length === 0) {
    const names = Array.isArray(fields['names']) ? (fields['names'] as string[]) : [];
    return [
      {
        what:
          names.length > 0
            ? `The site ${listed(names, names.length)}, whose tenant this line does not say`
            : 'A site Core did not name',
        link: '/tenants',
        where: 'Tenants lists every tenant’s sites.',
        tenantId: null,
        tenant: null,
      },
    ];
  }
  return sites.map((site) => {
    const tenant = known.tenants.get(site.tenantId) ?? null;
    return {
      what: siteNamed(site.label, tenant),
      link: `/tenants/${String(site.tenantId)}#site:${String(site.id)}`,
      where: null,
      tenantId: site.tenantId,
      tenant,
    };
  });
}
