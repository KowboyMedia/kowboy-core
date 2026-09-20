# The staging site: the WordPress client live, driven by agents

Step 1 of two. Proposed 2026-09-20 and revised the same day for Patric's answers: the site runs on
Cloudways, caches are invalidated the WordPress way and proved with the market-leading cache, and
the access an agent needs is spelled out. Open: questions 63, 64 and 68, and one step for Patric
(a Cloudways API key). Step 2 is [default-templates.md](default-templates.md), and both run in the
same loop once this site stands. Strategy §4 already names this site: the staging WordPress site
next to staging Core.

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
| the hooks a cache listens for fire                   | real page caches purge the right pages (AC 43, new)         |
| the updater offers a newer release                   | WordPress applies every build from the Space (AC 21)        |
| fake records                                         | real Vitec records through real templates, in a browser     |
| a restore of Core's database (AC 41)                 | the restore drill on staging (AC 24, Phase 7)               |

## Shape

Four principles, the same as for the two Core apps: everything about the site is code in the
repository; agents drive it through APIs and the site's own HTTPS surface, so nothing needs a
console or a shell (the session has no SSH); secrets never leave DigitalOcean; and the site runs
the branch's own plugin through the real update channel, so what is tested is what a customer
gets.

1. **Where it runs.** A WordPress application on Kowboy's Cloudways server (Patric, question 62),
   so the site runs what customer sites run: Cloudways' optimised WordPress with Breeze (page
   cache, on by default), Varnish at the server and Object Cache Pro. An agent creates it through
   the Cloudways API and reads its WordPress admin login from the same API, or Patric creates it
   with one click and hands the login over. No new server and no new cost beyond one more
   application on the existing server.

2. **How code reaches it: the update channel, the customer's own path.** The plugin's updater
   exists (`mu-plugins/core-client-updater.php`, AC 21): WordPress asks a release JSON on the
   DigitalOcean Space for a newer version and swaps the plugin itself. The staging site listens to
   a **staging channel** on the same Space (`core-client/staging/core-client.json`): every change
   that lands on staging is packaged with a build number appended to its version, so the site
   always sees a newer one while a production release keeps its tag's version, and published to
   that channel; the site updates itself within minutes, or at once when the driver asks it to.
   The template sets of step 2 travel the same way, one JSON each. Two small changes to the plugin
   make this, and every customer install, one upload and one click: the plugin writes the updater
   file into `mu-plugins/` on activation (the updater still runs on its own afterwards and never
   loads plugin code), and the channel address is a setting with the production channel as its
   default, the wp-config constant kept as an override. Cloudways' git deployment was weighed and
   put aside: it pulls a whole repository into one folder, which does not fit a repository that
   also holds Core, and it needs a deploy key that only a repository admin can add.

3. **Who publishes and tests: a job on staging Core.** Staging Core is an App Platform app that
   rebuilds on every change that lands on staging. It gets a **post-deploy job** that, from the
   same commit, packages the plugin and the template sets, publishes them to the staging channel,
   waits until the site reports the new version, and runs the smoke suite against the live site
   and staging Core. The job has staging's admin secret natively; the Space key and the site's
   driver secret are set in its environment by an agent through the DigitalOcean API; its log is
   read through the same API. No secret leaves DigitalOcean and nobody pastes anything. It is
   built from a small Dockerfile (Node, PHP and zip), since packaging is `release.php`. GitHub
   Actions was the other candidate: the agent reads those logs today, but the job would need the
   Space key, staging's admin secret and the driver secret as repository secrets, which only a
   repository admin can set. A scheduled job can run the suite hourly later, as a standing check.

4. **How it joins Core.** Once: an agent adds the site to tenant `kowboy-test` on staging's tenant
   page (name, bell URL, active), as the test account was set up on 2026-09-18, takes the bell
   secret and the tenant token, and puts them in the site's settings. From then on the site is a
   subscriber like any customer site: the same plugin, settings page, paths and notices. The
   site's cron runs every minute through the Cloudways API (`app/manage/cronList`), as a customer
   host's does, so the backstop and the updater never depend on visitors.

5. **How an agent drives it.** Four channels, none needing a shell:
   - Core's admin API (in the job natively, in a session with the secret): ring the site
     (`/v1/admin/bell`, delta or forcerefresh), resync the connection (`/v1/admin/event`), and
     read every bell, pull and applied report on the timeline (`/v1/admin/events`).
   - The site's public surface: pages, sitemaps, `/wp-json/`, the caches' response headers.
   - A staging-only driver plugin (`clients/wordpress/site/core-site-driver/`), behind a secret
     of its own, for what the public surface cannot do: update now, run the backstop now, reset
     the local copy, point the site at a dead Core for the outage test and back, switch the cache
     plugin under test, and report status (versions, cursors, counts, last sync). It mirrors the
     CI driver (`clients/wordpress/test/driver.php`) command for command, over HTTP; it is never
     part of the plugin or a release, the agent installs it once with the plugin, and it updates
     from the staging channel like the rest.
   - The Cloudways API: the site's login, its cron, a Varnish purge, its logs.

   Staging's admin secret was generated in an earlier session and sits encrypted in the app spec,
   unreadable since. An agent sets a new one through the API (staging only, no "allow" needed);
   it is generated and passed inside a script, never printed, logged or committed (question 58's
   lesson).

6. **The loop.**

   ```
   an agent changes the plugin, the driver or, in step 2, a template set
     → the change is checked (CI: the scenario suite on a throwaway WordPress)
     → it lands on staging → staging Core rebuilds; its job publishes the staging channel,
       the site updates itself, the smoke suite runs; the log says what passed and what did not
     → the agent reads the log through the API, fixes, and goes again
   until every criterion below is green; the acceptance report then names the smoke tests
   ```

   One round takes about six minutes (a build of about three, the site's update about one, the
   suite about two). No human is in the loop; Patric can open the site at any time and see what
   the agent sees.

## Access, the whole workflow

What an agent needs to run this end to end, and the one step that is Patric's:

| What                        | Why                                                        | How the agent gets in                                                                             | Patric's part                                                         |
| --------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| The repository              | the code, the checks, the releases; the template sets too  | has it (`GITHUB_TOKEN`)                                                                           | nothing                                                               |
| DigitalOcean                | staging Core's job and admin API, the Space                | has it (`DIGITALOCEAN_ACCESS_TOKEN`); the Space and its key are created by an agent               | nothing                                                               |
| Cloudways                   | create the site, read its login, cron, Varnish purge, logs | the Cloudways API with an API key (`CLOUDWAYS_EMAIL`, `CLOUDWAYS_API_KEY` in the session)         | **one step:** in Cloudways, generate an API key and paste it in chat  |
| The site's WordPress admin  | install the plugin and the driver once; settings           | the login from the Cloudways API, over HTTPS; then an application password the agent makes itself | nothing with the key; otherwise paste the admin login Cloudways shows |
| SFTP or SSH                 | not needed; blocked from the session anyway                | —                                                                                                 | nothing                                                               |
| The reference site (step 2) | read its pages for parity                                  | public HTTPS, no login                                                                            | its address (question 67)                                             |
| Staging Core's admin secret | ring, resync, read the timeline                            | set anew by an agent through the DigitalOcean API                                                 | nothing                                                               |

## Cache invalidation: the WordPress way, and which caches prove it

Patric's rule (question 63): the plugin invalidates caches by updating the post types the
WordPress way and nothing else, and the caches follow. Checked 2026-09-20 in WordPress 7.1's
source and in the caches' own code:

- **What the plugin does** (`includes/store.php`): every record is written through
  `wp_insert_post` or `wp_update_post` and removed through `wp_delete_post`, `clean_post_cache`
  is called after each write, and `core_item_updated` and `core_item_deleted` fire for anything
  custom.
- **What WordPress fires.** On a write: `save_post`, `save_post_<type>`, `edit_post`,
  `post_updated`, `wp_insert_post`, `transition_post_status` and `clean_post_cache`. On a
  removal: `before_delete_post`, `delete_post`, `deleted_post`, `after_delete_post` and
  `clean_post_cache`.
- **What the caches purge on:**

  | Cache                                            | Purges a post's pages on                                                                                           | Covered by the plugin                                       |
  | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
  | WP Rocket (5.5 million sites, the market leader) | `clean_post_cache`, `delete_post`, `wp_trash_post`, `pre_post_update`                                              | writes and removals                                         |
  | Breeze with Varnish (on every Cloudways site)    | Varnish: `save_post`, `deleted_post`, `edit_post`; its file cache: `save_post`, `pre_post_update`, `wp_trash_post` | writes; a forced removal misses Breeze's file cache (below) |
  | WP Super Cache                                   | `edit_post`, `delete_post`, `clean_post_cache`, `transition_post_status`, `wp_trash_post`                          | writes and removals                                         |
  | LiteSpeed Cache (7 million installs)             | needs a LiteSpeed server, which Cloudways does not run                                                             | not tested                                                  |

  One gap found by reading: Breeze purges its file cache on `wp_trash_post` but not on a forced
  delete, and a removed record is deleted outright today. The plugin will trash the post first
  and delete it then (`wp_trash_post`, then `wp_delete_post`), the WordPress way for a removal,
  which every cache above listens to; the smoke suite proves it.

- **Browser cache, by extension.** These caches set browser caching for scripts, styles and
  images through server rules, never for HTML pages, and Varnish is purged by the same hooks, so
  a changed page reaches browsers on the next request. A template set's own scripts and styles
  are enqueued with the set's version (`wp_enqueue_style` with a version, the WordPress way), so a
  release replaces the browser's copy. The smoke suite asserts both: no long-lived cache
  directive on an HTML answer, and a version on every asset address.
- **What the staging site tests:** Breeze with Varnish, because every Cloudways site has them,
  and WP Rocket, the market leader on that stack (a licence, question 63). They cannot run at
  once, so the driver switches between them and the cache cases run twice.

## What "every test green" means here

| AC      | Proved on the live site by                                                                                                                                                                                                                      |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 18      | A change lands on staging, is published to the staging channel and tested by the job by itself; production still waits for Patric's word.                                                                                                       |
| 20      | The scenario suite in CI and the smoke on the live site; the search half comes with step 2.                                                                                                                                                     |
| 21      | Every round reaches the site through the real updater from the staging channel, so a broken build is replaced by the next one on every round, not only in theory.                                                                               |
| 22      | The site's bell URL is broken on the tenant page for one round, and Core's timeline still shows the site pulling on its own every 15 minutes, the same code path CI proves converges; then the URL is put back.                                 |
| 8       | The driver points the site at a dead Core; every page type answers 200 with the last content; then back.                                                                                                                                        |
| 19      | A forcerefresh runs while staging Core redeploys (the agent asks for the redeploy mid-pull); the cursor ends at Core's latest position and the counts match the tenant's.                                                                       |
| 43, new | Cache invalidation (question 64): a page served from the cache (its header or stamp says so) is fresh on the next request after a bell that rewrites its record, a removed record's page is gone, and HTML answers carry no long browser cache. |
| 24      | Possible on this site (restore the staging database through the API, watch the site converge); scheduled for Phase 7, not this step.                                                                                                            |

Where changes come from: real changes arrive when Vitec's subscription for the test account
points at staging (next-steps item 6, on Patric and Vitec) and whenever the test account changes.
For a change on demand the suite has two levers that need no CRM: a `forcerefresh` bell (every
record rewritten, every page purged) and a `resync` of the connection. A record's content changing
on demand exists only through the CRM, so the suite also asserts on the real stream whenever it
has flowed: every write on Core's timeline is followed by the site's pull and its applied report
within a minute, the freshness Core's dashboard already shows. A fake CRM connection on staging
would give a change on demand (the fake adapters left the apps by question 34) but would put
made-up records on the site Patric looks at, so it is not proposed.

## What it needs from Patric

- **One step:** a Cloudways API key, pasted in chat, or `CLOUDWAYS_EMAIL` and `CLOUDWAYS_API_KEY`
  in the session's environment. Everything else an agent does.
- **63** a WP Rocket licence for the staging site (about $59 a year), or Breeze alone.
- **64** AC 43 as reworded, and the live-site tests named in the report (a protected path).
- **68** how Core helps with hidden values and the listing state (raised from step 2; it changes
  what the smoke and parity suites expect).
- Already open: Vitec's subscription for the test account pointed at staging (item 6), so real
  changes flow; not blocking.

## Order of work

1. Now, needing no answer: the plugin's two updater changes and the trash-then-delete; the Space
   and the staging channel; the driver; the packaging-and-smoke job on staging Core (publishing
   only, until the site exists).
2. With the Cloudways key: the site created, the plugin and the driver installed, the site
   registered on the tenant page, the cron set, the first sync visible in a browser.
3. The loop run until it is green, with Breeze; WP Rocket added with 63.
4. With 64: AC 43 and the live-site tests in `acceptance/criteria.json`, the report regenerated.
5. Step 2 joins the loop.

Later, not this step: a Lovable staging site the same way (strategy §4 names it); the restore drill
(AC 24) and the load test (AC 27) on this site in Phase 7; a production site; publishing the
production channel from the production app's own job on a release, so no key ever sits in GitHub
(a question when the first release is near, item 4).
