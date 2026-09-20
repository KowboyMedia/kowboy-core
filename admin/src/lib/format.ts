// Every time on the panel is Swedish time, `2026-09-20 13:05:12`, with the exact UTC moment on
// hover; Core itself stores and sends only moments. Numbers are Swedish too: spaces between groups.

export const TIME_ZONE = 'Europe/Stockholm';

const local = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const dayOnly = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const hourOnly = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export const fmtMoment = (value: string | Date | null | undefined): string =>
  value ? local.format(new Date(value)) : '';

export const fmtDay = (value: string | Date): string => dayOnly.format(new Date(value));
export const fmtHour = (value: string | Date): string => hourOnly.format(new Date(value));

export const fmtUtc = (value: string | Date | null | undefined): string =>
  value ? new Date(value).toISOString().replace('T', ' ').replace('Z', ' UTC') : '';

/** "just now", "4 min ago", "3 h ago", "2 d ago". */
export function fmtAgo(value: string | Date | null | undefined): string {
  if (!value) return 'never';
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 45) return 'just now';
  if (seconds < 3_600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3_600)} h ago`;
  return `${Math.round(seconds / 86_400)} d ago`;
}

const number = new Intl.NumberFormat('sv-SE');
export const fmtNumber = (value: number | string | null | undefined): string =>
  value === null || value === undefined || value === '' ? '0' : number.format(Number(value));

export const fmtBytes = (bytes: number): string =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1_048_576
      ? `${(bytes / 1024).toFixed(1)} kB`
      : `${(bytes / 1_048_576).toFixed(2)} MB`;

export const fmtMs = (ms: number): string =>
  ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;

/** Today's day in Swedish time, `2026-09-20`, for date filters. */
export const today = (): string => fmtDay(new Date());

/** A Swedish day as the moment it starts, ISO, for the API's date filters. */
export function startOfDay(day: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined;
  const guess = new Date(`${day}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'longOffset',
  })
    .formatToParts(guess)
    .find((part) => part.type === 'timeZoneName')?.value;
  const match = /([+-])(\d{2}):(\d{2})/.exec(parts ?? '');
  const offsetMinutes = match
    ? (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]))
    : 0;
  return new Date(guess.getTime() - offsetMinutes * 60_000).toISOString();
}

/** The day after, as the moment it starts, for an inclusive "to" day. */
export function endOfDay(day: string): string | undefined {
  const start = startOfDay(day);
  return start ? new Date(new Date(start).getTime() + 86_400_000).toISOString() : undefined;
}
