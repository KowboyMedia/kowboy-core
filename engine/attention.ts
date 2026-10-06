// What needs the super admin's attention (docs/next-steps.md item 26, question 159 a): a few kinds
// of event, listed on the Overview for seven days and each told once by mail and Slack the moment
// it is written (alerts.ts). The event log is the one source: nothing here is kept twice.
import { db } from './storage/db.js';
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
    name: 'subscribers',
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

export type AttentionRow = {
  id: number;
  at: Date;
  type: string;
  kind: Kind;
  fields: EventFields;
  tenantId: number | null;
  tenant: string | null;
  connectionId: string | null;
};

/**
 * The events that need attention, newest first, from the last seven days; or the one event named,
 * as the alert reads it, so the list and the alert say the same thing about the same event. An
 * adapter's event carries its connection and not its tenant, so the tenant is looked up here, and
 * its name with it.
 */
export async function attention(only: { id: number } | null = null): Promise<AttentionRow[]> {
  const { rows } = await db().query<{
    id: string;
    at: Date;
    type: string;
    fields: EventFields;
    tenant_id: number | null;
    tenant: string | null;
    connection_id: string | null;
  }>(
    `select e.id, e.at, e.type, e.fields, e.connection_id,
            coalesce(e.tenant_id, c.tenant_id) as tenant_id, t.display_name as tenant
     from events e
     left join connections c on c.id = e.connection_id
     left join tenants t on t.id = coalesce(e.tenant_id, c.tenant_id)
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
    listed.push({
      id: Number(row.id),
      at: row.at,
      type: row.type,
      kind,
      fields: row.fields,
      tenantId: row.tenant_id,
      tenant: row.tenant,
      connectionId: row.connection_id,
    });
  }
  return listed;
}
