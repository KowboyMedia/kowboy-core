// How the area writes a moment, a number and an age, in one place, so every page says it the same
// way. Dates are written as Sweden writes them (Patric, 2026-09-21): year first, then month, then
// day, in Stockholm time — 2026-09-21 14:05 — and never the CRM's or the server's own zone.

const NEVER = '—';

/** Sweden's way, in Stockholm time, whatever the browser's own settings say. */
const SWEDISH = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Stockholm',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const SWEDISH_WITH_SECONDS = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Stockholm',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const parse = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at;
};

/** A moment to the minute: 2026-09-21 14:05. */
export function moment(value: string | null | undefined): string {
  const at = parse(value);
  return at ? SWEDISH.format(at) : NEVER;
}

/** A moment to the second, where the order of two things in the same minute matters. */
export function exact(value: string | null | undefined): string {
  const at = parse(value);
  return at ? SWEDISH_WITH_SECONDS.format(at) : NEVER;
}

/** "4 minutes ago", for the things a person judges by how fresh they are. */
export function ago(value: string | null | undefined): string {
  const at = parse(value);
  if (!at) return 'never';
  const seconds = Math.round((Date.now() - at.getTime()) / 1000);
  if (seconds < 60) return `${Math.max(seconds, 0)} s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)} h ago`;
  return `${Math.round(seconds / 86_400)} days ago`;
}

export const count = (value: number | null | undefined): string =>
  value === null || value === undefined ? NEVER : value.toLocaleString('sv-SE');

/** The hour label on the day's chart, in Stockholm time. */
export const hour = (value: string): string => moment(value).slice(11, 16);
