// What needs the super admin's attention (docs/next-steps.md item 26, question 159 a): a few kinds
// of event, listed on the Overview for seven days and each told once by mail and Slack the moment
// it is written (alerts.ts). The event log is the one source: nothing here is kept twice.
import { db } from './storage/db.js';
import { SITES_CHECK, type StaleSite } from './health.js';
import { connectionById } from './storage/connections.js';
import type { EventFields } from './events.js';

/** One kind of event that needs attention: its type, and the words the alert and the list use. */
export type Kind = {
  type: string;
  /** Only an event of this type whose `fields.name` is this one; for a check turning red. */
  name?: string;
  /** A short line in plain words, the alert's subject and the list's label. */
  title: string;
  /**
   * When the alert goes: the moment the event is written, or with the checks' own message, which
   * alerts.ts sends once per change of a health check and already carries this one.
   */
  told: 'on write' | 'with the checks';
};

/**
 * The kinds the super admin is told about. An adapter logs the first three through the adapter
 * API with the connection in the context: `office.taken_off` (`office_id`, `reason` in plain
 * words), `connection.paused` (`failures`, `detail`) and `login.refused` (`detail`). The last one
 * the engine logs itself when the check that watches the sites turns red (alerts.ts).
 */
export const KINDS: readonly Kind[] = [
  { type: 'office.taken_off', title: 'an office was taken off the sites', told: 'on write' },
  { type: 'connection.paused', title: 'a connection paused after failures', told: 'on write' },
  { type: 'login.refused', title: 'the CRM refuses a login', told: 'on write' },
  {
    type: 'check.failed',
    name: SITES_CHECK,
    title: 'a site stopped pulling',
    told: 'with the checks',
  },
];

/** How long an event stays on the Overview. */
export const ATTENTION_DAYS = 7;

/** The kind an event is, or null when it needs no attention. */
export function kindOf(type: string, fields: EventFields): Kind | null {
  return (
    KINDS.find(
      (kind) => kind.type === type && (kind.name === undefined || fields['name'] === kind.name),
    ) ?? null
  );
}

/** One thing that needs attention: which it is, where it is, and its place in the admin area. */
export type AttentionRow = {
  /** The event and, when one event names several things, which of them. */
  key: string;
  id: number;
  at: Date;
  type: string;
  kind: Kind;
  fields: EventFields;
  /** The thing itself, in words: "office Lidingö (M30011)", "connection acme-crm", "site acme.se". */
  what: string;
  /** Its place in the admin area, a path under /admin. */
  link: string;
  tenantId: number | null;
  tenant: string | null;
  connectionId: string | null;
};

type EventRow = {
  id: string;
  at: Date;
  type: string;
  fields: EventFields;
  tenant_id: number | null;
  connection_id: string | null;
};

/**
 * The things that need attention, newest first, from the last seven days, one row per thing; or
 * the one event named, as the alert reads it, so the list and the alert say the same thing about
 * the same event (Patric, question 163: "state specifically which entity where, and link to it").
 */
export async function attention(only: { id: number } | null = null): Promise<AttentionRow[]> {
  const { rows } = await db().query<EventRow>(
    `select e.id, e.at, e.type, e.fields, e.connection_id, e.tenant_id
     from events e
     where e.at >= now() - ($1 || ' days')::interval and e.type = any($2::text[])
       and ($3::bigint is null or e.id = $3)
     order by e.id desc
     limit 500`,
    [ATTENTION_DAYS, [...new Set(KINDS.map((kind) => kind.type))], only?.id ?? null],
  );
  const listed: AttentionRow[] = [];
  for (const row of rows) {
    const kind = kindOf(row.type, row.fields);
    if (!kind) continue;
    for (const [index, place] of (await placesOf(row)).entries()) {
      listed.push({
        id: Number(row.id),
        at: row.at,
        type: row.type,
        kind,
        fields: row.fields,
        connectionId: row.connection_id,
        ...place,
        key: `${row.id}-${String(index)}`,
      });
    }
  }
  return listed;
}

export type Place = { what: string; link: string; tenantId: number | null; tenant: string | null };

/** Which thing an event is about, where it is, and its place: one, or one per site. */
export async function placesOf(
  row: Pick<EventRow, 'type' | 'fields' | 'tenant_id' | 'connection_id'>,
): Promise<Place[]> {
  const names = await tenantNames();
  // An adapter's event carries its connection and not its tenant: the tenant is the connection's.
  const connection = row.connection_id ? await connectionById(row.connection_id) : null;
  const tenantId = row.tenant_id ?? connection?.tenantId ?? null;
  return (await places({ ...row, tenant_id: tenantId })).map((place) => ({
    ...place,
    tenant: place.tenantId === null ? null : (names.get(place.tenantId) ?? null),
  }));
}

async function places(
  row: Pick<EventRow, 'type' | 'fields' | 'tenant_id' | 'connection_id'>,
): Promise<Omit<Place, 'tenant'>[]> {
  const tenantId = row.tenant_id;
  const connection = row.connection_id ?? '';
  const office = typeof row.fields['office_id'] === 'string' ? row.fields['office_id'] : '';
  if (row.type === 'office.taken_off') {
    const name = await officeName(connection, office);
    // The office's records, the removed ones: what left the sites with it.
    const scope = new URLSearchParams({ connection, office, deleted: 'true' });
    if (tenantId !== null) scope.set('tenant', String(tenantId));
    return [
      {
        what: name ? `office ${name} (${office})` : `office ${office}`,
        link: `/records?${scope.toString()}`,
        tenantId,
      },
    ];
  }
  if (row.type === 'check.failed') {
    const sites = Array.isArray(row.fields['sites']) ? (row.fields['sites'] as StaleSite[]) : [];
    return sites.map((site) => ({
      what: `site ${site.label}`,
      link: `/tenants/${String(site.tenantId)}#site-${String(site.id)}`,
      tenantId: site.tenantId,
    }));
  }
  return [
    {
      what: `connection ${connection}`,
      link:
        tenantId === null ? '/tenants' : `/tenants/${String(tenantId)}#connection-${connection}`,
      tenantId,
    },
  ];
}

async function tenantNames(): Promise<Map<number, string>> {
  const { rows } = await db().query<{ id: number; display_name: string }>(
    'select id, display_name from tenants',
  );
  return new Map(rows.map((row) => [Number(row.id), row.display_name]));
}

/** The office's own name, from its record in Core, when Core holds one. */
async function officeName(connectionId: string, officeId: string): Promise<string | null> {
  const { rows } = await db().query<{ name: string | null }>(
    `select data->>'name' as name from items
     where connection_id = $1 and datatype = 'office' and office_id = $2
     order by deleted, seq desc limit 1`,
    [connectionId, officeId],
  );
  return rows[0]?.name ?? null;
}
