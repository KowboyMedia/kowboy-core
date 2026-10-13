# Open questions

The register of everything asked of Patric. A question gets the next number here before it is
asked in chat, chat refers to that number, and Patric answers by number, in any conversation.
Numbers are never reused: an answered question gets its line in `decisions.md` and leaves this
file. Each one is tagged with its part and names what is blocked and the smaller option, so
answering is quick. Next number: 193 (191 was withdrawn on 2026-10-13 and replaced by 192; 185 was merged into 184 on 2026-10-06, so one answer covers both; 124 was asked in chat only on 2026-10-03 and answered the same day; 116 to 118 were used by the handbook sessions of 2026-09-29 to 2026-10-03, 116 in chat only; 75 to 77 were also used in chat on 2026-09-21 for the porting
plan's questions, which are 78 to 80 here; 62 to 69 were also used in chat on 2026-09-20 for the WordPress
plan's questions, which are 66 to 73 here; 47 and 48 were used in chat on 2026-09-19 for 16 and 2, and the helper-methods
conversation of the same day counted 30 to 49 in chat; none of those are register numbers).

## 192. `[admin]` The new admin area as drawn: every row a person sees in it

- 2026-10-13 · Patric rejected question 191's table ("You are still seeding from the old admin
  panel") and set the basis: "You know what the purpose of this service consist of, and you can
  understand what needs to be configured by the admin, and you can figure out how to do that
  optimally from UX/UI point of view. MVP Greenfield". The design draws only what an admin sets
  up for Core to run (tenants, their CRM connections, their sites) and what that needs (signing
  in, seeing what is broken, putting it right). The rows below are everything a person sees in
  it, so an approval covers these rows and nothing more (AGENTS.md, "Stop and ask"). A site has
  an address, a bell path and a bell secret, as Patric listed on 2026-10-06.
- 2026-10-13, later · Patric found the tenant page still built like the old one ("still based
  off of the shit version"): a long form of fields, secrets and red buttons with one Save. It is
  redrawn from the admin's three jobs (set up a customer, see that it works, fix it when it
  breaks): the page shows the records' way as text, and every change is made in a window. The
  drawing is nine images in `/mnt/project-files/admin-new/` (Patric asked for image files, not
  the canvas), and rows 3 and 7 to 19 are rewritten to match it.

| Row | What a person sees                                                                                                                                                                                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Sign in: an address field and "Mail me a sign-in link"; the link works once, within 15 minutes.                                                                                                                                                                         |
| 2   | Every page: a top bar with "Kowboy Core", the signed-in address and Sign out; no menu; a tenant's page has "Tenants / its name" above its title.                                                                                                                        |
| 3   | Tenants, the first page: one line saying how many tenants have a problem, and "New tenant", a window for the name that opens the new tenant's page.                                                                                                                     |
| 4   | The tenants list: Tenant · State · CRM connection · Sites; tenants with a problem first, then A to Z.                                                                                                                                                                   |
| 5   | A tenant's state: Works (green); Problem (red), with the problem's sentence; Not set up (grey), with what is missing.                                                                                                                                                   |
| 6   | A red banner on every page only while Core itself has a problem, such as its worker stopping: what it means for the sites and where to look.                                                                                                                            |
| 7   | A tenant's page shows the records' way: the CRM connection on the left ("From Vitec “Main”"), an arrow, the sites on the right ("To 2 sites"); under the title, the tenant's state and one sentence saying whether every change reaches the sites; "Rename" beside it.  |
| 8   | The connection's card: its state, when its last change was fetched, and what is set, as text: customer or group id, username, Vitec environment (Live or QA), and whether the sites' forms are sent to Vitec.                                                           |
| 9   | In that card, the offices Core reads: the CRM's id with the name under it, Reads (green) or Refused (red, with what happens and what to do).                                                                                                                            |
| 10  | In that card, "Change": a window with the login (username, password, customer or group id, "Use Vitec's QA environment", the connection's name), the switch "Send the sites' forms to Vitec", the address for Vitec's notifications with Copy, and "Remove connection". |
| 11  | In that card, "Fetch everything again": Core reads every record from the CRM again and sends what changed to the sites.                                                                                                                                                 |
| 12  | The sites' card: each site's address, opening its window, and its state with its last fetch: Works (green), Problem (red, with what it means and what to do), Waiting (grey) before its first fetch.                                                                    |
| 13  | "Add a site": a window for the site's address and bell path (the WordPress path filled in); Core makes the bell secret and opens the site's window.                                                                                                                     |
| 14  | A site's window: its address and bell path to change; the three values for the site's Kowboy Core settings, each with Copy (Core URL, Tenant token, Bell secret); "Make a new token" (for every site of the tenant) and "Remove site".                                  |
| 15  | A tenant not set up: the same two cards, each holding its step, "1. Connect the customer's CRM" with "Connect Vitec" and "2. Add the customer's site" with "Add a site".                                                                                                |
| 16  | "Connect Vitec", and Save in "Change": Core tries a new login with Vitec first and keeps nothing Vitec refuses, saying so under the password; once Vitec accepts, the window shows the address to give Vitec for its notifications.                                     |
| 17  | A window before every red button ("Make a new token", "Remove site", "Remove connection"): what stops working, Cancel, and a red button named for the act.                                                                                                              |
| 18  | Every button's sentence beside it; on a phone one column, the sentence above its button, and the arrow points down.                                                                                                                                                     |
| 19  | The links in Core's alerts open the connection's card or the site's window on the tenant's page.                                                                                                                                                                        |
| 20  | Built at `/admin-new` beside `/admin`; once it holds rows 1 to 19 it moves to `/admin`, and the current admin goes with what only it used, listed before it goes.                                                                                                       |

- Not in it, as nothing needs them to set Core up or put it right: the Overview and its figures,
  Records and a record's page, Flow, Events, the CRM pages, Settings with the maintenance switch
  and the devices, Failed forms, switching a tenant off, removing a tenant, "Check login"
  (Connect and Save try the login), a second CRM connection for one tenant, a new bell secret for
  one site (removing the site and adding it again gives one), a Save for a whole page, a staging
  marker and dark mode.
- Reply: "192 ok", or the numbers of the rows to change. Recommended: ok. Blocked: the build.

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

## 187. `[core]` The sign-in link, so the Ahre demo site joins the Norban tenant

- 2026-10-07 · Patric asked for a new site with Norban's records and the look of Ahre's own
  site, ahre.se, added to the Norban tenant as a second site ("Edit core admin if needed, to add
  a secondary site to norban tenant"). The admin area already holds several sites per tenant
  ("Add a site" on the tenant's page), so it needs no change. The new site is the Cloudways app
  "ahre-demo" (application 6715283 on server 1545003), a copy of the Norban demo, at
  `https://wordpress-1545003-6715283.cloudwaysapps.com`. Adding it to the tenant "Kowboy test
  account" is a save on that tenant's page in staging Core's admin, which opens only by a
  sign-in link mailed to Patric. With the link, the agent adds the site and puts its bell secret
  (the key that lets Core tell the site at once that a record changed) into the site's settings.
  Until then the site still fetches Norban's records whenever it is visited. Instruction: paste
  the sign-in link from the mail Core's admin sent; it works for 15 minutes, and "again" brings a
  new one. Smaller: Patric adds the site on the tenant's page himself and pastes its bell secret.

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

## 100. `[core]` kowboy.se has no email authentication for Postmark, so Gmail delays Core's mail (parked: Patric, 2026-09-28, "save this for later, this session is for template 2026 only"; his lead is to send from kowboy.cloud instead)

Postmark's page for the sign-in mail of 2026-09-28 says: "we recommend that you set up email
authentication for kowboy.se". Without it Gmail's server refuses Core's mail at first and takes
it minutes later (98). The fix is two DNS records on kowboy.se, which Postmark shows under Sender
Signatures, kowboy.se (a DKIM record and a Return-Path record). Only someone with access to
kowboy.se's DNS can add them; the agents have no such access.

**Patric, 2026-09-28:** mail must arrive, a delay is acceptable; "do I need to add the headers?"
The answer: yes, and they are DNS records, not headers, and nothing in Core changes. Without
them Google now takes the mail and shows it nowhere (98), so the records are what makes the mail
arrive at all, delayed or not. In Postmark, open Sender Signatures, kowboy.se, and it shows two
records (a DKIM record and a Return-Path record) to add at kowboy.se's DNS provider (Cloudflare
runs `dev.kowboy.se`'s names, most likely the whole domain); add them, then say "added". Or give
an agent a Cloudflare token limited to DNS for kowboy.se in the session environment's settings
as `CLOUDFLARE_DNS_TOKEN`, then say "token saved", and the agent adds them.

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
