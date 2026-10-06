// Numbers and lengths of time inside a sentence, for the texts a person reads in the admin area
// and in the alerts (AGENTS.md, definition of done item 5: "one site has", "three sites have",
// never "site(s)").

const NUMBERS = [
  'no',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
];

/** A count that agrees with its noun: "one site", "three sites", "12 sites". */
export const counted = (n: number, one: string, many: string): string =>
  `${NUMBERS[n] ?? String(n)} ${n === 1 ? one : many}`;

/** A length of time in words, rounded down: "40 seconds", "12 minutes", "three hours", "two days". */
export function lasting(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return counted(seconds, 'second', 'seconds');
  if (seconds < 3_600) return counted(Math.floor(seconds / 60), 'minute', 'minutes');
  if (seconds < 172_800) return counted(Math.floor(seconds / 3_600), 'hour', 'hours');
  return counted(Math.floor(seconds / 86_400), 'day', 'days');
}

/** Things in a sentence: "a", "a and b", "a, b and c". */
export function listed(things: string[]): string {
  if (things.length < 2) return things.join('');
  return `${things.slice(0, -1).join(', ')} and ${things.at(-1) ?? ''}`;
}

/** A phrase as a sentence of its own: a capital first, a full stop last. */
export function sentence(phrase: string): string {
  const trimmed = phrase.trim();
  const ended = /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  return ended.charAt(0).toUpperCase() + ended.slice(1);
}
