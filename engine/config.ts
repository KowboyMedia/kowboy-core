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
};

const required = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value === '') throw new Error(`${name} is not set`);
  return value;
};

/** A setting that may be absent: null when unset or empty. */
const optional = (name: string): string | null => process.env[name] || null;

const numberOr = (name: string, fallback: number): number => Number(process.env[name] ?? fallback);

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
  };
}
