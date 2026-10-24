// One test warning to the alert address, through the app's own mail settings: proof that an alert
// reaches its reader (final release, condition 5). It runs as a one-off job of the app, built from
// the same version, since a session cannot always reach the mail service itself; the job is taken
// out again once it has run. It reads nothing else and prints no setting.
//
//   AWS_SES_…=… ALERT_EMAIL=… node scripts/send-test-warning.mjs
import { from, ses } from '../dist/engine/mail.js';

const env = process.env;
const missing = [
  'AWS_SES_AWS_ACCESS_KEY_ID',
  'AWS_SES_SECRET_ACCESS_KEY',
  'AWS_SES_AWS_REGION',
  'AWS_SES_SENDER',
  'ALERT_EMAIL',
].filter((name) => !env[name]);
if (missing.length > 0) {
  console.error(`test warning not sent: ${missing.join(', ')} not set`);
  process.exit(1);
}

const environment = env['SENTRY_ENVIRONMENT'] ?? 'local';
const inbox = env['PUBLIC_URL'] ? `${env['PUBLIC_URL'].replace(/\/$/, '')}/admin/` : null;
await ses(
  {
    accessKeyId: env['AWS_SES_AWS_ACCESS_KEY_ID'],
    secretAccessKey: env['AWS_SES_SECRET_ACCESS_KEY'],
    region: env['AWS_SES_AWS_REGION'],
  },
  from(environment, env['AWS_SES_SENDER']),
)({
  to: env['ALERT_EMAIL'],
  subject: 'Test warning · Nothing is wrong',
  text: [
    'This is a test warning. Nothing is wrong.',
    'Core sends its alerts to this address, by mail through Amazon SES.',
    inbox ? `What needs attention, in the Inbox: ${inbox}` : null,
  ]
    .filter(Boolean)
    .join('\n\n'),
});
console.log('test warning sent');
