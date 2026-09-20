# The default templates: one package, three ways to use it, parity with the reference site

Step 2 of two, proposed 2026-09-20 for Patric's decisions (questions 65 to 67). It needs step 1's
site ([staging-site.md](staging-site.md)) for the parity check and runs in the same loop.
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

## Where they live

Patric named three ways a site uses the templates:

| Site                            | Installed                                                           | What updates                                                                |
| ------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Custom design                   | the sync plugin only; the theme renders from the plugin's functions | the plugin                                                                  |
| The defaults, edited            | the sync plugin and the templates; edited copies in the theme       | every template the theme did not copy; a copy in the theme is never touched |
| The defaults, maintained (WaaS) | both, auto-updated, no copies in the theme                          | everything, on Kowboy's release                                             |

Three places the templates could live, rated against those ways and the rules:

| Question             | A. Inside the sync plugin                                                  | B. A second plugin, `core-templates` (working name)                                                         | C. A theme                       |
| -------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Custom-design sites  | carry dormant template code                                                | install nothing they do not use                                                                             | would have to run Kowboy's theme |
| Edited defaults      | a copy in the theme wins and is never overwritten (the WooCommerce rule)   | the same rule, the same safety                                                                              | a child theme; heavier           |
| WaaS sites           | template changes ride the plugin's releases                                | the package releases on its own cadence                                                                     | theme updates                    |
| A template bug       | ships in the same release as the sync loop and can take a site's sync down | can never touch syncing; the sync plugin stays thin and rarely released (the safe-update principle, SRS §8) | the same as B                    |
| Releases and updates | one zip, one JSON                                                          | two zips, two JSONs, one updater with two lines; the package names the plugin version it needs              | a theme updater as well          |
| Code                 | the least                                                                  | about fifty lines more: a header, the packaging, the updater line, the version check                        | the most                         |
| Patric's effort      | none                                                                       | none: agents package and release both                                                                       | a theme decision per site        |

**Recommended: B, a separate package.** Fifty lines buy exactly the three ways of use and keep the
thin client thin: templates change often, the sync loop should not, and a template release can
never break syncing. The Concept's "a client is templates plus a sync loop" holds; on a site they
are two files instead of one. Question 65.

**The split inside the client.** The sync plugin (`core-client`) keeps the local copy and every
question a template can ask of it: `core_client_item()`, `core_client_item_raw()`, one query
function for lists (filters, sort, paging, and the `project_id` rule of question 55), the
permalinks and routing, the sitemap. Custom-design themes call the same functions. This is the
search half of AC 20, proved without a browser in the scenario suite: the same answers as the
Lovable kit on the same dataset. The templates package holds only how it looks: the cards, the
single pages, the list wrappers with their form, script and stylesheet, and the endpoint that
renders cards for the wrapper's reloads. It shows what `display` gives and formats nothing (the
ledger does, AGENTS.md); what to show for a status, a hidden price, a past viewing or a "till salu"
list is the site's own decision, taken in the templates from `status.id` and the rest, as the
reference site takes it.

**The override rule.** A template is looked up in the theme first (`<theme>/core/<file>`), then in
the package. Editing means copying the file into the theme; the package's own folder is never
edited on a site, and an update never touches the theme. So a site that changed the card alone
keeps getting every other template's updates.

**Releases.** The package has its own version and its own release JSON on the Space
(`core-templates.json`); the must-use updater gets a second line; a `v*` tag packages both
(`.github/workflows/release.yml`). One approval promotes everything (strategy §4).

## How the port happens

**The rule first.** AGENTS.md forbids taking anything from the WordPress plugins v1 to v3 unless
Patric asks for it item by item. This step is that ask, and it covers the **template files only**:
the templates folder of v3 and the list wrapper's script and stylesheet, handed over by Patric and
kept as `docs/inputs/templates-v3/`, the input of record. Agents open no old repository. Nothing
else of the old plugin comes along: every helper call, every field name and every condition in
those files is replaced on port by the plugin's functions, the universal names and `display`
(question 66).

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
   - **The site's own logic.** What a status shows as, a hidden price, past viewings, the lines
     between "till salu", "kommande" and "referenser", tags: decided in the templates from the
     values, as AGENTS.md puts it on the site, and noted in the inventory as the site's rules.
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
   comparison scoped to the templates' markup needs none and is the default (question 67).

5. **Acceptance.** AC 28 gets the parity check as its tests and AC 20 its search half; both are
   changes to `acceptance/`, reviewed through the change that makes them.

## What it needs from Patric

- **65** the separate package, and its name, or templates inside the plugin.
- **66** the v3 template files, and the confirmation that they are the approved items.
- **67** the reference site: its address, its CRM account, and whether the staging site gets its
  theme.
- Already open: 54 (a) to (e) as the templates need them; 52 is untouched (golden masters come
  from the test account).

## Order of work

After 65 to 67: the inventory → the gaps raised in one batch → the package skeleton, the override
rule, the updater line and the release → the port, file by file, on the staging site → the parity
check in the smoke job → AC 28 and AC 20's search half in `acceptance/criteria.json`, the report
regenerated.

Not in this step: the Lovable example site (item 10's other half, the same universal names, later),
a site's custom design, and which sites auto-update (WordPress's own per-site setting, which the
updater already switches on).
