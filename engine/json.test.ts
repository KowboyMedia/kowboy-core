import { describe, expect, it } from 'vitest';
import { canonicalJson, contentHash } from './json.js';

describe('canonical JSON', () => {
  it('sorts keys so the same value always gives the same bytes', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
  });

  it('keeps array order', () => {
    expect(canonicalJson([3, 1, 2])).toBe('[3,1,2]');
  });
});

describe('content hash', () => {
  it('ignores provider_extras, so provider-only fields cause no new seq', () => {
    const a = contentHash({ id: '1', provider_extras: { x: { code: 1 } } });
    const b = contentHash({ id: '1', provider_extras: { x: { code: 999 } } });
    expect(a).toBe(b);
  });

  it('changes when a contract field changes', () => {
    expect(contentHash({ id: '1', price: 100 })).not.toBe(contentHash({ id: '1', price: 200 }));
  });

  it('does not depend on key order', () => {
    expect(contentHash({ a: 1, b: 2 })).toBe(contentHash({ b: 2, a: 1 }));
  });
});
