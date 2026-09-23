// Vitec's advertising payloads, mapped to the universal model (docs/field-tables.md).
//
// Three faces per record (Patric, 2026-09-19, question 44): `raw` is the payload untouched;
// `data` is the universal record: Connect's fields copied and renamed onto the universal names,
// the linking ids lifted on top, and everything the field tables do not name kept under its
// mechanical snake_case name (docs/data-model-reference.md); `display` is the engine's. Nothing
// here judges a value: a status, a type, a category is copied as Connect sends it. Payload keys
// are camelCase, as Connect's JSON serialises them (docs/inputs/vitec/advertising.openapi.json).
import type { Datatype, MappedRecord, Mappers } from '../../engine/adapter-api/index.js';

type Raw = Record<string, unknown>;
type Named = { id: string | null; name: string | null };

const record = (value: unknown): Raw =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : {};
const text = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null;
const number = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;
const flag = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null);
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const present = (value: unknown): boolean =>
  value !== null && value !== undefined && typeof value === 'object';

/** An enumeration as Connect sends it, `{id, name}`, both kept; null when absent. */
const named = (value: unknown): Named | null =>
  present(value) ? { id: text(record(value)['id']), name: text(record(value)['name']) } : null;

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

/**
 * Kowboy's CDN serves every image at width 1920 under the office's customer id and the record's
 * id, from the image id and the extension Connect gives (strategy §12.28, question 50).
 */
const CDN_BASE = 'https://cdn-realestate.kowboy.se/r2';
export const IMAGE_WIDTH = 1920;

const imageUrl = (customerId: string | null, recordId: string, image: Raw): string | null => {
  const id = text(image['id']);
  const extension = text(image['extension']);
  if (!customerId || !id || !extension) return null;
  return `${CDN_BASE}/${customerId}/${recordId}/${id}_${IMAGE_WIDTH}.${extension}`;
};

const imageOf =
  (customerId: string | null, recordId: string) =>
  (value: unknown, index: number): Raw => {
    const image = record(value);
    return {
      id: text(image['id']),
      url: imageUrl(customerId, recordId, image),
      category: text(record(image['category'])['name']),
      name: text(image['name']),
      description: text(image['description']),
      extension: text(image['extension']),
      changed_at: isoDate(image['dataChangedAt']),
      order: index + 1,
    };
  };

const imagesOf = (customerId: string | null, recordId: string, value: unknown): Raw[] =>
  list(value).map(imageOf(customerId, recordId));

const addressOf = (value: unknown): Raw => {
  const address = record(value);
  return {
    street: text(address['streetAddress']),
    postal_code: text(record(address['zipCode'])['value']),
    city: text(address['postalTown']),
    area_name: text(record(address['area'])['name']),
    area_id: text(record(address['area'])['id']),
    municipality: text(address['municipality']),
    country_code: text(address['countryCode']),
    county_municipality_code: text(address['countyMunicipalityCode']),
    directions: text(address['directions']),
  };
};

const coordinatesOf = (value: unknown): Raw => ({
  lat: number(record(value)['latitude']),
  lng: number(record(value)['longitude']),
});

/** The selling texts, shared by properties and projects. */
const textsOf = (sale: Raw): Raw => ({
  heading: text(sale['heading']),
  short_text: text(sale['shortDescription']),
  long_text: text(sale['description']),
  phrase: text(sale['phrase']),
  other_information: text(sale['otherInformation']),
  possession_estimate: text(sale['possessionEstimation']),
});

const marketingOf = (value: unknown): Raw => {
  const marketing = record(value);
  const viewing = record(marketing['viewing']);
  return {
    is_new_build: flag(marketing['isNewHome']),
    is_published: flag(marketing['isPublished']),
    is_preview: flag(marketing['isPreview']),
    published_at: isoDate(marketing['publishedAt']),
    viewing_settings: {
      visible_limit: number(viewing['visibleLimit']),
      empty_text: text(viewing['emptyText']),
    },
  };
};

const viewingOf = (value: unknown): Raw => {
  const viewing = record(value);
  return {
    id: text(viewing['id']),
    starts_at: isoDate(viewing['startsAt']),
    ends_at: isoDate(viewing['endsAt']),
    comment: text(viewing['comment']),
    is_digital: flag(viewing['isDigital']),
    self_registration: flag(viewing['isSelfRegistrationEnabled']),
    is_project_viewing: flag(viewing['isProjectViewing']),
  };
};

const priceOf = (raw: Raw): Raw => {
  const price = record(raw['price']);
  const other = raw['price'] && record(price['startingPriceInOtherCurrency']);
  return {
    price: number(price['startingPrice']),
    final_price: number(price['finalPrice']),
    price_text: text(price['text']),
    price_other_currency: present(price['startingPriceInOtherCurrency'])
      ? { amount: number(record(other)['value']), currency: text(record(other)['currency']) }
      : null,
    currency: text(raw['currency']),
  };
};

const feesOf = (value: unknown): Raw => {
  const fees = record(value);
  const recurring = record(fees['recurring']);
  const lease = record(fees['lease']);
  return {
    fee: present(fees['recurring'])
      ? {
          amount: number(recurring['value']),
          frequency: text(recurring['frequency']),
          type: text(recurring['type']),
          comment: text(recurring['description']),
        }
      : null,
    leasehold: present(fees['leasehold'])
      ? {
          fee: number(record(fees['leasehold'])['fee']),
          term: isoDate(record(fees['leasehold'])['term']),
        }
      : null,
    lease: present(fees['lease'])
      ? {
          fee: number(lease['fee']),
          description: text(lease['description']),
          term: isoDate(lease['term']),
          owner_name: text(record(lease['owner'])['name']),
        }
      : null,
  };
};

const entryOf = (value: unknown): Raw => {
  const entry = record(value);
  return { type: named(entry['type']), description: text(entry['description']) };
};

const exteriorFeatureOf = (value: unknown): Raw => {
  const entry = record(value);
  return {
    type: named(entry['type']),
    is_available: flag(entry['isAvailable']),
    size: number(entry['size']),
    description: text(entry['description']),
  };
};

const operationOf = (value: unknown): Raw => {
  const operation = record(value);
  return {
    operating_cost: number(operation['sum']),
    operating_costs: list(operation['entries']).map((entry) => ({
      type: named(record(entry)['type']),
      value: number(record(entry)['value']),
    })),
    operating_cost_description: text(operation['description']),
    household_size: number(operation['householdSize']),
  };
};

/** The sizes and facts a listing shows: the same names on a building and, from the first building, on the property. */
const buildingFactsOf = (building: Raw): Raw => {
  const area = record(building['area']);
  const bedrooms = record(building['bedrooms']);
  const floor = record(building['floor']);
  const elevator = record(building['elevator']);
  const year = record(building['yearBuilt']);
  return {
    rooms: number(building['numberOfRooms']),
    bedrooms: number(bedrooms['count']),
    bedrooms_max: number(bedrooms['max']),
    bathrooms: number(building['numberOfBathRooms']),
    living_space: number(area['living']),
    additional_space: number(area['grossFloor']),
    building_area: number(area['building']),
    area_description: text(area['description']),
    area_source: text(area['source']),
    floor: number(floor['number']),
    floors_total: number(floor['total']),
    floor_description: text(floor['description']),
    elevator: flag(elevator['isAvailable']),
    elevator_description: text(elevator['description']),
    year_built: number(year['numeric']),
    year_built_text: text(year['text']),
    year_built_description: text(year['description']),
  };
};

const energyDeclarationOf = (value: unknown): Raw | null => {
  if (!present(value)) return null;
  const declaration = record(value);
  return {
    consumption: number(declaration['consumption']),
    class: text(declaration['class']),
    status: named(declaration['status']),
    performed_at: isoDate(declaration['performedAt']),
  };
};

const buildingOf = (value: unknown): Raw => {
  const building = record(value);
  const ventilation = record(building['ventilation']);
  const electricity = record(building['electricity']);
  return {
    name: text(building['name']),
    type: text(building['type']),
    ...buildingFactsOf(building),
    description: text(building['description']),
    interior: text(building['interior']),
    other_information: text(building['otherInformation']),
    ventilation: { type: text(ventilation['type']), inspection: text(ventilation['inspection']) },
    architecture: list(building['architecture']).map(entryOf),
    renovation: text(record(building['renovation'])['description']),
    services: list(building['services']).map(entryOf),
    room_list: list(building['rooms']).map((room) => ({
      name: text(record(room)['name']),
      description: text(record(room)['description']),
    })),
    room_list_text: text(building['compiledRoomList']),
    energy_declaration: energyDeclarationOf(building['energyDeclaration']),
    plot_description: text(record(building['plot'])['description']),
    exterior_features: list(building['exterior']).map(exteriorFeatureOf),
    ...operationOf(record(building['expenses'])['operation']),
    electricity: {
      company: text(electricity['company']),
      distributor: text(electricity['distributor']),
      consumption: number(electricity['consumption']),
    },
  };
};

const exteriorOf = (value: unknown): Raw => {
  const exterior = record(value);
  const plot = record(exterior['plot']);
  return {
    plot: present(exterior['plot'])
      ? {
          area: number(plot['size']),
          type: text(plot['type']),
          description: text(plot['description']),
        }
      : null,
    exterior_features: list(exterior['entries']).map(exteriorFeatureOf),
    other_buildings: text(exterior['buildingsDescription']),
    building_permission: text(exterior['buildingPermission']),
  };
};

const biddingOf = (value: unknown): Raw => {
  const bidding = record(value);
  return {
    is_active: flag(bidding['isActive']),
    is_verified: flag(bidding['isVerified']),
    bids: list(bidding['bids']).map((bid) => ({
      placed_at: isoDate(record(bid)['placedAt']),
      amount: number(record(bid)['amount']),
      is_cancelled: flag(record(bid)['isCanceled']),
      alias: text(record(bid)['alias']),
    })),
  };
};

/** The mirror less the keys the universal names consume, so nothing is carried twice. */
const tail = (raw: Raw, consumed: readonly string[]): Raw => {
  const kept = Object.fromEntries(Object.entries(raw).filter(([key]) => !consumed.includes(key)));
  return record(mirror(kept));
};

/** The tail, the universal fields and the spine, in that order: a universal name wins. */
const unified = (rest: Raw, universal: Raw, spine: Raw): Raw => ({
  ...rest,
  ...universal,
  ...spine,
  display: {},
  provider_extras: {},
});

const PROPERTY_CONSUMED = [
  'referenceId',
  'office',
  'primaryAgentId',
  'secondaryAgentId',
  'projectId',
  'address',
  'sale',
  'price',
  'currency',
  'fees',
  'buildings',
  'exterior',
  'expenses',
  'images',
  'viewings',
  'bidding',
  'marketing',
  'changedAt',
] as const;

const property = (input: unknown): MappedRecord => {
  const raw = record(input);
  const id = requireId(raw);
  const officeId = officeIdOf(raw['office']);
  const sale = record(raw['sale']);
  const buildings = list(raw['buildings']).map(buildingOf);
  const association = record(
    record(record(raw['extensions'])['housingCooperative'])['association'],
  );
  const universal: Raw = {
    reference_number: text(raw['referenceId']),
    status: named(raw['status']),
    type: named(raw['type']),
    subtype: named(raw['subtype']),
    tenure: named(raw['tenure']),
    ...marketingOf(raw['marketing']),
    address: addressOf(raw['address']),
    ...coordinatesOf(record(raw['address'])['wgs84Coordinate']),
    ...textsOf(sale),
    possession_at: isoDate(sale['possessionAt']),
    sold_at: isoDate(sale['contractDate']),
    assigned_at: isoDate(sale['assignmentDate']),
    ...priceOf(raw),
    ...feesOf(raw['fees']),
    ...buildingFactsOf(record(list(raw['buildings'])[0])),
    buildings,
    ...exteriorOf(raw['exterior']),
    ...operationOf(record(raw['expenses'])['operation']),
    images: imagesOf(officeId, id, raw['images']),
    viewings: list(raw['viewings']).map(viewingOf),
    bidding: biddingOf(raw['bidding']),
  };
  return {
    officeId,
    remoteUpdatedAt: isoDate(raw['changedAt']),
    data: unified(tail(raw, PROPERTY_CONSUMED), universal, {
      id,
      office_id: officeId,
      agent_ids: agentIds(raw),
      area_ids: areaIds(raw),
      association_id: text(association['id']),
      project_id: text(raw['projectId']),
    }),
  };
};

const PROJECT_CONSUMED = [
  'office',
  'primaryAgentId',
  'secondaryAgentId',
  'address',
  'sale',
  'currency',
  'estates',
  'producer',
  'images',
  'viewings',
  'marketing',
  'changedAt',
] as const;

const rangeOf = (value: unknown): Raw | null =>
  present(value)
    ? { min: number(record(value)['minValue']), max: number(record(value)['maxValue']) }
    : null;

const project = (input: unknown): MappedRecord => {
  const raw = record(input);
  const id = requireId(raw);
  const officeId = officeIdOf(raw['office']);
  const sale = record(raw['sale']);
  const estates = record(raw['estates']);
  const universal: Raw = {
    name: text(raw['name']),
    status: named(raw['status']),
    ...marketingOf(raw['marketing']),
    address: addressOf(raw['address']),
    ...coordinatesOf(record(raw['address'])['wgs84Coordinate']),
    ...textsOf(sale),
    sale_starts_at: isoDate(sale['startsAt']),
    currency: text(raw['currency']),
    price_range: rangeOf(estates['price']),
    fee_range: rangeOf(estates['monthlyFee']),
    living_space_range: rangeOf(estates['livingSpace']),
    rooms_range: rangeOf(estates['numberOfRooms']),
    plot_range: rangeOf(estates['plot']),
    producer: text(record(raw['producer'])['name']),
    images: imagesOf(officeId, id, raw['images']),
    viewings: list(raw['viewings']).map(viewingOf),
  };
  return {
    officeId,
    remoteUpdatedAt: isoDate(raw['changedAt']),
    data: unified(tail(raw, PROJECT_CONSUMED), universal, {
      id,
      office_id: officeId,
      agent_ids: agentIds(raw),
      area_ids: areaIds(raw),
    }),
  };
};

const phoneOf = (value: unknown): Raw | null =>
  present(value)
    ? { number: text(record(value)['msisdn']), display: text(record(value)['display']) }
    : null;

const OFFICE_CONSUMED = [
  'customerId',
  'streetAddress',
  'zipCode',
  'postalTown',
  'telephone',
  'emailAddress',
  'coordinate',
  'changedAt',
] as const;

/** An office's `id` in Core is its customer id; Vitec's own office id stays in `raw`. */
const office = (input: unknown): MappedRecord => {
  const raw = record(input);
  const id = officeIdOf(raw) ?? requireId(raw);
  const universal: Raw = {
    brand_id: text(raw['brandId']),
    name: text(raw['name']),
    address: {
      street: text(raw['streetAddress']),
      postal_code: text(record(raw['zipCode'])['value']),
      city: text(raw['postalTown']),
    },
    phone: phoneOf(record(raw['telephone'])['switch']),
    email: text(raw['emailAddress']),
    seat: text(raw['seat']),
    description: text(raw['description']),
    ...coordinatesOf(raw['coordinate']),
  };
  return {
    officeId: id,
    remoteUpdatedAt: isoDate(raw['changedAt']),
    data: unified(tail(raw, OFFICE_CONSUMED), universal, { id }),
  };
};

const AGENT_CONSUMED = [
  'emailAddress',
  'spokenLanguages',
  'telephone',
  'image',
  'offices',
  'reviews',
  'changedAt',
] as const;

const agentOfficeOf = (value: unknown): Raw => {
  const membership = record(value);
  return {
    office_id: officeIdOf(membership),
    order: number(membership['orderNumber']),
    is_visible_in_staff_list: flag(membership['isVisibleInStaffList']),
    phone: phoneOf(record(membership['telephone'])['personal']),
  };
};

/** A user belongs to one or several offices, so the item is tenant-wide and lists them. */
const agent = (input: unknown): MappedRecord => {
  const raw = record(input);
  const id = requireId(raw);
  const offices = list(raw['offices']).map(agentOfficeOf);
  const officeIds = offices.map((o) => o['office_id']).filter((x): x is string => !!x);
  const telephone = record(raw['telephone']);
  const universal: Raw = {
    name: text(raw['name']),
    title: text(raw['title']),
    category: text(raw['category']),
    description: text(raw['description']),
    email: text(raw['emailAddress']),
    languages: list(raw['spokenLanguages']).map(String),
    phones: { mobile: phoneOf(telephone['cell']), public: phoneOf(telephone['public']) },
    image: present(raw['image']) ? imageOf(officeIds[0] ?? null, id)(raw['image'], 0) : null,
    is_visible_in_staff_list: flag(raw['isVisibleInStaffList']),
    offices,
    reviews: list(raw['reviews']).map((review) => ({
      text: text(record(review)['text']),
      author: text(record(review)['authorName']),
    })),
  };
  return {
    officeId: null,
    remoteUpdatedAt: isoDate(raw['changedAt']),
    data: unified(tail(raw, AGENT_CONSUMED), universal, { id, office_ids: officeIds }),
  };
};

const AREA_CONSUMED = ['coordinates', 'office', 'images', 'changedAt'] as const;

const area = (input: unknown): MappedRecord => {
  const raw = record(input);
  const id = requireId(raw);
  const officeId = officeIdOf(raw['office']);
  const universal: Raw = {
    name: text(raw['name']),
    county_municipality_code: text(raw['countyMunicipalityCode']),
    polygon: Array.isArray(raw['coordinates']) ? raw['coordinates'] : null,
    office_id: officeId,
    images: imagesOf(officeId, id, raw['images']),
  };
  return {
    officeId: null,
    remoteUpdatedAt: isoDate(raw['changedAt']),
    data: unified(tail(raw, AREA_CONSUMED), universal, { id }),
  };
};

const ASSOCIATION_CONSUMED = ['publicContact', 'changedAt'] as const;

const association = (input: unknown): MappedRecord => {
  const raw = record(input);
  const id = requireId(raw);
  const contact = record(raw['publicContact']);
  const universal: Raw = {
    contact: present(raw['publicContact'])
      ? {
          name: text(contact['name']),
          mobile: text(contact['cellPhone']),
          phone: text(contact['otherPhone']),
          email: text(contact['email']),
        }
      : null,
  };
  return {
    officeId: null,
    remoteUpdatedAt: isoDate(raw['changedAt']),
    data: unified(tail(raw, ASSOCIATION_CONSUMED), universal, { id }),
  };
};

export const mappers: Mappers = {
  property,
  project,
  office,
  agent,
  area,
  association,
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
