// A stored login keeps only the fields its adapter declares at the next save, and loses named
// fields an adapter dropped (Patric's rule for a removed feature, 2026-10-06).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { harness, type Harness } from '../../acceptance/harness.js';
import { registerAdmin } from '../registry.js';
import { connectionById } from '../storage/connections.js';
import { mergedLogin, removeLoginFields } from './login.js';
import type { AdapterAdmin } from '../adapter-api/types.js';

const PROVIDER = 'stand-in';

/** A stand-in adapter's panel that declares one login field, `key`. */
const admin: AdapterAdmin = {
  credentials: [{ key: 'key', label: 'Key' }],
  directions: () => ({ steps: [], settings: [] }),
  panel: () => Promise.resolve([]),
  act: () => Promise.resolve({ message: '' }),
};

const login = async (id: string): Promise<unknown> =>
  JSON.parse((await connectionById(id))?.credentials ?? 'null');

let running: Harness;

beforeEach(async () => {
  running = await harness({
    connections: [
      { id: 'mine', provider: PROVIDER, credentials: JSON.stringify({ key: 'k', gone: 'x' }) },
      { id: 'other', provider: 'not-mine', credentials: JSON.stringify({ key: 'k', gone: 'x' }) },
      { id: 'only-gone', provider: PROVIDER, credentials: JSON.stringify({ gone: 'x' }) },
    ],
  });
  registerAdmin(PROVIDER, admin);
});

afterEach(async () => {
  await running.stop();
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

  it('loses exactly the named fields of one provider, and is never emptied', async () => {
    expect(await removeLoginFields(PROVIDER, ['gone'])).toBe(1);
    expect(await login('mine')).toEqual({ key: 'k' });
    expect(await login('other')).toEqual({ key: 'k', gone: 'x' });
    expect(await login('only-gone')).toEqual({ gone: 'x' });
    // Run again, nothing is left to remove.
    expect(await removeLoginFields(PROVIDER, ['gone'])).toBe(0);
  });
});
