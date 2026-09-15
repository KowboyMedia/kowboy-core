import type { Mappers, MappedRecord } from '../../engine/adapter-api/index.js';

// This CRM's own vocabulary. Mapping it to the universal model is the adapter's whole job.
const STATUS: Record<string, string> = {
  COMING: 'coming_soon',
  FOR_SALE: 'for_sale',
  SOLD: 'sold',
  WITHDRAWN: 'withdrawn',
};

const KIND: Record<string, string> = {
  APARTMENT: 'apartment',
  VILLA: 'house',
  ROW: 'townhouse',
  PLOT: 'plot',
  COMMERCIAL: 'commercial',
};

type Raw = Record<string, unknown>;

const text = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);
const number = (value: unknown): number | null => (typeof value === 'number' ? value : null);
const list = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : []);

const property = (raw: unknown): MappedRecord => {
  const record = raw as Raw;
  const id = text(record['ref']);
  if (!id) throw new Error('a record without a ref cannot be mapped');

  const status = STATUS[String(record['state'])];
  if (!status) throw new Error(`unknown state "${String(record['state'])}"`);

  // An unknown listing type becomes "other", and the CRM's own value is kept in provider_extras
  // so nothing is lost (SRS §6.5).
  const kind = KIND[String(record['kind'])] ?? 'other';

  return {
    officeId: text(record['officeRef']),
    remoteUpdatedAt: text(record['updatedUtc']),
    data: {
      id,
      slug: '',
      status,
      listing_type: kind,
      address: {
        street: text(record['streetAddress']),
        city: text(record['town']),
        postal_code: text(record['zip']),
      },
      price: number(record['askingPrice']),
      living_space: number(record['livingArea']),
      additional_space: number(record['extraArea']),
      rooms: number(record['roomCount']),
      lat: number(record['latitude']),
      lng: number(record['longitude']),
      office_id: text(record['officeRef']),
      area_ids: list(record['areaRefs']),
      agent_ids: list(record['brokerRefs']),
      association_id: text(record['associationRef']),
      images: (Array.isArray(record['photos']) ? record['photos'] : []).map((photo, index) => {
        const item = photo as Raw;
        return { url: text(item['src']) ?? '', sort: number(item['order']) ?? index };
      }),
      viewings: (Array.isArray(record['showings']) ? record['showings'] : []).map((showing) => {
        const item = showing as Raw;
        return { starts_at: text(item['from']) ?? '', ends_at: text(item['to']) };
      }),
      published_at: text(record['publishedUtc']),
      sold_at: text(record['soldUtc']),
      display: {},
      provider_extras: {
        'fake-webhook': {
          kind: String(record['kind']),
          internal_code: record['internalCode'] ?? null,
        },
      },
    },
  };
};

const office = (raw: unknown): MappedRecord => {
  const record = raw as Raw;
  const id = text(record['ref']);
  if (!id) throw new Error('a record without a ref cannot be mapped');
  return {
    officeId: id,
    remoteUpdatedAt: text(record['updatedUtc']),
    data: {
      id,
      name: text(record['title']) ?? '',
      address: {
        street: text(record['streetAddress']),
        city: text(record['town']),
        postal_code: text(record['zip']),
      },
      lat: number(record['latitude']),
      lng: number(record['longitude']),
      phone: text(record['phoneNumber']),
      email: text(record['emailAddress']),
      display: {},
      provider_extras: {},
    },
  };
};

const agent = (raw: unknown): MappedRecord => {
  const record = raw as Raw;
  const id = text(record['ref']);
  if (!id) throw new Error('a record without a ref cannot be mapped');
  return {
    officeId: text(record['officeRef']),
    remoteUpdatedAt: text(record['updatedUtc']),
    data: {
      id,
      name: [text(record['firstName']), text(record['lastName'])].filter(Boolean).join(' '),
      title: text(record['role']),
      phone: text(record['phoneNumber']),
      email: text(record['emailAddress']),
      image_url: text(record['portraitUrl']),
      office_id: text(record['officeRef']),
      display: {},
      provider_extras: {},
    },
  };
};

const area = (raw: unknown): MappedRecord => {
  const record = raw as Raw;
  const id = text(record['ref']);
  if (!id) throw new Error('a record without a ref cannot be mapped');
  return {
    officeId: null,
    remoteUpdatedAt: text(record['updatedUtc']),
    data: {
      id,
      name: text(record['title']) ?? '',
      polygon: (record['geo'] as Record<string, unknown> | undefined) ?? null,
      display: {},
      provider_extras: {},
    },
  };
};

const association = (raw: unknown): MappedRecord => {
  const record = raw as Raw;
  const id = text(record['ref']);
  if (!id) throw new Error('a record without a ref cannot be mapped');
  return {
    officeId: null,
    remoteUpdatedAt: text(record['updatedUtc']),
    data: {
      id,
      name: text(record['title']) ?? '',
      display: {},
      provider_extras: {},
    },
  };
};

export const mappers: Mappers = { property, office, agent, area, association };
