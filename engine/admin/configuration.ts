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
  /** The addresses that may open this area, and the whole domains that may. */
  people: string[];
  peopleDomains: string[];
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
      {
        key: 'DATABASE_URL',
        set: config.databaseUrl !== '',
        what: 'Where Core keeps its records. Core does not start without it.',
      },
      {
        key: 'CREDENTIALS_KEY',
        set: config.credentialsKey !== '',
        what: 'The key that locks the CRM logins, the tokens and the kept forms in the database. Core does not start without it.',
      },
      {
        key: 'SENTRY_DSN',
        set: config.sentryDsn !== null,
        what: 'Where Core reports an error nobody expected, for the engineers.',
      },
      {
        key: 'POSTMARK_SERVER_TOKEN',
        set: config.postmarkServerToken !== null,
        what: 'The key Core sends its mail with: the sign-in links and the alerts.',
      },
      {
        key: 'MAIL_FROM',
        set: config.mailFrom !== null,
        what: 'The address Core’s mail comes from.',
      },
      {
        key: 'PUBLIC_URL',
        set: config.publicUrl !== null,
        what: 'Core’s own web address, for the links in its alerts and mails.',
      },
      {
        key: 'ALERT_EMAIL',
        set: config.alertEmail !== null,
        what: 'The address Core mails its alerts to.',
      },
      {
        key: 'ALERT_SLACK_WEBHOOK_URL',
        set: config.alertSlackWebhookUrl !== null,
        what: 'The Slack address Core posts its alerts to.',
      },
      {
        key: 'ADMIN_EMAILS',
        set: config.adminEmails.length > 0,
        what: 'The addresses that may sign in here, one by one.',
      },
      {
        key: 'ADMIN_EMAIL_DOMAINS',
        set: config.adminEmailDomains.length > 0,
        what: 'Whole domains, such as kowboy.se, whose every address may sign in here.',
      },
    ],
    alerts: {
      email: config.alertEmail,
      slack: config.alertSlackWebhookUrl !== null,
      mail: mailConfigured(),
    },
    people: config.adminEmails,
    peopleDomains: config.adminEmailDomains,
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
