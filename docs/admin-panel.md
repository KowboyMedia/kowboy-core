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

| Write                                                                   | For                                                                                                                       | Never                                                          |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| the tenant's name                                                       | a customer of Kowboy (one brokerage), with its CRM connections and its sites                                              | its number alone                                               |
| "Acme's Vitec connection “Main”": its tenant, its CRM, then its name    | a tenant's login to one CRM                                                                                               | Core's own id for it (`acme-crm`), a connection with no tenant |
| the site's name, and its tenant                                         | a website that shows a tenant's listings, named as its tenant's page names it                                             | subscriber, client                                             |
| the record's address or name, then "the CRM's id"                       | one home, new-build project, agent, office, area or housing cooperative as Core holds it                                  | item, entity, remote id                                        |
| homes, new-build projects, agents, offices, areas, housing cooperatives | the entity types                                                                                                          | `property`, `project`, `association`, datatype                 |
| the office's name, then "the CRM's office id"                           | an office of the tenant                                                                                                   | the office id alone                                            |
| fetch                                                                   | Core reading records from the CRM, and a site reading its changes from Core                                               | pull, ingest                                                   |
| tell a site about changes                                               | the call that makes a site fetch at once; its setting keeps the plugin's name, "bell secret", explained where it is shown | bell, ring and rang in a sentence                              |
| removed                                                                 | a record that left the CRM's list; Core keeps it 90 days                                                                  | tombstone, deleted                                             |
| recompute                                                               | Core working out a record's fields again from what the CRM sent, without asking the CRM                                   | rerun the rules                                                |
| the check's title                                                       | one of the things the Overview watches                                                                                    | its name (`vitec.catch_up`, `subscribers`)                     |
| a sentence for what happened                                            | an entry in the event log                                                                                                 | its type (`office.taken_off`)                                  |

A number sits in its sentence and agrees with it ("one site has", "three sites have"), never
"site(s)". A named thing links to its place: a tenant, a connection or a site to the tenant's page
(`/tenants/<id>`, `#connection:<Core's id for it>`, `#site:<id>`), an office or a record to Records, a
form to Failed forms, a CRM to its page.

## The pages

| Page             | What it is for                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Overview**     | The verdict first, a badge and a sentence: "Core down" with the first sentence of the check that finds it, "Disrupted" with how many checks find a customer's sites or forms disrupted, or "Fine" and whether a check has something to look at. Each check by its title, never its name, in its level's colour (P0 and P1 red, P2 amber, P3 grey): failing, its level and the level's words on its badge ("P1 Disrupted") and its sentence, with the page it names linked in it, and each thing it names (a site behind, a connection, an office, a record) by its name as a link to its place; passing, "Fine" and what that means. Then "Needs attention": the important things of the last seven days, each with its level beside its time ("P1 Disrupted", "P2 To look at"), naming the exact office, connection, form or site, where it is, and a link that opens it (`engine/attention.ts`). Then the last 24 hours in figures and an hourly chart (records saved, pages fetched by sites, sites told of changes, records the sites took or could not take); what is on the sites per entity type, each a link to Records for that type, with how many tenants are enabled; any recompute running now; and each site, linking to its block on its tenant's page, with its tenant, when it last fetched, when Core last told it of changes and how it answered (answered, refused, an error code or no answer); the card says what an error code or no answer means for the site and what to check. "Open Flow" beside the title says what Flow is for.                                                                                                                                                                                                                        |
| **Flow**         | One list of the records in flight, "Queued at" first and sorted by it, newest first, the hundred newest, read again every second while the page is open. The whole row is coloured by state: waiting for the CRM, in Core, on a site, error. Tenants and offices narrow it. A record waiting for the CRM says why, when Core tries again and how the last try failed; one Core gave up on says after how many tries, and that "Fetch again" on its page or Manual sync asks the CRM again. Every step names its tenant, connection and site by their names. The same list, the same component, sits on Manual sync for the scope of a run (Patric, 2026-10-06).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Records**      | Everything Core holds, narrowed by the same scope as Manual sync, live and removed together, the one Core changed last first, in pages of 500 with Back and Next. Five columns: what it is (its address or name as a link that opens the record, then its entity type and the CRM's id), its tenant, its office, its state (live: on the sites; removed: left the CRM's list, kept 90 days) and when Core last changed it. Every choice is in the address, so a view is a link. Built from zero on 2026-10-06; on 2026-10-07 only what Patric named stayed (question 183: "everything not named is removed ... The columns goes also, for all views"), so it has no sorting, no column chooser, no page size and no live-or-removed switch.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Tenants**      | Tenants only. One tenant is one page and one Save: its name, whether it is enabled and its token; its CRM connections, with the tenant's records on their way under them; its sites. A link ending `#connection:<Core's id for it>` or `#site:<id>` scrolls to that block and marks it. Built from zero on 2026-10-06; see below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Manual sync**  | One scope, then how far to go: fetch from the CRM, recompute and send to the sites (the default); recompute and send; or send only. Below it, the Flow list for that scope. Built from zero on 2026-10-06; see below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Failed forms** | The forms visitors sent that were not delivered to the CRM, newest first, each kept 30 days from when it was sent (question 160 a). Each card says what the form is and why it is here: refused by the CRM (with its reason), could not be sent (with the cause), no answer (Core was cut off before the CRM answered), or held back (outside production Core sends no form to a live CRM; a grey badge, nothing to do). It says when the form was sent, from which site (or that the site has since been removed) and through which connection (the tenant, the CRM and the connection's name), each a link to the tenant's page; the home by its address, then the CRM's id, linking to its record (the CRM's id alone, saying so, when Core holds no address); the office, linking to its homes on Records; what the visitor wrote (name, e-mail, phone, address, message, the CRM's id for the viewing time, as Core does not keep the time itself, the current-home box, the search profile in words, the consent's time, the page it was sent from, the campaign's tags); and Core's id for the form, linking to its steps on Events. **Send again**, explained beside it and asked first (the question says how the brokerage could get the form twice), sends the form to the CRM once more under its id, through the same route and guard as a site's send; the answer shows as a sentence, and a form the CRM takes leaves the list and its details leave Core. A form that cannot go says why in words that name the tenant and the connection. One send at a time per form; a form whose send Core lost, still waiting twice the CRM's 20 s, is listed as not answered. The send and who pressed it are `submission.*` and `admin.form_sent_again` on the form's chain. |
| **Events**       | The whole log with its filters, a live tail, and one click to follow a chain. Panel saves, sign-ins and actions are `admin.*` events with the person on them, so "who did what" is a filter.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **CRMs**         | One page per adapter, drawn from what the adapter reports: its directions, its settings, its notification URL and its sections. The buttons a table repeats on every row are explained once under the table, each by its name. A second CRM appears by itself.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Settings**     | What is running (Core's version, the versions of the rules and of what the sites receive, Core's address, how long the event log keeps, how often a site is told of changes); the server settings, each as a sentence with its name under it and whether it is set, never its value; where alerts go and who may sign in, each saying which server setting is missing; the devices signed in, with "Sign out everywhere else"; how many changes Core has made to the database's layout, in a sentence; and maintenance, with when it was last turned on or off and by whom. Every button says beside it what it does.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

Every page: no reload, a toast for every outcome, one pattern for a list, a detail page, a form and
a row's actions, a confirmation before anything dangerous, an empty state that says what to do
next, and a keyboard-reachable and labelled interface. A **Go to…** button above the sections in
the menu opens the palette and spells out the keys that also open it (⌘ K on a Mac, Ctrl K
elsewhere), so nobody has to know them (Patric, 2026-09-21: "⌘K — what is this?"); its sentence
says it finds a page, a tenant, or a record by the CRM's id for it. Under the sections the menu
says who is signed in, then **Sign out**, which signs out this device only, as its sentence says.
On a phone the menu folds away behind **Show the menu**. Under every table a sentence says that
Back and Next turn the page, and on Flow that pressing "Queued at" turns the order round. No table
offers a choice of columns (Patric, 2026-10-07: "The columns goes also, for all views"). The top bar
names the environment, the version and how
long this process has been running.

**The scope is picked, never typed.** One component (`admin/src/components/scope-picker.tsx`),
reading one call (`GET /scope`), gives Records, Flow and Manual sync the same boxes in the same
order: tenants, then offices, then entity types, then one record id; Flow shows the first two.
Several of each can be ticked, and an empty box means all of it. The offices offered are the ones
Core holds records for, live or removed, grouped under their tenant and named as their office
record names them, then the CRM's id for them ("Lidingö (the CRM's office id 100)"); ticked tenants narrow them, and a tenant unticked takes its offices out of the
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
as it is written; the send gives the sites the whole scope at once. **Start** starts the level
picked at once, as its sentence beside it says, and its answer says what Core does; it shows no
count first and asks nothing, as Patric named neither (question 183). Each level keeps its sentence
under it, as every control explains itself. The Flow list below shows what the run does, record by
record. Housekeeping runs on its own and has no button ("it has no use for
manual run").

### A tenant is one page

Built from zero on 2026-10-06 from Patric's list ("this entire page is complete shit. We shall
rewrite it"); it replaced the old page on 2026-10-07 (question 180). A connection is a setting of a tenant: there is no connections page, list or
menu entry (Patric, three times). One **Save** writes the whole page and says in its message what
it did. Its parts, in order:

- **The tenant**: its name; **Enabled** (a disabled tenant's sites can no longer fetch, and Core
  stops telling them of changes; its connections keep loading); its token with **Copy** and
  **Make a new token**, which asks first and says that every site fails to fetch until the new
  token is pasted into it.
- **CRM connections**, any number, of the same CRM or different ones. Each has its **Name**, what
  a person calls it, such as the brokerage or the CRM it reads, which can change at any time; no
  two of a tenant's connections share one. Core files the connection's records under an id of its
  own, made from the first name, which no page shows (Patric, 2026-10-07: "Unique identifier has an
  internal purpose and does not matter for a human in an admin panel"). A save that names an id
  Core did not give this tenant, as only a page left open while the tenant changed elsewhere can,
  is refused and nothing is saved. Then its CRM, picked from the CRMs Core has code for, and that CRM's login fields: for Vitec the
  username, the password, the customer or group id (readable, not hidden) and **Use Vitec's QA
  environment**. A login field whose only choices are no and yes is a tickbox. **Check login**
  tries what is typed over the stored login, exactly as a save would store it, and saves nothing;
  its answer starts "The check passed" or "The check did not pass", then the CRM's own words.
  Under the login comes whatever the CRM's code reports about the connection: for Vitec, **Offices
  Vitec lists** with **Fetch offices** and the offices. **Remove this connection** asks first; at
  Save the connection goes and its records leave the sites. **Add a CRM connection** adds an empty
  one. Under the connections, **Records on their way** is the Flow list narrowed to this tenant.
- **Sites**, any number. Each has its address, which names the site (`https://example.se`), its
  bell path (where on the site Core tells it of changes: `/wp-json/core/v1/bell` for WordPress
  with Core's plugin, or a whole address for a site that listens elsewhere, such as a Lovable
  site's sync function), and its bell secret with **Copy** and **Make a new secret**, which asks
  first. **Remove this site** asks first and takes the site's history with it at Save.

Saved on this page, a site's name is its address. An older site whose name is not an address
shows the address its bell is on, and takes that as its name at the next Save. The page has no
office field: a Vitec connection takes its offices from Vitec (question 156 a), and every other
connection keeps the offices it has.

**Offices may be left empty** (question 147 a, 2026-10-06, reversing the rule of 2026-09-21
that refused it): no office named means every office the CRM gives the login. An adapter that can
learn its offices from the CRM does so and says how in its setup steps (Vitec: the office group
"Webbplats", or every office behind the login's id); its manifest says `officesFromCrm`, a save
stores its list empty whatever was sent, and ingest reads the list as empty; one that ends up with
none says so in its health check. Two tenants may name the same office: the record is fetched once
and written for each of them, each with its own copies, its own version numbers and its own sites,
which is how two sites can show one brokerage's listings.
Under a Vitec connection, **Offices Vitec lists** says in plain words which offices reach the
sites and why, for a reader who must explain it to the brokerage: Core asks Vitec once a day, and
at each worker start, which offices sit behind the login's customer or group id, reads each one,
and uses those in the brokerage's office group "Webbplats" in Vitec, or every office when there is
no such group or it holds none of them (Patric, closing question 154). The card shows the last
check, the office groups Vitec answered, and each office with whether it reads and whether it is
synced to the sites. **Fetch offices** asks at the worker's next tick, and its explanation sits
beside it. An office that came is loaded; one that went is tombstoned with all its records, so each
site deletes it at its next sync, and the tombstones stay for the retention window. An office
Vitec refuses (question 158 b) stays synced for one more day, its row saying since when, and is
taken off when the refusal still stands at the next daily check; a refusal at any fetch makes the
worker check within a minute. The card's note says the rule in one paragraph (Patric, 2026-10-06).
The card is the only thing the Vitec adapter shows under a connection: the block of its schedules
and fetch list went on 2026-10-06 (Patric: remove it); the Vitec page keeps them.
A Vitec login can be for Vitec's QA environment, Vitec's test system (question 169 a): **Use
Vitec's QA environment** ticked sends every call of that login to QA's address, and its records are
kept apart from live Vitec's even where QA uses the same office ids. The adapter declares the field
with the fixed values no and yes, which the page draws as a tickbox, ticked storing yes (Patric,
2026-10-06: "a toggle/checkbox"); a stored yes in any case shows ticked, as the Vitec code reads
it so. The Vitec page shows QA's
notification address beside the live one, and its **Connections and schedules**, **Fetch list** and
**Refused offices** mark a QA office "(QA)"; the names in `vitec.offices` on Overview call it a "QA
office id". The tenant's page shows the connection's field ticked instead, above **Check login** and
the card **Offices Vitec lists**, which carry no mark (question 177). A saved login switched to the other
system syncs no office until the worker's next tick, which takes everything the first system gave
off the sites and loads the second in full; the field's own help and the setup steps say so. The
forms of a QA login go to QA, from staging too (question 181: "staging dry run unless qa"); every
other form leaves only from the live service.

**A saved secret is not on the page at all.** A stored password or key never leaves Core: its box
is empty, with the sentence "One is stored. Type a new one only to change it." under it, so there
is nothing in the page for a browser, an extension or a screenshot to read. A login field that is
not secret, such as a username or the id a login was issued for, shows what Core holds. A field
typed goes over that field alone, and every field not typed keeps its stored value (known bug 3,
fixed 2026-10-06). A stored field cannot be emptied from the page. A stored field the CRM's login
form no longer has is dropped at the next save, so the data a removed feature kept goes with it.

### Dangerous buttons, and the ones that only look it

Anything that removes or rotates a secret is red and asks first, with a sentence saying what will
happen: what breaks until a new token is pasted into each site, that a site's deletion takes its
history with it. Manual sync's **Start** asks nothing (Patric, 2026-10-07, question 183).

The rest are plain buttons that do their work at once, because nothing they do can be lost
(Patric, 2026-09-21). On a record's page, **Fetch again** asks the CRM for the record and writes
only what actually differs, so running it twice does no more than running it once; **Recompute**
builds the record again from what Core already stores and calls no CRM; **Send again** only tells
the sites to fetch it. **Check login** saves nothing. Each says as much on the page next to it.

**Every button carries its sentence.** An action an adapter declares comes with `help`: what the
button does and when a person would press it, shown next to it on the page and inside the
confirmation where there is one. The acceptance test _explains every button an adapter puts on a
page_ refuses an action without it, so a new action cannot arrive unexplained and a changed action
cannot keep the old sentence (Patric, 2026-09-21).

### A record's page

Built from zero on 2026-10-06 for three purposes: troubleshooting a record's way from the CRM to
the sites, viewing its data, and trying a step again (Patric: "the single entity viewer is shit,
create a new replacement ... Do not anchor in the old"). It replaced the old page on 2026-10-07
(question 182 a).

- **The top**: its name (address, or name), then one sentence: what it is, whose (the tenant, the
  office and the CRM connection, each a link) and the CRM's id for it.
- **Where it is now**, three steps in order. _In the CRM_: when the CRM last changed it; **Compare
  with the CRM now** asks the CRM, stores nothing and lists the fields of the unified record that
  differ between the CRM's answer, mapped, and Core's copy; the texts are left out, as they follow
  the rules and not the CRM. A comparison shows only while Core's copy is the one it was made
  against. **Fetch again**. _In Core_: when Core last stored it, and whether the rules Core runs
  today made its texts; **Recompute**. _On the sites_: one line per site of the tenant, from the
  sites' own reports (`site.applied`, `site.failed`) as far back as the event log keeps: has
  Core's copy, has an earlier copy, could not take it and why, or no report; for a removed record,
  took it off or not taken off yet. **Send again**. The three buttons are Manual sync's three
  levels for this one record, through `POST /runs/sync` with `records`, so each does its step and
  every step after it. A removed record offers none of them, says when Core took it off the
  sites and that Core keeps it 90 days.
- **What happened**: the record's events, one change at a time, newest change first. Events that
  share a chain id are one change, oldest step first. A site's report carries no chain id, so it
  joins the write that gave the record the place the site says it took (both carry `seq`). A
  chain with an id links to it on Events, where its steps about other records show too. The
  sentence is the engine's (`engine/admin/summary.ts`), except a site's report, which names the
  site and links to it; no payload is on the history (Patric, 2026-09-21).
- **Its data**: the three faces of the record (AGENTS.md), one tab each: the texts ready to show,
  the unified record (without the texts) and what the CRM sent; each with **Copy**.

The page follows along without a reload: it reads the record again when the stream brings an
event about it. It starts afresh for each record, so nothing of one record stays on the next.

### Maintenance

One switch on Settings. While it is on, the sites pull exactly as before — nothing a visitor sees
changes — but Core rings no site and takes no job. Changes meanwhile are remembered as pending
bells and go out in one round when it is turned off. Every page says so while it is on.

## The admin API

One JSON API under `/v1/admin/`, and the browser app is its second user: everything the app can do
an agent can do, and nothing is done in two ways. Sign-in and the sign-in link are the only calls
that need no session.

| Call                                                                                         | What it does                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /sign-in`, `GET /sign-in/:token`, `POST /sign-out`, `GET /me`                          | Getting in and out, and who is in.                                                                                                                                            |
| `GET /overview`, `GET /health`                                                               | The verdict, the day, the sites, the open jobs.                                                                                                                               |
| `GET /flow`                                                                                  | The records in flight in a scope, in the state each reached last, the newest `limit` (100).                                                                                   |
| `GET /stream`                                                                                | One server-sent stream: new events, the open jobs, the health verdict.                                                                                                        |
| `GET /tenants`, `GET /tenants/:id`, `POST /tenants`, `PATCH /tenants/:id`                    | The tenant list, and one tenant read and written whole.                                                                                                                       |
| `POST /tenants/:id/token`                                                                    | A new token.                                                                                                                                                                  |
| `POST /sites/:id/secret`                                                                     | A new bell secret.                                                                                                                                                            |
| `GET /devices`, `POST /devices/forget-others`                                                | Where this person is signed in, and forgetting every other device.                                                                                                            |
| `GET /scope`                                                                                 | The pickers: tenants, the offices Core holds records for, the datatypes.                                                                                                      |
| `GET /records`, `GET /records/:connection/:datatype/:id`                                     | The records of a scope, the one changed last first, in pages of 500 (`page`); one record whole with its timeline, each site's last reports on it and the rules running today. |
| `POST /records/:c/:d/:id/inspect`                                                            | The CRM asked now, writing nothing, with the fields that differ from Core's copy.                                                                                             |
| `POST /runs/sync`                                                                            | A manual sync of a scope, or of named `records` (a record's page), at one of its three levels.                                                                                |
| `GET /events`                                                                                | The log by any filter, paged by event number.                                                                                                                                 |
| `GET /crms`, `GET /crms/:provider`, `POST /crms/:provider/act`, `POST /crms/:provider/probe` | Each adapter's page as data, its actions, and a login tried.                                                                                                                  |
| `GET /settings`, `POST /settings/maintenance`                                                | The configuration, and the switch.                                                                                                                                            |

Proved by `acceptance/admin.test.ts` through HTTP and by the browser journeys in `admin/e2e`, both
named under AC 42 in the acceptance report.

## What the engine offers

The area's calls are thin: the work is the engine's own functions, which the acceptance tests also
drive directly.

- **Tenants, connections and sites** (`engine/storage/connections.ts`): make and change a tenant,
  its connections (one or several, of the same or different CRMs) and its sites; rotate a token or
  a bell secret; delete a site, which takes its history in the event log with it.
- **Lifecycle events** (`engine/lifecycle.ts`): `connection_added`, `connection_removed`,
  `offices_added`, `offices_removed`, `resync` and `refetch` (named records fetched again) are
  queued in `lifecycle_events` and delivered to the adapter by the worker.
- **Recompute** (`engine/recompute.ts`): any scope (everything, tenants, a connection, offices,
  datatypes, one record or a list), as a preview that writes nothing or for real, in pages of 200 records with progress, the records not
  sold first and the sold ones (universal `sold_at` set) last (question 74). Long runs are jobs
  (`engine/jobs.ts`) the worker takes, with progress and a result.
- **Records** (`engine/storage/items.ts`): the scope (tenants, offices, datatypes, one record
  id), live and removed together, the one changed last first, pages and a total; and new places for a scope's live
  records, so every site pulls them again (Manual sync's send).
- **The event log** (`engine/events.ts`): the timeline query by record, connection, tenant, site,
  correlation id, type and time, paged by event number, newest first or oldest first. A `pull`
  event names the site that pulled, and so do a site's applied reports and its errors (the
  `X-Core-Site` header both clients send: their own bell URL). A Vitec notification is stored whole
  in its `webhook.received` event for as long as the log keeps events, 30 days (Patric,
  2026-09-20, question 63).
- **Bells** (`engine/bells.ts`): ring every site of a tenant, for changes or for everything; held
  while maintenance is on.
- **Health** (`engine/health.ts`): the checks of the engine and of every adapter, each failing
  one with its level (question 172): P0 Core is down for every customer, P1 one customer's sites
  or forms are disrupted, P2 worth a look, P3 for the record only; a failing check without a level
  counts as P1. Each check has a title and a sentence for while it passes (`aboutCheck`), and a
  failing one says what it means for the sites, what to do and on which page. `GET /v1/health` is public, for an uptime monitor Kowboy runs (question 173): 500
  only while a P0 check fails, 200 otherwise, the same payload either way, each check with a
  detail in counts and plain words and never a customer's name (Patric, 2026-09-20, question 62).
  The names behind a count (`names` on a check) reach the alerts and the area, not the public
  answer, and so does what failed for a check that could not run or a database Core cannot
  reach. With the database out of reach the answer still comes, with the database check and no
  adapter checks (rule B). The engine's checks: `database`, `schema` and `worker` P0; `subscribers` P1, failing
  only for a site Core told about changes over an hour ago that has not fetched since;
  `lifecycle` P2, P1 once work has waited an hour; `submissions.failing` P2. A check that throws
  is P2, P1 once it has thrown at every run for 15 minutes, and so is an adapter's check whose
  last report is over two minutes old, P1 once it is over 17; both count as P3 while a P0 check
  fails, so one cause is one problem (rule B). An adapter's check shows the title and the passing
  sentence its adapter declares (`admin.checks`), and "Fetching from" its CRM when it declares none.
  The worker records each adapter check for the web process with its level and its names
  (`health_results`), so the Overview shows it at the level its adapter gave it. A name is a text,
  or a thing the adapter points at (a connection, an office or a record, `AdminThing`), which the
  Overview and the alerts name as the admin area names it, and the Overview links to its place
  (`engine/admin/things.ts`).
- **Alerts** (`engine/alerts.ts`, question 164): the worker's round, once a minute. A problem is
  a failing check, or one site the sites check finds behind; it opens when the round first sees it
  and closes when the round no longer does, each a `check.failed` or `check.recovered` event (the
  check's name, its detail and names, the thing in words in `which`, the problem's key in
  `problem`, and for a site its number, tenant and name in `sites`; the end also the first
  sentence of its start in `said` and how long it lasted in `lasted_ms`). A P0
  problem is told once it has lasted five minutes and a P1 once it has lasted 15, by mail
  (`ALERT_EMAIL`, through Postmark: `POSTMARK_SERVER_TOKEN`, `MAIL_FROM`) and to a Slack incoming
  webhook (`ALERT_SLACK_WEBHOOK_URL`), once, and its end once if its start was told; one that ends
  sooner is only in the event log (rules A and D). While a P0 is open only P0 problems are told,
  and the rest wait until it ends (rule B). A P1 event on "Needs attention" is told at the next
  round. What is due in one round goes in one message. The P2 problems that lasted 15 minutes and
  the P2 events written since the last one go in one mail at 07:00 Stockholm time, none when
  nothing is new; P3 stays in the event log. Each thing told reads: its level and the level's
  words ("P1 Disrupted"), or "Resolved", and its title; what happened, naming the thing, what it
  means for the sites and what to do (an end: "Resolved after" how long, the first sentence of its
  start, and "Nothing to do."); where it is when its name does not say ("Through Acme's Vitec
  connection “Main”."); and the thing by its name with its place in the area, the
  whole address when `PUBLIC_URL` is set. The subject is the level and the first sentence of the
  one thing told, or how many problems started and ended and the worst level; the message ends
  with the way to the Overview. Every send is one `alert.sent` event
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
  for seven days, newest first, one line per thing: its time with its level beside it (question
  178), its title, and under it a sentence of what
  happened, what it means for the sites and what to do; which thing ("Acme's office Lidingö (the
  CRM's office id M30011)", "Acme's Vitec connection “Main”", "A viewing booking a
  visitor sent", "Acme's site acme.se") as a link that opens it (the office's records on Records,
  each with its state, the connection's or the site's block on the tenant's page, Failed forms); where it is
  when its name does not say (the connection an office or a form came through); and its tenant as
  a link when the name does not hold it. A site's line ends with how its problem ended, "Resolved
  after" how long or "Still open.", read from the `check.recovered` with the same `problem`. The
  offices one cause took off share a correlation id and are one line; what to do differs for an
  office the CRM still refused and one taken off by a change someone made. A site's line written
  before Core kept how a problem ends says what it was and points to the sites check on the
  Overview; one written before the sites were kept names the sites the check gave and links to
  Tenants. The event log is the one source: nothing is kept twice.
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
  `X-Core-Human`. Only the live service hands a form to a live CRM; elsewhere it stops just
  before, unless the CRM's code says the connection is its own test system (question 181).
  The visitor's browser never calls Core: it talks to its own site, whose server calls these
  addresses with the site's token.
- **Settings** (`engine/storage/settings.ts`): the switches a person throws, one row per key, read
  by whichever process needs them so web and worker agree without a restart.

## What the adapter API offers

Approved 2026-09-20 with the rebuild (questions 57 and 61): `Adapter.admin` describes the
adapter's pages as data, and one more lifecycle event names records to fetch again. Since
2026-10-07 (question 184) it also declares each health check's words, and a check's names and its
pages' values may point at things Core names and links. The Vitec adapter implements the 2026-09-20
part (`adapters/vitec/admin/`), and the fake webhook adapter implements all of it, which is how the
area is proved without a CRM.

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
  /** Each health check it registers, by name: its title, and its sentence while it passes. */
  checks?: Record<string, { title: string; fine: string }>;
};

/**
 * A thing the adapter points at by its ids, in a check's `names` or as a page's value: Core shows
 * it by its name (its tenant, its name, a record's address) and links it to its place, so the
 * adapter needs neither a tenant's name nor an address in the admin area. With neither `office`
 * nor `record` it is the connection.
 */
type AdminThing = {
  connection: string;
  office?: string;
  record?: { datatype: Datatype; id: string };
  /** Said after its name: "last caught up 3 hours ago". */
  note?: string;
};

/** A page's value may also be an address on Core, shown whole: `{ address: '/v1/hook/somecrm/…' }`. */

/** Delivered like the other lifecycle events: the adapter puts these records on its list. */
type Refetch = { type: 'refetch'; connection: Connection; records: AdminRecord[] };
```

The engine hands the descriptions on as they are, with each thing named and linked and each
address made whole (from `PUBLIC_URL`), and runs the actions the adapter declared; it never
inspects what they mean, and no CRM is named in `engine/` or in `admin/src` — the seam check
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
