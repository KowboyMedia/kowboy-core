// A stored login keeps only the fields its adapter declares at the next save, and loses named
// fields an adapter dropped (Patric's rule for a removed feature, 2026-10-06). The tenant page
// shows what it holds of the fields that are not secret, and of a secret only that it is held.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { harness, type Harness } from '../../acceptance/harness.js';
import { registerAdmin } from '../registry.js';
import { connectionById } from '../storage/connections.js';
import { mergedLogin, removeLoginFields, shownLogin } from './login.js';
import type { AdapterAdmin } from '../adapter-api/types.js';

const PROVIDER = 'stand-in';

/** A stand-in adapter's panel that declares two login fields: `key`, and the secret `pin`. */
const admin: AdapterAdmin = {
  credentials: [
    { key: 'key', label: 'Key' },
    { key: 'pin', label: 'PIN', secret: true },
  ],
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

  it('shows a field that is not secret as stored, a held secret only as held, and an empty field as empty', () => {
    expect(shownLogin(JSON.stringify({ key: 'G12', pin: 'p', gone: 'x' }), PROVIDER)).toEqual({
      shown: { key: 'G12' },
      filled: ['key', 'pin'],
    });
    expect(shownLogin(JSON.stringify({ key: '', pin: 'p' }), PROVIDER)).toEqual({
      shown: {},
      filled: ['pin'],
    });
    expect(shownLogin(null, PROVIDER)).toEqual({ shown: {}, filled: [] });
  });
});
