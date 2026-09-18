// The shared gate in front of Sentry (question 36; Patric, 2026-09-18): the same error leaves once
// a day whichever process hits it, at most so many distinct errors leave per app a day, and the
// row remembers how often the error was seen.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { harness, type Harness } from './harness.js';
import { fakePollingAdapter } from '../adapters/fake-polling/index.js';
import { db } from '../engine/storage/db.js';
import { allow, DAILY_CAP } from '../engine/errors.js';

let running: Harness;

beforeEach(async () => {
  running = await harness({ adapters: [fakePollingAdapter], connections: [] });
});

afterEach(async () => {
  await running.stop();
});

describe('the shared error gate', () => {
  it('lets the same error through once a day, from any process, and counts the rest', async () => {
    expect(await allow('TypeError: fetch failed | bell')).toBe(true);
    expect(await allow('TypeError: fetch failed | bell')).toBe(false);
    expect(await allow('TypeError: fetch failed | bell')).toBe(false);
    expect(await allow('Error: something else | pull')).toBe(true);

    const { rows } = await db().query<{ seen: string }>(
      "select seen from error_reports where fingerprint = 'TypeError: fetch failed | bell'",
    );
    expect(Number(rows[0]?.seen)).toBe(3);

    // A day later, from wherever: once more.
    await db().query("update error_reports set last_sent_at = last_sent_at - interval '1 day'");
    expect(await allow('TypeError: fetch failed | bell')).toBe(true);
    expect(await allow('TypeError: fetch failed | bell')).toBe(false);
  });

  it('caps the distinct errors that leave in one day', async () => {
    let sent = 0;
    for (let n = 0; n < DAILY_CAP + 5; n += 1) if (await allow(`Error: e${n} | test`)) sent += 1;
    expect(sent).toBe(DAILY_CAP);
  });
});
