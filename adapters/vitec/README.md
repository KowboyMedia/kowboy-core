# Vitec adapter

The Vitec Connect adapter (strategy §5.3). Everything Vitec-specific lives here: authentication,
the endpoints, the webhook listener, the fetch list, the two schedules and the mappers. The engine
sees only the adapter API. The documentation it is built from is `docs/inputs/vitec/`.

```
index.ts        the adapter: webhook route, fetch loop, schedules, lifecycle, health
api.ts          Connect over HTTP: basic authentication, list paging, records by id, one request budget
store.ts        the adapter's own tables: the fetch list, the ids seen per customer, state per connection
mappers.ts      Connect payloads → the universal model: the universal names, the spine, the rest mirrored (see below)
test/connect.ts a stand-in Connect for the tests
admin/index.ts  its panels in the admin panel: webhook URL, schedules, the fetch list, one record looked at or queued
vitec.test.ts   the adapter against the real engine and the stand-in
```

## How it works

- **Scope.** Core syncs what Vitec lists for the sites, the marketed estates, and nothing else
  (Patric, 2026-09-17). In the list: on the sites. A `Remove` notification, or an id gone from the
  list: removed, without a fetch. Nothing here reads a field's value.
- **Webhooks.** Vitec POSTs its notification (`type`, `event`, `customerId`, `id`) to
  `/v1/hook/vitec/webhook/<VITEC_WEBHOOK_TOKEN>`, and Vitec's QA environment to
  `/v1/hook/vitec/qa/<VITEC_WEBHOOK_TOKEN>`. The record goes on the fetch list and the answer
  is 202 at once; nothing is fetched inside the request. Types carried: `Estate`, `Project`,
  `User` (also `Agent`), `Office`, `Area`; any other type is answered 202 and ignored. An `Update`
  is fetched; a `Remove` tombstones the record. The estate subscription at Vitec is limited to
  estates advertised on the website, so `Update` means marketed and `Remove` means not any more;
  the last signal for a record wins.
- **The fetch list** is the table `vitec_fetch_list`, shared by the web process, which accepts
  webhooks, and the worker, which fetches. A record listed twice is kept once; signals from Vitec
  (webhooks and removals) go before loads and catch-ups. Up to five Connect requests run at once (`VITEC_FETCH_CONCURRENCY`),
  lists included. A failed fetch is retried with exponential backoff (10 s, doubling) and never
  treated as a delete; after six failures the record waits for the next signal or an operator, and
  a `fetch.failed` event is logged and the error reported through the adapter API. A record is
  fetched once and ingested into every connection that syncs its office in the same system,
  live Vitec or QA.
- **Initial load.** `connection_added` lists everything the connection's offices publish, in
  reference order (offices, agents, areas, projects, properties), and puts it on the list;
  `offices_added` does the same for the added offices only. Associations have no list endpoint: they are fetched when a property names one.
- **Catch-up.** Every 12 h per connection, and at every worker start: what changed since the
  previous window, less one hour of overlap, fetching only records whose change date moved since
  their last fetch. A connection the worker has never caught up is listed in full.
- **Comparison.** Once a day per connection, and at every worker start: Vitec's full id list
  against the ids seen. An id the list no longer holds is removed, without a fetch: the list
  defines what exists for the sites. A `Remove` whose webhook was lost is caught here.
- **Which offices are synced** (`offices.ts`; questions 147 a and 154, 2026-10-06). Once a day per
  connection, at every worker start, and at the next tick after "Fetch offices": Vitec's office
  list for the login's customer or group id (`customer_id` in the login, `M30011` or `G2`), each
  listed office read on its own under its own customer id (the one its record gives: a group's list
  rows may leave it out), and the brokerage's office groups
  (`GET CRM/Officegroups/{id}`, the version 1 CRM category, with the same login: one username
  and one password for every call, Patric 2026-10-06). The offices that read and sit in the group "webbplats" (any case) are synced; with no
  such group, or none of its offices readable, every office that reads is. An office that came is
  loaded; one that went is tombstoned with all its records (`presentIds` per datatype, scoped to the
  office), so each site deletes it at its next sync. A check Vitec did not answer (down, busy,
  broken) keeps the last offices and is tried again within the hour. An office Vitec refuses (401
  or 403, on its own or with its whole id; question 158 b) stays synced for a day of grace
  (`REFUSAL_GRACE_MS`, the first refusal's time carried from check to check) and is taken off when
  the refusal still stands at the next daily check; a refusal at any fetch makes the next tick
  check the offices (`checkSoon`, as the button does). A group id (`G12`) is never synced as an
  office, not even from an answer saved before question 156 a: listing homes, agents or areas
  under a group is not asking for one office, and Vitec answers its areas with an error. The
  answer is kept in `vitec_state` and shown on the tenant's page.
- **Vitec's QA environment** (question 169 a, 2026-10-06). A login whose field `qa` is `yes`
  (any case; any other value, or none, is live Vitec) is for Vitec's QA environment, its test copy
  of Connect: every call of it, its forms included, goes to `https://connect-qa.maklare.vitec.net`
  (`api.ts`; the address Patric remembered, unconfirmed until a QA login answers), and its
  notifications arrive at `/v1/hook/vitec/qa/…`. QA may hold the same office ids as live Vitec, so
  the adapter's lists keep a QA office as `qa:<office id>` (`store.ts`): a QA notification, fetch,
  seen id, comparison or refusal never touches live Vitec's office of the same id, and the live
  rows are as they were. Each system has its own requests at once, requests per second and
  Retry-After, and drains its own part of the fetch list, so a slow or busy QA never holds up live
  Vitec's fetches; a connection whose start-up round fails runs it again alone, so a QA that is
  down never makes live Vitec list everything each minute, and its offices are checked once per
  start, never on a retry, so a refused office still gets one call a day. Each office check
  records the system it asked; a saved login switched to the other system syncs no office until
  the worker's next tick, which takes every office of the last check off the sites
  (`office.taken_off`, "the login was switched to …"), clears its state, and checks and loads its
  offices in full. An office change from the admin waits for the tick's turn, so nothing is
  taken off twice. The Vitec page's fetch list and refused
  offices, and the names in `vitec.offices`, mark a QA office "(QA)". Give a QA login a tenant of
  its own: its records reach that tenant's sites like any other. `qa.test.ts` proves it with two
  stand-ins sharing one office id.
- **Resync** (`event: resync`, optionally with a datatype) reloads everything listed and removes
  every id no longer listed.
- **Health.** `vitec.webhook_lag` (a webhook waiting more than 5 min), `vitec.retries` (a record
  that failed three fetches in a row), `vitec.catch_up` (red from a worker start until the
  catch-up, the comparison and their fetches are done; then a connection whose last catch-up is
  older than 13 h, whose credentials cannot be read, or which has no office to sync). The checks run in
  the worker and are recorded for the web process every 30 s.

## Mappers: the universal names, the spine on top, the rest mirrored

`data` is the universal record (`docs/field-tables.md`, approved by Patric on 2026-09-19): Connect's
fields copied and renamed onto the universal names, with the spine on top: `id`, `office_id`,
`agent_ids`, `area_ids`, `association_id`, `project_id` on a property; `office_ids` on an agent;
`office_id`, `agent_ids`, `area_ids` on a project. Everything the tables do not name stays next to
them under its mechanical snake_case name (`docs/data-model-reference.md` lists every path), and
`raw` travels next to `data`, untouched. `remote_updated_at` is Vitec's `changedAt`. The office id
is what Connect calls the customer id (`M30011`): one office, one customer id, and `Office.Id` is
an alias of it (Patric, 2026-09-16); licensing filters on it, and Vitec's own office id stays in
`raw`. Nothing is chosen and nothing is judged: an enumeration is copied as `{id, name}`, a bare
Swedish wall-clock time becomes a UTC moment, an image's address is built on Kowboy's CDN from the
ids Vitec gives (strategy §12.28), the first building's sizes are lifted onto the property and
every building is carried, and `display` is the engine's, computed from the universal record by
the rules ledger. `mappers.test.ts` holds one Connect-shaped fixture per datatype.

## Setting up a connection

The directions are data the adapter describes for the admin panel (`admin/directions.ts`),
built from what the adapter reads and kept true by `admin/directions.test.ts`: the tenant, the
connection with the Connect key pair and the customer or group id, which offices reach the sites
(the office group "Webbplats" in Vitec, or every office) and how to tell the brokerage, the
notification URL and the subscriptions to ask Vitec for, and the health checks to watch. A
connection with no office to sync fetches nothing and `vitec.catch_up` says so. A connection is
saved with the engine's `upsertConnection` (the login as one JSON document
`{"username":"…","password":"…","customer_id":"…"}`, with `"qa":"yes"` for a login to Vitec's
QA environment, stored encrypted; a save puts the typed
fields over the stored ones) and loaded by queueing the lifecycle event `connection_added`, which
the worker delivers to the adapter: the adapter checks its offices with Vitec and loads them. The
connection's own office list stays empty (the manifest's `officesFromCrm`, question 156 a): the
tenant page draws no office field for Vitec, and the engine reads the list as empty.

## Forms from the sites (docs/forms.md)

`forms.ts` is the adapter's `submit` and `slots`: the web process hands it a site's form inside
the request and waits for Vitec's answer. The universal submission is copied onto Connect's own
calls, nothing read to decide anything: a lead (the free valuation) is
`POST v2/Advertising/Form/{customerId}/Valuation`, an interest is
`POST Advertising/Estate/{customerId}/{estateId}/interest`, a viewing booking is
`POST v2/Advertising/Form/{customerId}/Estate/{estateId}/Viewing/Attend`, and a search profile
is `POST Contacts/UpdatePerson` (whose duplicate check answers the existing or the new contact's
id) followed by `POST CRM/Contact/{customerId}/SearchProfile/Residential/{contactId}`, both in
the CRM function group. The customer id is the office Core filled in. A ticked "contact me about
my current home" (question 141 a) sends the valuation too, on the same person. The slots are
`GET v2/Advertising/Form/{customerId}/Estate/{estateId}` under the universal names, its bare
Swedish times read in Vitec's zone as the records' are. Nothing about forms is typed on a
connection (question 155): the lead source, the intake source and an interest's status are left
to Vitec, and a booking asks for an e-mail confirmation, no SMS and no reminder. Only the live service hands a form to the adapter (question 152). Vitec's 400, 404, 409 and 422 are a refusal with Vitec's words, scrubbed
of anything that looks like an e-mail address or a number; anything else is a failure. A call
Vitec could not take (5xx, 429, no connection) is tried twice more, after 1 s and 3 s, within
15 s of the form's start, and no call starts or lasts after that, so the visitor hears the last
answer while Core waits and nothing reaches Vitec after they were told it was not sent (question
165). Every call, each try included, is a `crm.call` event in the form's chain on the home's
timeline, without the body.
`forms.test.ts` proves it against the stand-in; the real send waits on a demo or test customer
Patric has confirmed (question 54 f), never the login in the environment.

## Environment

| Variable                    | Meaning                                                                                                           |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `VITEC_WEBHOOK_TOKEN`       | The secret in the webhook URL. Without it the listener answers 503.                                               |
| `VITEC_BASE_URL`            | `https://connect.maklare.vitec.net` unless the tests point it at the stand-in; QA's address is fixed in `api.ts`. |
| `VITEC_FETCH_CONCURRENCY`   | Connect requests at once, default 5, for live Vitec and QA each.                                                  |
| `VITEC_REQUESTS_PER_SECOND` | The speed limit towards Connect, default 10, for live Vitec and QA each; the tests raise it.                      |
| `DATABASE_URL`              | Where the adapter's own tables live (`vitec_fetch_list`, `vitec_known`, `vitec_state`).                           |

## Verified against Connect (2026-09-17)

A read-only probe (since removed) ran with the test account (open question 18):

- List paging counts from 0, `count` is the number of pages and a page past the end is empty. The
  lister stops after the last page.
- A made-up id is HTTP 404, so the tombstone path works as designed.
- The list holds every estate whose `marketing.isPublished` is true, whatever its sale status
  (`Sold` and `AssignmentWithdrawn` were both listed), and the list is the scope: what leaves it
  is removed from the sites, whether or not Vitec still answers it by id. Nothing in Core reads a
  field's value.
- An office's own id (`FIR31529`) is not its customer id (`M31529`): the office endpoint takes the
  office id, and a customer id in its place is 404. Core keeps the customer id as the office id
  (Patric, 2026-09-16), so an office item's `remote_id` is Vitec's office id and its `data.id` the
  customer id. Agent list rows carry no customer id, only their offices.

Verified 2026-09-18 (read-only, the test account): `changedAt` is Swedish wall-clock time with no
offset (`2026-08-31T11:46:09.65`), UTC+1 in winter and UTC+2 in summer. A `changedAtMinValue`
with an explicit offset is honoured (`…Z` and the same moment as `…+02:00` return the same rows),
and a bare one is read as Swedish time. The mappers therefore read a bare `changedAt` in
`Europe/Stockholm` and send the catch-up window with its offset, so no clock is compared with
another (strategy §6).

Not verified: what an `Office` notification carries as `id`, the office id or the customer id. A
customer id would fetch a 404 and change nothing; the next catch-up carries the change. A webhook
accepted and then lost to a crash before its fetch ran is picked up by the next catch-up, not
sooner.

## Events on a record's timeline

Every notification's arrival is an event, `webhook.received`, with its outcome (queued, ignored,
rejected) and the office, datatype and id it named; a queued one carries the correlation id that
the fetch and the write then share, so the record's timeline runs from Vitec's call to the bell.
Every call to Connect is an event too, `crm.call`: endpoint, query, status, duration, answer size,
and the start of the answer when it was an error or broken JSON (question 9, 2026-09-18).

## When Vitec misbehaves

Vitec has had timeouts, broken answers, and offices that close without notice, whose every request
then answers 403 and whose hammering got Core blocked (Patric, 2026-09-18). The adapter guards
itself, all of it inside the adapter:

- **A refused office (401 or 403)** is blocked at the first refusal: nothing more is asked for it,
  and its waiting records are parked. The first refusal also holds every other fetch of the same
  login and has the office check run at the next tick, so a revoked login costs one refused call,
  not one per office. That check settles the blocks (an office it finds refused, on its own or with
  the whole id, stays blocked; one that reads again is unblocked and loaded in full, so nothing that
  happened meanwhile is missed) and releases the hold; a listing the hold cut short runs again, and
  a load it cut short is finished after the check. From then on the office check, once a day, is
  the only call that asks about a blocked office, and it asks for the office groups only when the
  id's own list answered (question 161 a). A cancelled brokerage so costs about six refused calls
  on the first day and one a day after, which also brings it back by itself when Vitec answers
  again. A refused office stays on the sites for a day and is then taken off (question 158 b, under
  "Which offices are synced"). `vitec.offices` is red while an office is blocked, and the panel
  lists the blocked offices; "Fetch offices" on the tenant's page asks at once. A block and its
  end are logged (`office.blocked`, `office.unblocked`) once for each connection that syncs the
  office in that system, and a check settles the blocks before it takes offices off. The offices
  one check takes off for one reason, or one switch takes off, share one correlation id on their
  `office.taken_off`, so the super admin's notifications tell one cause once.
- **Vitec down, busy or unreachable** (timeouts, 5xx, 429, network errors) and **broken answers**
  count per connection: after five in a row the connection pauses, two minutes doubling to thirty,
  and shows red in `vitec.connect`. When the pause runs out the next fetches go through as a probe;
  one more failure pauses again, a success ends it. Each record is still retried with growing waits
  and given up after six attempts, for the panel's Retry or Drop.
- **A broken answer** keeps the start of what Vitec sent in the `crm.call` event, so the cause can
  be read afterwards; nothing half-parsed is ever written, and the last good version stays.
- **A speed limit** of ten requests a second (`VITEC_REQUESTS_PER_SECOND`), five at once
  (`VITEC_FETCH_CONCURRENCY`), and Vitec's own `Retry-After` honoured for up to five minutes.
