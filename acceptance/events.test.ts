// The event log: concurrent writes, redaction, and the retention window.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { harness, type Harness } from './harness.js';
import { deleteExpiredEvents, logEvent, queryEvents, redact } from '../engine/events.js';
import { db } from '../engine/storage/db.js';

let running: Harness;

beforeEach(async () => {
  running = await harness({ subscriber: false });
});

afterEach(async () => {
  await running.stop();
});

describe('the event log', () => {
  it('keeps every event when many writers log at once', async () => {
    const correlationId = 'race-correlation';
    await Promise.all(
      Array.from({ length: 25 }, (_, index) =>
        logEvent({ type: 'test.race', correlationId, fields: { index } }),
      ),
    );
    expect(await queryEvents({ correlationId, limit: 100 })).toHaveLength(25);
  });

  it('redacts secret-shaped fields, however deep (AC 16, AC 25)', async () => {
    expect(
      redact({
        bell_secret: 'hunter2',
        nested: { api_key: 'abc', kept: 'visible' },
        kept: 'visible',
      }),
    ).toEqual({
      bell_secret: '[redacted]',
      nested: { api_key: '[redacted]', kept: 'visible' },
      kept: 'visible',
    });
  });

  it('deletes events outside the retention window (AC 16)', async () => {
    await logEvent({ type: 'test.fresh' });
    await db().query(
      "insert into events (at, type) values (now() - interval '31 days', 'test.old')",
    );

    expect(await deleteExpiredEvents(30)).toBe(1);
    const left = await queryEvents({ limit: 10 });
    expect(left.map((event) => event.type)).toEqual(['test.fresh']);
  });
});
