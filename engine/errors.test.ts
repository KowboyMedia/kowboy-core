// What makes two errors the same, and the gate in memory that takes over when the database cannot
// answer (question 36; Patric: the same error once per day, at most). The shared gate in the
// database is tested in acceptance/errors.test.ts.
import { describe, expect, it } from 'vitest';
import { fingerprintOf, throttle, DAILY_CAP, REPEAT_WINDOW_MS } from './errors.js';

describe('the error fingerprint', () => {
  it('blanks numbers and ids, and keeps the name, the message and the place', () => {
    expect(fingerprintOf(new TypeError('fetch failed'), 'bell')).toBe(
      'TypeError: fetch failed | bell',
    );
    expect(fingerprintOf(new Error('record 4711 failed'), 'pull')).toBe(
      fingerprintOf(new Error('record 4712 failed'), 'pull'),
    );
    expect(fingerprintOf(new Error('site 1f2e3d4c-5b6a-4798-8899-aabbccddeeff gone'), '')).toBe(
      'Error: site # gone | ',
    );
    expect(fingerprintOf('plain text', 'x')).toBe('plain text | x');
    expect(fingerprintOf(new Error('pull failed: http 401'), 'sync')).not.toBe(
      fingerprintOf(new Error('pull failed: http 503'), 'sync'),
    );
  });
});

describe('the gate in memory', () => {
  it('lets the same error through once a day', () => {
    const gate = throttle();
    const at = 1_000_000;
    expect(gate('TypeError: fetch failed | bell', at)).toBe(true);
    expect(gate('TypeError: fetch failed | bell', at + 1_000)).toBe(false);
    expect(gate('TypeError: fetch failed | bell', at + REPEAT_WINDOW_MS - 1)).toBe(false);
    expect(gate('TypeError: fetch failed | bell', at + REPEAT_WINDOW_MS)).toBe(true);
    expect(gate('Error: something else | pull', at + 2_000)).toBe(true);
  });

  it('caps the distinct errors that leave in one day, then opens again', () => {
    const gate = throttle();
    const at = 5_000_000;
    let sent = 0;
    for (let n = 0; n < DAILY_CAP + 20; n += 1) if (gate(`Error: e${n} | test`, at + n)) sent += 1;
    expect(sent).toBe(DAILY_CAP);
    expect(gate('Error: late | test', at + REPEAT_WINDOW_MS - 1)).toBe(false);
    expect(gate('Error: late | test', at + REPEAT_WINDOW_MS)).toBe(true);
  });
});
