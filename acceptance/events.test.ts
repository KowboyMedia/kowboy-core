// The event log: concurrent writes, redaction, and the retention window.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { harness, type Harness } from './harness.js';
import {
  dropExpiredEventPartitions,
  forgetPartitionCache,
  logEvent,
  queryEvents,
  redact,
} from '../engine/events.js';
import { db } from '../engine/storage/db.js';

let running: Harness;

beforeEach(async () => {
  running = await harness({ subscriber: false });
});

afterEach(async () => {
  await running.stop();
});

describe('the event log', () => {
  it('loses no event when many writers race to create the day partition', async () => {
    // A cold cache is what a fresh process has: every writer believes it must create the
    // partition, and only one of them wins.
    forgetPartitionCache();
    const correlationId = 'race-correlation';

    await Promise.all(
      Array.from({ length: 25 }, (_, index) =>
        logEvent({ type: 'test.race', correlationId, fields: { index } }),
      ),
    );

    const written = await queryEvents({ correlationId, limit: 100 });
    expect(written).toHaveLength(25);
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

  it('drops partitions outside the retention window (AC 16)', async () => {
    await db().query(
      "create table if not exists events_2020_01_01 partition of events for values from ('2020-01-01') to ('2020-01-02')",
    );
    const dropped = await dropExpiredEventPartitions(30);
    expect(dropped).toContain('events_2020_01_01');

    // Today's partition, which is in use, is left alone.
    const today = `events_${new Date().toISOString().slice(0, 10).replace(/-/g, '_')}`;
    expect(dropped).not.toContain(today);
  });
});
