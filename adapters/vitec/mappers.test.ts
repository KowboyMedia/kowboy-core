// Vitec's change dates (verified against Connect 2026-09-18, README): bare Swedish wall-clock
// time, read in Vitec's zone; an offset, when given, honoured.
import { describe, expect, it } from 'vitest';
import { isoDate } from './mappers.js';

describe('Vitec change dates', () => {
  it('reads a bare value as Swedish time, winter and summer', () => {
    expect(isoDate('2026-02-27T14:29:22.97')).toBe('2026-02-27T13:29:22.970Z');
    expect(isoDate('2026-08-31T11:46:09.65')).toBe('2026-08-31T09:46:09.650Z');
    expect(isoDate('2024-05-17T10:42:20')).toBe('2024-05-17T08:42:20.000Z');
  });

  it('settles the offset on the days the clocks change', () => {
    expect(isoDate('2026-03-29T01:30:00')).toBe('2026-03-29T00:30:00.000Z');
    expect(isoDate('2026-03-29T03:30:00')).toBe('2026-03-29T01:30:00.000Z');
    expect(isoDate('2026-10-25T04:00:00')).toBe('2026-10-25T03:00:00.000Z');
  });

  it('honours an offset when Vitec gives one, and refuses what is not a date', () => {
    expect(isoDate('2026-09-10T08:00:00.1234567+02:00')).toBe('2026-09-10T06:00:00.123Z');
    expect(isoDate('2026-09-10T06:00:00Z')).toBe('2026-09-10T06:00:00.000Z');
    expect(isoDate('soon')).toBeNull();
    expect(isoDate(null)).toBeNull();
  });
});

// The mapping onto the universal names (docs/field-tables.md), on payloads in the shape Connect
// serialises (docs/inputs/vitec/advertising.openapi.json; shapes checked against the test
// account's records, 2026-09-19). Everything is copied; nothing is judged.
import { mappers } from './mappers.js';

const N = ' ';
type Data = Record<string, unknown>;
const at = (data: Data, path: string): unknown =>
  path.split('.').reduce<unknown>((current, step) => (current as Data | undefined)?.[step], data);

const estatePayload = (): Record<string, unknown> => ({
  id: 'OBJ1',
  referenceId: '1726',
  status: { id: 'ForSale', name: 'Till salu' },
  office: { id: 'FIR1', customerId: 'M1' },
  primaryAgentId: 'U1',
  secondaryAgentId: null,
  projectId: null,
  address: {
    streetAddress: 'Nobelvägen 93B',
    zipCode: { numerical: 21433, value: '214 33' },
    postalTown: 'Malmö',
    area: { id: 'A1', name: 'Nobel' },
    municipality: 'Malmö',
    countryCode: 'SE',
    countyMunicipalityCode: '1280',
    wgs84Coordinate: { longitude: 13.02, latitude: 55.6 },
    directions: null,
  },
  sale: {
    shortDescription: 'Kort text',
    description: 'Lång text',
    phrase: null,
    heading: 'Rubrik',
    otherInformation: null,
    possessionEstimation: 'Enligt överenskommelse',
    possessionAt: null,
    contractDate: '2026-08-15T00:00:00',
    assignmentDate: '2026-06-01T09:00:00',
  },
  surroundings: { service: 'Nära', communication: null, area: 'Lugnt', parking: null, other: null },
  changedAt: '2026-08-31T11:46:09.65',
  files: [],
  viewings: [
    {
      id: 'VIS1',
      startsAt: '2026-09-21T17:15:00',
      endsAt: '2026-09-21T17:45:00',
      comment: 'Föranmälan krävs.',
      isDigital: false,
      isSelfRegistrationEnabled: true,
      isProjectViewing: false,
    },
  ],
  images: [
    {
      id: 'MED1',
      dataChangedAt: '2023-10-13T09:55:40.997',
      description: null,
      name: 'Kök',
      category: { id: 'Other', name: 'Interiör' },
      extension: 'jpg',
      cdnReferences: [],
    },
    {
      id: 'MED2',
      dataChangedAt: null,
      description: 'Plan 1',
      name: null,
      category: { id: 'Other', name: 'Planritning' },
      extension: 'png',
      cdnReferences: [],
    },
  ],
  links: [],
  type: { id: 'HousingCooperative', name: 'Bostadsrätt' },
  subtype: { id: 'Apartment', name: 'Lägenhet' },
  tenure: { id: 'TenantOwnership', name: 'Bostadsrätt' },
  tags: [{ type: { id: 'SaleMethod', name: 'Försäljningssätt' }, names: ['Öppna Marknaden'] }],
  buildings: [
    {
      name: null,
      type: null,
      numberOfRooms: 1.5,
      bedrooms: { count: 1, max: 2 },
      numberOfBathRooms: null,
      description: null,
      interior: 'Ljus lägenhet',
      otherInformation: null,
      yearBuilt: { numeric: 1936, text: '1936', description: null },
      ventilation: { type: 'Självdrag', inspection: null },
      architecture: [{ type: { id: 'Heating', name: 'Uppvärmning' }, description: 'Fjärrvärme' }],
      renovation: { description: 'Stambytt 2010' },
      elevator: { description: null, isAvailable: false },
      floor: { number: 3, total: 4, description: null },
      services: [{ type: { id: 'TvBroadband', name: 'Tv/bredband' }, description: 'Fiber' }],
      rooms: [{ name: 'Kök', description: 'Renoverat' }],
      energyDeclaration: {
        consumption: 92,
        class: 'F',
        status: { id: 'Performed', name: 'Utförd' },
        performedAt: '2019-11-12T00:00:00',
      },
      plot: { description: null },
      exterior: [],
      expenses: null,
      area: {
        grossFloor: null,
        living: 30.5,
        building: null,
        description: null,
        source: 'Uppmätt',
      },
      electricity: { company: null, distributor: null, consumption: null },
      compiledRoomList: null,
    },
  ],
  exterior: {
    buildingsDescription: null,
    buildingPermission: null,
    entries: [
      {
        type: { id: 'Balcony', name: 'Balkong' },
        isAvailable: true,
        size: 6,
        description: 'Söder',
      },
    ],
    plot: { size: null, description: null, type: null },
  },
  taxation: {
    isPreliminary: false,
    propertyDesignations: ['Malmö Nobel 1'],
    buildingValue: null,
    landValue: null,
    totalValue: null,
    taxFee: null,
    units: [],
  },
  fees: {
    recurring: {
      value: 1631,
      frequency: 'Monthly',
      type: 'Månadsavgift',
      description: 'inkl. kallvatten',
    },
    leasehold: null,
    lease: null,
  },
  price: {
    startingPrice: 995000,
    finalPrice: null,
    startingPriceInOtherCurrency: null,
    text: 'utgångspris',
  },
  electricity: { company: null, distributor: null, consumption: null },
  bidding: {
    isActive: true,
    isVerified: false,
    bids: [
      { placedAt: '2026-07-30T14:47:24', amount: 1060000, isCanceled: false, alias: '2' },
      { placedAt: '2026-07-30T14:20:18', amount: 1050000, isCanceled: true, alias: '1' },
    ],
  },
  marketing: {
    isPublished: true,
    isPreview: false,
    publishedAt: '2023-09-01T14:46:10',
    isNewHome: false,
    viewing: { visibleLimit: null, emptyText: null },
  },
  pledges: [],
  enrollments: { planRegulations: null, preferentialAndCommunity: null },
  extensions: {
    housingCooperative: {
      description: null,
      apartmentNumber: '1201',
      apartmentRegistrationNumber: null,
      association: { id: 'F1', overrideDescription: null, overrideEconomy: null },
      finances: {
        isPledged: false,
        indirectNetDebt: 250000,
        repairFundBalance: null,
        annualFeeShare: 1.2,
        indirectNetDebtComment: null,
        sharesComment: null,
        shares: 1.2,
      },
      includedLand: null,
    },
    condominium: null,
    foreignProperty: null,
    farm: null,
    commercialProperty: null,
    premises: null,
  },
  currency: 'SEK',
  inspection: { hasBeenPerformed: false },
  expenses: {
    operation: {
      sum: 4268,
      householdSize: 1,
      entries: [{ type: { id: 'Electricity', name: 'El' }, value: 4268 }],
      description: null,
    },
  },
});

describe('the Vitec property on the universal names', () => {
  const mapped = mappers.property!(estatePayload());
  const data = mapped.data as Data;

  it('lifts the spine and the change date', () => {
    expect(mapped.officeId).toBe('M1');
    expect(mapped.remoteUpdatedAt).toBe('2026-08-31T09:46:09.650Z');
    expect(data['id']).toBe('OBJ1');
    expect(data['office_id']).toBe('M1');
    expect(data['agent_ids']).toEqual(['U1']);
    expect(data['area_ids']).toEqual(['A1']);
    expect(data['association_id']).toBe('F1');
    expect(data['project_id']).toBeNull();
  });

  it('copies the enumerations, the texts and the marketing flags as sent', () => {
    expect(data['status']).toEqual({ id: 'ForSale', name: 'Till salu' });
    expect(data['tenure']).toEqual({ id: 'TenantOwnership', name: 'Bostadsrätt' });
    expect(data['reference_number']).toBe('1726');
    expect(data['heading']).toBe('Rubrik');
    expect(data['long_text']).toBe('Lång text');
    expect(data['possession_estimate']).toBe('Enligt överenskommelse');
    expect(data['sold_at']).toBe('2026-08-14T22:00:00.000Z');
    expect(data['is_new_build']).toBe(false);
    expect(data['published_at']).toBe('2023-09-01T12:46:10.000Z');
    expect(data['viewing_settings']).toEqual({ visible_limit: null, empty_text: null });
  });

  it('renames the address and the price', () => {
    expect(data['address']).toEqual({
      street: 'Nobelvägen 93B',
      postal_code: '214 33',
      city: 'Malmö',
      area_name: 'Nobel',
      area_id: 'A1',
      municipality: 'Malmö',
      country_code: 'SE',
      county_municipality_code: '1280',
      directions: null,
    });
    expect(data['lat']).toBe(55.6);
    expect(data['lng']).toBe(13.02);
    expect(data['price']).toBe(995000);
    expect(data['final_price']).toBeNull();
    expect(data['price_text']).toBe('utgångspris');
    expect(data['price_other_currency']).toBeNull();
    expect(data['currency']).toBe('SEK');
    expect(data['fee']).toEqual({
      amount: 1631,
      frequency: 'Monthly',
      type: 'Månadsavgift',
      comment: 'inkl. kallvatten',
    });
    expect(data['leasehold']).toBeNull();
  });

  it('puts the first building on the property and carries every building', () => {
    expect(data['rooms']).toBe(1.5);
    expect(data['bedrooms']).toBe(1);
    expect(data['bedrooms_max']).toBe(2);
    expect(data['living_space']).toBe(30.5);
    expect(data['additional_space']).toBeNull();
    expect(data['area_source']).toBe('Uppmätt');
    expect(data['floor']).toBe(3);
    expect(data['floors_total']).toBe(4);
    expect(data['elevator']).toBe(false);
    expect(data['year_built']).toBe(1936);
    expect(data['year_built_text']).toBe('1936');
    const building = (data['buildings'] as Data[])[0]!;
    expect(building['rooms']).toBe(1.5);
    expect(building['renovation']).toBe('Stambytt 2010');
    expect(building['architecture']).toEqual([
      { type: { id: 'Heating', name: 'Uppvärmning' }, description: 'Fjärrvärme' },
    ]);
    expect(building['room_list']).toEqual([{ name: 'Kök', description: 'Renoverat' }]);
    expect(at(building, 'energy_declaration.status')).toEqual({ id: 'Performed', name: 'Utförd' });
    expect(at(building, 'energy_declaration.performed_at')).toBe('2019-11-11T23:00:00.000Z');
    expect(data['exterior_features']).toEqual([
      {
        type: { id: 'Balcony', name: 'Balkong' },
        is_available: true,
        size: 6,
        description: 'Söder',
      },
    ]);
    expect(data['plot']).toEqual({ area: null, type: null, description: null });
    expect(data['operating_cost']).toBe(4268);
    expect(data['operating_costs']).toEqual([
      { type: { id: 'Electricity', name: 'El' }, value: 4268 },
    ]);
  });

  it('builds the CDN address of every image and keeps the category as a string', () => {
    expect(data['images']).toEqual([
      {
        id: 'MED1',
        url: 'https://cdn-realestate.kowboy.se/r2/M1/OBJ1/MED1_1920.jpg',
        category: 'Interiör',
        name: 'Kök',
        description: null,
        extension: 'jpg',
        changed_at: '2023-10-13T07:55:40.997Z',
        order: 1,
      },
      {
        id: 'MED2',
        url: 'https://cdn-realestate.kowboy.se/r2/M1/OBJ1/MED2_1920.png',
        category: 'Planritning',
        name: null,
        description: 'Plan 1',
        extension: 'png',
        changed_at: null,
        order: 2,
      },
    ]);
  });

  it('copies viewings and bids as sent, cancelled bids included', () => {
    expect(data['viewings']).toEqual([
      {
        id: 'VIS1',
        starts_at: '2026-09-21T15:15:00.000Z',
        ends_at: '2026-09-21T15:45:00.000Z',
        comment: 'Föranmälan krävs.',
        is_digital: false,
        self_registration: true,
        is_project_viewing: false,
      },
    ]);
    expect(data['bidding']).toEqual({
      is_active: true,
      is_verified: false,
      bids: [
        { placed_at: '2026-07-30T12:47:24.000Z', amount: 1060000, is_cancelled: false, alias: '2' },
        { placed_at: '2026-07-30T12:20:18.000Z', amount: 1050000, is_cancelled: true, alias: '1' },
      ],
    });
  });

  it('keeps the tail under its mechanical names and drops what was renamed', () => {
    expect(at(data, 'extensions.housing_cooperative.finances.shares')).toBe(1.2);
    expect(at(data, 'taxation.property_designations')).toEqual(['Malmö Nobel 1']);
    expect(data['surroundings']).toEqual({
      service: 'Nära',
      communication: null,
      area: 'Lugnt',
      parking: null,
      other: null,
    });
    expect(data['tags']).toEqual([
      { type: { id: 'SaleMethod', name: 'Försäljningssätt' }, names: ['Öppna Marknaden'] },
    ]);
    for (const gone of [
      'reference_id',
      'sale',
      'marketing',
      'fees',
      'exterior',
      'expenses',
      'changed_at',
      'primary_agent_id',
    ]) {
      expect(data).not.toHaveProperty(gone);
    }
    expect(data['display']).toEqual({});
    expect(data['provider_extras']).toEqual({});
    expect(`${N}`).toBe(' ');
  });
});

describe('the other Vitec datatypes on the universal names', () => {
  it('maps an agent with its offices, phones and portrait', () => {
    const data = mappers.agent!({
      id: 'U1',
      name: 'Anna Andersson',
      title: 'Fastighetsmäklare',
      category: null,
      emailAddress: 'anna@example.se',
      description: 'Om Anna',
      spokenLanguages: ['sv', 'en'],
      changedAt: '2026-01-09T11:56:22',
      telephone: { cell: { msisdn: '+46701234567', display: '070-123 45 67' }, public: null },
      image: {
        id: 'MED9',
        dataChangedAt: '2026-02-18T11:44:11.68',
        description: null,
        name: 'Anna',
        category: { id: 'Other', name: 'Porträtt' },
        extension: 'png',
        cdnReferences: [],
      },
      isVisibleInStaffList: true,
      offices: [
        {
          id: 'FIR1',
          customerId: 'M1',
          orderNumber: 3,
          isVisibleInStaffList: true,
          telephone: { personal: null },
        },
      ],
      reviews: [{ text: 'Toppen', authorName: 'Kund' }],
    }).data as Data;
    expect(data['office_ids']).toEqual(['M1']);
    expect(data['email']).toBe('anna@example.se');
    expect(data['languages']).toEqual(['sv', 'en']);
    expect(data['phones']).toEqual({
      mobile: { number: '+46701234567', display: '070-123 45 67' },
      public: null,
    });
    expect(at(data, 'image.url')).toBe('https://cdn-realestate.kowboy.se/r2/M1/U1/MED9_1920.png');
    expect(data['offices']).toEqual([
      { office_id: 'M1', order: 3, is_visible_in_staff_list: true, phone: null },
    ]);
    expect(data['reviews']).toEqual([{ text: 'Toppen', author: 'Kund' }]);
    expect(data).not.toHaveProperty('email_address');
  });

  it('maps an office under its customer id', () => {
    const mapped = mappers.office!({
      id: 'FIR1',
      customerId: 'M1',
      changedAt: '2026-03-29T03:00:15.927',
      brandId: null,
      name: 'Kontoret',
      streetAddress: 'Grimsbygatan 24A',
      zipCode: { numerical: 21120, value: '211 20' },
      postalTown: 'Malmö',
      telephone: { switch: { msisdn: '+4640123456', display: '040-12 34 56' } },
      emailAddress: 'info@example.se',
      seat: null,
      description: null,
      coordinate: { longitude: 12.99, latitude: 55.61 },
    });
    expect(mapped.officeId).toBe('M1');
    expect(mapped.data).toMatchObject({
      id: 'M1',
      name: 'Kontoret',
      address: { street: 'Grimsbygatan 24A', postal_code: '211 20', city: 'Malmö' },
      phone: { number: '+4640123456', display: '040-12 34 56' },
      email: 'info@example.se',
      lat: 55.61,
      lng: 12.99,
    });
  });

  it('maps an area with its polygon, and an association with its contact', () => {
    const area = mappers.area!({
      id: 'A1',
      name: 'Nobel',
      countyMunicipalityCode: '1280',
      coordinates: [
        [
          [
            [13.0, 55.6],
            [13.1, 55.6],
            [13.1, 55.7],
            [13.0, 55.6],
          ],
        ],
      ],
      office: { id: 'FIR1', customerId: 'M1' },
      surroundings: {
        service: null,
        communication: null,
        area: 'Centralt',
        parking: null,
        other: null,
      },
      images: [],
      changedAt: '2026-05-01T08:00:00',
    }).data as Data;
    expect(area['polygon']).toEqual([
      [
        [
          [13.0, 55.6],
          [13.1, 55.6],
          [13.1, 55.7],
          [13.0, 55.6],
        ],
      ],
    ]);
    expect(area['office_id']).toBe('M1');
    expect(area['images']).toEqual([]);
    expect(area).not.toHaveProperty('coordinates');

    const association = mappers.association!({
      id: 'F1',
      name: 'Brf Solen',
      corporateNumber: '769600-0000',
      organizationalForm: 'TenantOwnedAssociation',
      email: null,
      homePage: null,
      genuineAssociation: 'Undetermined',
      numberOfApartments: 40,
      numberOfRentalApartments: null,
      numberOfPremises: null,
      descriptions: { generalAboutAssociation: 'Bra förening' },
      economy: { transferFee: 1200, transferFeePaidBy: 'Buyer', allowLegalPersonAsBuyer: 'Maybe' },
      documents: [
        {
          id: '_F_1',
          name: 'Stadgar',
          extension: '.pdf',
          category: null,
          url: 'https://connect.maklare.vitec.net/File/GetFile?customerId=M1&fileId=_F_1',
          dateChangedData: '2024-05-16T11:00:28',
        },
      ],
      publicContact: {
        name: 'Ordförande',
        cellPhone: null,
        otherPhone: null,
        email: 'ordf@example.se',
      },
      changedAt: '2024-04-23T16:16:07',
    }).data as Data;
    expect(association['corporate_number']).toBe('769600-0000');
    expect(association['number_of_apartments']).toBe(40);
    expect(at(association, 'descriptions.general_about_association')).toBe('Bra förening');
    expect(association['contact']).toEqual({
      name: 'Ordförande',
      mobile: null,
      phone: null,
      email: 'ordf@example.se',
    });
    expect(association).not.toHaveProperty('public_contact');
    // Question 93: the codes keep their id and gain Vitec's documented name; an unknown code has none.
    expect(association['genuine_association']).toEqual({ id: 'Undetermined', name: 'Ej angivet' });
    expect(at(association, 'economy.transfer_fee_paid_by')).toEqual({
      id: 'Buyer',
      name: 'Köpare',
    });
    expect(at(association, 'economy.allow_legal_person_as_buyer')).toEqual({
      id: 'Maybe',
      name: null,
    });
    expect(at(association, 'economy.transfer_fee')).toBe(1200);
    // Question 94: documents of one shape, addressed on the CDN under the customer Connect's address names.
    expect(association['documents']).toEqual([
      {
        id: '_F_1',
        name: 'Stadgar',
        extension: '.pdf',
        category: null,
        url: 'https://cdn-realestate.kowboy.se/v310/vitec/files/M1/F1/_F_1.pdf',
        changed_at: '2024-05-16T09:00:28.000Z',
      },
    ]);
  });

  it('maps a project with its ranges and texts', () => {
    const data = mappers.project!({
      id: 'PR1',
      name: 'Hemmestorps Fure',
      status: { id: 'Running', name: 'Pågående' },
      office: { id: 'FIR1', customerId: 'M1' },
      primaryAgentId: 'U1',
      secondaryAgentId: 'U2',
      address: {
        streetAddress: null,
        zipCode: null,
        postalTown: 'Veberöd',
        area: { id: 'A1', name: 'Fure' },
        municipality: 'Lund',
        countryCode: 'SE',
        wgs84Coordinate: null,
      },
      sale: {
        shortDescription: 'Kort',
        description: null,
        phrase: null,
        heading: null,
        otherInformation: null,
        startsAt: '2026-10-01T00:00:00',
        possessionEstimation: 'Q4 2027',
      },
      estates: {
        price: { minValue: 2000000, maxValue: 5000000 },
        monthlyFee: null,
        livingSpace: { minValue: 62, maxValue: 118 },
        numberOfRooms: { minValue: 2, maxValue: 4 },
        plot: null,
      },
      producer: { name: 'Skånska Fastigheter' },
      currency: 'SEK',
      images: [],
      viewings: [],
      marketing: {
        isPublished: true,
        isPreview: false,
        publishedAt: null,
        isNewHome: true,
        viewing: { visibleLimit: null, emptyText: null },
      },
      changedAt: '2026-05-01T08:00:00',
    }).data as Data;
    expect(data['agent_ids']).toEqual(['U1', 'U2']);
    expect(data['status']).toEqual({ id: 'Running', name: 'Pågående' });
    expect(data['price_range']).toEqual({ min: 2000000, max: 5000000 });
    expect(data['fee_range']).toBeNull();
    expect(data['living_space_range']).toEqual({ min: 62, max: 118 });
    expect(data['producer']).toBe('Skånska Fastigheter');
    expect(data['sale_starts_at']).toBe('2026-09-30T22:00:00.000Z');
    expect(data['possession_estimate']).toBe('Q4 2027');
    expect(data['is_new_build']).toBe(true);
    expect(data).not.toHaveProperty('estates');
  });
});
