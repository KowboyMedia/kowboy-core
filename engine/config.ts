/** Every setting the engine reads from the environment. Nothing else reads process.env. */
export type Config = {
  databaseUrl: string;
  /** The managed cluster's CA certificate, PEM, when the platform binds one; null means the system roots. */
  databaseCaCert: string | null;
  port: number;
  adminSecret: string;
  credentialsKey: string;
  sentryDsn: string | null;
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
    databaseCaCert: process.env.DATABASE_CA_CERT || null,
    port: Number(process.env.PORT ?? 3000),
    adminSecret: required('ADMIN_SECRET'),
    credentialsKey: required('CREDENTIALS_KEY'),
    sentryDsn: process.env.SENTRY_DSN || null,
    bellThrottleMs: Number(process.env.BELL_THROTTLE_MS ?? 10_000),
    eventRetentionDays: Number(process.env.EVENT_RETENTION_DAYS ?? 30),
    gzipLevel: Number(process.env.GZIP_LEVEL ?? 3),
  };
}
