// The records of the template suite and the browser journeys, as the fake polling CRM holds
// them: one office, four agents (two kept out of the staff list), two associations, two areas
// with outlines, and six homes (three for sale or coming, two sold, one in a project) placed so
// the outlines, the LKF codes and the agents give every search a known answer.
import * as crm from '../../../adapters/fake-polling/crm.js';

export const soon = (hours: number): string =>
  new Date(Date.now() + hours * 3_600_000).toISOString();

/** A listing as the fake polling CRM holds it: enough for a card and a page. */
export const listing = (id: string, extra: Record<string, unknown>): Record<string, unknown> => ({
  object_id: id,
  stage: 'active',
  stage_label: 'Till salu',
  object_type: 'flat',
  street: `Kungsgatan ${id.replace(/\D/g, '')}`,
  postal_code: '111 22',
  city: 'Stockholm',
  district_name: 'Vasastan',
  districts: ['D-1'],
  price: 7_250_000,
  fee: 4_100,
  living_space: 82,
  rooms: 3,
  tenure: 'Bostadsrätt',
  price_text: 'utgångspris',
  blurb: 'Ljus trea med balkong.',
  branch_id: 'B-1',
  staff: ['S-1'],
  coop_id: null,
  lkf: '0180',
  images: [`https://img.test/${id}-1_1920.jpg`, `https://img.test/${id}-2_1920.jpg`],
  published_at: '2026-09-01T08:00:00.000Z',
  ...extra,
});

/** Outlines as the fake CRM draws them (GeoJSON MultiPolygon coordinates, longitude first), and P-1 as first put. */
export const VASASTAN = [
  [
    [
      [18.0, 59.3],
      [18.1, 59.3],
      [18.1, 59.4],
      [18.0, 59.4],
      [18.0, 59.3],
    ],
    [
      [18.04, 59.33],
      [18.06, 59.33],
      [18.06, 59.35],
      [18.04, 59.35],
      [18.04, 59.33],
    ],
  ],
];
export const NORRMALM = [
  [
    [
      [18.08, 59.38],
      [18.2, 59.38],
      [18.2, 59.45],
      [18.08, 59.45],
      [18.08, 59.38],
    ],
  ],
];
/** The office's labels as the fake CRM holds them: a kind, its label, the words. */
export const UNDERHAND = {
  kind: 'sale_method',
  kind_label: 'Försäljningssätt',
  values: ['Underhand'],
};
export const OPEN_MARKET = {
  kind: 'sale_method',
  kind_label: 'Försäljningssätt',
  values: ['Öppna marknaden'],
};
export const NEAR_WATER = {
  kind: 'feature',
  kind_label: 'Utökade sökbegrepp',
  values: ['Nära vatten'],
};
export const P1 = {
  price: 7_250_000,
  rooms: 3,
  living_space: 82,
  lat: 59.31,
  lng: 18.01,
  labels: [UNDERHAND],
};

/** Put every record into the CRM; `poll()` and a sync bring them to the site. */
export function fillTheCrm(): void {
  crm.put('office', 'B-1', {
    branch_id: 'B-1',
    branch_name: 'Kowboy Mäkleri',
    email: 'hello@kowboy.test',
    street: 'Storgatan 1',
    city: 'Stockholm',
    lat: 59.33,
    lng: 18.06,
  });
  crm.put('agent', 'S-1', {
    staff_id: 'S-1',
    branch_id: 'B-1',
    full_name: 'Anna Andersson',
    title: 'Fastighetsmäklare',
    email: 'anna@kowboy.test',
    mobile: '070-123 45 67',
    photo: 'https://img.test/anna.jpg',
    bio: 'Anna har sålt bostäder sedan 2011.',
    reviews: [{ text: 'Mycket nöjd.', author: 'Säljare på Kungsgatan 1' }],
    order: 2,
  });
  crm.put('agent', 'S-2', {
    staff_id: 'S-2',
    branch_id: 'B-1',
    full_name: 'Bertil Berg',
    title: 'Mäklarassistent',
    order: 1,
  });
  // Two agents the CRM keeps out of the staff list, one by the record's toggle and one by the office's.
  crm.put('agent', 'S-3', {
    staff_id: 'S-3',
    branch_id: 'B-1',
    full_name: 'Cecilia Dold',
    title: 'Säljkoordinator',
    order: 3,
    visible: false,
  });
  crm.put('agent', 'S-4', {
    staff_id: 'S-4',
    branch_id: 'B-1',
    full_name: 'David Dold',
    title: 'Fastighetsmäklare',
    order: 4,
    visible: true,
    office_visible: false,
  });
  crm.put('association', 'A-1', {
    coop_id: 'A-1',
    coop_name: 'Brf Solgården',
    form: 'Bostadsrättsförening',
    corporate_number: '769600-1234',
    home_page: 'https://brfsolgarden.test/',
    apartments: 48,
    contact: {
      name: 'Styrelsen',
      phone: '08-123 45 67',
      mobile: null,
      email: 'info@brfsolgarden.test',
    },
    descriptions: { general_about_association: 'En trevlig förening.' },
    economy: { finances: 'God ekonomi.' },
    documents: [{ name: 'Stadgar', url: 'https://docs.test/stadgar.pdf' }],
  });
  crm.put('association', 'A-2', { coop_id: 'A-2', coop_name: 'Brf Månen' });
  crm.put('area', 'D-1', {
    district_id: 'D-1',
    district_name: 'Vasastan',
    branch_id: 'B-1',
    lkf: '018001',
    outline: VASASTAN,
  });
  crm.put('area', 'D-2', {
    district_id: 'D-2',
    district_name: 'Norrmalm',
    branch_id: 'B-1',
    lkf: '0180',
    outline: NORRMALM,
  });
  // P-1's point lies in Vasastan's outline, P-2's in Vasastan's and Norrmalm's, P-3's in the hole
  // cut out of Vasastan's; the CRM names Vasastan on every home (docs/search.md, question 133 a).
  crm.put('property', 'P-1', listing('P-1', P1));
  crm.put(
    'property',
    'P-2',
    listing('P-2', {
      price: 3_100_000,
      rooms: 1.5,
      living_space: 41,
      staff: ['S-2'],
      district_name: 'Södermalm',
      city: 'Stockholm',
      lat: 59.39,
      lng: 18.09,
      labels: [OPEN_MARKET, NEAR_WATER],
      published_at: '2026-09-10T08:00:00.000Z',
    }),
  );
  crm.put(
    'property',
    'P-3',
    listing('P-3', {
      stage: 'pre',
      stage_label: 'Kommande',
      coop_id: 'A-1',
      price: 5_000_000,
      rooms: 4,
      living_space: 110,
      viewings: [
        { starts_at: soon(48), ends_at: soon(49), comment: 'Föranmälan krävs', bookable: true },
        { starts_at: soon(-30), ends_at: soon(-29), comment: 'Visningen som var' },
      ],
      images: [
        'https://img.test/P-3-1_1920.jpg',
        'https://img.test/P-3-2_1920.jpg',
        { url: 'https://img.test/P-3-plan_1920.jpg', category: 'Planritning' },
        {
          url: 'https://img.test/P-3-plan2_1920.jpg',
          category: 'Planritning',
          description: 'Plan 2',
        },
      ],
      documents: [{ name: 'Årsredovisning 2025', url: 'https://docs.test/arsredovisning.pdf' }],
      links: [
        { name: 'Föreningens hemsida', url: 'https://brf.test/' },
        { name: 'Hemsidan igen', url: 'https://brf.test/' },
        { name: 'Energideklaration', url: 'https://docs.test/energi.pdf' },
      ],
      bidding_active: true,
      bids: [
        {
          placed_at: '2026-09-20T10:00:00.000Z',
          amount: 5_050_000,
          is_cancelled: false,
          alias: 'Budgivare 1',
        },
        {
          placed_at: '2026-09-21T10:00:00.000Z',
          amount: 5_100_000,
          is_cancelled: false,
          alias: 'Budgivare 2',
        },
        {
          placed_at: '2026-09-22T10:00:00.000Z',
          amount: 5_300_000,
          is_cancelled: true,
          alias: 'Budgivare 1',
        },
      ],
      heading: 'Högst upp med balkong i söderläge',
      staff: ['S-1', 'S-2'],
      lat: 59.34,
      lng: 18.05,
      lkf: '0163',
      published_at: '2026-09-12T08:00:00.000Z',
    }),
  );
  crm.put(
    'property',
    'P-4',
    listing('P-4', {
      stage: 'done',
      stage_label: 'Såld',
      price: 2_995_000,
      final_price: 3_325_000,
      sold_at: '2026-08-01T12:00:00.000Z',
      labels: [UNDERHAND],
    }),
  );
  crm.put(
    'property',
    'P-5',
    listing('P-5', {
      stage: 'done',
      stage_label: 'Såld',
      price: 4_000_000,
      final_price: 4_200_000,
      sold_at: '2026-08-15T12:00:00.000Z',
      staff: ['S-1', 'S-3', 'S-4'],
    }),
  );
  crm.put('property', 'P-6', listing('P-6', { project_id: 'PR-1', price: 9_000_000 }));
}
