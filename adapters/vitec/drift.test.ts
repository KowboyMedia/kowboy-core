// What a person reads about the Vitec code cannot drift from the code (Patric, 2026-09-18: keep
// it up to date): every environment variable the adapter reads is in the README, and every health
// check it registers has a title, so none shows its name.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { vitecAdmin } from './admin/index.js';

const root = import.meta.dirname;
const read = (file: string): string => readFileSync(join(root, file), 'utf8');
const source = ['index.ts', 'api.ts', 'store.ts', 'admin/index.ts'].map(read).join('\n');
const found = (pattern: RegExp): string[] => [
  ...new Set([...source.matchAll(pattern)].map((m) => m[1] ?? '')),
];

describe('what the Vitec code tells a person', () => {
  it('names every environment variable the adapter reads in the README', () => {
    const keys = found(/(VITEC_[A-Z_]+)/g);
    expect(keys.length).toBeGreaterThanOrEqual(4);
    const readme = read('README.md');
    for (const key of keys) expect(readme, key).toContain(key);
  });

  it('gives every health check a title, so none shows its name', () => {
    const checks = found(/healthCheck\(`\$\{PROVIDER\}\.([a-z_]+)`/g);
    expect(checks.length).toBeGreaterThanOrEqual(5);
    for (const check of checks) {
      expect(vitecAdmin.checks?.[`vitec.${check}`]?.title, check).toBeTruthy();
    }
    expect(Object.keys(vitecAdmin.checks ?? {}).sort()).toEqual(
      checks.map((check) => `vitec.${check}`).sort(),
    );
  });
});
