# Open questions

The register of everything asked of Patric. A question gets the next number here before it is
asked in chat, chat refers to that number, and Patric answers by number, in any conversation.
Numbers are never reused: an answered question gets its line in `decisions.md` and leaves this
file. Each one is tagged with its part and names what is blocked and the smaller option, so
answering is quick. Next number: 62 (47 and 48 were used in chat on 2026-09-19 for 16 and 2, and the helper-methods
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
