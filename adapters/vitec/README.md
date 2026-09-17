# Vitec adapter

The Vitec Connect adapter (strategy §5.3). Everything Vitec-specific lives here: authentication,
the endpoints, the webhook listener, the fetch list, the two schedules and the mappers. The engine
sees only the adapter API. The documentation it is built from is `docs/inputs/vitec/`.

```
index.ts        the adapter: webhook route, fetch loop, schedules, lifecycle, health
api.ts          Connect over HTTP: basic authentication, list paging, records by id, one request budget
store.ts        the adapter's own tables: the fetch list, the ids seen per customer, state per connection
mappers.ts      Connect payloads → the universal model (the technical spine only, see below)
test/connect.ts a stand-in Connect for the tests
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
- **Resync** (`event: resync`, optionally with a datatype) reloads everything listed and removes
  every id no longer listed.
- **Health.** `vitec.webhook_lag` (a webhook waiting more than 5 min), `vitec.retries` (a record
  that failed three fetches in a row), `vitec.catch_up` (red from a worker start until the
  catch-up, the comparison and their fetches are done; then a connection whose last catch-up is
  older than 13 h, whose credentials cannot be read, or which has no offices). The checks run in
  the worker and are recorded for the web process every 30 s.

## Mappers: the spine only

`data` holds identity, the references and nothing else today: `id`, `office_id`, `agent_ids`,
`area_ids`, `association_id`, `project_id` on a property; `office_ids` on an agent; `office_id`,
`agent_ids`, `area_ids` on a project. The descriptive fields wait for the field specification
(docs/next-steps.md item 2). `remote_updated_at` is Vitec's `changedAt`. The office id is what
Connect calls the customer id (`M30011`): one office, one customer id, and `Office.Id` is an alias
of it (Patric, 2026-09-16). Licensing filters on it.

## Setting up a connection

Credentials are one JSON document, the Connect key pair from the partner portal. The licensed
offices are the office ids (`M30011` and the like), and they are also what the adapter fetches: a
connection without offices fetches nothing and `vitec.catch_up` says so.

```bash
node dist/scripts/tenant.js add-connection acme-vitec t_acme vitec \
  '{"username":"…","password":"…"}' M30011,M30012
curl -X POST https://core.example/v1/admin/event -H 'x-admin-secret: …' \
  -d '{"connection_id":"acme-vitec","event":"connection_added"}'
```

Adding an office later: set the connection's offices, then `event: offices_added` with the new
ids; only those are loaded. Then ask Vitec for subscriptions (docs/inputs/vitec/notifications.md)
on `Estate` limited to estates advertised on the website (`Update` and `Remove`), and on
`Project`, `User`, `Office` and `Area`, pointing at
`https://<core>/v1/hook/vitec/webhook/<VITEC_WEBHOOK_TOKEN>`.

## Environment

| Variable                  | Meaning                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------- |
| `VITEC_WEBHOOK_TOKEN`     | The secret in the webhook URL. Without it the listener answers 503.                     |
| `VITEC_BASE_URL`          | `https://connect.maklare.vitec.net` unless the tests point it at the stand-in.          |
| `VITEC_FETCH_CONCURRENCY` | Connect requests at once, default 5.                                                    |
| `DATABASE_URL`            | Where the adapter's own tables live (`vitec_fetch_list`, `vitec_known`, `vitec_state`). |

## Verified against Connect (2026-09-17)

`scripts/vitec-probe.ts` ran read-only with the test account (open question 18):

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

Not verified: what an `Office` notification carries as `id`, the office id or the customer id. A
customer id would fetch a 404 and change nothing; the next catch-up carries the change. A webhook
accepted and then lost to a crash before its fetch ran is picked up by the next catch-up, not
sooner.
