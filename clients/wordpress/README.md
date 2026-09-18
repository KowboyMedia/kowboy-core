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
  includes/schedule.php          the 15 minute backstop, an Action Scheduler recurring action
  lib/action-scheduler/          Action Scheduler 4.1.0, bundled (GPLv3)
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
after the answer has gone out, so neither a queue nor traffic is needed for a bell to take effect.

**The backstop.** Every 15 minutes a sync runs anyway, as a recurring Action Scheduler action, in
case a bell was lost. Action Scheduler is bundled with the plugin (`lib/action-scheduler`), so
nothing else is installed, and every run is listed under Tools → Scheduled Actions. Its queue is
ticked by WP-Cron; a site with `DISABLE_WP_CRON` runs `wp-cron.php` from system cron every minute,
or `wp action-scheduler run`.

## What the site gets

- Permalinks are the site's, never Core's (strategy §12.23): property
  `<status>-<area name>-<street address>-<id>`, agent `<first name>-<last name>-<id>`, area
  `<municipality>-<area name>-<id>`; every entity ends in `-<id>`, and a request by id alone
  (`/objekt/<id>`) answers 301 to the current permalink (question 41). Until the field names
  arrive (next-steps item 2) the placeholder is connection plus id.
- One post type per datatype: `core_property` (archive and permalinks under `/objekt/`),
  `core_agent`, `core_office`, `core_area`, `core_association`, `core_project`. Public, so sitemaps, permalinks and
  cache plugins see them.
- The item, exactly as Core served it, in the post meta `core_data`. `core_client_item($post_id)`
- The CRM payload, exactly as Core served it, in the post meta `core_raw`; `core_client_item_raw($post_id)`
  reads it (Patric, 2026-09-18): whatever `data` does not name yet.
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

Every `v*` tag of this repository builds both files (`release.php`), publishes them to the
DigitalOcean Space named by the repository variables `DO_SPACES_BUCKET` and `DO_SPACES_REGION`
(with the secrets `DO_SPACES_KEY` and `DO_SPACES_SECRET`), and attaches them to the GitHub Release
as the record (`.github/workflows/release.yml`). Sites point at the Space:

```php
define('CORE_CLIENT_UPDATE_URL', 'https://<bucket>.<region>.digitaloceanspaces.com/core-client/core-client.json');
```

The updater never loads plugin code, so a broken release is replaced by the next one.

## Checking it

`npm run test:wordpress` runs the shared scenario suite against a real WordPress install plus the
updater and WP-CLI tests; see [../README.md](../README.md) for the one-time setup. PHPStan runs in
CI's warnings job: `composer install` and `vendor/bin/phpstan analyse`, both in this directory.

On the site itself, an administrator sees one notice on every admin page while the plugin cannot
sync (Patric, 2026-09-18): the site is not linked (no Core URL or token), its licence is not
active (Core refuses the token), or the last sync failed. In every case the site keeps showing
what it has; only the updates stop. `wp core-client status` carries the same text as `notice`.

## What the site tells Core

After each page it pulled, the plugin posts to `POST /v1/applied` which records it applied and which
it could not use, with the tenant's token (question 37, 2026-09-18). Core puts that on each
record's timeline, so an operator sees a change travel from the CRM to this site. A report that
cannot be delivered is logged and never stops a sync.
