// Vitec's advertising payloads, mapped to the universal model.
//
// The entire payload reaches the sites (Patric, 2026-09-18): `data` mirrors everything Connect
// returns, every field under its snake_case name with the CRM's nesting kept, and the spine sits
// on top: identity, the references between the datatypes and the change date. Nothing is chosen
// and nothing is judged; `docs/data-model-reference.md` lists every path. The plugin's own field
// names, once supplied, are laid on top as renames. `display` stays empty until the rules ledger
// exists. Payload keys are camelCase, as Connect's JSON serialises them
// (docs/inputs/vitec/advertising.openapi.json).
import type { Datatype, MappedRecord, Mappers } from '../../engine/adapter-api/index.js';

type Raw = Record<string, unknown>;

const record = (value: unknown): Raw =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : {};
const text = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null;

/** `StreetAddress` and `streetAddress` become `street_address`: the rule of docs/data-model-reference.md. */
const snake = (name: string): string =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();

/** The payload as it is, keys renamed to snake_case at every level, arrays and values untouched. */
function mirror(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(mirror);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Raw).map(([key, inner]) => [snake(key), mirror(inner)]),
    );
  }
  return value;
}

/**
 * Vitec writes a change date as Swedish wall-clock time with no offset and up to seven fractional
 * digits (`2026-08-31T11:46:09.65`, verified against Connect 2026-09-18, README). The envelope
 * wants a moment in ISO 8601, so a bare value is read in Vitec's zone; an offset, when one is
 * given, is honoured as it stands.
 */
const VITEC_ZONE = 'Europe/Stockholm';
const HAS_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/i;

const wallClock = new Intl.DateTimeFormat('en-US', {
  timeZone: VITEC_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** The zone's offset from UTC at a moment, in milliseconds. */
const offsetAt = (moment: number): number => {
  const part = Object.fromEntries(
    wallClock.formatToParts(new Date(moment)).map((piece) => [piece.type, piece.value]),
  );
  const local = Date.UTC(
    Number(part['year']),
    Number(part['month']) - 1,
    Number(part['day']),
    Number(part['hour']),
    Number(part['minute']),
    Number(part['second']),
  );
  return local - Math.floor(moment / 1000) * 1000;
};

/** A wall-clock time in Vitec's zone as a moment; two passes settle the offset across a DST change. */
const fromVitecZone = (bare: string): Date => {
  const asUtc = Date.parse(`${bare.includes('T') ? bare : `${bare}T00:00:00`}Z`);
  if (Number.isNaN(asUtc)) return new Date(Number.NaN);
  const first = asUtc - offsetAt(asUtc);
  return new Date(asUtc - offsetAt(first));
};

export const isoDate = (value: unknown): string | null => {
  const given = text(value);
  if (!given) return null;
  const parsed = HAS_OFFSET.test(given) ? new Date(given) : fromVitecZone(given);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

/**
 * The office id: what Connect calls the customer id (`M30011`), which every URL and notification
 * carries; `Office.Id` is an alias of it (Patric, 2026-09-16).
 */
const officeIdOf = (reference: unknown): string | null =>
  text(record(reference)['customerId']) ?? text(record(reference)['id']);

/** A record's own change date, the way a list row states it: what the catch-up compares. */
export const changedAtOf = (input: unknown): string | null => isoDate(record(input)['changedAt']);

const requireId = (raw: Raw): string => {
  const id = text(raw['id']);
  if (!id) throw new Error('a record without an id cannot be mapped');
  return id;
};

const agentIds = (raw: Raw): string[] =>
  [raw['primaryAgentId'], raw['secondaryAgentId']].map(text).filter((id): id is string => !!id);

const areaIds = (raw: Raw): string[] => {
  const area = text(record(record(raw['address'])['area'])['id']);
  return area ? [area] : [];
};

/** The mirror with the spine on top; the spine wins where a name is shared (`id`, `project_id`). */
const unified = (raw: Raw, spine: Raw): Raw => ({
  ...record(mirror(raw)),
  ...spine,
  display: {},
  provider_extras: {},
});

const property = (input: unknown): MappedRecord => {
  const raw = record(input);
  const id = requireId(raw);
  const officeId = officeIdOf(raw['office']);
  const association = record(
    record(record(raw['extensions'])['housingCooperative'])['association'],
  );
  return {
    officeId,
    remoteUpdatedAt: isoDate(raw['changedAt']),
    data: unified(raw, {
      id,
      office_id: officeId,
      agent_ids: agentIds(raw),
      area_ids: areaIds(raw),
      association_id: text(association['id']),
      project_id: text(raw['projectId']),
    }),
  };
};

const project = (input: unknown): MappedRecord => {
  const raw = record(input);
  const id = requireId(raw);
  const officeId = officeIdOf(raw['office']);
  return {
    officeId,
    remoteUpdatedAt: isoDate(raw['changedAt']),
    data: unified(raw, {
      id,
      office_id: officeId,
      agent_ids: agentIds(raw),
      area_ids: areaIds(raw),
    }),
  };
};

/** An office's `id` in Core is its customer id; Vitec's own office id stays in `raw` and under `customer_id`'s sibling. */
const office = (input: unknown): MappedRecord => {
  const raw = record(input);
  const id = officeIdOf(raw) ?? requireId(raw);
  return {
    officeId: id,
    remoteUpdatedAt: isoDate(raw['changedAt']),
    data: unified(raw, { id }),
  };
};

/** A user belongs to one or several offices, so the item is tenant-wide and lists them. */
const agent = (input: unknown): MappedRecord => {
  const raw = record(input);
  const id = requireId(raw);
  const offices = Array.isArray(raw['offices']) ? raw['offices'] : [];
  return {
    officeId: null,
    remoteUpdatedAt: isoDate(raw['changedAt']),
    data: unified(raw, {
      id,
      office_ids: offices.map(officeIdOf).filter((x): x is string => !!x),
    }),
  };
};

const tenantWide = (input: unknown): MappedRecord => {
  const raw = record(input);
  const id = requireId(raw);
  return {
    officeId: null,
    remoteUpdatedAt: isoDate(raw['changedAt']),
    data: unified(raw, { id }),
  };
};

export const mappers: Mappers = {
  property,
  project,
  office,
  agent,
  area: tenantWide,
  association: tenantWide,
};

/**
 * The items a payload points at that have no list endpoint of their own, or may not be listed
 * yet: the adapter fetches them when it first sees the reference.
 */
export function referencedIds(
  datatype: Datatype,
  input: unknown,
): { datatype: Datatype; id: string }[] {
  if (datatype !== 'property') return [];
  const raw = record(input);
  const association = text(
    record(record(record(raw['extensions'])['housingCooperative'])['association'])['id'],
  );
  const projectId = text(raw['projectId']);
  return [
    ...(association ? [{ datatype: 'association' as const, id: association }] : []),
    ...(projectId ? [{ datatype: 'project' as const, id: projectId }] : []),
  ];
}
