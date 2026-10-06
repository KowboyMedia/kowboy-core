// A stored login keeps only the fields its adapter declares at the next save (Patric's rule for
// a removed feature, 2026-10-06).
import { beforeEach, describe, expect, it } from 'vitest';
import { registerAdmin } from '../registry.js';
import { mergedLogin } from './login.js';
import type { AdapterAdmin } from '../adapter-api/types.js';

const PROVIDER = 'stand-in';

/** A stand-in adapter's panel that declares one login field, `key`. */
const admin: AdapterAdmin = {
  credentials: [{ key: 'key', label: 'Key' }],
  directions: () => ({ steps: [], settings: [] }),
  panel: () => Promise.resolve([]),
  act: () => Promise.resolve({ message: '' }),
};

beforeEach(() => {
  registerAdmin(PROVIDER, admin);
});

describe('a stored login', () => {
  it('loses at a save the stored fields its adapter no longer declares, and keeps what is typed', () => {
    const stored = JSON.stringify({ key: 'k', gone: 'x' });
    expect(JSON.parse(mergedLogin({ key: 'new' }, stored, PROVIDER) ?? '')).toEqual({ key: 'new' });
    expect(JSON.parse(mergedLogin({ extra: 'y' }, stored, PROVIDER) ?? '')).toEqual({
      key: 'k',
      extra: 'y',
    });
    // An adapter not registered here declares nothing known: every stored field stays.
    expect(JSON.parse(mergedLogin({ extra: 'y' }, stored, 'not-here') ?? '')).toEqual({
      key: 'k',
      gone: 'x',
      extra: 'y',
    });
    expect(mergedLogin({}, stored, PROVIDER)).toBeNull();
  });
});
