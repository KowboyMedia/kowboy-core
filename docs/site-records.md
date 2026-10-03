# Offices and agents typed on the site

**Status:** proposal, 2026-10-03, waiting on questions 125 and 126 in `docs/open-questions.md`.
Nothing is built until Patric picks a direction. **The ask** (Patric, 2026-10-03): add offices
and agents inside the WordPress admin that are not fetched from the CRM.

## Terms

- **The CRM** is the brokerage's customer system that holds its listings, offices and agents;
  Vitec today, Mspecs later.
- **Core** reads the CRM and keeps one copy of every record in one shape for every site.
- **A site** is one WordPress install with Core's plugin. It **pulls**: it asks Core for what
  changed since its last pull and writes those records into its own database. Templates read
  that local copy and never Core.
- **A record** is one office, agent, property, area, association or project as a site stores it.
- **A CRM record** came through Core from the CRM. **A typed record** is one a person wrote in
  an admin form and that no CRM carries. "Manual" in chat means typed.

## What stands today

- A site stores every record as one WordPress post of the record's type (`core_office`,
  `core_agent`, …) with the record as JSON in one meta key, and one row in the plugin's index
  table keyed by type, connection and id (`clients/wordpress/core-client/includes/store.php`).
  The index copies a few search columns from the record on every write, among them an agent's
  place in the staff list (`sort_order`, the smallest order number over the agent's offices) and
  whether any staff-list switch hides the agent (`listed`). Lists read those columns and nothing
  else (`includes/query.php`): agents sort by order number, then name; a hidden agent is in no
  list but on every page that names them, such as a home's card (Patric, 2026-10-03).
- A pull writes only the records Core names, by connection and id. A rebuild (a pull from the
  start, after a `forcerefresh` bell or a stale cursor) rewrites everything and then deletes
  every index row the rebuild did not touch.
- Since 2026-10-03 (the punch-list thread) the plugin admin has a Kowboy Estates menu holding
  every record type and the settings, a Publishing section that turns each type on or off for
  the site, and record lists whose rows open the page and the data and nothing that writes: the
  post types refuse create, edit and delete for everyone (`core_client_register_post_types`).
  Whatever is chosen here lands inside that menu.
- Core never decides anything from a value (AGENTS.md): it carries the CRM's order numbers and
  staff-list switches untouched, and the site applies them. The sites own tags, slugs and
  visibility rules already. Core's adapter API lets any source feed records in, and Core's admin
  panel draws an adapter's own forms and buttons from data (`engine/adapter-api/types.ts`).

## Option A: the site keeps its own records (recommended)

**Where they live.** In the same two post types the plugin already uses for offices and agents,
with the record as the same JSON and one index row each. A typed record's connection is the site
itself (`site`) and its id is one the site makes from the post's number, so it can never collide
with a CRM id. The raw CRM payload meta is empty for it. Everything that reads records (lists,
cards, single pages, `?debugpl`, the viewers in the admin) sees both kinds through one code
path, because nothing downstream reads the connection.

**The admin.** In the Kowboy Estates menu, the agent and office lists show both kinds with a
"Source" column: "CRM" or "This site". A CRM record opens read-only, as it does today. A typed
record opens with a form, and can be deleted. The post types refuse every write today; the
plugin lifts that for the site's own posts of the agent and office types only (WordPress's
`map_meta_cap` filter, keyed on the index row's connection), so "Add new" exists for agents and
offices and properties, areas, associations and projects stay the CRM's. WordPress's own draft
status serves as "not shown yet", which CRM records never need.

**The form.** The fields the Kowboy 2026 pages show, under the universal names, so the templates
need no second path. Agent: name, title, e-mail, mobile phone, portrait (from the media
library), description, the offices the agent belongs to (any office the site holds, CRM or
typed) with per office an order number and a "show in the staff list" switch, the record-level
"show in the staff list" switch, and reviews (text and author). Office: name, street, postal
code, city, phone, e-mail, description, and the map position. A phone is stored as typed, the
display text as written and the number without spaces.

**Display strings.** Core computes `display` for CRM records from the rules ledger (for an
office, the address line of R-012). A typed record has no `display`. The office page falls back
to the street, postal code and city joined the same way, three lines in the template; the site
renders its own typed fields, which is template work, not data logic. The alternative is one
more form field, "address as shown", which a person would type twice.

**The portrait.** The media library hosts it. The theme's image helper builds responsive sizes
only for Core's CDN addresses, so a library portrait shows at one size until the helper also asks
WordPress for the attachment's sizes (a few lines, later).

**How typed and CRM records meet.** They do not merge: a record is the CRM's or the site's,
never both, and lists simply hold both. The site never matches a typed agent to a CRM agent on
its own. When the CRM later carries the same person, two records show until a person deletes
the typed one (question 126 names a cheap automatic variant: when a CRM agent arrives with the
same e-mail, the site hides the typed one and its old address answers 301 to the CRM agent's
page).

**Who edits what.** The site owns typed records in full and a pull never touches them. CRM
records stay read-only on the site; a site that wants to change a CRM agent's text or portrait
needs a separate feature, per-field overrides on CRM records, which this proposal does not
include because a pull would otherwise overwrite the edit.

**What a pull does to typed records.** Nothing, in the delta case: Core never names a site id,
and a removal from Core names a CRM id. The rebuild's final sweep must skip the site's own rows,
one condition in `core_client_rebuild`; without it a rebuild would delete every typed record.
The plugin's own reindex after an update rewrites the search columns of typed rows exactly as it
does CRM rows, since the JSON has the same shape. Deleting a typed record in the admin removes
its index row for good, where a CRM post deleted behind the plugin's back comes back on the next
pull.

**Order and the staff list.** The form carries the same two things the CRM carries, so the one
rule in the index applies to both kinds without a branch: the smallest order number over the
agent's offices sorts them among the CRM agents, a typed agent without a number sorts after the
numbered ones by name, and either staff-list switch off keeps the agent out of every list. Note
that no property names a typed agent, since properties come from the CRM, so a hidden typed
agent is reachable only by their own address.

**Relations.** A typed agent can belong to a CRM office or a typed office, so an office's page
lists them among its staff. A typed office holds typed agents only, because a CRM agent's office
list is the CRM's. Properties never point at typed agents or offices.

**Addresses.** Typed records live under the same paths (`maklare/`, `kontor/`), end in their own
id like every record, and the 301 rule by id applies as it does today.

**What it does not give.** Each site types its own; two sites of one brokerage type an agent
twice, and a Lovable site gets nothing until its kit grows the same feature. Core's panel,
records search and timeline never see typed records, so Core is no longer the whole picture of
what a site shows.

**Work.** Plugin only: the form and the list column in the admin, the id and connection for typed
rows, the sweep condition, the delete hook, the office page's fallback, and tests for a typed
agent in a list, in an office's staff and through a rebuild. No contract, schema, adapter API or
Core change, so no protected path and no approval beyond Patric's pick.

## Option B: Core carries them as a source of its own

**Shape.** A new adapter in Core, provider `manual`, whose "CRM" is a table in Core of
hand-typed records. The adapter API already allows this with no engine change: an adapter owns
its tables, feeds records through `ingest`, and describes forms, tables and buttons for Core's
admin panel as data. The engine then does for a typed record what it does for a CRM one: the
rules ledger fills `display`, the record gets a sequence number, every site of the tenant pulls
it, and it shows on the site read-only like any CRM record.

**Where the typing happens.** Two ways. **B1:** in Core's admin panel, by Kowboy's staff, on the
tenant's page under the manual connection. This does not meet the ask, which names the
WordPress admin. **B2:** in the WordPress admin, with the plugin sending the form to Core
through a new write endpoint, and Core sending the record back to every site through the normal
pull. B2 is a new contract (a site writing records with the tenant's token), a new engine
endpoint, and a plugin form, so it touches protected paths and needs approval; an edit shows on
the site only after the round trip, and one site's edit changes every site of the tenant.

**How typed and CRM records meet.** As in A: different connections, different ids, never merged.
Core may not even suggest a duplicate, since Core draws no decision from a value; only a person
removes the typed one in the panel.

**Who edits what.** Kowboy's staff in the panel (B1), or the site through the write path (B2).
CRM records stay read-only everywhere.

**What a pull does.** Typed records flow like CRM ones: hash, sequence, bell, pull, rebuild. The
plugin needs no special case at all.

**Order and the staff list.** The typed record carries the same universal fields, so the site's
rule applies unchanged.

**Gaps.** The panel's forms are flat fields made for logins and action parameters, so an agent's
office list with per-office order and switch needs several fields or a JSON box. Core hosts no
images: the CDN serves the CRM's pictures from the CRM's ids, so a typed agent's portrait needs a
typed URL or an upload path that does not exist. The panel refuses a connection that names no
office (Patric, 2026-09-21), a rule written for CRMs that a manual source must get around.

**What it gives.** Every site and every client type of a tenant gets the records; Core's panel,
search and timeline see them; `display` comes from the ledger like everything else.

**Work.** B1: the adapter with its table, forms and actions, plus the three gaps above. B2: B1
plus the write contract, the endpoint, its tests and the plugin form.

## Comparison

| Criterion                                      | A: on the site                    | B1: in Core's panel       | B2: in WP admin, stored in Core     |
| ---------------------------------------------- | --------------------------------- | ------------------------- | ----------------------------------- |
| Typed where Patric asked (the WordPress admin) | yes                               | no                        | yes                                 |
| Size of the change                             | small, plugin only                | medium, adapter and panel | large, adapter, contract and plugin |
| Protected paths, approval                      | none                              | none                      | contract and endpoint, yes          |
| Portrait                                       | media library, done               | no host, to build         | no host, to build                   |
| Shows on every site of the tenant              | no, typed per site                | yes                       | yes                                 |
| Lovable sites                                  | no, until their kit grows it      | yes                       | yes                                 |
| Seen in Core's panel and timeline              | no                                | yes                       | yes                                 |
| `display` strings                              | template fallback for the address | from the ledger           | from the ledger                     |
| Edit visible on the site                       | at once                           | after the next pull       | after the round trip                |
| Special case in the pull                       | one: the rebuild sweep            | none                      | none                                |

## Recommendation

**A.** It is what was asked, it is the smallest change, it touches no protected path, the
brokerage's own WordPress users edit in the tool they know, the media library solves the
portrait, and the site already owns the rules these records need (order, the staff list, slugs).
Its one real cost is that typed records are per site and invisible to Core. That cost is paid
only when a second site or a Lovable site of the same brokerage needs the same people, and A
does not stand in the way of B then: a typed record sits in its own connection row, so a later
manual source in Core can take over without touching the CRM rows.

## Questions

- **125** `[client-wordpress]` Where do typed offices and agents live: on the site (a, smaller,
  recommended) or in Core (b)?
- **126** `[client-wordpress]` When the CRM later carries a typed agent: nothing automatic, a
  person deletes the typed one (a, smaller), or the site hides the typed agent when a CRM agent
  with the same e-mail arrives and redirects the old address (b)?
