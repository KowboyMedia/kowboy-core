/** Every setting the engine reads from the environment. Nothing else reads process.env. */
export type Config = {
  databaseUrl: string;
  port: number;
  adminSecret: string;
  /** Email domains whose addresses may log in to the admin panel; empty means nobody. */
  adminEmailDomains: string[];
  /** Maintenance switch (Patric, 2026-09-19): while the mailbox is down, an allowed-domain address
   * logs in straight from the form, with no mailed link. Off unless ADMIN_LOGIN_WITHOUT_EMAIL is
   * exactly "true"; turn it off again by unsetting it. */
  adminLoginWithoutEmail: boolean;
  /** The login mail's sender and the token of the service that sends it; unset means no mail. */
  mailFrom: string | null;
  postmarkServerToken: string | null;
  credentialsKey: string;
  sentryDsn: string | null;
  /** What Core reports itself as to Sentry: staging, production, local. */
  sentryEnvironment: string | null;
  bellThrottleMs: number;
  eventRetentionDays: number;
  gzipLevel: number;
};

const required = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value === '') throw new Error(`${name} is not set`);
  return value;
};

export function loadConfig(): Config {
  return {
    databaseUrl: required('DATABASE_URL'),
    port: Number(process.env.PORT ?? 3000),
    adminSecret: required('ADMIN_SECRET'),
    adminEmailDomains: (process.env.ADMIN_EMAIL_DOMAINS ?? '')
      .split(',')
      .map((domain) => domain.trim().toLowerCase())
      .filter(Boolean),
    adminLoginWithoutEmail: process.env.ADMIN_LOGIN_WITHOUT_EMAIL === 'true',
    mailFrom: process.env.MAIL_FROM || null,
    postmarkServerToken: process.env.POSTMARK_SERVER_TOKEN || null,
    credentialsKey: required('CREDENTIALS_KEY'),
    sentryDsn: process.env.SENTRY_DSN || null,
    sentryEnvironment: process.env.SENTRY_ENVIRONMENT || null,
    bellThrottleMs: Number(process.env.BELL_THROTTLE_MS ?? 10_000),
    eventRetentionDays: Number(process.env.EVENT_RETENTION_DAYS ?? 30),
    gzipLevel: Number(process.env.GZIP_LEVEL ?? 3),
  };
}
