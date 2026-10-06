# The admin area

**This file describes the area as it is.** A change to a page, an action, a setting, a lifecycle
event or a health check changes this file, the area's own words and the adapter's setup directions
in the same change (AGENTS.md, definition of done, Patric 2026-09-20). The test
`adapters/vitec/admin/directions.test.ts` keeps the directions honest.

The design it was built from is [`docs/admin-panel-design.md`](admin-panel-design.md): the pattern
study, the information architecture and where every Must and Should of
[`docs/admin-panel-rebuild.md`](admin-panel-rebuild.md) §3 sits. Built on 2026-09-20 on Patric's
word, "Admin area v3 build."

## Where it is and who may open it

`/admin` on the web process, served from `dist/admin` by the same app that answers the sites
(nothing is hosted elsewhere). Customers never see it; it is Kowboy's own tool (decision
2026-09-18).

Getting in is a link mailed to an address that may open the area: no password exists to share or to
phish. Two settings say who that is — `ADMIN_EMAILS`, addresses one by one, and
`ADMIN_EMAIL_DOMAINS`, whole domains (staging and production both carry `kowboy.se`, so everyone at
Kowboy is in without a list to keep; Patric, 2026-09-21). A link is good once and for fifteen
minutes (`ADMIN_LINK_MINUTES`), and the session it makes lasts a fortnight (`ADMIN_SESSION_DAYS`)
in one cookie that script cannot read.

An address that may not open the area gets exactly the answer one that may gets, and no mail: the
sign-in page never gives away who is on the list, nor that a domain is allowed at all. On a machine
with no mail sender and no environment name — a developer's own — the link comes back in the
answer, because there is no other way in; anywhere else it is only ever mailed.

**Remember this device** on the sign-in page keeps that browser signed in for thirty days
(`ADMIN_REMEMBER_DAYS`) instead of a fortnight. Every device is a session of its own, so a person
is remembered on as many as they like, and signing out of one leaves the rest alone. Settings lists
them — which browser, remembered or not, last used, signed in until — marks the one being read, and
has one button to forget every other device, for a laptop that goes missing.

## The words it uses

Every text in the area, in its alerts and in its mails is written for a cold reader: someone who
knows the business but not the code (AGENTS.md, definition of done item 5; Patric, 2026-10-06).
Each thing has one word, the same on every page:

| Write                                                                             | For                                                                                                                       | Never                                                         |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| the tenant's name                                                                 | a customer of Kowboy (one brokerage), with its CRM connections and its sites                                              | its number alone                                              |
| "Acme's Vitec connection", then "short name acme-crm" where two could be confused | a tenant's login to one CRM                                                                                               | the short name alone (`vitec-2`), a connection with no tenant |
| the site's name, and its tenant                                                   | a website that shows a tenant's listings, named as its tenant's page names it                                             | subscriber, client                                            |
| the record's address or name, then "the CRM's id"                                 | one home, new-build project, agent, office, area or housing cooperative as Core holds it                                  | item, entity, remote id                                       |
| homes, new-build projects, agents, offices, areas, housing cooperatives           | the entity types                                                                                                          | `property`, `project`, `association`, datatype                |
| the office's name, then "the CRM's office id"                                     | an office of the tenant                                                                                                   | the office id alone                                           |
| fetch                                                                             | Core reading records from the CRM, and a site reading its changes from Core                                               | pull, ingest                                                  |
| tell a site about changes                                                         | the call that makes a site fetch at once; its setting keeps the plugin's name, "bell secret", explained where it is shown | bell, ring and rang in a sentence                             |
| removed                                                                           | a record that left the CRM's list; Core keeps it 90 days                                                                  | tombstone, deleted                                            |
| recompute                                                                         | Core working out a record's fields again from what the CRM sent, without asking the CRM                                   | rerun the rules                                               |
| the check's title                                                                 | one of the things the Overview watches                                                                                    | its name (`vitec.catch_up`, `subscribers`)                    |
| a sentence for what happened                                                      | an entry in the event log                                                                                                 | its type (`office.taken_off`)                                 |

A number sits in its sentence and agrees with it ("one site has", "three sites have"), never
"site(s)". A named thing links to its place: a tenant, a connection or a site to the tenant's page
(`/tenants/<id>`, `#connection:<short name>`, `#site:<id>`), an office or a record to Records, a
form to Failed forms, a CRM to its page.

## The pages

| Page             | What it is for                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Overview**     | The verdict first: green, how many checks need attention now (P0 and P1), or none with amber or grey checks worth a look. Each check by its title, never its name, in its level's colour (P0 and P1 red, P2 amber, P3 grey) with the level on its badge, its sentence, the sites it finds behind as links, and a link to the page where it is put right. Then "Needs attention": the important things of the last seven days, each naming the exact office, connection, form or site, where it is, and a link that opens it (`engine/attention.ts`). Then the day in figures and hourly charts, what Core holds per datatype, the sites' freshness, and any job running now.                                                                                                                                                                                                                                                                                                             |
| **Flow**         | One list of the records in flight, "Queued at" first and sorted by it, newest first, the hundred newest, read again every second while the page is open. The whole row is coloured by state: waiting for the CRM, in Core, on a site, error. Tenants and offices narrow it. The same list, the same component, sits on Manual sync for the scope of a run (Patric, 2026-10-06).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Records**      | Everything Core holds, narrowed by the same scope as Manual sync, live (on the sites), removed (left the CRM's list, kept 90 days) or both, sorted by any column, pages of 500 (25 to 500), a column chooser. A record's name, or its row, opens the record. Every choice is in the address, so a view is a link. Built from zero on 2026-10-06.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Tenants**      | Tenants only. One tenant is one page and one Save: name, licence, its CRM connections, its sites. A link ending `#connection:<id>` or `#site:<id>` scrolls to that block and rings it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Manual sync**  | One scope, then how far to go: fetch from the CRM, recompute and send to the sites (the default); recompute and send; or send only. Below it, the Flow list for that scope. Built from zero on 2026-10-06; see below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Failed forms** | The forms visitors sent that the CRM refused or did not answer, newest first, each kept 30 days from when it was sent (question 160 a): the kind, the tenant and when, why it is here (the CRM's reason, or that it did not answer), the home with a link to its record, the office, and what the visitor wrote (name, e-mail, phone, address, message, the viewing time, the current-home box, the search profile, the consent's time, the page it was sent from, the campaign) and the form's id. **Send again**, explained beside it and asked first, sends the form to the CRM once more under its id, through the same route and guard as a site's send; the answer shows as a toast, and a form the CRM takes leaves the list and its details leave Core. One send at a time per form; a form whose send Core lost, still waiting twice the CRM's 20 s, is listed as not answered. The send and who pressed it are `submission.*` and `admin.form_sent_again` on the form's chain. |
| **Events**       | The whole log with its filters, a live tail, and one click to follow a chain. Panel saves, sign-ins and actions are `admin.*` events with the person on them, so "who did what" is a filter.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **CRMs**         | One page per adapter, drawn from what the adapter reports: its directions, its settings, its notification URL and its sections. A second CRM appears by itself.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Settings**     | Configuration read-only (whether each setting is set, never its value), the migrations the database holds, the versions running, where alerts go, who may sign in, and maintenance.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

Every page: no reload, a toast for every outcome, one pattern for a list, a detail page, a form and
a row's actions, a confirmation before anything dangerous, an empty state that says what to do
next, and a keyboard-reachable and labelled interface. A **Go to…** button in the top bar opens the
palette and spells out the keys that also open it (⌘ K on a Mac, Ctrl K elsewhere), so nobody has
to know them (Patric, 2026-09-21: "⌘K — what is this?"). The top bar names the environment, the
version and how long this process has been running.

**The scope is picked, never typed.** One component (`admin/src/components/scope-picker.tsx`),
reading one call (`GET /scope`), gives Records, Flow and Manual sync the same boxes in the same
order: tenants, then offices, then entity types, then one record id; Flow shows the first two.
Several of each can be ticked, and an empty box means all of it. The offices offered are the ones
Core holds records for, live or removed, grouped under their tenant and named as their office
record names them; ticked tenants narrow them, and a tenant unticked takes its offices out of the
scope. The scope lives in the address as `tenant=1,2&office=A,B&datatype=property&id=OBJ-1`, and
the API reads it the same way, so a view is a link (Patric, 2026-09-21 and 2026-10-06).

**Every date is Swedish**: `2026-09-21 14:05`, Stockholm time, and the figures are grouped the
Swedish way (`12 345`). Anything older than a day is also shown as "3 days ago" where a glance is
enough.

### Manual sync

Its purpose is to fetch data again (Patric, 2026-10-06). One scope, then one of three levels, each
doing its own step and every step after it:

- **Fetch from the CRM, recompute and send to the sites**, the default. Tenants alone, or with
  entity types, fetch each of their connections' lists again and remove what is no longer on it
  (`resync`, one per entity type ticked). An office or one record id narrows it to the records
  Core holds there, each asked for again (`refetch`): an adapter told only "this office" may check
  the office and fetch none of its records.
- **Recompute and send to the sites**: the scope computed again from what Core holds, as a job the
  worker takes. No CRM is called.
- **Send to the sites only**: the live records of the scope get new places in the order the sites
  pull by, and every site of their tenants is rung, so each pulls them again. A site takes the
  ones it lacks or holds in another version and leaves the ones it already holds unchanged, as
  both clients skip a record whose content has not changed. Nothing is fetched or computed.

The fetch and the recompute run in the background, and whatever either changes goes to the sites
as it is written; the send gives the sites the whole scope at once. **Start** says what will happen
and how many live records the scope holds before anything runs. The Flow list below shows what the
run does, record by record. Housekeeping runs on its own and has no button ("it has no use for
manual run").

### A tenant is one page

A connection is a setting of a tenant: there is no connections page, list or menu entry (Patric,
three times). The tenant's page holds any number of connections, of the same CRM or different ones,
each with the CRM's own login fields, the offices it may see (left out for a CRM whose adapter
takes the offices from the CRM itself, question 156 a: Vitec), a **Check the login** button that
tries the CRM before anything is saved, and whatever the adapter reports about that connection.

**Offices may be left empty** (question 147 a, 2026-10-06, reversing the rule of 2026-09-21
that refused it): no office named means every office the CRM gives the login. An adapter that can
learn its offices from the CRM does so and says how in its setup steps (Vitec: the office group
"Webbplats", or every office behind the login's id); its manifest says `officesFromCrm`, the page
draws no office field for it, a save stores its list empty whatever was sent, and ingest reads the
list as empty; one that ends up with none says so in its health check. Two tenants may name the same office: the record is fetched once and written
for each of them, each with its own copies, its own version numbers and its own sites, which is
how two sites can show one brokerage's listings. Core does not warn about that; the page says it
where the offices are typed.
Its sites are on the same page with their bell address, their bell secret, their setup
checklist, what they reported applied and failed, and their own errors.
Under a Vitec connection, **Offices Vitec lists** says in plain words which offices reach the
sites and why, for a reader who must explain it to the brokerage: Core asks Vitec once a day, and
at each worker start, which offices sit behind the login's customer or group id, reads each one,
and uses those in the brokerage's office group "Webbplats" in Vitec, or every office when there is
no such group or it holds none of them (Patric, closing question 154). The card shows the last
check, the office groups Vitec answered, and each office with whether it reads and whether it is
synced to the sites (question 157: the line "Reaches the sites" was removed, "I dont understand the
purpose"). **Fetch offices** asks at the worker's next tick, and its explanation sits beside
it. An office that came is loaded; one that went is tombstoned with all its records, so each site
deletes it at its next sync, and the tombstones stay for the retention window. An office Vitec
refuses (question 158 b) stays synced for one more day, its row saying since when, and is taken off
when the refusal still stands at the next daily check; a refusal at any fetch makes the worker
check within a minute. The card's note says the rule in one paragraph of plain words, for a reader who must tell the
brokerage (Patric, closing question 154; one paragraph, Patric 2026-10-06). The card is the only
thing the Vitec adapter shows under a connection: the block of its schedules and fetch list went
on 2026-10-06 (Patric: remove it); the Vitec page keeps them.
A Vitec login can be for Vitec's QA environment, Vitec's test system (question 169 a): the login's
tickbox **Use Vitec's QA environment**, ticked, sends every call of that login to QA's address, and
its records are kept apart from live Vitec's even where QA uses the same office ids. The adapter
declares the field with the fixed values no and yes, which the tenant page draws as a tickbox
(Patric, 2026-10-06: "a toggle/checkbox"); ticked stores yes, unticked no. The Vitec page
shows QA's notification address beside the live one, and its **Fetch list** and **Refused
offices** mark a QA office "(QA)", as do the names in `vitec.offices` on Overview. A saved login
switched to the other system syncs no office until the worker's next tick, which takes
everything the first system gave off the sites and loads the second in full; the field's own help and the
setup steps say so. The forms of a QA login go to QA, and only from the live service.
Under each connection, one line counts the forms visitors sent through Core to that CRM in the
last day (docs/forms.md): delivered, refused by the CRM, unanswered by the CRM; red when any went
unanswered. The visitor is never stored in Core, so the line has counts and nothing else.

One Save does all of it, and says what it did. The difference decides what the adapters are told: a
new connection is loaded, offices added or removed are loaded or tombstoned, a connection taken off
the page is removed with its records.

**A saved secret is not on the page at all.** A stored password or key never leaves Core: the field
shows `••••••••••••` where a secret exists, and that mask is the box's placeholder, not its value —
there is nothing in the page for a browser, an extension or a screenshot to read. A login field that
is not secret, such as a username or the id a login was issued for, shows what Core holds, and an
empty one looks empty (2026-10-06: every field showed the mask, so an empty id looked filled).
Leaving the fields as they are keeps the stored login; a field typed goes over that field alone, and every field not typed
keeps its stored value (known bug 3, fixed 2026-10-06: a save used to keep only what was typed).
A stored field cannot be emptied from the page. A stored field the CRM's login form no longer has
is dropped at the next save, so the data a removed feature kept goes with it.

Because of that, **Check the login** on a saved connection has nothing to send, so Core tries the
login it already holds, with the offices that connection is licensed for. Typed values, when there
are any, are tried instead, exactly as a save would store them — so a yes here is a yes afterwards
(Patric, 2026-09-21: the check did not work on a saved connection).

### Dangerous buttons, and the ones that only look it

Anything that removes, rotates a secret or starts a run over many records is red and asks first,
with a sentence saying what will happen: what breaks until a new token is pasted into each site,
that a site's deletion takes its history with it, that a recompute rings the sites for whatever
changed.

The rest are plain buttons that do their work at once, because nothing they do can be lost
(Patric, 2026-09-21). **Fetch again** asks the CRM for the same records and writes only what
actually differs, so running it twice does no more than running it once. **Recompute this record**
builds one record again from what Core already stores and calls no CRM. **Ring the sites** only
tells the sites to pull. Each says as much on the page next to it.

**Every button carries its sentence.** An action an adapter declares comes with `help`: what the
button does and when a person would press it, shown next to it on the page and inside the
confirmation where there is one. The acceptance test _explains every button an adapter puts on a
page_ refuses an action without it, so a new action cannot arrive unexplained and a changed action
cannot keep the old sentence (Patric, 2026-09-21).

### A record's timeline

A record's page shows its three faces — the CRM's payload, the unified record, the prepared strings
— and under them its history: when, what happened in one sentence, and a link to follow the chain
on Events. The sentence is the engine's (`engine/admin/summary.ts`), so the timeline, the Events
page and Flow cannot say different things about the same event, and adding an event type anywhere
in Core means adding its line there.

No payload is on the timeline at all — not the whole event, not the part that changed (Patric,
2026-09-21: a history of payloads cannot be read at a glance). What changed is named ("written:
askingPrice, status"); the values themselves are the three faces above, and the whole event, with
its payload, is one click away on Events.

### Maintenance

One switch on Settings. While it is on, the sites pull exactly as before — nothing a visitor sees
changes — but Core rings no site and takes no job. Changes meanwhile are remembered as pending
bells and go out in one round when it is turned off. Every page says so while it is on.

## The admin API

One JSON API under `/v1/admin/`, and the browser app is its second user: everything the app can do
an agent can do, and nothing is done in two ways. Sign-in and the sign-in link are the only calls
that need no session.

| Call                                                                                             | What it does                                                                                |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `POST /sign-in`, `GET /sign-in/:token`, `POST /sign-out`, `GET /me`                              | Getting in and out, and who is in.                                                          |
| `GET /overview`, `GET /health`                                                                   | The verdict, the day, the sites, the open jobs.                                             |
| `GET /flow`                                                                                      | The records in flight in a scope, in the state each reached last, the newest `limit` (100). |
| `GET /stream`                                                                                    | One server-sent stream: new events, the open jobs, the health verdict.                      |
| `GET /tenants`, `GET /tenants/:id`, `POST /tenants`, `PATCH /tenants/:id`, `DELETE /tenants/:id` | The tenant list, and one tenant read and written whole.                                     |
| `POST /tenants/:id/token`, `POST /tenants/:id/ring`                                              | A new token; ring every site of a tenant.                                                   |
| `POST /sites/:id/secret`, `POST /sites/:id/ring`                                                 | A new bell secret; ring one site.                                                           |
| `GET /devices`, `POST /devices/forget-others`                                                    | Where this person is signed in, and forgetting every other device.                          |
| `GET /scope`                                                                                     | The pickers: tenants, the offices Core holds records for, the datatypes.                    |
| `GET /records`, `GET /records/:connection/:datatype/:id`                                         | The records of a scope, sorted and paged; one record whole with its timeline.               |
| `POST /records/:c/:d/:id/preview`, `POST /records/:c/:d/:id/inspect`                             | What a recompute would change; the CRM asked now, writing nothing.                          |
| `POST /runs/sync`                                                                                | A manual sync of a scope at one of its three levels.                                        |
| `POST /runs/recompute`, `POST /runs/fetch-again`                                                 | A scope recomputed or fetched again (a record's page).                                      |
| `GET /events`                                                                                    | The log by any filter, paged by event number.                                               |
| `GET /crms`, `GET /crms/:provider`, `POST /crms/:provider/act`, `POST /crms/:provider/probe`     | Each adapter's page as data, its actions, and a login tried.                                |
| `GET /settings`, `POST /settings/maintenance`                                                    | The configuration, and the switch.                                                          |

Proved by `acceptance/admin.test.ts` through HTTP and by the browser journeys in `admin/e2e`, both
named under AC 42 in the acceptance report.

## What the engine offers

The area's calls are thin: the work is the engine's own functions, which the acceptance tests also
drive directly.

- **Tenants, connections and sites** (`engine/storage/connections.ts`): make and change a tenant,
  its connections (one or several, of the same or different CRMs) and its sites; rotate a token or
  a bell secret; delete a site, which takes its history in the event log with it, or a tenant,
  which takes everything.
- **Lifecycle events** (`engine/lifecycle.ts`): `connection_added`, `connection_removed`,
  `offices_added`, `offices_removed`, `resync` and `refetch` (named records fetched again) are
  queued in `lifecycle_events` and delivered to the adapter by the worker.
- **Recompute** (`engine/recompute.ts`): any scope (everything, tenants, a connection, offices,
  datatypes, one record or a list), as a preview that writes nothing or for real, in pages of 200 records with progress, the records not
  sold first and the sold ones (universal `sold_at` set) last (question 74). Long runs are jobs
  (`engine/jobs.ts`) the worker takes, with progress and a result.
- **Records** (`engine/storage/items.ts`): the scope (tenants, offices, datatypes, one record
  id, live or removed), sort by any column, pages and a total; and new places for a scope's live
  records, so every site pulls them again (Manual sync's send).
- **The event log** (`engine/events.ts`): the timeline query by record, connection, tenant, site,
  correlation id, type and time, paged by event number, newest first or oldest first. A `pull`
  event names the site that pulled, and so do a site's applied reports and its errors (the
  `X-Core-Site` header both clients send: their own bell URL). A Vitec notification is stored whole
  in its `webhook.received` event for as long as the log keeps events, 30 days (Patric,
  2026-09-20, question 63).
- **Bells** (`engine/bells.ts`): ring every site of a tenant, or one of them, for changes or for
  everything; held while maintenance is on.
- **Health** (`engine/health.ts`): the checks of the engine and of every adapter, each failing
  one with its level (question 172): P0 Core is down for every customer, P1 one customer's sites
  or forms are disrupted, P2 worth a look, P3 for the record only; a failing check without a level
  counts as P1. `GET /v1/health` is public, for an uptime monitor Kowboy runs (question 173): 500
  only while a P0 check fails, 200 otherwise, the same payload either way, each check with a
  detail in counts and plain words and never a customer's name (Patric, 2026-09-20, question 62).
  The names behind a count (`names` on a check) reach the alerts and the area, not the public
  answer. The engine's checks: `database`, `schema` and `worker` P0; `subscribers` P1, failing
  only for a site Core told about changes over an hour ago that has not fetched since;
  `lifecycle` P2, P1 once work has waited an hour; `submissions.failing` P2. A check that throws
  is P2, P1 once it has thrown at every run for 15 minutes, and so is an adapter's check whose
  last report is over two minutes old, P1 once it is over 17; both count as P3 while a P0 check
  fails, so one cause is one problem (rule B). An adapter's check shows the title "Fetching from"
  its CRM until a check can carry its own (question 184). The worker
  records each adapter check for the web process without its level until question 178 is
  answered, so the web process shows a failing adapter check as P1, while the worker's alerts use
  its own level.
- **Alerts** (`engine/alerts.ts`, question 164): the worker's round, once a minute. A problem is
  a failing check, or one site the sites check finds behind; it opens when the round first sees it
  and closes when the round no longer does, each a `check.failed` or `check.recovered` event (the
  check's name, its detail and names, and for a site its number, tenant and name in `sites`). A P0
  problem is told once it has lasted five minutes and a P1 once it has lasted 15, by mail
  (`ALERT_EMAIL`, through Postmark: `POSTMARK_SERVER_TOKEN`, `MAIL_FROM`) and to a Slack incoming
  webhook (`ALERT_SLACK_WEBHOOK_URL`), once, and its end once if its start was told; one that ends
  sooner is only in the event log (rules A and D). While a P0 is open only P0 problems are told,
  and the rest wait until it ends (rule B). A P1 event on "Needs attention" is told at the next
  round. What is due in one round goes in one message. The P2 problems that lasted 15 minutes and
  the P2 events written since the last one go in one mail at 07:00 Stockholm time, none when
  nothing is new; P3 stays in the event log. Each thing told reads: its level, or "Resolved after"
  how long, and its title; "Which:" the thing; "Where:" its connection or tenant when the thing
  does not say; "What happened:" what it means for the sites and what to do; "Open it:" its place
  in the area, the whole address when `PUBLIC_URL` is set. Every send is one `alert.sent` event
  with what it told and, per channel, whether it went. A round reads first, tells next and keeps
  what changed last, so one that fails half way tells it again at the next round rather than
  never, and one round runs at a time (the row `alerts:turn`), also while a deploy runs two
  workers. While the sites check cannot run, the sites it found behind stay open as they were. A
  problem kept before the levels (its detail not the alert's words) ends without a word, or, still
  open, takes the alert's words and is told no more than it was.
- **Needs attention** (`engine/attention.ts`, questions 159, 163 and 164): the few kinds of event
  the super admin is told about, each with its level. An office taken off the sites
  (`office.taken_off`) is P1 when the CRM still refused it within the week before, else P2; a
  connection Core paused because the CRM kept failing (`connection.paused`) is P2; a login the CRM
  refuses (`login.refused`) is P1; a visitor's form that could not be sent or that the CRM refused
  (`submission.failed`, `submission.refused`) is P1, but not a form Core held back outside
  production (`submission.refused` with Core's own reason), which never left Core; a site that is
  not fetching its changes (the sites check's `check.failed` for it) is P1, but not the sites check
  that could not run, which names no site. The adapter logs the first three through the adapter
  API with the connection in the context, and the engine logs the rest. The Overview lists them
  for seven days, newest first, one line per thing: its title, and under it a sentence of what
  happened, what it means for the sites and what to do; which thing ("office Lidingö (the CRM's office id
  M30011)", "Acme's Vitec connection, short name acme-crm", "a viewing booking a visitor sent",
  "site acme.se") as a link that opens it (the office's removed records on Records, the
  connection's or the site's block on the tenant's page, Failed forms); and where it is (the
  connection an office or a form came through, a site's tenant). The offices one cause took off
  share a correlation id and are one line; what to do differs for an office the CRM still refused
  and one taken off by a change someone made. A sites check without its sites (one written before
  they were kept) is one line with the names the check gave, linking to Tenants. The event log is
  the one source: nothing is kept twice.
- **Form submissions** (`engine/http/submissions.ts`, docs/forms.md): `POST /v1/submissions` hands
  a site's form to the connection's adapter and answers what the CRM said; `GET
/v1/submissions/slots` reads a home's viewings and slots live. The outcomes table keeps the id,
  the kind, the record and the CRM's answer; it keeps the form itself, encrypted with the key of
  the CRM logins, until the CRM has taken it, and 30 days when the CRM refused it or did not
  answer, so it can be read and sent again (`GET /v1/admin/forms` lists them, `POST
/v1/admin/forms/:id/send-again` sends one again; Failed forms); the events `submission.received`,
  `.delivered`, `.refused` and `.failed` sit on the record's timeline; the check
  `submissions.failing` ("Sending forms to the CRMs") fails while the last form sent through a
  connection could not be sent; the Overview and the alert name each such connection and link it.
  `GET /v1/submissions/bot-check` gives a site's server the bot check's public key (`engine/human.ts`,
  `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET`), and a form carries the proof its window earned in
  `X-Core-Human`. Only the live service hands a form to the CRM; elsewhere it stops just before.
  The visitor's browser never calls Core: it talks to its own site, whose server calls these
  addresses with the site's token.
- **Settings** (`engine/storage/settings.ts`): the switches a person throws, one row per key, read
  by whichever process needs them so web and worker agree without a restart.

## What the adapter API offers

Approved 2026-09-20 with the rebuild (questions 57 and 61) and unchanged since: `Adapter.admin`
describes the adapter's pages as data, and one more lifecycle event names records to fetch again.
The Vitec adapter implements all of it (`adapters/vitec/admin/`), and so does the fake webhook
adapter, which is how the area is proved without a CRM.

```ts
admin?: {
  /** The login form of a connection; the values become one JSON document, never shown back. */
  credentials: AdminField[];
  /** The directions at the top of the adapter's page: steps, and the settings as they are. */
  directions(): AdminDirections;
  /** The adapter's page: sections of key-values, tables with row actions, and actions. */
  panel(connections: Connection[]): Promise<AdminSection[]>;
  /** What the adapter knows about one connection, shown under its tenant. */
  connection?(connection: Connection): Promise<AdminSection[]>;
  /** Run an action a section declared; the message goes to the person who pressed it. */
  act(action: string, params: Record<string, string>, connections: Connection[]): Promise<{ message: string }>;
  /** Try the CRM with a login before it is saved, or the stored one when nothing is typed. */
  probe?(credentials: string, officeIds: string[]): Promise<{ ok: boolean; detail: string }>;
  /** Fetch one record and map it, writing nothing; null when the CRM has no such record. */
  inspect?(connection: Connection, record: AdminRecord): Promise<{ raw: unknown; mapped: MappedRecord | null } | null>;
  /** What waits on the adapter's own fetch list for these connections, for the Flow list. */
  queue?(connections: Connection[]): Promise<AdminQueued[]>;
};

/** Delivered like the other lifecycle events: the adapter puts these records on its list. */
type Refetch = { type: 'refetch'; connection: Connection; records: AdminRecord[] };
```

The engine hands the descriptions on as they are and runs the actions the adapter declared; it
never inspects what they mean, and no CRM is named in `engine/` or in `admin/src` — the seam check
enforces both.

Three event types an adapter logs through `logEvent` reach the Overview's "Needs attention" and
an alert (`engine/attention.ts`, questions 159 and 164): `office.taken_off` with `office_id`,
`office_name` when the adapter knows it (the office's record is removed by then) and `reason` in
plain words, `connection.paused` with `failures` and `detail`, and `login.refused` with `detail`,
each with the connection in the context so the engine finds the tenant. The offices one cause
takes off share one correlation id, so they are one line and one alert. An office taken off is P1
when the adapter logged `office.blocked` for it on that connection, with no `office.unblocked`
after, within the week before. The `reason` and `detail` are read by a cold reader in the alert
and on the Overview: they say why in plain words, and what to do when only the CRM's side can put
it right. Any other event an adapter logs stays in the log.

## How it is built

- **The app**: React with Refine over the admin API, shadcn/ui components and Tailwind, one
  `DataTable` every list uses, `sonner` for the toasts and `cmdk` for the palette. All MIT, all
  approved (questions 60 and 64).
- **One build**: `npm run build` compiles the engine with `tsc` and the app with Vite into
  `dist/admin`.
- **Live**: one `EventSource` on `/v1/admin/stream` feeds Refine's `liveMode: "auto"`, so a browser
  holds one connection and every page follows along.
- **Settings it reads**: `ADMIN_EMAILS` and `ADMIN_EMAIL_DOMAINS` (who may open it),
  `ADMIN_LINK_MINUTES`, `ADMIN_SESSION_DAYS`, `ADMIN_REMEMBER_DAYS`, and the engine's own
  `PUBLIC_URL`, `MAIL_FROM` and `POSTMARK_SERVER_TOKEN` for the sign-in mail.
