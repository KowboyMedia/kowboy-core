// Error reporting placeholder (strategy §2). Sentry is not wired up yet: until SENTRY_DSN is set
// this writes to stderr and nothing else. When the account exists, this one module changes.
let dsn: string | null = null;

export function initErrorReporting(sentryDsn: string | null): void {
  dsn = sentryDsn;
  if (dsn)
    console.error('error reporting: SENTRY_DSN is set, but the Sentry client is not wired up yet');
}

/** Report an unexpected error. `context` is logged with it; never pass credentials. */
export function report(error: unknown, context: Record<string, unknown> = {}): void {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(JSON.stringify({ level: 'error', message, ...context }));
}
