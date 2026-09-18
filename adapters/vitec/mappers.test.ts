// Vitec's change dates (verified against Connect 2026-09-18, README): bare Swedish wall-clock
// time, read in Vitec's zone; an offset, when given, honoured.
import { describe, expect, it } from 'vitest';
import { isoDate } from './mappers.js';

describe('Vitec change dates', () => {
  it('reads a bare value as Swedish time, winter and summer', () => {
    expect(isoDate('2026-02-27T14:29:22.97')).toBe('2026-02-27T13:29:22.970Z');
    expect(isoDate('2026-08-31T11:46:09.65')).toBe('2026-08-31T09:46:09.650Z');
    expect(isoDate('2024-05-17T10:42:20')).toBe('2024-05-17T08:42:20.000Z');
  });

  it('settles the offset on the days the clocks change', () => {
    expect(isoDate('2026-03-29T01:30:00')).toBe('2026-03-29T00:30:00.000Z');
    expect(isoDate('2026-03-29T03:30:00')).toBe('2026-03-29T01:30:00.000Z');
    expect(isoDate('2026-10-25T04:00:00')).toBe('2026-10-25T03:00:00.000Z');
  });

  it('honours an offset when Vitec gives one, and refuses what is not a date', () => {
    expect(isoDate('2026-09-10T08:00:00.1234567+02:00')).toBe('2026-09-10T06:00:00.123Z');
    expect(isoDate('2026-09-10T06:00:00Z')).toBe('2026-09-10T06:00:00.000Z');
    expect(isoDate('soon')).toBeNull();
    expect(isoDate(null)).toBeNull();
  });
});
