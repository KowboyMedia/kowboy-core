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
        text: 'On Tenants, press “New tenant”, give the customer’s name and choose the CRM vitec. Type the Connect username and Connect password (the key pair Vitec issues per customer or group in its partner portal) and the Customer or group id Vitec issued them for (a customer id such as M30011, or a group id such as G2); no offices are typed, Vitec decides them (the next step). “Check the login” tries them at Vitec before anything is saved. Add the sites and save: the tenant is made, its token and every site’s bell secret are on the page, and Core asks Vitec which offices to load and loads every record of them (the event connection_added). A connection with no office to load fetches nothing, and vitec.catch_up says so.',
      },
      {
        title: 'Which offices reach the sites',
        text: 'This is decided in Vitec, not here. Once a day, Core asks Vitec which offices sit behind the customer or group id and reads each one with the login. If the brokerage has made an office group called “Webbplats” in Vitec and put some of those offices in it, only those offices reach its sites. If there is no such group, or it holds none of these offices, every office does. So tell the brokerage: to choose which offices show on the website, make the office group “Webbplats” in Vitec and put the website’s offices in it; nothing is changed in Core. When an office leaves the group, everything of that office (its homes, its agents and the office itself) is taken off the sites at the next check. When Vitec stops letting the login read an office, for example after a cancelled subscription, Core checks again within a minute and keeps the office on the sites for one more day; if Vitec still refuses it at the next daily check, everything of that office is taken off the sites in the same way. After the first refusal, Core asks Vitec about that office only in these checks. Each site deletes it when it next updates, and Core remembers the removal, so a site that was offline deletes it too. One more thing: Vitec only shows office groups to a login that also has access to its CRM part, which Vitec grants separately (with its own password, typed as the CRM password when Vitec issued one). Without that access Core cannot see any group and uses every office. On the tenant’s page, “Offices Vitec lists” shows the last answer and which offices reach the sites, and “Check offices now” asks at once instead of waiting a day.',
      },
      {
        title: 'Notifications',
        text: 'Give Vitec the notification URL below, /v1/hook/vitec/webhook/… on this app’s domain with the token filled in, and ask for subscriptions on Estate, limited to estates advertised on the website, for Update and Remove, and on Project, User, Office and Area. Until they exist, changes arrive with the catch-up instead.',
      },
      {
        title: 'Changes later',
        text: 'Offices are never typed in Core: to change which ones reach the sites, the brokerage changes its office group “Webbplats” in Vitec, and “Check offices now” on the tenant’s page acts on it at once (an office that came is loaded, one that went is taken off the sites). Core’s own office list of a Vitec connection stays empty, and when Core changes it anyway (the events offices_added and offices_removed) the adapter only asks Vitec again. On Manual sync, “Fetch again from the CRM” with this connection as the scope fetches Vitec’s list once more, for one datatype or all, and removes what is no longer on it (resync); “Remove everything” on the tenant’s page (connection_removed) takes every record off the sites. On Records, tick rows and press “Fetch again” (refetch) to fetch those records once more, and “Ask the CRM now” on a record’s own page shows it raw and unified without writing anything.',
      },
      {
        title: 'Forms',
        text: 'A visitor’s forms on the sites reach Vitec through Core: the free valuation is Vitec’s valuation request (the seller’s lead), the interest in a home its interest registration, the booking its viewing attendance, and the search profile a contact with a residential search profile in the CRM function group. Nothing about forms is typed on the connection: Vitec’s own defaults stand for the lead source, the intake source and the status of an interest, and a booking asks Vitec to confirm it to the visitor by e-mail, with no SMS and no reminder. Only Core’s production service sends a form to Vitec; on any other copy of Core, such as staging, a form stops just before Vitec and the visitor reads that it was not sent, while the viewing times are still read. On Overview, submissions.failing is red while the latest form to a connection went unanswered by Vitec; every call shows on the home’s timeline as crm.call.',
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
