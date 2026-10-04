import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { Canonical, Datatype } from './adapter-api/types.js';

/**
 * The schemas in `schemas/` are the contract (SRS §6.1). They are checked on the write path, so a
 * record that does not match never reaches a subscriber, and by the release gate before a deploy.
 */
export const SCHEMA_VERSION = '1';

const schemasDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'schemas');

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats.default(ajv);
for (const file of readdirSync(schemasDir).filter((name) => name.endsWith('.json'))) {
  const schema = JSON.parse(readFileSync(join(schemasDir, file), 'utf8')) as object;
  ajv.addSchema(schema, file);
}

export type ValidationResult = { valid: true } | { valid: false; errors: string[] };

function check(schemaFile: string, value: unknown): ValidationResult {
  const validate = ajv.getSchema(schemaFile);
  if (!validate) throw new Error(`no schema ${schemaFile}`);
  if (validate(value)) return { valid: true };
  const errors = (validate.errors ?? []).map(
    (error) => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`,
  );
  return { valid: false, errors };
}

/** Validate a canonical `data` object against its datatype schema. */
export const validateData = (datatype: Datatype, data: Canonical): ValidationResult =>
  check(`${datatype}.v1.json`, data);

/** Validate a full item envelope as a subscriber receives it. */
export const validateItem = (item: unknown): ValidationResult => check('item.v1.json', item);

/** Validate what a site reports it applied (POST /v1/applied, question 37). */
export const validateApplied = (body: unknown): ValidationResult => check('applied.v1.json', body);

/** Validate an error a site reports (POST /v1/errors, question 46). */
export const validateSiteError = (body: unknown): ValidationResult => check('errors.v1.json', body);

/** Validate a form submission a site posts (POST /v1/submissions, docs/forms.md). */
export const validateSubmission = (body: unknown): ValidationResult =>
  check('submission.v1.json', body);

/** Validate what an adapter answers for a home's slots (GET /v1/submissions/slots). */
export const validateSlots = (body: unknown): ValidationResult => check('slots.v1.json', body);
