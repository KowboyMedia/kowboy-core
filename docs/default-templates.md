# The default templates: one package, three ways to use it, parity with the reference site

Step 2 of two. Proposed 2026-09-20 and revised the same day for Patric's answers: a separate
package it is, named after the client package with `-templates`, and one package per template set
is the agent's pick within that. Open: questions 70 (the template files) and 71 (the reference site)
(68 is answered: hidden values and the listing state come from Core). It needs step 1's site ([staging-site.md](staging-site.md))
for the parity check and runs in the same loop. Next-steps item 10 (the templates on the universal
model, question 55) is done inside this step.

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

## How the port happens

**The rule first.** AGENTS.md forbids taking anything from the WordPress plugins v1 to v3 unless
Patric asks for it item by item. This step is that ask, and it covers the **template files only**:
the templates folder of v3 and the list wrapper's script and stylesheet, handed over by Patric and
kept as `docs/inputs/templates-v3/`, the input of record. Agents open no old repository. Nothing
else of the old plugin comes along: every helper call, every field name and every condition in
those files is replaced on port by the plugin's functions, the universal names and `display`
(question 70).

1. **Inventory.** From the supplied files: every field, helper and condition each template uses,
   in one table, old reference → universal name, `display` key, "needs a rule" or "not in the
   model". The table is the field specification next-steps item 2 waited for, seen from the
   template side, and it makes the parity inventory of AC 28 mechanical.
2. **Gaps, sorted by one rule**, so the agent acts without a question for each:
   - **Raised, behind the gate.** A field the reference site shows on a card or at the top of a
     single page whose prepared string `display` lacks (a ledger entry, drafted and registered); a
     field that exists nowhere in `data` (a model question); a filter or sort the reference site
     offers that the query function cannot answer. Each is one register question, raised in one
     batch after the inventory; meanwhile the spot in the template stays empty. A closed gate is
     not a note.
   - **Added on the agent's own, listed.** A field present in `data`, shown as sent in a fact row
     or under a label, with at most the site's own date and time settings applied (the site's
     locale is the site's, SRS §7). Every such addition is a line in the inventory, so it can
     become a ledger entry later. This is what "obscure" means here: shown, not formatted.
   - **The site's own logic.** Past viewings, wording, tags, what to show where: decided in the
     templates, as AGENTS.md puts it on the site, and noted in the inventory as the site's rules.
     A hidden price, a hidden address, whether bids show, and the lines between "till salu",
     "kommande" and "referenser" are Core's (question 72, approved 2026-09-20, next-steps item
     14): a prepared string is absent when the CRM says hide, and every listing carries a
     prepared `state` next to the CRM's own status. The templates show and group by those.
3. **Port**, file by file, onto the package with the override rule, on the staging site.
4. **Parity**, automated, in the smoke job of step 1: for each page type a sample of records (by
   CRM id, never by URL: the Swedish paths are new) is fetched from both sites, the templates' own
   markup is compared after normalising what cannot match (whitespace, nonces, asset hashes, the
   host, image widths, timestamps), and the list wrapper's reload answers are compared for the same
   filters. The result is a diff per page, and the loop runs until every diff is empty or is a
   raised question. The samples cover every property type and status the test account offers, and
   question 54's cases as they arrive.

   Both sites must show the same records, so the reference site's CRM account is either the test
   account staging holds or a customer's account added to staging as a second tenant (its Vitec
   key pair and office ids on the tenant page). Whole-page equality needs the same theme on both; a
   comparison scoped to the templates' markup needs none and is the default (question 71).

5. **Acceptance.** AC 28 gets the parity check as its tests and AC 20 its search half; both are
   changes to `acceptance/`, reviewed through the change that makes them.

## What it needs from Patric

- **70** the v3 template files, and the confirmation that they are the approved items (Patric,
  2026-09-20: not now; the point stays open).
- **71** the reference site: its address, its CRM account, and whether the staging site gets its
  theme. The access an agent needs for the whole workflow is the table in
  [staging-site.md](staging-site.md); for the reference site it is its public address only.
- Already open: 54 (a) to (e) as the templates need them; 52 is untouched (golden masters come
  from the test account).

## Order of work

Now, needing no answer: the set package's skeleton (`core-client-templates-2026`), the selector,
the override rule, the updater's list and the release per set, and the query function in the sync
plugin. With 66: the inventory → the gaps raised in one batch → the port, file by file, on the
staging site. With 67: the parity check in the smoke job → AC 28 and AC 20's search half in
`acceptance/criteria.json`, the report regenerated.

Not in this step: the Lovable example site (item 10's other half, the same universal names, later),
a site's custom design, and which sites auto-update (WordPress's own per-site setting, which the
updater already switches on).
