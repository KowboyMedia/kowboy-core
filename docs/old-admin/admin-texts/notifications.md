# Admin texts: Notification system (draft for review)

Files read: AGENTS.md; docs/admin-panel.md ("The words it uses", "The pages"); docs/decisions.md (the lines of 2026-10-06 on questions 164, 172 and 173, and of 2026-09-17 on releases); docs/next-steps.md item 26 (Steps 1, 1b and 3); docs/open-questions.md (question 180); docs/strategy.md §2 and §8.1; docs/staging-site.md; engine/health.ts; engine/attention.ts; engine/alerts.ts; engine/admin/summary.ts; engine/admin/overview.ts; engine/admin/words.ts, feed.ts, records.ts, scope.ts, login.ts, tenants.ts, index.ts (the admin events) and auth.ts; engine/bells.ts; engine/jobs.ts; engine/lifecycle.ts; engine/ingest.ts; engine/recompute.ts; engine/index.ts; engine/http/server.ts; engine/storage/submissions.ts; main.ts; admin/src/pages/overview.tsx; admin/src/lib/series.ts and format.ts; admin/src/components/explained.tsx, empty.tsx, copy.tsx and layout.tsx; admin/src/App.tsx; admin/src/pages/flow.tsx, settings.tsx, events.tsx, record.tsx and tenant.tsx (at 37d0358 and as rebuilt in the working tree); adapters/vitec/index.ts, api.ts, store.ts, offices.ts, mappers, admin/index.ts, vitec.test.ts and admin/directions.test.ts; clients/wordpress/README.md, clients/lovable-kit/README.md and both clients' bell receivers; acceptance/admin.test.ts, operations.test.ts, restore.test.ts and submissions.test.ts; admin/e2e/journeys.spec.ts; the Forms and Vitec lists in this folder. Texts examined: 176. Texts that fail: 151.

Drafted against `staging` at 37d0358, to fit question 172 and Step 3 of item 26 as decided on 2026-10-06. Every check has a level: P0, Core is down for every customer; P1, one customer's sites or forms are disrupted; P2, to look at; P3, for information. The sites check is red only for a site Core told of changes more than an hour ago that has not fetched since. `vitec.catch_up` becomes four checks. A problem is a failing check, or each thing it names. A P1 problem is mailed at its start and at its end, P2 goes to the Overview and the 07:00 mail, and P3 to the event log only.

Example data, from staging: Core at https://staging.core.kowboy.cloud; the tenant Kowboy test account (tenant 1); its Vitec connection, short name vitec-2; its site v4-staging (Cloudways) (site 2); the office Norban Mäkleri, the CRM's office id M31529; the customer or group id G2. Times and counts are illustrative: Core told the site of changes at 21:37, the problem began at 22:37 and ended at 23:52.

How texts are counted: a title, a sentence, a label, a value, a column header, an empty state, a template and a mail line each count once, and an entry that covers several says how many. Each check's title, green state and red sentences count under that check's entry. The fake adapters' checks run only in tests and local runs, so they are left out. engine/admin/overview.ts has one text of its own: a site's tenant written as its number when the tenant is not found. A tenant's sites are deleted with the tenant, so that text never shows, and it passes. The other words overview.ts hands the page come from attention.ts and summary.ts.

Shared with the two other lists in this folder. The Vitec list writes the reasons and details that the Vitec code puts on its events (an office taken off, Core's pause, a refused login, a failed fetch) and the words of the Vitec page. The Forms list writes the form sentences and the forms check's public words. This list writes the engine's frame around them, uses their words, and writes the Vitec health checks, which the Vitec list leaves out.

The tenant page is being rebuilt beside the old one (question 180, open). The new page names a site by its address, calls the button “Check login”, and has no site switch, no “Ring it” and no “What this site reported going wrong”. Targets that name the tenant page's labels use those at 37d0358 and follow the new page's words once it replaces the old one. `{site}` is the site as its tenant's page names it: “v4-staging (Cloudways)” today, and its address on the new page.

Needs that recur, named by letter below:

- **M The map, and the adapter's part of it (needs the owner's approval).** One map in engine/health.ts gives each engine check a title, a level, a green sentence and a red sentence, and gives each thing a red check names its own sentences with links. The tile, /v1/health, the event sentence, the line under "Needs attention" and the alert all read that map, so a check says the same everywhere. An adapter's check needs the same, but the adapter lacks the tenant's name and the admin area's addresses. Smallest way: two optional fields on `HealthResult` in engine/adapter-api/types.ts, beside the `level` that question 172 adds. `title` is the check's title. `things` lists, per thing, the connection's short name, an office when the thing is one (its id, its name and its system), and the thing's sentences written with `{connection}`, `{office}` and `{tenant}`. The engine fills those in with the names the glossary asks for and links each one. A CRM's check with no thing links to the CRM's page. engine/adapter-api/ is protected, so this needs the owner's approval. Storage: the columns `title` and `things` in `health_results`, and the fields `title` and `said` on `check.failed`, so a line reads in seven days what it read the day it was written. Each is its own line in a register question, beside question 178's `level`. `names` stays as it is, since acceptance/submissions.test.ts (protected) reads it.
- **S Step 3.** A target that shows a level, pairs a problem's start with its end, or speaks of the 07:00 mail needs Step 3 of item 26 built. The level on a line of "Needs attention" needs question 178.
- **T Tests that pin today's words.** acceptance/admin.test.ts lines 611, 654, 671 and 672; acceptance/operations.test.ts lines 241, 264, 266, 281, 284, 292, 311, 314 and 334; acceptance/restore.test.ts line 162. acceptance/ is protected, so changing these needs the owner's approval. Also adapters/vitec/vitec.test.ts lines 405 to 408, 524 to 529 and 649 to 654, and admin/e2e/journeys.spec.ts lines 53, 98 and 315.
- **R The event's row.** `summarise()` reads only an event's fields. Most sentences below also need the event's row: the site's name from its number, the tenant's name, the connection's CRM and short name, and the record type. Smallest way: the callers (engine/admin/records.ts, feed.ts and overview.ts, and engine/alerts.ts) pass the row they already hold, with the names read once per page, as records.ts already does for sites.
- **H Who acts at the host.** Core runs on DigitalOcean. The decision of 2026-09-17 records that people never touch a console. A target for the database or the worker therefore names where the fault is and says "have it looked at there". Unclear who that is.
- **D1** (the Vitec list's). When an office leaves the sites, its homes, its new-build projects and the office record go, and its agents stay, because agents, areas and housing cooperatives carry no office in Core (adapters/vitec/mappers). The targets say what the code does.

## admin/src/pages/overview.tsx and admin/src/lib/series.ts

### PageHeader `what` · Overview, under the title
- Now: "Whether Core is well, what it did today, and how the sites are doing."
- Target: "Whether Core is working, what needs a person, what Core did in the last 24 hours, and how each site is doing."
- Link: none
- Why: 5, the page shows the last 24 hours, not today, and the description leaves out "Needs attention".

### “See what is in flight” · Overview, the button beside the title
- Now: "See what is in flight", with nothing beside it
- Target: the label "Open Flow", and beside it, through `Explained`: "Flow lists every record on its way from a CRM through Core to the sites, newest first, and shows where each one is. Open it when a change made in the CRM has not reached a site."
- Link: /flow, as now
- Why: 4, "in flight" is a term; the button does not explain itself beside it (definition of done 4).

### Maintenance banner · Overview, above the verdict
- Now: "Maintenance is on. The sites still pull as usual, but nothing is rung and no job is taken. Turn it off in Settings."
- Target: "Maintenance is on. Core tells no site about changes and starts no recompute until maintenance is turned off. Each site still fetches its changes by itself every 15 minutes. Visitors therefore see a change up to 15 minutes later than usual. When maintenance is turned off, Core tells each site about the changes it held back. Maintenance is turned off on Settings."
- Link: "Settings" to /settings, as now
- Why: 4, "pull", "rung" and "job" are the code's words; 1, what it means for visitors is not said.
- Needs: none in code; journeys.spec.ts line 315 looks for "Maintenance is on.", which stays.

### Verdict when nothing is disrupted · Overview, the line above the check tiles (two texts)
- Now: the badge "All green", then "Everything Core checks is working."
- Target: the badge "Fine", then "Everything Core checks is working. Nothing needs you." When a check is amber: the badge "Fine", then "Nothing is disrupted. {One check has | n checks have} something to look at below." Rendered: "Nothing is disrupted. One check has something to look at below."
- Link: none
- Why: 5, once question 172's amber tiles show, "All green" and "Everything Core checks is working" are false beside them; 1, it does not say that nothing is to be done.
- Needs: S.

### Verdict when something is disrupted · Overview, the line above the check tiles (two texts)
- Now: the badge "2 red", then "Something needs attention."
- Target: P1: the badge "Disrupted", then "{One problem disrupts | n problems disrupt} the sites or forms of {tenants}. Each red check below says what is wrong and what to do." Rendered: "One problem disrupts the sites or forms of Kowboy test account. Each red check below says what is wrong and what to do." A P1 problem with no tenant, such as a check that has not run for 15 minutes: "{One problem needs | n problems need} a person now. Each red check below says what is wrong and what to do." P0: the badge "Core down", then the red check's first sentence and "The red check below says what it means and what to do." Rendered: "Core's background worker has not reported for 7 minutes. The red check below says what it means and what to do."
- Link: each tenant's name to its page, /tenants/1
- Why: 1, it says neither what is wrong nor what it means; 2, "red" counts tiles, and one check can hold several problems.
- Needs: S; the tenants of the open problems, which M's things give.

### The check tile's badges and names line · Overview, each check's tile (three texts)
- Now: the badge "ok" or "red", and under the detail the names joined by "; ", none of them a link. The owner's example: "vitec.catch_up", "red", "1 connection(s) with no offices", "vitec-2: no offices to sync"
- Target: the tile shows the check's title (the map, under engine/health.ts), its level as the badge ("Fine", "Core down", "Disrupted", "To look at" or "For information"), and the sentence for its state. A red check then shows each thing's sentences, at most three things, with every name a link, and after them "{One more problem is | n more problems are} listed under Needs attention." Rendered, the owner's example: the title "Vitec offices on the sites", the badge "To look at", "One Vitec connection has no office on the sites. Core fetches nothing for that connection.", then the connection's text: "Kowboy test account's Vitec connection, short name vitec-2, has no office on the sites, because Vitec lists no office that the login can read behind the customer or group id G2. …" (whole under adapters/vitec/index.ts).
- Link: each name to its place, as the map says
- Why: 2, "ok" and "red" name a colour, not what is fine or wrong; 3, no name is a link; 4, "; " stands for words.
- Needs: M; S for the level.

### `WHERE` · Overview, the link under a red tile (three texts)
- Now: "Go to Settings" (worker, database, schema), "Go to Tenants" (the sites check) and "Go to Flow" (lifecycle); the forms check and the Vitec checks have no link
- Target: no "Go to" line. Each thing's names link to their places. A check that names no thing links, inside its sentence, to the page where it is fixed: Settings for the version check, Failed forms for the forms check, the CRM's page for a CRM's check. The database and the worker are fixed outside the admin area, so their sentences say where, and their tiles carry no link.
- Link: /settings, /forms, /crms/vitec, as said
- Why: 3, "Go to Settings" opens a page where nothing fixes the worker or the database, "Go to Tenants" opens the list instead of the site, and "Go to Flow" opens a page that does not show this work.
- Needs: the CRM's page for an adapter's check, from the provider that registered it, which the engine knows at registration.

### "Needs attention", description · Overview, the card "Needs attention"
- Now: "The important things of the last seven days: an office taken off the sites, a connection paused after failures, a login the CRM refuses, and a site that stopped pulling. Each line names the exact office, connection or site, and its name opens it. Each one was also sent once by mail and Slack, where Settings says those are set."
- Target: "What needed a person in the last seven days, newest first. Each line says what happened, what it means for the sites and what to do. A name in a line opens that site, office or connection. A problem that stops Core or disrupts a customer's sites or forms was also sent by mail and to Slack, once when it began and once when it ended. Everything else to look at went in the mail at 07:00. Settings shows where alerts go."
- Link: "Settings" to /settings
- Why: 2, "paused" is the tenant page's word for a person's switch, and "pulling" is not the area's word; 5, after question 172 a pause is not mailed, and the list holds every problem of P0 to P2.
- Needs: S.

### Column "What happened", the cell · Overview, "Needs attention"
- Now: "a site stopped pulling — the check subscribers turned red: 1 site(s) have not pulled for an hour (v4-staging (Cloudways))", and the same line again at 16:15, with nothing to tell the two apart
- Target: the level as a badge, the title in bold, the problem's sentences, then "Still open." or "Resolved at {time}, after {duration}." Rendered: the badge "Disrupted", "Sites fetching their changes", then "Kowboy test account's site v4-staging (Cloudways) has not fetched the changes Core told it about at 21:37. Until the site fetches, its visitors see the site as it was before these changes. The site answered Core's call but has not fetched since. Read “What this site reported going wrong” under the site on Kowboy test account's page. Resolved at 23:52, after 1 hour and 15 minutes."
- Link: the names inside the sentences, as in the next column
- Why: 2, the check's name and "pulling"; 4, the dash and "site(s)"; 1, nothing on what it means or what to do; 5, two lines read the same.
- Needs: S (a problem's end paired with its start); question 178 for the level; M for the sentences.

### Column "Which, and where", the cell · Overview, "Needs attention"
- Now: "site v4-staging (Cloudways)", a link, over "tenant Kowboy test account"; for an office, "office Norban Mäkleri (M31529)" over "tenant Kowboy test account, connection vitec-2"
- Target: the thing as the glossary names it, every name a link. A site: "Kowboy test account's site v4-staging (Cloudways)". An office: "Kowboy test account's office Norban Mäkleri, the CRM's office id M31529", with under it "Through Kowboy test account's Vitec connection, short name vitec-2." A connection: "Kowboy test account's Vitec connection, short name vitec-2".
- Link: the tenant to /tenants/1; the site to /tenants/1#site:2; the office to its removed records, /records?tenant=1&office=M31529&deleted=true; the connection to /tenants/1#connection:vitec-2
- Why: 2, "site", "tenant" and "connection" stand as labels in front of names, a short name stands alone, and an id sits in brackets with nothing saying whose; 3, the tenant and the connection are not links.
- Needs: the CRM's name for the connection, from `connectionById` through `crmName`, as engine/attention.ts already reads the tenant (the words are under engine/attention.ts).

### "The last 24 hours", description · Overview
- Now: "Records written, pulls, bells, and what the sites reported, hour by hour."
- Target: "How many records Core saved in each of the last 24 hours, how many pages of changes the sites fetched, how often Core told a site about changes, and how many records the sites took or could not take."
- Link: none
- Why: 4, "pulls" and "bells" are the code's words.

### `SERIES` · Overview, the chart's legend and the figures under it (five texts)
- Now: "Written", "Pulls", "Bells", "Applied", "Failed"
- Target: "Records saved", "Pages fetched by sites", "Sites told of changes", "Records the sites took", "Records the sites could not take"
- Link: none
- Why: 4, "Pulls" and "Bells" are the code's words; 5, "Written", "Applied" and "Failed" do not say of what. A site's fetch counts once per page of one kind of record, so the label says pages to stay true.

### "What Core holds", description · Overview
- Now: "1 of 2 tenants licensed."
- Target: "The records on the sites now, for every tenant together. {a} of the {t} tenants {has | have} an active licence. A tenant's sites keep what they show and get no changes while the tenant has no active licence." Rendered: "The records on the sites now, for every tenant together. 1 of the 2 tenants has an active licence. A tenant's sites keep what they show and get no changes while the tenant has no active licence."
- Link: "tenants" to /tenants
- Why: 4, "licensed" stands without a verb; 1, what a missing licence means for the sites is not said.

### "What Core holds", the rows · Overview (one template)
- Now: "property 1 234", "agent 56", "association 3", by the code's words
- Target: "Homes 1 234", "New-build projects 12", "Agents 56", "Offices 4", "Areas 30", "Housing cooperatives 3", each word a link to Records for that kind. engine/admin/words.ts already has the words.
- Link: /records?datatype=property, and so on for each kind
- Why: 2, the code's words; 3, no link.

### "What Core holds", empty state · Overview (two texts)
- Now: "Core holds no records yet.", with the button "Make the first tenant" and nothing beside it
- Target: "Core holds no records yet. Core fetches records once a tenant has a CRM connection whose login works." Beside the button, through `Explained`: "Opens a new tenant's page. The tenant's name, its CRM login and its sites are filled in and saved there."
- Link: /tenants/new, as now
- Why: 1, how records arrive is not said; the button does not explain itself beside it (definition of done 4).
- Needs: none in code; journeys.spec.ts line 53 clicks "Make the first tenant", which stays.

### "Running now" · Overview, card "What Core holds" (one template)
- Now: "recompute #12 — running, 340 of 1 234"
- Target: running: "A recompute of {scope} is running. {examined} of {total} records are done." Waiting: "A recompute of {scope} waits to start. Core runs one recompute at a time." Rendered: "A recompute of the homes of Kowboy test account is running. 340 of 1 234 records are done."
- Link: none, since no other page shows a recompute
- Why: 2, "#12" is an internal number, and the scope is not said; 4, the dash.
- Needs: `describeScope` (engine/admin/scope.ts) names a tenant by its number and an office by its id ("the homes of office id M31529 of tenant 1"). It needs their names, which the scope picker's own call already reads (`scopeOptions`).

### "The sites", description · Overview
- Now: "When each site last pulled, and how the last bell went."
- Target: "When each site last fetched its changes, and how the site answered the last time Core told it about changes. A site that refuses the call most likely holds another bell secret than its tenant's page shows."
- Link: none
- Why: 4, "pulled" and "bell" are the code's words.

### "The sites", the site cell · Overview, column "Site"
- Now: "v4-staging (Cloudways)", linking to the top of the tenant's page
- Target: the same name, linking to the site's block
- Link: /tenants/1#site:2
- Why: 3, the link does not open the site.

### "The sites", the tenant cell · Overview, column "Tenant"
- Now: "Kowboy test account", plain text
- Target: the same name, as a link
- Link: /tenants/1
- Why: 3, no link.

### "The sites", column "On" and its values · Overview (two texts)
- Now: "On", with the badge "yes" or "no"
- Target: "On or off", with the badge "On" or "Off", the words of the site's badge on its tenant's page
- Link: none
- Why: 2, the tenant's page says on and off for the same switch; 5, "On" alone does not say what is on.
- Needs: if question 180 item 6 is approved, the switch leaves Core, and this column goes with it.

### "The sites", column "Last pull" · Overview
- Now: "Last pull"
- Target: "Last fetch"
- Link: none
- Why: 4, the glossary says fetch, never pull.

### "The sites", column "Last bell" · Overview
- Now: "Last bell"
- Target: "Last told of changes"
- Link: none
- Why: 4, the glossary never says bell in a label or a sentence.

### "The sites", column "It answered" and its values · Overview (two texts)
- Now: "It answered", with the values "ok", "http 401", "failed" and "—"
- Target: "Its answer", with the values "Answered", "Refused" (codes 401 and 403), "Error code {code}" (any other code), "No answer" (the call timed out or the site could not be reached) and "Not told yet"
- Link: none
- Why: 2, "http 401" is a code; 4, "—" stands for words.

### "The sites", empty state · Overview (two texts)
- Now: "No site is linked yet.", with the button "Make a tenant with a site" and nothing beside it
- Target: "No site yet. A site is added on its tenant's page, under Tenants." Beside the button, through `Explained`: "Opens a new tenant's page. The site is added there, with its name and the address Core calls to tell it about changes, and saved with the tenant."
- Link: "Tenants" to /tenants; the button to /tenants/new, as now
- Why: 4, "linked" is a term; the button does not explain itself beside it.

## engine/health.ts

Today every place shows a check's name and its detail. The map below replaces both in every place.

### The map from a check to its words · the tile, /v1/health, the event sentence, "Needs attention", the alert (proposed; not counted)
- Now: the tile "subscribers", "red", "1 site(s) have not pulled for an hour"; the event "the check subscribers turned red: …"; the line under "Needs attention" "a site stopped pulling — …"; the mail's subject "Core staging: 1 check(s) failing"
- Target: one entry per check, in one map in engine/health.ts, read by all four places. Each entry holds the check's title, its level, its green sentence and its red sentence. The red sentence holds counts and plain words, and it is the only text /v1/health shows. A red check that names things (sites, connections, offices) has its own sentences for each thing: what happened, what it means for the sites, and what to do, with the names linked. The tile shows them, the problem's start event keeps them, the line under "Needs attention" shows them with "Still open." or "Resolved at …", and the alert mails them. A problem's end is told in its start's words, marked resolved.
- Link: per thing, as AGENTS.md says
- Why: 2, the check's name stands where its title belongs, in every place.
- Needs: M for an adapter's checks; S.

| Check today | Title | Level | Green sentence |
| --- | --- | --- | --- |
| database | Core's database | Core down | Core reaches its database. |
| schema | Core's version and its database | Core down | The database fits the version of Core that is running. |
| worker | Core's background worker | Core down | Core's background worker is running. The worker fetches from the CRMs, tells the sites about changes, sends the alerts and runs each CRM's own checks. |
| subscribers | Sites fetching their changes | Disrupted, for each site | Every site fetched within an hour the changes Core told it about. |
| lifecycle | Tasks asked for in the admin area | To look at; Disrupted after an hour | Every task asked for in the admin area more than five minutes ago is done. |
| submissions.failing | Sending forms to the CRMs | To look at | The last form sent through each CRM connection was delivered, or refused by the CRM. |
| vitec.catch_up, the login | Vitec logins saved | Disrupted | Every Vitec connection has a username and a password saved. |
| vitec.catch_up, no offices | Vitec offices on the sites | To look at | Every Vitec connection has at least one office on the sites. |
| vitec.catch_up, 13 hours | Catch-up with Vitec | Disrupted | Every Vitec connection caught up with Vitec in the last 13 hours. A catch-up asks Vitec for every change since the last one, in case a notification went missing. Core catches up every 12 hours. |
| vitec.catch_up, a restart | Catching up after a restart | For information | Core has caught up with Vitec since its last restart. |
| vitec.offices | Offices Vitec refuses | To look at | Vitec lets the login read every office on the sites. |
| vitec.connect | Vitec answering | To look at; Disrupted after an hour | Core has not stopped asking Vitec for any Vitec connection. |
| vitec.webhook_lag | Vitec's notifications | To look at; Disrupted after an hour | No notification from Vitec has waited more than five minutes. |
| vitec.retries | Fetching from Vitec | To look at | No record has failed three fetches from Vitec in a row. |
| a check that cannot run | its own title | To look at; Disrupted after 15 minutes | its own green sentence |

### `database`: title, green state and red sentence · Overview tile; /v1/health; mail (three texts)
- Now: "database"; "ok", with no sentence; red, the error itself, such as "Error: connect ETIMEDOUT 10.110.0.4:25060"
- Target: the title "Core's database". Green: "Core reaches its database." Red: "Core cannot reach its database. Until then, the sites keep what they show and get no changes. Core cannot take any form a visitor sends meanwhile. The visitor sees an error. Core carries on by itself once the database answers. The database runs at DigitalOcean, which hosts Core. If this lasts more than a few minutes, have the database looked at there. What failed: {error}." /v1/health shows only the first sentence, without the error.
- Link: none, since nothing in the admin area fixes it
- Why: 1, a raw error with no meaning and no next step; 2, the check's name as its title, and the error, with the database's internal address, is public on /v1/health.
- Needs: H. While the database is down, the Overview cannot load and Core cannot mail. /v1/health then answers `{"error":"internal error"}` instead of its checks, because `adapterChecks()` reads the recorded checks outside `run()`. The outside monitor of question 173 still sees the 500, but no sentence. Whether /v1/health should answer the database check itself then is a decision.

### `schema`: title, green state and red sentence · Overview tile; /v1/health; mail (three texts)
- Now: "schema"; "ok"; "the database is ahead of this app: 015_health_levels.sql"
- Target: the title "Core's version and its database". Green: "The database fits the version of Core that is running." Red: "The running version of Core is older than its database. A newer version changed the database in {one way | n ways} that this version does not know. Until the newest version runs again, Core runs on a database it was not built for. Deploy the newest version again. Settings shows the version running and the changes the database holds." Rendered: "The running version of Core is older than its database. A newer version changed the database in one way that this version does not know. …"
- Link: "Settings" to /settings
- Why: 2, "schema", "this app" and a file name; 1, no meaning and no next step.
- Needs: H, for who deploys. Unclear what the platform does meanwhile: /v1/ready fails with this check, so a new copy of this version is not taken into service, but the code does not say what happens to a copy already running.

### `worker`: title, green state and red sentences · Overview tile; /v1/health (four texts)
- Now: "worker"; "ok"; "the worker has never reported in", or "last heartbeat 412 s ago"
- Target: the title "Core's background worker". Green: as in the map. Red, late: "Core's background worker has not reported for {7 minutes}. Until the worker runs again, no change from a CRM reaches the sites. Core sends no alert about its checks meanwhile. Each CRM's own checks do not run either. The sites keep what they show. Forms still reach the CRMs. The worker runs at DigitalOcean, which hosts Core. Have the worker restarted there if it has stopped." Red, never: the same, opening "Core's background worker has never reported." /v1/health shows the first sentence.
- Link: none
- Why: 2, "heartbeat" and seconds; 1, nothing on what stops, what still works, or what to do.
- Needs: H. Core cannot mail this problem, since the worker sends the mail; only the outside monitor of question 173 sees it, through /v1/health.

### `subscribers`: title, green state, red sentence and names · Overview tile; /v1/health; Needs attention; mail (four texts)
- Now: "subscribers"; "ok"; "1 site(s) have not pulled for an hour", with the names "v4-staging (Cloudways)"
- Target: the title "Sites fetching their changes". Green: as in the map. Red, public: "{One site has | n sites have} not fetched the changes Core told {it | them} about more than an hour ago." Each site: "{tenant}'s site {site} has not fetched the changes Core told it about at {time}. Until the site fetches, its visitors see the site as it was before these changes. {Its answer} {What to do}", by the site's last answer to Core:
  - refused (401 or 403): its answer "The site refused Core's call, most likely because the bell secret in the site differs from the one on {tenant}'s page.", then what to do "Press “Copy” beside the site's bell secret on {tenant}'s page, and paste the secret into the site."
  - no answer: its answer "The site did not answer when Core told it about the changes.", then what to do "Check that the site opens in a browser. A site that does not open is down at its host."
  - another code: its answer "The site answered Core's call with an error, code {code}.", then what to do "Check that the site opens in a browser. Then read “What this site reported going wrong” under the site on {tenant}'s page."
  - answered: its answer "The site answered Core's call but has not fetched since.", then what to do "Read “What this site reported going wrong” under the site on {tenant}'s page."
  Rendered: "Kowboy test account's site v4-staging (Cloudways) has not fetched the changes Core told it about at 21:37. Until the site fetches, its visitors see the site as it was before these changes. The site refused Core's call, most likely because the bell secret in the site differs from the one on Kowboy test account's page. Press “Copy” beside the site's bell secret on Kowboy test account's page, and paste the secret into the site."
- Link: the site to /tenants/1#site:2; "Kowboy test account's page" to /tenants/1
- Why: 2, "subscribers" and "pulled"; 4, "site(s)" and a name in brackets; 1, nothing on what visitors see or what to do; 5, red today for a quiet site with nothing to fetch.
- Needs: the site's last answer (`last_bell_status`) on the check, and the first time Core told the site of changes after its last fetch, from the `bell` events, as Step 3 plans; S. The new tenant page does not show what a site reported (question 180), so the last two steps need a page that shows it.

### `lifecycle`: title, green state and red sentence · Overview tile; /v1/health; mail (three texts)
- Now: "lifecycle"; "ok"; "2 lifecycle event(s) waiting for the worker"
- Target: the title "Tasks asked for in the admin area". Green: "Every task asked for in the admin area more than five minutes ago is done." Red: "{One task | n tasks} asked for in the admin area {is | are} not done after five minutes. Such a task is, for example, loading a new connection or fetching records again. Core's background worker carries out one task after another, and a large one can take a while. Until a task is done, the sites do not show what it brings. Nothing to do yet." After an hour: the same with "not done after an hour", and the last sentence unclear (below).
- Link: none, since no page shows these tasks
- Why: 2, "lifecycle event" and "the worker" are the code's words; 4, "event(s)"; 1, nothing on what it means or what to do.
- Needs: which task waits and for which connection, from the same table, so the line can name the connection and its tenant. Unclear what a person does once a task has waited an hour: a large load may still be running, or the worker may be stuck on it.

### `submissions.failing`: title, green state, red sentence and names · Overview tile; /v1/health; mail (four texts)
- Now: "submissions.failing"; "ok"; "1 connection(s) whose latest form submission the CRM did not answer", with the names "vitec-2"
- Target: the title "Sending forms to the CRMs" (the Forms list's). Green: "The last form sent through each CRM connection was delivered, or refused by the CRM." Red, public: the Forms list's words, with "turns green" written "shows fine again": "The last form a visitor sent through one CRM connection could not be sent. Send that form again on Failed forms once the cause shown there is fixed. The check shows fine again when the CRM answers a form through that connection." Each connection: "The last form a visitor sent through {connection} could not be sent. The visitor was shown an error. Failed forms keeps the form for 30 days, with what the visitor wrote. Press “Send again” beside the form on Failed forms once the cause shown there is fixed." Rendered: "The last form a visitor sent through Kowboy test account's Vitec connection, short name vitec-2, could not be sent. The visitor was shown an error. …"
- Link: the connection to /tenants/1#connection:vitec-2; "Failed forms" to /forms
- Why: 2, the check's name and a short name alone; 4, "connection(s)"; 1, no next step.
- Needs: the tenant and the CRM of each short name, which the engine looks up itself, as engine/attention.ts does. On staging, where Core holds every form back, the green sentence adds "or held back, since only production sends forms to a CRM". The Forms list's green sentence, "Each CRM answered the last form sent through its connection.", is false on staging, where no CRM is asked.

### `adapterChecks()`: "no report for" · Overview tile; /v1/health (one text)
- Now: "no report for 312 s"
- Target: while Core's background worker is down, grey and counted under the worker: "This check has not run for {5 minutes}, because Core's background worker, which runs it, is not running. The check “Core's background worker” says what to do." Otherwise: "This check has not run for {5 minutes}, although Core's background worker is running. Until the check runs, Core cannot tell whether anything it watches is wrong. If this lasts 15 minutes, have the worker restarted at DigitalOcean."
- Link: none
- Why: 4, seconds, and "report" is not the reader's word; 1, nothing on what it means or what to do.
- Needs: unclear remedy. The worker runs each CRM's checks every 30 seconds, so a check without a report while the worker runs points to the worker stuck in that check; the code does not say what fixes it. H. acceptance/restore.test.ts line 162 looks for "no report for" (T).

### `run()`: a check that cannot run · Overview tile; /v1/health; mail (one text)
- Now: the error itself, such as "error: canceling statement due to statement timeout"
- Target: public: "This check could not run." On the tile and in the mail: "This check could not run. Core cannot tell whether anything it watches is wrong until it runs. Core tries the check again within a minute. What failed: {error}."
- Link: none
- Why: 1, a raw error with no meaning; 2, code text, which /v1/health shows to anyone.
- Needs: the error kept out of `detail`, which /v1/health shows to anyone. Unclear what a person does once it lasts 15 minutes.

## adapters/vitec/index.ts (the health checks)

The checks the Vitec code registers through `healthCheck`, as question 172 splits them. The split, the names and the levels are the Vitec thread's to build; the titles and sentences are proposed here. Each needs M: the title, and each thing's sentences with `{tenant}`, `{connection}` and `{office}` for the engine to fill in and link. Without M, the Vitec code has a connection's short name and its tenant's number, but not the tenant's name or any link. The Vitec list's D2 covers the check names that adapters/vitec/admin/directions.test.ts requires in the setup steps. The Vitec list's words are used: notification, catch-up, stopped asking, refused, fetch list, “Fetch offices”, “Ask Vitec again now”.

### `vitec.catch_up`: its name as the title, and its green state · Overview tile; /v1/health (two texts)
- Now: "vitec.catch_up", and "ok" with no sentence
- Target: four checks with four titles and four green sentences, as in the map: "Vitec logins saved", "Vitec offices on the sites", "Catch-up with Vitec" and "Catching up after a restart".
- Link: none
- Why: 2, the check's name; 1, "ok" does not say what is fine; 5, one tile mixes four problems of three levels.
- Needs: M; the split is question 172's, for the Vitec thread.

### `catchUpHealth()`: a login Core cannot read · Overview tile; /v1/health; Needs attention; mail (two texts)
- Now: "1 connection(s) whose login is not readable", with the names "vitec-2: login not readable"
- Target: public: "{One Vitec connection has | n Vitec connections have} no username or password saved. Core fetches nothing for {that connection | those connections}." Each connection: "{connection} has no username or password saved. Core fetches nothing for this connection. No change from Vitec reaches {tenant}'s sites through this connection. Forms that visitors send through this connection cannot be sent to Vitec until the login is complete. Type the username and the password under the connection on {tenant}'s page, press “Check the login”, then press “Save”." Rendered: "Kowboy test account's Vitec connection, short name vitec-2, has no username or password saved. Core fetches nothing for this connection. No change from Vitec reaches Kowboy test account's sites through this connection. Forms that visitors send through this connection cannot be sent to Vitec until the login is complete. Type the username and the password under the connection on Kowboy test account's page, press “Check the login”, then press “Save”."
- Link: the connection to /tenants/1#connection:vitec-2; "Kowboy test account's page" to /tenants/1
- Why: 2, "not readable" is the code's view, and the short name stands alone; 4, "connection(s)" and a colon standing for words; 1, nothing on the sites, the forms or the next step.
- Needs: M. The code finds no login when the username or the password was never saved. The tenant page saves only the fields typed, so a login saved with only the customer or group id lands here. On staging every form is held back before this point, so the forms sentence holds for production only.

### `catchUpHealth()`: no offices · Overview tile; /v1/health; Needs attention; 07:00 mail (two texts)
- Now: "1 connection(s) with no offices", with the names "vitec-2: no offices to sync". The owner: "1 connection with no offices, no link, no info? vitec-2 whats that? no link."
- Target: public: "{One Vitec connection has | n Vitec connections have} no office on the sites. Core fetches nothing for {that connection | those connections}." Each connection, by the cause in its last office check:
  - no id: "{connection} has no office on the sites, because no customer or group id is saved on the connection. Core fetches nothing for this connection. No change from Vitec reaches {tenant}'s sites through this connection. Type the customer or group id under the connection on {tenant}'s page, press “Save”, then press “Fetch offices”."
  - the id refused: "{connection} has no office on the sites, because Vitec refuses the login for the customer or group id {id}. Core fetches nothing for this connection. No change from Vitec reaches {tenant}'s sites through this connection. This happens, for example, when the password changed or the brokerage's Vitec subscription ended. Ask the brokerage. If the password changed, type the new one under the connection on {tenant}'s page, press “Check the login”, then press “Save”."
  - no office readable: "{connection} has no office on the sites, because Vitec lists no office that the login can read behind the customer or group id {id}. Core fetches nothing for this connection. No change from Vitec reaches {tenant}'s sites through this connection. The card “Offices Vitec lists”, under the connection on {tenant}'s page, shows Vitec's answer for each office. Ask the brokerage which offices the login should read."
  - Vitec did not answer: "{connection} has no office on the sites yet, because Vitec did not answer when Core asked for the offices. Core asks Vitec again within the hour. Nothing to do unless this lasts longer."
  - not asked yet: "{connection} has no office on the sites yet, because Core has not asked Vitec for the offices yet. Core asks within a minute. Nothing to do."
  Rendered, the owner's example: "Kowboy test account's Vitec connection, short name vitec-2, has no office on the sites, because Vitec lists no office that the login can read behind the customer or group id G2. Core fetches nothing for this connection. No change from Vitec reaches Kowboy test account's sites through this connection. The card “Offices Vitec lists”, under the connection on Kowboy test account's page, shows Vitec's answer for each office. Ask the brokerage which offices the login should read."
- Link: the connection to /tenants/1#connection:vitec-2; "Kowboy test account's page" to /tenants/1
- Why: 2, the check's name and the short name alone; 3, no link; 1, no cause, no meaning and no next step; 4, "connection(s)" and a colon standing for words.
- Needs: M; the cause, which the connection's last office check holds (`lastCheck`).

### `catchUpHealth()`: not caught up for 13 hours, and never caught up · Overview tile; /v1/health; Needs attention; mail (four texts)
- Now: "1 connection(s) not caught up for over 12 h", with the names "vitec-2: last catch-up 14 h ago"; and "1 connection(s) never caught up", with "vitec-2: never caught up"
- Target: public: "{One Vitec connection has | n Vitec connections have} not caught up with Vitec for more than 13 hours." and "{One Vitec connection has | n Vitec connections have} never caught up with Vitec." Each connection: "{connection} last caught up with Vitec {14 hours} ago. A change made in Vitec since then has reached {tenant}'s sites only if Vitec's notification of it arrived. Press “Catch up now” beside the connection on the Vitec page." Never: "{connection} has never caught up with Vitec. A change made in Vitec reaches {tenant}'s sites only if Vitec's notification of it arrives. Press “Catch up now” beside the connection on the Vitec page." While Core has stopped asking Vitec for the connection, the last sentence reads instead: "Core has stopped asking Vitec for this connection after failed calls, and catches up by itself once Vitec answers. Nothing to do."
- Link: the connection to /tenants/1#connection:vitec-2; "the Vitec page" to /crms/vitec
- Why: 5, the words say 12 hours where the code waits 13; 2, the short name alone; 4, "connection(s)", "h" and a colon; 1, nothing on what the sites miss or what to do.
- Needs: M.

### `catchUpHealth()`: catching up after a restart · Overview tile; /v1/health (one text)
- Now: "catching up since the worker started", put in front of any other count: "catching up since the worker started; 1 connection(s) with no offices"
- Target, on /v1/health too: "Core is catching up with Vitec after a restart. Core asks Vitec for every change since its last catch-up, and fetches each one. Nothing to do. The check shows fine once Core has caught up, usually within minutes."
- Link: none
- Why: 2, "the worker"; 1, it does not say that nothing is to be done; 4, a semicolon joins two checks.
- Needs: the restore runbook reads the words "catching up", which stay. adapters/vitec/vitec.test.ts line 406 looks for "since the worker started" (T).

### `vitec.offices`: title, green state, red sentence and names · Overview tile; /v1/health; Needs attention; 07:00 mail (four texts)
- Now: "vitec.offices"; "ok"; "1 office(s) refused by Vitec; only the daily office check asks about them", with the names "M31529: refused 3 h ago"
- Target: the title "Offices Vitec refuses". Green: "Vitec lets the login read every office on the sites." Red, public: "Vitec does not let the login read {one office | n offices} on the sites. Core has stopped fetching {that office | those offices}." Each office: "Vitec has not let the login read {office} since {time}. Core has stopped fetching the office. The office's homes on {tenant}'s sites are not updated meanwhile. If Vitec still refuses the office at the next daily office check, the office, its homes and its new-build projects leave the sites, and its agents stay. This happens, for example, when the brokerage's Vitec subscription for the office ended or the password changed. Ask the brokerage. Once Vitec lets the login read the office again, press “Fetch offices” under the connection on {tenant}'s page." Rendered: "Vitec has not let the login read Kowboy test account's office Norban Mäkleri, the CRM's office id M31529, since 15:12. Core has stopped fetching the office. The office's homes on Kowboy test account's sites are not updated meanwhile. If Vitec still refuses the office at the next daily office check, the office, its homes and its new-build projects leave the sites, and its agents stay. This happens, for example, when the brokerage's Vitec subscription for the office ended or the password changed. Ask the brokerage. Once Vitec lets the login read the office again, press “Fetch offices” under the connection on Kowboy test account's page."
- Link: the office to /records?tenant=1&office=M31529; "under the connection" to /tenants/1#connection:vitec-2; "Kowboy test account's page" to /tenants/1
- Why: 2, the check's name and an id alone; 4, "office(s)", "h", a semicolon and a colon; 1, nothing on what the sites show or what to do.
- Needs: M, with one thing per connection that fetches the office (`concerned`); the office's name, from the connection's last office check (`lastCheck`). An office of Vitec's QA environment keeps "(QA)" after its id. D1.

### `vitec.connect`: title, green state, red sentence and names · Overview tile; /v1/health; Needs attention; mail (four texts)
- Now: "vitec.connect"; "ok"; "1 connection(s) paused after 5 failures in a row", with the names "vitec-2: paused for another 12 min"
- Target: the title "Vitec answering". Green: "Core has not stopped asking Vitec for any Vitec connection." Red, public: "Core has stopped asking Vitec for {one Vitec connection | n Vitec connections} for a while, after five calls in a row failed." Each connection: "Core stopped asking Vitec for {connection} after five calls in a row failed. Core asks Vitec again by itself at {time}. Until Vitec answers, no change from Vitec reaches {tenant}'s sites through this connection. Nothing to do while Vitec is down. Once Vitec answers again, “Ask Vitec again now” beside the connection on the Vitec page asks at once." After an hour, before the last sentence: "Core has not reached Vitec for this connection for more than an hour. Ask Vitec whether its service works." Rendered: "Core stopped asking Vitec for Kowboy test account's Vitec connection, short name vitec-2, after five calls in a row failed. Core asks Vitec again by itself at 21:52. …"
- Link: the connection to /tenants/1#connection:vitec-2; "the Vitec page" to /crms/vitec
- Why: 2, "paused" is the tenant page's word for a person's pause, and the short name stands alone; 4, "connection(s)" and "min"; 1, nothing on the sites or what to do.
- Needs: M. The button's new name is the Vitec list's; it reads “Resume now” today.

### `vitec.webhook_lag`: title, green state and red sentence · Overview tile; /v1/health; Needs attention; mail (three texts)
- Now: "vitec.webhook_lag"; "ok"; "a webhook has waited 412 s"
- Target: the title "Vitec's notifications". Green: "No notification from Vitec has waited more than five minutes." Red: "The oldest notification from Vitec that Core has not acted on arrived {7 minutes} ago. The change or removal it tells of does not show on the sites yet. Core keeps trying by itself. The fetch list on the Vitec page shows what waits, with Vitec's last answer for each record." After an hour: "… arrived more than an hour ago. …", ending "When “Vitec answering” or “Offices Vitec refuses” is red too, that check says what to do."
- Link: "the Vitec page" to /crms/vitec
- Why: 2, "webhook"; 4, seconds; 1, nothing on the sites or what to do.
- Needs: M, with the connection and the record that the oldest notification is for, so the line can name the connection and link the record. Unclear what a person does when it lasts an hour and neither of those checks is red. Unclear whether a notification held back for a refused office counts, since the check reads every notification still due on the fetch list.

### `vitec.retries`: title, green state and red sentence · Overview tile; /v1/health; Needs attention; 07:00 mail (three texts)
- Now: "vitec.retries"; "ok"; "2 record(s) failed 3 fetches in a row"
- Target: the title "Fetching from Vitec". Green: "No record has failed three fetches from Vitec in a row." Red: "{One record has | n records have} failed three or more fetches from Vitec in a row. The sites show {that record | those records} as before, or not at all when new. Core tries each record up to six times, then gives it up. The fetch list on the Vitec page shows each record with Vitec's last answer. “Retry now” beside a record fetches it again. “Drop” takes the record off the list."
- Link: "the Vitec page" to /crms/vitec
- Why: 2, the check's name; 4, "record(s)" and a digit standing alone; 1, nothing on the sites or what to do.
- Needs: M, with one thing per connection, so the line names the connection, as question 172 asks (one line per connection per day).

## engine/attention.ts

### `KINDS` titles · Overview, Needs attention; the mail's subject (four texts)
- Now: "an office was taken off the sites", "a connection paused after failures", "the CRM refuses a login", and for the sites check "a site stopped pulling"
- Target: as a line's title: "Office taken off the sites", "Core stopped asking a CRM after failures" (the Vitec list's words), "Login refused by the CRM", and for a check, its title from the map ("Sites fetching their changes"), so every check can be a kind. As a mail's subject: the event's first sentence (under engine/alerts.ts).
- Link: none
- Why: 2, "paused" is the tenant page's word for a person's pause, and "pulling" is not the area's word; 4, lower-case fragments where a title belongs.
- Needs: M, for the check's title.

### `places()`: the thing in words · Overview, column "Which, and where"; the mail (six texts)
- Now: "office Norban Mäkleri (M31529)"; "office M31529" when the event has no name; "connection vitec-2"; "site v4-staging (Cloudways)"; "site v4-staging (Cloudways)" opening Tenants when the check kept only names; "a site" when it kept no names either
- Target: "{tenant}'s office {name}, the CRM's office id {id}"; "{tenant}'s office with the CRM's office id {id}"; "{tenant}'s {CRM} connection, short name {short name}"; "{tenant}'s site {site}"; "The site {names}. This line does not say which tenant the site belongs to, so the link opens Tenants."; "A site Core did not name. Tenants lists every site." Rendered: "Kowboy test account's office Norban Mäkleri, the CRM's office id M31529"; "Kowboy test account's Vitec connection, short name vitec-2"; "Kowboy test account's site v4-staging (Cloudways)"
- Link: as today, and the tenant's name to /tenants/1 as well
- Why: 2, a type word stands before each name, the tenant is missing, and an id sits in brackets with nothing saying whose; 4, "a site" is not a whole thought.
- Needs: the CRM's name for a connection (`connectionById`, its provider through `crmName`).

## engine/alerts.ts

### `tellChanges()`: the mail when a check turns red · mail and Slack (four texts: the subject, the place line, `which()`, the address at the end)
- Now, whole:
  - Subject: "Core staging: 1 check(s) failing"
  - Body: "the check subscribers turned red: 1 site(s) have not pulled for an hour (v4-staging (Cloudways))", then "site v4-staging (Cloudways), tenant Kowboy test account: https://staging.core.kowboy.cloud/admin/tenants/1#site:2", then a blank line, then "https://staging.core.kowboy.cloud/v1/health"
- Target, whole:
  - Subject: "Core staging: Kowboy test account's site v4-staging (Cloudways) has not fetched the changes Core told it about at 21:37"
  - Body: "Kowboy test account's site v4-staging (Cloudways) has not fetched the changes Core told it about at 21:37. Until the site fetches, its visitors see the site as it was before these changes. The site refused Core's call, most likely because the bell secret in the site differs from the one on Kowboy test account's page. Press “Copy” beside the site's bell secret on Kowboy test account's page, and paste the secret into the site.", then a blank line, then "The site v4-staging (Cloudways), on Kowboy test account's page: https://staging.core.kowboy.cloud/admin/tenants/1#site:2", then "Everything Core checks, on the Overview: https://staging.core.kowboy.cloud/admin/"
  - Several problems due in one round: the subject "Core staging: 3 problems disrupt customers' sites or forms", then each problem's sentences and lines in turn. In Slack, each name is a link written `<address|name>`, so the post reads as the mail does.
- Link: the site's block and the Overview, as above
- Why: 2, the check's name; 4, "check(s)", "site(s)" and a bare address; 1, nothing on what visitors see or what to do; 5, /v1/health is the monitor's answer and leaves the names out.
- Needs: M; S (rule A mails a P1 problem once it has lasted 15 minutes; rule B puts the starts of one round in one mail).

### `tellChanges()`: the mail when checks turn green · mail and Slack (one text: the subject; the body is the sentence of `check.recovered`, under engine/admin/summary.ts)
- Now, whole: the subject "Core staging: all checks green again"; the body "the check subscribers is green again", then a blank line, then "https://staging.core.kowboy.cloud/v1/health"
- Target, whole: the subject "Resolved on Core staging: Kowboy test account's site v4-staging (Cloudways) has not fetched the changes Core told it about at 21:37"; the body "Resolved at 23:52, after 1 hour and 15 minutes: “Kowboy test account's site v4-staging (Cloudways) has not fetched the changes Core told it about at 21:37.” Nothing to do.", then a blank line, then "The site v4-staging (Cloudways), on Kowboy test account's page: https://staging.core.kowboy.cloud/admin/tenants/1#site:2", then "Everything Core checks, on the Overview: https://staging.core.kowboy.cloud/admin/"
- Link: as above
- Why: 5, "all checks green again" is written from this minute's changes alone, so it is false while another check stays red; 2, the check's name.
- Needs: S (rule C, the end told in the start's words; rule D, an end mailed only when its start was).

### `opened()`: without Core's own address · mail and Slack (one text)
- Now: "the admin area, /tenants/1#site:2"
- Target: "on Kowboy test account's page in Core's admin area, under the site v4-staging (Cloudways)"
- Link: none, since Core does not know its own address here
- Why: 4, a path stands for words.

### `tellEvent()`: the mail of an office taken off, Core's pause and a refused login · mail and Slack (four texts: the subject, "Which:", "What happened:", "Open it:")
- Now, whole, for an office:
  - Subject: "Core staging: an office was taken off the sites"
  - Body: "Which: office Norban Mäkleri (M31529), tenant Kowboy test account, connection vitec-2", then "What happened: office M31529 was taken off the sites: Vitec still refused it at the next daily check", then "Open it: https://staging.core.kowboy.cloud/admin/records?tenant=1&office=M31529&deleted=true"
  - For a pause: the subject "Core staging: a connection paused after failures", with "What happened: the connection paused after 5 failures in a row: VitecError: Advertising/Estate/M31529/OBJ31529_2041198534: HTTP 503 <html>…". For a refused login: the subject "Core staging: the CRM refuses a login", with "What happened: the CRM refuses the login: Vitec refuses this login for G2".
- Target, whole, for an office:
  - Subject: "Core staging: Kowboy test account's office Norban Mäkleri was taken off the sites"
  - Body: "Kowboy test account's office Norban Mäkleri, the CRM's office id M31529, was taken off the sites at 18:41. Vitec has refused for a day to let this login read the office. Its homes, its new-build projects and the office itself left the sites, and its agents stay. This happens, for example, when the brokerage’s Vitec subscription for the office ended or the password changed. Ask the brokerage. When Vitec lets the login read the office again, the office comes back at the next daily check, or within a minute after “Fetch offices” on the tenant’s page.", then a blank line, then "Norban Mäkleri's removed records, on Records: https://staging.core.kowboy.cloud/admin/records?tenant=1&office=M31529&deleted=true", then "Kowboy test account's Vitec connection, short name vitec-2: https://staging.core.kowboy.cloud/admin/tenants/1#connection:vitec-2"
  - The sentences after the first are the Vitec list's reason. The offices taken off for one reason in one go (one correlation id) make one mail naming every office. An office taken off by choice, such as one taken out of the office group “Webbplats”, is to look at, and goes in the 07:00 mail instead.
  - For a pause: no mail at the pause. Its line goes in the 07:00 mail, in the words of `connection.paused` under engine/admin/summary.ts, and the check “Vitec answering” mails it once Core has not reached Vitec for an hour.
  - For a refused login: the subject "Core staging: Vitec refuses Kowboy test account's login", the body the sentence of `login.refused` under engine/admin/summary.ts, then "Kowboy test account's Vitec connection, short name vitec-2: https://staging.core.kowboy.cloud/admin/tenants/1#connection:vitec-2".
- Link: the office's removed records and the connection's block, as above
- Why: 2, "Which:" strings labels and ids in brackets, and the subject is a lower-case title; 1, nothing on what the sites lose or what to do; 4, colons stand for words.
- Needs: R; S (the levels of the three kinds, the 07:00 mail, one mail per correlation id); D1.

### The 07:00 mail · mail and Slack (planned by Step 3 and not built yet, so not counted)
- Now: none
- Target: the subject "Core staging: {One thing | n things} to look at since yesterday's mail". The body opens "Nothing below disrupts a customer's sites or forms. Each line needs a look when there is time.", then each problem or event with its title, its sentences and its links, in the words of this list, and closes "All of them, on the Overview under Needs attention: https://staging.core.kowboy.cloud/admin/". Rendered subject: "Core staging: 2 things to look at since yesterday's mail"
- Link: the Overview, and each name to its place
- Why: written ahead, so the mail is built in these words.
- Needs: S.

## engine/admin/summary.ts

Each sentence shows on a record's page (its timeline), in Flow (`entity.*` and `site.*`), under "Needs attention" and in the alerts (the kinds), and in the live stream. The Events page shows each event's type and fields today, not its sentence; the glossary's rule, a sentence for what happened and never its type, asks it to show the sentence. Every target needs R. `job.cancelled` and `admin.job_cancelled` are no longer written (cancel went in 37d0358), so they are left out. The form sentences are the Forms list's, repeated so this file holds every text of summary.ts. Where the Vitec list's detail for `fetch.failed` or `schedule.failed` already opens with what happened, the two lists settle together whether the engine's first sentence or the detail's goes.

### `'entity.written'` · a record's page; Flow
- Now: a first version, rendered from the for-sale golden payload, "written: electricity, extensions, id, inspection, links, pledges and 64 more"; a new version "written: price, display.price"; a record saved again with no field changed "written, first version"; a recompute "recomputed: display.price"
- Target: the first version: "Saved for the first time." A new version: "Saved a new version from the CRM, with {one field | n fields} changed." A recompute: "Recomputed, with {one field | n fields} changed." No field changed: "Saved again with no field changed. Either the record came back to the CRM's list, or Core's rules changed since the record was last saved." Rendered: "Saved a new version from the CRM, with 2 fields changed."
- Link: none
- Why: 2, field names are the code's ("display.price"); 5, "first version" shows for a record saved again, while a real first version lists every field that has a value, in the CRM's own field names.
- Needs: a reader's label for each field, which Core does not have; until then, the count. Telling "came back" from "rules changed" needs one more field on the event, a register line.

### `'entity.unchanged'` · a record's page; Flow
- Now: "fetched from the CRM, identical to what Core held"
- Target: "Fetched from the CRM again, with nothing changed. No site was told."
- Link: none
- Why: 4, a fragment; 1, it does not say that nothing reached the sites.

### `'entity.tombstoned'` · a record's page; Flow
- Now: "removed: the CRM no longer lists it"
- Target: "Removed from the sites. Each site takes the record off when it next fetches its changes. Core keeps the removed record for 90 days."
- Link: none
- Why: 5, the reason is false when the record left with its office, its connection or a switched login.
- Needs: the cause on the event (a field, a register line), so the sentence can say why.

### `'entity.dropped'` · a record's page; Flow
- Now: "dropped: malformed", "dropped: unlicensed", "dropped: inactive", "dropped: unknown-datatype"
- Target: malformed: "Not saved, because what the CRM sent does not fit what Core expects of {a home}. The sites keep showing the version they had. What did not fit: {detail}." Unlicensed: "Not saved, because the record belongs to an office this connection does not fetch." Inactive: "Not saved, because the connection is paused on its tenant's page. Core takes nothing from a paused connection." Unknown type: "Not saved, because Core takes no record of this kind from this CRM." No reason: "Not saved. Core gave no reason." Rendered: "Not saved, because what the CRM sent does not fit what Core expects of a home. The sites keep showing the version they had. What did not fit: the price is not a number."
- Link: none
- Why: 2, "malformed", "unlicensed" and "unknown-datatype" are the code's words; 1, nothing on the sites.
- Needs: R, for the record type; the detail in words, which the event carries in the code's words today.

### `'site.applied'` · a record's page; Flow
- Now: "a site took it (wordpress/0.9.3)"
- Target: "The site {site} took this version." Rendered: "The site v4-staging (Cloudways) took this version."
- Link: the site to /tenants/1#site:2
- Why: 2, the site is not named, and "wordpress/0.9.3" is the code's.
- Needs: R.

### `'site.failed'` · a record's page; Flow
- Now: "a site could not take it: Undefined array key “price”"
- Target: "The site {site} could not take this version. The site said: “{detail}”. Read “What this site reported going wrong” under the site on {tenant}'s page." With no detail: "The site {site} could not take this version and gave no reason."
- Link: the site to /tenants/1#site:2
- Why: 2, the site is not named; 1, no next step.
- Needs: R; the new tenant page's place for what a site reported (question 180).

### `'site.error'` · a record's page
- Now: "a site reported: cURL error 28: Operation timed out"
- Target: "The site {site} reported an error: “{message}”."
- Link: the site to /tenants/1#site:2
- Why: 2, the site is not named.
- Needs: R.

### `'submission.received'`, `'submission.delivered'`, `'submission.refused'`, `'submission.failed'` · a home's page; Failed forms (four texts)
- Now: "a visitor sent an interest in the home through a site"; "the CRM took a lead (C-2)"; "the CRM refused a viewing booking: Visningen är fullbokad"; "the CRM did not answer a lead: unavailable: v2/Advertising/Form/M30011/Valuation: HTTP 503 Service Unavailable"
- Target, the Forms list's words: "A visitor sent {form} from the site {site}."; "{Form} was delivered to the CRM, which gave it the id {id}."; "The CRM refused {form}, with the reason “{reason}”.", and for a form Core held back "Core held back {form}, since only production sends forms to a CRM."; "{Form} could not be sent to the CRM: {cause}." Rendered: "A visitor sent an interest in the home from the site v4-staging (Cloudways)."
- Link: Failed forms (/forms) while the form is kept
- Why: 2, the site is not named and the id has no owner; 5, a held-back form reads as refused by the CRM; 4.
- Needs: R; the Forms list's needs.

### `bell` · Events
- Now: "rang its sites (delta, ok)", "rang its sites (forcerefresh, http 401)", "rang its sites (delta, failed)"
- Target: answered: "Core told the site {site} about changes, and the site answered." A full fetch: "Core told the site {site} to fetch everything again, and the site answered." Refused: "Core told the site {site} about changes, and the site refused the call. The bell secret in the site most likely differs from the one on {tenant}'s page." No answer: "Core tried to tell the site {site} about changes, and the site did not answer." Another code: "Core told the site {site} about changes, and the site answered with an error, code {code}."
- Link: the site to /tenants/1#site:2
- Why: 4, "rang", "delta" and "forcerefresh" are the code's words; 2, "its sites" where one site was told.
- Needs: R.

### `pull` · Events
- Now: "a site pulled 12 record(s)"
- Target: "The site {site} fetched {12 homes}." With none: "The site {site} fetched its changes, and there were none." Rendered: "The site v4-staging (Cloudways) fetched 12 homes."
- Link: the site to /tenants/1#site:2
- Why: 4, "pulled" and "record(s)"; 2, the site is not named.
- Needs: R, with the record type from the row (`entities` in engine/admin/words.ts).

### `'alert.sent'` · Events
- Now: "alert sent: Core staging: 1 check(s) failing", also when the alert reached nobody
- Target: "Sent by mail and to Slack: “{subject}”." By one channel: "Sent by mail: “{subject}”." or "Sent to Slack: “{subject}”." One channel failed: "Sent to Slack: “{subject}”. The mail could not be sent: {error}." No channel: "Nobody was told: “{subject}”. Core has no working mail and no Slack set for alerts. Settings shows where alerts go."
- Link: "Settings" to /settings
- Why: 5, an alert that reached nobody reads as sent.

### `'office.taken_off'` · Needs attention; mail; Events
- Now: "office M31529 was taken off the sites: Vitec still refused it at the next daily check"
- Target: "{office} was taken off the sites. {the reason, in the Vitec list's words}" Rendered: "Kowboy test account's office Norban Mäkleri, the CRM's office id M31529, was taken off the sites. Vitec has refused for a day to let this login read the office. Its homes, its new-build projects and the office itself left the sites, and its agents stay. …" Without a name: "Kowboy test account's office with the CRM's office id M31529 was taken off the sites. …"
- Link: the office to /records?tenant=1&office=M31529&deleted=true
- Why: 2, the office by its id although the event carries its name, and no tenant.
- Needs: R; D1.

### `'connection.paused'` · Needs attention; 07:00 mail; Events
- Now: "the connection paused after 5 failures in a row: VitecError: Advertising/Estate/M31529/OBJ31529_2041198534: HTTP 503 <html><head><title>503 Service Temporarily Unavailable</title>…"
- Target: "Core stopped asking {CRM} for {connection} after {n} calls in a row failed. {the detail, in the Vitec list's words}" Rendered: "Core stopped asking Vitec for Kowboy test account's Vitec connection, short name vitec-2, after 5 calls in a row failed. The last call failed because Vitec’s service did not work, and Vitec’s answer code was 503. Core asks Vitec nothing for this connection until 21:42, then tries again by itself …"
- Link: the connection to /tenants/1#connection:vitec-2
- Why: 2, "paused" is the tenant page's word for a person's pause, and the detail is code with a web page in it.
- Needs: R.

### `'connection.resumed'` · Events
- Now: "the connection answers again"
- Target: "{CRM} answers again for {connection}. Core fetches for the connection as before." Rendered: "Vitec answers again for Kowboy test account's Vitec connection, short name vitec-2. Core fetches for the connection as before."
- Link: the connection to /tenants/1#connection:vitec-2
- Why: 2, neither the connection nor the CRM is named; 5, it is the CRM that answers again.
- Needs: R.

### `'login.refused'` · Needs attention; mail; Events
- Now: "the CRM refuses the login: Vitec refuses this login for G2"
- Target: "{CRM} refuses the login of {connection}. {the detail, in the Vitec list's words}" With no detail: "{CRM} refuses the login of {connection} and gave no reason." Rendered: "Vitec refuses the login of Kowboy test account's Vitec connection, short name vitec-2. Vitec no longer lets this username and password read G2, the customer or group id on the connection. …"
- Link: the connection to /tenants/1#connection:vitec-2
- Why: 2, "the CRM" and "the login" say neither which nor whose.
- Needs: R.

### `'check.failed'` · Needs attention; mail; Events
- Now: "the check subscribers turned red: 1 site(s) have not pulled for an hour (v4-staging (Cloudways))"; "the check vitec.catch_up turned red: 1 connection(s) with no offices (vitec-2: no offices to sync)"; "the check submissions.failing turned red: 1 connection(s) whose latest form submission the CRM did not answer (vitec-2)"
- Target: the problem's own sentences from the map: the thing's sentences, or the check's red sentence when it names no thing. The check's title shows beside the sentence wherever the sentence shows. Rendered: "Kowboy test account's site v4-staging (Cloudways) has not fetched the changes Core told it about at 21:37. Until the site fetches, its visitors see the site as it was before these changes. …"
- Link: the names inside, as the map says
- Why: 2, the check's name; 4, "site(s)" and names in brackets; 1, nothing on what it means or what to do.
- Needs: M, with `title` and `said` kept on the event. The Forms list proposes "{title} turned red. {detail}"; this list leaves "turned red" out, since red is the tile's colour and the level beside the line says how serious it is. Both read the same title and red sentence.

### `'check.recovered'` · Needs attention; mail; Events
- Now: "the check subscribers is green again"
- Target: "Resolved at {time}, after {duration}: “{the start's first sentence}” Nothing to do." Rendered: "Resolved at 23:52, after 1 hour and 15 minutes: “Kowboy test account's site v4-staging (Cloudways) has not fetched the changes Core told it about at 21:37.” Nothing to do."
- Link: the names inside, as at the start
- Why: 2, the check's name; 1, which problem ended is not said.
- Needs: S (rule C); M.

### `'job.queued'` · Events
- Now: "a run was queued (#12)"
- Target: "A recompute of {scope} was asked for. Core runs one recompute at a time, in the order asked." Rendered: "A recompute of the homes of Kowboy test account was asked for. Core runs one recompute at a time, in the order asked."
- Link: none
- Why: 2, "run" and "#12" are the code's.
- Needs: `describeScope` with names, as under "Running now".

### `'job.done'` · Events
- Now: "a run finished: 12 changed of 340"
- Target: "The recompute is done. {12} of the {340} records Core worked out again changed." With failures, also: "{One record | n records} could not be worked out again."
- Link: none
- Why: 2, "run"; 4, "12 changed of 340" is not a sentence.
- Needs: the scope on the event to name it, which the job's row holds.

### `'job.failed'` · Events
- Now: "a run failed: the worker stopped while running this job", or "a run failed: Error: …"
- Target: "The recompute stopped before it was done, because {cause}. The records it had already worked out again keep their new version. Ask for the recompute again on Manual sync." For a stopped worker: "The recompute stopped before it was done, because Core's background worker stopped while running it. …"
- Link: "Manual sync" to /manual-sync
- Why: 2, "run" and "the worker"; 1, no next step.
- Needs: the cause in words for any other error, which `String(error)` gives in the code's words today.

### `FORMS` · every form sentence (two texts)
- Now: "a lead", and the fallback "a form submission"
- Target, the Forms list's words: "a valuation or contact request", and "a form"
- Link: none
- Why: 2, Failed forms calls the same form by another word; 4, "submission" is a term.

### `lifecycle.*` · Events; the connection's events (one template)
- Now: "the CRM was told to connection added", "the CRM was told to resync", "the CRM was told to refetch"
- Target: connection added: "Core began loading this new connection's records from the CRM." Connection removed: "This connection was removed. Its records are removed from the sites." Offices added: "The offices with the CRM's office ids {ids} were added to this connection. Core began loading their records from the CRM." Offices removed: "The offices with the CRM's office ids {ids} were taken off this connection. Their records are removed from the sites." Fetch everything again: "Core began fetching {every record | the homes} of this connection from the CRM again." Fetch some again: "Core began fetching {12} records of this connection from the CRM again. A record the CRM no longer has is removed."
- Link: none
- Why: 5, the CRM is not told anything, the CRM's code in Core is; 4, the type read as words is not a sentence.
- Needs: R, for the record type.

### `ADMIN`: the tenant and site actions · Events (six texts)
- Now: "patric@kowboy.se forgot the other devices"; "… saved the tenant"; "… removed the tenant"; "… made a new tenant token"; "… made a new bell secret"; "… rang the sites"
- Target: "{person} signed out of {one other device | n other devices}."; "{person} saved {tenant}'s page."; "{person} removed the tenant {name}."; "{person} made a new token for {tenant}. Each of {tenant}'s sites fetches nothing until the new token is pasted into the site."; "{person} made a new bell secret for {tenant}'s site {site}. The site refuses Core's calls about changes until the new secret is pasted into it. The site still fetches its changes by itself every 15 minutes."; "{person} told every site of {tenant} about changes.", "{person} told {tenant}'s site {site} about changes." or "… to fetch everything again." Rendered: "patric@kowboy.se made a new token for Kowboy test account. Each of Kowboy test account's sites fetches nothing until the new token is pasted into the site."
- Link: the tenant to /tenants/1, the site to /tenants/1#site:2
- Why: 2, which tenant or site is not said, and "rang" is a word the glossary rules out; 1, nothing on what a new token or secret stops; 5, "forgot the other devices" is not what the button did.
- Needs: R.

### `ADMIN`: the runs, the CRM buttons and the settings · Events (five texts)
- Now: "patric@kowboy.se started a recompute"; "… asked the CRM for records again"; "… ran a CRM action"; "… tried a CRM login"; "… changed maintenance"
- Target: "{person} asked for a recompute of {scope}."; "{person} asked the CRM again for {scope}, {n records} in all."; "{person} pressed “{button}” on the {CRM} page, for {connection}."; "{person} checked a {CRM} login, and {CRM} accepted it." or "…, and {CRM} refused it."; "{person} turned maintenance on." or "… off." Rendered: "patric@kowboy.se pressed “Catch up now” on the Vitec page, for Kowboy test account's Vitec connection, short name vitec-2."
- Link: the CRM's page, /crms/vitec; the connection to /tenants/1#connection:vitec-2
- Why: 2, which scope, CRM, button or outcome is not said, although the event carries them.
- Needs: the button's label on `crm_action`, which the CRM's admin code holds; `describeScope` with names, as under "Running now".

### `ADMIN` has no `form_sent_again` · Events; a home's page
- Now: "patric@kowboy.se form sent again"
- Target, the Forms list's words: "{person} sent a form to the CRM again"
- Link: Failed forms (/forms)
- Why: 4, the type read as words is not a sentence.

### The adapter's event types without a sentence · Events; a record's page (seven texts)
- Now: "webhook received", "crm call", "fetch failed", "fetch orphan", "office blocked", "office unblocked", "schedule failed"
- Target, the engine's frame, followed by the Vitec list's detail where the event carries one:
  - `webhook.received`: a change: "The CRM sent a notification that this record changed. Core fetches the record." A removal: "The CRM sent a notification that this record left its list. Core takes the record off the sites without fetching it." Turned away: "The CRM sent a notification, and Core turned it away. {detail}" Left alone: "{detail}"
  - `crm.call`: "Core read this record from the CRM in {0.3} seconds." For a form: "Core sent the form to the CRM, which answered in {1.2} seconds." No such record: "The CRM answered that it has no such record." A failure: "Core's call to the CRM failed. {error in words}"
  - `fetch.failed`: "Core gave up fetching this record from the CRM after {6} tries. {detail}"
  - `fetch.orphan`: "Core did not fetch this record. {detail}"
  - `office.blocked`: "The CRM does not let the login read the office with the CRM's office id {id}. Core stopped fetching the office."
  - `office.unblocked`: "The CRM lets the login read the office with the CRM's office id {id} again. Core loads the office again in full."
  - `schedule.failed`: "The regular work of {connection} with the CRM failed. {detail} Core tries again within a minute."
- Link: `fetch.failed` and `schedule.failed` to the CRM's page, /crms/vitec
- Why: 2, each shows its type read as words.
- Needs: R; the CRM's name instead of "the CRM", from the adapter that logged the event, which the adapter interface knows; the office's name for `office.blocked`, which the event lacks.

## Words to settle

| Write | For | Never |
| --- | --- | --- |
| Fine, Core down, Disrupted, To look at, For information | a check's state and the levels P0 to P3, on a tile, a line under "Needs attention" and the verdict | ok, red, green, P0 to P3 |
| problem; resolved | a failing check, or each thing it names, from its start to its end; its end | issue, incident, recovered, green again |
| the 07:00 mail | the one mail each morning with what to look at | digest, summary |
| Core's background worker | the process that fetches from the CRMs, tells the sites about changes, and runs the checks and the alerts | worker alone, heartbeat, tick |
| DigitalOcean, which hosts Core | where the database and the worker run; naming the host in a text is a decision (H) | the platform, App Platform |
| task asked for in the admin area | what a save or Manual sync starts in the CRM's code: loading a new connection, fetching again, removing a connection's records | lifecycle event, delivered |
| saved; a new version | Core storing a record it fetched or recomputed | written |
| told of changes; its answer: answered, refused, error code, no answer | a site told about changes, and how it answered (the glossary's "tell a site about changes") | bell, rang, ok, http 401, failed |
| Pages fetched by sites | the chart's count of the sites' fetches, one per page of one kind of record | pulls |
| an active licence | a tenant whose sites may fetch and are told about changes | licensed |
| one, then 2, 3 and up | a number in a sentence: "one site has", "3 sites have", grouped the Swedish way (12 345) | site(s), connection(s) |
| {tenant}'s site {site}; {tenant}'s office {name}, the CRM's office id {id}; {tenant}'s {CRM} connection, short name {short name} | the order of names in a sentence, each name a link | site X, tenant Y; an id in brackets |
| notification; catch-up; stopped asking {CRM}; refused; fetch list; “Ask Vitec again now” | as the Vitec list settles them | webhook; paused for Core's own pause; blocked |
| Sending forms to the CRMs; could not be sent; held back | as the Forms list settles them | submission, failed |
