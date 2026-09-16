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
  is a fetch like any other: only Vitec answering 404 tombstones a record.
- **The fetch list** is the table `vitec_fetch_list`, shared by the web process, which accepts
  webhooks, and the worker, which fetches. A record listed twice is kept once; webhooks are fetched
  before loads and catch-ups. Up to five Connect requests run at once (`VITEC_FETCH_CONCURRENCY`),
  lists included. A failed fetch is retried with exponential backoff (10 s, doubling) and never
  treated as a delete; after six failures the record waits for the next signal or an operator, and
  a `fetch.failed` event is logged. A record is fetched once and ingested into every connection
  that carries its customer id.
- **Initial load.** `connection_added` and `offices_added` list everything the connection's
  customers publish, in reference order (offices, agents, areas, projects, properties), and put it
  on the list. Associations have no list endpoint: they are fetched when a property names one.
- **Catch-up.** Every 12 h per connection: what changed since the previous window, less one hour
  of overlap. A connection the worker has never caught up (for example one that existed before the
  worker started) is listed in full.
- **Comparison.** Once a day per connection: Vitec's full id list against the ids seen. A missing
  id is fetched to confirm; the 404 tombstones it. Nothing is tombstoned blind.
- **Resync** (`event: resync`, optionally with a datatype) reloads and reports the listed ids as
  present, so the engine tombstones whatever Vitec no longer lists.
- **Health.** `vitec.webhook_lag` (a webhook waiting more than 5 min), `vitec.retries` (a record
  that failed three fetches in a row), `vitec.catch_up` (a connection whose last catch-up is older
  than 13 h, or whose credentials cannot be read).

## Mappers: the spine only

`data` holds identity, the references and nothing else today: `id`, `office_id`, `agent_ids`,
`area_ids`, `association_id`, `project_id` on a property; `office_ids` on an agent; `office_id`,
`agent_ids`, `area_ids` on a project. The descriptive fields wait for the field specification
(docs/next-steps.md item 2). `remote_updated_at` is Vitec's `changedAt`. The office id is Vitec's
own `Office.Id`; licensing filters on it (open question 19).

## Setting up a connection

Credentials are one JSON document: the Connect key pair from the partner portal and the customer
ids the connection fetches.

```bash
node dist/scripts/tenant.js add-connection acme-vitec t_acme vitec \
  '{"username":"…","password":"…","customer_ids":["M30011"]}' [office-id,office-id]
curl -X POST https://core.example/v1/admin/event -H 'x-admin-secret: …' \
  -d '{"connection_id":"acme-vitec","event":"connection_added"}'
```

Licensed offices are Vitec office ids; empty means every office of those customers. Then ask Vitec
for subscriptions (docs/inputs/vitec/notifications.md) on `Estate` (published for the website,
`Update` and `Remove`), `Project`, `User`, `Office` and `Area`, pointing at
`https://<core>/v1/hook/vitec/webhook/<VITEC_WEBHOOK_TOKEN>`.

## Environment

| Variable                  | Meaning                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------- |
| `VITEC_WEBHOOK_TOKEN`     | The secret in the webhook URL. Without it the listener answers 503.                     |
| `VITEC_BASE_URL`          | `https://connect.maklare.vitec.net` unless the tests point it at the stand-in.          |
| `VITEC_FETCH_CONCURRENCY` | Connect requests at once, default 5.                                                    |
| `DATABASE_URL`            | Where the adapter's own tables live (`vitec_fetch_list`, `vitec_known`, `vitec_state`). |

## Not verified against Vitec yet (open question 18)

- Whether page numbering starts at 0 or 1: the lister stops on an empty page or two pages without
  new ids, so either works.
- What a record by id returns once an estate is withdrawn from the website: a 404 tombstones it, a
  200 keeps it with whatever status it carries.
- A webhook accepted and then lost to a crash before its fetch ran is picked up by the next
  catch-up, not sooner.
