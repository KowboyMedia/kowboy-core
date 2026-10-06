/** Every setting the engine reads from the environment. Nothing else reads process.env. */
export type Config = {
  databaseUrl: string;
  port: number;
  /** The alert mail's sender and the token of the service that sends it; unset means no mail. */
  mailFrom: string | null;
  postmarkServerToken: string | null;
  credentialsKey: string;
  sentryDsn: string | null;
  /** What this Core is: staging, production, local. Named in alerts, told to Sentry. */
  environment: string;
  /** Where this Core is reached, for the links in alerts; unset means alerts carry no link. */
  publicUrl: string | null;
  /** Where an alert goes when a health check changes state: an address, a Slack incoming webhook, both, or neither. */
  alertEmail: string | null;
  alertSlackWebhookUrl: string | null;
  bellThrottleMs: number;
  eventRetentionDays: number;
  gzipLevel: number;
  /** The addresses that may open the admin area, one by one. */
  adminEmails: string[];
  /**
   * Whole domains that may open it: anyone at one of these addresses. The sign-in page never
   * says so, and answers an address it will not let in exactly as it answers one it will
   * (Patric, 2026-09-21).
   */
  adminEmailDomains: string[];
  /** How long a sign-in link lasts, and a session made from one. */
  adminLinkMinutes: number;
  adminSessionDays: number;
  /** How long a session lasts when the person asked to be remembered on that device. */
  adminRememberDays: number;
  /**
   * The bot check on every form (docs/forms.md, question 138): Turnstile's public site key, which
   * a site's form window renders the challenge with, and the secret Core verifies its proof with.
   * Both unset means no check: staging and local take forms without one, the live service none.
   */
  turnstileSiteKey: string | null;
  turnstileSecret: string | null;
};

const required = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value === '') throw new Error(`${name} is not set`);
  return value;
};

/** A setting that may be absent: null when unset or empty. */
const optional = (name: string): string | null => process.env[name] || null;

const numberOr = (name: string, fallback: number): number => Number(process.env[name] ?? fallback);

/** A setting holding several values, separated by commas; empty entries are dropped. */
const list = (name: string): string[] =>
  (optional(name) ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

export function loadConfig(): Config {
  return {
    databaseUrl: required('DATABASE_URL'),
    port: numberOr('PORT', 3000),
    mailFrom: optional('MAIL_FROM'),
    postmarkServerToken: optional('POSTMARK_SERVER_TOKEN'),
    credentialsKey: required('CREDENTIALS_KEY'),
    sentryDsn: optional('SENTRY_DSN'),
    environment: optional('SENTRY_ENVIRONMENT') ?? 'local',
    publicUrl: optional('PUBLIC_URL')?.replace(/\/$/, '') ?? null,
    alertEmail: optional('ALERT_EMAIL'),
    alertSlackWebhookUrl: optional('ALERT_SLACK_WEBHOOK_URL'),
    bellThrottleMs: numberOr('BELL_THROTTLE_MS', 10_000),
    eventRetentionDays: numberOr('EVENT_RETENTION_DAYS', 30),
    gzipLevel: numberOr('GZIP_LEVEL', 3),
    adminEmails: list('ADMIN_EMAILS'),
    adminEmailDomains: list('ADMIN_EMAIL_DOMAINS').map((domain) => domain.replace(/^@/, '')),
    adminLinkMinutes: numberOr('ADMIN_LINK_MINUTES', 15),
    adminSessionDays: numberOr('ADMIN_SESSION_DAYS', 14),
    adminRememberDays: numberOr('ADMIN_REMEMBER_DAYS', 30),
    turnstileSiteKey: optional('TURNSTILE_SITE_KEY'),
    turnstileSecret: optional('TURNSTILE_SECRET'),
  };
}
