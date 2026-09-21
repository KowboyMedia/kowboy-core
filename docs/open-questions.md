# Open questions

The register of everything asked of Patric. A question gets the next number here before it is
asked in chat, chat refers to that number, and Patric answers by number, in any conversation.
Numbers are never reused: an answered question gets its line in `decisions.md` and leaves this
file. Each one is tagged with its part and names what is blocked and the smaller option, so
answering is quick. Next number: 77 (62 to 69 were also used in chat on 2026-09-20 for the WordPress
plan's questions, which are 66 to 73 here; 47 and 48 were used in chat on 2026-09-19 for 16 and 2, and the helper-methods
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

## 58. `[core]` The database cluster's admin password appeared in a session's transcript; rotate it?

On 2026-09-20 an agent asked the DigitalOcean API for the cluster's size, and the answer carried
the cluster's connection string, password included, into the session's tool output, which the
transcript keeps. The cluster accepts connections only from the two apps (question 33), so the
password alone opens nothing from outside. Smaller: rotate it anyway. An agent resets the database
user's password through the API and updates both apps so they take the new binding (each app
restarts for about a minute, production included, so it needs your "allow"). Or leave it, on the
strength of the trusted-sources rule. Either way, agents now read only the fields they need from
that endpoint.

## 62. `[core]` The public health check: names in the details, or counts only?

`GET /v1/health` exists, needs no login, answers 200 when every check passes and 500 when any
fails, and names each check with a detail. Some details name customers: the `subscribers` check
lists the sites that stopped pulling by name, the Vitec checks name connections and office ids.
Strategy §8.1 says counts only. Smaller: the public answer says counts and plain words ("2 of 8
sites have not pulled within the hour", "1 connection is paused after repeated failures") and the
panel keeps the names; or leave the names in, since only whoever knows the address sees them.

## 63. `[crm-vitec]` Store every notification Vitec sends?

Today the arrival of a notification is one `webhook.received` event with the outcome, the office,
the datatype, the record id and the kind (Update or Remove), kept 30 days like every event; the
body as Vitec sent it is not stored. Smaller: put the body into that event (a few lines, gone
after 30 days); or an adapter table of its own that keeps every notification for good and lets a
person replay one from the panel (the Could "replay a notification").

## 64. `[core]` The framework for the new admin panel

For the panel rebuilt from the requirement sheets: Refine (MIT, headless: resources, list and
detail pages, live updates, notifications, access control) with shadcn/ui components,
recommended; Ant Design Pro (a complete, conventional look, less work on components); or
React-admin (the most used, MIT core, its live updates and audit log in a paid edition). Pick
one.

## 65. `[core]` Cut what nothing uses: the old operator endpoints and the setup scripts

Nothing outside the repository uses `POST /v1/admin/bell`, `event`, `replay` and `recompute`
with the admin secret, nor `scripts/tenant.ts` (tenants, connections and sites from the command
line, replaced by the panel), nor `scripts/vitec-probe.ts` (a one-off probe of Vitec Connect from
2026-09-17, settled). Smaller: cut them and point their tests at the panel's API; or keep them.

## 76. `[client-wordpress]` Add a Cloudways API key to the agents' environment settings, as `CLOUDWAYS_EMAIL` and `CLOUDWAYS_API_KEY`

Patric chose Cloudways for the porting server on 2026-09-21 (question 75). Everything on it, the
server, the pairs of sites per client, the copies of client sites, their admin logins, cron and
password protection, is done through the Cloudways API, and that API needs the account's email
and an API key, made in the Cloudways platform under the account's API page. The key belongs in
the environment agents run in, next to the DigitalOcean token and the Vitec test login that are
already there, not in chat: a secret pasted in chat stays in the conversation's record (the
lesson of question 58). Once the two variables exist, an agent creates the server and the first
pair of environments with nothing further from anyone.
