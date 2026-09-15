import { decimal, groupDigits, slugify } from './format.js';
import { RULES_VERSION } from './version.js';
import type { Canonical, Datatype } from '../adapter-api/types.js';

/**
 * Business rules and `display` (SRS §7). Every rule here is one the SRS data contract states.
 * A rule that is not written down somewhere is a question for the rules ledger, never a guess.
 *
 * Pure: same input, same output, no I/O, no clock. That is what makes recompute safe.
 */
export function applyRules(datatype: Datatype, input: Canonical): Canonical {
  const data: Canonical = { ...input, display: { ...(asRecord(input.display) ?? {}) } };
  if (datatype === 'property') applyPropertyRules(data);
  if (datatype === 'office' || datatype === 'agent') applyContactRules(data);
  if (datatype === 'area' || datatype === 'association') applyNameRules(data);
  return data;
}

export { RULES_VERSION };

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const display = (data: Canonical): Record<string, string> => data.display as Record<string, string>;

function applyPropertyRules(data: Canonical): void {
  const address = asRecord(data.address);
  const street = typeof address?.street === 'string' ? address.street : null;
  const city = typeof address?.city === 'string' ? address.city : null;

  // Slug from address and city (SRS §6.7).
  data.slug = slugify(street, city);

  // Images: drop entries without a URL, sort by `sort` (SRS §7).
  if (Array.isArray(data.images)) {
    data.images = (data.images as Record<string, unknown>[])
      .filter((image) => typeof image.url === 'string' && image.url.length > 0)
      .sort((a, b) => Number(a.sort ?? 0) - Number(b.sort ?? 0));
  }

  // display.price: "4 950 000 kr". Omitted when the CRM has no price; what to show instead is a
  // rules-ledger question, not something to invent here.
  if (typeof data.price === 'number') display(data).price = `${groupDigits(data.price)} kr`;

  // display.living_space: "82 + 12 m²", or "82 m²" without additional space (SRS §7).
  if (typeof data.living_space === 'number') {
    const additional = typeof data.additional_space === 'number' ? data.additional_space : 0;
    display(data).living_space =
      additional > 0
        ? `${decimal(data.living_space)} + ${decimal(additional)} m²`
        : `${decimal(data.living_space)} m²`;
  }

  // display.rooms: "3 rum".
  if (typeof data.rooms === 'number') display(data).rooms = `${decimal(data.rooms)} rum`;

  // display.address: "Storgatan 12, Lidingö".
  const line = [street, city].filter(Boolean).join(', ');
  if (line) display(data).address = line;
}

function applyContactRules(data: Canonical): void {
  if (typeof data.name === 'string' && data.name.trim()) display(data).name = data.name.trim();
  const address = asRecord(data.address);
  const line = [address?.street, address?.city]
    .filter((p) => typeof p === 'string' && p)
    .join(', ');
  if (line) display(data).address = line;
}

function applyNameRules(data: Canonical): void {
  if (typeof data.name === 'string' && data.name.trim()) display(data).name = data.name.trim();
}
