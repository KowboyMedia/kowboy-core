// AC 1: every golden case maps to exactly its canonical and display output, and validates against
// its schema. The expected files are the acceptance; code changes to match them, never the reverse.
// One folder per provider under golden/: the fake webhook adapter's dummy cases, and Vitec's real
// records from the test account (golden/vitec, question 52).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mappers as fakeMappers } from '../adapters/fake-webhook/mappers.js';
import { mappers as vitecMappers } from '../adapters/vitec/mappers.js';
import { applyRules } from '../engine/rules/run.js';
import { validateData } from '../engine/contract.js';
import { canonicalJson } from '../engine/json.js';
import type { Datatype, Mappers } from '../engine/adapter-api/types.js';

const PROVIDERS: Record<string, Mappers> = { fake: fakeMappers, vitec: vitecMappers };
const read = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));

const casesOf = (provider: string) => {
  const root = join(import.meta.dirname, '..', 'golden', provider);
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((datatypeDir) =>
      readdirSync(join(root, datatypeDir.name)).map((caseName) => ({
        datatype: datatypeDir.name as Datatype,
        caseName,
        dir: join(root, datatypeDir.name, caseName),
      })),
    );
};

describe.each(Object.keys(PROVIDERS))('golden masters (%s provider)', (provider) => {
  const cases = casesOf(provider);
  const mappers = PROVIDERS[provider]!;

  it('has cases to check', () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  for (const goldenCase of cases) {
    it(`${goldenCase.datatype}/${goldenCase.caseName}`, () => {
      const mapper = mappers[goldenCase.datatype];
      expect(mapper, `no mapper for ${goldenCase.datatype}`).toBeDefined();

      const mapped = mapper!(read(join(goldenCase.dir, 'payload.json')));
      const data = applyRules(goldenCase.datatype, mapped.data);
      const { display, ...canonical } = data;

      expect(canonicalJson(canonical)).toBe(
        canonicalJson(read(join(goldenCase.dir, 'canonical.json'))),
      );
      expect(canonicalJson(display)).toBe(
        canonicalJson(read(join(goldenCase.dir, 'display.json'))),
      );

      const validation = validateData(goldenCase.datatype, data);
      expect(validation.valid ? [] : validation.errors).toEqual([]);
    });
  }
});
