# Kowboy Core - Delivery Strategy

**Status:** v12 · Gate 1 approved 2026-09-15 (amended same day) · **Current phase: 3 - Engine**, built ahead of Gate 2 on Kowboy's instruction; Gate 2 still owed (§9) · **Inputs:** [Concept](inputs/Kowboy_Kore_Concept.md), [SRS v1.2](inputs/Kowboy_Kore_SRS_v1.2.md) (suggestions; amended by §12)

**Naming:** the product is **Kowboy Core**, or just **Core** (formerly "Kore"). The CRM-agnostic part inside it is called the **engine**. Every `Kore`/`kore` identifier in the SRS becomes `Core`/`core`, for example `X-Core-Secret` and `/wp-json/core/v1/bell`.

## 1. Goal

Get from the Concept and SRS to a production deploy of a simple, lean and reliable service.

- **Agents build, CI decides correctness.** Automated tests are the definition of done.
- **Humans approve behaviour, not code.** Approval happens at gates and per production release, based on plain-language reports.
- **Few hard blocks, clear guidance.** Only what protects production or the architecture blocks; everything else warns or guides (§3).

## 2. Architecture decisions

| Concern              | Decision                                                                                                                                                                                                                | Why                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Language             | TypeScript strict, Node LTS                                                                                                                                                                                             | One language for engine and adapters                                                                    |
| Processes            | One codebase, two roles: <br>• `web`: subscriber API, admin, health, plus any HTTP endpoints an adapter brings (e.g. Vitec's webhook listener) <br>• `worker`: adapter background work, bells, recompute                | Requests stay fast whatever background work is running                                                  |
| Database             | Postgres, plain SQL migrations, no ORM                                                                                                                                                                                  | Fewest abstractions                                                                                     |
| Item storage         | One `items` row per entity, with two separate columns: <br>• `raw`: the CRM payload, untouched, never served <br>• `data`: the universal model, with `display` and `provider_extras` inside, served verbatim            | `raw` enables recompute and preview without CRM traffic. Serving a precomputed `data` keeps reads fast. |
| Response compression | JSON responses are gzip-compressed at a low, fast level                                                                                                                                                                 | Cuts egress cost with little CPU                                                                        |
| Fetching strategy    | **Owned by each adapter** (§5). The engine has no queues, webhooks or schedules. An adapter that needs a queue keeps it in its own tables. No Redis.                                                                    | CRMs differ: some push webhooks, some must be polled                                                    |
| Event log            | Postgres `events` table, one table, rows older than 30 days deleted (§8.2). Both engine and adapters write to it through the adapter API.                                                                               | Full visibility into the past, no new vendor                                                            |
| Contract             | One JSON Schema per datatype describing the current shape. TS types are generated from it at build time. Breaking changes use expand-contract (§6).                                                                     | Schema and code can't drift                                                                             |
| Tests                | Vitest against real Postgres in CI                                                                                                                                                                                      |                                                                                                         |
| Checks               | Few blocking checks; the rest are warnings (§3)                                                                                                                                                                         |                                                                                                         |
| CI/CD                | GitHub Actions and GitHub Environments                                                                                                                                                                                  | Production approval is one button                                                                       |
| Monitoring           | `/v1/health`: 200 when every check passes, 500 when any fails, same payload (§8.1). Watched by Sentry Uptime.                                                                                                           | Works with any monitoring tool                                                                          |
| Errors               | Sentry (EU) in Core and both clients. Until the account exists, error reporting is a **placeholder**: one small module, active only when `SENTRY_DSN` is set, a no-op otherwise.                                        | One error surface, and no waiting on an account                                                         |
| WP client            | PHP 8.3, PHPStan, and the shared sync scenario suite run against a real WordPress install (no PHPUnit, no wp-env)                                                                                                       | One suite proves both clients against the real Core                                                     |
| Lovable client       | Supabase edge functions (Deno), Supabase CLI, staging and prod projects                                                                                                                                                 | Required by Lovable                                                                                     |
| Repo                 | `KowboyMedia/kowboy-core`: `engine/`, `adapters/<provider>/`, `clients/wordpress/`, `clients/lovable-kit/`, `schemas/`, `golden/`, `rules-ledger/`, `acceptance/`, `docs/`. The Lovable example site gets its own repo. | CI runs real clients against the real Core                                                              |

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
3. **No legacy access.**
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
merge main ──► auto-deploy STAGING (Core + staging WP site + staging Lovable site) ──► smoke suite
          ──► release report
approver checks staging sites ──► clicks Approve ──► deploy PRODUCTION (health-gated; old version stays live on failure)
```

**The release report** (plain language) contains:

- **What changed.**
- **Output impact preview.** A read-only dry run of the new mapping and rules over the raw payloads stored in production. It reports how many items would change, which fields, and before/after examples. No writes, no CRM calls. An item failing the schema or invariants blocks the release (E5).
- **Flags for the approver (information only):** adapter API extensions, breaking schema changes, new dependencies, and client versions currently pulling.
- **Links** to what to check on the staging sites, and acceptance status.

One approval promotes Core, the WP plugin channel and the Lovable kit. Every deploy tags a Sentry release.

## 5. Engine and adapters

### 5.1 The seam

| Engine (knows no CRM)                                                              | Adapter (one per CRM)                                                                                             |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Storing `raw` and `data`, calling the adapter's mappers, business rules, `display` | Authentication, HTTP, endpoints, pagination, rate limits                                                          |
| Hash, `seq`, write ordering, tombstones, licensed-office filter                    | **Deciding when and how to fetch:** webhooks, polling, catch-up, and running its **own schedules and timers**     |
| Bells, subscriber API (compressed responses), recompute and replay                 | **Its own queue, dedupe and retries**, in its own tables, if it needs them                                        |
| Lifecycle events to adapters, event log, health endpoint                           | **Its own HTTP endpoints**, e.g. a webhook listener: route, signature check, and parsing the CRM's payload format |
|                                                                                    | Mappers from CRM payload to the universal model                                                                   |

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

Every call is idempotent. The engine never calls back into CRM-specific code except through the mappers and lifecycle handlers the adapter registered.

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
- **Retries:** a failed fetch is retried with backoff and reported to Sentry after the last attempt. It is never treated as a delete.

**Path 2 - Catch-up (rare safety net, separate schedule):**

- **Why it exists:** a webhook can be lost, for example if Core was down or restarting when Vitec sent it, or Vitec failed to send it. Without a safety net, that record would stay out of date until it changed again.
- **What it does:** on its own **12 h** timer, the adapter asks Vitec "which records changed since the last catch-up?". The window starts **1 h before** the previous run ended, so nothing slips through the gap between runs. Those records go on the same fetch list, after any webhook fetches.
- **Records that didn't actually change** are recognised by the engine (same hash), so they get no new `seq`, no bell and reach no site.
- **Missed deletes:** once a day the adapter sends Vitec's full id list to `presentIds`. Before tombstoning, the missing ids are confirmed gone with a fetch.
- **Need it sooner?** An operator can trigger a `resync` event.

### 5.4 Adapter health checks (registered through the API)

Vitec registers:

| Check               | Fails when                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `vitec.webhook_lag` | Any webhook received more than **5 min** ago hasn't been fetched and ingested yet                                      |
| `vitec.retries`     | Any record has failed **3 fetches in a row**. It clears on a successful fetch or when an operator discards the record. |
| `vitec.catch_up`    | The last successful catch-up is older than 13 h (12 h plus a 1 h margin)                                               |

## 6. Contract evolution: one shape, expand-contract

Core serves one shape: the current one. No versions, no converters, no automated gates.

- **Additive changes at any time.** Clients store unknown fields untouched, ignore them in templates, and handle unknown enum values safely. This is tested in the client contract suite.
- **A breaking change** (rename, remove, retype, changed meaning) is done as **expand → migrate → contract**, three ordinary releases:
  1. **Expand:** add the new field next to the old one.
  2. **Migrate:** release clients that use the new field.
  3. **Contract:** remove the old field in a later release. The release report flags the removal and lists client versions currently pulling; the approver decides.
- **Safety net** (SRS §8): a client that receives an item it can't use reports it to Sentry, skips it and keeps serving its local data.
- **Client version header.** Clients send `X-Core-Client: <client>/<version>` on every pull. It is logged and shown in the release report.

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

Returns **200 if all checks pass, 500 if any fails, with the same payload**. It contains counts only, no tenant names.

```json
{
  "ok": false,
  "version": "1.4.0",
  "checks": {
    "db": { "ok": true },
    "worker": { "ok": true, "last_heartbeat_s": 4, "limit_s": 120 },
    "subscribers": { "ok": true, "not_pulled_60m": 0 },
    "vitec.webhook_lag": { "ok": false, "oldest_unprocessed_s": 420, "limit_s": 300 },
    "vitec.retries": { "ok": true, "records_failing": 0, "limit_consecutive": 3 },
    "vitec.catch_up": { "ok": true, "last_success_h": 5, "limit_h": 13 }
  }
}
```

| Engine check  | Fails when                                    |
| ------------- | --------------------------------------------- |
| `db`          | The database is unreachable                   |
| `worker`      | No worker heartbeat for 2 min                 |
| `subscribers` | An active subscriber hasn't pulled for 60 min |

Adapter checks are defined by each adapter (§5.4). `GET /v1/admin/health` returns the same checks with names.

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
| `admin.call` / `lifecycle.sent`                     | engine     | endpoint or event, parameters                                                                                                                     |

**Query:** `GET /v1/admin/events?entity=…|connection=…|subscriber=…|correlation=…|type=…&from=…&to=…` returns a timeline, for example:

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

## 9. Phases and approval gates

| Phase                                                                                                                                           | Output                                                                                                                              | Exit                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **0. Decide**                                                                                                                                   | Strategy and acceptance criteria                                                                                                    | **Gate 1: approved 2026-09-15**                                                               |
| **1. Foundation** ✔ done                                                                                                                        | Repo tooling, §3 checks and warnings, Sentry placeholder, health endpoint, release gate, a "hello health" app                       | Checks block a seeded violation, and the app serves `/v1/health` locally and in CI            |
| **1b. Deploy** ⏳ waits on the platform                                                                                                         | Staging and prod deployed on the platform Kowboy supplies, Sentry account wired up                                                  | A trivial change goes PR → staging → approved → production, and a failing health check alerts |
| **2. Canonical model** ⏳ awaiting Gate 2                                                                                                       | JSON Schemas, a field table per datatype, dummy data (`golden/fake/`)                                                               | **Gate 2:** field tables approved                                                             |
| **3. Engine** ◄ current                                                                                                                         | Engine, adapter API, bells, recompute, health, event log, two fake adapters (one webhook-style, one polling-style), fake subscriber | Engine acceptance criteria green ([report](../acceptance/report.md))                          |
| **4. Clients** ⏳ sync loops built 2026-09-15 ahead of Gate 2 (next-steps item 4); templates, example site and staging sites wait for the model | WP plugin, Lovable kit, example site, staging client sites                                                                          | Client acceptance criteria green                                                              |
| **5. Real data**                                                                                                                                | Humans supply real golden masters per CRM, rules ledger (§11), parity inventory, CRM docs and rate limits, test credentials         | **Gate 3:** golden masters and ledger approved                                                |
| **6. Adapters** ⏳ Vitec fetch layer built 2026-09-16 ahead of Gate 2 (adapters/vitec/); mappers map the spine until the model is approved      | Vitec (webhooks, fetch list, catch-up) and Mspecs: golden masters first, then test accounts on staging                              | Adapter acceptance criteria green                                                             |
| **7. Soak & go-live**                                                                                                                           | 7 days on staging with no unresolved Sentry issues, burst and load tests, restore drill, parity check                               | **Gate 4:** first production tenant                                                           |

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

## 10. Acceptance Criteria v1.9

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

| AC  | Criterion                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 16  | **Event log.** For a given entity, one query returns its full timeline across webhook, fetch, CRM call (with metadata), write (with changed fields), bell and pull, linked by correlation id. For each "not updated" cause (deduped, unlicensed, hash unchanged, malformed, not-found, fetch failed, bell throttled, bell failed, subscriber not pulling), the timeline shows the cause. Secrets are redacted. Events older than 30 days are gone. |
| 17  | **Health and alerting,** verified by injected faults on staging. Each engine and adapter check turns `/v1/health` to 500 with that check `ok: false`, and back to 200 when resolved. Sentry Uptime alerts on 500. Unhandled errors in Core, adapters and clients reach Sentry.                                                                                                                                                                     |
| 18  | **Pipeline.** Merging to main deploys staging and runs the smoke suite automatically. Production deploys only after approval. A failed production health check leaves the previous version live.                                                                                                                                                                                                                                                   |
| 19  | **No skipped items.** With concurrent writes and during deploy overlap, a subscriber paging by cursor never misses an item.                                                                                                                                                                                                                                                                                                                        |
| 20  | **Real clients.** WP and Lovable pass the sync scenario suite, and give identical results for the search/filter scenario suite on the same dataset.                                                                                                                                                                                                                                                                                                |
| 21  | **Safe update.** A broken client release is replaced by the next release without manual steps. A broken Lovable site release doesn't stop syncing.                                                                                                                                                                                                                                                                                                 |
| 22  | **Backstop.** With bells blocked, a subscriber converges within 15 min.                                                                                                                                                                                                                                                                                                                                                                            |
| 23  | **Schema and invariants.** Every item served validates against the current schema and invariants. The release report blocks a release that would violate them.                                                                                                                                                                                                                                                                                     |
| 24  | **Recovery.** The scripted restore drill on staging ends with subscribers converged.                                                                                                                                                                                                                                                                                                                                                               |
| 25  | **Secrets and privacy.** Credentials are encrypted at rest (`CREDENTIALS_KEY`). Seeded secrets never appear in Sentry, the event log, stdout or `/v1/health`. All hosting and Sentry data stays in the EU.                                                                                                                                                                                                                                         |
| 26  | **Removal.** Removing an office or deactivating a connection tombstones its items. Tombstones are hard-deleted after 90 days.                                                                                                                                                                                                                                                                                                                      |
| 27  | **Scale and read latency.** Load test on staging at 10x launch: 200 tenants, one tenant with 300k properties. Page size is 100 items (default and max). Time to first byte p95 under 100 ms, full response p95 under 300 ms.                                                                                                                                                                                                                       |
| 28  | **Functional parity.** Everything in the human-supplied parity inventory is servable from Core data.                                                                                                                                                                                                                                                                                                                                               |
| 29  | **Burst resilience (Vitec).** 50,000 webhooks in 1 minute across 50,000 different records: <br>• Every webhook gets 202 within 1 s (p99), with no crash and no lost webhook. <br>• Vitec calls stay within its rate limit. <br>• Each subscriber gets at most one bell per throttle window. <br>• `vitec.webhook_lag` goes red and back to green. <br>• All records converge.                                                                      |
| 30  | **Contract evolution.** <br>• Additive fields and unknown enum values break no client. <br>• A client receiving an item it can't use skips it, reports to Sentry and keeps serving. <br>• The release report flags breaking schema changes and lists client versions currently pulling.                                                                                                                                                            |
| 31  | **Purge and resync safety.** Purge-and-resync or resync-with-sweep on a live tenant never leaves a subscriber with fewer items than Core has at the end, and sites keep serving. A subscriber behind the purge watermark is told to resync and converges.                                                                                                                                                                                          |
| 32  | **Near-instant under normal load (Vitec).** At under 1 webhook/s, webhook received → bell sent is p95 under 2 s excluding Vitec's response time, including while another tenant's 30k-record initial load runs.                                                                                                                                                                                                                                    |
| 33  | **Race conditions and dedupe (Vitec).** Each ends with the CRM's current state and no Sentry error: <br>• update then delete before fetching → tombstone <br>• delete then late update webhook → tombstone <br>• 100 webhooks for one record → at most 2 fetches <br>• a transient failure → retry, never tombstone                                                                                                                                |
| 34  | **Initial sync.** A new tenant converges to a full load. A new office loads only that office plus missing referenced entities. A new subscriber converges from Core's store with zero CRM calls.                                                                                                                                                                                                                                                   |
| 35  | **Catch-up (Vitec).** <br>• With webhooks disabled, every change converges after the next scheduled catch-up. <br>• Consecutive catch-up windows overlap by 1 h. <br>• Unchanged records produce no new `seq` and no bell. <br>• A delete whose webhook was lost is tombstoned by the daily id comparison after a confirmed not-found. <br>• A failed catch-up turns `vitec.catch_up` red once it is overdue.                                      |
| 36  | **Release impact preview.** The release report shows item counts, changed fields and before/after examples for the production data. It performs no writes and no CRM calls.                                                                                                                                                                                                                                                                        |
| 37  | **Checks.** Each enforced check (§3.1) fails on a seeded violation, including an adapter importing engine internals and a CRM name in the engine. Warnings (§3.2) never block.                                                                                                                                                                                                                                                                     |
| 38  | **Webhook lag (Vitec).** A webhook whose record isn't fetched and ingested within 5 min turns `vitec.webhook_lag` red, and green again once it is processed.                                                                                                                                                                                                                                                                                       |
| 39  | **Repeated retries (Vitec).** A record failing 3 fetches in a row turns `vitec.retries` red. It turns green after a successful fetch or when an operator discards the record.                                                                                                                                                                                                                                                                      |
| 40  | **Compression.** A 100-item `/v1/changes` page is served gzip-encoded with `Content-Encoding: gzip`, at least 4x smaller than the same body uncompressed, and adds under 10 ms p95 per page. A client that does not accept gzip still gets valid plain JSON.                                                                                                                                                                                       |

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

## 12. Changes to the SRS

1. Rename Kore to Kowboy Core (Core); the CRM-agnostic part becomes the engine.
2. The engine exposes a small, protected adapter API (§5.1). Adapters may import nothing else. Extending it needs approval.
3. Fetching strategy is fully adapter-owned. For Vitec: a webhook path with its own fetch list, dedupe and retries, plus a separate 12 h catch-up schedule with 1 h overlap and a daily id comparison (§5.3).
4. Add a short global transaction lock per write, replacing the in-process mutex (§5.2).
5. Throttle bells per subscriber with a leading and trailing edge.
6. Remove `schema_version` and down-converters. One shape, additive changes, expand-contract as ordinary releases (§6).
7. Add tombstone purge, a watermark, resync-required responses, resync-with-sweep and purge-and-resync (§7).
8. `/v1/health` returns 200 or 500, with engine checks plus adapter-registered checks (Vitec: webhook lag, repeated retries, catch-up). Add `/v1/admin/health` and the event log with correlation ids (§8).
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

## 13. Defaults (changeable without a gate)

| Setting                         | Default                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| Bell throttle window            | 10 s                                                                                        |
| Response compression            | gzip level 3                                                                                |
| Event log retention             | 30 days                                                                                     |
| Vitec catch-up                  | every 12 h, 1 h overlap                                                                     |
| Vitec id comparison for deletes | daily                                                                                       |
| Vitec fetch retries             | exponential backoff; health red after 3 consecutive failures; Sentry after the last attempt |
| Health: worker heartbeat        | 2 min                                                                                       |
| Health: subscriber not pulled   | 60 min                                                                                      |
| Health: Vitec webhook lag       | 5 min                                                                                       |
| Health: Vitec catch-up overdue  | 13 h                                                                                        |
| Staging soak before go-live     | 7 days                                                                                      |
