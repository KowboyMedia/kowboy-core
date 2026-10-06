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
        text: `On Tenants, press “New tenant”, type the brokerage’s name and choose vitec as the CRM. Type the Username and Password Vitec issued for the brokerage, which Vitec’s partner portal shows. Type the Customer or group id Vitec issued them for, a customer id such as M30011 or a group id such as G2. No offices are typed, because Vitec decides them, as the next step says. “Check the login” tries the login at Vitec before anything is saved. Add the brokerage’s sites and press “Save”. The tenant’s page then shows the tenant’s token and each site’s bell secret, which go into the sites’ plugin. Core asks Vitec which offices reach the sites and loads everything Vitec publishes for them. For a login Vitec issued for its QA environment, which is Vitec’s test system, also tick “Use Vitec’s QA environment”. Core sends every call of a QA login to ${connect.baseUrlOf('qa')} and keeps its records apart from live Vitec’s, and a slow QA environment never holds up live Vitec. Give a QA login a tenant of its own, so that test homes never reach a real website. On this page, an office of a QA login shows (QA) after its id.`,
      },
      {
        title: 'Which offices reach the sites',
        text: 'Vitec decides this, and nothing is chosen in Core. Once a day, Core asks Vitec which offices sit behind the customer or group id. When the brokerage keeps an office group called “Webbplats” in Vitec, only the offices in that group reach the sites. When there is no such group, or it holds none of these offices, every office behind the id reaches the sites. So tell the brokerage to put the offices it wants on its website in the office group “Webbplats” in Vitec. An office that leaves the group leaves the sites at the next check, with its homes and new-build projects, and its agents stay. When Vitec refuses to let the login read an office, the office stays on the sites for one more day, and leaves them if Vitec still refuses it then. On the tenant’s page, the card “Offices Vitec lists” shows the last answer, and “Fetch offices” asks Vitec within a minute instead of waiting a day.',
      },
      {
        title: 'Notifications',
        text: 'Ask Vitec to send the brokerage’s notifications to the address for live Vitec, under “Notification addresses and call limits” below. That address is Core’s own address, then /v1/hook/vitec/webhook/ and the secret. Ask for notifications on Estate, limited to estates advertised on the website, for Update and Remove, and on Project, User, Office and Area. These are Vitec’s own names for homes, new-build projects, agents, offices and areas. Until the notifications are set up, changes reach the sites with the catch-up, up to 12 hours later. For a QA login, ask Vitec to send QA’s notifications to the address for Vitec’s QA instead, which ends in /v1/hook/vitec/qa/ and the same secret. From that address, Core knows the notifications are about QA’s records.',
      },
      {
        title: 'Changes later',
        text: 'Offices are never typed in Core. To change which offices reach the sites, the brokerage changes its office group “Webbplats” in Vitec, and “Fetch offices” on the tenant’s page acts on it within a minute. An office that came is loaded in full, and an office that left leaves the sites. On Manual sync, choose the tenant under “What to sync” and “Fetch from the CRM, recompute and send to the sites” under “How far to go”, then press “Start”. Core then reads Vitec’s whole list again, fetches everything on it and takes off the sites whatever is no longer on it. With an office or one record’s CRM id in the choice, Core fetches again only the records it holds there. On a record’s own page, “Fetch again” fetches that record once more, and “Ask the CRM now” shows what Vitec holds for it without writing anything. A saved login switched between live Vitec and its QA environment, by ticking or unticking “Use Vitec’s QA environment”, fetches nothing until Core has checked it, within a minute. Core then takes the homes, new-build projects and offices of the other system off the sites, and loads the offices again from the system chosen. The bin beside a connection on the tenant’s page, followed by “Save”, takes every record of that connection off the sites at their next update. “Remove everything” deletes the whole tenant in Core, and its sites keep what they show until the plugin is taken off them.',
      },
      {
        title: 'Forms',
        text: 'Visitors’ forms on the sites reach Vitec through Core. The free valuation becomes Vitec’s valuation request, a lead for the seller. An interest in a home becomes Vitec’s interest registration, and a viewing booking becomes Vitec’s viewing attendance. A search profile becomes a contact with a search profile in Vitec. Nothing about forms is typed on the connection, so Vitec’s own defaults stand for the lead source, the intake source and an interest’s status. A booking asks Vitec to confirm it to the visitor by e-mail, with no text message and no reminder. Only Core’s live service sends forms to Vitec. On any other copy of Core, such as staging, a form stops just before Vitec and the visitor reads that it was not sent, while the viewing times are still read. A form for a tenant with a QA login goes to Vitec’s QA environment, and also only from Core’s live service. On Overview, a check turns red while the latest form to a connection went unanswered by Vitec. A form Vitec did not take shows on Failed forms, where it can be read and sent again. Every call Core makes to Vitec for a home shows in the home’s timeline on Records.',
      },
      {
        title: 'Check',
        text: 'On Overview, the seven Vitec checks are green: no notification waits more than five minutes, no record failed three fetches in a row, Core can read every connection’s saved login, every connection has offices to fetch, every connection has caught up on time, Vitec refuses no office, and Core asks Vitec for every connection. The first notification from Vitec shows in the record’s timeline on Records. On Flow, the records Vitec sends appear as they arrive.',
      },
      {
        title: 'Names in the code',
        text: 'For the engineer: the seven Vitec checks on Overview are vitec.webhook_lag, vitec.retries, vitec.login, vitec.no_offices, vitec.catch_up, vitec.offices and vitec.connect. Saving a new connection sends the adapter connection_added, and a change to Core’s own office list sends offices_added or offices_removed, after which the adapter asks Vitec again. A Manual sync of a tenant that fetches from the CRM is resync, and one of an office or a record, like “Fetch again”, is refetch.',
      },
    ],
    settings: [
      {
        key: 'VITEC_WEBHOOK_TOKEN',
        value: token ? { text: 'set', state: 'ok' } : { text: 'not set', state: 'bad' },
        help: 'The secret at the end of both notification addresses. Without it, Core turns every notification from Vitec away, and changes reach the sites only with the catch-up, up to 12 hours later.',
      },
      {
        key: 'VITEC_BASE_URL',
        value: connect.baseUrlOf('live'),
        help: `Live Vitec’s address. Only the tests point it elsewhere. Vitec’s QA environment has its own address, ${connect.baseUrlOf('qa')}.`,
      },
      {
        key: 'VITEC_FETCH_CONCURRENCY',
        value: connect.concurrency(),
        help: 'How many calls Core makes to Vitec at the same time, counted apart for live Vitec and for its QA environment. A higher number loads a large brokerage faster and puts more load on Vitec.',
      },
      {
        key: 'VITEC_REQUESTS_PER_SECOND',
        value: connect.requestsPerSecond(),
        help: 'How many calls Core makes to Vitec in one second at most, counted apart for live Vitec and for its QA environment, so that loading a whole brokerage never looks like an attack to Vitec.',
      },
    ],
  };
}
