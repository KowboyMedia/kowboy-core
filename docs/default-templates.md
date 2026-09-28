> **2026-09-28:** the set built on the 2025 package is gone (question 107), and the default set
> "Kowboy 2026" is the theme in `clients/wordpress/themes/kowboy-2026/`, described in
> [kowboy-2026.md](kowboy-2026.md). What follows is the scaffolding and the history that led
> there; where it names `clients/wordpress/templates/`, a set plugin or `new-template-set`, the
> theme and a copy of its folder have taken their place.

# The default templates: one package, three ways to use it, parity with the reference site

Step 2 of two. Proposed 2026-09-20 and revised the same day for Patric's answers: a separate
package per template set, and the templates written new from what a site running the old plugin
_shows_, its files never read. On 2026-09-21 Patric asked for the most autonomous way to do this
for any client, and that is [template-porting.md](template-porting.md): a pair of environments
per client, a copy of the client's site with the old plugin as the source and a copy with Core's
plugin as the target, made and compared by an agent until the target shows the same. That document is
for a client's templates; this one is Kowboy's own default set, and the two are kept apart
(Patric, 2026-09-21, question 82). This file keeps what the templates are, where they live, the
gap rule, the installer, and how the default set is made: against three apps on `dev.kowboy.se`,
below. Open: question 85 (the master among the four versions). Next-steps item 10 (the templates
on the universal model, question 55) is done inside this step.

## What the templates are

Patric's list: the cards a list is made of, the single pages of every entity (property, project,
agent, office, area, association), and the list wrappers: the filter form and the script that
reloads a list without a page load. Underneath them, what they need from the plugin: the questions
a site asks its local copy (which properties, filtered and sorted how, a project's homes, "till
salu" and "referenser" as the reference site draws those lines), the permalinks under the Swedish
paths AGENTS.md fixes, and the sitemap. `display` gives them the prepared strings
(`docs/field-tables.md`, "display": prices, areas, rooms, fees, the fact tables as `sections`),
and `data` everything else under its universal name, with the whole payload next to it.

## Where they live: decided

Patric's answer (question 69, 2026-09-20): a separate package, named after the WordPress client
package with `-templates`. The shape below is the agent's pick within that answer, made for the
second half of his question: template sets will come and go as the style advances, a site should
choose among the installed ones, and a custom set for a client should be the same thing under
another name, installed and updated the same way.

Patric named three ways a site uses the templates:

| Site                            | Installed                                                           | What updates                                                                |
| ------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Custom design                   | the sync plugin only; the theme renders from the plugin's functions | the plugin                                                                  |
| The defaults, edited            | the sync plugin and a set; edited copies in the theme               | every template the theme did not copy; a copy in the theme is never touched |
| The defaults, maintained (WaaS) | both, auto-updated, no copies in the theme                          | everything, on Kowboy's release                                             |

**One package per template set.** The first set is "Kowboy 2026" (Patric, 2026-09-21, question
83): its slug is `kowboy-2026`, its folder `clients/wordpress/templates/kowboy-2026/`, its package
`core-client-templates-kowboy-2026`; the next style is `kowboy-2027` or whatever it is called; a
set made for one client is `core-client-templates-<client>`. `clients/wordpress/templates/` is the
namespace every set goes into. Each is a WordPress plugin:
a folder with a header, its templates (cards, single pages, list wrappers), its script and
stylesheet, and one line that registers the set with the sync plugin. Per set rather than one
package with a folder per set, because a site installs only the set it uses, a client's set never
ships to other customers, every set is released and updated on its own channel, and choosing a
set needs nothing more than one dropdown.

**The selector.** The sync plugin's settings page lists the sets that are installed and active and
lets the site pick one; the pick is the site's. Several sets may be installed side by side,
switching is instant, and no data changes. The theme's own copies override whichever set is chosen.

**A custom set for a client.** A copy of a set folder under a new name, made by one script
(`npm run new-template-set <name>`), edited as a set of its own, released on its own channel and
auto-updated like the rest. A customer's own developers can do the same from a package's zip: the
structure is the whole recipe.

**Where the sets live.** In this repository, `clients/wordpress/templates/<set>/`, next to the
plugin, so CI runs every set against the plugin and the staging site carries them. The release
workflow packages each set as its own zip and JSON (`core-client-templates-<set>.json`) on the
Space, next to the plugin's, and the updater's list gains a line per installed set.

**Dependency.** A set declares `Requires Plugins: core-client` (WordPress 6.5 and later refuse to
activate it before the sync plugin is active; for a plugin outside WordPress.org no install link is
offered, which is fine, the plugin comes first anyway) and the plugin version it needs, checked
when it loads, with a notice when the plugin is older. The sync plugin depends on no set.

**The split inside the client.** The sync plugin (`core-client`) keeps the local copy and every
question a template can ask of it: `core_client_item()`, `core_client_item_raw()`, one query
function for lists (filters, sort, paging, and the `project_id` rule of question 55), the
permalinks and routing, the sitemap. Custom-design themes call the same functions. This is the
search half of AC 20, proved without a browser in the scenario suite: the same answers as the
Lovable kit on the same dataset. The templates package holds only how it looks: the cards, the
single pages, the list wrappers with their form, script and stylesheet, and the endpoint that
renders cards for the wrapper's reloads. It shows what `display` gives and formats nothing (the
ledger does, AGENTS.md). What stays the site's own decision, past viewings, wording, layout, is
taken in the templates; a hidden price and the listing state come prepared from Core (question
68, approved).

**The override rule.** A template is looked up in the theme first (`<theme>/core/<file>`), then in
the package. Editing means copying the file into the theme; the package's own folder is never
edited on a site, and an update never touches the theme. So a site that changed the card alone
keeps getting every other template's updates.

**Releases.** Every set has its own version and its own release JSON on the Space; the must-use
updater keeps a list, one line per package it watches; a `v*` tag packages the plugin and every
set (`.github/workflows/release.yml`), and the staging channel of step 1 carries them all on every
change. One approval promotes everything (strategy §4).

## The scaffolding: one file per view

Patric's decision of 2026-09-21, made in the session that built the "kowboy-v4" package (a
conversation outside this repository) and recorded on 2026-09-23. It is what "simplest possible
scaffolding" means here, and every set follows it:

- **One file per view.** `single-core_property.php` and its siblings for the single pages, named
  the WordPress way so the theme hierarchy finds them; `list-<entity>.php` for each list wrapper
  (the filter form, the cards' container, "show more"); `card-<entity>.php` for each card; archive
  pages of a few lines that call the list function. Every file is a PHP block on top that prepares
  the values and plain markup below: a WordPress developer changes a value at the top and the
  layout underneath, and nothing is hidden in helpers, parts or classes.
- **One loader.** About a hundred lines: it finds a template (theme first, then the set),
  registers the shortcode and the reload endpoint, and wraps a view in a shadow root when asked.
  Nothing else lives outside the view files.
- **One list function.** The shortcode, the archive page, the reload endpoint and any PHP call the
  same function with one parameter set, passed through untouched, so a parameter added to the
  function is at once available everywhere. The first page of a list is rendered on the server
  (crawlable, no script needed); on load the script hydrates the list with one reload call, and
  it reloads on filter changes and on "show more".
- **Shadow DOM as a setting.** One boolean of the site, and a parameter of the list function:
  declarative, rendered on the server, wrapping the view. The stylesheets stay `.css` files
  linked in both modes, never CSS inside PHP strings; the scripts query from the shadow root
  when there is one; a list inside a single page never opens a second root.
- **From the package, on Patric's word (2026-09-23, question 86).** The package's PHP is not
  reused; its markup is flattened to plain HTML and sliced per view file, its CSS and JavaScript
  go into the set's assets.

## How the default set is made: the master is norbanmakleri.se live

Patric's answer of 2026-09-23 to question 85: the master is norbanmakleri.se as it runs live, so
the set's single pages, lists and cards must show what that site shows, and the v2 and v3 apps
below are no longer needed for the choice. What the site shows is read over HTTPS: its lists are
filled by the old plugin's reload endpoint and its single pages carry their markup inside a
script, both readable without a browser. The plan as it stood on 2026-09-21 follows.

### As planned on 2026-09-21: three apps on dev.kowboy.se

Patric's instruction (2026-09-21, questions 82, 84 and 85): the default set is written against
three apps on `dev.kowboy.se`, on the Cloudways server the names `*.dev.kowboy.se` already point
at (165.22.87.59), each with the Vitec test account (`M31529`; on staging Core as tenant
`kowboy-test`) and the default plugin templates, nothing customised:

| App                | Runs                                                           | Role                                           |
| ------------------ | -------------------------------------------------------------- | ---------------------------------------------- |
| `v2.dev.kowboy.se` | plugin v2 from Kowboy's release host, installed as a black box | one of the four candidate masters              |
| `v3.dev.kowboy.se` | plugin v3 from Kowboy's release host, installed as a black box | one of the four candidate masters              |
| `v4.dev.kowboy.se` | Core's plugin and the set `kowboy-2026`, synced from staging   | the target: made to show what the master shows |

The two old plugins are installed through the WordPress admin from their zips and set up through
their own settings pages; their files are never opened (AGENTS.md). The scope is the whole list
above, every entity and the list wrappers (question 84, the wider scope), with properties, agents
and areas, list and single, compared first. The master is one of four versions, norbanmakleri.se
live, plugin v2, plugin v3 or the theme in `saas-acf-template`, and Patric picks it after seeing
them (question 85): the agent fetches every public page of norban and of the v2 and v3 apps,
compares them region by region and reports the differences per page and per version, and reads
the child theme's three property list-item files (Kowboy's own theme code, so readable) to say
whether they are a misplaced default or a deviation; norban is meant to run complete defaults,
so anything customised there is a developer's mistake, possibly correct code in the wrong place.
The loop is then the one of [template-porting.md](template-porting.md): inventory, port, compare,
gaps, delivery, with the master as the source and `v4.dev.kowboy.se` as the target.

## How the templates are made: the output as the specification

**The rule first.** AGENTS.md forbids taking anything from the WordPress plugins v1 to v3. Patric's
strategy of 2026-09-20 keeps that whole: the templates are written new, from what a site running
the old plugin _shows_, never from what its files contain. On the source site an agent uses the
WordPress admin and the public pages; it never opens the old plugin's files. A client's own
template files (its theme's templates, which Kowboy wrote) are part of what Patric asks to port,
so they are read; the old plugin's helpers behind them are not, and what those helpers produce is
learned from the rendered pages.

**The environments** (a source and a target per client) and **the loop** (inventory, port,
compare, gaps, delivery) are in [template-porting.md](template-porting.md). The rule for gaps,
applied there, so the agent acts without a question for each:

- **Raised, behind the gate.** A value the source shows on a card or at the top of a single page
  whose prepared string `display` lacks (a ledger entry, drafted and registered); a value that
  exists nowhere in `data` (a model question); a filter or sort the source offers that the query
  function cannot answer. Each is one register question, raised in one batch after the
  inventory; meanwhile the spot in the template stays empty. A closed gate is not a note.
- **Raised and fixed.** A helper or a field that exists in version 4 but is wrong, or a helper
  the plugin lacks (Patric, 2026-09-21): fixed or added in the same change, with a test, and
  raised all the same, in the one numbered table below, so the state of the model and of the
  helpers is visible as it is found.
- **The table.** Every gap of either kind, in the model or in the helpers, is one row in a
  numbered table in chat, the numbers being the register's, each with a plain explanation of what
  the page shows, what version 4 has, and what was done or is asked (Patric, 2026-09-21).
- **Added on the agent's own, listed.** A value present in `data`, shown as sent in a fact row or
  under a label, with at most the site's own date and time settings applied. Every such addition
  is a line in the inventory, so it can become a ledger entry later. This is what "obscure"
  means here: shown, not formatted.
- **Core's, already decided.** A hidden price, a hidden address, whether bids show, and the lines
  between "till salu", "kommande" and "referenser" come prepared from Core (question 72,
  approved: a prepared string is absent when the CRM says hide, and every listing carries a
  prepared `state` next to the CRM's own status, next-steps item 14). The templates show and
  group by those.
- **The site's own logic.** Past viewings, wording, layout: decided in the templates, as
  AGENTS.md puts it on the site, and noted in the inventory as the site's rules.

**Acceptance.** AC 28 gets the comparison as its tests and AC 20 its search half; both are
changes to `acceptance/`, reviewed through the change that makes them.

## Installing and updating: the user's path

Patric's requirement (2026-09-20): installing the plugin and any template package must be very
simple, from an address that keeps them updated, so that "Plugins → Update" in the WordPress
admin works. Decided (an agent's decision, within the rules):

1. **One upload, one click.** The user downloads `core-client.zip` from Kowboy's address and
   uploads it under Plugins → Add New → Upload Plugin, the WordPress way for a plugin that is not
   on WordPress.org, and activates it. On activation the plugin places the small updater file into
   `mu-plugins/` itself, so nobody copies a file by hand; the updater keeps running on its own
   afterwards and never loads plugin code, which is what keeps a broken release replaceable (the
   safe-update rule of SRS §8, the stated reason for not using an update library inside the
   plugin).
2. **Updates through WordPress itself.** The updater answers WordPress's own update check for
   every Kowboy package on the site (the `Update URI` header and its `update_plugins_<host>`
   filter, WordPress 5.8 and later): it reads one release JSON per package from Kowboy's address,
   and WordPress shows the update under Plugins, applies it on a click, or by itself, since the
   updater switches auto-update on. The updater watches a list, the plugin and every template
   set, instead of one file.
3. **Template sets from the plugin's own page.** The plugin's settings page reads an index of the
   available sets from the same address (`sets.json`: name, version, package) and shows each
   with one button, Install; the click runs WordPress's own plugin installer on the package, the
   set is activated and selected, and it updates like the plugin from then on. A set can still
   be uploaded as a zip like any plugin.
4. **Where the addresses live.** The Space (DigitalOcean's file storage, approved 2026-09-16)
   holds one folder per package with its zip, its release JSON and the index; the production
   channel is written by a job on the production Core app on each release, and the staging
   channel by a job on the staging Core app on each landing (step 1). The keys sit in the apps'
   environment, set by an agent through the DigitalOcean API, so no key is ever pasted anywhere
   and no secret sits in GitHub; the tag workflow keeps attaching the files to the GitHub Release
   as the record.

## Built on 2026-09-24: the set, the machinery, the drafted strings

Steps 1 to 3 of next-steps item 17, and item 18, on the local WordPress of the test suite (the
Cloudways site waits on questions 87 and 88). What stands:

- **The sync plugin** (`clients/wordpress/core-client`, version 0.2.1): the query function
  (`includes/query.php`), the sets' registry, the override rule, the one list function, the
  shortcode `[core_list]`, the reload endpoint `GET /wp-json/core/v1/list`, the routing of single
  pages and archives through `includes/view-page.php`, shadow DOM as a setting, and the installer:
  the updater placed on activation, one option the updater watches (the channel and every
  package), the sets on offer with an Install button, three settings naming which of the CRM's
  status ids the site lists as for sale, as coming and as sold (`for_sale`, `coming`, `sold` in
  every parameter set, until item 14's `state` replaces them). The loader lives in the plugin,
  once, not in every set: a second set would otherwise carry a copy of it, and a custom-design
  theme gets the list function without any set.
- **The set** (`clients/wordpress/templates/kowboy-2026`, package
  `core-client-templates-kowboy-2026`): one file per view (`single-core_property.php`,
  `single-core_agent.php`, `single-core_office.php`, `single-core_area.php`,
  `archive-core_property.php`, `archive-core_agent.php`, `list-property.php`, `list-agent.php`,
  `card-property.php`, `card-agent.php`). Since 2026-09-28 the markup, the stylesheet
  (`assets/kowboy-2026.css`: the package's Tailwind build and component stylesheets) and the
  behaviours (`assets/kowboy-2026.js`, with Swiper and the Ken Burns carousel vendored under
  `assets/vendor/`) come from the "kowboy-templates-v2-v3" package Patric attached, its 2025
  template, on his word (question 89 closed; before that the markup was written from the site).
  The package's stylesheet is written for a shadow root, so the set registers with shadow DOM on;
  its typeface Manrope comes from Google Fonts. One registration line in its main file.
  `npm run new-template-set <slug>` copies it into a new set.
- **The release** (`release.php`, `.github/workflows/release.yml`): every `v*` tag packages the
  plugin and every set, each with its release JSON under `<channel>/<package>/`, plus `sets.json`,
  and the plugin's zip carries `channel.json` so a fresh install knows its channel.
- **The tests** (`clients/wordpress/templates.test.ts`, 9 cases on a real WordPress with a classic
  theme): the archive as the for-sale list rendered on the server, the reload endpoint, every
  filter and sort, the property, agent, office and area pages, the theme override, shadow DOM, the
  selector. AC 20's search half and AC 28 name them (`acceptance/criteria.json`).
- **The drafted strings** (item 18): R-015 to R-019 in `rules-ledger/`, implemented in
  `engine/rules/` with tests, shown by the set, and `golden/vitec/` with eight cases from the test
  account's real records, the same objects the master shows. All for question 90.

### The comparison, page by page

Read on 2026-09-24 from norbanmakleri.se over HTTPS (its lists come from its reload endpoint, its
single pages carry their markup in a script), laid against the set's pages rendered from the same
records on the local WordPress. Matching: the cards (label, images, street, price, tenure, rooms,
size, "Avgift <amount>"), the property hero (street, price wording, status badge, price, area,
rooms, size, fee), the selling text, the fact list (price, Område on a sold home, Rum, Avgift,
Boarea, Byggnadsår, Våning with the elevator, Balkong/Uteplats/Bilplats, Typ), the floor plans,
the viewings (date and time in the site's own zone and language), the agents at the side, the
gallery with "Visa fler bilder", the map, a sold home without fact tables and with "Slutpris", the
agent page (card, reviews, "Ett urval av mina objekt"), the office page (contact, map, agents,
properties), the area page (name, "Experter på", agents, properties). The site's own rules, kept
in the templates: the card's label is the next viewing when one is ahead, else the status; a
floor plan is an image filed under "Planritning"; a sold home shows no fact tables; "Kontakta oss
för visning." when no viewing is set and the office wrote no text.

The gaps, each one register question: 91 decimals (the master's "1.5 rum" against the ledger's
comma), 92 the fact tables (the master's eleven sections against R-013's seventeen; the
"Föreningen" rows the set renders itself from the association's record), 93 enumerations Vitec
sends as bare ids ("Buyer", "Undetermined", "PrivateHousingCompany") the master shows as words,
94 the documents the master lists (not in the advertising payload), 95 the viewing's "Boka här"
and the interest form (both post to the CRM; a Core capability), 96 an energy value the payload
does not carry. Not ported, by design: the master's blocks outside the templates (the hero with
buttons, the agents block on the home page, the lead form in the footer) are the site's pages, and
its "Bor du redan här?" button leads to that lead form.

## What it needs from Patric

- **90** to **96**: the drafted strings and the gaps of the comparison, above.
- **87** and **88**: the tokens, for `v4.dev.kowboy.se` and the release channel.
- Already open: 54 (a) to (e) as the templates need them; 52 is untouched (golden masters come
  from the test account).

## Order of work

Done on 2026-09-24 (above): the set, the selector, the override rule, the installer's four parts,
the release per set, the query function, the drafted strings, the comparison against the master
on the local WordPress, AC 28 and AC 20's search half, the report. Next: Patric's answers to 89
to 96; the loop on the staging site (`wordpress-1545003-6698706.cloudwaysapps.com`, the plugin
and the set installed there on 2026-09-28 by `scripts/deploy-site.mjs`, records once the site
is joined to staging Core, question 98), the page-by-page diff there with screenshots from the
live site (Patric, 2026-09-28: the set "does not look correct at all", so the loop moves to a real
site). Next-steps item 17 holds the order.

Not in this step: the Lovable example site (item 10's other half, the same universal names, later),
a site's custom design, and which sites auto-update (WordPress's own per-site setting, which the
updater already switches on).
