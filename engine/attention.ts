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
 * API with the connection in the context: `office.taken_off` (`office_id`, `office_name` when the
 * adapter knows it, `reason` in plain words), `connection.paused` (`failures`, `detail`) and `login.refused` (`detail`). The last one
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
export type AttentionRow = Place & {
  /** The event and, when one event names several things, which of them. */
  key: string;
  id: number;
  at: Date;
  type: string;
  kind: Kind;
  fields: EventFields;
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
 * The things that need attention, newest first, from the last seven days, one row per thing, each
 * named and placed as the alert names and places it (Patric, question 163: "state specifically
 * which entity where, and link to it").
 */
export async function attention(): Promise<AttentionRow[]> {
  const { rows } = await db().query<EventRow>(
    `select e.id, e.at, e.type, e.fields, e.connection_id, e.tenant_id
     from events e
     where e.at >= now() - ($1 || ' days')::interval and e.type = any($2::text[])
     order by e.id desc
     limit 500`,
    [ATTENTION_DAYS, [...new Set(KINDS.map((kind) => kind.type))]],
  );
  const known = await knownNow();
  const listed: AttentionRow[] = [];
  for (const row of rows) {
    const kind = kindOf(row.type, row.fields);
    if (!kind) continue;
    for (const [index, place] of (await placesOf(row, known)).entries()) {
      listed.push({
        id: Number(row.id),
        at: row.at,
        type: row.type,
        kind,
        fields: row.fields,
        ...place,
        key: `${row.id}-${String(index)}`,
      });
    }
  }
  return listed;
}

/**
 * One thing that needs attention: the thing in words ("office Lidingö (M30011)", "connection
 * acme-crm", "site acme.se"), its place in the admin area (a path under /admin), its tenant, and
 * the connection it belongs to, which is null when the thing is the connection itself or a site.
 */
export type Place = {
  what: string;
  link: string;
  tenantId: number | null;
  tenant: string | null;
  connectionId: string | null;
};

/** The tenants' names and the connections' tenants, read once per list or alert. */
type Known = {
  names: Map<number, string>;
  tenantOf: (connectionId: string) => Promise<number | null>;
};

async function knownNow(): Promise<Known> {
  const { rows } = await db().query<{ id: number; display_name: string }>(
    'select id, display_name from tenants',
  );
  const tenants = new Map<string, number | null>();
  return {
    names: new Map(rows.map((row) => [Number(row.id), row.display_name])),
    tenantOf: async (connectionId) => {
      if (!tenants.has(connectionId))
        tenants.set(connectionId, (await connectionById(connectionId))?.tenantId ?? null);
      return tenants.get(connectionId) ?? null;
    },
  };
}

/**
 * Which things an event that needs attention is about, where each is, and its place: one, or one
 * per site. An event of no kind (a check turning green) names nothing.
 */
export async function placesOf(
  row: Pick<EventRow, 'type' | 'fields' | 'tenant_id' | 'connection_id'>,
  known?: Known,
): Promise<Place[]> {
  if (!kindOf(row.type, row.fields)) return [];
  const { names, tenantOf } = known ?? (await knownNow());
  // An adapter's event carries its connection and not its tenant: the tenant is the connection's.
  const tenantId = row.tenant_id ?? (row.connection_id ? await tenantOf(row.connection_id) : null);
  return places({ ...row, tenant_id: tenantId }).map((place) => ({
    ...place,
    tenant: place.tenantId === null ? null : (names.get(place.tenantId) ?? null),
  }));
}

function places(
  row: Pick<EventRow, 'type' | 'fields' | 'tenant_id' | 'connection_id'>,
): Omit<Place, 'tenant'>[] {
  const tenantId = row.tenant_id;
  const connection = row.connection_id ?? '';
  const text = (key: string): string =>
    typeof row.fields[key] === 'string' ? (row.fields[key] as string) : '';
  if (row.type === 'office.taken_off') {
    // The office's name comes with the event: its record in Core is already removed by then.
    const office = text('office_id');
    const scope = new URLSearchParams({
      ...(tenantId === null ? {} : { tenant: String(tenantId) }),
      office,
      deleted: 'true',
    });
    return [
      {
        what: text('office_name')
          ? `office ${text('office_name')} (${office})`
          : `office ${office}`,
        // The office's records, the removed ones: what left the sites with it.
        link: `/records?${scope.toString()}`,
        tenantId,
        connectionId: row.connection_id,
      },
    ];
  }
  if (row.type === 'check.failed') return sitesOf(row.fields);
  return [
    {
      what: `connection ${connection}`,
      link:
        tenantId === null ? '/tenants' : `/tenants/${String(tenantId)}#connection:${connection}`,
      tenantId,
      connectionId: null,
    },
  ];
}

/**
 * The sites a red sites check names, each on its tenant's page. A check written without them (one
 * from before they were kept, or a site that pulled again between the check and this list) is one
 * line with the names the check gave, on the Tenants page.
 */
function sitesOf(fields: EventFields): Omit<Place, 'tenant'>[] {
  const sites = Array.isArray(fields['sites']) ? (fields['sites'] as StaleSite[]) : [];
  if (sites.length === 0) {
    const names = Array.isArray(fields['names']) ? (fields['names'] as string[]) : [];
    return [
      {
        what: names.length > 0 ? `site ${names.join(', ')}` : 'a site',
        link: '/tenants',
        tenantId: null,
        connectionId: null,
      },
    ];
  }
  return sites.map((site) => ({
    what: `site ${site.label}`,
    link: `/tenants/${String(site.tenantId)}#site:${String(site.id)}`,
    tenantId: site.tenantId,
    connectionId: null,
  }));
}
