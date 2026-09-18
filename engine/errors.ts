// Error reporting (strategy §2; question 36, Patric 2026-09-18): every unexpected error goes to
// stderr as one line of JSON and, when a DSN is set, to Sentry. A throttle in front of Sentry
// keeps a repeating error to one report per window and the whole process to a cap per hour, so a
// busy site or a broken loop never turns into a bill; Sentry's own duplicate filter runs on top.
// No performance tracing. Nothing here reads credentials, and callers never pass them.
import * as Sentry from '@sentry/node';

/** A repeating error leaves once per window, and at most this many reports leave per hour. */
export const REPEAT_WINDOW_MS = 10 * 60_000;
export const HOURLY_CAP = 100;

export type Gate = (fingerprint: string, now?: number) => boolean;

/** The throttle on its own, so the tests can drive the clock. */
export function throttle(): Gate {
  const lastSent = new Map<string, number>();
  let hourStart = 0;
  let sentThisHour = 0;
  return (fingerprint, now = Date.now()) => {
    if (now - hourStart >= 3_600_000) {
      hourStart = now;
      sentThisHour = 0;
      for (const [key, at] of lastSent) if (now - at >= REPEAT_WINDOW_MS) lastSent.delete(key);
    }
    const last = lastSent.get(fingerprint);
    if (last !== undefined && now - last < REPEAT_WINDOW_MS) return false;
    if (sentThisHour >= HOURLY_CAP) return false;
    lastSent.set(fingerprint, now);
    sentThisHour += 1;
    return true;
  };
}

const gate = throttle();
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
  const what = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  if (!gate(`${what} | ${String(context['where'] ?? '')}`)) return;
  Sentry.captureException(error instanceof Error ? error : new Error(String(error)), {
    extra: context,
  });
}

/** Give Sentry a moment to deliver what is queued, at shutdown. */
export async function closeErrorReporting(): Promise<void> {
  if (sending) await Sentry.close(2_000);
}
