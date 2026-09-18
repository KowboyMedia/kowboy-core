// Error reporting (strategy §2; question 36, Patric 2026-09-18): every unexpected error goes to
// stderr as one line of JSON and, when a DSN is set, to Sentry. The same error leaves for Sentry
// once a day, whichever process hits it: the gate is a row per distinct error in the database
// both processes share (Patric: "once per day, regardless of client or install"), and at most so
// many distinct errors leave per app a day. When the database itself is the problem, a gate in
// memory takes over with the same rule for this process. The plan holds 5,000 events a month for
// everything. No performance tracing. Nothing here reads credentials, and callers never pass them.
import * as Sentry from '@sentry/node';
import { db } from './storage/db.js';

/** A distinct error leaves once per window, and at most this many distinct errors leave per app a day. */
export const REPEAT_WINDOW_MS = 24 * 60 * 60_000;
export const DAILY_CAP = 20;

/**
 * What makes two errors the same: the name, the message with numbers and ids blanked (so
 * "record 4711 failed" and "record 4712 failed" are one error), and where it happened.
 */
export const fingerprintOf = (error: unknown, where: string): string => {
  const what = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const blanked = what.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}|\d+/gi, '#').slice(0, 300);
  return `${blanked} | ${where}`;
};

export type Gate = (fingerprint: string, now?: number) => boolean;

/** The gate in memory: the fallback when the database cannot answer, and what the tests drive. */
export function throttle(): Gate {
  const lastSent = new Map<string, number>();
  let dayStart = Number.NEGATIVE_INFINITY;
  let sentToday = 0;
  return (fingerprint, now = Date.now()) => {
    if (now - dayStart >= REPEAT_WINDOW_MS) {
      dayStart = now;
      sentToday = 0;
      for (const [key, at] of lastSent) if (now - at >= REPEAT_WINDOW_MS) lastSent.delete(key);
    }
    const last = lastSent.get(fingerprint);
    if (last !== undefined && now - last < REPEAT_WINDOW_MS) return false;
    if (sentToday >= DAILY_CAP) return false;
    lastSent.set(fingerprint, now);
    sentToday += 1;
    return true;
  };
}

/** The shared gate: the row is bumped when its day has passed, and only then the error leaves. */
async function allowShared(fingerprint: string): Promise<boolean> {
  const { rows } = await db().query<{ due: boolean }>(
    `insert into error_reports (fingerprint) values ($1)
     on conflict (fingerprint) do update set
       seen = error_reports.seen + 1,
       last_sent_at = case
         when error_reports.last_sent_at <= now() - ($2 || ' milliseconds')::interval then now()
         else error_reports.last_sent_at end
     returning (last_sent_at = now()) as due`,
    [fingerprint, String(REPEAT_WINDOW_MS)],
  );
  if (!rows[0]?.due) return false;
  const { rows: sent } = await db().query<{ n: string }>(
    `select count(*) as n from error_reports where last_sent_at > now() - ($1 || ' milliseconds')::interval`,
    [String(REPEAT_WINDOW_MS)],
  );
  return Number(sent[0]?.n ?? 0) <= DAILY_CAP;
}

const fallback = throttle();

/** Whether this error leaves for Sentry now. */
export async function allow(fingerprint: string): Promise<boolean> {
  try {
    return await allowShared(fingerprint);
  } catch {
    return fallback(fingerprint);
  }
}

let sending = false;

export function initErrorReporting(
  dsn: string | null,
  options: { environment?: string; release?: string } = {},
): void {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: options.environment ?? 'unknown',
    release: options.release,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
  sending = true;
}

/** Report an unexpected error. `context` is logged with it; never pass credentials. */
export function report(error: unknown, context: Record<string, unknown> = {}): void {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(JSON.stringify({ level: 'error', message, ...context }));
  if (!sending) return;
  const fingerprint = fingerprintOf(error, String(context['where'] ?? ''));
  void allow(fingerprint).then((due) => {
    if (!due) return;
    Sentry.captureException(error instanceof Error ? error : new Error(String(error)), {
      extra: context,
      fingerprint: [fingerprint],
    });
  });
}

/** Give Sentry a moment to deliver what is queued, at shutdown. */
export async function closeErrorReporting(): Promise<void> {
  if (sending) await Sentry.close(2_000);
}
