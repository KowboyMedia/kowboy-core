// Swedish formatting helpers used by display rules. Formatting only: no business decisions.

/** 4950000 → "4 950 000". Thousands separated by a plain space, as the data contract shows. */
export function groupDigits(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '-' : '';
  return sign + String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** 3 → "3", 3.5 → "3,5". Swedish decimal comma, no trailing zeroes. */
export function decimal(value: number): string {
  return String(Math.round(value * 100) / 100).replace('.', ',');
}

/** "Lidingö" → "lidingo". ASCII-folded, URL-safe, lower case (SRS §6.7). */
export function slugify(...parts: (string | null | undefined)[]): string {
  return parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ø/gi, 'o')
    .replace(/æ/gi, 'ae')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
