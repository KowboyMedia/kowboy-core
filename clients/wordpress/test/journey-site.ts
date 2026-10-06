// The site the WordPress journeys walk (clients/wordpress/playwright.config.ts): the real
// WordPress of test/setup.sh with the plugin and the theme "Kowboy 2026", its demo pages, and the
// template suite's records brought in through a real Core from the fake polling CRM. Like
// scripts/journey-core.ts it is an entrypoint of its own, never part of the shipped app: it runs
// from `dist` after `npm run build`, serves on the port it is given and stops when it is told to.
// It serves only once the records and the demo pages are in, so the first request a journey
// makes, and the WP-Cron run a request spawns, meet a site that is done.
import '../../../acceptance/setup.js';
import { harness, TENANT, TOKEN, until } from '../../../acceptance/harness.js';
import { addSubscriber } from '../../../engine/storage/connections.js';
import { fakePollingAdapter, poll } from '../../../adapters/fake-polling/index.js';
import * as crm from '../../../adapters/fake-polling/crm.js';
import { BELL_SECRET, CONNECTION } from '../../client-driver.js';
import { fillTheCrm, soon } from './records.js';
import { configure, driver, serve, stop, wp } from './site.js';

const port = Number(process.argv[2] ?? 4320);

crm.reset();
const core = await harness({
  adapters: [fakePollingAdapter],
  connections: [{ id: CONNECTION, provider: 'fake-polling' }],
  subscriber: false,
});
const site = await configure({ url: core.baseUrl, token: TOKEN, bellSecret: BELL_SECRET }, port);
// A journey starts from nothing: the demo pages of an earlier run go, and come back at the end.
await wp(
  'eval',
  "foreach (['hem', 'till-salu', 'salda-bostader', 'om-oss'] as $slug) { $page = get_page_by_path($slug); if ($page instanceof WP_Post) { wp_delete_post($page->ID, true); } }",
);
// Which of this CRM's status ids the site lists as for sale, coming and sold, and the defaults otherwise.
for (const [option, value] of [
  ['core_client_status_for_sale', '"active"'],
  ['core_client_status_coming', '"pre"'],
  ['core_client_status_sold', '"done"'],
  ['core_client_shadow_dom', 'null'],
  ['core_client_template_set', 'null'],
]) {
  await driver('option', `${option} ${value}`);
}
await driver('theme', 'kowboy-2026');
// The site in Core, as the admin area adds it, so a form it passes on shows on its row.
await addSubscriber({
  tenantId: TENANT,
  label: 'journey site',
  bellUrl: site.bellUrl,
  bellSecret: BELL_SECRET,
});
fillTheCrm();
// The bookable viewing of Kungsgatan 3 has two slots in the CRM, one of them full.
crm.setShowings('P-3', [
  {
    showing_id: 'SH-1',
    from: soon(48),
    to: soon(49),
    book_before: soon(47),
    open_booking: true,
    shown: true,
    times: [
      { time_id: 'T-1', from: soon(48), to: soon(48.5), open: true, places_left: 4 },
      { time_id: 'T-2', from: soon(48.5), to: soon(49), open: false, places_left: 0 },
    ],
  },
]);
await poll();
await site.trigger('delta');
await until(
  async () => {
    const status = await site.status();
    return status.pending === null && status.running_since === null && status.runs >= 1;
  },
  'the site to finish syncing',
  60_000,
);
await driver('demo-pages');
await serve();
console.log(`the journey site is on http://127.0.0.1:${String(port)}`);

const quit = (): void => {
  void Promise.all([stop(), core.stop()]).finally(() => process.exit(0));
};
process.on('SIGTERM', quit);
process.on('SIGINT', quit);
