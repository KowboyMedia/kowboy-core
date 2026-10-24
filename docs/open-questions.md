# Open questions

The register of everything asked of Patric. A question gets the next number here before it is
asked in chat, chat refers to that number, and Patric answers by number, in any conversation.
Numbers are never reused: an answered question gets its line in `decisions.md` and leaves this
file. Each one is tagged with its part and names what is blocked and the smaller option, so
answering is quick. Next number: 234 (214 was withdrawn on 2026-10-19: its four rules on designing are a `[handbook]` question, asked in chat and recorded only in the handbook's own register; 206 is the database question the thread "Database connection slots" asked in chat as 88 on 2026-10-18, a number closed on 2026-09-28; 192 was withdrawn on 2026-10-13 and replaced by 193; 191 was withdrawn on 2026-10-13 and replaced by 192; 185 was merged into 184 on 2026-10-06, so one answer covers both; 124 was asked in chat only on 2026-10-03 and answered the same day; 116 to 118 were used by the handbook sessions of 2026-09-29 to 2026-10-03, 116 in chat only; 75 to 77 were also used in chat on 2026-09-21 for the porting
plan's questions, which are 78 to 80 here; 62 to 69 were also used in chat on 2026-09-20 for the WordPress
plan's questions, which are 66 to 73 here; 47 and 48 were used in chat on 2026-09-19 for 16 and 2, and the helper-methods
conversation of the same day counted 30 to 49 in chat; none of those are register numbers).

## 233. `[core]` Which addresses does Core answer on once it runs on Cloudways Velocity?

- 2026-10-24 · Found while checking the move to Velocity (the thread "Verify Core runs on
  Velocity"). Core answers on core.kowboy.cloud and staging.core.kowboy.cloud, both still served by
  DigitalOcean. The Kowboy Chat project's plan for Velocity names core.kowboy.se and
  staging.core.kowboy.se instead. Every website's plugin settings and every Vitec notification
  address point at core.kowboy.cloud, and the admin panel's sign-in links use it too. Velocity
  serves a custom address through Cloudways' Cloudflare add-on, about $4.99 a month each after a
  30-day trial (the Chat project's figure, not checked here), so the cost is the same either way.
- Blocked: the switch of Core's addresses to Velocity.
- a) **Keep core.kowboy.cloud and staging.core.kowboy.cloud** (recommended, the smaller change):
  at the switch the two names are pointed at Velocity, and no website, Vitec setting or sign-in
  link changes.
- b) **Move to core.kowboy.se and staging.core.kowboy.se**: at the switch every website's Core
  address, every Vitec notification address and Core's own address setting change too, and the old
  names keep forwarding for a while.

## 225. `[client-wordpress]` Does a home that is not for sale, coming or sold get a page on the website?

- 2026-10-20 · Found while comparing norbanmakleri.se with the Norban demo (the thread "Norban:
  current site versus the new demo"). The plugin gives every home Core sends a public page and
  lists it in the sitemap, whatever its status. On the Norban demo that is 206 of its 631 home
  pages: 184 withdrawn (återtagen), 9 dormant (vilande), 7 assignments not yet on the market
  (uppdrag), 1 not for sale (ej till salu) and 5 whose status Vitec calls "Undefined". Vitec
  marks all of them as published. norbanmakleri.se answers "page not found" for the same homes.
  A seller who withdrew a sale may not want the home shown, and search engines will list these
  pages once the site is open to them.
- Blocked: nothing before the release; it decides what every website shows.
- a) **No** (recommended, the smaller change and what the live site does): a home whose status is
  not in the site's for sale, coming or sold settings answers "page not found" and stays out of
  the sitemap; the site keeps its copy, so a change of status brings the page back.
- b) **Yes**, as now: every home Core sends has a page.

## 208. `[core]` Default: the project is done when the first brokerage runs on live, and what the plan marks Later waits for a new project

- 2026-10-18 · Patric: "work towards closing this project and getting it production ready". The
  plan (`/mnt/project-files/release/final-release-plan.md`) takes the strategy's last gate (§9,
  Gate 4: the first production tenant) as the end: the early release (207), the final release,
  then the first brokerage on live with its forms, lists, Vitec's notifications and the update
  channel. Its table lists every open piece of work with its thread, what it waits on, and when it
  comes. Later: searching by a sentence and the other AI ideas (explored only), Mspecs (waits on an
  agreement with Mspecs), other clients' sites and a tool that moves them (items 16 and 19,
  question 80), and the written guidance for people who build sites on Core (item 13). Making the
  old admin smaller (item 27) is closed, replaced by the new admin (item 30). Which brokerage goes
  first is asked when the final release is near. Once this stands, `next-steps.md` follows the
  table.
- Blocked: nothing; silence agrees.
- Reply only if you disagree: no, and which row.

## 190. `[core]` One more one-off read-only step on staging: the property's change log under every connection, removed ones included

- 2026-10-12 · The step of question 189 found no copy of the property `OBJ5P4RD332KW42S276BD`
  (Bondegatan 18) in staging Core, current or removed (read at 19:09 UTC; the change log reaches
  back to 2026-09-17). It searched the change log only under the connections that hold the
  property, and none does, so in practice the log is still unsearched. Removing a connection or a
  tenant deletes its records outright (`items` goes with its connection or tenant), while their
  change log entries stay for their 30 days (`events` has no such link, and `deleteConnection` in
  `engine/storage/connections.ts` deletes only lifecycle events), so a connection removed since
  2026-09-17 may still have this property's image lists in the log. The same step can run once
  more: a read-only script started with staging's worker prints this property's change log entries
  under every connection, removed ones included, and what staging's Vitec code knows of the
  property and its office `M12462` today (its fetch list and office list); the session reads the
  log, then the step is taken out. Adding and removing it restarts staging once each; nothing is
  written. A list found there shows which images Vitec's website feed held on each date: Vitec
  lists only the images marked for the website (its migration guide maps the old
  `AdvertiseOn.ImageIds` onto `Images`; read in the guide, not tested). The live site, drawn by the
  old plugin v3, cannot show what went either: it still showed the same 30 images at 19:14 UTC as
  at 17:40.
- a: yes, the one more read. b: no; stop here, Core has no record of this property.
  Recommended: a, the last place in Core that could hold the old image lists.

## 135. `[client-wordpress]` Default: the search tests are listed under acceptance criterion 20, the search suite

- 2026-10-04 · The acceptance list `acceptance/criteria.json` is a protected path, changed on
  Patric's word. Criterion 20, "Real clients pass the sync and search suites", already names the
  WordPress client's three list tests as its search half. The two tests of `docs/search.md`
  built on 2026-10-04 (the search by code, area and name; the links by outline) prove the same
  half and belong under the same number; the acceptance report is regenerated with them. The
  smaller option is to leave the list as it is, and the tests then run without a criterion
  naming them.
- Reply only if you disagree: no.

## 136. `[crm-mspecs]` The footer's lead form on an Mspecs site: Mspecs's lead call needs at least one matching

- 2026-10-04 · Mspecs's marketing provider API (`docs/inputs/mspecs/`) adds a lead only together
  with matching criteria (rooms, price, area, municipalities), which becomes a contact with a
  search profile; it has no plain "contact me" or valuation lead, while Vitec has. The footer's
  "Ska du sälja din bostad?" names no home and no criteria. Blocked: nothing today; no Mspecs
  site exists. Options: a) send the lead call with one matching taken from the brokerage's
  settings, such as its municipality, so the contact lands in Mspecs; b) hide the footer form on
  Mspecs sites until Mspecs offers a plain lead; c) send the footer's lead by e-mail to the
  office, outside the CRM.
- Smaller: b, until an Mspecs brokerage asks; a invents a matching in Core, which is a rule to
  write down first. Answer a, b or c.

## 123. `[crm-vitec]` A whole-day viewing: what the CRM sends, so the page shows no time

- 2026-10-03 · Patric's list says a viewing has an "entire day" flag that hides the time. Vitec's
  viewing carries `id`, `startsAt`, `endsAt`, `comment`, `isDigital`, `isSelfRegistrationEnabled`
  and `isProjectViewing` (field tables, `viewings[]`); no such flag. The page now treats a viewing
  from midnight to midnight, or starting at midnight without an end, as a whole day and shows the
  date alone. Blocked: nothing; a whole-day viewing with other times would show those times.
- Smaller option: keep the midnight rule (a). Else: name the field (b), and the adapter maps it.

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

## 54. Vitec on the test account: six things only a person in Vitec can set up

`[crm-vitec]` Core copies what Vitec sends, so nothing in Core waits on these; the sites'
templates do. One estate per case, set by a person in the Vitec test account, read off staging by
an agent: (a) a new-build project's homes appear in the marketed list with their `projectId`
(assumed on 2026-09-19, so a project page can list them); (b) whether the price text stays when
the price is hidden; (c) whether the area name stays when the address is hidden; (d) what status
a "till salu, visa som kommande" estate carries; (e) how each of the four bid settings shows in
`bidding`; (f) added 2026-10-04: **a demo or test customer the partner may write to**, with the
CRM function group (version 1, category CRM-Contact) granted on it, so the forms and the search
profile (`docs/forms.md`, 139) can be sent for real. The login in the environment reads a
client's production office (Patric, 2026-10-04), so no write ever goes there; it answers 200 for
the advertising group and 401 for the CRM group today. Smaller: (a) alone now, the rest when the
first client template needs them, (f) before the Vitec forms item.

## 80. `[client-wordpress]` Name the first client to port, once the default set is done

Norban is not a client port: norbanmakleri.se runs the default templates of plugin v2 and v3
unchanged, so it is the reference the default set "Kowboy 2026" is ported from (Patric,
2026-09-23), and its office is the test account staging already holds. Client ports start after
the set is done (next-steps item 17), through the automated workflow of
`docs/template-porting.md`. When the set is done, name the first client by the name Cloudways
lists its site, and give its CRM login if staging does not hold that account yet.

## 97. `[crm-vitec]` An agent's picture at width 1920 weighs 6 MB; the old site shows it at 1024

The field tables (approved 2026-09-19) build every image address on Kowboy's CDN at width 1920,
agents' pictures included. On the test account an agent's picture at that width is a 6 MB PNG
(the CDN scales the office's upload, a square PNG), while the same picture at width 1024, the
width norbanmakleri.se uses for agents, is 0.6 MB. On the set's pages the agent pictures are the
last to load, and a phone pays for 6 MB per agent shown. Smaller: the adapter builds an agent's
picture at width 1024 (a field-table change for `image` on an agent, approval needed), the
listings' photos stay at 1920. Or keep 1920 everywhere. Answer "1024" or "keep".

## 105. `[client-wordpress]` The two forms in the design: where a submission goes

"Ska du sälja din bostad?" (every page) and "Är du intresserad av bostaden?" (the single page)
post a name, a phone, an e-mail and a consent. Question 95 already asks whether the interest
form posts to the CRM. For 2026.2 the form block needs a destination now: an e-mail to an
address in the theme options (WordPress's own mail, no plugin; the interest form adds the
listing's address and agent), or the CRM per 95 when it is answered. Answer "email" or "crm".
The smaller option is e-mail, and 95 can move it to the CRM later.

**Patric, 2026-09-28:** "leave for now, they will send to CRM but we need to figure it out first
without blocking this." Open. An agent first stored submissions on the site and mailed them,
which Patric called a drift and had removed the same evening: the form is a dummy that posts
nowhere and whose button does nothing, until this is answered.

## 122. `[crm-vitec]` The area texts ("Område": läge, kommunikation, service, parkering) are empty for every record on the staging site

Every property and every area on the staging site (Vitec test office M31529) carries `surroundings`
with all five texts null, so the "Område" section of the property page and the texts of the area
pages never show (seen 2026-10-03 on Vildgåsvägen 19B and the area Dalhem through `?debugpl`).
The master site shows them. Either the advertising payload does not carry them (then the
adapter needs another Vitec call, like the documents of question 94) or the mapping reads the
wrong field. Default: the adapter session checks Vitec's payload for the area texts and maps
them; until then the section stays hidden, as it does now. Smaller: leave them out.

## 121. `[client-wordpress]` The staging site's WordPress login, so a session can put a change on it

The staging WordPress site (the app "v4-staging" on Cloudways) changes only when a session runs
`scripts/deploy-site.mjs` against it with the site's admin login, or when a `v*` tag publishes a
release to the update channel. A push to the `staging` branch alone changes nothing on the site
(2026-10-03: the punch list was in staging for half an hour and the site showed none of it). The
login lives in Cloudways, not in the agents' environment. Default: the login goes into the
project's cloud environment as `SITE_URL`, `WP_USER` and `WP_PASSWORD`, and a session puts every
change on the site right after saving it to staging. Smaller: Patric runs the script himself, or
asks for a release tag each time.

## 120. `[core]` The Cloudways token: the pair answers "incorrect credentials"

After the token move of 2026-10-03 (question 87, closed), `POST /api/v1/oauth/access_token` with
`CLOUDWAYS_EMAIL` and `CLOUDWAYS_API_KEY` answers 403 "The user credentials were incorrect", which
is not the earlier "insufficient_scope" (a valid but limited token) but a refusal of the pair
itself: the key is not the one Cloudways shows for that email, or the email in the environment is
not the account's. Nothing waits on it today: the staging site is installed through its WordPress
admin by `scripts/deploy-site.mjs`, not through Cloudways' API. In the Cloudways console, under
the account's API settings, copy the API key as it stands (or regenerate it), save it as
`CLOUDWAYS_API_KEY` in the session environment, check that `CLOUDWAYS_EMAIL` is the account's
sign-in email, then say "saved".

## 112. `[agents]` Default: after this collision, the register's numbers come from GitHub issues

Two sessions took the same numbers again: this session registered 87 to 97 on 2026-09-24 and
2026-09-28 (the tokens, the template package, the display fields, the fact tables, the
enumerations, the documents, the forms, the energy value, the agent picture) while the agent-setup
session registered 87 to 92 on 2026-09-27 (the DigitalOcean token, the shared rules, the reply
protocol, the hooks, the cooperation rules, the units of work). Both meanings stand, as the rule
says, and the register check reports 90 and 92 as used twice (87 and 89 to 91 of the other session
are answered and in the decisions). The agent-setup item in `docs/next-steps.md` planned the way
out for exactly this case: each question becomes a GitHub issue and takes the issue's number, and
the register file stays the readable view. Default: the next session makes that move (the open
questions become issues with their texts, the file lists them by issue number, `check-register`
reads the issues' numbers). Smaller: keep counting in the file and accept collisions. Answer
"no" to keep the file.
