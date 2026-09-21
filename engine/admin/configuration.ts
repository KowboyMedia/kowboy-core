// The Settings page (§3 H): what this Core is configured with, what the database holds, which
// versions are running, and the two switches a person throws. A setting's value is never shown,
// only whether it is set, so a screen share never leaks one.
import { migrationsApplied } from '../storage/migrate.js';
import { RULES_VERSION } from '../rules/run.js';
import { SCHEMA_VERSION } from '../contract.js';
import { STARTED_AT, VERSION } from '../version.js';
import { mailConfigured } from '../mail.js';
import {
  inMaintenance,
  MAINTENANCE,
  settings as storedSettings,
  writeSetting,
} from '../storage/settings.js';
import { currentConfig } from './auth.js';

export type Configuration = {
  environment: string;
  version: string;
  startedAt: string;
  rulesVersion: string;
  schemaVersion: string;
  publicUrl: string | null;
  eventRetentionDays: number;
  bellThrottleMs: number;
  /** Whether each secret or address is set, never its value. */
  set: { key: string; set: boolean; what: string }[];
  alerts: { email: string | null; slack: boolean; mail: boolean };
  /** The addresses that may open this area. */
  people: string[];
  migrations: string[];
  maintenance: boolean;
  switches: Awaited<ReturnType<typeof storedSettings>>;
};

export async function configuration(): Promise<Configuration> {
  const config = currentConfig();
  return {
    environment: config.environment,
    version: VERSION,
    startedAt: STARTED_AT,
    rulesVersion: RULES_VERSION,
    schemaVersion: SCHEMA_VERSION,
    publicUrl: config.publicUrl,
    eventRetentionDays: config.eventRetentionDays,
    bellThrottleMs: config.bellThrottleMs,
    set: [
      { key: 'DATABASE_URL', set: config.databaseUrl !== '', what: 'where the records are kept' },
      {
        key: 'CREDENTIALS_KEY',
        set: config.credentialsKey !== '',
        what: 'what encrypts the CRM logins and the tokens',
      },
      { key: 'SENTRY_DSN', set: config.sentryDsn !== null, what: 'where unexpected errors go' },
      {
        key: 'POSTMARK_SERVER_TOKEN',
        set: config.postmarkServerToken !== null,
        what: 'what sends the mail',
      },
      { key: 'MAIL_FROM', set: config.mailFrom !== null, what: 'the address the mail comes from' },
      {
        key: 'PUBLIC_URL',
        set: config.publicUrl !== null,
        what: 'where this Core is reached, for the links in alerts',
      },
      { key: 'ALERT_EMAIL', set: config.alertEmail !== null, what: 'where an alert is mailed' },
      {
        key: 'ALERT_SLACK_WEBHOOK_URL',
        set: config.alertSlackWebhookUrl !== null,
        what: 'where an alert is posted',
      },
      { key: 'ADMIN_EMAILS', set: config.adminEmails.length > 0, what: 'who may open this area' },
    ],
    alerts: {
      email: config.alertEmail,
      slack: config.alertSlackWebhookUrl !== null,
      mail: mailConfigured(),
    },
    people: config.adminEmails,
    migrations: await migrationsApplied(),
    maintenance: await inMaintenance(),
    switches: await storedSettings(),
  };
}

/**
 * Maintenance. While it is on, Core keeps answering the sites' pulls exactly as before — nothing a
 * visitor sees changes — but no site is rung and no job is taken. Changes made meanwhile are
 * remembered and go out in one round when it is turned off.
 */
export async function setMaintenance(on: boolean, by: string): Promise<void> {
  await writeSetting(MAINTENANCE, on ? 'on' : 'off', by);
}
