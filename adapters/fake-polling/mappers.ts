import type { Mappers, MappedRecord } from '../../engine/adapter-api/index.js';

// A second fake CRM, speaking snake_case, to prove the engine depends on neither vocabulary:
// it maps onto the same universal names (docs/field-tables.md) as the first.

type Raw = Record<string, unknown>;

const text = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);
const number = (value: unknown): number | null =>
  typeof value === 'number' ? value : typeof value === 'string' && value ? Number(value) : null;

const STAGES = new Set(['pre', 'active', 'done', 'cancelled']);

const require_ = (record: Raw, field: string): string => {
  const id = text(record[field]);
  if (!id) throw new Error(`a record without ${field} cannot be mapped`);
  return id;
};

const property = (raw: unknown): MappedRecord => {
  const record = raw as Raw;
  const id = require_(record, 'object_id');
  const stage = String(record['stage']);
  if (!STAGES.has(stage)) throw new Error(`unknown stage "${stage}"`);

  return {
    officeId: text(record['branch_id']),
    remoteUpdatedAt: text(record['changed_at']),
    data: {
      id,
      office_id: text(record['branch_id']),
      agent_ids: Array.isArray(record['staff']) ? record['staff'].map(String) : [],
      area_ids: Array.isArray(record['districts']) ? record['districts'].map(String) : [],
      association_id: text(record['coop_id']),
      project_id: null,
      status: { id: stage, name: stage },
      type: null,
      subtype: null,
      tenure: null,
      address: {
        street: text(record['street']),
        postal_code: null,
        city: null,
        area_name: null,
        municipality: null,
        country_code: null,
      },
      lat: null,
      lng: null,
      price: number(record['price']),
      final_price: null,
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
      provider_extras: { 'fake-polling': { object_type: String(record['object_type']) } },
    },
  };
};

const office = (raw: unknown): MappedRecord => {
  const record = raw as Raw;
  const id = require_(record, 'branch_id');
  return {
    officeId: id,
    remoteUpdatedAt: text(record['changed_at']),
    data: {
      id,
      name: text(record['branch_name']),
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
  const id = require_(record, 'staff_id');
  const officeId = text(record['branch_id']);
  return {
    officeId,
    remoteUpdatedAt: text(record['changed_at']),
    data: {
      id,
      office_ids: officeId ? [officeId] : [],
      name: text(record['full_name']),
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

const named =
  (idField: string, nameField: string, extra: Raw): ((raw: unknown) => MappedRecord) =>
  (raw: unknown): MappedRecord => {
    const record = raw as Raw;
    const id = require_(record, idField);
    return {
      officeId: null,
      remoteUpdatedAt: text(record['changed_at']),
      data: { id, name: text(record[nameField]), ...extra, display: {}, provider_extras: {} },
    };
  };

export const mappers: Mappers = {
  property,
  office,
  agent,
  area: named('district_id', 'district_name', { polygon: null, images: [] }),
  association: named('coop_id', 'coop_name', { contact: null }),
};
