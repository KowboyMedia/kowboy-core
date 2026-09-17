import type { Mappers, MappedRecord } from '../../engine/adapter-api/index.js';

// This CRM's own vocabulary. Mapping it to the universal model is the adapter's whole job.
//
// The universal model has no descriptive fields yet (see schemas/), so everything this fake CRM
// knows beyond identity is carried in fields named `fake_*`. That name is deliberate: these are
// dummy fields belonging to a dummy provider, and none of them is a claim about what a real
// property, office or agent looks like.

type Raw = Record<string, unknown>;

const text = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);
const number = (value: unknown): number | null => (typeof value === 'number' ? value : null);
const list = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : []);

const STATES = new Set(['COMING', 'FOR_SALE', 'SOLD', 'WITHDRAWN']);

const requireRef = (record: Raw): string => {
  const id = text(record['ref']);
  if (!id) throw new Error('a record without a ref cannot be mapped');
  return id;
};

const property = (raw: unknown): MappedRecord => {
  const record = raw as Raw;
  const id = requireRef(record);

  // A value this adapter does not understand is a mapping failure, not a silent default.
  const state = String(record['state']);
  if (!STATES.has(state)) throw new Error(`unknown state "${state}"`);

  return {
    officeId: text(record['officeRef']),
    remoteUpdatedAt: text(record['updatedUtc']),
    data: {
      id,
      office_id: text(record['officeRef']),
      agent_ids: list(record['brokerRefs']),
      area_ids: list(record['areaRefs']),
      association_id: text(record['associationRef']),
      fake_state: state,
      fake_label: text(record['streetAddress']),
      fake_amount: number(record['askingPrice']),
      display: {},
      provider_extras: { 'fake-webhook': { internal_code: record['internalCode'] ?? null } },
    },
  };
};

const office = (raw: unknown): MappedRecord => {
  const record = raw as Raw;
  const id = requireRef(record);
  return {
    officeId: id,
    remoteUpdatedAt: text(record['updatedUtc']),
    data: { id, fake_label: text(record['title']), display: {}, provider_extras: {} },
  };
};

const agent = (raw: unknown): MappedRecord => {
  const record = raw as Raw;
  const id = requireRef(record);
  return {
    officeId: text(record['officeRef']),
    remoteUpdatedAt: text(record['updatedUtc']),
    data: { id, fake_label: text(record['firstName']), display: {}, provider_extras: {} },
  };
};

const tenantWide = (raw: unknown): MappedRecord => {
  const record = raw as Raw;
  const id = requireRef(record);
  return {
    officeId: null,
    remoteUpdatedAt: text(record['updatedUtc']),
    data: { id, fake_label: text(record['title']), display: {}, provider_extras: {} },
  };
};

export const mappers: Mappers = {
  property,
  office,
  agent,
  area: tenantWide,
  association: tenantWide,
};
