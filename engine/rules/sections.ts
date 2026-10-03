// The fact tables of a property page, `display.sections` (rules-ledger/R-013 Sections): a list
// of sections, each a header and label/value rows, rendered from one definition over the
// universal names. Data-defined so a label or a row is a change to this file and a recompute,
// never a client release. A row is there when its value is; a section is there when a row is.
// No section is picked by a value: a farm's rows appear because the farm's fields are there.
import { date, formatNumber, isNumber, join, money, text, withUnit, yesNo } from './format.js';
import { read, type Data } from './path.js';

type Format =
  | 'text'
  | 'number'
  | 'money'
  | 'money_per_year'
  | 'area'
  | 'hectare'
  | 'metres'
  | 'percent'
  | 'kwh_per_year'
  | 'kwh_per_m2'
  | 'rooms'
  | 'date'
  | 'yes_no'
  | 'yes'
  | 'name_list'
  | 'address';

/** One row from one path, or one row per entry of a list (`each`), labelled by a field of the entry. */
type Part = { path: string; format?: Format };

/**
 * One row from one path (or the first of several that is set), one row from several parts joined
 * by a comma, or one row per entry of a list (`each`), labelled by a field of the entry. A
 * `label_path` takes the label from the record itself, as the master labels the fee by its type.
 */
type Row =
  | { label: string; label_path?: string; path: string | string[]; format?: Format }
  | { label: string; parts: Part[] }
  | { each: string; label: string; value: string; format?: Format }
  | { each: string; fixed_label: string; value: string; format?: Format };

type Section = { header: string; rows: Row[] };

export type RenderedSection = { header: string; items: { label: string; value: string }[] };

/**
 * Headers, labels and order follow norbanmakleri.se, the master of the default set (question 92,
 * Patric 2026-10-03: "same as norbanmakleri.se"): its sections first, in its order and with its
 * rows, then the sections for facts the master's pages never carried (plots, taxation, farms,
 * commercial property, premises, foreign homes, surroundings), which stay so that a home of
 * another kind still shows its facts. Rows the master has the data for and does not show are
 * left out. The paths are docs/field-tables.md names.
 */
export const PROPERTY_SECTIONS: Section[] = [
  {
    header: 'Grundinformation',
    rows: [
      { label: 'Upplåtelseform', path: 'tenure.name' },
      { label: 'Bostadstyp', path: 'subtype.name' },
      { label: 'Adress', path: 'address', format: 'address' },
      { label: 'Område', path: 'address.area_name' },
      {
        label: 'Fastighetsbeteckning',
        path: 'taxation.property_designations',
        format: 'name_list',
      },
      { label: 'Nyproduktion', path: 'is_new_build', format: 'yes' },
      { label: 'Tillträde', path: 'possession_estimate' },
      { label: 'Tillträdesdatum', path: 'possession_at', format: 'date' },
    ],
  },
  {
    header: 'Interiör',
    rows: [
      { label: 'Boarea', path: 'living_space', format: 'area' },
      { label: 'Antal rum', path: 'rooms', format: 'number' },
      { label: 'Areakälla', path: 'area_source' },
      { label: 'Biarea', path: 'additional_space', format: 'area' },
      { label: 'Byggnadsyta', path: 'building_area', format: 'area' },
      { label: 'Badrum', path: 'bathrooms', format: 'number' },
      { label: 'Kommentar till area', path: 'area_description' },
      { label: 'Interiör', path: 'buildings[0].interior' },
      { each: 'buildings[0].room_list', label: 'name', value: 'description' },
      { label: 'Rumsbeskrivning', path: 'buildings[0].room_list_text' },
    ],
  },
  {
    header: 'Beskrivning',
    rows: [{ label: 'Beskrivning', path: ['long_text', 'short_text'] }],
  },
  {
    header: 'Byggnad',
    rows: [
      { label: 'Byggnadstyp', path: 'buildings[0].type' },
      { label: 'Byggår', path: 'display.year_built' },
      { each: 'buildings[0].architecture', label: 'type.name', value: 'description' },
      { label: 'Renoveringar', path: 'buildings[0].renovation' },
      { each: 'buildings[0].services', label: 'type.name', value: 'description' },
      { label: 'Beskrivning', path: 'buildings[0].description' },
      { label: 'Övrigt om byggnaden', path: 'buildings[0].other_information' },
    ],
  },
  {
    header: 'Ventilation',
    rows: [
      { label: 'Typ', path: 'buildings[0].ventilation.type' },
      { label: 'Ventilationsbesiktning', path: 'buildings[0].ventilation.inspection' },
    ],
  },
  {
    header: 'Energideklaration',
    rows: [
      { label: 'Energideklaration', path: 'display.energy_declaration' },
      {
        label: 'Energiprestanda primärenergital',
        path: 'buildings[0].energy_declaration.consumption',
        format: 'kwh_per_m2',
      },
      { label: 'Energiklass', path: 'buildings[0].energy_declaration.class' },
    ],
  },
  {
    header: 'Andelstal, avgifter och insats',
    rows: [
      {
        label: 'Andel i förening',
        path: 'extensions.housing_cooperative.finances.shares',
        format: 'percent',
      },
      {
        label: 'Andel av årsavgift',
        path: 'extensions.housing_cooperative.finances.annual_fee_share',
        format: 'percent',
      },
      {
        label: 'Kommentar till andelstal',
        path: 'extensions.housing_cooperative.finances.shares_comment',
      },
      { label: 'Månadsavgift', label_path: 'fee.type', path: 'display.fee_amount' },
      { label: 'Kommentar till månadsavgift', path: 'fee.comment' },
      {
        label: 'Bostadens indirekta nettoskuldsättning',
        parts: [
          { path: 'extensions.housing_cooperative.finances.indirect_net_debt', format: 'money' },
          { path: 'extensions.housing_cooperative.finances.indirect_net_debt_comment' },
        ],
      },
      {
        label: 'Reparationsfond',
        path: 'extensions.housing_cooperative.finances.repair_fund_balance',
        format: 'money',
      },
      {
        label: 'Pantsatt',
        path: 'extensions.housing_cooperative.finances.is_pledged',
        format: 'yes_no',
      },
      { label: 'Allmänt om lägenheten', path: 'extensions.housing_cooperative.description' },
      {
        label: 'Upplåten mark',
        path: 'extensions.housing_cooperative.included_land.size',
        format: 'area',
      },
      {
        label: 'Beskrivning av upplåten mark',
        path: 'extensions.housing_cooperative.included_land.description',
      },
      { label: 'Tomträttsavgäld', path: 'display.leasehold' },
      { label: 'Arrende', path: 'display.lease' },
    ],
  },
  {
    header: 'Våning/hiss',
    rows: [
      { label: 'Våning', path: 'display.floor_and_elevator' },
      { label: 'Beskrivning av våningsplan', path: 'floor_description' },
    ],
  },
  {
    header: 'Driftskostnader',
    rows: [
      { each: 'operating_costs', label: 'type.name', value: 'value', format: 'money_per_year' },
      { label: 'Personer i hushållet', path: 'household_size', format: 'number' },
      { label: 'Kommentar driftskostnader', path: 'operating_cost_description' },
      { label: 'Summa per år', path: 'display.operating_cost' },
      { label: 'Nätbolag', path: 'electricity.company' },
      { label: 'Elleverantör', path: 'electricity.distributor' },
      { label: 'Elförbrukning', path: 'electricity.consumption', format: 'kwh_per_year' },
    ],
  },
  {
    header: 'Tomt',
    rows: [
      { label: 'Tomtarea', path: 'plot.area', format: 'area' },
      { label: 'Tomttyp', path: 'plot.type' },
      { label: 'Beskrivning', path: 'plot.description' },
      { label: 'Tomt vid byggnaden', path: 'buildings[0].plot_description' },
      { label: 'Övriga byggnader', path: 'other_buildings' },
      { label: 'Bygglov', path: 'building_permission' },
    ],
  },
  {
    header: 'Taxering',
    rows: [
      { label: 'Taxeringsvärde byggnad', path: 'taxation.building_value', format: 'money' },
      { label: 'Taxeringsvärde mark', path: 'taxation.land_value', format: 'money' },
      { label: 'Taxeringsvärde totalt', path: 'taxation.total_value', format: 'money' },
      { label: 'Skatt/avgift', path: 'taxation.tax_fee', format: 'money' },
      { label: 'Preliminära uppgifter', path: 'taxation.is_preliminary', format: 'yes' },
    ],
  },
  {
    header: 'Pantbrev och inskrivningar',
    rows: [
      { each: 'pledges', fixed_label: 'Pantbrev', value: 'amount', format: 'money' },
      { label: 'Planbestämmelser', path: 'enrollments.plan_regulations' },
      {
        label: 'Rättigheter och gemensamhetsanläggningar',
        path: 'enrollments.preferential_and_community',
      },
    ],
  },
  {
    header: 'Gård',
    rows: [
      { label: 'Antal skiften', path: 'extensions.farm.number_of_partitions', format: 'number' },
      { label: 'Samtaxerade fastigheter', path: 'extensions.farm.jointly_taxed_properties' },
      { label: 'Inriktning', path: 'extensions.farm.agricultural_focus', format: 'name_list' },
      { label: 'Totalareal', path: 'extensions.farm.acreage.total', format: 'hectare' },
      {
        each: 'extensions.farm.acreage.entries',
        label: 'type.name',
        value: 'size',
        format: 'hectare',
      },
      { label: 'Arealkälla', path: 'extensions.farm.acreage.source' },
      { each: 'extensions.farm.economy_buildings', label: 'name', value: 'description' },
      { each: 'extensions.farm.lands', label: 'name', value: 'description' },
      { each: 'extensions.farm.other_data', label: 'heading', value: 'text' },
    ],
  },
  {
    header: 'Fastigheten',
    rows: [
      {
        label: 'Summa area',
        path: 'extensions.commercial_property.compilation_area.size',
        format: 'area',
      },
      {
        each: 'extensions.commercial_property.compilation_area.entries',
        label: 'type.name',
        value: 'size',
        format: 'area',
      },
      { label: 'Areakälla', path: 'extensions.commercial_property.compilation_area.source' },
      {
        label: 'Hyresintäkter',
        path: 'extensions.commercial_property.compilation_area.income.rental',
        format: 'money_per_year',
      },
      {
        label: 'Övriga intäkter',
        path: 'extensions.commercial_property.compilation_area.income.other',
        format: 'money_per_year',
      },
      {
        label: 'Schablon driftskostnad',
        path: 'extensions.commercial_property.compilation_area.flat_operating_cost',
        format: 'money_per_year',
      },
      { label: 'Vakanser', path: 'extensions.commercial_property.compilation_area.vacancies' },
      { label: 'Verksamhet', path: 'extensions.commercial_property.business.description' },
      { label: 'Utrustning', path: 'extensions.commercial_property.business.equipment' },
      { label: 'Teknisk data', path: 'extensions.commercial_property.technical_data.description' },
      {
        label: 'Gemensamma utrymmen',
        path: 'extensions.commercial_property.shared_spaces.description',
      },
      { label: 'Gårdsplan', path: 'extensions.commercial_property.shared_spaces.courtyard' },
      {
        label: 'Renoveringsbehov',
        path: 'extensions.commercial_property.renovation_plan.amount',
        format: 'money',
      },
      {
        label: 'Kommentar till renoveringsbehov',
        path: 'extensions.commercial_property.renovation_plan.description',
      },
      {
        label: 'Anbud mottages',
        path: 'extensions.commercial_property.offer.is_receiving',
        format: 'yes',
      },
      {
        label: 'Senaste dag för anbud',
        path: 'extensions.commercial_property.offer.deadline_at',
        format: 'date',
      },
    ],
  },
  {
    header: 'Lokalen',
    rows: [
      { label: 'Teknisk information', path: 'extensions.premises.technical_data.description' },
      {
        each: 'extensions.premises.compilation_area.entries',
        label: 'name',
        value: 'size',
        format: 'area',
      },
      {
        label: 'Summa area',
        path: 'extensions.premises.compilation_area.area_size',
        format: 'area',
      },
      {
        label: 'Summa hyra',
        path: 'extensions.premises.compilation_area.rent',
        format: 'money_per_year',
      },
      {
        label: 'Summa driftskostnad',
        path: 'extensions.premises.compilation_area.operating_cost',
        format: 'money_per_year',
      },
    ],
  },
  {
    header: 'Utlandsbostaden',
    rows: [
      { label: 'Referensnummer', path: 'extensions.foreign_property.external_reference_number' },
      { label: 'Stad', path: 'extensions.foreign_property.address.city' },
      { label: 'Provins', path: 'extensions.foreign_property.address.province' },
      {
        each: 'extensions.foreign_property.distances',
        label: 'type.name',
        value: 'meters',
        format: 'metres',
      },
    ],
  },
  {
    header: 'Omgivning',
    rows: [
      { label: 'Allmänt om området', path: 'surroundings.area' },
      { label: 'Närservice', path: 'surroundings.service' },
      { label: 'Kommunikation', path: 'surroundings.communication' },
      { label: 'Parkering', path: 'surroundings.parking' },
      { label: 'Övrigt', path: 'surroundings.other' },
      { label: 'Vägbeskrivning', path: 'address.directions' },
    ],
  },
  {
    header: 'Övrigt',
    rows: [
      { label: 'Övrig information', path: 'other_information' },
      { label: 'Förbesiktigad', path: 'inspection.has_been_performed', format: 'yes' },
    ],
  },
];

const nameOf = (value: unknown): string | null =>
  text(value) ?? text((value as Data | null)?.['name']) ?? text((value as Data | null)?.['id']);

/** Names from a list of strings or `{id, name}` entries, comma-joined. */
const nameList = (value: unknown): string | null =>
  Array.isArray(value) ? join(value.map(nameOf), ', ') : null;

/** The address as the master writes it in its tables: street, postal code and city, spaces only. */
const address = (value: unknown): string | null => {
  const entry = value as Data | null;
  if (!entry) return null;
  return join([text(entry['street']), text(entry['postal_code']), text(entry['city'])], ' ');
};

const perYear = (value: unknown, currency: string | null): string | null => {
  const amount = money(value, currency);
  return amount ? `${amount}/år` : null;
};

const FORMATTERS: Record<Format, (value: unknown, currency: string | null) => string | null> = {
  text: (value) => text(value),
  number: (value) => (isNumber(value) && value !== 0 ? formatNumber(value) : null),
  money: (value, currency) => money(value, currency),
  money_per_year: perYear,
  area: (value) => withUnit(value, 'kvm'),
  hectare: (value) => withUnit(value, 'ha'),
  metres: (value) => withUnit(value, 'm'),
  percent: (value) => withUnit(value, '%'),
  kwh_per_year: (value) => withUnit(value, 'kWh/år'),
  kwh_per_m2: (value) => withUnit(value, 'kWh per kvm och år'),
  rooms: (value) => withUnit(value, 'rum'),
  date: (value) => date(value),
  yes_no: (value) => yesNo(value),
  yes: (value) => (value === true ? 'Ja' : null),
  name_list: (value) => nameList(value),
  address: (value) => address(value),
};

const format = (value: unknown, how: Format, currency: string | null): string | null =>
  FORMATTERS[how](value, currency);

const valueAt = (entry: unknown, path: string): unknown =>
  path === '.' ? entry : read(entry, path);

const firstSet = (data: Data, paths: string | string[]): unknown =>
  (Array.isArray(paths) ? paths : [paths])
    .map((path) => read(data, path))
    .find((value) => value !== null && value !== undefined && value !== '');

function rowItems(
  data: Data,
  row: Row,
  currency: string | null,
): { label: string; value: string }[] {
  if ('parts' in row) {
    const value = join(
      row.parts.map((part) => format(read(data, part.path), part.format ?? 'text', currency)),
      ', ',
    );
    return value ? [{ label: row.label, value }] : [];
  }
  if ('path' in row) {
    const value = format(firstSet(data, row.path), row.format ?? 'text', currency);
    const label = (row.label_path && text(read(data, row.label_path))) || row.label;
    return value ? [{ label, value }] : [];
  }
  const entries = read(data, row.each);
  if (!Array.isArray(entries)) return [];
  return entries.flatMap((entry) => {
    const label = 'fixed_label' in row ? row.fixed_label : nameOf(valueAt(entry, row.label));
    const value = format(valueAt(entry, row.value), row.format ?? 'text', currency);
    return label && value ? [{ label, value }] : [];
  });
}

/** Every section with at least one row, in the definition's order (R-013). */
export function renderSections(data: Data, definition: Section[]): RenderedSection[] {
  const currency = typeof data['currency'] === 'string' ? data['currency'] : null;
  return definition
    .map((section) => ({
      header: section.header,
      items: section.rows.flatMap((row) => rowItems(data, row, currency)),
    }))
    .filter((section) => section.items.length > 0);
}
