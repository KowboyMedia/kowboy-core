// Times on the panel (Patric, 2026-09-18): Swedish time to read, the exact UTC moment to hover.
import { describe, expect, it } from 'vitest';
import { stamp, when } from './html.js';

describe('times on the panel', () => {
  it('shows a moment in Swedish time, summer and winter', () => {
    expect(stamp('2026-08-24T15:24:45.977Z')).toBe('2026-08-24 17:24:45');
    expect(stamp(new Date('2026-01-05T23:30:00Z'))).toBe('2026-01-06 00:30:00');
  });

  it('keeps the UTC moment in the tooltip, and leaves what is not a date alone', () => {
    expect(when('2026-08-24T15:24:45.977Z')).toBe(
      '<time class="text-nowrap" datetime="2026-08-24T15:24:45.977Z" title="2026-08-24T15:24:45.977Z">2026-08-24 17:24:45</time>',
    );
    expect(when(null)).toContain('–');
    expect(stamp('long ago')).toBe('long ago');
  });
});
