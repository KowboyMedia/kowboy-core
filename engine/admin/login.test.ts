// A stored login keeps only the fields its adapter declares (Patric's rule for a removed feature,
// 2026-10-06): at the next save, and at housekeeping for a login nobody saves again.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { harness, type Harness } from '../../acceptance/harness.js';
import { registerAdmin } from '../registry.js';
import { connectionById } from '../storage/connections.js';
import { dropUndeclaredLoginFields, mergedLogin } from './login.js';
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
      { id: 'kept', provider: PROVIDER, credentials: JSON.stringify({ key: 'k', gone: 'x' }) },
      { id: 'other', provider: 'not-here', credentials: JSON.stringify({ key: 'k', gone: 'x' }) },
      { id: 'nothing-left', provider: PROVIDER, credentials: JSON.stringify({ gone: 'x' }) },
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

  it('loses at housekeeping the fields its adapter no longer declares, and is never emptied', async () => {
    await dropUndeclaredLoginFields();
    expect(await login('kept')).toEqual({ key: 'k' });
    expect(await login('other')).toEqual({ key: 'k', gone: 'x' });
    expect(await login('nothing-left')).toEqual({ gone: 'x' });
  });
});
