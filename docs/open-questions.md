# Open questions

The register of everything asked of Patric. A question gets the next number here before it is
asked in chat, chat refers to that number, and Patric answers by number, in any conversation.
Numbers are never reused: an answered question gets its line in `decisions.md` and leaves this
file. Each one is tagged with its part and names what is blocked and the smaller option, so
answering is quick. Next number: 210 (206 is kept for the database question the thread "Database connection slots" asked in chat as 88 on 2026-10-18, a number closed on 2026-09-28, so that thread records its answer under 206; 192 was withdrawn on 2026-10-13 and replaced by 193; 191 was withdrawn on 2026-10-13 and replaced by 192; 185 was merged into 184 on 2026-10-06, so one answer covers both; 124 was asked in chat only on 2026-10-03 and answered the same day; 116 to 118 were used by the handbook sessions of 2026-09-29 to 2026-10-03, 116 in chat only; 75 to 77 were also used in chat on 2026-09-21 for the porting
plan's questions, which are 78 to 80 here; 62 to 69 were also used in chat on 2026-09-20 for the WordPress
plan's questions, which are 66 to 73 here; 47 and 48 were used in chat on 2026-09-19 for 16 and 2, and the helper-methods
conversation of the same day counted 30 to 49 in chat; none of those are register numbers).

## 209. `[core]` `[crm-vitec]` `[client-wordpress]` Start the forms work now, on the list verified on 7 October

- 2026-10-18 · Item 29: Patric verified the forms list
  (`/mnt/project-files/strategy/forms-list.md`) on 2026-10-07 ("No other comments/changes"), and
  the development starts on his go: first what the list marks as not built or to remove, then
  every forms file checked against the list line by line, with the tests green, reported file by
  file. The first brokerage's site needs its forms, so the plan for the final release
  (`/mnt/project-files/release/final-release-plan.md`) puts them before that site goes live.
- Blocked: the forms work (item 29), with item 21's leftovers and item 32.
- a) yes: go (recommended).
- b) later: the forms wait until after the final release.

## 208. `[core]` Default: the project closes on the plan's table, and what it marks Later waits for a new project

- 2026-10-18 · Patric: "work towards closing this project and getting it production ready". The
  plan (`/mnt/project-files/release/final-release-plan.md`, "The work left, and who does it")
  lists every open piece of work with its thread, what it waits on, and whether it comes before
  the final release, before the first brokerage's site goes live, or Later. Later: searching by a
  sentence and the other AI ideas (explored only), Mspecs (waits on an agreement with Mspecs),
  other clients' sites and the porting factory (items 16 and 19, question 80), and the written
  guidance for implementers (item 13). The debloat of the old admin (item 27) is closed, replaced
  by the new admin (item 30). Once this stands, `next-steps.md` follows the table.
- Blocked: nothing; silence agrees.
- Reply only if you disagree: no, and which row.

## 207. `[core]` Release staging to live as soon as staging's checks are green, before the rest is finished

- 2026-10-18 · Live runs the state of 2026-09-23 with the pool fix of 2026-10-06 (`main` at
  d420ba1); staging is 342 changes ahead, with twelve migrations (010 to 021) live has never run,
  the one-time clean-up of the stored logins (known bug 3), the forms guard and the new admin as
  far as it is built. On 2026-10-03 Patric said "keep on staging for now". No connection on live
  is recorded anywhere, so no customer uses it (read from the records; confirmed in live's admin
  before the release). Releasing now runs the migrations and the new settings on live while
  nothing depends on it, and leaves the final release only what is built after. The release
  waits for: the enforced checks green on staging (green on 2026-10-18), staging's health green
  (red: `vitec.retries`, which the thread "Proper error messages in admin" is fixing), the
  acceptance report made again (known bug 6, item 33), and live's settings in its own spec: the
  pool `live` (12 by 167 c unless 206 changes it), `SENTRY_DSN`, and `ADMIN_SECRET` removed.
  Undo: live's previous deployment, in one step.
- Blocked: the early release.
- a) yes: release as soon as staging is green (recommended).
- b) no: live stays as it is until the final release.

## 205. `[admin]` Approve the design of the records list, the record page and the manual sync

- 2026-10-16 · The clean room drew the manual sync (four filters, three levels, no list of earlier
  runs), the record browser and the record viewer into design B, as asked on 2026-10-16: 37 new
  images and B's screens redrawn with a "Records" link, in `clean-room/out/b2/` in the project's
  shared folder. Fresh testers finished all six jobs with no wrong press in the third round. B's
  "Reload all data" becomes "Sync records…", which opens the manual sync; a tenant's Retry stays
  separate. "Brokerage" reads "Tenant" throughout (question 203). Lines a build needs beyond the
  images are listed after the build, as for B's parts.
- Blocked: building the records list, the record page and the manual sync.
- a) ok: build it as drawn (recommended).
- b) ok, except the images named.

## 204. `[admin]` `[crm]` Let a CRM's code write the line under a connection's name

- 2026-10-16 · Patric asked that CRMs be "encapsulated completely". The new panel's own code still
  holds Vitec's words (its login labels, "Live Vitec · G12" under a connection's name, the office
  check's button), in `panel/src/crm-words.ts`. Labels, help lines, choices and the office check
  move into Vitec's code with what the adapter API already offers. The line under a connection's
  name has no place there: a CRM's code would describe each of its connections in one line, an
  optional addition to the protected adapter API that any CRM can use.
- Blocked: emptying `panel/src/crm-words.ts`.
- a) yes: add it, and the panel shows the CRM's line (recommended).
- b) no: the panel shows the connection's own fields in the order the CRM declares them
  ("Live Vitec · G12 · kowboy_partner").

## 203. `[admin]` Approve the mockups of the tenant pages, deleting, maintenance and the Flow

- 2026-10-16 · Patric's changes of 13:30 to 13:36 are painted as 27 images in
  `panel-candidates/tenant-mockups/` in the project's shared folder, with `index.md` listing each
  image and every line not already in B's images or the part lists. "Brokerage" becomes "Tenant";
  "New tenant" sits with the list; "Entities" on the list counts the tenant's records; Add and
  Edit are one screen for websites and CRMs; Add CRM asks which CRM first; every website and CRM
  connection has an Edit and a Delete icon; a Vitec card shows its offices collapsed and the forms
  test mode label; deleting a website, a CRM connection or a tenant asks first (a tenant by typing
  its name); maintenance leaves the Inbox for a "Flow" page above the Flow log. Editing a CRM
  connection with the password left empty keeps the saved login. The Flow is built from what Core
  keeps today (each CRM's list of records waiting and the event log's writes), so a record already
  written shows when it was written rather than when it was queued.
- Blocked: building these pages.
- a) ok: build as drawn, with all listed lines (recommended).
- b) ok, except the images or lines named.

## 202. `[admin]` Approve what parts 3 and 4 of design B show beyond B's images

- 2026-10-16 · Part 3 of design B (the Inbox's windows, Waiting and Fixed today, resending forms,
  fixing a bell secret, maintenance and "Reload all data") is on staging at `/admin`. It keeps
  open problems and reloads in two new tables (`panel_problems`, `reloads`, migration 021), as rows
  23, 36, 37, 40, 105 and 106 of question 197 need. It needed ten lines that B's images do not
  show: texts for other platforms, other outcomes and other counts, and four choices about what
  Fixed today and "Reload done" count. The list is `panel-candidates/b-part3-new-lines.md` in the
  project's shared folder.
- 2026-10-16 · Part 4 (the Inbox's card for records that can't be loaded, with each record's
  reason and Retry, and the refused login's leaving offices) is on staging too, with the web
  address `POST /v1/panel/brokerages/{id}/retry`. Its eight lines are
  `panel-candidates/b-part4-new-lines.md`.
- Blocked: nothing; the lines stay on staging meanwhile.
- a) ok: all eighteen lines (recommended).
- b) ok, except the lines named.

## 201. `[admin]` Approve what part 2 of design B shows beyond B's images

- 2026-10-16 · Part 2 of design B (the brokerages list, a brokerage's page and adding a
  brokerage) is on staging at `/admin`. It needed thirteen lines that B's images do not show:
  empty and error states, the notes after an action, B's sentences for other counts of websites
  and connections, the Lovable website's help, the page's own Connect and Add website windows, the
  change-login sentence made true by decision D5 of question 197 (the saved username is shown), and
  a "Finish" button that ends the wizard on the brokerage's page while row 75 waits on question 199. The list is `panel-candidates/b-part2-new-lines.md` in the project's shared folder.
- Blocked: nothing; the lines stay on staging meanwhile.
- a) ok: all thirteen lines (recommended).
- b) ok, except the lines named.

## 200. `[admin]` Approve what the first part of design B shows beyond B's images

- 2026-10-16 · The first part of design B (signing in, the account menu and the Inbox) is on
  staging at `/admin`, and the old admin at `/admin-old`. Building it needed eleven lines that B's
  images do not show: texts for states B does not draw (an address that is not one, Core not
  answering, one thing in the Inbox, other ways a form or a website fails, a problem B has no card
  for, the sign-in mail's plain-text copy, the page when the app is not built) and a limit of five
  sign-in links per address in 15 minutes, which is taken out until approved. The list is
  `panel-candidates/b-part1-new-lines.md` in the project's shared folder.
- Blocked: nothing; the ten texts stay on staging meanwhile, and the limit waits.
- a) ok: all eleven lines (recommended).
- b) ok, except the lines named.

## 199. `[admin]` `[core]` Let a CRM's code tell Core how a new connection is coming along, so the new admin can show it

- 2026-10-16 · Patric asked what decision D1 of question 197 means ("D1 - clarify"). Design B
  shows how a new connection is coming along: "Waiting for Vitec's first notice", "Loading data,
  38 of 61 properties", "Office check done: Täby added". Only the Vitec code knows these things,
  and the engine must never know Vitec, so today the admin cannot learn them. The yes adds one
  general way, open to any CRM's code, to report a connection's progress to the engine: waiting
  for the CRM's first notice, how far the first load has come and when it is done, and when an
  office check finished and what it changed. The admin then shows those lines without the engine
  naming Vitec. The way goes into the protected part CRM code talks through
  (`engine/adapter-api/`), so it needs his yes. Like a parcel tracker: the courier posts "picked
  up", "38 of 61 delivered", "done", and the shop shows each step without knowing which courier
  carries it.
- Blocked: rows 33, 41, 56, 64, 71, 75, 91 and 111 of design B (`docs/new-admin/b-build-list.md`);
  the rest of B is built without waiting.
- a) yes: add the general way, and B shows those eight rows (recommended: a new connection's
  setup is when an admin most needs to see progress).
- b) no: B is built without those eight rows.

## 198. `[client-wordpress]` How complete the list shortcode is in a theme other than Kowboy 2026

- 2026-10-16 · Patric asked how lists are built today, compared with the shortcode of his earlier
  plugins, which did both the query and the output, built on the server and then refreshed in the
  browser, "for free" wherever a list was placed. Today the query is already one shortcode: the
  plugin's one list function (`[core_list]`, `core_client_list` in `includes/templates.php`) runs
  the query with filters, search, sorting and pages, and builds the first page on the server for
  the shortcode, the plugin's blocks, the theme's pages and the reload address alike. The rest
  comes from the theme "Kowboy 2026": the look (the list's and the cards' view files and the
  stylesheet) and the browser part, which switches tabs, applies filters, searches places, shows
  more and fetches new cards from the reload address (`setupList` in `assets/kowboy-2026.js`; only
  home lists have it). So under another theme `[core_list]` shows nothing until that theme brings
  view files of its own, and then a list that does not react to tabs, filters or "Visa fler" (read
  in the code, not tried). Next-steps item 31 (a refresh when the page loads, page addresses search
  engines can follow) is built where this answer puts the browser part. Options a and b change the
  scaffolding Patric approved on 2026-09-21, where a set (today the theme) holds the views and the
  scripts, so they wait on his yes. The whole answer is
  `strategy/lists-today-and-the-old-shortcode.md` in the project's shared folder.
- Blocked: nothing today; the answer decides where item 31 is built.
- a) the browser part moves into the plugin: in any theme that brings the list's look, the
  shortcode and the blocks refresh, filter, show more and page by themselves, and item 31 is built
  there once, for every list (recommended: every theme needs that behaviour, while the look is
  each site's own).
- b) as a, and the plugin also carries a plain look for every list, so the shortcode shows a
  working list in any theme with nothing added, as the old shortcode did; a theme still replaces
  the look file by file. It adds a second look, for every kind of list (four today: homes, agents,
  areas and associations), that a site with its own design replaces anyway.
- c) as today: the browser part stays in the theme, and item 31 is built there.

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

- 2026-10-18 · Patric said "again" and asked the agent to read his mail instead of pasting. The
  agent asked for a link at 19:41 UTC and searched his inbox, spam and trash: no mail from Core
  has arrived since 2026-10-03, neither this link nor the three asked for on 2026-10-07. That is
  question 100 (kowboy.se lacks the two DNS records Postmark needs, so Google takes Core's mail
  and shows it nowhere), so no sign-in link can reach him until 100 is done. Options: a) skip
  (recommended): the Ahre demo stays outside the tenant and keeps fetching Norban's records on
  each visit, which a demo does not notice; b) himself: if his browser is still signed in to
  staging Core's admin, he adds the site on the Kowboy test account's page and pastes its bell
  secret; c) mail first: 100 is done, then the agent signs in from his inbox.

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

- 2026-10-18 · Patric: "email must work, solve that first" (after the Ahre demo's sign-in link,
  question 187, never arrived). Checked: Postmark accepts every mail (Core answers an error when it
  does not), yet no mail from Core has reached his inbox, spam or trash since 2026-10-03; public
  DNS shows kowboy.se's names at Cloudflare, no Return-Path record (`pm-bounces.kowboy.se`) and
  DMARC at `p=none`, so Google still receives mail signed for kowboy.se by nobody. No connector
  reaches Cloudflare's DNS or Postmark, and a token saved in the environment reaches only a new
  session. Options: a) added (recommended, the fewest steps for him): in Postmark open Sender
  Signatures, kowboy.se, copy the DKIM record (a TXT record) and the Return-Path record (a CNAME
  `pm-bounces` to `pm.mtasv.net`) into Cloudflare's DNS for kowboy.se, the CNAME set to "DNS only"
  (grey cloud), press Verify in Postmark, then say "added"; the agent then checks the records,
  asks for a sign-in link and finds it in his inbox. b) token: he saves a Cloudflare token that may
  edit kowboy.se's DNS as `CLOUDFLARE_DNS_TOKEN` and pastes the DKIM record's name and value here
  (public, not secret); a new session adds both records.

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
