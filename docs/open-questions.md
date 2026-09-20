# Open questions

The register of everything asked of Patric. A question gets the next number here before it is
asked in chat, chat refers to that number, and Patric answers by number, in any conversation.
Numbers are never reused: an answered question gets its line in `decisions.md` and leaves this
file. Each one is tagged with its part and names what is blocked and the smaller option, so
answering is quick. Next number: 70 (47 and 48 were used in chat on 2026-09-19 for 16 and 2, and the helper-methods
conversation of the same day counted 30 to 49 in chat; none of those are register numbers).

## 52. The pairs for the Vitec mapping: no longer needed for the mapping; what remains is Vitec's golden masters

`[crm-vitec]` Patric's plan of 2026-09-19 (a read endpoint on a client site running the old
plugin, plus its Vitec key pair, fetched as pairs and mapped by evidence) was overtaken the same
day by Gate 2: `docs/field-tables.md` names every universal field's Vitec source,
`adapters/vitec/mappers.ts` copies and renames by those tables, and `display` comes from the
approved ledger entries. The mapping needs no evidence from the old sites, and taking anything
from the old plugins is a hard rule against (AGENTS.md). What 52 still delivered is Vitec's golden
masters (Gate 3, AC 1) and the comparison against the old sites (AC 28). Close 52 and take
Vitec's golden masters from the test account's real records on staging instead: an agent keeps a
representative set as `golden/vitec/` cases (payload, universal, display) for Patric's approval,
the protected path's gate; the parity inventory stays a human-supplied list (strategy §10, AC 28)
checked against Core's data. Smaller: yes, close 52 and take them from the test account. Or keep
the pairs.

## 54. Vitec on the test account: five things only a person in Vitec can set up

`[crm-vitec]` Core copies what Vitec sends, so nothing in Core waits on these; the sites'
templates do. One estate per case, set by a person in the Vitec test account, read off staging by
an agent: (a) a new-build project's homes appear in the marketed list with their `projectId`
(assumed on 2026-09-19, so a project page can list them); (b) whether the price text stays when
the price is hidden; (c) whether the area name stays when the address is hidden; (d) what status
a "till salu, visa som kommande" estate carries; (e) how each of the four bid settings shows in
`bidding`. Smaller: (a) alone now, the rest when the first client template needs them.

## 57. `[core]` `[crm]` Queued records on the panel, and “Update from CRM” for a selection, need two additive adapter capabilities

The Items page shows what went through the write path and what the sites did with it, but not
what still waits on an adapter's own fetch list, and it can recompute a selection but not ask the
CRM for it again: the queue and the fetching are the adapter's (AGENTS.md), and the adapter API is
protected. Two additive fields would let any adapter hand both to the engine without the engine
knowing the CRM: `Adapter.admin.queue()` returning the waiting entries (connection, office,
datatype, id, queued at, reason, attempts, next attempt, last error), and one lifecycle event
`refetch` carrying a list of records, delivered like the others and answered by the adapter
putting them on its list. The panel then colours queued rows yellow in the live list, sorted with
the rest by time, and gets an “Update from CRM” button next to “Recompute selected”. The shapes
are drafted in docs/admin-panel.md. Smaller: yes to both as drafted; or the queue alone.

## 58. `[core]` The database cluster's admin password appeared in a session's transcript; rotate it?

On 2026-09-20 an agent asked the DigitalOcean API for the cluster's size, and the answer carried
the cluster's connection string, password included, into the session's tool output, which the
transcript keeps. The cluster accepts connections only from the two apps (question 33), so the
password alone opens nothing from outside. Smaller: rotate it anyway. An agent resets the database
user's password through the API and updates both apps so they take the new binding (each app
restarts for about a minute, production included, so it needs your "allow"). Or leave it, on the
strength of the trusted-sources rule. Either way, agents now read only the fields they need from
that endpoint.

## 59. `[core]` The admin panel rebuild: the function list and its MoSCoW ratings

Patric, 2026-09-20: the panel reads as a hobby project and misses core functions; list what
comparable products offer, rate every function with MoSCoW, and do not build before it is
discussed. `docs/admin-panel-rebuild.md` holds the use cases, the catalogue and the ratings: 32
Musts (among them saves in place with a toast, sortable and pageable searches, recompute and
fetch-again by record, selection, office, tenant, CRM, datatype or everything, with a preview and
progress), 14 Shoulds, 14 Coulds and 3 Won'ts. Smaller: yes, the ratings stand as drafted; or
name the rows that move.

## 60. `[core]` The admin panel rebuild: how it is built

`docs/admin-panel-rebuild.md` §4. Recommended: a React app on Core's admin API (Refine, headless,
with shadcn/ui and Tailwind, tables by TanStack, forms by react-hook-form, a command palette),
built into static files by the same build and served by Core's web process under `/admin`; long
operations as jobs run by the worker and watched live; every user journey a browser test in the
checks. It adds a build step and browser-side libraries, all MIT, and Playwright for the tests.
Smaller: keep today's server-rendered pages and add htmx for in-place updates and sorting, with a
lower ceiling. Yes to the recommendation, or the smaller one, or Ant Design instead of shadcn/ui
for speed.

## 61. `[core]` `[crm]` An adapter describes its panel as data (an adapter API change)

`docs/admin-panel-rebuild.md` §4. In the new app an adapter cannot ship pages of its own without
coupling the app to each CRM, so the adapter hands the engine data that describes its panel:
sections of key-values, tables with row actions, forms and actions; the app renders them with the
same components as everything else. The same shape carries the connection status on the tenant
page, a "check the login" probe, the "look at a record" dry run and the queue of question 57.
One additive field on `Adapter.admin`. Smaller: yes as described; or keep HTML fragments from the
adapter shown inside the app, which looks and behaves differently from the rest.

## 63. `[client-wordpress]` The caches to support and where each is proved; a WP Rocket licence

Re-asked 2026-09-20 after an agent had tied the answer to one host. The plugin invalidates every
cache the WordPress way, on every host and server; checked in the caches' own code
(`docs/staging-site.md`): LiteSpeed Cache, WP Rocket, W3 Total Cache, WP Super Cache, WP Fastest
Cache and Breeze all purge on what the plugin's writes and removals fire. Proof: on the staging
site, one cache plugin at a time, for every cache that runs on any server; LiteSpeed's page cache
needs a LiteSpeed server, so it is proved either in CI on OpenLiteSpeed in a container (free) or
on a LiteSpeed host of Kowboy's with a second test site. WP Rocket is a paid plugin, about $59 a
year for one site. Three picks: does the list stand; LiteSpeed in CI, or name a LiteSpeed host for
a second site; and a WP Rocket licence, yes or no. Smaller: the list stands, LiteSpeed in CI, no
licence yet.

## 64. `[client-wordpress]` A criterion for cache invalidation on the staging site

Re-asked 2026-09-20, free of any host. Proposed AC 43: with each supported cache in turn, a change
that reaches the site makes the next request for the record's page and its list pages fresh, a
removed record's page is gone from the cache, the plugin sets no browser cache directive of its
own on pages, and a browser's check on a record page answers changed (200) or unchanged (304)
correctly, so an installation that lets browsers keep pages revalidates within its own time. With
it, the live-site tests of AC 8, 18, 19, 21 and 22 are named in `acceptance/criteria.json` next to
the CI ones, so the report says what is proved where. `acceptance/` is protected. Smaller: fold the
cache proof under AC 20 without a new number. Yes to AC 43, or fold.

## 66. `[client-wordpress]` The v3 template files are the approved items; you supply them

AGENTS.md forbids taking anything from the plugins v1 to v3 unless you ask item by item. Step 2
needs exactly the template files (the templates folder of v3 and the list wrapper's script and
stylesheet), nothing else from the old plugin: every helper call and field in them is replaced on
port. Confirm that this ask covers those files and hand them over in chat (a zip or the files); an
agent keeps them as `docs/inputs/templates-v3/`, the input of record, and agents open no old
repository. Nothing in the port starts before the files are there (Patric, 2026-09-20: not now;
kept open). Smaller: v2's files, if v3's are harder to find (you said they are the same).

## 67. `[client-wordpress]` The reference site for parity: its address, its CRM account, its theme

The whole workflow Patric asked for on 2026-09-20 is the access table in `docs/staging-site.md`
and question 69; for the reference site nothing but its public address is needed, its pages are
read over HTTPS with no login. What remains: which site is it (its address)? Does it run on the
Vitec test account staging already holds (`M31529`), or on a customer's account, whose Vitec key
pair and office ids then go on staging as a second tenant (an agent adds it on the tenant page; a
customer's data on staging is your call)? And should the staging site run the same theme, so whole
pages can be compared, or is the comparison scoped to the templates' own markup (the default,
needs no theme)? Blocks the parity check, not the port.

## 68. `[core]` `[crm]` A prepared listing state, so no site has to know a CRM's statuses

The first part, hidden values, was approved on 2026-09-20 and is in `decisions.md`: a prepared
string is absent when the CRM says hide. This is the second part, explained in full at Patric's
request.

**The problem.** Vitec has 23 statuses for a listing (`docs/inputs/vitec/enumerations/Api_EstateStatus.md`):
Till salu, Såld, Såld/Referensobjekt, Kommande, Snart till salu, Försprång, Bokad, Vilande,
Återtagen, Ej till salu, Reserverad/Ej till salu, Uthyrd, Uthyrd preliminärt, Hyresledig,
Tillträdd, Pågående, Slutsålt, and more. A site shows three or four lists: till salu, kommande,
sålda (referenser), perhaps uthyres. Somebody has to decide which of the 23 goes in which list.
Today that decision is nowhere: a record carries Vitec's status exactly as sent, so every site's
developer, or the agent building the site, must learn the 23 values and decide, and every site
may decide differently. When Mspecs arrives with its own statuses, every site must learn those
too.

**The proposal.** Core makes that decision once, in a table Patric approves: each CRM status maps
to one of a handful of Core states, for example "for sale", "coming", "sold", "rented", "not for
sale". The table lives in the ledger (one entry, one row per CRM), the adapter applies it, and
every listing gets one small field next to the CRM's own status, which stays as it is:
`state: { id: "for_sale", name: "Till salu" }`, the same id-and-name shape every enumeration has.
A site or an agent then filters a list on `state.id` and prints `state.name`, and never needs to
know any CRM's statuses. Mspecs later gets its own row in the table and no site changes.

**What it changes.** The field tables and `schemas/` gain `state` on property and project, the
ledger gains the table, and the sentence in AGENTS.md that forbids a status decision in Core
becomes "only by ledger entries"; all protected, hence this question. Smaller: leave the grouping
to the sites, each with its own 23-row table. Yes to the state, or leave it to the sites?

## 69. `[client-wordpress]` The test site's first install, without SFTP

Patric asked on 2026-09-20 whether the WordPress API, SFTP and a git deployment cover everything,
or whether there is a gap. One: SFTP and SSH are unreachable from where agents run (port 22 is
blocked; verified the same day), so the first install of the plugin and the driver on the test
site needs one of two things. (a) The site's WordPress admin login, pasted once: the agent uploads
and activates the plugin over HTTPS, makes itself an application password for the REST API, and
from then on every change arrives through the plugin's own update channel with nothing more from
anyone; on Cloudways the site's API key yields that login. (b) The host's git deployment with a
build branch that holds only the plugin folders, which needs a deploy key added on GitHub by a
repository admin, and differs from host to host. Everything else, settings, cron, logs, is done
over HTTPS or through Core. Smaller: (a). The login, or the git route?
