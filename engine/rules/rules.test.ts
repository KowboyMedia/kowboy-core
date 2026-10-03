// The display strings, one test per ledger entry (rules-ledger/), over universal records.
import { describe, expect, it } from 'vitest';
import { applyRules } from './run.js';
import { formatNumber, money, NBSP, range, withUnit } from './format.js';
import { renderSections, PROPERTY_SECTIONS } from './sections.js';

const N = NBSP;

const home = (): Record<string, unknown> => ({
  id: 'OBJ1',
  office_id: 'M1',
  agent_ids: [],
  area_ids: [],
  association_id: null,
  project_id: null,
  currency: 'SEK',
  price: 4950000,
  final_price: null,
  price_text: 'Utgångspris',
  price_other_currency: null,
  address: {
    street: 'Storgatan 1',
    postal_code: '111 22',
    city: 'Stockholm',
    area_name: 'Vasastan',
    municipality: 'Stockholm',
  },
  living_space: 82,
  additional_space: 12,
  rooms: 3,
  bedrooms: 2,
  bedrooms_max: 3,
  floor: 3,
  floors_total: 5,
  elevator: true,
  elevator_description: null,
  year_built_text: '1936',
  year_built: 1936,
  year_built_description: null,
  fee: { amount: 3500, frequency: 'Monthly', type: 'Månadsavgift', comment: 'inkl. värme' },
  operating_cost: 28500,
  leasehold: { fee: 6646, term: '2029-12-30T23:00:00.000Z' },
  bidding: {
    is_active: true,
    is_verified: false,
    bids: [
      { placed_at: '2026-07-30T12:47:24.000Z', amount: 1100000, is_cancelled: true, alias: '3' },
      { placed_at: '2026-07-30T12:47:24.000Z', amount: 1060000, is_cancelled: false, alias: '2' },
      { placed_at: '2026-07-30T12:20:18.000Z', amount: 1050000, is_cancelled: false, alias: '1' },
    ],
  },
  buildings: [
    {
      energy_declaration: {
        consumption: 92,
        class: 'C',
        status: { id: 'Performed', name: 'Utförd' },
        performed_at: '2021-02-25T23:00:00.000Z',
      },
      architecture: [{ type: { id: 'Heating', name: 'Uppvärmning' }, description: 'Fjärrvärme' }],
      room_list: [{ name: 'Kök', description: 'Renoverat 2020' }],
    },
  ],
  exterior_features: [
    { type: { id: 'Balcony', name: 'Balkong' }, is_available: true, size: 8, description: 'Söder' },
    { type: { id: 'Pool', name: 'Pool' }, is_available: false, size: null, description: null },
  ],
  display: {},
  provider_extras: {},
});

describe('R-001 money and numbers', () => {
  it('groups thousands with a hard space, writes decimals with a comma', () => {
    expect(formatNumber(4950000)).toBe(`4${N}950${N}000`);
    expect(formatNumber(45.5)).toBe('45,5');
    expect(formatNumber(1.005)).toBe('1,01');
    expect(money(4950000, 'SEK')).toBe(`4${N}950${N}000${N}kr`);
    expect(money(400000, 'EUR')).toBe(`400${N}000${N}EUR`);
    expect(money(0, 'SEK')).toBeNull();
    expect(money(null, 'SEK')).toBeNull();
  });
});

describe('the property strings (R-001 to R-012)', () => {
  const display = applyRules('property', home())['display'] as Record<string, unknown>;

  it('prices', () => {
    expect(display['price']).toBe(`4${N}950${N}000${N}kr`);
    expect(display).not.toHaveProperty('final_price');
    expect(display).not.toHaveProperty('price_other_currency');
  });

  it('areas (R-002)', () => {
    expect(display['living_space']).toBe(`82${N}kvm`);
    expect(display['additional_space']).toBe(`12${N}kvm`);
    expect(display['area']).toBe(`82${N}kvm + 12${N}kvm biarea`);
    expect(withUnit(12, 'kvm')).toBe(`12${N}kvm`);
    const onlyExtra = applyRules('property', { ...home(), living_space: null })[
      'display'
    ] as Record<string, unknown>;
    expect(onlyExtra['area']).toBe(`12${N}kvm biarea`);
  });

  it('rooms and bedrooms (R-003)', () => {
    expect(display['rooms']).toBe(`3${N}rum`);
    expect(display['bedrooms']).toBe(`2 – 3${N}sovrum`);
    expect(display['rooms_and_bedrooms']).toBe(`3${N}rum, varav 2 – 3${N}sovrum`);
  });

  it('fee (R-004)', () => {
    expect(display['fee']).toBe(`3${N}500${N}kr/mån`);
    expect(display['fee_comment']).toBe('inkl. värme');
  });

  it('floor and elevator (R-005, R-006)', () => {
    expect(display['floor']).toBe('3 av 5');
    expect(display['elevator']).toBe('Ja');
    const ground = applyRules('property', {
      ...home(),
      floor: 0,
      floors_total: null,
      elevator: false,
      elevator_description: 'Ingen hiss',
    })['display'] as Record<string, unknown>;
    expect(ground['floor']).toBe('0');
    expect(ground['elevator']).toBe('Nej, Ingen hiss');
  });

  it('year built (R-007)', () => {
    expect(display['year_built']).toBe('1936');
    const numeric = applyRules('property', {
      ...home(),
      year_built_text: null,
      year_built: 1965,
      year_built_description: 'enligt taxering',
    })['display'] as Record<string, unknown>;
    expect(numeric['year_built']).toBe('1965, enligt taxering');
  });

  it('highest bid leaves cancelled bids out (R-008)', () => {
    expect(display['highest_bid']).toBe(`1${N}060${N}000${N}kr`);
  });

  it('operating cost, leasehold, energy declaration, address (R-009 to R-012)', () => {
    expect(display['operating_cost']).toBe(`28${N}500${N}kr/år`);
    expect(display['leasehold']).toBe(`6${N}646${N}kr/år (löper till 2029-12-31)`);
    expect(display['energy_declaration']).toBe('Utförd 2021-02-26');
    expect(display['energy_class']).toBe('C');
    expect(display['address_line']).toBe('Storgatan 1, 111 22 Stockholm');
    expect(display['location']).toBe('Vasastan');
  });

  it('validated for the default set (R-015 to R-018, question 90): price wording, fee amount, floor with elevator, exterior features', () => {
    expect(display['price_text']).toBe('Utgångspris');
    expect(display['fee_amount']).toBe(`3${N}500${N}kr`);
    expect(display['floor_and_elevator']).toBe('3 av 5, hiss finns');
    expect(display['exterior_features']).toBe('Balkong finns');
    const plain = applyRules('property', {
      ...home(),
      price_text: 'utgångspris',
      elevator: false,
      exterior_features: [{ type: { id: 'Pool', name: 'Pool' }, is_available: false }],
    })['display'] as Record<string, unknown>;
    expect(plain['price_text']).toBe('Utgångspris');
    expect(plain['floor_and_elevator']).toBe('3 av 5');
    expect(plain).not.toHaveProperty('exterior_features');
    const noFloor = applyRules('property', { ...home(), floor: null, floors_total: null })[
      'display'
    ] as Record<string, unknown>;
    expect(noFloor).not.toHaveProperty('floor_and_elevator');
  });

  it('never invents a string: an empty record shows nothing but its sections', () => {
    const empty = applyRules('property', { id: 'X', display: {}, provider_extras: {} });
    expect(empty['display']).toEqual({ sections: [] });
  });
});

describe('R-013 sections', () => {
  it('renders rows from the definition and drops empty rows and sections', () => {
    const data = applyRules('property', home());
    const sections = data['display'] as {
      sections: { header: string; items: { label: string; value: string }[] }[];
    };
    const byHeader = Object.fromEntries(sections.sections.map((s) => [s.header, s.items]));
    expect(byHeader['Grundinformation']).toEqual([
      { label: 'Adress', value: 'Storgatan 1 111 22 Stockholm' },
      { label: 'Område', value: 'Vasastan' },
    ]);
    expect(byHeader['Interiör']).toEqual([
      { label: 'Boarea', value: `82${N}kvm` },
      { label: 'Antal rum', value: '3' },
      { label: 'Biarea', value: `12${N}kvm` },
      { label: 'Kök', value: 'Renoverat 2020' },
    ]);
    expect(byHeader['Byggnad']).toEqual([
      { label: 'Byggår', value: '1936' },
      { label: 'Uppvärmning', value: 'Fjärrvärme' },
    ]);
    expect(byHeader['Energideklaration']).toEqual([
      { label: 'Energideklaration', value: 'Utförd 2021-02-26' },
      { label: 'Energiprestanda primärenergital', value: `92${N}kWh per kvm och år` },
      { label: 'Energiklass', value: 'C' },
    ]);
    expect(byHeader['Andelstal, avgifter och insats']).toEqual([
      { label: 'Månadsavgift', value: `3${N}500${N}kr` },
      { label: 'Kommentar till månadsavgift', value: 'inkl. värme' },
      { label: 'Tomträttsavgäld', value: `6${N}646${N}kr/år (löper till 2029-12-31)` },
    ]);
    expect(byHeader['Våning/hiss']).toEqual([{ label: 'Våning', value: '3 av 5, hiss finns' }]);
    expect(byHeader['Driftskostnader']).toEqual([
      { label: 'Summa per år', value: `28${N}500${N}kr/år` },
    ]);
    expect(byHeader).not.toHaveProperty('Balkong, uteplats och parkering');
    expect(byHeader).not.toHaveProperty('Gård');
    expect(byHeader).not.toHaveProperty('Taxering');
    expect(renderSections({}, PROPERTY_SECTIONS)).toEqual([]);
  });
});

describe('R-014 project ranges', () => {
  it('writes a span, a single value, or one bound', () => {
    const kr = (amount: number): string | null => money(amount, 'SEK');
    expect(range({ min: 2000000, max: 5000000 }, kr)).toBe(
      `2${N}000${N}000 – 5${N}000${N}000${N}kr`,
    );
    expect(range({ min: 3, max: 3 }, (v) => withUnit(v, 'rum'))).toBe(`3${N}rum`);
    expect(range({ min: 62, max: null }, (v) => withUnit(v, 'kvm'))).toBe(`från 62${N}kvm`);
    expect(range({ min: null, max: 118 }, (v) => withUnit(v, 'kvm'))).toBe(`upp till 118${N}kvm`);
    expect(range(null, kr)).toBeNull();
    const display = applyRules('project', {
      id: 'PR1',
      currency: 'SEK',
      price_range: { min: 2000000, max: 5000000 },
      fee_range: { min: 2000, max: 3000 },
      rooms_range: { min: 2, max: 4 },
      display: {},
      provider_extras: {},
    })['display'] as Record<string, unknown>;
    expect(display['fee_range']).toBe(`2${N}000 – 3${N}000${N}kr/mån`);
    expect(display['rooms_range']).toBe(`2 – 4${N}rum`);
  });
});

describe('R-019 association fees (validated 2026-10-03, question 90)', () => {
  it('writes the transfer fee and the pledge fee in kr, and nothing when they are missing', () => {
    const display = applyRules('association', {
      id: 'BRF-1',
      name: 'Brf Solen',
      economy: { transfer_fee: 1480, pledge_fee: 592 },
      display: {},
      provider_extras: {},
    })['display'] as Record<string, unknown>;
    expect(display['transfer_fee']).toBe(`1${N}480${N}kr`);
    expect(display['pledge_fee']).toBe(`592${N}kr`);
    const bare = applyRules('association', { id: 'BRF-2', display: {}, provider_extras: {} })[
      'display'
    ] as Record<string, unknown>;
    expect(bare).toEqual({});
  });
});
