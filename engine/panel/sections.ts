// A CRM connection's own part of its card on the tenant's page (the tenant mockups, image 03): the
// sections the CRM's code declares for the connection through `connection()`, with their help
// sentences, values and the actions a person can press. Every word in them is the CRM's code's;
// the engine adds none and names no CRM. A thing the code names is put as Core names it, an address
// on Core is made whole, and an action that asks for typed fields is left out, since the panel
// offers none.
import { db } from '../storage/db.js';
import { report } from '../errors.js';
import { adminFor } from '../registry.js';
import type {
  AdminAction,
  AdminSection,
  AdminThing,
  AdminValue,
  Connection,
} from '../adapter-api/types.js';
import { failureWords } from './failure.js';
import { crmName, recordNames } from './inbox.js';

/** A value as the panel shows it: plain, a coloured state, or a moment the panel formats. */
export type ShownValue =
  | string
  | number
  | boolean
  | null
  | { text: string; state: 'ok' | 'bad' | 'warn' | 'muted' }
  | { moment: string | null };

/** A button the CRM's code offers, with the sentence it shows next to it. */
export type ShownAction = {
  id: string;
  label: string;
  help: string | null;
  /** Asked before it runs, in the code's words. */
  confirm: string | null;
  danger: boolean;
};

export type ShownSection = {
  title: string;
  help: string | null;
  items: { label: string; value: ShownValue }[];
  table: { columns: string[]; rows: ShownValue[][]; empty: string | null } | null;
  actions: ShownAction[];
};

/** A connection's sections, or the words of what failed when the CRM's code could not give them. */
export type Sections = { sections: ShownSection[]; failed: string | null };

const isThing = (value: AdminValue): value is AdminThing =>
  typeof value === 'object' && value !== null && 'connection' in value;

/** Every thing the sections name, so their names are read at once. */
function thingsIn(sections: AdminSection[]): AdminThing[] {
  const values = sections.flatMap((section) => [
    ...(section.items ?? []).map((item) => item.value),
    ...(section.table?.rows ?? []).flatMap((row) => row.cells),
  ]);
  return values.filter(isThing);
}

async function connectionNames(things: AdminThing[]): Promise<Map<string, string>> {
  const ids = [...new Set(things.map((thing) => thing.connection))];
  if (ids.length === 0) return new Map();
  const { rows } = await db().query<{ id: string; name: string }>(
    'select id, name from connections where id = any($1::text[])',
    [ids],
  );
  return new Map(rows.map((row) => [row.id, row.name]));
}

type Names = { records: Map<string, string>; connections: Map<string, string> };

/** A thing by its name where Core holds it, else by the CRM's id for it. */
function thingName(thing: AdminThing, names: Names): string {
  if (thing.office) {
    return names.records.get(`${thing.connection} office ${thing.office}`) ?? thing.office;
  }
  if (thing.record) {
    const { datatype, id } = thing.record;
    return names.records.get(`${thing.connection} ${datatype} ${id}`) ?? id;
  }
  return names.connections.get(thing.connection) ?? thing.connection;
}

function shownValue(value: AdminValue, names: Names, coreUrl: string): ShownValue {
  if (isThing(value)) return thingName(value, names);
  if (typeof value === 'object' && value !== null && 'address' in value) {
    return `${coreUrl}${value.address}`;
  }
  return value;
}

const shownAction = (action: AdminAction): ShownAction => ({
  id: action.id,
  label: action.label,
  help: action.help ?? null,
  confirm: action.confirm ?? null,
  danger: action.danger === true,
});

/** An action the panel can press: one that asks for no typed fields. */
const pressable = (action: AdminAction): boolean => !action.fields?.length;

function shownSection(section: AdminSection, names: Names, coreUrl: string): ShownSection {
  const value = (one: AdminValue) => shownValue(one, names, coreUrl);
  return {
    title: section.title,
    help: section.help ?? null,
    items: (section.items ?? []).map((item) => ({ label: item.label, value: value(item.value) })),
    table: section.table
      ? {
          columns: section.table.columns,
          rows: section.table.rows.map((row) => row.cells.map(value)),
          empty: section.table.empty ?? null,
        }
      : null,
    actions: (section.actions ?? []).filter(pressable).map(shownAction),
  };
}

/** What the CRM's code shows of one connection on its tenant's page; nothing when it shows none. */
export async function sectionsOf(connection: Connection, coreUrl: string): Promise<Sections> {
  const admin = adminFor(connection.provider);
  if (!admin?.connection) return { sections: [], failed: null };
  let declared: AdminSection[];
  try {
    declared = await admin.connection(connection);
  } catch (error) {
    report(error, { where: 'panel connection sections', provider: connection.provider });
    return {
      sections: [],
      failed: failureWords(error, { crm: crmName(connection.provider), reading: true }),
    };
  }
  const things = thingsIn(declared);
  const names: Names = {
    records: await recordNames(things),
    connections: await connectionNames(things),
  };
  return {
    sections: declared.map((section) => shownSection(section, names, coreUrl)),
    failed: null,
  };
}

/** One connection in one line, as its CRM's code says it; null when the code says nothing. */
export function describe(connection: Connection): string | null {
  const admin = adminFor(connection.provider);
  if (!admin?.describe) return null;
  try {
    const line = admin.describe(connection).trim();
    return line === '' ? null : line;
  } catch (error) {
    report(error, { where: 'panel connection line', provider: connection.provider });
    return null;
  }
}
