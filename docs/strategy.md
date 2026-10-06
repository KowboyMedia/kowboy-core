# Kowboy Core - Delivery Strategy

**Status:** v12 · Gate 1 approved 2026-09-15 (amended same day) · **Current phase: 3 - Engine**, built ahead of Gate 2 on Kowboy's instruction; Gate 2 still owed (§9) · **Inputs:** [Concept](inputs/Kowboy_Kore_Concept.md), [SRS v1.2](inputs/Kowboy_Kore_SRS_v1.2.md) (suggestions; amended by §12)

**Naming:** the product is **Kowboy Core**, or just **Core** (formerly "Kore"). The CRM-agnostic part inside it is called the **engine**. Every `Kore`/`kore` identifier in the SRS becomes `Core`/`core`, for example `X-Core-Secret` and `/wp-json/core/v1/bell`.

## 1. Goal

Get from the Concept and SRS to a production deploy of a simple, lean and reliable service.

- **Agents build, CI decides correctness.** Automated tests are the definition of done.
- **Humans approve behaviour, not code.** Approval happens at gates and per production release, based on plain-language reports.
- **Few hard blocks, clear guidance.** Only what protects production or the architecture blocks; everything else warns or guides (§3).

## 2. Architecture decisions

| Concern              | Decision                                                                                                                                                                                                                                                                                                                                                                                                                         | Why                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Language             | TypeScript strict, Node LTS                                                                                                                                                                                                                                                                                                                                                                                                      | One language for engine and adapters                                                                    |
| Processes            | One codebase, two roles: <br>• `web`: subscriber API, admin, health, plus any HTTP endpoints an adapter brings (e.g. Vitec's webhook listener) <br>• `worker`: adapter background work, bells, recompute                                                                                                                                                                                                                         | Requests stay fast whatever background work is running                                                  |
| Database             | Postgres, plain SQL migrations, no ORM                                                                                                                                                                                                                                                                                                                                                                                           | Fewest abstractions                                                                                     |
| Item storage         | One `items` row per entity, with two separate columns: <br>• `raw`: the CRM payload, untouched, served to subscribers next to `data` (2026-09-18) <br>• `data`: the universal model, with `display` and `provider_extras` inside, served verbatim                                                                                                                                                                                | `raw` enables recompute and preview without CRM traffic. Serving a precomputed `data` keeps reads fast. |
| Response compression | JSON responses are gzip-compressed at a low, fast level                                                                                                                                                                                                                                                                                                                                                                          | Cuts egress cost with little CPU                                                                        |
| Fetching strategy    | **Owned by each adapter** (§5). The engine has no queues, webhooks or schedules. An adapter that needs a queue keeps it in its own tables. No Redis.                                                                                                                                                                                                                                                                             | CRMs differ: some push webhooks, some must be polled                                                    |
| Event log            | Postgres `events` table, one table, rows older than 30 days deleted (§8.2). Both engine and adapters write to it through the adapter API.                                                                                                                                                                                                                                                                                        | Full visibility into the past, no new vendor                                                            |
| Contract             | One JSON Schema per datatype describing the current shape. TS types are generated from it at build time. Breaking changes use expand-contract (§6).                                                                                                                                                                                                                                                                              | Schema and code can't drift                                                                             |
| Tests                | Vitest against real Postgres in CI                                                                                                                                                                                                                                                                                                                                                                                               |                                                                                                         |
| Checks               | Few blocking checks; the rest are warnings (§3)                                                                                                                                                                                                                                                                                                                                                                                  |                                                                                                         |
| CI/CD                | GitHub Actions for the checks, enforced by branch protection on `staging` and `main`; App Platform deploys `staging` and `main` on every merge                                                                                                                                                                                                                                                                                   | One path for agents and humans: a pull request with green checks is the only way in                     |
| Monitoring           | `/v1/health`: 500 only while a P0 check fails, Core down for every customer, and 200 otherwise, the same payload either way (§8.1). Watched by an uptime monitor Kowboy runs (UptimeRobot or similar); Core sets up none itself (question 173).                                                                                                                                                                                  | Works with any monitoring tool                                                                          |
| Errors               | Sentry (EU) in Core (wired 2026-09-18, question 36: `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, no performance tracing, a gate so the same error leaves once a day whichever process hits it, kept in the database both processes share, and at most twenty distinct errors leave per app a day, since the plan holds 5,000 events a month in total) and, later, in both clients with projects of their own; without a DSN, stderr only. | One error surface, and no waiting on an account                                                         |
| WP client            | PHP 8.3, PHPStan, and the shared sync scenario suite run against a real WordPress install (no PHPUnit, no wp-env)                                                                                                                                                                                                                                                                                                                | One suite proves both clients against the real Core                                                     |
| Lovable client       | Supabase edge functions (Deno), Supabase CLI, staging and prod projects                                                                                                                                                                                                                                                                                                                                                          | Required by Lovable                                                                                     |
| Repo                 | `KowboyMedia/kowboy-core`: `engine/`, `adapters/<provider>/`, `clients/wordpress/`, `clients/lovable-kit/`, `schemas/`, `golden/`, `rules-ledger/`, `acceptance/`, `docs/`. The Lovable example site gets its own repo.                                                                                                                                                                                                          | CI runs real clients against the real Core                                                              |

### Hosting: supplied by Kowboy, not chosen by agents

Hosting is outside the agents' scope. Kowboy provisions the platform and hands over the connection details; the intended target is **DigitalOcean App Platform with managed PostgreSQL, EU region**. Agents build the app so it runs there: 12-factor config from the environment, separate `web` and `worker` commands, plain SQL migrations at startup, and no dependency on a specific vendor's APIs.

The platform must satisfy:

- **Billing:** no servers to manage, billed per instance or resource, not per invocation.
- **Region:** EU for both app and database.
- **Database:** managed Postgres with point-in-time recovery, in the same region.
- **Processes:** separate, horizontally scalable `web` and `worker`.
- **Deploys:** health-gated zero-downtime deploys and rollback.
- **Config and access:** infrastructure as code in the repo, and a CLI or API agents can drive.
- **Maturity:** a published SLA and strong operator reputation.

## 3. Simplicity and drift: what blocks and what guides

**Principle:** something only blocks if it protects production data, the architecture or the tests-are-acceptance model, and never produces false alarms. Everything else is a warning or a guideline.

### 3.1 Enforced: blocks merge or deploy

| #   | Check                                                                                                                                                                                                                                                        | Why it blocks                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| E1  | Build, typecheck and all tests pass. Skipped tests count as failures.                                                                                                                                                                                        | Tests are the acceptance                                                                  |
| E2  | **The seam.** <br>• The engine never imports or calls adapter code, and no CRM name appears in `engine/` or `clients/`. <br>• Adapters import only `engine/adapter-api/` and nothing else from the engine. <br>• Only the entrypoint `main.ts` imports both. | The core architecture. The adapter bends to the engine, never the other way round (§5.1). |
| E3  | **Protected paths need approval** (CODEOWNERS): `engine/adapter-api/`, `schemas/`, `acceptance/`, `rules-ledger/`, `golden/` (until go-live) and `AGENTS.md`                                                                                                 | Extending what adapters can do, and changing expectations, are human decisions            |
| E4  | No committed secrets (secret scan)                                                                                                                                                                                                                           | A leaked CRM credential can't be taken back                                               |
| E5  | The release impact preview finds no item failing the schema or invariants                                                                                                                                                                                    | Protects production data                                                                  |
| E6  | Production deploy needs human approval, and the health check must pass or the old version stays live                                                                                                                                                         | The release gate                                                                          |

### 3.2 Warnings: reported on the PR, never block

- Lint findings, including cognitive complexity per function
- Duplicate code
- Dead code: unused files, exports, functions, methods and dependencies
- `any` and lint suppressions
- New runtime dependencies (listed)
- Breaking schema changes (also flagged in the release report)

### 3.3 Automatic: no rule needed

Formatting is applied by the formatter. Line endings are fixed by `.gitattributes`. TS types are generated at build time.

### 3.4 Guidelines (AGENTS.md)

1. **Concept rules:** simple beats clever, the seam, all data logic in Core, tests are the acceptance, anything derived is patchable.
2. **The adapter bends to the engine.**
   - No CRM-specific branches, flags, config keys or workarounds in the engine, ever.
   - If an adapter needs something the adapter API doesn't offer, the engine gets a new _generic_ capability that any adapter could use. That needs approval (E3).
3. **No legacy access.** Under no circumstances are code or concepts taken from the WordPress plugins v1, v2 or v3 unless Patric explicitly asks or approves, item by item (2026-09-19).
4. **One code path per concern.** No options or flags for cases that don't exist.
5. **Readable code.** Understandable from a few files. Avoid framework-style layers.
6. **Leave files you touch free of warnings.**
7. **Never invent business rules. Never edit expected outputs to make a test pass.**
8. **Breaking contract changes use expand-contract** (§6).
9. **Naming, layout, decision log, stop-and-ask.**

**Considered and rejected; do not reintroduce:**

- code-size budgets and file-size limits
- bans on language features
- an AI reviewer gate
- scheduled drift audits
- maintaining golden masters after go-live
- schema versions and down-converters
- automated contract gates tied to client versions
- queues, webhooks or schedules in the engine
- catch-up on worker start
- Redis

## 4. Pipeline and release gate

```
PR ──► CI: E1–E4 block · warnings reported
push staging ──► auto-deploy STAGING (Core + staging WP site + staging Lovable site) ──► smoke suite
             ──► release report
confirm on staging ──► pull request into main ──► CI ──► merge ──► PRODUCTION (health-gated; old version stays live on failure)
```

**The release report** (plain language) contains:

- **What changed.**
- **Output impact preview.** A read-only dry run of the new mapping and rules over the raw payloads stored in production. It reports how many items would change, which fields, and before/after examples. No writes, no CRM calls. An item failing the schema or invariants blocks the release (E5).
- **Flags for the approver (information only):** adapter API extensions, breaking schema changes, new dependencies, and client versions currently pulling.
- **Links** to what to check on the staging sites, and acceptance status.

One approval promotes Core, the WP plugin channel and the Lovable kit. Every deploy tags a Sentry release.

Staging is its own app deploying the `staging` branch on every push, on the production cluster with
a database of its own; production deploys `main` on every merge. Branch protection on both
branches makes a pull request with green checks the only way in, for agents and humans alike; an
agent merges on Patric's word, a dev with the merge button (Patric, 2026-09-18).

**Until the final release, the pull request is off for `staging`** (Patric, 2026-10-03: it slowed
the work with clashes between branches). Every session works on `staging` itself: it fetches the
latest, runs the checks locally (build, typecheck, the tests), and pushes straight to `staging`;
CI still runs on what lands there. `main` keeps its protection, and the protected paths of E3 are
still changed only on Patric's word, asked in chat. The pull request returns with the final
release.

## 5. Engine and adapters

### 5.1 The seam

| Engine (knows no CRM)                                                              | Adapter (one per CRM)                                                                                             |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Storing `raw` and `data`, calling the adapter's mappers, business rules, `display` | Authentication, HTTP, endpoints, pagination, rate limits                                                          |
| Hash, `seq`, write ordering, tombstones, licensed-office filter                    | **Deciding when and how to fetch:** webhooks, polling, catch-up, and running its **own schedules and timers**     |
| Bells, subscriber API (compressed responses), recompute and replay                 | **Its own queue, dedupe and retries**, in its own tables, if it needs them                                        |
| Lifecycle events to adapters, event log, health endpoint                           | **Its own HTTP endpoints**, e.g. a webhook listener: route, signature check, and parsing the CRM's payload format |
|                                                                                    | Mappers from CRM payload to the universal model                                                                   |

**Every adapter, whatever its CRM, acts on a notification near-immediately** (Patric, 2026-09-21):
a webhook is answered at once and its record fetched within seconds, not at the next scheduled run.
A burst of notifications for one record is collapsed into one fetch, inside a window that is
bounded and stated in the adapter's README, never open-ended: batching absorbs a storm, it does not
delay the quiet case. The window is the adapter's own setting, so a test can hold it still while it
counts (`docs/known-bugs.md`, 1).

**The adapter API** (`engine/adapter-api/`) is the only part of the engine an adapter may use (E2). Changing it needs approval (E3). It offers:

| Function                                       | Meaning                                                                                                                                   |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `register(manifest, mappers)`                  | "I am provider X, I support these datatypes"                                                                                              |
| `ingest(connection, datatype, remoteId, raw)`  | "This is the record's current state." The engine maps, applies rules, and writes if changed. Returns `written`, `unchanged` or `dropped`. |
| `notFound(connection, datatype, remoteId)`     | "The CRM confirms this record is gone." The engine tombstones it.                                                                         |
| `presentIds(connection, datatype, scope, ids)` | "These are all the ids that exist in this scope." The engine tombstones the rest.                                                         |
| `onLifecycle(handler)`                         | Receive connection added/removed, offices added/removed, resync                                                                           |
| `logEvent(type, fields)`                       | Write to the event log                                                                                                                    |
| `healthCheck(name, fn)`                        | Add a named check to `/v1/health`                                                                                                         |
| `connections()`                                | The connections this provider owns, so an adapter can resume its own work after a restart                                                 |
| `report(error, context)`                       | Report an unexpected error to the error tracker (Sentry once wired) through the engine's own reporting; never with credentials            |

Every call is idempotent. The engine never calls back into CRM-specific code except through the mappers, lifecycle handlers and submission handlers (`submit`, `slots`; docs/forms.md) the adapter registered.

**Two processes.** `web` serves HTTP; `worker` runs the adapters. An admin call such as `connection_added` or `resync` is queued by `web` in the `lifecycle_events` table and delivered by `worker` every 2 s (the transactional outbox, one table, polled). `worker` records the adapters' health checks in `health_results` every 30 s and `web` reports them; a report older than 2 min counts as failed. For a form submission, `web` calls the CRM through the adapter and waits for the answer inside the request (docs/forms.md, the departure approved with question 130, built 2026-10-04): the one place the web process talks to a CRM.

**Startup.** A tiny entrypoint, `main.ts`, is the only file that imports both the engine and the adapters.

1. It starts the engine.
2. It mounts each adapter's own HTTP endpoints, if any, on the web server.
3. It calls each adapter's `start(api)`, where the adapter sets up its own timers and background loops.

The engine has no scheduler.

### 5.2 Engine write path (identical for every adapter)

`ingest` → map → rules and `display` → licensed-office filter → hash → if unchanged: stop (no `seq`, no bell) → otherwise write with a new `seq` → log the event → bell.

**Write ordering (why a lock exists).** Subscribers read "everything after `seq` N".

- **The risk:** if two writes commit at the same time and a higher `seq` becomes visible before a lower one, a subscriber can move past the lower one and skip an item forever.
- **The fix:** each write takes a short global transaction lock (milliseconds), so `seq` order equals commit order.
- **It never bottlenecks:** CRM rate limits cap fetches far below what a single writer handles.

**Bells** are throttled per subscriber:

- **Leading edge:** the first change after a quiet period rings immediately.
- **Trailing edge:** further changes within 10 s collapse into one bell.
- **Where the state lives:** on the subscriber row (`last_bell_at`, `bell_pending`), so any number of web and worker processes agree. The worker sends trailing bells once a second.

However many records adapters ingest, a subscriber gets at most one bell per window.

### 5.3 Vitec adapter: webhooks plus a separate catch-up schedule

The Vitec adapter has **two independent paths**. Both live inside the adapter. Other adapters may work completely differently; Mspecs, for example, might only poll.

**Path 1 - Webhooks (fast, simple):**

```
Vitec webhook ──► check signature ──► add "fetch record X" to the adapter's fetch list ──► reply 202
adapter worker ──► fetch X from Vitec ──► found: ingest · gone: notFound · failed: retry later
```

- **The listener is entirely Vitec adapter code:** the endpoint, its route, the signature check and Vitec's payload format. The engine never sees a webhook request.
- **Why a fetch list instead of fetching inside the webhook request:** if Vitec sends thousands of webhooks at once (it has happened during bugs), the list absorbs them without crashing, and the worker fetches at the rate Vitec allows.
- **Duplicates:** the same record listed twice is kept once.
- **Retries:** a failed fetch is retried with backoff and reported to Sentry after the last attempt. It is never treated as a delete. The adapter also guards itself against a flaky Vitec (2026-09-18): a connection pauses after five failures in a row and probes its way back with growing waits, an office Vitec refuses (401 or 403) is blocked at once and the rest of its login held until the daily office check has looked, which is then the only call that asks about it and loads it in full when it is back (question 161 a), a broken answer is kept in the event and retried, and requests are capped per second with Vitec's own Retry-After honoured. A refused office stays on the sites for a day and is then taken off with everything of it (question 158 b).

**Path 2 - Catch-up (rare safety net, separate schedule):**

- **Why it exists:** a webhook can be lost, for example if Core was down or restarting when Vitec sent it, or Vitec failed to send it. Without a safety net, that record would stay out of date until it changed again.
- **What it does:** on its own **12 h** timer, the adapter asks Vitec "which records changed since the last catch-up?". The window starts **1 h before** the previous run ended, so nothing slips through the gap between runs. Those records go on the same fetch list, after any webhook fetches, except records whose change date has not moved since their last fetch. The same catch-up, and the daily id comparison, also run at every worker start (§7.2).
- **Records that didn't actually change** are recognised by the engine (same hash), so they get no new `seq`, no bell and reach no site.
- **Missed deletes:** once a day the adapter compares Vitec's full id list with the ids it has seen and removes what the list no longer holds: the list defines what exists for the sites (Patric, 2026-09-17).
- **Need it sooner?** An operator can trigger a `resync` event.

### 5.4 Adapter health checks (registered through the API)

Vitec registers:

| Check               | Fails when                                                                                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vitec.webhook_lag` | Any webhook received more than **5 min** ago hasn't been fetched and ingested yet                                                                                    |
| `vitec.retries`     | Any record has failed **3 fetches in a row**. It clears on a successful fetch or when an operator discards the record.                                               |
| `vitec.catch_up`    | The worker has started and its catch-up, comparison and their fetches have not finished; or the last successful catch-up is older than 13 h (12 h plus a 1 h margin) |

## 6. Contract evolution: one shape, expand-contract

Core serves one shape: the current one. No versions, no converters, no automated gates.

- **Additive changes at any time.** Clients store unknown fields untouched, ignore them in templates, and handle unknown enum values safely. This is tested in the client contract suite.
- **A breaking change** (rename, remove, retype, changed meaning) is done as **expand → migrate → contract**, three ordinary releases:
  1. **Expand:** add the new field next to the old one.
  2. **Migrate:** release clients that use the new field.
  3. **Contract:** remove the old field in a later release. The release report flags the removal and lists client versions currently pulling; the approver decides.
- **Safety net** (SRS §8): a client that receives an item it can't use reports it to Sentry, skips it and keeps serving its local data.
- **Client version header.** Clients send `X-Core-Client: <client>/<version>` on every pull. It is logged and shown in the release report.
- **Time is one clock per comparison.** Every timestamp in the contract and in storage is a moment (UTC with an explicit offset, `date-time`), never a wall-clock time: hosts, databases, PHP and CRMs each keep their own zone. Nothing is compared across two clocks: sync keys on `seq`, and each client's rebuild sweep uses its own database clock on both sides. The one place two clocks meet, the catch-up window an adapter sends to its CRM (§5.3), carries an explicit offset, overlaps by an hour and is verified once per CRM. Which zone a time is shown in is decided where it is shown (the panel: Swedish time).

## 7. Onboarding, deletes, patching, purge and resync

### 7.1 Initial sync

| Situation                                   | Operator action                                              | What happens                                                                                                                      |
| ------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **New tenant**                              | Add tenant and connection, then `event: connection_added`    | The engine notifies the adapter. The adapter loads all licensed offices its own way (Vitec: onto the fetch list, after webhooks). |
| **New office in existing tenant**           | Add to `licensed_offices`, then `event: offices_added`       | The adapter loads only that office's records, plus referenced tenant-wide records that are missing.                               |
| **New subscriber on existing tenant**       | Add subscriber                                               | The subscriber pulls from `after = 0` out of Core's store. Engine only, no CRM traffic.                                           |
| **Office removed / connection deactivated** | Update, then `event: offices_removed` / `connection_removed` | The engine tombstones the affected items.                                                                                         |

### 7.2 Deletes and recovery

- **Soft delete.** A deleted entity becomes a tombstone with a new `seq`. Tombstones are hard-deleted after 90 days, and Core keeps a purge watermark per tenant.
- **Stale cursor.** A subscriber behind the watermark gets _resync-required_. It pulls everything, then deletes local items not seen, only after a complete, successful pull.
- **Resync with sweep (operator).**
  1. `event: resync`.
  2. The adapter re-fetches the scope and reports `presentIds`.
  3. The engine tombstones anything not present.
- **Purge and resync (operator).** For broken stored data. The engine discards the scope's rows, then sends `resync`. Subscribers keep serving local data until the rebuild completes.
- **Restore (operator).** Restore the database in the platform and restart the app; nothing else. Every engine start moves the item sequence 1,000,000,000 ahead, so a restored database never hands out a `seq` a subscriber has already seen: nothing is skipped, nothing below a subscriber's cursor is served, and a subscriber keeps what it holds until the CRM's current state arrives. Every worker start runs the adapters' catch-up and id comparison, so Core converges within minutes, deletions confirmed by fetch. From the restart until every adapter has caught up, fetches included, `/v1/health` answers `ok: false` with an adapter's check saying it is catching up (P3, so the answer stays 200; question 172), while `/v1/ready` stays green so the platform keeps the app. Send no `forcerefresh` until that check passes: a rebuild in those minutes would delete what Core has not re-fetched yet.
- **App and database versions.** Migrations are additive, so any app version runs on any newer database. `/v1/health` turns `schema` red when the database holds a migration the app does not ship, which says how far back the app may be rolled.
- **Hard rule:** no operator action may make a subscriber empty its store as a side effect.

### 7.3 Patching display or canonical data

- **Before release:** the release report previews the impact on production data (§4).
- **After the production deploy:** the engine automatically recomputes, in background batches, all rows with an older `rules_version`. It uses stored `raw`, no adapter calls and no CRM calls.
- **Changed rows:** rows whose hash changes get a new `seq`, bells go out as normal, and subscribers pull with their normal loop.
- **Unchanged:** unchanged rows and `remote_updated_at` are never touched.
- **Breaking shape changes** follow §6.
- **Template-only client changes** use a `forcerefresh` bell.

## 8. Health and debug visibility

### 8.1 `GET /v1/health` (no auth)

Returns **500 only while a P0 check fails, Core down for every customer, and 200 otherwise, with the same payload** (question 173), so an outside monitor reads an error as "Core is down". Every failing check has a level (question 172): P0 Core is down for every customer, P1 one customer's sites or forms are disrupted, P2 worth a look, P3 for the record only; a check that fails without one counts as P1. The body's `ok` is false while any check fails. It holds each check's `ok` and a sentence in counts and plain words, no tenant names and no level; the names and levels reach the alerts and the admin area. `GET /v1/ready` is the platform's readiness probe: `database` and `schema` only, so a deploy is never held up by a site that stopped fetching or an adapter still catching up.

```json
{
  "ok": false,
  "version": "1.4.0",
  "checks": {
    "database": { "ok": true },
    "schema": { "ok": true },
    "worker": { "ok": true },
    "subscribers": { "ok": true },
    "lifecycle": { "ok": true },
    "submissions.failing": { "ok": true },
    "vitec.webhook_lag": { "ok": false, "detail": "a webhook has waited 420 s" }
  }
}
```

| Engine check          | Level                | Fails when                                                                                                |
| --------------------- | -------------------- | --------------------------------------------------------------------------------------------------------- |
| `database`            | P0                   | The database is unreachable                                                                               |
| `schema`              | P0                   | The database holds a migration this app does not ship (§7.2)                                              |
| `worker`              | P0                   | No worker heartbeat for 2 min                                                                             |
| `subscribers`         | P1                   | Core told an active site of an active tenant about changes over an hour ago, and it has not fetched since |
| `lifecycle`           | P2, P1 after an hour | A queued lifecycle event has waited more than 5 min for the worker                                        |
| `submissions.failing` | P2                   | The latest form sent through a connection went unanswered by the CRM                                      |

Adapter checks are defined by each adapter (§5.4), each failing one with its level, run in the worker, recorded every 30 s and reported by `web`; a record older than 2 min counts as not run, so a restored database or a dead worker shows at once. A check that has not run, or that throws, is P2, P1 after 15 minutes, and counts under a failing P0 as P3 (rule B: one cause, one problem). Until question 178 the recorded level is not kept, so `web` shows a failing adapter check as P1; the worker's alerts use its own level. The names behind a count (`names` on a check) reach the alerts, not the public answer.

### 8.2 Event log: "what happened, where, and when"

Every event is one row in `events`. Each row carries a **correlation id** that links the whole chain: webhook → fetch → write → bell → pull. The same id is attached to Sentry errors.

| Event                                               | Written by | Metadata stored                                                                                                                                   |
| --------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `webhook.received`                                  | adapter    | connection, path, headers (secrets redacted), body as received, signature valid, records referenced, response code                                |
| `fetch.queued` / `deduped` / `started` / `finished` | adapter    | record, reason (webhook, catch-up, initial, resync), attempt, duration, outcome                                                                   |
| `crm.call`                                          | adapter    | method, endpoint and query (secrets redacted), status, duration, response size, rate-limit headers, error body on failure                         |
| `schedule.run`                                      | adapter    | catch-up window, records listed, queued, outcome                                                                                                  |
| `entity.written`                                    | engine     | entity, `seq`, old and new hash, **changed fields with before/after values**, `rules_version`; or `unchanged` / `dropped` (reason) / `tombstoned` |
| `bell.sent`                                         | engine     | subscriber, sent or throttled, status, duration                                                                                                   |
| `pull`                                              | engine     | subscriber, client version, datatype, `after`, items returned, duration                                                                           |
| `site.applied` / `site.failed`                      | engine     | what a site reported after a page (question 37): entity, `seq`, client version, and the reason when it could not apply the record                 |
| `admin.call` / `lifecycle.sent`                     | engine     | endpoint or event, parameters                                                                                                                     |

**Query:** the engine's timeline query (by entity, connection, subscriber, correlation id, type, from and to; `engine/events.ts`), which the panel will expose, returns for example:

```
10:02:01.120 webhook.received  vitec-acme  property OBJ-19203  sig=ok  202
10:02:01.131 fetch.started     reason=webhook attempt=1
10:02:01.402 crm.call          GET /estates/OBJ-19203  200  268ms  rl-remaining=412
10:02:01.455 entity.written    seq=48213  price: 4950000 → 4750000, display.price: "4 950 000 kr" → "4 750 000 kr"
10:02:01.470 bell.sent         acme-prod  500  1.2s
10:15:00.010 pull              acme-prod  wordpress/1.4.2  datatype=property after=48100 items=0 ← hasn't received it yet
```

- **Retention:** 30 days, deleted by the worker once an hour.
- **Access:** admin auth only, because bodies can contain personal data.

### 8.3 Admin panel

None today (2026-09-20): the first panel and its rebuild were removed because the rebuild had
inherited the first one's pages and flows. The next one is designed from the requirement sheets
(docs/admin-panel-rebuild.md §8) with its screens approved before any code, then built in slices
on the engine's functions and the adapter contract that stay (docs/admin-panel.md: jobs, the
streaming recompute, the records search, the numbered event log, alerts, `Adapter.admin` and the
`refetch` event). One place in the `web` process, behind a login; every change an audit event;
alerts by mail and Slack when a health check changes state; every user journey a browser test
(AC 42).

## 9. Phases and approval gates

| Phase                                                                                                                                                                                                 | Output                                                                                                                                              | Exit                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **0. Decide**                                                                                                                                                                                         | Strategy and acceptance criteria                                                                                                                    | **Gate 1: approved 2026-09-15**                                                               |
| **1. Foundation** ✔ done                                                                                                                                                                              | Repo tooling, §3 checks and warnings, Sentry placeholder, health endpoint, release gate, a "hello health" app                                       | Checks block a seeded violation, and the app serves `/v1/health` locally and in CI            |
| **1b. Deploy** ⏳ staging and production live (2026-09-17); Sentry waits on its account                                                                                                               | Staging and prod deployed on the platform Kowboy supplies, Sentry account wired up                                                                  | A trivial change goes PR → staging → approved → production, and a failing health check alerts |
| **2. Canonical model** ✔ Gate 2 approved 2026-09-19: the thin universal model (`docs/field-tables.md`), carried by `schemas/`                                                                         | JSON Schemas, a field table per datatype, dummy data (`golden/fake/`)                                                                               | **Gate 2:** field tables approved 2026-09-19                                                  |
| **3. Engine** ◄ current; the admin area built 2026-09-20 ([docs/admin-panel.md](admin-panel.md))                                                                                                      | Engine, adapter API, bells, recompute, health, event log, two fake adapters (one webhook-style, one polling-style), fake subscriber, the admin area | Engine acceptance criteria green ([report](../acceptance/report.md))                          |
| **4. Clients** ⏳ sync loops built 2026-09-15 ahead of Gate 2 (next-steps item 4); templates, example site and staging sites wait for the model                                                       | WP plugin, Lovable kit, example site, staging client sites                                                                                          | Client acceptance criteria green                                                              |
| **5. Real data** ⏳ ledger entries R-001 to R-014 approved 2026-09-19 (question 53); golden masters and the parity inventory wait on question 52                                                      | Humans supply real golden masters per CRM, rules ledger (§11), parity inventory, CRM docs and rate limits, test credentials                         | **Gate 3:** golden masters and ledger approved                                                |
| **6. Adapters** ⏳ Vitec fetch layer built 2026-09-16 ahead of Gate 2 (adapters/vitec/) and loading the test account on staging since 2026-09-18; `data` carries the universal names since 2026-09-19 | Vitec (webhooks, fetch list, catch-up) and Mspecs: golden masters first, then test accounts on staging                                              | Adapter acceptance criteria green                                                             |
| **7. Soak & go-live**                                                                                                                                                                                 | 7 days on staging with no unresolved Sentry issues, burst and load tests, restore drill, parity check                                               | **Gate 4:** first production tenant                                                           |

- **Golden masters are the acceptance for the initial build only.** They are retired at Gate 4.
- **After go-live, output correctness is protected by:**
  - rule-level tests
  - schema and invariant checks
  - the release impact preview on real data (§4)

**Golden-master case format** (initial build):

```
golden/<provider>/<datatype>/<case>/
  payload.json     CRM payload, untouched
  canonical.json   same entity in the universal data model
  display.json     human-readable output used by websites
```

## 10. Acceptance Criteria v1.10

### SRS AC 1-15, with clarifications

| AC  | Clarification                                                                                                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Initial build (until Gate 4): every golden-master case matches `canonical.json` and `display.json` exactly (canonical JSON: sorted keys, UTF-8) and validates against its schema.         |
| 2   | An unchanged record that is ingested again produces no new `seq` and no bell, whatever triggered the ingest (webhook, catch-up, resync).                                                  |
| 5   | Applies to the WP and Lovable clients too (AC 20).                                                                                                                                        |
| 8   | "Keep serving" means every page type returns 200 with the last synced content through a 24 h Core outage.                                                                                 |
| 9   | Also covers shrinking (AC 26).                                                                                                                                                            |
| 10  | Also covers a new enum value (§6).                                                                                                                                                        |
| 11  | The malformed record is also in the event log. Other records are still written.                                                                                                           |
| 12  | Two fake adapters, one webhook-style and one polling-style, work end to end using only the adapter API. The engine contains no CRM names, queues, webhook endpoints, schedules or timers. |
| 13  | The recompute runs automatically after a release that changes mapping or rules. Its impact was shown in the release report beforehand.                                                    |
| 14  | Also loads missing tenant-wide entities the new office references. Other offices get no new `seq`.                                                                                        |
| 15  | "Exactly" means zero new `seq` values when the mapper is unchanged.                                                                                                                       |

### Additions

| AC  | Criterion                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 16  | **Event log.** For a given entity, one query returns its full timeline across webhook, fetch, CRM call (with metadata), write (with changed fields), bell and pull, linked by correlation id. For each "not updated" cause (deduped, unlicensed, hash unchanged, malformed, not-found, fetch failed, bell throttled, bell failed, subscriber not pulling), the timeline shows the cause. Secrets are redacted. Events older than 30 days are gone.                                                                                                                                                                                   |
| 17  | **Health and alerting,** verified by injected faults on staging. Each engine and adapter check fails with `ok: false` and its level (question 172): a failing P0 check turns `/v1/health` to 500, any other failing check leaves it 200, and it is back to 200 when resolved. An uptime monitor Kowboy runs (UptimeRobot or similar) alerts on 500 (question 173). Core tells P0 and P1 problems by mail and Slack once they have lasted their wait, and P2 in one mail at 07:00 (question 164). Unhandled errors in Core, adapters and clients reach Sentry.                                                                        |
| 18  | **Pipeline.** Merging to main deploys staging and runs the smoke suite automatically. Production deploys only after approval. A failed production health check leaves the previous version live.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 19  | **No skipped items.** With concurrent writes and during deploy overlap, a subscriber paging by cursor never misses an item.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 20  | **Real clients.** WP and Lovable pass the sync scenario suite, and give identical results for the search/filter scenario suite on the same dataset.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 21  | **Safe update.** A broken client release is replaced by the next release without manual steps. A broken Lovable site release doesn't stop syncing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 22  | **Backstop.** With bells blocked, a subscriber converges within 15 min.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 23  | **Schema and invariants.** Every item served validates against the current schema and invariants. The release report blocks a release that would violate them.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 24  | **Recovery.** The scripted restore drill on staging ends with subscribers converged.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 25  | **Secrets and privacy.** Credentials are encrypted at rest (`CREDENTIALS_KEY`). Seeded secrets never appear in Sentry, the event log, stdout or `/v1/health`. All hosting and Sentry data stays in the EU.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 26  | **Removal.** Removing an office or deactivating a connection tombstones its items. Tombstones are hard-deleted after 90 days.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 27  | **Scale and read latency.** Load test on staging at 10x launch: 200 tenants, one tenant with 300k properties. Page size is 100 items (default and max). Time to first byte p95 under 100 ms, full response p95 under 300 ms.                                                                                                                                                                                                                                                                                                                                                                                                         |
| 28  | **Functional parity.** Everything in the human-supplied parity inventory is servable from Core data.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 29  | **Burst resilience (Vitec).** 50,000 webhooks in 1 minute across 50,000 different records: <br>• Every webhook gets 202 within 1 s (p99), with no crash and no lost webhook. <br>• Vitec calls stay within its rate limit. <br>• Each subscriber gets at most one bell per throttle window. <br>• `vitec.webhook_lag` goes red and back to green. <br>• All records converge.                                                                                                                                                                                                                                                        |
| 30  | **Contract evolution.** <br>• Additive fields and unknown enum values break no client. <br>• A client receiving an item it can't use skips it, reports to Sentry and keeps serving. <br>• The release report flags breaking schema changes and lists client versions currently pulling.                                                                                                                                                                                                                                                                                                                                              |
| 31  | **Purge and resync safety.** Purge-and-resync or resync-with-sweep on a live tenant never leaves a subscriber with fewer items than Core has at the end, and sites keep serving. A subscriber behind the purge watermark is told to resync and converges.                                                                                                                                                                                                                                                                                                                                                                            |
| 32  | **Near-instant under normal load (Vitec).** At under 1 webhook/s, webhook received → bell sent is p95 under 2 s excluding Vitec's response time, including while another tenant's 30k-record initial load runs.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 33  | **Race conditions and dedupe (Vitec).** Each ends with the CRM's current state and no Sentry error: <br>• update then delete before fetching → tombstone <br>• delete then late update webhook → tombstone <br>• 100 webhooks for one record → at most 2 fetches <br>• a transient failure → retry, never tombstone                                                                                                                                                                                                                                                                                                                  |
| 34  | **Initial sync.** A new tenant converges to a full load. A new office loads only that office plus missing referenced entities. A new subscriber converges from Core's store with zero CRM calls.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 35  | **Catch-up (Vitec).** <br>• With webhooks disabled, every change converges after the next scheduled catch-up. <br>• Consecutive catch-up windows overlap by 1 h. <br>• Unchanged records produce no new `seq` and no bell. <br>• A delete whose webhook was lost is tombstoned by the daily id comparison against the CRM's list. <br>• A failed catch-up turns `vitec.catch_up` red once it is overdue.                                                                                                                                                                                                                             |
| 36  | **Release impact preview.** The release report shows item counts, changed fields and before/after examples for the production data. It performs no writes and no CRM calls.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 37  | **Checks.** Each enforced check (§3.1) fails on a seeded violation, including an adapter importing engine internals and a CRM name in the engine. Warnings (§3.2) never block.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 38  | **Webhook lag (Vitec).** A webhook whose record isn't fetched and ingested within 5 min turns `vitec.webhook_lag` red, and green again once it is processed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 39  | **Repeated retries (Vitec).** A record failing 3 fetches in a row turns `vitec.retries` red. It turns green after a successful fetch or when an operator discards the record.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 40  | **Compression.** A 100-item `/v1/changes` page is served gzip-encoded with `Content-Encoding: gzip`, at least 4x smaller than the same body uncompressed, and adds under 10 ms p95 per page. A client that does not accept gzip still gets valid plain JSON.                                                                                                                                                                                                                                                                                                                                                                         |
| 41  | **Restore.** After Core's database is restored to an earlier point and the app restarted: no subscriber skips a change, no subscriber deletes or rewrites an item it should keep, every `seq` served afterwards is above every cursor handed out before, Core converges to the CRM's current state including deletions made after the restore point, and only records whose change date moved are fetched. `/v1/health` answers `ok: false`, with an adapter's check saying it is catching up, from the restart until every adapter has caught up, and says when the database is ahead of the app; `/v1/ready` stays 200 throughout. |
| 42  | **Admin panel.** One place in the `web` process, behind a login by email link: a dashboard, tenants and sites, connections, adapter panels, items (filters, a selection, live activity, raw, unified, display, timeline), events, a test panel that runs requests, settings. Every panel is driven through HTTP in the tests; an adapter's panels come through `Adapter.admin` and the engine never looks inside them (docs/admin-panel.md, approved 2026-09-18).                                                                                                                                                                    |
| 43  | **Forms delivered.** A `lead`, an `interest` and a `viewing` posted to `POST /v1/submissions` with a tenant token reach the CRM through its adapter with every universal field mapped, and the site receives `delivered` with the CRM's reference (docs/forms.md, approved with question 130).                                                                                                                                                                                                                                                                                                                                       |
| 44  | **Forms refused or failed.** A refusal and a failure from the CRM reach the visitor as `refused` with the reason and `failed`, appear on the record's timeline, and carry no personal data in events, logs or the error tracker; `submissions.failing` turns red on the failure and green on the next delivery.                                                                                                                                                                                                                                                                                                                      |
| 45  | **Forms sent once.** The same submission `id` posted twice sends once and answers the same outcome.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 46  | **Forms refused before the CRM.** A record of another tenant, a body outside the schema, a lead without an office for a tenant with several, a kind the CRM does not take and the 61st submission in a minute are refused with 400, 501 or 429 before any CRM call.                                                                                                                                                                                                                                                                                                                                                                  |
| 47  | **Slots.** `GET /v1/submissions/slots` answers the CRM's viewings and slots for a home under the universal names, valid against `schemas/slots.v1.json`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 48  | **The forms widget.** The widget's three forms pass a browser journey against the real Core on the staging site, and the browser never receives the tenant token or the CRM login.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 49  | **Search profile.** A `search_profile` posted after a lead or from a home reaches the CRM as a contact and a profile with the criteria mapped, and a skipped third step leaves the main submission delivered.                                                                                                                                                                                                                                                                                                                                                                                                                        |

## 11. Rules ledger: what Kowboy supplies

**What it is.** A plain-language list of every piece of logic that is more than copying a CRM field. Golden masters show _what_ the output is for examples; the ledger says _why_, so agents implement the general rule.

**What belongs in it.** Only rules whose answer depends on CRM data alone. Illustrative examples:

- Which CRM statuses mean `for_sale`
- When the price shows as "Pris på begäran"
- The "82 + 12 m²" format
- Price, phone and address formatting
- Which images are dropped and how they are ordered
- When a sold price is hidden

**What does not belong in it:** anything that depends on time, the viewer or site configuration. Those belong to the subscriber.

**Format.** One entry per rule, no code:

```
R-012  Price on request
When:     the price is 0, empty, or flagged "on request" in the CRM
Then:     price = null, display.price = "Pris på begäran"
CRMs:     both (note per-CRM differences)
Examples: golden/vitec/property/price-on-request
```

**How it's used:**

- Each entry becomes one rule file plus its test, linked by ID.
- The ledger may start incomplete; later rules ship as normal releases and recompute fixes stored data.
- Agents never invent rules.

**Status 2026-09-19.** Since §12.23 an entry formats or lays out what the CRM sent and never classifies it, so the status and hidden-price examples above are superseded: `status` reaches the sites as the CRM's `{id, name}` and a site decides what it means. The first entries, R-001 to R-014 (numbers and money, areas, rooms, fee, floor, elevator, year built, highest bid, operating cost, lease, energy declaration, address line, the sections, project ranges), were drafted from Patric's decisions of that day and approved by him the same day (question 53); each has its function and its test in `engine/rules/`.

## 12. Changes to the SRS

1. Rename Kore to Kowboy Core (Core); the CRM-agnostic part becomes the engine.
2. The engine exposes a small, protected adapter API (§5.1). Adapters may import nothing else. Extending it needs approval.
3. Fetching strategy is fully adapter-owned. For Vitec: a webhook path with its own fetch list, dedupe and retries, plus a separate 12 h catch-up schedule with 1 h overlap and a daily id comparison (§5.3).
4. Add a short global transaction lock per write, replacing the in-process mutex (§5.2).
5. Throttle bells per subscriber with a leading and trailing edge.
6. Remove `schema_version` and down-converters. One shape, additive changes, expand-contract as ordinary releases (§6).
7. Add tombstone purge, a watermark, resync-required responses, resync-with-sweep and purge-and-resync (§7).
8. `/v1/health` returns 500 only while a P0 check fails and 200 otherwise (question 173), with engine checks plus adapter-registered checks (Vitec: webhook lag, repeated retries, catch-up, refused offices, a paused connection). It is public, for an uptime monitor: every detail is counts and plain words, never a customer's name; the names travel on the check for the alerts and the panel (question 62, 2026-09-20). Add the event log with correlation ids (§8).
9. Reduce page size from 1000 to 100.
10. Add a `CREDENTIALS_KEY` env var.
11. Generate TS types from JSON Schema; use golden masters for the initial build only; ledger format as in §11.
12. Add a manual production approval with a release report and impact preview (§4).
13. Hosting is supplied by Kowboy (DigitalOcean App Platform with managed Postgres, EU), not chosen by agents.
14. Build on dummy data first; real golden masters before the adapters.
15. Recompute automatically after a release that changes mapping or rules.
16. Gzip JSON responses at a low level (AC 40).
17. Webhook listeners, schedules and timers are adapter concerns. `main.ts` starts the engine, mounts adapter endpoints and starts the adapters.
18. A sixth datatype, `project` (approved 2026-09-16): a new-build project that groups properties. It has its own office, agents and areas; a property names its project by `project_id`.
19. Every engine start advances the item sequence by 1,000,000,000 and every worker start runs the adapters' catch-up and id comparison, so a database restore needs no other step (§7.2, AC 41).
20. `web` and `worker` share two tables: lifecycle events queued by the panel (or a test) and delivered by the worker, and the adapters' health results recorded by the worker and reported by `web`; `GET /v1/ready` is the platform's readiness probe (§5.1, §8.1).
21. The entire CRM payload reaches the sites (Patric, 2026-09-18): the item envelope carries `raw`, the payload untouched, next to `data`, and `data` mirrors the whole payload mechanically (snake_case names, the CRM's nesting kept) with the spine on top; `display` travels in the envelope (who fills it: question 44).
22. Sites report back what they applied (Patric, 2026-09-18, question 37): after each page a site pulled, it posts to `POST /v1/applied` which records it applied and which it could not (`schemas/applied.v1.json`), with the tenant's token; Core puts `site.applied` and `site.failed` events on each record's timeline, so the timeline runs from the CRM's notification to the site. A report that cannot be delivered never stops a sync.
23. Core applies no logic to CRM data (Patric, 2026-09-17 to 2026-09-19, question 44): the adapter maps the CRM's fields onto the universal names and lifts the linking ids; the engine computes `display` from `universal` by ledger entries, one interpreter for every CRM, and never reads a CRM field; no decision anywhere in Core is drawn from a value. Tags and slugs are the site's. This supersedes the SRS wherever it has Kore deciding from a value: `slug` (§6.7) and the tags, flags and slugs of Appendix A; the placement rule of §7 stands for `display` only.
24. Routing by id (Patric, 2026-09-19, questions 41 and 42): `/objekt/<id>` and `/objekt/<old slug>-<id>` answer 301 to the property's current permalink, the id being the property's id as Core keys it; a removed or unknown id answers 301 to the property archive. "Objekt" is Swedish for a property listing.
25. The sitemap's change date is the post's modified time, which WordPress sets on every write, and a write happens only when the content changed (Patric, 2026-09-19, question 43). This supersedes the last sentence of SRS §7.1 for `lastmod`; the visible "updated" date still comes from the CRM's change time in the record.
26. Swedish paths and slugs, set by the site (Patric, 2026-09-18 and 2026-09-19, question 45): property `objekt/<status>-<area name>-<street address>-<id>`, project `projekt/` the same, office `kontor/<office name>-<id>`, association `forening/<association name>-<id>`, agent `maklare/<first name>-<last name>-<id>`, area `omrade/<municipality>-<area name>-<id>` (question 49); every entity ends in `-<id>`.
27. The sites' errors go through Core (Patric, 2026-09-19, question 46): a site posts an error to `POST /v1/errors` with the tenant's token (`schemas/errors.v1.json`); Core keeps one row per distinct error across every site and process and forwards one report a day to Sentry, keyed by the client and its version, where it happened and the message; no site holds a Sentry key. A fatal error in the WordPress plugin's own files is reported from PHP's shutdown.
28. Images (Patric, 2026-09-19, closes question 6): the universal model carries image addresses on Kowboy's CDN, built in the adapter's mapping as `https://cdn-realestate.kowboy.se/r2/<customer id>/<record id>/<image id>_<width>.<extension>` from the ids and the extension the CRM gives (seen on a live site, 2026-09-19). Per image a record carries one address, at width 1920 (decided, closes question 50), and its order, category and description; a client that wants another size handles that itself.
29. A tenant is a number (Patric, 2026-09-19): Core assigns it, and the name is the only thing a person types; the SRS's slug (`t_acme`, §3) is superseded. Sites never see it: they hold the token.
30. The thin universal model (Patric, 2026-09-19, Gate 2, closes question 51): `data` carries the universal names of `docs/field-tables.md`, about the fields every listing site shows and searches on, enumerations as `{id, name}`, the first building's sizes lifted onto the property, and the whole `buildings[]`, the images, the viewings and the bid history (cancelled bids marked) as arrays; everything the tables do not name stays next to them under its mechanical name (point 21), and a field moves into the tables only when a second client type or a second CRM needs it. `display` is strings only, plus `sections`: a property's fact tables as data (headings and rows), defined in one table in the engine and changed by a release and a recompute, a row shown when its field is present and for no other reason. A new-build project's homes name it by `project_id` and are told apart by that alone: the sites keep them out of the regular lists and list them on the project's page (WordPress: the property-list shortcode filtered on the project id). An image's `category` is the CRM's free-text category. Status and bidding are copied as sent (point 23); the status enumeration, bidding visibility levels and badges that earlier conversations spoke of are the site's.

## 13. Defaults (changeable without a gate)

| Setting                           | Default                                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------- |
| Bell throttle window              | 10 s                                                                                           |
| Response compression              | gzip level 3                                                                                   |
| Event log retention               | 30 days                                                                                        |
| Vitec catch-up                    | every 12 h, 1 h overlap                                                                        |
| Vitec id comparison for deletes   | daily                                                                                          |
| Vitec fetch retries               | exponential backoff; health red after 3 consecutive failures; Sentry after the last attempt    |
| Health: worker heartbeat          | 2 min                                                                                          |
| Health: subscriber not pulled     | 60 min                                                                                         |
| Health: Vitec webhook lag         | 5 min                                                                                          |
| Health: Vitec catch-up overdue    | 13 h                                                                                           |
| Staging soak before go-live       | 7 days                                                                                         |
| Sequence jump per engine start    | 1,000,000,000                                                                                  |
| Lifecycle events delivered        | every 2 s; an event waiting 5 min turns `lifecycle` red                                        |
| Adapter health recorded           | every 30 s; a record older than 2 min counts as failed                                         |
| Form submissions per tenant token | 60 a minute, answered 429 above it (docs/forms.md)                                             |
| Form submission: CRM answer       | 20 s, then the submission counts as failed; a repeated id answers the stored outcome for a day |

## 14. Features (the feature map, from 2026-10-03)

The handbook's feature map: each feature in one sentence of user value, marked now (the smallest
useful version) or later, with the acceptance it needs. The sections above are the plan as
approved; this map grows as Patric describes wishes and is settled through the register.

- `[client-wordpress]` **Offices and agents typed on the site** (Patric, 2026-10-03; question 125;
  the strategy in `docs/site-records.md`; item 22): a site shows people and offices its CRM does
  not carry, typed in the WordPress admin, in the same lists and pages as the CRM's. Done
  2026-10-03 (125 answered a). Acceptance: a typed agent and office appear in the lists, on an
  office's page and through a rebuild, ordered and hidden by the staff-list rule, and a CRM
  record stays read-only; proved by the template test, numbered as a criterion on approval.
- `[client-wordpress]` **A CRM agent's text or portrait changed on the site** (question 127):
  out. A CRM record is edited only in the CRM, and the admin says so (Patric, 2026-10-03).
- `[client-lovable]` **The same typed records on a Lovable site**: later, when a Lovable site needs
  them; with 125 (b) it comes with the pull.
- `[core]` **Form submissions to the CRM** (Patric, 2026-10-04; questions 129 to 132 and 136 to 139; the
  strategy in `docs/forms.md`; item 21): a visitor's lead, interest in a home or viewing booking, filled in
  on any site, reaches the brokerage's CRM through Core, with the viewing's slots read live for
  the booking; decided 2026-10-04: inside Core (129), the design (130), one widget served by Core (137),
  Turnstile (138), a wizard whose last step is a search profile prefilled from the page (139),
  which Vitec takes in its version 1 API (131) and Mspecs as a lead with matching. Acceptance:
  the seven criteria proposed in `docs/forms.md`, numbered on approval (43 to 49). Built
  2026-10-04: Core's part and the Vitec adapter's part against the stand-in. Rebuilt 2026-10-06
  (150 a, 155): the theme draws the three forms, the plugin's receivers pass them to Core with
  the site's token, and Core checks the bot check's proof and hands a form to the CRM only from
  the live service; the widget served by Core, its browser door and the public site keys of
  2026-10-04 are gone, and the profile step waits on 151. Remaining: Turnstile's keys, keeping a
  form until the CRM has it (160 a), the real Vitec send (54 f). Later: watching the
  final price, a step for the home the visitor has to sell. Out: cancelling a booking (Patric,
  2026-10-04).
- `[client-wordpress]` **Search by place, and the list blocks in the plugin** (Patric,
  2026-10-04; questions 133 and 134; the design in `docs/search.md`; item 23): a visitor finds
  homes by a län, a kommun or an area, chosen as pills from a box that offers only places with
  homes, or by the beginning of a street, area, town, kommun or län name, with a home counted in
  every area whose outline holds it; an editor places the property list and the agent list from
  the plugin, restricted to chosen agents, areas or offices. Proposed, nothing built. Acceptance:
  the tests named in `docs/search.md`, under AC 20's search half.
- Out: typed properties, areas, associations and projects; for those the CRM's list defines what
  exists (AGENTS.md).
