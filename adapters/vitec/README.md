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
  `/v1/hook/vitec/webhook/<VITEC_WEBHOOK_TOKEN>`. The record goes on the fetch list and the answer
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
  fetched once and ingested into every connection that licenses its office.
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
  connection, at every worker start, and at the next tick after "Check offices now": Vitec's office
  list for the login's customer or group id (`customer_id` in the login, `M30011` or `G2`), each
  listed office read on its own under its own customer id, and the brokerage's office groups
  (`GET CRM/Officegroups/{id}`, the version 1 CRM category, with the CRM password when one is
  typed). The offices that read and sit in the group "webbplats" (any case) are synced; with no
  such group, or none of its offices readable, every office that reads is. An office that came is
  loaded; one that went is tombstoned with all its records (`presentIds` per datatype, scoped to the
  office), so each site deletes it at its next sync. A check Vitec did not answer (down, busy,
  broken) keeps the last offices and is tried again within the hour. Offices typed on the
  connection win while there are any; the engine adds and removes those (`offices_added`,
  `offices_removed`). The answer is kept in `vitec_state` and shown on the tenant's page.
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
`{"username":"…","password":"…","customer_id":"…"}`, stored encrypted; a save puts the typed
fields over the stored ones) and loaded by queueing the lifecycle event `connection_added`, which
the worker delivers to the adapter: with no office typed, the adapter checks its offices with
Vitec and loads them. Offices typed on the connection still work as before: set them, then queue
`offices_added` with the new ids; only those are loaded.

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
`GET v2/Advertising/Form/{customerId}/Estate/{estateId}` under the universal names. The
brokerage's own knobs are typed on the connection's page beside the key pair and copied through:
`send_forms` first (empty or `no` refuses every form before any call and writes nothing, so a
connection that reads a client's production office for testing is never written to; `yes` only
for a confirmed demo or test customer or a customer gone live), then `lead_source_id`,
`assignment_source_id`, `interest_status`, `confirm_by_email`, `confirm_by_sms`,
`reminder_minutes` and `crm_password` (the CRM function group's, when Vitec issued a separate
one). Vitec's 400, 404, 409 and 422 are a refusal with Vitec's words, scrubbed
of anything that looks like an e-mail address or a number; anything else is a failure. Every
call is a `crm.call` event in the form's chain on the home's timeline, without the body.
`forms.test.ts` proves it against the stand-in; the real send waits on a demo or test customer
Patric has confirmed (question 54 f), never the login in the environment.

## Environment

| Variable                    | Meaning                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------- |
| `VITEC_WEBHOOK_TOKEN`       | The secret in the webhook URL. Without it the listener answers 503.                     |
| `VITEC_BASE_URL`            | `https://connect.maklare.vitec.net` unless the tests point it at the stand-in.          |
| `VITEC_FETCH_CONCURRENCY`   | Connect requests at once, default 5.                                                    |
| `VITEC_REQUESTS_PER_SECOND` | The speed limit towards Connect, default 10; the tests raise it.                        |
| `DATABASE_URL`              | Where the adapter's own tables live (`vitec_fetch_list`, `vitec_known`, `vitec_state`). |

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
  its waiting records are parked, and one probe per cool-down (an hour, doubling to a day) checks
  whether it is back. Back means unblocked and loaded in full, so nothing that happened meanwhile is
  missed. Its records stay on the sites as they are until a person removes the office at the panel
  (question 38). `vitec.offices` is red while an office is blocked; the panel has "Probe now" and
  "Forget".
- **Vitec down, busy or unreachable** (timeouts, 5xx, 429, network errors) and **broken answers**
  count per connection: after five in a row the connection pauses, two minutes doubling to thirty,
  and shows red in `vitec.connect`. When the pause runs out the next fetches go through as a probe;
  one more failure pauses again, a success ends it. Each record is still retried with growing waits
  and given up after six attempts, for the panel's Retry or Drop.
- **A broken answer** keeps the start of what Vitec sent in the `crm.call` event, so the cause can
  be read afterwards; nothing half-parsed is ever written, and the last good version stays.
- **A speed limit** of ten requests a second (`VITEC_REQUESTS_PER_SECOND`), five at once
  (`VITEC_FETCH_CONCURRENCY`), and Vitec's own `Retry-After` honoured for up to five minutes.
