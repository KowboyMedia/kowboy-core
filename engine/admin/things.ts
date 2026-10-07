// The things a CRM's code names by their ids (question 184): a connection, an office it reads or
// one of its records, in the admin area's words and linked to their places. The CRM's code knows
// neither a tenant's name nor an address in the admin area, so Core writes both, the same on every
// page and current after a rename, as it does for the CRM's events (attention.ts).
import type {
  AdminDirections,
  AdminSection,
  AdminThing,
  AdminValue,
  Canonical,
} from '../adapter-api/types.js';
import { connectionsNamed } from '../attention.js';
import { db } from '../storage/db.js';
import { currentConfig } from './auth.js';
import { recordName } from './records.js';
import { namesNow, type Names } from './summary.js';
import { capital, entity, inSentence, officeNamed } from './words.js';

/** A name and its place in the admin area, a path under /admin; no place for a record Core does not hold. */
export type Linked = { label: string; to: string | null };

export const isThing = (value: unknown): value is AdminThing =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { connection?: unknown }).connection === 'string';

const keyOf = (connection: string, datatype: string, id: string): string =>
  JSON.stringify([connection, datatype, id]);

type Held = Map<string, Canonical | null>;

/** An office or a record to look up, on its connection. */
type Lookup = { connection: string; office?: string; record?: { datatype: string; id: string } };

/** The offices' and records' own names, as the records Core holds give them. */
async function heldNames(things: Lookup[], known: Names): Promise<Held> {
  const wanted = things.flatMap((thing) => {
    const tenantId = known.connections.get(thing.connection)?.tenantId;
    if (tenantId === undefined) return [];
    if (thing.record) return [[tenantId, thing.connection, thing.record.datatype, thing.record.id]];
    return thing.office ? [[tenantId, thing.connection, 'office', thing.office]] : [];
  });
  if (wanted.length === 0) return new Map();
  const { rows } = await db().query<{
    connection_id: string;
    datatype: string;
    remote_id: string;
    data: Canonical | null;
  }>(
    `select connection_id, datatype, remote_id, data from items
     where (tenant_id, connection_id, datatype, remote_id) in (
       select * from unnest($1::int[], $2::text[], $3::text[], $4::text[]))`,
    [0, 1, 2, 3].map((column) => wanted.map((row) => row[column])),
  );
  return new Map(
    rows.map((row) => [keyOf(row.connection_id, row.datatype, row.remote_id), row.data]),
  );
}

/** A record by its address or name, opening its page; by the CRM's id when Core does not hold it. */
function recordLinked(
  connection: string,
  record: { datatype: string; id: string },
  held: Held,
): Linked {
  const key = keyOf(connection, record.datatype, record.id);
  const byId = `the ${entity(record.datatype)} with the CRM’s id ${record.id}`;
  if (!held.has(key)) return { label: byId, to: null };
  return {
    label: recordName(held.get(key) ?? null) ?? byId,
    to: `/records/${encodeURIComponent(connection)}/${record.datatype}/${encodeURIComponent(record.id)}`,
  };
}

/** Records by their addresses or names, each opening its page, with the names already read. */
export async function recordsLinked(
  records: { connection: string; datatype: string; id: string }[],
  known: Names,
): Promise<Linked[]> {
  const held = await heldNames(
    records.map(({ connection, datatype, id }) => ({ connection, record: { datatype, id } })),
    known,
  );
  return records.map((record) => recordLinked(record.connection, record, held));
}

/** An office by its tenant and name, then the CRM's id for it, opening its records. */
function officeLinked(connection: string, office: string, held: Held, known: Names): Linked {
  const data = held.get(keyOf(connection, 'office', office));
  const name = typeof data?.['name'] === 'string' ? data['name'] : null;
  const tenantId = known.connections.get(connection)?.tenantId;
  const scope = [
    ...(tenantId === undefined ? [] : [`tenant=${String(tenantId)}`]),
    `office=${encodeURIComponent(office)}`,
  ];
  return {
    label: officeNamed(office, name, tenantId === undefined ? null : known.tenants.get(tenantId)),
    to: `/records?${scope.join('&')}`,
  };
}

/**
 * Each name as a sentence takes it, in order: a thing in Core's words with its place, then what
 * the CRM's code says about it; a text as the CRM's code wrote it.
 */
export async function namedThings(names: readonly (string | AdminThing)[]): Promise<Linked[]> {
  const things = names.filter(isThing);
  if (things.length === 0)
    return names.map((name) => ({ label: inSentence(String(name)), to: null }));
  const [known, connections] = await Promise.all([
    namesNow(),
    connectionsNamed(things.map((thing) => thing.connection)),
  ]);
  const held = await heldNames(things, known);
  let next = 0;
  return names.map((name) => {
    if (!isThing(name)) return { label: inSentence(name), to: null };
    const connection = connections[next++] ?? { label: name.connection, to: null };
    const linked = name.record
      ? recordLinked(name.connection, name.record, held)
      : name.office
        ? officeLinked(name.connection, name.office, held, known)
        : connection;
    return name.note ? { ...linked, label: `${linked.label}, ${name.note}` } : linked;
  });
}

/** A value as the browser draws it: a thing is its name with its place, an address the whole one. */
export type ShownValue =
  Exclude<AdminValue, AdminThing | { address: string }> | { text: string; to: string | null };

type Table = NonNullable<AdminSection['table']>;

/** A block of a CRM's page as the browser draws it. */
export type ShownSection = Omit<AdminSection, 'items' | 'table'> & {
  items?: { label: string; value: ShownValue }[];
  table?: Omit<Table, 'rows'> & {
    rows: { cells: ShownValue[]; actions?: Table['rows'][number]['actions'] }[];
  };
};

/** The directions as the browser draws them. */
export type ShownDirections = Omit<AdminDirections, 'settings'> & {
  settings: { key: string; value: ShownValue; help: string }[];
};

/**
 * Each value of a CRM's page as the browser draws it: a thing its code names becomes its name with
 * its place, and an address on Core the whole address others reach it at, when Core knows its own.
 */
async function shownValues(values: AdminValue[]): Promise<(value: AdminValue) => ShownValue> {
  const things = values.filter(isThing);
  const named = new Map(
    (await namedThings(things)).map((linked, index) => [things[index], linked] as const),
  );
  const publicUrl = currentConfig().publicUrl;
  return (value) => {
    if (isThing(value)) {
      const linked = named.get(value);
      return { text: capital(linked?.label ?? value.connection), to: linked?.to ?? null };
    }
    if (value !== null && typeof value === 'object' && 'address' in value) {
      return publicUrl
        ? `${publicUrl}${value.address}`
        : `Core’s own address, followed by ${value.address}`;
    }
    return value;
  };
}

/** A CRM's page, or its part on a tenant's page, as the browser draws it. */
export async function shownSections(sections: AdminSection[]): Promise<ShownSection[]> {
  const shown = await shownValues(
    sections.flatMap((section) => [
      ...(section.items ?? []).map((item) => item.value),
      ...(section.table?.rows ?? []).flatMap((row) => row.cells),
    ]),
  );
  return sections.map(({ items, table, ...section }) => ({
    ...section,
    ...(items && { items: items.map((item) => ({ ...item, value: shown(item.value) })) }),
    ...(table && {
      table: { ...table, rows: table.rows.map((row) => ({ ...row, cells: row.cells.map(shown) })) },
    }),
  }));
}

/** A CRM's directions as the browser draws them. */
export async function shownDirections(directions: AdminDirections): Promise<ShownDirections> {
  const shown = await shownValues(directions.settings.map((setting) => setting.value));
  return {
    ...directions,
    settings: directions.settings.map((setting) => ({ ...setting, value: shown(setting.value) })),
  };
}
