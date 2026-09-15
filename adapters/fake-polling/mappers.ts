import type { Mappers, MappedRecord } from '../../engine/adapter-api/index.js';

// This CRM speaks snake_case and its own enums.
type Raw = Record<string, unknown>;

const text = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);
const number = (value: unknown): number | null =>
  typeof value === 'number' ? value : typeof value === 'string' && value ? Number(value) : null;

const STATUS: Record<string, string> = {
  pre: 'coming_soon',
  active: 'for_sale',
  done: 'sold',
  cancelled: 'withdrawn',
};

const TYPE: Record<string, string> = {
  flat: 'apartment',
  house: 'house',
  terrace: 'townhouse',
  land: 'plot',
};

const identity = (raw: unknown): Raw => raw as Raw;

const property = (raw: unknown): MappedRecord => {
  const record = identity(raw);
  const id = text(record['object_id']);
  if (!id) throw new Error('a record without an object_id cannot be mapped');
  const status = STATUS[String(record['stage'])];
  if (!status) throw new Error(`unknown stage "${String(record['stage'])}"`);
  return {
    officeId: text(record['branch_id']),
    remoteUpdatedAt: text(record['changed_at']),
    data: {
      id,
      slug: '',
      status,
      listing_type: TYPE[String(record['object_type'])] ?? 'other',
      address: {
        street: text(record['street']),
        city: text(record['city']),
        postal_code: text(record['postcode']),
      },
      price: number(record['price']),
      living_space: number(record['area_sqm']),
      additional_space: number(record['secondary_sqm']),
      rooms: number(record['rooms']),
      lat: number(record['lat']),
      lng: number(record['lon']),
      office_id: text(record['branch_id']),
      area_ids: Array.isArray(record['districts']) ? record['districts'].map(String) : [],
      agent_ids: Array.isArray(record['staff']) ? record['staff'].map(String) : [],
      association_id: text(record['coop_id']),
      images: [],
      viewings: [],
      published_at: text(record['listed_at']),
      sold_at: text(record['closed_at']),
      display: {},
      provider_extras: { 'fake-polling': { object_type: String(record['object_type']) } },
    },
  };
};

const office = (raw: unknown): MappedRecord => {
  const record = identity(raw);
  const id = text(record['branch_id']);
  if (!id) throw new Error('a record without a branch_id cannot be mapped');
  return {
    officeId: id,
    remoteUpdatedAt: text(record['changed_at']),
    data: {
      id,
      name: text(record['branch_name']) ?? '',
      address: {
        street: text(record['street']),
        city: text(record['city']),
        postal_code: text(record['postcode']),
      },
      lat: number(record['lat']),
      lng: number(record['lon']),
      phone: text(record['phone']),
      email: text(record['email']),
      display: {},
      provider_extras: {},
    },
  };
};

const agent = (raw: unknown): MappedRecord => {
  const record = identity(raw);
  const id = text(record['staff_id']);
  if (!id) throw new Error('a record without a staff_id cannot be mapped');
  return {
    officeId: text(record['branch_id']),
    remoteUpdatedAt: text(record['changed_at']),
    data: {
      id,
      name: text(record['full_name']) ?? '',
      title: text(record['position']),
      phone: text(record['phone']),
      email: text(record['email']),
      image_url: text(record['photo']),
      office_id: text(record['branch_id']),
      display: {},
      provider_extras: {},
    },
  };
};

const area = (raw: unknown): MappedRecord => {
  const record = identity(raw);
  const id = text(record['district_id']);
  if (!id) throw new Error('a record without a district_id cannot be mapped');
  return {
    officeId: null,
    remoteUpdatedAt: text(record['changed_at']),
    data: {
      id,
      name: text(record['district_name']) ?? '',
      polygon: (record['boundary'] as Record<string, unknown> | undefined) ?? null,
      display: {},
      provider_extras: {},
    },
  };
};

const association = (raw: unknown): MappedRecord => {
  const record = identity(raw);
  const id = text(record['coop_id']);
  if (!id) throw new Error('a record without a coop_id cannot be mapped');
  return {
    officeId: null,
    remoteUpdatedAt: text(record['changed_at']),
    data: {
      id,
      name: text(record['coop_name']) ?? '',
      display: {},
      provider_extras: {},
    },
  };
};

export const mappers: Mappers = { property, office, agent, area, association };
