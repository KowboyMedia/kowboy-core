// Vitec's advertising payloads, mapped to the universal model.
//
// **Only the technical spine is mapped today**: identity, the references between the datatypes,
// and the change date (docs/data-model-proposal.md point 5, approved). The descriptive fields wait
// for the field specification Patric supplies (docs/next-steps.md item 2); until then `data` holds
// nothing beyond the spine, and nothing here pretends otherwise. Payload keys are camelCase, as
// Connect's JSON serialises them (docs/inputs/vitec/advertising.openapi.json).
import type { Datatype, MappedRecord, Mappers } from '../../engine/adapter-api/index.js';

type Raw = Record<string, unknown>;

const record = (value: unknown): Raw =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : {};
const text = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null;

const STOCKHOLM = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Stockholm',
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** How far the Swedish wall clock is ahead of UTC at `instant`, in milliseconds: one or two hours. */
function stockholmOffsetMs(instant: Date): number {
  const parts = STOCKHOLM.formatToParts(instant);
  const at = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value);
  const wallClock = Date.UTC(
    at('year'),
    at('month') - 1,
    at('day'),
    at('hour'),
    at('minute'),
    at('second'),
  );
  return wallClock - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * Vitec's dates are Swedish wall-clock time with no offset, `2026-09-10T10:31:42.29` (verified
 * against Connect 2026-09-17; the documentation's samples carry an offset, and one is honoured
 * when present). The envelope wants an ISO 8601 instant, so a bare value is read as
 * Europe/Stockholm: the digits read as UTC land within two hours of the instant, the offset there
 * is Sweden's except across a daylight-saving switch, and the second pass settles that.
 */
export const isoDate = (value: unknown): string | null => {
  const given = text(value);
  if (!given) return null;
  const bare = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?$/.test(given);
  const guess = new Date(bare ? `${given}Z` : given);
  if (Number.isNaN(guess.getTime())) return null;
  if (!bare) return guess.toISOString();
  const once = new Date(guess.getTime() - stockholmOffsetMs(guess));
  return new Date(guess.getTime() - stockholmOffsetMs(once)).toISOString();
};

/**
 * The office id: what Connect calls the customer id (`M30011`), which every URL and notification
 * carries (Patric, 2026-09-16). An office reference names the same office twice, as
 * `{ id: "FIR30011", customerId: "M30011" }`, and an office record is fetched by the former
 * (verified against Connect 2026-09-17).
 */
const officeIdOf = (reference: unknown): string | null =>
  text(record(reference)['customerId']) ?? text(record(reference)['id']);

/** A record's own change date, the string a list row carries too: what the catch-up compares. */
export const changedAtOf = (input: unknown): string | null => text(record(input)['changedAt']);

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
    data: {
      id,
      office_id: officeId,
      agent_ids: agentIds(raw),
      area_ids: areaIds(raw),
      association_id: text(association['id']),
      project_id: text(raw['projectId']),
      display: {},
      provider_extras: {},
    },
  };
};

const project = (input: unknown): MappedRecord => {
  const raw = record(input);
  const id = requireId(raw);
  const officeId = officeIdOf(raw['office']);
  return {
    officeId,
    remoteUpdatedAt: isoDate(raw['changedAt']),
    data: {
      id,
      office_id: officeId,
      agent_ids: agentIds(raw),
      area_ids: areaIds(raw),
      display: {},
      provider_extras: {},
    },
  };
};

const office = (input: unknown): MappedRecord => {
  const raw = record(input);
  const id = officeIdOf(raw) ?? requireId(raw);
  return {
    officeId: id,
    remoteUpdatedAt: isoDate(raw['changedAt']),
    data: { id, display: {}, provider_extras: {} },
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
    data: {
      id,
      office_ids: offices.map(officeIdOf).filter((x): x is string => !!x),
      display: {},
      provider_extras: {},
    },
  };
};

const tenantWide = (input: unknown): MappedRecord => {
  const raw = record(input);
  const id = requireId(raw);
  return {
    officeId: null,
    remoteUpdatedAt: isoDate(raw['changedAt']),
    data: { id, display: {}, provider_extras: {} },
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
