// The throttle in front of Sentry (question 36): a repeating error leaves once per window, and
// only so many reports leave per hour, whatever a busy site or a broken loop throws at Core.
import { describe, expect, it } from 'vitest';
import { throttle, HOURLY_CAP, REPEAT_WINDOW_MS } from './errors.js';

describe('the error report throttle', () => {
  it('lets a repeating error through once per window, and again after it', () => {
    const gate = throttle();
    const at = 1_000_000;
    expect(gate('TypeError: fetch failed | bell', at)).toBe(true);
    expect(gate('TypeError: fetch failed | bell', at + 1_000)).toBe(false);
    expect(gate('TypeError: fetch failed | bell', at + REPEAT_WINDOW_MS - 1)).toBe(false);
    expect(gate('TypeError: fetch failed | bell', at + REPEAT_WINDOW_MS)).toBe(true);
    expect(gate('Error: something else | pull', at + 2_000)).toBe(true);
  });

  it('caps the reports that leave in one hour, then opens again', () => {
    const gate = throttle();
    const at = 5_000_000;
    let sent = 0;
    for (let n = 0; n < HOURLY_CAP + 20; n += 1) if (gate(`Error: e${n} | test`, at + n)) sent += 1;
    expect(sent).toBe(HOURLY_CAP);
    expect(gate('Error: late | test', at + 3_600_000)).toBe(true);
  });
});
