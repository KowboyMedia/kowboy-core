// The display strings per datatype (docs/field-tables.md, "display"), each by its ledger entry.
// Formatting only: a string is there when its inputs are, and the engine decides nothing from a
// value (AGENTS.md, "Core applies no logic to CRM data").
import { date, join, money, range, text, withUnit, yesNo } from './format.js';
import { read, type Data } from './path.js';

type Display = Record<string, string>;

const put = (display: Display, key: string, value: string | null): void => {
  if (value !== null) display[key] = value;
};

const currency = (data: Data): string | null =>
  typeof data['currency'] === 'string' ? data['currency'] : null;

/** R-002: `82 kvm + 12 kvm biarea`, `82 kvm`, or `12 kvm biarea`. */
const area = (living: unknown, additional: unknown): string | null => {
  const main = withUnit(living, 'kvm');
  const extra = withUnit(additional, 'kvm');
  if (main && extra) return `${main} + ${extra} biarea`;
  if (extra) return `${extra} biarea`;
  return main;
};

/** R-003: `3 rum`, `2 – 3 sovrum`, `3 rum, varav 2 sovrum`. */
const rooms = (display: Display, data: Data): void => {
  const roomCount = withUnit(data['rooms'], 'rum');
  const count = data['bedrooms'];
  const max = data['bedrooms_max'];
  const bedrooms =
    typeof count === 'number' && count > 0
      ? typeof max === 'number' && max > count
        ? `${count} – ${withUnit(max, 'sovrum')}`
        : withUnit(count, 'sovrum')
      : null;
  put(display, 'rooms', roomCount);
  put(display, 'bedrooms', bedrooms);
  put(
    display,
    'rooms_and_bedrooms',
    roomCount && bedrooms ? `${roomCount}, varav ${bedrooms}` : roomCount,
  );
};

/** R-004: `3 500 kr/mån`, `42 000 kr/år`, `3 500 kr` when the CRM names no frequency. */
const fee = (display: Display, data: Data): void => {
  const given = read(data, 'fee') as Data | null;
  if (!given) return;
  const amount = money(given['amount'], currency(data));
  const frequency = String(given['frequency'] ?? '').toLowerCase();
  const suffix = frequency === 'monthly' ? '/mån' : frequency === 'yearly' ? '/år' : '';
  put(display, 'fee', amount ? `${amount}${suffix}` : null);
  put(display, 'fee_amount', amount);
  put(display, 'fee_comment', text(given['comment']));
};

/** R-008: the highest bid that stands, cancelled bids left out. */
const highestBid = (data: Data): string | null => {
  const bids = read(data, 'bidding.bids');
  if (!Array.isArray(bids)) return null;
  const standing = bids
    .filter((bid) => (bid as Data)['is_cancelled'] !== true)
    .map((bid) => (bid as Data)['amount'])
    .filter((amount): amount is number => typeof amount === 'number' && amount > 0);
  return standing.length ? money(Math.max(...standing), currency(data)) : null;
};

/** R-010: `6 646 kr/år (löper till 2029-12-31)`. */
const yearlyWithTerm = (value: unknown, code: string | null): string | null => {
  const given = value as Data | null;
  if (!given) return null;
  const amount = money(given['fee'], code);
  if (!amount) return null;
  const term = date(given['term']);
  return term ? `${amount}/år (löper till ${term})` : `${amount}/år`;
};

/** R-011: `Utförd 2021-02-26`, and the class on its own. */
const energyDeclaration = (display: Display, data: Data): void => {
  const declaration = read(data, 'buildings[0].energy_declaration') as Data | null;
  if (!declaration) return;
  put(
    display,
    'energy_declaration',
    join([text(read(declaration, 'status.name')), date(declaration['performed_at'])], ' '),
  );
  put(display, 'energy_class', text(declaration['class']));
};

/** R-015 (drafted): the office's price wording with its first letter in upper case. */
const priceText = (value: unknown): string | null => {
  const given = text(value);
  return given ? given.charAt(0).toLocaleUpperCase('sv-SE') + given.slice(1) : null;
};

/** R-017 (drafted): `2 av 4, hiss finns`; the floor alone unless the elevator is there. */
const floorAndElevator = (floor: string | null, elevator: unknown): string | null =>
  floor ? (elevator === true ? `${floor}, hiss finns` : floor) : null;

/** R-018 (drafted): `Balkong finns, Uteplats finns`, the available features in the CRM's order. */
const exteriorFeatures = (value: unknown): string | null => {
  if (!Array.isArray(value)) return null;
  const available = value
    .filter((entry) => (entry as Data)['is_available'] === true)
    .map((entry) => text(read(entry, 'type.name')))
    .filter((name): name is string => name !== null)
    .map((name) => `${name} finns`);
  return join(available, ', ');
};

/** R-012: `Völundsgatan 3, 113 21 Stockholm` and the place a card names. */
const addressLine = (data: Data): string | null => {
  const address = read(data, 'address') as Data | null;
  if (!address) return null;
  const town = join([text(address['postal_code']), text(address['city'])], ' ');
  return join([text(address['street']), town], ', ');
};

const location = (data: Data): string | null =>
  text(read(data, 'address.area_name')) ??
  text(read(data, 'address.city')) ??
  text(read(data, 'address.municipality'));

export function propertyStrings(data: Data): Display {
  const display: Display = {};
  const code = currency(data);
  put(display, 'price', money(data['price'], code));
  put(display, 'final_price', money(data['final_price'], code));
  put(display, 'price_text', priceText(data['price_text']));
  put(
    display,
    'price_other_currency',
    money(
      read(data, 'price_other_currency.amount'),
      text(read(data, 'price_other_currency.currency')),
    ),
  );
  put(display, 'living_space', withUnit(data['living_space'], 'kvm'));
  put(display, 'additional_space', withUnit(data['additional_space'], 'kvm'));
  put(display, 'building_area', withUnit(data['building_area'], 'kvm'));
  put(display, 'area', area(data['living_space'], data['additional_space']));
  put(display, 'plot_area', withUnit(read(data, 'plot.area'), 'kvm'));
  rooms(display, data);
  fee(display, data);
  const floor = join([floorNumber(data['floor']), floorTotal(data['floors_total'])], ' av ');
  put(display, 'floor', floor);
  put(display, 'floor_and_elevator', floorAndElevator(floor, data['elevator']));
  put(
    display,
    'elevator',
    join([yesNo(data['elevator']), text(data['elevator_description'])], ', '),
  );
  put(
    display,
    'year_built',
    join(
      [
        text(data['year_built_text']) ?? yearNumber(data['year_built']),
        text(data['year_built_description']),
      ],
      ', ',
    ),
  );
  put(display, 'highest_bid', highestBid(data));
  put(
    display,
    'operating_cost',
    money(data['operating_cost'], code) && `${money(data['operating_cost'], code)}/år`,
  );
  put(display, 'lease', yearlyWithTerm(data['lease'], code));
  put(display, 'leasehold', yearlyWithTerm(data['leasehold'], code));
  energyDeclaration(display, data);
  put(display, 'exterior_features', exteriorFeatures(data['exterior_features']));
  put(display, 'address_line', addressLine(data));
  put(display, 'location', location(data));
  return display;
}

const floorNumber = (value: unknown): string | null =>
  typeof value === 'number' ? String(value) : null;
const floorTotal = (value: unknown): string | null =>
  typeof value === 'number' && value > 0 ? String(value) : null;
const yearNumber = (value: unknown): string | null =>
  typeof value === 'number' && value > 0 ? String(value) : null;

/** R-014: the ranges a project states over its homes. */
export function projectStrings(data: Data): Display {
  const display: Display = {};
  const code = currency(data);
  put(
    display,
    'price_range',
    range(data['price_range'], (amount) => money(amount, code)),
  );
  put(
    display,
    'fee_range',
    range(data['fee_range'], (amount) => `${money(amount, code)}/mån`),
  );
  put(
    display,
    'living_space_range',
    range(data['living_space_range'], (value) => withUnit(value, 'kvm')),
  );
  put(
    display,
    'rooms_range',
    range(data['rooms_range'], (value) => withUnit(value, 'rum')),
  );
  put(
    display,
    'plot_range',
    range(data['plot_range'], (value) => withUnit(value, 'kvm')),
  );
  put(display, 'address_line', addressLine(data));
  put(display, 'location', location(data));
  return display;
}

export function officeStrings(data: Data): Display {
  const display: Display = {};
  put(display, 'address_line', addressLine(data));
  return display;
}

/** R-019 (drafted): an association's transfer fee and pledge fee, in kr. */
export function associationStrings(data: Data): Display {
  const display: Display = {};
  put(display, 'transfer_fee', money(read(data, 'economy.transfer_fee'), null));
  put(display, 'pledge_fee', money(read(data, 'economy.pledge_fee'), null));
  return display;
}
