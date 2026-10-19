# Open questions

The register of everything asked of Patric. A question gets the next number here before it is
asked in chat, chat refers to that number, and Patric answers by number, in any conversation.
Numbers are never reused: an answered question gets its line in `decisions.md` and leaves this
file. Each one is tagged with its part and names what is blocked and the smaller option, so
answering is quick. Next number: 225 (214 was withdrawn on 2026-10-19: its four rules on designing are a `[handbook]` question, asked in chat and recorded only in the handbook's own register; 206 is the database question the thread "Database connection slots" asked in chat as 88 on 2026-10-18, a number closed on 2026-09-28; 192 was withdrawn on 2026-10-13 and replaced by 193; 191 was withdrawn on 2026-10-13 and replaced by 192; 185 was merged into 184 on 2026-10-06, so one answer covers both; 124 was asked in chat only on 2026-10-03 and answered the same day; 116 to 118 were used by the handbook sessions of 2026-09-29 to 2026-10-03, 116 in chat only; 75 to 77 were also used in chat on 2026-09-21 for the porting
plan's questions, which are 78 to 80 here; 62 to 69 were also used in chat on 2026-09-20 for the WordPress
plan's questions, which are 66 to 73 here; 47 and 48 were used in chat on 2026-09-19 for 16 and 2, and the helper-methods
conversation of the same day counted 30 to 49 in chat; none of those are register numbers).

## 224. `[admin]` How the Inbox's card for forms that did not reach the CRM works now

- 2026-10-19 · After 218 a form that cannot be sent is never sent again, so the card's "Resend"
  button and window are gone from staging, with the sentence on how long Core keeps the forms.
  The card still says how many forms did not reach the CRM, from which websites, when, and why.
  Nothing on it ends it now except the forms' 30 days running out. Option a adds three lines:
  1. The card ends by itself once the CRM takes a form through that brokerage's connection
     again (what the card already reads as "it has answered again"), or after the 30 days.
  2. "Fixed today" then says "<CRM> takes forms again".
  3. The card adds: "Each visitor was told the form wasn't sent and to contact the brokerage
     directly. The website's page Formulär keeps their details for 30 days."
- Blocked: the card stays up to 30 days, with no way to end it.
- a) the three lines above (recommended).
- b) a "Done" button ends the card instead of line 1; lines 2 and 3 as in a.
- c) no forms card: the health check of failing forms is the only sign.

## 222. `[client-wordpress]` Put the new forms on the Ahre demo too

- 2026-10-19 · The Norban demo runs theme 1.3.5 and plugin 0.9.2 (the forms list's changes and
  the step "Söker du bostad?"); the Ahre demo still runs theme 1.3.1 and plugin 0.8.0, and a
  theme update there waits for Patric's word. Its styling lives in its database, which a theme
  update keeps.
- Blocked: the Ahre demo's forms stay as they were.
- a) yes: the same versions as the Norban demo (recommended).
- b) no: leave it as it is.

## 221. `[client-wordpress]` Approve the look of the step "Söker du bostad?"

- 2026-10-19 · Built on the Norban demo as the forms list describes it: under the confirmation,
  "Steg N av N · valfritt", "Minst antal rum" and "Minst boarea (kvm)" prefilled with the closest
  value below the home's, and on a home's forms "Kontakta mig om min nuvarande bostad", which
  moved here from the person's step, so skipping the step skips the box. "Hoppa över" closes the
  window; "Skicka" sends the search profile and shows "Tack! Du får tips om nya bostäder som
  passar det du söker." The home's areas, kommun code and type go with it unseen. The screens
  are in the project's shared folder, `forms/profile-step/` (`3-interest-sent.png`,
  `3b-profile-sent.png`, `6-booking-sent.png`, `8-valuation-sent.png`).
- Blocked: nothing; the step stays on the demo meanwhile.
- a) ok (recommended).
- b) change what is named.

## 220. `[admin]` Approve what part 5 of design B shows beyond the tenant mockups

- 2026-10-19 · Part 5 (the tenant mockups' pages: Tenants, one Add/Edit screen each for a tenant,
  a website and a CRM, Delete for each, deleting a tenant with everything of it, the Flow page with
  the maintenance box, and a CRM's fields, line, sections and buttons drawn only from its own code)
  is on staging at `/admin`. It needed 37 lines the mockups do not show, among them six new web
  addresses on Core, one index (migration 022) and the panel's own texts, and leaves four rows
  unbuilt. The list is `panel-candidates/b-part5-new-lines.md`, with pictures of every screen in
  `panel-candidates/part5-shots/`, both in the project's shared folder.
- Blocked: nothing; the lines stay on staging meanwhile.
- a) ok: all 37 lines (recommended).
- b) ok, except the lines named.

## 219. `[client-wordpress]` Sharp card and agent photos: let the theme ask Kowboy's image CDN for a sharp copy at the size each is shown

- Volume assumed: 1,046 properties, Core's totals through the two staging sites on 2026-10-19
  (Norban 547, Ahre 499, every status; production's counts are not readable from a session);
  3 photos per card; 6 widths per photo at most. A property page holds 27 photos on average (655
  photos on 24 pages sampled), which counts only for the larger option below.
- 2026-10-19 · Patric: "Images overall feel low resolution. I see it on property lists, agent
  list, agent inside of property page or agent page." Measured on the Norban demo at Windows'
  100 %, 125 % and 150 %: the theme picks a large enough file everywhere (never stretched), but
  the CDN's smaller copies (480 to 1600 wide) are shrunk from the 1920 photo with a soft filter
  and hold about half the fine detail of a sharp shrink (a 1024 copy: 961 against 1956, the
  variance of the Laplacian), and the browser then shrinks that copy again to the box. On screen
  a card's photo keeps about 45 % of the detail a sharp copy gives (772 against 1362 at 100 %, 426
  against 813 at 125 %); an agent's photo 77 % and 54 %. The side by side is
  `/mnt/project-files/kowboy-2026/photos-today-vs-sharp-copies.png`.
- The fix: the CDN `cdn-realestate.kowboy.se` already answers Cloudflare's image resizing
  (`/cdn-cgi/image/width=…/`, tried 2026-10-19), which makes a sharp copy of the 1920 photo at any
  width. On the cards' photos and the agents' photos, where Patric saw it, the theme would list
  the widths 640, 768, 960, 1152, 1536 and 1920 (a card at 100 %, 125 % and 150 % gets its exact
  size) instead of the stored copies; if the resizer refuses, the photo falls back to today's
  copy. The large photo and the gallery stay as today.
- Cost: Cloudflare bills it as Images Transformed: the first 5,000 different sizes a month are
  free, then $0.50 per 1,000; on a Free plan, new sizes beyond 5,000 fail instead of being billed
  (developers.cloudflare.com/images/pricing, read 2026-10-19). At most every card photo at all 6
  widths every month: 3 × 6 = 18 sizes per property, $0.009 per property a month; for 1,046
  properties 18,828 sizes, 13,828 above the free 5,000, $6.91 a month. Each agent adds 6 sizes at
  most. Every photo on the property pages too would be 27 × 6 = 162 sizes per property, $0.081 per
  property a month, $82 a month for 1,046; not proposed.
- Blocked: sharp photos on the sites. The free route is to remake the CDN's stored copies with a
  sharp shrink where they are made, which is outside this repository.
- a) yes: the theme uses the CDN's resizing for card and agent photos, on both demo sites; the
  account's Cloudflare plan must bill above 5,000 (recommended: the only fix inside the theme).
- b) source: the stored copies are remade sharply where they are made, outside Core.
- c) keep the photos as they are.

## 218. `[core]` `[admin]` `[client-wordpress]` Where a visitor's form that failed is sent again: on the website, or in Core's new admin

- 2026-10-19 · Two of your approvals point different ways. On 7 October you said the website
  keeps every form with the visitor's details ("logged locally on the wp site [...] Failed and
  succeeded alike. Core can log but no PII"), and the forms list puts "Send again" on the
  website's page "Formulär" and removes Core's own copy of the details, its page "Failed forms"
  and its "Send again". On 16 October you approved design B for the new admin, whose card "2
  visitor forms didn't reach Vitec" has the button "Resend 2 forms" (rows 27 to 30 and 114 of
  `docs/new-admin/b-build-list.md`); that button sends Core's own copy, so it needs Core to keep
  the visitor's details for 30 days. Nobody raised the clash when B was approved. The website's
  copy and its "Send again" are built in every answer below, since you asked for them.
- Blocked: removing Core's copy of the details, the old admin's page "Failed forms" and the new
  admin's "Resend" button, and the words of the alert for a failed form.
- a) on the website (recommended: it is what you asked for on 7 October): Core keeps no personal
  details; the new admin's card still says how many forms did not reach the CRM and from which
  website, and links to that website's page "Formulär", where "Send again" is.
- b) both: Core also keeps an encrypted copy of each form the CRM did not take, for 30 days, so
  the new admin's "Resend" stays as designed; Core then holds visitors' personal details.
- c) Core asks the website: the new admin's "Resend" asks the website to send its own copy
  again, so Core keeps no personal details and the button stays; it needs a new message from
  Core to every website, and works only while the website answers.

## 217. `[core]` Rehearse a restore now: a new database server from the latest backup, staging pointed at it, then back

- 2026-10-19 · Patric: "In case of disaster, can you restore backup using DO api key?" The key
  reads the cluster's backups (eight, one a day from 2026-10-11 to 2026-10-18 at 17:38 UTC, the
  latest 1.37 GB; read 2026-10-19). DigitalOcean restores a backup only into a new database
  server, to any moment of the last seven days (its PostgreSQL documentation, read 2026-10-19).
  Whether the key may create a server shows only by doing it, so it is unproven. The restore drill
  of AC 24 (item 33, condition 3) does it once, staging only, live untouched: (1) a new server
  from the latest backup, the same size; (2) staging's settings pointed at it, with a pool
  `staging` on it, until staging's sites catch up with nothing lost; (3) staging pointed back and
  the new server deleted the same day. Cost: this size is $15.15 a month, billed by the hour, about
  $0.02 an hour, so under $0.10 for the drill. The plan put the drill after 210; it does not
  depend on 210.
- Blocked: AC 24, and knowing that a restore works before a disaster needs it.
- a) yes: run the drill now, staging only (recommended).
- b) later: with the load tests, after 210.

## 215. `[core]` `[admin]` Keep the maintenance switch, or remove it

- 2026-10-19 · Patric asked what maintenance is for. While it is on, websites keep fetching, but
  Core sends them no change notices and starts no queued job (recomputes, reloads); the held
  notices go out together when it is switched off, and Core keeps reading the CRMs and taking
  forms. The decision that added it (2026-09-20) records what it does, not why, and the strategy,
  the spec and the concept never mention it. The uses it could serve are guesses: a database
  restore or a hand repair of data, a rules change held until checked, a risky deploy. Question
  203 a moves its switch from the Inbox to the Flow page; that is built meanwhile.
- Blocked: nothing; removing it later takes its code, its setting, its held notices and its box
  on the Flow page.
- a) remove it: Core always tells the websites at once and always runs its jobs (recommended,
  nothing needs it today).
- b) keep it, on the Flow page.

## 212. `[core]` `[admin]` Keep a website's own answer to Core's change notice, so the card "stopped updating" can quote it

- 2026-10-18 · When a website answers Core's change notice with an error, Core keeps only the answer
  code, such as 500, and when it does not answer, only that it did not. The card "{website}
  stopped updating" now says whose fault it is and what to check, but cannot quote the website's
  own words: its error message, or why it did not answer (no such address, connection refused,
  no answer within 10 seconds). Proposed: one new column on the website's row in Core's
  database, holding the first 300 characters of the website's answer or the reason it did not
  answer, replaced at each notice; the card quotes it after the answer code.
- Blocked: nothing; until then the card names the answer code only.
- a) yes: keep the answer and quote it on the card (recommended: it is the error's own message
  you asked for).
- b) no: the card keeps the answer code only.

## 211. `[core]` Put the release preview in staging's settings as the step before each deploy, and make it fail once on purpose

- 2026-10-18 · The release impact preview (enforced check 5, AC 36) is built and tested
  (`node dist/main.js preview`, staging 9ea6a8c): the new version maps every stored record again,
  writes nothing, and fails when a record cannot be mapped or does not fit the schema.
  `.do/app.staging.yaml` runs it as the job "preview" before each deploy, but staging runs on the
  settings stored at DigitalOcean, and changing those needs Patric's word. New lines, staging only:
  (1) the job "preview" in staging's settings, run before each deploy against staging's database
  through its pool `staging`, so it takes no new database slot; (2) once, before it, a job made to
  fail, because DigitalOcean's documentation does not say what a failed one does: the deploy must
  stop and the running version stay, and the job is then put back to the real preview. Cost:
  DigitalOcean bills a job per second only while it runs ($5.00 a month for the smallest size, so
  a five-minute run costs about $0.0006; price list read 2026-10-18).
- Blocked: condition 2 of the final release proven on staging (item 33).
- a) yes: both lines, on staging only (recommended).
- b) no: the preview is first tried as a step of a deploy at the release to live.

## 210. `[core]` Reword two acceptance criteria for how Core runs today: the release path (AC 18) and the load test (AC 27)

- 2026-10-18 · AC 18 reads "Merging to main deploys staging and runs the smoke suite automatically.
  Production deploys only after approval. A failed production health check leaves the previous
  version live." Since 2026-09-17 staging deploys from its own line of work and live from `main`
  (strategy §4, README "Deploying"), and no smoke suite exists yet. AC 27 reads "Load test on
  staging at 10x launch": staging shares its database server (1 vCPU, 1 GB, 15 GB of disk) with
  live, and one tenant with 300,000 properties would fill that disk and load live. Proposed: AC 18
  "A change saved to staging deploys staging and runs the smoke suite against it automatically.
  Production deploys only after approval. A failed production health check leaves the previous
  version live."; AC 27 "Load test on a temporary copy of staging, its own database server and
  app, deleted after, at 10x launch:" and the rest unchanged. `acceptance/` is protected.
- Blocked: the tests for AC 18 and AC 27 (item 33).
- a) yes: reword both as proposed (recommended).
- b) no: AC 27 runs on staging itself, on the database server live shares, and AC 18 stays as
  written.

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
  engines can follow) was built on 2026-10-18 with its browser part in the theme, as today, so a
  or b moves that part into the plugin. Options a and b change the
  scaffolding Patric approved on 2026-09-21, where a set (today the theme) holds the views and the
  scripts, so they wait on his yes. The whole answer is
  `strategy/lists-today-and-the-old-shortcode.md` in the project's shared folder.
- Blocked: nothing; the answer decides whether item 31's browser part moves into the plugin.
- a) the browser part moves into the plugin: in any theme that brings the list's look, the
  shortcode and the blocks refresh, filter, show more and page by themselves, and item 31 is built
  there once, for every list (recommended: every theme needs that behaviour, while the look is
  each site's own).
- b) as a, and the plugin also carries a plain look for every list, so the shortcode shows a
  working list in any theme with nothing added, as the old shortcode did; a theme still replaces
  the look file by file. It adds a second look, for every kind of list (four today: homes, agents,
  areas and associations), that a site with its own design replaces anyway.
- c) as today: the browser part stays in the theme, where item 31 is built.

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
