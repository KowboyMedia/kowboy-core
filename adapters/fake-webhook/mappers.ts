import type { Mappers, MappedRecord } from '../../engine/adapter-api/index.js';

// This CRM's own vocabulary, mapped onto the universal names (docs/field-tables.md): the
// adapter's whole job. A fake CRM knows little, so most universal fields are null or empty;
// what it knows lands under the same names a real CRM's records use.

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

/** The address block every property and project carries, with only the street known here. */
const address = (street: unknown): Raw => ({
  street: text(street),
  postal_code: null,
  city: null,
  area_name: null,
  municipality: null,
  country_code: null,
});

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
      project_id: null,
      status: { id: state, name: state },
      type: null,
      subtype: null,
      tenure: null,
      address: address(record['streetAddress']),
      lat: null,
      lng: null,
      price: number(record['askingPrice']),
      final_price: null,
      // The contract date, when the fake CRM has one: what makes a record "sold" for the engine.
      ...(record['soldUtc'] === undefined ? {} : { sold_at: text(record['soldUtc']) }),
      currency: 'SEK',
      fee: null,
      living_space: null,
      additional_space: null,
      rooms: null,
      buildings: [],
      images: [],
      viewings: [],
      bidding: { is_active: null, is_verified: null, bids: [] },
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
    data: {
      id,
      name: text(record['title']),
      address: { street: null, postal_code: null, city: null },
      phone: null,
      email: null,
      lat: null,
      lng: null,
      display: {},
      provider_extras: {},
    },
  };
};

const agent = (raw: unknown): MappedRecord => {
  const record = raw as Raw;
  const id = requireRef(record);
  const officeId = text(record['officeRef']);
  return {
    officeId,
    remoteUpdatedAt: text(record['updatedUtc']),
    data: {
      id,
      office_ids: officeId ? [officeId] : [],
      name: text(record['firstName']),
      title: null,
      email: null,
      phones: { mobile: null, public: null },
      image: null,
      offices: officeId
        ? [{ office_id: officeId, order: null, is_visible_in_staff_list: null, phone: null }]
        : [],
      display: {},
      provider_extras: {},
    },
  };
};

const area = (raw: unknown): MappedRecord => {
  const record = raw as Raw;
  const id = requireRef(record);
  return {
    officeId: null,
    remoteUpdatedAt: text(record['updatedUtc']),
    data: {
      id,
      name: text(record['title']),
      polygon: null,
      images: [],
      display: {},
      provider_extras: {},
    },
  };
};

const association = (raw: unknown): MappedRecord => {
  const record = raw as Raw;
  const id = requireRef(record);
  return {
    officeId: null,
    remoteUpdatedAt: text(record['updatedUtc']),
    data: { id, name: text(record['title']), contact: null, display: {}, provider_extras: {} },
  };
};

export const mappers: Mappers = {
  property,
  office,
  agent,
  area,
  association,
};
