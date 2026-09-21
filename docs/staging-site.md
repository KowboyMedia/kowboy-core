# The staging site: the WordPress client live, driven by agents

Step 1 of two. Proposed 2026-09-20 and revised the same day for Patric's answers, and on
2026-09-21 the test site became the target of a client's pair of environments
([template-porting.md](template-porting.md)). The plugin and this loop serve every host. Open:
where the porting server runs (question 75). Step 2 is [default-templates.md](default-templates.md), and both run in the same
loop once this site stands. Strategy §4 already names this site: the staging WordPress site next
to staging Core.

## What it is for

CI runs the real plugin on a real WordPress against a real Core on every change
(`clients/README.md`): the sync loop, bells, the backstop, tombstones, forcerefresh, a database
restore, all with a fake CRM and a throwaway site. What only a live site can prove is what a
customer site meets: bells over the internet from the deployed Core, the backstop under a real
server's cron, page caches purging the right pages, real records through real templates, the
update channel, and pages a person can open. This site is that: one real site, on the Vitec test
data staging already holds (tenant `kowboy-test`, 646 properties since 2026-09-18), that an agent
deploys to, watches and iterates on until every client criterion a live site can prove is green,
with no human step. Step 2's templates land on the same site and are checked in the same loop.

| Proved in CI today, on every change                  | Only the live site proves                                   |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| the sync loop end to end, against an in-process Core | bells from the deployed Core, over the internet, over HTTPS |
| the backstop, run by the test driver                 | the backstop under the site's own cron, across days         |
| the hooks a cache listens for fire                   | a real page cache purges the right pages                    |
| the updater offers a newer release                   | WordPress applies every build from the Space (AC 21)        |
| fake records                                         | real Vitec records through real templates, in a browser     |
| a restore of Core's database (AC 41)                 | the restore drill on staging (AC 24, Phase 7)               |

## Shape

Four principles, the same as for the two Core apps: everything about the site is code in the
repository; agents drive it over HTTPS (the WordPress API, the plugin's update channel, a
staging-only driver), so nothing needs a console or a shell; secrets never leave DigitalOcean; and
the site runs the branch's own plugin through the real update channel, so what is tested is what
a customer gets. Nothing here is specific to a host. What the plugin needs from any host is PHP
8.3, MySQL or MariaDB, WordPress 6.8 or later, outbound HTTPS to Core and a cron tick, and that is
all the loop needs too.

1. **Where it runs.** On the porting server of [template-porting.md](template-porting.md)
   (question 75): the test site is the target of a client's pair, a copy of the client's site
   with Core's plugin in place of the old one, first for the reference client. Nothing in the
   plugin or the loop depends on the host; where a host has an API, as Cloudways has, it is a
   convenience for the agent (the site's login, its cron, a Varnish purge), never a dependency.
   SFTP is not used: nothing but web traffic leaves the agent's environment (checked 2026-09-21),
   and the admin login is enough.

2. **How code reaches it: the update channel, the customer's own path.** The plugin's updater
   exists (`mu-plugins/core-client-updater.php`, AC 21): WordPress asks a release JSON on the
   DigitalOcean Space for a newer version and swaps the plugin itself. The staging site listens to
   a **staging channel** on the same Space (`core-client/staging/core-client.json`): every change
   that lands on staging is packaged with a build number appended to its version, so the site
   always sees a newer one while a production release keeps its tag's version, and published to
   that channel; the site updates itself within minutes, or at once when the driver asks it to.
   The template sets of step 2 travel the same way, one JSON each. Two small changes to the plugin
   make this, and every customer install, one upload and one click (the user's path is in
   [default-templates.md](default-templates.md), "Installing and updating"): the plugin writes the
   updater file into `mu-plugins/` on activation (the updater still runs on its own afterwards and
   never loads plugin code), and the channel address is a setting with the production channel as
   its default, the wp-config constant kept as an override. A host's git deployment works as well
   (a build branch holding only the plugin folders, pulled into `wp-content/plugins/`), but it
   needs a deploy key that only a repository admin can add and differs from host to host; the
   channel needs nothing from any host.

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
   subscriber like any customer site: the same plugin, settings page, paths and notices. A real
   cron every minute, by whatever the host offers, keeps the backstop and the updater independent
   of visitors; WordPress's own cron on traffic is the fallback, and the smoke suite's requests
   tick it.

5. **How an agent drives it.** Three channels, none needing a shell:
   - Core's admin API, the same JSON API the panel uses, which takes the admin secret for agents
     (in the job natively, in a session with the secret): ring the site
     (`/v1/admin/bell`, delta or forcerefresh), resync the connection (`/v1/admin/event`), and
     read every bell, pull and applied report on the timeline (`/v1/admin/events`).
   - The site's own HTTPS surface: its pages, sitemaps and the caches' response headers, and the
     WordPress REST API with an application password the agent makes for itself once (activate
     and switch plugins, read posts and settings).
   - A staging-only driver plugin (`clients/wordpress/site/core-site-driver/`), behind a secret
     of its own, for what the REST API cannot do: update now, run the backstop now, reset the
     local copy, point the site at a dead Core for the outage test and back, switch the cache
     plugin under test, and report status (versions, cursors, counts, last sync). It mirrors the
     CI driver (`clients/wordpress/test/driver.php`) command for command, over HTTP; it is never
     part of the plugin or a release, the agent installs it once with the plugin, and it updates
     from the staging channel like the rest.

   Where the host has an API, the agent also uses it for the site's login, its cron, a Varnish
   purge and its logs; nothing depends on it. Staging's admin secret was generated in an earlier
   session and sits encrypted in the app spec, unreadable since. An agent sets a new one through
   the API (staging only, no "allow" needed); it is generated and passed inside a script, never
   printed, logged or committed (question 58's lesson).

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

What an agent needs to run this end to end on any host, and the one thing that is Patric's
(question 75, where the porting server runs; with Cloudways, its API key):

| What                             | Why                                                                                                                | How the agent gets in                                                   | Patric's part                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| The repository                   | the code, the checks, the releases; the template sets too                                                          | has it (`GITHUB_TOKEN`)                                                 | nothing                                                                        |
| DigitalOcean                     | staging Core's job and admin API, the Space                                                                        | has it (`DIGITALOCEAN_ACCESS_TOKEN`); the Space and its key are its own | nothing                                                                        |
| The site's WordPress admin       | the first install of the plugin and the driver, and the settings; afterwards the REST API with a password it makes | the admin login, from the host's API, over HTTPS                        | nothing, once the host's API key is in hand                                    |
| The update channel               | every change after the first install                                                                               | the job publishes, the site pulls                                       | nothing                                                                        |
| The host's git deployment        | an alternative to the login for the first install and for every change                                             | a build branch of plugin folders, pulled by the host                    | a deploy key on GitHub, which only an admin can add; not needed with the login |
| SFTP or SSH                      | not used: port 22 is blocked from where agents run (verified 2026-09-20); a person can still use it                | —                                                                       | nothing                                                                        |
| The host's API, where it has one | convenience: the login, the cron, a Varnish purge, logs                                                            | an API key                                                              | optional                                                                       |
| The source site (step 2)         | read its pages and its theme's template files for the port                                                         | a copy the agent makes; its WordPress admin from the host's API         | nothing                                                                        |
| Staging Core's admin secret      | ring, resync, read the timeline                                                                                    | set anew by an agent through the DigitalOcean API                       | nothing                                                                        |

## Cache invalidation: the WordPress way, and nothing else

Decided 2026-09-20 (questions 67 and 68 closed: an agent's decision, not Patric's). The plugin
targets no cache plugin and no server. It does what WordPress does, and every cache follows that,
whatever the host:

- Every record is written through `wp_insert_post` or `wp_update_post` with `clean_post_cache`
  after it, and removed by trashing it and then deleting it (`wp_trash_post`, then
  `wp_delete_post`), so the events every cache purges on fire: `save_post`, `edit_post`,
  `transition_post_status`, `clean_post_cache`, `wp_trash_post`, `delete_post`. Checked
  2026-09-20 in the sources of LiteSpeed Cache, WP Rocket, W3 Total Cache, WP Super Cache, WP
  Fastest Cache and Breeze: all purge on these. Trash-then-delete is the one change; today a
  removal deletes outright, which two of them do not see.
- The plugin sets no browser cache directive of its own on pages, and answers a browser's or a
  CDN's check on a record page with an ETag from the record's content hash, so a kept copy is
  revalidated as changed or unchanged. A template set's assets carry the set's version in their
  address. How long an installation lets browsers keep pages is that installation's setting.
- Proof: the smoke suite runs one change-and-removal case against the staging site with the
  cache plugin its host provides, named under AC 20. No cache matrix, no extra servers, no new
  criterion.

## What "every test green" means here

| AC  | Proved on the live site by                                                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 18  | A change lands on staging, is published to the staging channel and tested by the job by itself; production still waits for Patric's word.                                                                       |
| 20  | The scenario suite in CI and the smoke on the live site; the search half comes with step 2.                                                                                                                     |
| 21  | Every round reaches the site through the real updater from the staging channel, so a broken build is replaced by the next one on every round, not only in theory.                                               |
| 22  | The site's bell URL is broken on the tenant page for one round, and Core's timeline still shows the site pulling on its own every 15 minutes, the same code path CI proves converges; then the URL is put back. |
| 8   | The driver points the site at a dead Core; every page type answers 200 with the last content; then back.                                                                                                        |
| 19  | A forcerefresh runs while staging Core redeploys (the agent asks for the redeploy mid-pull); the cursor ends at Core's latest position and the counts match the tenant's.                                       |
| 24  | Possible on this site (restore the staging database through the API, watch the site converge); scheduled for Phase 7, not this step.                                                                            |

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

- **75** where the porting server runs ([template-porting.md](template-porting.md)); then the
  agent makes the site itself.
- Already open: Vitec's subscription for the test account pointed at staging (item 6), so real
  changes flow; not blocking.

## Order of work

1. Now, needing no answer: the plugin's two updater changes, trash-then-delete, and the ETag on
   record pages; the Space and the staging channel; the driver; the packaging-and-smoke job on
   staging Core (publishing only, until the site is reachable).
2. With 75: the site made as the target of the first pair, registered on the tenant page, its
   cron set, the first sync visible in a browser.
3. The loop run until it is green, the cache case with the host's cache plugin.
4. The live-site tests named in `acceptance/criteria.json` under the criteria they prove, the
   report regenerated.
5. Step 2 joins the loop.

Later, not this step: a Lovable staging site the same way (strategy §4 names it); the restore drill
(AC 24) and the load test (AC 27) on this site in Phase 7; a production site; publishing the
production channel from the production app's own job on a release, so no key ever sits in GitHub
(a question when the first release is near, item 4).
