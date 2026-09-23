// Formatting primitives the ledger entries share (rules-ledger/R-001 Money and numbers). Pure:
// same input, same output, no clock beyond the zone the dates are shown in.

/** A hard space: a number never breaks across lines. */
export const NBSP = ' ';

/** The zone every date in `display` is shown in: the sites are Swedish. */
const DISPLAY_ZONE = 'Europe/Stockholm';

const dateFormat = new Intl.DateTimeFormat('sv-SE', {
  timeZone: DISPLAY_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** `4950000` → `4 950 000`, `45.5` → `45,5`: thousands by a hard space, a decimal comma, at most two decimals. */
export function formatNumber(value: number): string {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  const [whole = '0', fraction] = Math.abs(rounded).toString().split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const sign = rounded < 0 ? '-' : '';
  return fraction ? `${sign}${grouped},${fraction}` : `${sign}${grouped}`;
}

/** SEK is written `kr`; any other currency by its code. */
export const currencyWord = (currency: string | null | undefined): string =>
  !currency || currency.toUpperCase() === 'SEK' ? 'kr' : currency;

/** `4950000, "SEK"` → `4 950 000 kr`; nothing for a missing or zero amount (R-001). */
export function money(amount: unknown, currency: string | null | undefined): string | null {
  if (!isNumber(amount) || amount === 0) return null;
  return `${formatNumber(amount)}${NBSP}${currencyWord(currency)}`;
}

/** A number with a unit after a hard space; nothing for a missing or zero value. */
export function withUnit(value: unknown, unit: string): string | null {
  if (!isNumber(value) || value === 0) return null;
  return `${formatNumber(value)}${NBSP}${unit}`;
}

/** A moment (ISO 8601) as the date it falls on in Swedish time: `2026-09-01`. */
export function date(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : dateFormat.format(parsed);
}

export const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

/** `true` → `Ja`, `false` → `Nej`, anything else nothing. */
export const yesNo = (value: unknown): string | null =>
  value === true ? 'Ja' : value === false ? 'Nej' : null;

/** The given parts that exist, joined; nothing when none exists. */
export const join = (parts: (string | null)[], separator: string): string | null => {
  const present = parts.filter((part): part is string => !!part);
  return present.length ? present.join(separator) : null;
};

/** `{min, max}` → `2 000 000 – 5 000 000 kr`, `från 2 000 000 kr`, `upp till 5 000 000 kr` (R-014). */
export function range(value: unknown, format: (amount: number) => string | null): string | null {
  const bounds = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const min = isNumber(bounds['min']) && bounds['min'] !== 0 ? bounds['min'] : null;
  const max = isNumber(bounds['max']) && bounds['max'] !== 0 ? bounds['max'] : null;
  if (min !== null && max !== null) {
    if (min === max) return format(min);
    const low = formatNumber(min);
    return `${low} – ${format(max)}`;
  }
  if (min !== null) return `från ${format(min)}`;
  if (max !== null) return `upp till ${format(max)}`;
  return null;
}
