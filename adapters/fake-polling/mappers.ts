import type { Mappers, MappedRecord } from '../../engine/adapter-api/index.js';

// A second fake CRM, speaking snake_case, to prove the engine depends on neither vocabulary:
// it maps onto the same universal names (docs/field-tables.md) as the first. It carries enough
// of a listing (sizes, fee, images, viewings, dates, an agent's contact) for the client
// templates to be proved against it.

type Raw = Record<string, unknown>;

const text = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);
const number = (value: unknown): number | null =>
  typeof value === 'number' ? value : typeof value === 'string' && value ? Number(value) : null;
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : []);
const named = (value: unknown): { id: string; name: string } | null =>
  typeof value === 'string' && value ? { id: value, name: value } : null;

const STAGES = new Set(['pre', 'active', 'done', 'cancelled']);

const require_ = (record: Raw, field: string): string => {
  const id = text(record[field]);
  if (!id) throw new Error(`a record without ${field} cannot be mapped`);
  return id;
};

// An image is a URL, or a record with `url` and the office's `category` (a floor plan, say).
const image = (value: unknown, order: number): Raw => ({
  id: `img-${order}`,
  url: typeof value === 'string' ? value : String((value as Raw)['url'] ?? ''),
  category: typeof value === 'string' ? null : text((value as Raw)['category']),
  name: null,
  description: null,
  extension: 'jpg',
  changed_at: null,
  order,
});

const property = (raw: unknown): MappedRecord => {
  const record = raw as Raw;
  const id = require_(record, 'object_id');
  const stage = String(record['stage']);
  if (!STAGES.has(stage)) throw new Error(`unknown stage "${stage}"`);
  const fee = number(record['fee']);

  return {
    officeId: text(record['branch_id']),
    remoteUpdatedAt: text(record['changed_at']),
    data: {
      id,
      office_id: text(record['branch_id']),
      agent_ids: strings(record['staff']),
      area_ids: strings(record['districts']),
      association_id: text(record['coop_id']),
      project_id: text(record['project_id']),
      status: { id: stage, name: text(record['stage_label']) ?? stage },
      type: null,
      subtype: null,
      tenure: named(record['tenure']),
      price_text: text(record['price_text']),
      address: {
        street: text(record['street']),
        postal_code: text(record['postal_code']),
        city: text(record['city']),
        area_name: text(record['district_name']),
        area_id: strings(record['districts'])[0] ?? null,
        municipality: null,
        country_code: null,
      },
      lat: number(record['lat']),
      lng: number(record['lng']),
      short_text: text(record['blurb']),
      heading: text(record['heading']),
      price: number(record['price']),
      final_price: number(record['final_price']),
      sold_at: text(record['sold_at']),
      published_at: text(record['published_at']),
      currency: 'SEK',
      fee: fee === null ? null : { amount: fee, frequency: 'Monthly', type: null, comment: null },
      living_space: number(record['living_space']),
      additional_space: null,
      rooms: number(record['rooms']),
      buildings: [],
      images: (Array.isArray(record['images']) ? record['images'] : []).map((value, index) =>
        image(value, index + 1),
      ),
      viewings: (Array.isArray(record['viewings']) ? record['viewings'] : []).map(
        (viewing, index) => ({
          id: `viewing-${index + 1}`,
          starts_at: text((viewing as Raw)['starts_at']),
          ends_at: text((viewing as Raw)['ends_at']),
          comment: text((viewing as Raw)['comment']),
          is_digital: null,
          self_registration:
            typeof (viewing as Raw)['bookable'] === 'boolean'
              ? ((viewing as Raw)['bookable'] as boolean)
              : null,
          is_project_viewing: null,
        }),
      ),
      viewing_settings: { visible_limit: null, empty_text: null },
      exterior_features: [],
      bidding: {
        is_active: typeof record['bidding_active'] === 'boolean' ? record['bidding_active'] : null,
        is_verified: null,
        bids: (Array.isArray(record['bids']) ? record['bids'] : []).map((bid) => ({
          placed_at: text((bid as Raw)['placed_at']),
          amount: number((bid as Raw)['amount']),
          is_cancelled:
            typeof (bid as Raw)['is_cancelled'] === 'boolean'
              ? ((bid as Raw)['is_cancelled'] as boolean)
              : null,
          alias: text((bid as Raw)['alias']),
        })),
      },
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
      address: { street: text(record['street']), postal_code: null, city: text(record['city']) },
      phone: null,
      email: text(record['email']),
      lat: number(record['lat']),
      lng: number(record['lng']),
      display: {},
      provider_extras: {},
    },
  };
};

const agent = (raw: unknown): MappedRecord => {
  const record = raw as Raw;
  const id = require_(record, 'staff_id');
  const officeId = text(record['branch_id']);
  const mobile = text(record['mobile']);
  const photo = text(record['photo']);
  return {
    officeId,
    remoteUpdatedAt: text(record['changed_at']),
    data: {
      id,
      office_ids: officeId ? [officeId] : [],
      name: text(record['full_name']),
      title: text(record['title']),
      description: text(record['bio']),
      email: text(record['email']),
      phones: { mobile: mobile ? { number: mobile, display: mobile } : null, public: null },
      image: photo ? image(photo, 1) : null,
      offices: officeId
        ? [
            {
              office_id: officeId,
              order: number(record['order']),
              is_visible_in_staff_list: null,
              phone: null,
            },
          ]
        : [],
      reviews: (Array.isArray(record['reviews']) ? record['reviews'] : []).map((review) => ({
        text: text((review as Raw)['text']),
        author: text((review as Raw)['author']),
      })),
      display: {},
      provider_extras: {},
    },
  };
};

const namedRecord =
  (idField: string, nameField: string, extra: Raw): ((raw: unknown) => MappedRecord) =>
  (raw: unknown): MappedRecord => {
    const record = raw as Raw;
    const id = require_(record, idField);
    return {
      officeId: null,
      remoteUpdatedAt: text(record['changed_at']),
      data: {
        id,
        name: text(record[nameField]),
        office_id: text(record['branch_id']),
        ...extra,
        display: {},
        provider_extras: {},
      },
    };
  };

export const mappers: Mappers = {
  property,
  office,
  agent,
  area: namedRecord('district_id', 'district_name', { polygon: null, images: [] }),
  association: namedRecord('coop_id', 'coop_name', { contact: null }),
};
