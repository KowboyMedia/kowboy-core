// Times as the panel writes them, on Stockholm's clock as Core's mails are: "06:02" today,
// "yesterday 21:14", "12 Oct 21:14" before that, and a date as "14 Nov".

const ZONE = 'Europe/Stockholm';

const parts = (
  at: Date,
): { day: string; hour: number; clock: string; seconds: string; date: string } => {
  const read = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (type: string): string => read.find((part) => part.type === type)?.value ?? '';
  return {
    day: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
    clock: `${get('hour')}:${get('minute')}`,
    seconds: `${get('hour')}:${get('minute')}:${get('second')}`,
    date: new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, day: 'numeric', month: 'short' })
      .format(at)
      .replace('Sept', 'Sep'),
  };
};

const yesterdayOf = (now: Date): string => parts(new Date(now.getTime() - 86_400_000)).day;

/** "14 Nov". */
export const dateOf = (iso: string): string => parts(new Date(iso)).date;

/** A time ahead, in words: "today at 06:02", "tomorrow at 06:02", "on 18 Oct at 06:02". */
export function ahead(iso: string, now: Date): string {
  const at = parts(new Date(iso));
  if (at.day === parts(now).day) return `today at ${at.clock}`;
  if (at.day === parts(new Date(now.getTime() + 86_400_000)).day) return `tomorrow at ${at.clock}`;
  return `on ${at.date} at ${at.clock}`;
}

/** "06:02" today, "yesterday 21:14", "12 Oct 21:14" before. */
export function when(iso: string, now: Date): string {
  const at = parts(new Date(iso));
  if (at.day === parts(now).day) return at.clock;
  if (at.day === yesterdayOf(now)) return `yesterday ${at.clock}`;
  return `${at.date} ${at.clock}`;
}

/** To the second, as the Flow lists what moves within a minute: "10:41:07", "yesterday 21:14:02". */
export function exactly(iso: string, now: Date): string {
  const at = parts(new Date(iso));
  if (at.day === parts(now).day) return at.seconds;
  if (at.day === yesterdayOf(now)) return `yesterday ${at.seconds}`;
  return `${at.date} ${at.seconds}`;
}

/** When something was sent, in words: "last night", "today", "yesterday", "on 12 Oct". */
export function sentWhen(iso: string, now: Date): string {
  const at = parts(new Date(iso));
  if (at.day === parts(now).day) return at.hour < 5 ? 'last night' : 'today';
  if (at.day === yesterdayOf(now)) return at.hour >= 18 ? 'last night' : 'yesterday';
  return `on ${at.date}`;
}

/** How long ago, as the Core-down banner says it: "8 min ago", "2 h 5 min ago", "3 days ago". */
export function ago(iso: string, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / 60_000));
  if (minutes < 1) return 'under a minute ago';
  if (minutes < 60) return `${String(minutes)} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48)
    return `${String(hours)} h${minutes % 60 ? ` ${String(minutes % 60)} min` : ''} ago`;
  return `${String(Math.floor(hours / 24))} days ago`;
}

/** "a, b and c". */
export const listed = (items: string[], last = 'and'): string =>
  items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} ${last} ${items[items.length - 1] ?? ''}`;

/** "1 thing", "4 things". */
export const counted = (n: number, one: string, many: string): string =>
  `${String(n)} ${n === 1 ? one : many}`;

/** Whether a time falls on the same day as now, on Stockholm's clock: "Fixed today". */
export const sameDay = (iso: string, now: Date): boolean =>
  parts(new Date(iso)).day === parts(now).day;

/** The clock time alone: "09:53". */
export const clock = (iso: string): string => parts(new Date(iso)).clock;

/** A sentence's first letter in capitals: "Yesterday 21:14". */
export const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
