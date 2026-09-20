# The default templates: one package, three ways to use it, parity with the reference site

Step 2 of two. Proposed 2026-09-20, revised the same day for Patric's answers, and reset the same
evening by his strategy: **two sites, and the v3 site's output as the specification.** Kowboy sets
up one WordPress site running the old plugin (version 3) with a client's data, and one blank
WordPress site; an agent gets the admin login of both, writes the new templates from what the v3
site shows, and iterates until the blank site, running Core's plugin and the templates, shows the
same. The old plugin's files are never read: what the customer sees is the specification. Open:
questions 71 (the v3 site), 73 (the blank site) and 74 (the shortcodes to match). It runs in the
same loop as step 1 ([staging-site.md](staging-site.md)); the blank site is step 1's test site.
Next-steps item 10 (the templates on the universal model, question 55) is done inside this step.

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

**One package per template set.** The first set is `2026`, so the package is
`core-client-templates-2026`; the next style is `core-client-templates-2027` or whatever it is
called; a set made for one client is `core-client-templates-<client>`. Each is a WordPress plugin:
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

## How the templates are made: two sites, the output as the specification

**The rule first.** AGENTS.md forbids taking anything from the WordPress plugins v1 to v3. Patric's
strategy of 2026-09-20 keeps that whole: the templates are written new, from what the v3 site
_shows_, never from what its files contain. On the v3 site an agent uses the WordPress admin (to
make pages with the old shortcodes) and the public pages (to read the output); it opens no file
of that site, so the old code is never read, and the v3 template files of question 70 are not
needed. (Patric offered git and SFTP access to the v3 site as well; neither is needed, and SFTP is
unreachable from where agents run anyway.)

**The two sites.**

| Site                      | Runs                                                  | The agent gets                        | Used for                                                                                     |
| ------------------------- | ----------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------- |
| The v3 site               | the old plugin, version 3, with a client's data       | its address and WordPress admin login | pages with the old shortcodes, in every variant; their output is the specification           |
| The blank site (step 1's) | Core's plugin and the template sets, on the same data | its address and WordPress admin login | the same pages with the new shortcodes; the loop runs until its output matches the v3 site's |

Both sites must show the same records: the blank site's tenant on staging Core gets the same CRM
account as the v3 site (the test account staging already holds, or the client's, which an agent
adds on the tenant page once its login is given).

1. **Pages.** On the v3 site the agent makes one page per shortcode and variant it must match
   (lists with their filters and sorts, a project's homes, an agent's listings, an office's, and
   so on), and the single pages exist by permalink. The shortcodes and attributes to cover come
   from Patric or from the client's pages already on the site (question 74). The same pages are
   made on the blank site with the new shortcodes.
2. **Inventory.** From the v3 site's output, page by page: every value shown, its universal name
   or `display` key on Core's side, "needs a rule" or "not in the model". The table is the
   parity inventory of AC 28, made mechanical, and the field specification seen from the
   template side.
3. **Gaps, sorted by one rule**, so the agent acts without a question for each:
   - **Raised, behind the gate.** A value the v3 site shows on a card or at the top of a single
     page whose prepared string `display` lacks (a ledger entry, drafted and registered); a value
     that exists nowhere in `data` (a model question); a filter or sort the v3 site offers that
     the query function cannot answer. Each is one register question, raised in one batch after
     the inventory; meanwhile the spot in the template stays empty. A closed gate is not a note.
   - **Added on the agent's own, listed.** A value present in `data`, shown as sent in a fact row
     or under a label, with at most the site's own date and time settings applied. Every such
     addition is a line in the inventory, so it can become a ledger entry later. This is what
     "obscure" means here: shown, not formatted.
   - **Core's, already decided.** A hidden price, a hidden address, whether bids show, and the
     lines between "till salu", "kommande" and "referenser" come prepared from Core (question
     72, approved: a prepared string is absent when the CRM says hide, and every listing carries
     a prepared `state` next to the CRM's own status, next-steps item 14). The templates show and
     group by those.
   - **The site's own logic.** Past viewings, wording, layout: decided in the templates, as
     AGENTS.md puts it on the site, and noted in the inventory as the site's rules.
4. **Write and compare**, page by page, on the blank site: for each page the two outputs are
   fetched, the templates' own markup is compared after normalising what cannot match
   (whitespace, nonces, asset addresses, the host, image widths, timestamps), and the list
   wrapper's reload answers are compared for the same filters. The result is a diff per page, and
   the loop runs until every diff is empty or is a raised question. The comparison is scoped to
   the templates' markup, so the two sites need no common theme.
5. **Acceptance.** AC 28 gets the comparison as its tests and AC 20 its search half; both are
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

## What it needs from Patric

- **71** the v3 site's address and its WordPress admin login, once it is set up.
- **73** the blank site's address and its WordPress admin login, once it is set up (step 1's
  site).
- **74** the shortcodes and attributes the templates must match, or the word that the client's
  pages on the v3 site cover them.
- Already open: 54 (a) to (e) as the templates need them; 52 is untouched (golden masters come
  from the test account).

## Order of work

Now, needing no answer: the set package's skeleton (`core-client-templates-2026`), the selector,
the override rule, the installer's four parts and the release per set, and the query function in
the sync plugin. With 71 and 74: the pages on the v3 site and the inventory → the gaps raised in
one batch. With 73: the same pages on the blank site → write and compare, page by page, until the
diffs are empty → AC 28 and AC 20's search half in `acceptance/criteria.json`, the report
regenerated.

Not in this step: the Lovable example site (item 10's other half, the same universal names, later),
a site's custom design, and which sites auto-update (WordPress's own per-site setting, which the
updater already switches on).
