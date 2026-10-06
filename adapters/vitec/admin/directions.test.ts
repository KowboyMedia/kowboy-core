// The setup directions on the Vitec page cannot drift from the code (Patric, 2026-09-18: keep
// them up to date): every environment variable the adapter reads, every lifecycle event it
// handles, every health check it registers, every credential field it declares and its webhook
// path must be named in the directions, and the environment variables in the README as well.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { directions } from './directions.js';
import { vitecAdmin } from './index.js';

const root = join(import.meta.dirname, '..');
const read = (file: string): string => readFileSync(join(root, file), 'utf8');
const source = ['index.ts', 'api.ts', 'store.ts', 'admin/index.ts'].map(read).join('\n');
const found = (pattern: RegExp): string[] => [
  ...new Set([...source.matchAll(pattern)].map((m) => m[1] ?? '')),
];

describe('the Vitec setup directions', () => {
  const given = directions();
  const text = given.steps.map((step) => `${step.title} ${step.text}`).join('\n');
  const settings = given.settings.map((setting) => setting.key);

  it('name every environment variable the adapter reads, and so does the README', () => {
    const keys = found(/(VITEC_[A-Z_]+)/g);
    expect(keys.length).toBeGreaterThanOrEqual(4);
    const readme = read('README.md');
    for (const key of keys) {
      expect(settings, key).toContain(key);
      expect(readme, key).toContain(key);
    }
  });

  it('name every lifecycle event the adapter handles', () => {
    const events = found(/event\.type === '([a-z_]+)'/g);
    expect(events).toEqual(
      expect.arrayContaining(['connection_added', 'offices_added', 'resync', 'refetch']),
    );
    for (const event of events) expect(text, event).toContain(event);
  });

  it('name every health check the adapter registers', () => {
    const checks = found(/healthCheck\(`\$\{PROVIDER\}\.([a-z_]+)`/g);
    expect(checks.length).toBeGreaterThanOrEqual(5);
    for (const check of checks) expect(text, check).toContain(`vitec.${check}`);
  });

  it('name every credential field and both webhook paths, live and QA', () => {
    for (const credential of vitecAdmin.credentials) expect(text).toContain(credential.label);
    expect(text).toContain('/v1/hook/vitec/webhook/');
    expect(text).toContain('/v1/hook/vitec/qa/');
  });

  it('describe every setting with its value and what it does', () => {
    for (const setting of given.settings) {
      expect(setting.help.length).toBeGreaterThan(10);
      expect(setting.value).not.toBeNull();
    }
  });
});
