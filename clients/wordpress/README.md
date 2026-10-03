# WordPress client

A thin plugin (SRS Appendix A): three settings, a bell endpoint, the sync loop and a local store,
plus everything a template asks of it: the query function, the template sets and the one list
function. No data logic, no CRM knowledge. How a page looks is a template set's business
(`templates/`, [docs/default-templates.md](../../docs/default-templates.md)).

```
core-client/                     the plugin
  core-client.php                header and requires
  includes/settings.php          Core URL, tenant token, bell secret; the template set, shadow DOM and the
                                 status ids of the site's lists; the sets on offer with an Install button
  includes/store.php             post types, the index table with its search columns, upsert and delete
  includes/query.php             core_client_query(): one parameter set in, one page of items out
  includes/templates.php         the sets' registry, the override rule (theme first), the list function,
                                 the shortcode, the reload endpoint, the routing of single pages and archives
  includes/view-page.php         the theme's header and footer around one view
  includes/packages.php          places the updater, keeps the package list, installs a set from the channel
  includes/sync.php              the SRS §8 loop
  includes/bell.php              POST /wp-json/core/v1/bell
  includes/schedule.php          the 15 minute backstop, an Action Scheduler recurring action
  includes/routing.php           /objekt/<id> and old slugs answer 301 to the current permalink
  includes/cli.php               wp core-client sync [--force], wp core-client status
  includes/report.php            error reporting through Core
  updater/core-client-updater.php  the must-use updater the plugin places itself; never loads plugin code
  lib/action-scheduler/          Action Scheduler 4.1.0, bundled (GPLv3)
themes/kowboy-2026/              the default template set "Kowboy 2026", a theme (docs/kowboy-2026.md)
release.php                      packages the plugin, the theme or a set, and writes the index of sets
test/                            setup.sh, install.php, driver.php and site.ts for the suites
sync.test.ts                     the shared sync scenarios, the updater, the packaging, WP-CLI
templates.test.ts                the theme, its blocks and the template machinery on a real WordPress
```

## Installing it on a site

1. Upload `core-client.zip` under Plugins → Add New → Upload Plugin and activate it. On activation
   the plugin puts its updater into `mu-plugins/` itself.
2. Settings → Kowboy Core: the Core URL, the tenant token and the bell secret. The page shows the
   bell URL to give Kowboy, `https://<site>/wp-json/core/v1/bell`, and the last successful sync.
3. On the same page, under Templates: install a set with one click (the sets the update channel
   offers are listed there; a set can also be uploaded as a zip like any plugin), pick the set,
   and name which of the CRM's status ids this site lists as for sale, as coming and as sold.

The first sync happens on the first bell or the next 15 minute run, or now: `wp core-client sync`.

**How a bell is answered.** The endpoint answers 202 and then pulls from Core in that same request,
after the answer has gone out, so neither a queue nor traffic is needed for a bell to take effect.

**The backstop.** Every 15 minutes a sync runs anyway, as a recurring Action Scheduler action, in
case a bell was lost. Action Scheduler is bundled with the plugin (`lib/action-scheduler`), so
nothing else is installed, and every run is listed under Tools → Scheduled Actions. Its queue is
ticked by WP-Cron; a site with `DISABLE_WP_CRON` runs `wp-cron.php` from system cron every minute,
or `wp action-scheduler run`.

## What the site gets

- Permalinks are the site's, never Core's (strategy §12.23 and §12.26), under Swedish paths:
  `objekt/<status>-<area name>-<street address>-<id>` for properties and `projekt/` the same for
  projects, `kontor/<office name>-<id>`, `forening/<association name>-<id>`, `maklare/<first name>-<last name>-<id>`
  and `omrade/<municipality>-<area name>-<id>`. Every entity ends in `-<id>`. A request by id alone (`/objekt/<id>`) or by an old
  slug (`/objekt/<old slug>-<id>`) answers 301 to the current permalink, and a removed or unknown
  id answers 301 to the property archive (`includes/routing.php`). Until the slugs are built the
  placeholder slug is connection plus id.
- The sitemap's change date is the post's modified time, which WordPress sets on every write; a
  write happens only when the content changed (question 43). The CRM's own change time is in the
  record for the templates.
- Errors go through Core (question 46): every report, a fatal error in the plugin's own files
  included, is posted to Core's `/v1/errors` with the tenant's token, where the same bug on many
  sites is one report a day. No Sentry key on the site.
- One post type per datatype: `core_property` (archive and permalinks under `/objekt/`),
  `core_agent`, `core_office`, `core_area`, `core_association`, `core_project`. Public, so sitemaps, permalinks and
  cache plugins see them.
- The item, exactly as Core served it, in the post meta `core_data`: `core_client_item($post_id)`
  returns it as an array; `display.*` are the strings to show. The CRM payload, exactly as Core
  served it, in the post meta `core_raw`: `core_client_item_raw($post_id)` (Patric, 2026-09-18),
  whatever `data` does not name yet. `core_client_items($datatype, $ids)` resolves the records an
  item points at (its agents, its office).
- `post_date` and `post_modified` are the CRM's `remote_updated_at`, never the local write time
  (SRS §7.1), so sitemaps and "updated" dates are right without any template logic.
- Every item goes through `wp_insert_post`, `wp_update_post` and `wp_delete_post`, so WordPress
  fires what cache plugins listen for (`save_post`, `transition_post_status`, `clean_post_cache`,
  `deleted_post`), and the plugin adds `core_item_updated($post_id, $datatype)` and
  `core_item_deleted($post_id, $datatype)` for anything that wants the item itself.
- The index table `wp_core_index` answers which post holds an item and its hash, and carries the
  search columns every list query reads: copies of universal names (`status.id`, `type.id`,
  `tenure.id`, `price`, `living_space`, `rooms`, the area name, city and street, `project_id`,
  the agent ids, `published_at`, `sold_at`, a name to sort by, the office ids of an agent, the
  area id), filled on every write, never judged.

## Templates: the query function, the list function, the sets

**The query function.** `core_client_query(array $params)` takes one parameter set and answers
one page: `items` (post id and item each), `total`, `has_more`, `page`, `per_page`. Parameters:
`entity`; `status`, `type`, `tenure` (ids, comma-separated; for `status` the names `for_sale`,
`coming` and `sold` stand for the ids the site named in its settings); `max_price`,
`min_living_space`, `min_rooms`; `area` (free text against area name, city and street);
`agent`, `office`, `project`, `area_id`; `include_project_homes` (a property that names a project
is otherwise kept out of every list but its project's, question 55); `sort` (`newest`, `sold`,
`price_asc`, `price_desc`, `updated`, `name`); `per_page`, `page`. A custom-design theme calls it
directly and renders what it likes.

**The one list function.** `core_client_list(array $params)` runs the query and renders
`card-<entity>.php` per item and, unless `part` is `cards`, the wrapper `list-<entity>.php`
around them, wrapped in a shadow root when the site's setting or `shadow` says so. The shortcode
`[core_list entity="property" status="for_sale,coming" per_page="10"]`, the archive pages, the
reload endpoint `GET /wp-json/core/v1/list?<the same parameters>` (which answers `html`,
`total`, `has_more`, `page`) and any PHP call it with the same parameter set, passed through
untouched: a parameter added to the query is at once available everywhere.

**Template sets.** A set is a theme (the default, `themes/kowboy-2026/`, docs/kowboy-2026.md)
or a plugin: one file that registers the set in one line (`core_client_register_template_set`,
from a theme's `functions.php` or a plugin's main file), one file per view
(`single-core_<datatype>.php`, `archive-core_<datatype>.php`, `list-<entity>.php`,
`card-<entity>.php`; a theme keeps them under `core/`), and `assets/<slug>.css` and
`assets/<slug>.js`, enqueued on every public page and linked inside each shadow root (shadow DOM
is on unless the site turns it off). The site picks one set on the settings page; with none
chosen, the active theme's set, else the one installed set. A client's own set is a copy of the
theme under its own name.

**The override rule.** `core_client_template($file)` looks in the theme first
(`<theme>/core/<file>`, child theme before parent), then in the chosen set. Editing a view means
copying it into the theme; the set's folder is never edited on a site, and an update never
touches the theme, so a site that changed the card alone keeps getting every other view's updates.

**Routing.** A single page or an archive of a `core_*` post type renders through
`includes/view-page.php`: the theme's header, the view (with `$post_id`, `$item` and `$raw` in
scope on a single page), the theme's footer. A view file is a PHP block on top that prepares the
values and plain markup below.

**Looking at a record's data.** `?debugpl` on any record's page (a property, an agent, an
office, an area, a project, an association) shows the record as the local copy holds it, in a
foldable JSON viewer (`lib/json-viewer`, the `@andypf/json-viewer` web component, MIT): `item`
(the universal record with `display`) and `raw` (the CRM's payload). For signed-in users who may
edit the site, since the payload may hold what the page does not show.

## Safe update

The must-use updater tells WordPress's own updater where releases come from and enables auto-update
for every package on the site's list: the plugin and each template set. The plugin keeps that list
in the option `core_client_packages` together with the update channel; the updater reads the option
and never loads plugin code, so a broken release is replaced by the next one. Per package, the
channel holds `<package>/<package>.json`:

```json
{ "version": "1.2.0", "package": "https://…/core-client/core-client-1.2.0.zip" }
```

and `sets.json`, the index the settings page lists for installation. The channel's address travels
inside the plugin's zip (`channel.json`, written by `release.php`); a site pins another channel,
the staging one, with `define('CORE_CLIENT_CHANNEL', 'https://…/');` in `wp-config.php`.

Every `v*` tag of this repository packages the plugin and every set (`release.php`), publishes
them to the DigitalOcean Space named by the repository variables `DO_SPACES_BUCKET` and
`DO_SPACES_REGION` (with the secrets `DO_SPACES_KEY` and `DO_SPACES_SECRET`), and attaches them
to the GitHub Release as the record (`.github/workflows/release.yml`).

## Checking it

`npm run test:wordpress` runs the shared scenario suite and the template suite against a real
WordPress install (a classic theme, the plugin and the default set active) plus the updater and
WP-CLI tests; see [../README.md](../README.md) for the one-time setup. PHPStan runs in CI's
warnings job: `composer install` and `vendor/bin/phpstan analyse`, both in this directory.

On the site itself, an administrator sees one notice on every admin page while the plugin cannot
sync (Patric, 2026-09-18): the site is not linked (no Core URL or token), its licence is not
active (Core refuses the token), or the last sync failed. In every case the site keeps showing
what it has; only the updates stop. `wp core-client status` carries the same text as `notice`.

## What the site tells Core

After each page it pulled, the plugin posts to `POST /v1/applied` which records it applied and which
it could not use, with the tenant's token (question 37, 2026-09-18). Core puts that on each
record's timeline, so an operator sees a change travel from the CRM to this site. A report that
cannot be delivered is logged and never stops a sync.
