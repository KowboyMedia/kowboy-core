# WordPress client

A thin plugin (SRS Appendix A): three settings, a bell endpoint, the sync loop and a local store.
No data logic, no CRM knowledge. Templates, routing and search come with the data model.

```
core-client/                     the plugin
  core-client.php                header and requires
  includes/settings.php          Core URL, tenant token, bell secret; the settings page with the last sync
  includes/store.php             post types, the index and state tables, upsert and delete
  includes/sync.php              the SRS §8 loop
  includes/bell.php              POST /wp-json/core/v1/bell
  includes/schedule.php          WP-Cron: the 15 minute backstop
  includes/cli.php               wp core-client sync [--force], wp core-client status
  includes/report.php            error reporting placeholder (Sentry later)
mu-plugins/core-client-updater.php   safe update, independent of the plugin (45 lines)
release.php                      builds core-client.zip and core-client.json for a release
test/                            setup.sh, install.php and driver.php for the scenario suite
```

## Installing it on a site

1. Put `core-client/` in `wp-content/plugins/` and activate it.
2. Put `core-client-updater.php` in `wp-content/mu-plugins/`, and in `wp-config.php`:
   `define('CORE_CLIENT_UPDATE_URL', 'https://…/core-client.json');`
3. Settings → Kowboy Core: the Core URL, the tenant token and the bell secret. The page shows the
   bell URL to give Kowboy, `https://<site>/wp-json/core/v1/bell`, and the last successful sync.

The first sync happens on the first bell or the next 15 minute run, or now: `wp core-client sync`.

**How a bell is answered.** The endpoint answers 202 and then pulls from Core in that same request,
after the answer has gone out, so neither WP-Cron nor traffic is needed for a bell to take effect.
WP-Cron only runs the 15 minute backstop for a lost bell; a site with `DISABLE_WP_CRON` runs that
from system cron. No task scheduler library is needed or used.

## What the site gets

- One post type per datatype: `core_property` (archive and permalinks under `/objekt/`),
  `core_agent`, `core_office`, `core_area`, `core_association`. Public, so sitemaps, permalinks and
  cache plugins see them.
- The item, exactly as Core served it, in the post meta `core_data`. `core_client_item($post_id)`
  returns it as an array; `display.*` are the strings to show.
- `post_date` and `post_modified` are the CRM's `remote_updated_at`, never the local write time
  (SRS §7.1), so sitemaps and "updated" dates are right without any template logic.
- Every item goes through `wp_insert_post`, `wp_update_post` and `wp_delete_post`, so WordPress
  fires what cache plugins listen for (`save_post`, `transition_post_status`, `clean_post_cache`,
  `deleted_post`), and the plugin adds `core_item_updated($post_id, $datatype)` and
  `core_item_deleted($post_id, $datatype)` for anything that wants the item itself.
- The index table `wp_core_index` answers which post holds an item and its hash. Columns for the
  search filters are added with the data model.

## Safe update

The must-use plugin tells WordPress's own updater where releases come from and enables auto-update
for this plugin; WordPress shows the new version on the Plugins page, updates on request or by
itself, and does the swap. The release JSON is:

```json
{ "version": "1.2.0", "package": "https://…/core-client.zip" }
```

Every `v*` tag of this repository builds both files (`release.php`) and attaches them to the
GitHub Release (`.github/workflows/release.yml`). Because the repository is private, a site cannot
fetch them from there without a token; where they are served from is open question 16 in
`docs/open-questions.md`. Whatever the answer, `CORE_CLIENT_UPDATE_URL` names the JSON's URL.

The updater never loads plugin code, so a broken release is replaced by the next one.

## Checking it

`npm run test:wordpress` runs the shared scenario suite against a real WordPress install plus the
updater and WP-CLI tests; see [../README.md](../README.md) for the one-time setup. PHPStan runs in
CI's warnings job: `composer install` and `vendor/bin/phpstan analyse`, both in this directory.
