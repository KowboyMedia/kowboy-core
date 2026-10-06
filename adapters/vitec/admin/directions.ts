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
        text: `On Tenants, press “New tenant”, give the customer’s name and choose the CRM vitec. Type the Username and Password Vitec issued for the brokerage (one pair, used for every call; Vitec’s partner portal shows them) and the Customer or group id Vitec issued them for (a customer id such as M30011, or a group id such as G2); no offices are typed, Vitec decides them (the next step). “Check the login” tries them at Vitec before anything is saved. Add the sites and save: the tenant is made, its token and every site’s bell secret are on the page, and Core asks Vitec which offices to load and loads every record of them (the event connection_added). A connection with no office to load fetches nothing, and vitec.catch_up says so. Vitec also runs a QA environment, which is Vitec’s test system. For a login Vitec issued for its QA environment, also tick “Use Vitec’s QA environment”. Every call of a QA login goes to Vitec’s QA address, ${connect.baseUrlOf('qa')}. Calls to the QA address have their own speed limit and their own turn at the fetch list, so a slow QA never holds up live Vitec. Core keeps the records of a QA login apart from those of live Vitec, even where QA uses the same office ids. Give a QA login a tenant of its own, so that test records never reach a real website. In the sections Fetch list and Refused offices on this page, and in vitec.offices on Overview, an office of a QA login shows (QA) after its id.`,
      },
      {
        title: 'Which offices reach the sites',
        text: 'This is decided in Vitec, not here. Once a day, Core asks Vitec which offices sit behind the customer or group id; when the brokerage has an office group called “Webbplats” in Vitec, only the offices in it reach the sites, and otherwise every office does. So tell the brokerage: to choose which offices show on the website, put them in the office group “Webbplats” in Vitec. An office that leaves the group, or that Vitec still refuses to let the login read a day after the first refusal, is taken off the sites with its homes and agents. On the tenant’s page, “Offices Vitec lists” shows the last answer, and “Fetch offices” asks at once instead of waiting a day.',
      },
      {
        title: 'Notifications',
        text: 'Give Vitec the notification URL below, /v1/hook/vitec/webhook/… on this app’s domain with the token filled in, and ask for subscriptions on Estate, limited to estates advertised on the website, for Update and Remove, and on Project, User, Office and Area. Until they exist, changes arrive with the catch-up instead. For a QA login, give Vitec’s QA environment the second URL below instead: /v1/hook/vitec/qa/… with the same token. Core knows from that URL that a notification is about QA’s records.',
      },
      {
        title: 'Changes later',
        text: 'Offices are never typed in Core: to change which ones reach the sites, the brokerage changes its office group “Webbplats” in Vitec, and “Fetch offices” on the tenant’s page acts on it at once (an office that came is loaded, one that went is taken off the sites). Core’s own office list of a Vitec connection stays empty, and when Core changes it anyway (the events offices_added and offices_removed) the adapter only asks Vitec again. On Manual sync, the tenant as the scope and “Fetch from the CRM, recompute and send to the sites” fetch Vitec’s list once more, for the entity types ticked or all, and remove what is no longer on it (resync); with an office or one record id in the scope, only the records Core holds there are fetched once more (refetch). “Remove everything” on the tenant’s page (connection_removed) takes every record off the sites. A saved login switched between live Vitec and its QA environment, by ticking or unticking “Use Vitec’s QA environment”, has everything the other system gave taken off the sites within a minute. Until then, the login syncs no office. Its offices are then loaded again in full from the system it is for now. On a record’s own page, “Fetch again” (refetch) fetches that record once more, and “Ask the CRM now” shows it raw and unified without writing anything.',
      },
      {
        title: 'Forms',
        text: 'A visitor’s forms on the sites reach Vitec through Core: the free valuation is Vitec’s valuation request (the seller’s lead), the interest in a home its interest registration, the booking its viewing attendance, and the search profile a contact with a residential search profile in the CRM function group. Nothing about forms is typed on the connection: Vitec’s own defaults stand for the lead source, the intake source and the status of an interest, and a booking asks Vitec to confirm it to the visitor by e-mail, with no SMS and no reminder. Only Core’s production service sends a form to Vitec; on any other copy of Core, such as staging, a form stops just before Vitec and the visitor reads that it was not sent, while the viewing times are still read. A form for a tenant with a QA login goes to Vitec’s QA environment. Only Core’s production service sends a form to Vitec’s QA environment, the same as to live Vitec. On Overview, submissions.failing is red while the latest form to a connection went unanswered by Vitec; every call shows on the home’s timeline as crm.call.',
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
        value: connect.baseUrlOf('live'),
        help: `Where live Vitec Connect is. Only the tests point it elsewhere. Vitec’s QA environment has its own address, ${connect.baseUrlOf('qa')}.`,
      },
      {
        key: 'VITEC_FETCH_CONCURRENCY',
        value: connect.concurrency(),
        help: 'Requests to Connect at once, lists included, for live Vitec and for its QA environment each.',
      },
      {
        key: 'VITEC_REQUESTS_PER_SECOND',
        value: connect.requestsPerSecond(),
        help: 'The speed limit towards Connect, so a load never looks like an attack, for live Vitec and for its QA environment each.',
      },
    ],
  };
}
