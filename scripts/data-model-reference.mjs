// Generates docs/data-model-reference.md: every path in `data` per datatype, derived from the
// Vitec advertising model (docs/inputs/vitec/advertising.openapi.json) by the conventions in
// docs/data-model-proposal.md: the SRS spine on top, then the CRM's whole model mirrored under
// snake_case names, enum wrappers flattened to their id, and the fields the spine consumes dropped.
//
//   node scripts/data-model-reference.mjs
//
// Nothing here is hand-picked: change the conventions in this file, run it, and read the diff.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const SPEC = 'docs/inputs/vitec/advertising.openapi.json';
const MODELS = 'docs/inputs/vitec/models';
const OUT = 'docs/data-model-reference.md';

const spec = JSON.parse(readFileSync(SPEC, 'utf8'));
const definitions = spec.definitions;

/** The datatypes (SRS §2) and the Vitec model each mirrors. */
const DATATYPES = [
  { name: 'property', model: 'Advertising.Services.AdvertisingEstate' },
  { name: 'agent', model: 'Advertising.Services.AdvertisingUser' },
  { name: 'office', model: 'Advertising.Services.AdvertisingOffice' },
  { name: 'area', model: 'Advertising.Services.AdvertisingArea' },
  { name: 'association', model: 'Advertising.Models.AdvertisingAssociation' },
];

/**
 * The spine: the fields the SRS names, on top of the mirrored model. `rule` marks a value the
 * rules ledger computes; `source` is where the adapter reads it.
 */
const SPINE = {
  property: [
    ['id', 'string', 'Id', 'SRS §6.9'],
    [
      'status',
      'enum coming_soon | for_sale | sold | withdrawn',
      'Status.Id, rule R-001',
      'SRS §6.5; raw id in provider_extras',
    ],
    [
      'listing_type',
      'enum apartment | house | townhouse | plot | commercial | other',
      'Subtype.Id and Type.Id, rule R-002',
      'SRS §6.5',
    ],
    [
      'tenure',
      'enum freehold | leasehold | lease | tenant_ownership | share | condominium | tenancy | company | other',
      'Tenure.Id, rule R-004',
      'SRS §7; raw id in provider_extras',
    ],
    ['office_id', 'string', 'Office.Id', 'SRS §6.9; also the envelope office_id'],
    ['agent_ids', 'string[]', 'PrimaryAgentId, SecondaryAgentId (primary first)', 'SRS §6.9'],
    ['area_ids', 'string[]', 'Address.Area.Id (zero or one)', 'SRS §6.9'],
    [
      'association_id',
      'string | null',
      'Extensions.HousingCooperative.Association.Id',
      'SRS §6.9; needs extend=housingCooperative',
    ],
    ['lat', 'number | null', 'Address.Wgs84Coordinate.Latitude', 'SRS §6.8'],
    ['lng', 'number | null', 'Address.Wgs84Coordinate.Longitude', 'SRS §6.8'],
    ['slug', 'string', 'rule from address.street_address and address.postal_town', 'SRS §6.7'],
    [
      'price',
      'number | null',
      'pricing.starting_price, rule R-005 (price on request)',
      'SRS §9 filter and sort',
    ],
    [
      'rooms',
      'number | null',
      'buildings[].number_of_rooms of the main building, rule R-003',
      'SRS §9 filter',
    ],
    [
      'living_space',
      'number | null',
      'buildings[].area.living of the main building, rule R-003',
      'SRS §9 filter',
    ],
    [
      'additional_space',
      'number | null',
      'buildings[].area.gross_floor of the main building, rule R-003',
      'SRS example',
    ],
    ['published_at', 'date-time | null', 'Marketing.PublishedAt', 'SRS §9 default sort'],
    ['sold_at', 'date | null', 'sale.contract_date when status is sold, rule R-006', 'SRS §9 sort'],
    [
      'images[]',
      'object[]',
      'Images[]: Id, Category.Id, Name, Description, list order',
      'SRS §6.6; items {id, category, name, description, sort}; URLs are decision 2',
    ],
    ['display', 'object', 'rules', 'SRS §6'],
    ['provider_extras.vitec', 'object', 'raw Status.Id and Tenure.Id', 'SRS §6.4, never hashed'],
  ],
  agent: [
    ['id', 'string', 'Id', 'SRS §6.9'],
    [
      'office_ids',
      'string[]',
      'Offices[].Id',
      'SRS §6.9 style reference; the envelope office_id is null (tenant-wide)',
    ],
    [
      'image',
      'object | null',
      'Image: Id, Category.Id, Name, Description',
      'The portrait; {id, category, name, description}; URLs are decision 2',
    ],
    ['display', 'object', 'rules', 'SRS §6'],
    ['provider_extras.vitec', 'object', 'nothing yet', 'SRS §6.4'],
  ],
  office: [
    ['id', 'string', 'Id', 'SRS §6.9; also the envelope office_id'],
    ['lat', 'number | null', 'Coordinate.Latitude', 'SRS §6.8'],
    ['lng', 'number | null', 'Coordinate.Longitude', 'SRS §6.8'],
    ['display', 'object', 'rules', 'SRS §6'],
    ['provider_extras.vitec', 'object', 'nothing yet', 'SRS §6.4'],
  ],
  area: [
    ['id', 'string', 'Id', 'SRS §6.9'],
    ['office_id', 'string', 'Office.Id', 'Also the envelope office_id'],
    ['polygon', 'object | null', 'Coordinates as GeoJSON MultiPolygon', 'SRS §6.8'],
    ['images[]', 'object[]', 'Images[], as on property', 'Decision 2'],
    ['display', 'object', 'rules', 'SRS §6'],
    ['provider_extras.vitec', 'object', 'nothing yet', 'SRS §6.4'],
  ],
  association: [
    ['id', 'string', 'Id', 'SRS §6.9; the envelope office_id is null (tenant-wide)'],
    ['display', 'object', 'rules', 'SRS §6'],
    ['provider_extras.vitec', 'object', 'nothing yet', 'SRS §6.4'],
  ],
};

/** Source fields the spine consumes, or that are not carried, so they are not mirrored. */
const DROP = {
  property: new Set([
    'id',
    'status',
    'office',
    'primaryAgentId',
    'secondaryAgentId',
    'tenure',
    'changedAt',
    'address.wgs84Coordinate',
    'files',
    'images',
    'extensions.primaryAgent',
    'extensions.secondaryAgent',
  ]),
  agent: new Set(['id', 'changedAt', 'image']),
  office: new Set(['id', 'customerId', 'changedAt', 'coordinate']),
  area: new Set(['id', 'changedAt', 'office', 'coordinates', 'images']),
  association: new Set(['id', 'changedAt', 'documents']),
};

/** The one name the spine takes from the model: the SRS's `price` is a number. */
const RENAME = { property: { price: 'pricing' } };

const snake = (name) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();

/** Vitec's enum wrappers: the model pages that point at a list of possible values for `id`. */
const enumWrappers = new Map();
for (const file of readdirSync(MODELS)) {
  const text = readFileSync(`${MODELS}/${file}`, 'utf8');
  const match = /EnumerationReference\?modelName=([A-Za-z_]+)/.exec(text);
  if (match) enumWrappers.set(file.replace(/^.*_/, '').replace(/\.md$/, ''), match[1]);
}

const shortName = (ref) => ref.split('.').pop();

function typeOf(schema) {
  if (schema.$ref) {
    const name = shortName(schema.$ref);
    return enumWrappers.has(name) ? `enum (${enumWrappers.get(name)})` : 'object';
  }
  if (schema.type === 'array') return `${typeOf(schema.items)}[]`;
  if (schema.format === 'date-time') return 'date-time';
  if (schema.type === 'number' || schema.type === 'integer') return 'number';
  return schema.type ?? 'object';
}

/** One property of a model: its path in `data`, its type, its source, and what to walk into. */
function describe(datatype, definitionName, name, schema, prefix, sourcePrefix) {
  const sourcePath = sourcePrefix ? `${sourcePrefix}.${name}` : name;
  const renamed = RENAME[datatype]?.[sourcePath] ?? snake(name);
  const suffix = schema.type === 'array' ? '[]' : '';
  const path = (prefix ? `${prefix}.${renamed}` : renamed) + suffix;
  const items = schema.type === 'array' ? schema.items : schema;
  const ref = items.$ref ? items.$ref.replace('#/definitions/', '') : null;
  const into = ref && !enumWrappers.has(shortName(ref)) ? ref : null;
  const source = `${shortName(definitionName)}.${name[0].toUpperCase()}${name.slice(1)}`;
  return {
    sourcePath,
    path,
    type: typeOf(schema),
    description: schema.description ?? '',
    source,
    into,
  };
}

/** Walk a model, emitting one row per path. Enum wrappers and cycles stop the walk. */
function walk(datatype, definitionName, prefix, sourcePrefix, rows, seen) {
  for (const [name, schema] of Object.entries(definitions[definitionName].properties ?? {})) {
    const field = describe(datatype, definitionName, name, schema, prefix, sourcePrefix);
    if (DROP[datatype].has(field.sourcePath)) continue;
    rows.push([field.path, field.type, field.description, field.source]);
    if (field.into && !seen.has(field.into)) {
      walk(
        datatype,
        field.into,
        field.path,
        field.sourcePath,
        rows,
        new Set([...seen, field.into]),
      );
    }
  }
}

const escape = (text) => text.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
const lines = [
  '# Data model reference',
  '',
  'Generated by `node scripts/data-model-reference.mjs` from `docs/inputs/vitec/advertising.openapi.json`',
  'and the conventions in `docs/data-model-proposal.md`. Do not edit by hand. Every path is what a',
  'client finds in `data` for that datatype; every source is the Vitec model field it mirrors. Enum',
  'values are listed under `docs/inputs/vitec/enumerations/`. A field is `null` when the CRM has no value.',
  '',
];
for (const { name, model } of DATATYPES) {
  const rows = [];
  walk(name, model, '', '', rows, new Set([model]));
  lines.push(
    `## ${name} (mirrors ${shortName(model)}, ${rows.length + SPINE[name].length} paths)`,
    '',
  );
  lines.push('| Path | Type | Description | Source |', '| --- | --- | --- | --- |');
  for (const [path, type, source, note] of SPINE[name]) {
    lines.push(`| \`${path}\` | ${escape(type)} | ${escape(note)} | spine: ${escape(source)} |`);
  }
  for (const [path, type, description, source] of rows) {
    lines.push(`| \`${path}\` | ${escape(type)} | ${escape(description)} | ${escape(source)} |`);
  }
  lines.push('');
}
writeFileSync(OUT, lines.join('\n'));
console.log(`${OUT} written`);
