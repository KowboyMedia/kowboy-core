// What needs the super admin's attention (docs/next-steps.md item 26, questions 159, 163 and 164):
// a few kinds of event, listed on the Overview for seven days and told by their level (alerts.ts):
// P1 by mail and Slack within a minute, P2 in the mail at 07:00. The event log is the one source:
// nothing here is kept twice.
import { db } from './storage/db.js';
import { SITES_CHECK, type SiteBehind } from './health.js';
import { form, summarise } from './admin/summary.js';
import { counted, crmName, listed, sentence } from './admin/words.js';
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
};

/**
 * The kinds the super admin is told about. An adapter logs the first three through the adapter
 * API with the connection in the context: `office.taken_off` (`office_id`, `office_name` when the
 * adapter knows it, `reason` in plain words; the offices one cause takes off share a correlation
 * id), `connection.paused` (`failures`, `detail`) and `login.refused` (`detail`). The engine logs a
 * form the CRM did not take or refused (rows 22 and 23; the form's id is the correlation id), and
 * the start of each site the sites check finds behind (alerts.ts), which is told as a problem.
 */
export const KINDS: readonly Kind[] = [
  {
    type: 'office.taken_off',
    title: 'an office was taken off the sites',
    level: 'P2',
    todo: 'If that was meant, nothing needs doing. If not, undo the change the reason names; the sites then get the homes and agents back.',
    refused:
      'Each office comes back on the sites, with its homes and agents, once the CRM lets this connection read it again, which Core checks once a day. Ask the brokerage to check the login’s access to it in the CRM.',
  },
  {
    type: 'connection.paused',
    title: 'Core paused a connection because the CRM kept failing',
    level: 'P2',
    todo: 'Its sites get no new changes from it meanwhile. Core tries the CRM again by itself, so this needs nothing unless it keeps happening.',
  },
  {
    type: 'login.refused',
    title: 'the CRM refuses a connection’s login',
    level: 'P1',
    todo: 'Its sites get no new changes from it until the CRM accepts the login again. Check the login saved on the tenant’s page, and ask the brokerage whether the CRM still allows it.',
  },
  {
    type: 'submission.failed',
    title: 'a visitor’s form did not reach the CRM',
    level: 'P1',
    todo: 'The brokerage does not have it yet. Failed forms keeps it for 30 days with what the visitor wrote; send it again there once the CRM answers.',
  },
  {
    type: 'submission.refused',
    title: 'the CRM refused a visitor’s form',
    level: 'P1',
    todo: 'The brokerage does not have it. Failed forms keeps it for 30 days with what the visitor wrote and the CRM’s reason; send it again there once the cause is put right.',
  },
  {
    type: 'check.failed',
    name: SITES_CHECK,
    title: 'a site is not fetching its changes',
    level: 'P1',
    // The check's own sentence says what to do.
    todo: '',
  },
];

/** How long an event stays on the Overview. */
export const ATTENTION_DAYS = 7;

/** How long before an office is taken off a refusal of it still counts (row 20). */
const REFUSED_DAYS = 7;

/** The kind an event is, or null when it needs no attention. */
function kindOf(type: string, fields: EventFields): Kind | null {
  // A form Core held back, because only production sends forms to a CRM, is no problem.
  if (type === 'submission.refused' && fields['reason'] === NOT_LIVE) return null;
  // A sites check that could not run names no site; its problem is the check's, not a site's.
  if (type === 'check.failed' && !named(fields, 'sites') && !named(fields, 'names')) return null;
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
 * M30011)", "Acme's Somecrm connection, short name acme-crm", "site acme.se"), its place in the
 * admin area (a path under /admin), where it is in words when the thing does not say it, and its
 * tenant.
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
};

const COLUMNS = 'id, at, type, fields, correlation_id, tenant_id, connection_id';

/** Leaves out a form Core held back outside production: its reason is Core's own sentence, the parameter. */
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
  const known = await knownNow();
  const refused = await stillRefused(rows.filter((row) => row.type === 'office.taken_off'));
  const found: AttentionRow[] = [];
  for (const group of byCause(rows)) {
    const [first] = group;
    const kind = first ? kindOf(first.type, first.fields) : null;
    if (!first || !kind) continue;
    const refusedNow = group.some((row) => refused.has(row.id));
    const level = refusedNow ? 'P1' : kind.level;
    const places =
      first.type === 'office.taken_off' ? [officesTogether(group, known)] : placesOf(first, known);
    const todo = refusedNow ? (kind.refused ?? kind.todo) : kind.todo;
    const said = [sentence(happened(group, first)), todo].filter((part) => part).join(' ');
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
function happened(group: EventRow[], first: EventRow): string {
  if (group.length > 1) {
    return `${counted(group.length, 'office was', 'offices were')} taken off the sites, with their homes and agents: ${text(first.fields, 'reason') || 'no reason given'}`;
  }
  // A site's own sentence says what it means and what to do.
  if (first.type === 'check.failed' && text(first.fields, 'detail'))
    return text(first.fields, 'detail');
  return summarise(first.type, first.fields);
}

/**
 * The offices taken off while the CRM still refused them (row 20): within a week after an
 * `office.blocked` for the same office and connection, with no `office.unblocked` after it. The CRM's
 * code logs both once per connection that syncs the office, and settles them before it takes an
 * office off, so the last one before the take-off is the office's state then.
 */
async function stillRefused(takenOff: EventRow[]): Promise<Set<string>> {
  if (takenOff.length === 0) return new Set();
  const times = takenOff.map((row) => row.at.getTime());
  const { rows } = await db().query<{
    id: string;
    at: Date;
    type: string;
    connection_id: string;
    office_id: string;
  }>(
    `select id, at, type, connection_id, fields->>'office_id' as office_id from events
     where type in ('office.blocked', 'office.unblocked')
       and at > $1::timestamptz - ($3 || ' days')::interval and at <= $2
       and connection_id = any($4::text[])
     order by id`,
    [
      new Date(Math.min(...times)),
      new Date(Math.max(...times)),
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

/** The tenants' names and the connections' tenants and CRMs, read once per list or round. */
type Known = {
  tenants: Map<number, string>;
  connections: Map<string, { tenantId: number; provider: string }>;
};

async function knownNow(): Promise<Known> {
  const [tenants, connections] = await Promise.all([
    db().query<{ id: number; display_name: string }>('select id, display_name from tenants'),
    db().query<{ id: string; tenant_id: number; provider: string }>(
      'select id, tenant_id, provider from connections',
    ),
  ]);
  return {
    tenants: new Map(tenants.rows.map((row) => [Number(row.id), row.display_name])),
    connections: new Map(
      connections.rows.map((row) => [
        row.id,
        { tenantId: Number(row.tenant_id), provider: row.provider },
      ]),
    ),
  };
}

const text = (fields: EventFields, key: string): string =>
  typeof fields[key] === 'string' ? (fields[key] as string) : '';

/** A connection as a person knows it: "Acme's Somecrm connection, short name acme-crm". */
function connectionWords(id: string, known: Known): string {
  const connection = known.connections.get(id);
  const tenant = connection ? known.tenants.get(connection.tenantId) : undefined;
  if (!connection || !tenant) return `the connection with the short name ${id}`;
  return `${tenant}’s ${crmName(connection.provider)} connection, short name ${id}`;
}

/** Connections by their short names, each as a person knows it and with its block on its tenant's page. */
export async function connectionsNamed(ids: string[]): Promise<{ label: string; to: string }[]> {
  if (ids.length === 0) return [];
  const known = await knownNow();
  return ids.map((id) => {
    const tenantId = known.connections.get(id)?.tenantId;
    return {
      label: connectionWords(id, known),
      to: tenantId === undefined ? '/tenants' : `/tenants/${String(tenantId)}#connection:${id}`,
    };
  });
}

/** An event's tenant: its own, or its connection's. */
function tenantOf(row: EventRow, known: Known): { tenantId: number | null; tenant: string | null } {
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
function officesTogether(rows: EventRow[], known: Known): Place {
  const [first] = rows;
  const { tenantId, tenant } = first ? tenantOf(first, known) : { tenantId: null, tenant: null };
  const ids = rows.map((row) => text(row.fields, 'office_id'));
  const named = rows.map((row) => {
    const name = text(row.fields, 'office_name');
    const id = text(row.fields, 'office_id');
    return name ? `${name} (the CRM’s office id ${id})` : `the CRM’s office id ${id}`;
  });
  // Records reads several offices as one list, `office=A,B`; the commas stay readable in a mail.
  const scope = [
    ...(tenantId === null ? [] : [`tenant=${String(tenantId)}`]),
    `office=${ids.map(encodeURIComponent).join(',')}`,
    'deleted=true',
  ];
  return {
    // Every office by name: the alert and the line say which, and the link opens them all.
    what: `${rows.length === 1 ? 'office' : 'offices'} ${listed(named, named.length)}`,
    // The offices' records, the removed ones: what left the sites with them.
    link: `/records?${scope.join('&')}`,
    where: first?.connection_id ? connectionWords(first.connection_id, known) : null,
    tenantId,
    tenant,
  };
}

/** Which things one event is about, where each is, and its place: one, or one per site. */
function placesOf(row: EventRow, known: Known): Place[] {
  const { tenantId, tenant } = tenantOf(row, known);
  const connection = row.connection_id ?? '';
  if (row.type === 'check.failed') return sitesOf(row.fields, known);
  if (row.type.startsWith('submission.')) {
    return [
      {
        what: `${form(row.fields)} a visitor sent`,
        link: '/forms',
        where: connection ? connectionWords(connection, known) : tenant,
        tenantId,
        tenant,
      },
    ];
  }
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
function sitesOf(fields: EventFields, known: Known): Place[] {
  const sites = Array.isArray(fields['sites']) ? (fields['sites'] as SiteBehind[]) : [];
  if (sites.length === 0) {
    const names = Array.isArray(fields['names']) ? (fields['names'] as string[]) : [];
    return [
      {
        what: names.length > 0 ? `site ${names.join(', ')}` : 'a site',
        link: '/tenants',
        where: null,
        tenantId: null,
        tenant: null,
      },
    ];
  }
  return sites.map((site) => {
    const tenant = known.tenants.get(site.tenantId) ?? null;
    return {
      what: `site ${site.label}`,
      link: `/tenants/${String(site.tenantId)}#site:${String(site.id)}`,
      where: tenant,
      tenantId: site.tenantId,
      tenant,
    };
  });
}
