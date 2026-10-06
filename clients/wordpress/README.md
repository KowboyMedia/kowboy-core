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
  includes/municipalities.php    Sweden's 21 län and 290 kommuner by LKF code, and a name's codes
  includes/areas.php             the outline test, and the table of which areas a home is in
  includes/query.php             core_client_query(): one parameter set in, one page of items out
  includes/templates.php         the sets' registry, the override rule (theme first), the list function,
                                 the shortcode, the reload endpoint, the routing of single pages and archives
  includes/blocks.php            the two list blocks, their settings for a theme's wrappers, the pick endpoint
  includes/forms.php             the two form receivers on the WordPress API (a form, which goes on to Core with the token and the bot check's proof; a viewing's times, read from Core) and the bot check's public key for the theme's window (docs/forms.md)
  includes/place-search.php      the search box: the places query, the box with its pills, its assets
  includes/view-page.php         the theme's header and footer around one view
  includes/packages.php          places the updater, keeps the package list, installs a set from the channel
  includes/sync.php              the SRS §8 loop
  includes/bell.php              POST /wp-json/core/v1/bell
  includes/schedule.php          the 15 minute backstop, an Action Scheduler recurring action
  includes/routing.php           /<path>/<id> and old slugs answer 301 to the current permalink
  includes/cli.php               wp core-client sync [--force], wp core-client status
  includes/report.php            error reporting through Core
  blocks/<name>/                 block.json and render.php of "Bostäder" and "Mäklare"
  assets/editor.js               the editor side of every block: the panel from block.json, the preview, the picks
  assets/place-search.js, .css   the search box's setup over Tom Select and its structure, loaded only on a page that drew one
  updater/core-client-updater.php  the must-use updater the plugin places itself; never loads plugin code
  lib/action-scheduler/          Action Scheduler 4.1.0, bundled (GPLv3)
  lib/tom-select/                Tom Select 2.6.2, the search box's combo box, bundled (Apache-2.0)
themes/kowboy-2026/              the default template set "Kowboy 2026", a theme (docs/kowboy-2026.md)
release.php                      packages the plugin, the theme or a set, and writes the index of sets
test/                            setup.sh, install.php, driver.php, site.ts and records.ts for the suites,
                                 journey-site.ts for the journeys
sync.test.ts                     the shared sync scenarios, the updater, the packaging, WP-CLI
templates.test.ts                the theme, its blocks and the template machinery on a real WordPress
e2e/, playwright.config.ts       the browser journeys: the search box, the three forms, the pages
```

## Installing it on a site

1. Upload `core-client.zip` under Plugins → Add New → Upload Plugin and activate it. On activation
   the plugin puts its updater into `mu-plugins/` itself.
2. Settings → Kowboy Core: the Core URL, the tenant token and the bell secret. The page shows the
   bell URL to give Kowboy, `https://<site>/wp-json/core/v1/bell`, and the last successful sync.
   The forms need nothing more: the theme's window talks to the plugin's receivers, which use the
   same token (docs/forms.md).
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

- Permalinks are the site's, never Core's (strategy §12.23 and §12.26), under Swedish paths and
  built from the site's own stored values the way norbanmakleri.se names its pages (question 101):
  `objekt/<status>-<city>-<area name>-<street address>-<id>` for properties and `projekt/` the
  same for projects (the name when there is no street), `kontor/<office name>-<id>`,
  `forening/<association name>-<id>`, `maklare/<agent name>-<id>` and `omrade/<kommun>-<area name>-<id>`
  (the kommun named from the area's LKF code by `includes/municipalities.php`, SCB's 290 codes).
  The status word is the list the settings page puts the status in (`till-salu`, `kommande`,
  `sold`), else the CRM's own status name. Every part follows WordPress's own slug rule: letters with
  accents become their base letters (é to e, ä to a), apostrophes, parentheses and other marks are
  dropped, and the words are cut so the slug fits 200 characters with the id intact. Every entity ends in `-<id>`, and the slug is rebuilt on
  every sync write and once on a plugin update. A request by id alone (`/objekt/<id>`) or by an
  old slug (`/objekt/<old slug>-<id>`) answers 301 to the current permalink, and a removed or
  unknown id answers 301 to the kind's archive (`includes/routing.php`), for every kind.
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
- The admin lists every kind of record under one menu, Kowboy Estates, with the settings as its
  last item. A CRM record is the sync's: a row opens as its page (View) or its data (Data,
  `?debugpl`), nothing adds, edits or deletes one from the admin, and the list's Source column
  and the edit screen say so. Agents and offices the site adds itself (question 125,
  `includes/site-records.php`) are the site's own: added, edited and deleted in the same lists,
  "This site" in the Source column, with a form for the fields the templates show (the name is the
  title, the portrait the featured image, an office's address one line as shown) and WordPress's
  draft as "not shown". They sit in the same post types and the same index under the connection
  `site` with ids `s<post number>` and addresses from the one slug function, the CRM records'
  pattern with an id of its own structure (`maklare/erik-egen-s12`, an old address or the id alone
  answering 301), so lists, cards,
  pages and routing see both kinds through one path, ordered and hidden by the one staff-list
  rule; a pull never names them, and the rebuild's sweep and a plugin update's reindex leave them. The settings page's Publishing section turns each kind on or off for the
  site: off, its pages answer 404, its archive is gone and every list of it is empty, while the
  local copy and the sync go on.
- The index table `wp_core_index` answers which post holds an item and its hash, and carries the
  search columns every list query reads: copies of universal names (`status.id`, `type.id`,
  `tenure.id`, `price`, `living_space`, `rooms`, the area name, city and street, `project_id`,
  the agent ids, `published_at`, `sold_at`, a name to sort by, the office ids of an agent, the
  area id, the association id, `listed`: 0 for an agent the CRM keeps out of the staff list on the record or on
  any office, the site's one rule over the data, the LKF code, the point, and an area's outline
  bounds with a hash of the outline), filled on every write.
- The link table `wp_core_property_areas` holds which areas a home (a property or a project
  record) is in (`docs/search.md`; Patric, 2026-10-04, question 133 a): the area the CRM named
  and every area whose outline holds the home's point, found by the plugin's own
  point-in-polygon test (`includes/areas.php`) when the record is written, against the areas
  whose bounds hold the point. The links are redone only when a home's point or CRM area, or an
  area's outline, changed. A plugin update writes the CRM's assignments again in the same
  request and rebuilds the outline matches in the background, a batch at a time, as scheduled
  actions; those run when WP-Cron next ticks (or on `wp action-scheduler run`), and until then an
  area page lists the CRM's homes only. The area filters, the area page and the area card read
  this table.

## Templates: the query function, the list function, the sets

One parameter set runs through three layers that hand it on untouched: the endpoint
`GET /wp-json/core/v1/list?<the parameter set>` calls `core_client_list($params)` (the
shortcode `[core_list <the parameter set>]` calls the same), which renders the cards of
`core_client_query($params)`, which reads the index. Every parameter is read in that last
function and nowhere else, so a parameter the query knows works from the endpoint, the
shortcode, a view and a block alike.

**The query function.** `core_client_query(array $params)` takes one parameter set and answers
one page: `items` (post id and item each), `total`, `has_more`, `page`, `per_page`. Parameters:
`entity`; `status`, `type`, `tenure` (ids, comma-separated; for `status` the names `for_sale`,
`coming` and `sold` stand for the ids the site named in its settings); `min_price`, `max_price`,
`min_living_space`, `max_living_space`, `min_rooms`; `q` (free text: the street, the area name or
the postal town begins with it, or it begins the name of a kommun or a län, which the plugin's
tables turn into codes; `area` is its old name and stands for `q` until the next release);
`lkf` (codes of two, four or six digits: the home's code begins with one); `areas` (area ids the
visitor chose: the home is in one of them, by the links below; `areas` and `lkf` together are one
group, "any of these places"); `agent`, `office`, `area_id` (ids, comma-separated: the items
belong to any of these agents, with both of a home's agents checked, offices or areas); `tags`
(`<type id>:<name>` tokens, comma-separated: the home carries any of these tags as the CRM sends
them, a sale method such as Underhand or a feature; the index holds every tag's type id and name,
and the pick endpoint lists them with the type's name, question 143 a); `project`,
`association` (the id of the record the items belong to); `include_project_homes` (a property that names a project
is otherwise kept out of every list but its project's, question 55); `include_hidden` (an agent
the CRM keeps out of the staff list is otherwise kept out of every list, while a page that names
the agent, such as a home's card, shows them; Patric, 2026-10-03); `sort` (`newest`, `sold`,
`price_asc`, `price_desc`, `updated`, `name`); `per_page`, `page`; `place_search` (`none`,
`areas` or `places`: no filter, but whether the list's wrapper draws the search box, with the
areas alone or with kommuner and län too). A custom-design theme calls it directly and renders
what it likes.

**The one list function.** `core_client_list(array $params)` runs the query and renders
`card-<entity>.php` per item and, unless `part` is `cards`, the wrapper `list-<entity>.php`
around them, wrapped in a shadow root when the site's setting or `shadow` says so. The shortcode
`[core_list entity="property" status="for_sale,coming" per_page="10"]`, the archive pages, the
reload endpoint `GET /wp-json/core/v1/list?<the same parameters>` (which answers `html`,
`total`, `has_more`, `page`) and any PHP call it with the same parameter set, passed through
untouched: a parameter added to the query is at once available everywhere.

**The search box** (`includes/place-search.php`, `docs/search.md`): one function,
`core_client_place_search($params)`, draws the box for any set that calls it (the theme Kowboy
2026 does on its search card): a plain multi-select of the places in three groups (the areas,
kommuner and län with at least one home matching the list's own setting, counted through the
list's condition, so the box offers only places that give a result), the places the address
names selected, and three hidden fields, `q` (the free text), `areas` and `lkf`. The library Tom
Select (`lib/tom-select`, question 140 a) turns the select into a combo box with the chosen
places as pills; the plugin's script and stylesheet (`assets/place-search.js`, `.css`) set it up
and shape it, and all four files load only in a request that drew a box, inside the shadow root
too. A choice, a removed pill and the form's submit send the form's fields to the list on the
page as one event, `core-list:params` on the `[data-list]` element (the set's list script merges
the detail into its parameters and reloads from the first page), and write them to the address;
without a list on the page the form loads the page with them. Words that are no place search as
free text with the pills saying where (Default 134).

**The two list blocks** (`includes/blocks.php`, `docs/search.md`): "Bostäder"
(`core-client/property-list`) and "Mäklare" (`core-client/agent-list`), with Swedish settings in
the editor's side panel: title and lead, which homes (the site's status lists), how many a page,
status tabs, filters, the place search (none, areas, or areas with kommuner and län), "show
only from these" agents, areas and offices, picked by name and stored as ids, and "show only
with these" tags (the CRM's words by type, picked as "Försäljningssätt · Underhand" and stored as
the query's tokens). They render through
the one list function and the chosen set's views, so the look is the set's, in a shadow root
when the site's setting says so (as the shortcode); the picks become the query's `agent`,
`area_id`, `office` and `tags` lists, which the reload script carries too, and a property list reads the
visitor's filters and place from the address, which never widen them (the status tabs work
through the reload script). A theme's or a set's own list block names
`"coreClientList": "property"` or `"agent"` in its block.json: the plugin merges its settings
into the block's attributes as it registers, and the block's render file calls
`core_client_list_block($attributes, $entity, $extra)`; the theme Kowboy 2026 does so for its
two, keeping its background and its text card, and so needs plugin 0.5.1 or newer on the site
before theme 1.1.0 (the order of a deploy). The editor side is one script,
`assets/editor.js`: it builds every block's panel from the attributes' `control` keys and
previews the block as the server renders it, for the plugin's blocks and for every block a theme
appends to the list (`core_client_editor_blocks($names)`, an inline script before the handle
`core-client-editor`). The picks come from `GET /wp-json/core/v1/picks?entity=agent|office|area`,
answered to a signed-in editor only (`edit_posts`): every record, hidden agents included, as `id`
and a label that tells namesakes apart (an area with its kommun, an agent with an office, an
office with its town, the id when two still match).

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
office, an area, a project, an association) answers the record as the local copy holds it, as
plain JSON (`application/json`, the browser shows it): `item` (the universal record with
`display`) and `raw` (the CRM's payload), for everyone, signed in or not.

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
WP-CLI tests; see [../README.md](../README.md) for the one-time setup. `npm run
test:journeys:wordpress` walks the search box in a real browser (Playwright) on that WordPress
with the template suite's records, served by `test/journey-site.ts` out of `dist`, so `npm run
build` comes first (CI's wordpress job runs both; a machine with its own Chromium names it in
`PLAYWRIGHT_CHROMIUM_EXECUTABLE`). PHPStan runs in CI's warnings job: `composer install` and
`vendor/bin/phpstan analyse`, both in this directory.

On the site itself, an administrator sees one notice on every admin page while the plugin cannot
sync (Patric, 2026-09-18): the site is not linked (no Core URL or token), its licence is not
active (Core refuses the token), or the last sync failed. In every case the site keeps showing
what it has; only the updates stop. `wp core-client status` carries the same text as `notice`.

## What the site tells Core

After each page it pulled, the plugin posts to `POST /v1/applied` which records it applied and which
it could not use, with the tenant's token (question 37, 2026-09-18). Core puts that on each
record's timeline, so an operator sees a change travel from the CRM to this site. A report that
cannot be delivered is logged and never stops a sync.
