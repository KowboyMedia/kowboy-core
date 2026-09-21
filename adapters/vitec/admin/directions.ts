// Setup directions at the top of the Vitec page (Patric, 2026-09-18: every adapter's page tells a
// cold reader how to set it up, and stays up to date). Built from what the adapter reads;
// directions.test.ts fails when a setting, a lifecycle event, a health check or a credential
// field exists in the code without a mention here. A page of the admin area is named as
// "On <Page>", exactly as its navigation labels it, and the acceptance test checks every one
// against engine/admin/pages.ts (AGENTS.md, definition of done 5).
import * as connect from '../api.js';
import type { AdminDirections } from '../../../engine/adapter-api/index.js';

export function directions(): AdminDirections {
  const token = process.env['VITEC_WEBHOOK_TOKEN'];
  return {
    steps: [
      {
        title: 'Tenant and login',
        text: 'On Tenants, press “New tenant”, give the customer’s name and choose the CRM vitec. Type the Connect username and Connect password (the key pair Vitec issues per customer in its partner portal) and the offices as customer ids (M30011 and the like); “Check the login” tries them at Vitec before anything is saved. Add the sites and save: the tenant is made, its token and every site’s bell secret are on the page, and every record of those offices is loaded (the event connection_added). A connection without offices fetches nothing, and vitec.catch_up says so.',
      },
      {
        title: 'Notifications',
        text: 'Give Vitec the notification URL below, /v1/hook/vitec/webhook/… on this app’s domain with the token filled in, and ask for subscriptions on Estate, limited to estates advertised on the website, for Update and Remove, and on Project, User, Office and Area. Until they exist, changes arrive with the catch-up instead.',
      },
      {
        title: 'Changes later',
        text: 'Add an office on the tenant’s page and save: only the new one is loaded (the event offices_added), and an office taken away is taken off the sites (offices_removed). On Runs, “Fetch again from the CRM” with this connection as the scope fetches Vitec’s list once more, for one datatype or all, and removes what is no longer on it (resync); “Remove everything” on the tenant’s page (connection_removed) takes every record off the sites. On Records, tick rows and press “Fetch again” (refetch) to fetch those records once more, and “Ask the CRM now” on a record’s own page shows it raw and unified without writing anything.',
      },
      {
        title: 'Check',
        text: 'On Overview, vitec.webhook_lag, vitec.retries, vitec.catch_up, vitec.offices and vitec.connect are green, and the first notification shows on a record’s timeline as webhook.received. On Flow, the records Vitec sends appear as they arrive.',
      },
    ],
    settings: [
      {
        key: 'VITEC_WEBHOOK_TOKEN',
        value: token ? { text: 'set', state: 'ok' } : { text: 'not set', state: 'bad' },
        help: 'The secret in the notification URL; without it the listener answers 503.',
      },
      {
        key: 'VITEC_BASE_URL',
        value: connect.baseUrl(),
        help: 'Where Vitec Connect is. Only the tests point it elsewhere.',
      },
      {
        key: 'VITEC_FETCH_CONCURRENCY',
        value: connect.concurrency(),
        help: 'Requests to Connect at once, lists included.',
      },
      {
        key: 'VITEC_REQUESTS_PER_SECOND',
        value: connect.requestsPerSecond(),
        help: 'The speed limit towards Connect, so a load never looks like an attack.',
      },
    ],
  };
}
