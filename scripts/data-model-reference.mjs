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

/** The datatypes (SRS §2, plus `project`: proposal point 9) and the Vitec model each mirrors. */
const DATATYPES = [
  { name: 'property', model: 'Advertising.Services.AdvertisingEstate' },
  { name: 'agent', model: 'Advertising.Services.AdvertisingUser' },
  { name: 'office', model: 'Advertising.Services.AdvertisingOffice' },
  { name: 'area', model: 'Advertising.Services.AdvertisingArea' },
  { name: 'association', model: 'Advertising.Models.AdvertisingAssociation' },
  { name: 'project', model: 'Advertising.Services.AdvertisingProject' },
];

/**
 * The spine: the technical fields the SRS names, on top of the mirrored model. Identity, the
 * relations between the datatypes, and the two objects every item carries. Mappings,
 * enumerations, search scalars and display strings are the rules-ledger phase, not Gate 2.
 */
const SPINE = {
  property: [
    ['id', 'string', 'Id', 'SRS §6.9, identity'],
    [
      'office_id',
      'string | null',
      'Office.CustomerId',
      'SRS §6.9; the office id is the customer id; also the envelope office_id',
    ],
    [
      'agent_ids',
      'string[]',
      'PrimaryAgentId, SecondaryAgentId, primary first, nulls dropped',
      'SRS §6.9',
    ],
    [
      'area_ids',
      'string[]',
      'Address.Area.Id, zero or one',
      'SRS §6.9; as the CRM assigns it, no geographical matching in Core',
    ],
    [
      'association_id',
      'string | null',
      'Extensions.HousingCooperative.Association.Id',
      'SRS §6.9; needs extend=housingCooperative',
    ],
    ['project_id', 'string | null', 'ProjectId', "The estate's project, null outside a project"],
    ['display', 'object', 'rules, empty until the ledger exists', 'SRS §6'],
    ['provider_extras.vitec', 'object', 'nothing yet', 'SRS §6.4, never hashed'],
  ],
  agent: [
    ['id', 'string', 'Id', 'SRS §6.9, identity; the envelope office_id is null, tenant-wide'],
    [
      'office_ids',
      'string[]',
      'Offices[].CustomerId',
      'One or several offices; the order per office stays in offices[].order_number',
    ],
    ['display', 'object', 'rules, empty until the ledger exists', 'SRS §6'],
    ['provider_extras.vitec', 'object', 'nothing yet', 'SRS §6.4'],
  ],
  office: [
    [
      'id',
      'string',
      'CustomerId',
      'SRS §6.9, identity; the customer id is the office id; also the envelope office_id',
    ],
    ['display', 'object', 'rules, empty until the ledger exists', 'SRS §6'],
    ['provider_extras.vitec', 'object', 'nothing yet', 'SRS §6.4'],
  ],
  area: [
    [
      'id',
      'string',
      'Id',
      'SRS §6.9, identity; no relations, areas are loose; the envelope office_id is null',
    ],
    ['display', 'object', 'rules, empty until the ledger exists', 'SRS §6'],
    ['provider_extras.vitec', 'object', 'nothing yet', 'SRS §6.4'],
  ],
  association: [
    ['id', 'string', 'Id', 'SRS §6.9, identity; the envelope office_id is null, tenant-wide'],
    ['display', 'object', 'rules, empty until the ledger exists', 'SRS §6'],
    ['provider_extras.vitec', 'object', 'nothing yet', 'SRS §6.4'],
  ],
  project: [
    ['id', 'string', 'Id', 'Identity, as property'],
    ['office_id', 'string | null', 'Office.CustomerId', 'Also the envelope office_id'],
    [
      'agent_ids',
      'string[]',
      'PrimaryAgentId, SecondaryAgentId, primary first, nulls dropped',
      'As property',
    ],
    ['area_ids', 'string[]', 'Address.Area.Id, zero or one', 'As property'],
    ['display', 'object', 'rules, empty until the ledger exists', 'SRS §6'],
    ['provider_extras.vitec', 'object', 'nothing yet', 'SRS §6.4'],
  ],
};

/**
 * Source fields the spine consumes, or that are not carried, so they are not mirrored: the
 * identity and the reference objects, the change date (the envelope's remote_updated_at), files
 * and documents (a separate app serves them), and the agent extensions (agents are their own items).
 */
const DROP = {
  property: new Set([
    'id',
    'office',
    'primaryAgentId',
    'secondaryAgentId',
    'projectId',
    'changedAt',
    'files',
    'extensions.primaryAgent',
    'extensions.secondaryAgent',
  ]),
  agent: new Set(['id', 'changedAt']),
  office: new Set(['customerId', 'changedAt']),
  area: new Set(['id', 'changedAt']),
  association: new Set(['id', 'changedAt', 'documents']),
  project: new Set([
    'id',
    'office',
    'primaryAgentId',
    'secondaryAgentId',
    'changedAt',
    'files',
    'extensions.primaryAgent',
    'extensions.secondaryAgent',
  ]),
};

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
  const renamed = snake(name);
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
