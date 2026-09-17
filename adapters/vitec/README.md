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

- **Webhooks.** Vitec POSTs its notification (`type`, `event`, `customerId`, `id`) to
  `/v1/hook/vitec/webhook/<VITEC_WEBHOOK_TOKEN>`. The record goes on the fetch list and the answer
  is 202 at once; nothing is fetched inside the request. Types carried: `Estate`, `Project`,
  `User` (also `Agent`), `Office`, `Area`; any other type is answered 202 and ignored. A `Remove`
  is a fetch like any other: only Vitec answering 404 tombstones a record. Core carries every
  estate Vitec still answers, marketed or not (Patric, 2026-09-17); whether an estate is marketed
  is the clients' check on its marketing flags.
- **The fetch list** is the table `vitec_fetch_list`, shared by the web process, which accepts
  webhooks, and the worker, which fetches. A record listed twice is kept once; webhooks are fetched
  before loads and catch-ups. Up to five Connect requests run at once (`VITEC_FETCH_CONCURRENCY`),
  lists included. A failed fetch is retried with exponential backoff (10 s, doubling) and never
  treated as a delete; after six failures the record waits for the next signal or an operator, and
  a `fetch.failed` event is logged and the error reported through the adapter API. A record is
  fetched once and ingested into every connection that licenses its office.
- **Initial load.** `connection_added` lists everything the connection's offices publish, in
  reference order (offices, agents, areas, projects, properties), and puts it on the list;
  `offices_added` does the same for the added offices only. Associations have no list endpoint:
  they are fetched when a property names one. Vitec's estate list holds the marketed estates
  only, so an unmarketed estate enters Core through its webhook or a preview, and the daily
  comparison keeps it fresh: an id seen but no longer listed is fetched, and kept while Vitec
  answers it.
- **Catch-up.** Every 12 h per connection, and at every worker start: what changed since the
  previous window, less one hour of overlap, fetching only records whose change date moved since
  their last fetch (Vitec's `changedAt` string, compared verbatim). A connection the worker has
  never caught up is listed in full.
- **Comparison.** Once a day per connection, and at every worker start: Vitec's full id list
  against the ids seen. A missing id is fetched to confirm; a 404 tombstones it, a 200 keeps it.
  Nothing is tombstoned blind.
- **Extensions.** An estate is fetched with every extension but the two agents, who are their
  own items (proposal point 7; question 26 asks whether to embed them anyway); a project's only
  extensions are those two, so projects are fetched bare. `$estate` adds nothing.
- **Resync** (`event: resync`, optionally with a datatype) reloads and reports the listed ids as
  present, so the engine tombstones whatever Vitec no longer lists.
- **Health.** `vitec.webhook_lag` (a webhook waiting more than 5 min), `vitec.retries` (a record
  that failed three fetches in a row), `vitec.catch_up` (red from a worker start until the
  catch-up, the comparison and their fetches are done; then a connection whose last catch-up is
  older than 13 h, whose credentials cannot be read, or which has no offices). The checks run in
  the worker and are recorded for the web process every 30 s.

## Mappers: the spine only

`data` holds identity, the references and nothing else today: `id`, `office_id`, `agent_ids`,
`area_ids`, `association_id`, `project_id` on a property; `office_ids` on an agent; `office_id`,
`agent_ids`, `area_ids` on a project. The descriptive fields wait for the field specification
(docs/next-steps.md item 2). `remote_updated_at` is Vitec's `changedAt`, which Connect writes as
Swedish wall-clock time without an offset and the mapper reads as Europe/Stockholm. The office id
is what Connect calls the customer id (`M30011`): one office, one customer id (Patric,
2026-09-16), and licensing filters on it. The office record has an id of its own (`FIR30011`),
which every office reference carries beside the customer id and which the record is fetched by:
an office item's `remote_id` is that id, its `data.id` the customer id.

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
on `Estate` for every estate, not only those advertised on the website, with `Update` and
`Remove`, and on `Project`, `User`, `Office` and `Area`, pointing at
`https://<core>/v1/hook/vitec/webhook/<VITEC_WEBHOOK_TOKEN>`. The restriction matters: an estate
Vitec does not market is not in its list, so its webhook is the only way it reaches Core.

## Environment

| Variable                  | Meaning                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------- |
| `VITEC_WEBHOOK_TOKEN`     | The secret in the webhook URL. Without it the listener answers 503.                     |
| `VITEC_BASE_URL`          | `https://connect.maklare.vitec.net` unless the tests point it at the stand-in.          |
| `VITEC_FETCH_CONCURRENCY` | Connect requests at once, default 5.                                                    |
| `DATABASE_URL`            | Where the adapter's own tables live (`vitec_fetch_list`, `vitec_known`, `vitec_state`). |

## Verified against Connect

`scripts/vitec-probe.ts` runs this client read-only against the test account. On 2026-09-17 it
settled: list pages count from 0, `count` is the number of pages, a page past the end is HTTP 200
with no rows, a made-up id is HTTP 404, ids are case-insensitive in URLs, dates are Swedish
wall-clock time without an offset, an office record's `id` (`FIR31529`) is not its `customerId`
(`M31529`), the extensions above, and that the estate list holds marketed estates only: a sold
estate still marketed is listed and answered 200. The stand-in in `test/connect.ts` follows all of
it. A webhook accepted and then lost to a crash before its fetch ran is picked up by the next
catch-up or comparison, not sooner.

## Previews

The agent's "Förhandsgranska" in Express opens Vitec's preview landing page
(docs/inputs/vitec/advertising-preview.md), which calls two GET endpoints here, both with
`?customerId=…&estateId=…` appended by Vitec:

- `/v1/hook/vitec/preview/init/<VITEC_WEBHOOK_TOKEN>` puts the estate on the fetch list, first in
  line, and answers `{ "url": … }`: the site's preview link when the estate is known already, so
  Vitec can show the current page meanwhile, else null.
- `/v1/hook/vitec/preview/verify/<VITEC_WEBHOOK_TOKEN>`, polled by Vitec, answers
  `{ "isReady": true, "url": … }` once that fetch has found the estate, `{ "isReady": false }`
  while it runs, or `{ "isReady": false, "errorMessage": … }`, in Swedish for the agent, when the
  office is not connected, the estate is not in Vitec, the fetch gave up, or the tenant has no
  site.

The url is the site's preview link, which the engine makes from the tenant's bell endpoint and a
token the site checks with its bell secret (strategy §5.3, AC 42); the site pulls from Core before
it shows the estate, so what the agent sees is what Vitec held at the click. Give Vitec both URLs
together with the webhook URL. The fetch records how it ended for a waiting preview in
`vitec_preview`.
