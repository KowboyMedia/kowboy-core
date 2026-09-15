import { describe, expect, it } from 'vitest';
import { applyRules } from './run.js';
import { decimal, groupDigits, slugify } from './format.js';

const property = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'OBJ-1',
  slug: '',
  status: 'for_sale',
  listing_type: 'apartment',
  address: { street: 'Storgatan 12', city: 'Lidingö', postal_code: '18131' },
  price: 4950000,
  living_space: 82,
  additional_space: 12,
  rooms: 3,
  lat: null,
  lng: null,
  office_id: '100',
  area_ids: [],
  agent_ids: [],
  association_id: null,
  images: [],
  viewings: [],
  published_at: null,
  sold_at: null,
  display: {},
  provider_extras: {},
  ...overrides,
});

describe('formatting helpers', () => {
  it('groups digits with a plain space', () => {
    expect(groupDigits(4950000)).toBe('4 950 000');
    expect(groupDigits(950)).toBe('950');
  });

  it('writes decimals the Swedish way', () => {
    expect(decimal(3)).toBe('3');
    expect(decimal(3.5)).toBe('3,5');
  });

  it('folds non-ASCII letters in slugs', () => {
    expect(slugify('Storgatan 12', 'Lidingö')).toBe('storgatan-12-lidingo');
    expect(slugify('Ängsvägen 3', 'Växjö')).toBe('angsvagen-3-vaxjo');
    expect(slugify(null, undefined)).toBe('');
  });
});

describe('property display rules', () => {
  it('formats the four display fields the data contract shows', () => {
    const data = applyRules('property', property());
    expect(data['display']).toEqual({
      price: '4 950 000 kr',
      living_space: '82 + 12 m²',
      rooms: '3 rum',
      address: 'Storgatan 12, Lidingö',
    });
    expect(data['slug']).toBe('storgatan-12-lidingo');
  });

  it('leaves out additional space when there is none', () => {
    const data = applyRules('property', property({ additional_space: null }));
    expect((data['display'] as Record<string, string>)['living_space']).toBe('82 m²');
  });

  it('omits display.price when the CRM has no price', () => {
    const data = applyRules('property', property({ price: null }));
    expect((data['display'] as Record<string, string>)['price']).toBeUndefined();
  });

  it('drops images without a URL and sorts the rest', () => {
    const data = applyRules(
      'property',
      property({
        images: [
          { url: 'https://cdn/2.jpg', sort: 2 },
          { url: '', sort: 0 },
          { url: 'https://cdn/1.jpg', sort: 1 },
        ],
      }),
    );
    expect(data['images']).toEqual([
      { url: 'https://cdn/1.jpg', sort: 1 },
      { url: 'https://cdn/2.jpg', sort: 2 },
    ]);
  });

  it('is pure: the same input always gives the same output', () => {
    const input = property();
    expect(applyRules('property', input)).toEqual(applyRules('property', input));
    expect(input['slug']).toBe('');
  });
});
