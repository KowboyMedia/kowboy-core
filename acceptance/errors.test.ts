// The shared gate in front of Sentry (question 36; Patric, 2026-09-18): the same error leaves once
// a day whichever process hits it, at most so many distinct errors leave per app a day, and the
// row remembers how often the error was seen.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { harness, TOKEN, type Harness } from './harness.js';
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

  it("takes a site's error with the tenant token and keeps one row per bug (question 46)", async () => {
    const post = (body: unknown, token = TOKEN): Promise<Response> =>
      fetch(`${running.baseUrl}/v1/errors`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
          'x-core-client': 'wordpress/0.1.0',
        },
        body: JSON.stringify(body),
      });
    expect((await post({ message: 'sync failed: http 401', where: 'sync' }, 'nope')).status).toBe(
      401,
    );
    expect((await post({ nope: true })).status).toBe(400);
    const first = await post({ message: 'sync failed: http 401', where: 'sync', detail: 'x' });
    expect(first.status).toBe(202);
    expect(await first.json()).toEqual({ recorded: true, reported: false }); // no DSN in tests
    expect((await post({ message: 'sync failed: http 401', where: 'sync' })).status).toBe(202);
    const { rows } = await db().query<{ fingerprint: string; seen: string }>(
      'select fingerprint, seen from error_reports',
    );
    expect(rows).toEqual([
      { fingerprint: 'wordpress/0.1.0 | sync | sync failed: http 401', seen: '2' },
    ]);
  });

  it('caps the distinct errors that leave in one day', async () => {
    let sent = 0;
    for (let n = 0; n < DAILY_CAP + 5; n += 1) if (await allow(`Error: e${n} | test`)) sent += 1;
    expect(sent).toBe(DAILY_CAP);
  });
});
