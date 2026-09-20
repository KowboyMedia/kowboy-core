# The staging site: the WordPress client live, driven by agents

Step 1 of two, proposed 2026-09-20 for Patric's decisions (questions 62 to 64). Step 2 is
[default-templates.md](default-templates.md), and both run in the same loop once this site
stands. Strategy §4 already names this site: the staging WordPress site next to staging Core.

## What it is for

CI runs the real plugin on a real WordPress against a real Core on every change
(`clients/README.md`): the sync loop, bells, the backstop, tombstones, forcerefresh, a database
restore, all with a fake CRM and a throwaway site. What only a live site can prove is what a
customer site meets: bells over the internet from the deployed Core, the backstop under a real
server's cron, a page cache purging the right pages, real records through real templates, the
update channel, and pages a person can open. This site is that: one real site, on the Vitec test
data staging already holds (tenant `kowboy-test`, 646 properties since 2026-09-18), that an agent
deploys to, watches and iterates on until every client criterion a live site can prove is green,
with no human step. Step 2's templates land on the same site and are checked in the same loop.

| Proved in CI today, on every change                  | Only the live site proves                                   |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| the sync loop end to end, against an in-process Core | bells from the deployed Core, over the internet, over HTTPS |
| the backstop, run by the test driver                 | the backstop under the site's own cron, across days         |
| the hooks a cache listens for fire                   | a real page cache purges the right pages (AC 43, new)       |
| the updater offers a newer release                   | WordPress applies a release from the Space (AC 21)          |
| fake records                                         | real Vitec records through real templates, in a browser     |
| a restore of Core's database (AC 41)                 | the restore drill on staging (AC 24, Phase 7)               |

## Shape

Four principles, the same as for the two Core apps: infrastructure as code in the repository;
agents drive it through the DigitalOcean API and nothing needs a console; secrets never leave
DigitalOcean; and the site runs the branch's own plugin, so what is tested is what would be
released.

1. **Where it runs.** A third App Platform app, `kowboy-site-staging`, from `.do/app.site.yaml`,
   deploying the `staging` branch on every push like staging Core. One container (the smallest,
   $5.00 a month) built from a Dockerfile in `clients/wordpress/site/`: the official WordPress
   image on PHP 8.3, the plugin and the must-use updater copied in from the repository, WP-CLI, the
   theme and the templates package once step 2 exists, a cron tick every minute so the backstop
   never depends on visitors, and a start script that installs WordPress on first boot and applies
   every setting from the environment (site address, Core URL, tenant token, bell secret,
   permalinks, the cache plugin), so the site sets itself up with no clicks. The database is
   DigitalOcean's smallest managed MySQL ($15.15 a month), because WordPress needs MySQL and App
   Platform's cheap dev database is Postgres only. About $20 a month in all (question 62). The
   address is the platform's own, `https://kowboy-site-staging-….ondigitalocean.app`; a kowboy.se
   address can come later.

   The smaller option, named in question 62: MariaDB inside the same container, no managed
   database, $5 in all. The site then empties on every deploy and refills from Core within two
   minutes, so nothing can be watched across days (the backstop, the updater, the cache), and
   Patric may open an empty site right after a change.

2. **How it joins Core.** Once: an agent adds the site to tenant `kowboy-test` on staging's tenant
   page (name, bell URL, active), takes the bell secret and the tenant token from that page, and
   puts them in the site app's environment through the API. From then on the site is a subscriber
   like any customer site: the same plugin, settings page, paths and notices.

3. **How an agent drives it.** Three channels, none needing a shell (the session has no SSH):
   - Core's admin API with staging's admin secret: ring the site (`/v1/admin/bell`, delta or
     forcerefresh), resync the connection (`/v1/admin/event`), and read every bell, pull and
     applied report on the timeline (`/v1/admin/events`). What the site did is visible from Core.
   - The site's public surface: its pages, sitemaps, `/wp-json/`, and the cache's response headers.
   - A staging-only must-use plugin baked into the site image
     (`clients/wordpress/site/mu-plugins/core-site-driver.php`), behind a secret of its own, for
     what the public surface cannot do: run the backstop now, reset the local copy, point the site
     at a dead Core for the outage test and back, and report status (plugin version, cursors,
     counts, last sync). It mirrors the CI driver (`clients/wordpress/test/driver.php`) command
     for command, over HTTP, and is never part of the plugin or a release.

   Staging's admin secret was generated in an earlier session and sits encrypted in the app spec,
   unreadable since. An agent sets a new one through the API (staging only, no "allow" needed)
   and gives the same value to the site app for the smoke job; it is generated and passed inside a
   script, never printed, logged or committed (question 58's lesson).

4. **The smoke suite, and where it runs.** `clients/wordpress/smoke.test.ts` holds the client
   criteria a live site can prove, run black box against the live site and staging Core. It runs
   as a **post-deploy job on the site app**: App Platform runs such a job after every successful
   deploy, with the environment the spec gives it, and its log is readable through the API, so no
   secret leaves DigitalOcean and nobody pastes anything anywhere. A scheduled job can run it
   hourly later, as a standing check. Two other homes were weighed and put aside: a GitHub Actions
   job on every push to staging (the agent already reads those logs, but the job would need
   staging's admin secret and a DigitalOcean token as repository secrets, which the session cannot
   set and decision 2026-09-17 keeps out of GitHub), and the agent's own session
   (`npm run test:staging` with the addresses and secrets in the session's environment, which any
   agent can still do for its own iteration, but which proves nothing once the session ends).

5. **The loop.**

   ```
   an agent changes the plugin, the site image or, in step 2, the templates
     → the change is checked (CI: the scenario suite on a throwaway WordPress)
     → it lands on staging → staging Core and the staging site rebuild themselves
     → the smoke job runs against the live site; its log says what passed and what did not
     → the agent reads the log through the API, fixes, and goes again
   until every criterion below is green; the acceptance report then names the smoke tests
   ```

   One round takes about five minutes (a build of about three, the suite about two). No human is
   in the loop; Patric can open the site at any time and see what the agent sees.

## What "every test green" means here

| AC      | Proved on the live site by                                                                                                                                                                                            |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 18      | A change lands on staging and the smoke job runs by itself; production still waits for Patric's word.                                                                                                                 |
| 20      | The scenario suite in CI and the smoke on the live site; the search half comes with step 2.                                                                                                                           |
| 22      | The site's bell URL is broken on the tenant page for one round, and Core's timeline still shows the site pulling on its own every 15 minutes, the same code path CI proves converges; then the URL is put back.       |
| 8       | The driver points the site at a dead Core; every page type answers 200 with the last content; then back.                                                                                                              |
| 19      | A forcerefresh runs while staging Core redeploys (the agent asks for the redeploy mid-pull); the cursor ends at Core's latest position and the counts match the tenant's.                                             |
| 21      | Once the first release is on the Space (next-steps item 4): the site's updater sees it and WordPress applies it; until then CI's check stands.                                                                        |
| 43, new | Cache invalidation (question 64): a page is served from the cache (its header or stamp says so); after a bell that rewrites its record the next request is fresh; a removed record's page is gone from the cache too. |
| 24      | Possible on this site (restore the staging database through the API, watch the site converge); scheduled for Phase 7, not this step.                                                                                  |

Where changes come from: real changes arrive when Vitec's subscription for the test account
points at staging (next-steps item 6, on Patric and Vitec) and whenever the test account changes.
For a change on demand the suite has two levers that need no CRM: a `forcerefresh` bell (every
record rewritten, every page purged) and a `resync` of the connection. A record's content changing
on demand exists only through the CRM, so the suite also asserts on the real stream whenever it
has flowed: every write on Core's timeline is followed by the site's pull and its applied report
within a minute, the freshness Core's dashboard already shows. A fake CRM connection on staging
would give a change on demand (the fake adapters left the apps by question 34) but would put
made-up records on the site Patric looks at, so it is not proposed.

## The cache and the host

The staging site should run what customer sites run, so the cache proof means something. Question
63 asks which host and page cache that is. Until it is answered the site runs WP Super Cache (free,
purges on `save_post`), so there is a cache to prove against from the first day.

## What it needs from Patric

- **62** yes to the site at about $20 a month, or the $5 variant.
- **63** the host and page cache customer sites run; the default stands until then.
- **64** AC 43 and the live-site tests named in the acceptance report (a protected path).
- Already open: Vitec's subscription for the test account pointed at staging (item 6), so real
  changes flow; not blocking.

## Order of work

1. After 62: the site image, the start script, the spec; the app created through the API; the
   site registered on the tenant page; the first sync visible in a browser.
2. The driver, the smoke suite, the post-deploy job; the loop run until it is green.
3. With 64: AC 43 and the live-site tests in `acceptance/criteria.json`, the report regenerated.
4. Step 2 joins the loop.

Later, not this step: a Lovable staging site the same way (strategy §4 names it); the restore drill
(AC 24) and the load test (AC 27) on this site in Phase 7; a production site; a kowboy.se address.
