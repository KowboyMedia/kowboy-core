// Setup directions for Vitec at the top of its panel (Patric, 2026-09-18: every adapter's page
// tells a cold reader how to set it up, and stays up to date). Built from what the adapter reads;
// directions.test.ts fails when a setting, a lifecycle event, a health check or a credential field
// exists in the code without a line here.
import * as connect from '../api.js';
import { card, escape, pill, table } from '../../../engine/adapter-api/index.js';

export function directions(): string {
  const steps = table(
    ['Step', 'What to do'],
    [
      [
        '1. Tenant',
        'On Tenants, make the tenant. Its token is on the tenant’s page and goes into the site’s settings.',
      ],
      [
        '2. Connection',
        'On the tenant’s page, add a connection with the CRM <code>vitec</code> and the offices as customer ids (<code>M30011</code> and the like), then open it and save the <em>Connect username</em> and <em>Connect password</em> (the key pair Vitec issues per customer in its partner portal). “Load everything” (the event <code>connection_added</code>) fetches every record of those offices. A connection without offices fetches nothing, and <code>vitec.catch_up</code> says so.',
      ],
      [
        '3. Notifications',
        'Give Vitec the notification URL, <code>/v1/hook/vitec/webhook/…</code> on this app’s domain with the token filled in (the next card shows it), and ask for subscriptions on <code>Estate</code>, limited to estates advertised on the website, for <code>Update</code> and <code>Remove</code>, and on <code>Project</code>, <code>User</code>, <code>Office</code> and <code>Area</code>. Until they exist, changes arrive with the catch-up instead.',
      ],
      [
        '4. More offices',
        'Add the office on the connection and run “Load these offices” (the event <code>offices_added</code>): only the new ones are fetched. “Resync” (the event <code>resync</code>) fetches one datatype again for the whole connection.',
      ],
      [
        '5. Check',
        'On the dashboard, <code>vitec.webhook_lag</code>, <code>vitec.retries</code>, <code>vitec.catch_up</code>, <code>vitec.offices</code> and <code>vitec.connect</code> are green, and the first notification shows on a record’s timeline as <code>webhook.received</code>.',
      ],
    ],
  );
  const token = process.env['VITEC_WEBHOOK_TOKEN'];
  const environment = table(
    ['Setting', 'Now', 'What it does'],
    [
      [
        '<code>VITEC_WEBHOOK_TOKEN</code>',
        token ? pill('ok', 'set') : pill('bad', 'not set'),
        'The secret in the notification URL; without it the listener answers 503.',
      ],
      [
        '<code>VITEC_BASE_URL</code>',
        `<code>${escape(connect.baseUrl())}</code>`,
        'Where Vitec Connect is. Only the tests point it elsewhere.',
      ],
      [
        '<code>VITEC_FETCH_CONCURRENCY</code>',
        escape(connect.concurrency()),
        'Requests to Connect at once, lists included.',
      ],
      [
        '<code>VITEC_REQUESTS_PER_SECOND</code>',
        escape(connect.requestsPerSecond()),
        'The speed limit towards Connect, so a load never looks like an attack.',
      ],
    ],
  );
  return card(
    'Set up Vitec',
    'How a customer’s Vitec account gets onto Core, in order. The settings are the app’s environment, set at deploy; everything else happens on the panel.',
    `${steps}<h4 class="mt-3">Settings</h4>${environment}`,
  );
}
