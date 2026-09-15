# Kowboy Core - Delivery Strategy

**Status:** v6 · Gate 1 approved 2026-09-15 (amended same day) · **Current phase: 1 - Foundation** (§9) · **Inputs:** [Concept](inputs/Kowboy_Kore_Concept.md), [SRS v1.2](inputs/Kowboy_Kore_SRS_v1.2.md) (suggestions; amended by §12)

**Naming:** the product is **Kowboy Core**, or just **Core** (formerly "Kore"). The CRM-agnostic part inside it is called the **engine**. Every `Kore`/`kore` identifier in the SRS becomes `Core`/`core`, for example `X-Core-Secret` and `/wp-json/core/v1/bell`.

## 1. Goal

Get from the Concept and SRS to a production deploy of a simple, lean and reliable service.

- **Agents build, CI decides correctness.** Automated tests are the definition of done.
- **Humans approve behaviour, not code.** Approval happens at gates and per production release, based on plain-language reports.
- **Few hard blocks, clear guidance.** Only what protects production blocks; everything else warns or guides (§3).

## 2. Architecture decisions

| Concern | Decision | Why |
|---|---|---|
| Language | TypeScript strict, Node LTS | One language for engine and adapters |
| Processes | One codebase, two roles: `web` (API, webhook intake, health) and `worker` (jobs, schedules, bells) | Intake stays fast whatever workers are doing |
| Database | Postgres, plain SQL migrations, no ORM | Fewest abstractions |
| Item storage | One `items` row per entity, with two separate columns: <br>• `raw`: the CRM payload, untouched, never served <br>• `data`: the universal model, with `display` and `provider_extras` inside, served verbatim | `raw` enables recompute and preview without CRM traffic. Serving a precomputed `data` keeps reads fast. |
| Queue | Postgres job table with a priority column. No Redis. | Every read is unique, so a cache adds nothing |
| Event log | Postgres `events` table, partitioned by day, 30-day retention by dropping partitions (§8.2) | Full visibility into the past, no new vendor |
| Contract | One JSON Schema per datatype describing the current shape. TS types are generated from it at build time, not committed. Breaking changes use expand-contract (§6). | Schema and code can't drift |
| Tests | Vitest against real Postgres in CI | |
| Checks | Few blocking checks; the rest are warnings (§3) | Blocks only what protects production |
| CI/CD | GitHub Actions and GitHub Environments | Production approval is one button |
| Monitoring | `/v1/health`: 200 when every check passes, 500 when any fails, same payload (§8.1). Watched by Sentry Uptime. | Works with any monitoring tool |
| Errors | Sentry (EU) in Core and both clients | One error surface |
| WP client | PHP 8.3, PHPUnit, PHPStan, wp-env | |
| Lovable client | Supabase edge functions (Deno), Supabase CLI, staging and prod projects | Required by Lovable |
| Repo | `KowboyMedia/kowboy-core`: `engine/`, `adapters/<provider>/`, `clients/wordpress/`, `clients/lovable-kit/`, `schemas/`, `golden/`, `rules-ledger/`, `acceptance/`, `docs/`. The Lovable example site gets its own repo. | CI runs real clients against the real Core |

### Hosting: decided at the start of Phase 1

Render is excluded. An agent compares market-leading options, including Google Cloud Run with Cloud SQL, AWS ECS Fargate with RDS, Azure Container Apps and Fly.io/Railway, and picks one. The pick is logged in `docs/decisions.md` and reported with a monthly cost estimate.

Hard criteria:
- **Billing:** no servers to manage, billed per instance or resource, not per invocation.
- **Region:** EU for both app and database.
- **Database:** managed Postgres with point-in-time recovery, in the same region.
- **Processes:** separate, horizontally scalable `web` and `worker`.
- **Deploys:** health-gated zero-downtime deploys and rollback.
- **Config and access:** infrastructure as code in the repo, and a CLI or API agents can drive.
- **Maturity:** a published SLA and strong operator reputation.

## 3. Simplicity and drift: what blocks and what guides

**Principle:** something only blocks if it protects production data or the tests-are-acceptance model, and never produces false alarms. Everything else is a warning or a guideline.

### 3.1 Enforced: blocks merge or deploy

| # | Check | Why it blocks |
|---|---|---|
| E1 | Build, typecheck and all tests pass. Skipped tests count as failures. | Tests are the acceptance |
| E2 | **The seam:** the engine never imports an adapter, and no CRM name appears in `engine/` or `clients/` | The core architecture; cheap and unambiguous |
| E3 | **Protected paths** need approval (CODEOWNERS): `schemas/`, `acceptance/`, `rules-ledger/`, `golden/` (until go-live) and `AGENTS.md` | Stops tests being "passed" by changing expectations |
| E4 | No committed secrets (secret scan) | A leaked CRM credential can't be taken back |
| E5 | The release impact preview finds no item failing the schema or invariants | Protects production data |
| E6 | Production deploy needs human approval, and the health check must pass or the old version stays live | The release gate |

### 3.2 Warnings: reported on the PR, never block

- Lint findings, including cognitive complexity per function
- Duplicate code
- Dead code: unused files, exports, functions, methods and dependencies
- `any` and lint suppressions
- New runtime dependencies (listed)
- Breaking schema changes: a removed, renamed or retyped field (also flagged in the release report)

### 3.3 Automatic: no rule needed

- Formatting is applied by the formatter.
- Line endings are fixed by `.gitattributes`.
- TS types are generated from the schemas at build time and never committed.

### 3.4 Guidelines (AGENTS.md)

1. **Concept rules:** simple beats clever, the seam, all data logic in Core, tests are the acceptance, anything derived is patchable.
2. **No legacy access.**
3. **One code path per concern.** No options or flags for cases that don't exist.
4. **Readable code.** Understandable by reading a few files. Avoid framework-style layers such as dependency-injection containers, generic repositories and wrappers around libraries.
5. **Leave files you touch free of warnings.**
6. **Never invent business rules. Never edit expected outputs to make a test pass.**
7. **Breaking contract changes use expand-contract** (§6).
8. **Naming and layout.**
9. **Decision log** entries for structural choices.
10. **Stop and ask** triggers.

**Considered and rejected; do not reintroduce:**
- code-size budgets and file-size limits
- bans on language features
- an AI reviewer gate
- scheduled drift audits
- maintaining golden masters after go-live
- schema versions and down-converters
- automated contract gates tied to client versions
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
- **Output impact preview.** The new build does a read-only dry run of its mapping and rules over the raw payloads stored in production. It reports how many items would change, which fields, and before/after examples. No writes, no CRM calls. An item failing the schema or invariants blocks the release (E5).
- **Flags for the approver (information only):** breaking schema changes, new dependencies, and the client versions currently pulling.
- **Links** to what to check on the staging sites, and acceptance status.

One approval promotes Core, the WP plugin channel and the Lovable kit. Every deploy tags a Sentry release.

## 5. Webhooks, jobs, catch-up, writes and bells

**Normal load** is under 1 webhook per second, and changes reach subscribers near-instantly. **Bursts**, for the same or different entities, never crash Core or overload CRMs, the database or subscribers. **Design target:** 10x launch load.

### 5.1 One job per entity: "reconcile this entity"

- **A webhook, a catch-up or a resync is only a hint:** "entity X may have changed." The job fetches the current state from the CRM:
  - **Found:** upsert.
  - **Definitive not-found:** tombstone. This is the normal outcome of "updated then deleted before processing"; it is logged, not an error.
  - **Fetch failed:** retry with backoff. Never tombstone on failure. After the final retry, report to Sentry and park the job.
- **Order-independent.** Late, duplicate and out-of-order hints all end in the CRM's current state.

### 5.2 Dedupe: at most one pending job per entity

- **One queue row per `(connection, datatype, remote_id)`.** Repeated hints only update that row.
- **Older hints are cleared by any write.** When the entity is fetched and written, from any source, every hint received before that fetch started is removed.
- **A hint that arrives during a fetch** triggers exactly one follow-up run.
- **No fixed delay.**

### 5.3 Priority

One queue with a priority column:
- **High:** webhooks.
- **Low:** catch-up, initial load, resync and recompute.

Workers always take high first.

### 5.4 Catch-up for missed webhooks (rare edge case)

- **When:** once **at worker start**, which covers Core downtime and restarts, the most likely cause. After that, every **12 h** as a backstop for webhooks lost on the CRM side.
- **What it asks:** the CRM for entities changed since the last successful catch-up, **minus an overlap** (default 1 h).
- **Only what needs updating:** the CRM's last-modified time is compared with the stored `remote_updated_at`. Only entities that differ are enqueued, at low priority. Unchanged entities cost no fetch and no write.
- **Missed deletes:** once a day the adapter compares the CRM's full id list with Core's. Missing ids are enqueued as normal reconcile jobs, so a tombstone only follows a confirmed not-found.
- **Marker:** it only advances after a successful run. A late or failed run turns the `schedules` health check red.

### 5.5 Intake never falls over

- **Minimal work.** The webhook handler validates the signature, logs the event, upserts one queue row and returns 202.
- **Database failure.** If the database is unavailable, it returns 503 so the CRM retries.

### 5.6 Workers protect everything downstream

- **CRMs:** a rate limit and concurrency cap per connection.
- **Database:** a global worker concurrency cap.
- **Fairness:** tenants are served round-robin, with `FOR UPDATE SKIP LOCKED` for claiming.

### 5.7 Write ordering (why a lock exists)

Subscribers read "everything after `seq` N". If two workers commit at the same time and a higher `seq` becomes visible before a lower one, a subscriber can move past the lower one and **skip an item forever**.

- **The fix:** each write transaction takes a short global transaction lock (milliseconds), so `seq` order equals commit order.
- **It never bottlenecks:** CRM rate limits cap fetches far below what a single writer handles.

### 5.8 Bells are throttled per subscriber

- **Leading edge:** the first change after a quiet period rings immediately.
- **Trailing edge:** further changes within 10 s collapse into one bell.

## 6. Contract evolution: one shape, expand-contract

Core serves one shape: the current one. No versions, no converters, no automated gates.

- **Additive changes at any time.** Clients store unknown fields untouched, ignore them in templates, and handle unknown enum values safely (for example, not listed). This is tested in the client contract suite.
- **A breaking change** (rename, remove, retype, changed meaning) is done as **expand → migrate → contract**, three ordinary releases:
  1. **Expand:** add the new field next to the old one.
  2. **Migrate:** release clients that use the new field.
  3. **Contract:** remove the old field in a later release. The release report flags the removal and lists the client versions currently pulling; the approver decides.
- **Safety net** (SRS §8): a client that receives an item it can't use reports it to Sentry, skips it and keeps serving its local data.
- **Client version header.** Clients send `X-Core-Client: <client>/<version>` on every pull. It is logged for debugging and shown in the release report.

## 7. Onboarding, deletes, patching, purge and resync

### 7.1 Initial sync

| Situation | Operator action | What happens |
|---|---|---|
| **New tenant** | Add tenant and connection, then `event: connection_added` | Full load of all licensed offices at low priority: offices, then agents, areas, associations, properties. |
| **New office in existing tenant** | Add to `licensed_offices`, then `event: offices_added` | Only that office's entities, plus referenced tenant-wide entities that are missing. |
| **New subscriber on existing tenant** | Add subscriber | The subscriber pulls from `after = 0` out of Core's store. No CRM traffic. |
| **Office removed / connection deactivated** | Update, then `event: offices_removed` / `connection_removed` | The affected entities become tombstones. |

### 7.2 Deletes and recovery

- **Soft delete.** A deleted entity becomes a tombstone with a new `seq`. Tombstones are hard-deleted after 90 days, and Core keeps a purge watermark per tenant.
- **Stale cursor.** A subscriber behind the watermark gets *resync-required*. It pulls everything, then deletes local items not seen, only after a complete, successful pull.
- **Resync with sweep (operator).** Re-fetch a scope at low priority, rebuild in place, then tombstone anything not seen.
- **Purge and resync (operator).** For broken stored data. The same flow with existing rows discarded first. Subscribers keep serving local data until the rebuild completes.
- **Hard rule:** no operator action may make a subscriber empty its store as a side effect.

### 7.3 Patching display or canonical data

- **Before release:** the release report previews the impact on production data (§4).
- **After the production deploy:** a recompute runs automatically at low priority over rows with an older `rules_version`, using stored `raw` and no CRM calls.
- **Changed rows:** rows whose hash changes get a new `seq`, bells go out as normal, and subscribers pull with their normal loop.
- **Unchanged:** unchanged rows and `remote_updated_at` are never touched.
- **Breaking shape changes** follow §6.
- **Template-only client changes** use a `forcerefresh` bell.

## 8. Health and debug visibility

### 8.1 `GET /v1/health` (no auth)

Returns **200 if all checks pass, 500 if any fails, with the same payload**. It contains counts only, no names.

```json
{
  "ok": false,
  "version": "1.4.0",
  "checks": {
    "db":          { "ok": true },
    "worker":      { "ok": true,  "last_heartbeat_s": 4, "limit_s": 120 },
    "webhook_lag": { "ok": false, "oldest_unresolved_s": 420, "limit_s": 300 },
    "low_queue":   { "ok": true,  "oldest_job_age_s": 3600, "limit_s": 86400 },
    "schedules":   { "ok": true,  "late": 0 },
    "subscribers": { "ok": true,  "not_pulled_60m": 0 }
  }
}
```

| Check | Fails when |
|---|---|
| `db` | The database is unreachable |
| `worker` | No worker heartbeat for 2 min |
| `webhook_lag` | Any webhook received more than **5 min** ago has no final outcome yet for its entity. Final outcomes are written, unchanged, tombstoned or dropped. Retrying and parked jobs count as unresolved. It clears when the entity is reconciled or an operator discards the parked job. |
| `low_queue` | The oldest waiting low-priority job is older than 24 h |
| `schedules` | A catch-up is late or failed |
| `subscribers` | An active subscriber hasn't pulled for 60 min |

`GET /v1/admin/health` returns the same checks with names.

### 8.2 Event log: "what happened, where, and when"

Every event is one row in `events`. Each row carries a **correlation id** that links the whole chain: webhook → job → CRM call → write → bell → pull. The same id is attached to Sentry errors.

| Event | Metadata stored |
|---|---|
| `webhook.received` | connection, path, headers (secrets redacted), body as received, signature valid, entities referenced, response code |
| `job.queued` / `deduped` / `started` / `finished` | entity, priority, reason (webhook, catch-up, initial, resync, recompute), attempt, duration, outcome |
| `crm.call` | method, endpoint and query (secrets redacted), status, duration, response size, rate-limit headers, error body on failure |
| `entity.written` | entity, `seq`, old and new hash, **changed fields with before/after values**, `rules_version`; or `unchanged` / `dropped` (reason) / `tombstoned` |
| `bell.sent` | subscriber, sent or throttled, status, duration |
| `pull` | subscriber, client version, datatype, `after`, items returned, duration |
| `schedule.run` | catch-up window, entities listed, enqueued, outcome |
| `admin.call` | endpoint, parameters |

**Query:** `GET /v1/admin/events?entity=…|connection=…|subscriber=…|correlation=…|type=…&from=…&to=…` returns a timeline, for example:

```
10:02:01.120 webhook.received  vitec-acme  property OBJ-19203  sig=ok  202
10:02:01.131 job.started       reason=webhook priority=high
10:02:01.402 crm.call          GET /estates/OBJ-19203  200  268ms  rl-remaining=412
10:02:01.455 entity.written    seq=48213  price: 4950000 → 4750000, display.price: "4 950 000 kr" → "4 750 000 kr"
10:02:01.470 bell.sent         acme-prod  500  1.2s
10:15:00.010 pull              acme-prod  wordpress/1.4.2  datatype=property after=48100 items=0 ← hasn't received it yet
```

- **Retention:** 30 days, dropped by partition.
- **Access:** admin auth only, because bodies can contain personal data.

## 9. Phases and approval gates

| Phase | Output | Exit |
|---|---|---|
| **0. Decide** | Strategy and acceptance criteria | **Gate 1: approved 2026-09-15** |
| **1. Foundation** ◄ current | Hosting pick, repo tooling, §3 checks and warnings, staging and prod as code, Sentry, health endpoint, release gate, a "hello health" app | A trivial change goes PR → staging → approved → production, and a failing health check alerts |
| **2. Canonical model** | JSON Schemas, a field table per datatype, dummy data (`golden/fake/`) | **Gate 2:** field tables approved |
| **3. Engine** | Engine, queue, catch-up framework, bells, health, event log, fake adapter, fake subscriber | Engine acceptance criteria green |
| **4. Clients** | WP plugin, Lovable kit, example site, staging client sites | Client acceptance criteria green |
| **5. Real data** | Humans supply real golden masters per CRM, rules ledger (§11), parity inventory, CRM docs and rate limits, test credentials | **Gate 3:** golden masters and ledger approved |
| **6. Adapters** | Vitec and Mspecs: golden masters first, then test accounts on staging | Adapter acceptance criteria green |
| **7. Soak & go-live** | 7 days on staging with no unresolved Sentry issues, burst and load tests, restore drill, parity check | **Gate 4:** first production tenant |

- **Golden masters are the acceptance for the initial build only.** They are retired at Gate 4.
- **After go-live, output correctness is protected by:**
  - rule-level tests (one per ledger rule, updated with the rule)
  - schema and invariant checks
  - the release impact preview on real data (§4)

**Golden-master case format** (initial build):

```
golden/<provider>/<datatype>/<case>/
  payload.json     CRM payload, untouched
  canonical.json   same entity in the universal data model
  display.json     human-readable output used by websites
```

## 10. Acceptance Criteria v1.6

### SRS AC 1-15, with clarifications

| AC | Clarification |
|---|---|
| 1 | Initial build (until Gate 4): every golden-master case matches `canonical.json` and `display.json` exactly (canonical JSON: sorted keys, UTF-8) and validates against its schema. |
| 5 | Applies to the WP and Lovable clients too (AC 20). |
| 8 | "Keep serving" means every page type returns 200 with the last synced content through a 24 h Core outage. |
| 9 | Also covers shrinking (AC 26). |
| 10 | Also covers a new enum value (§6). |
| 11 | The malformed record is also in the event log. Other records in the same run are still written. |
| 13 | The recompute runs automatically after a release that changes mapping or rules, at low priority. Its impact was shown in the release report beforehand. |
| 14 | Also loads missing tenant-wide entities the new office references. Other offices get no new `seq`. |
| 15 | "Exactly" means zero new `seq` values when the mapper is unchanged. |

### Additions

| AC | Criterion |
|---|---|
| 16 | **Event log.** For a given entity, one query returns its full timeline across webhook, job, CRM call (with metadata), write (with changed fields), bell and pull, linked by correlation id. For each "not updated" cause (deduped, unlicensed, hash unchanged, malformed, not-found, fetch failed, bell throttled, bell failed, subscriber not pulling), the timeline shows the cause. Secrets are redacted. Events older than 30 days are gone. |
| 17 | **Health and alerting,** verified by injected faults on staging. Each §8.1 failure turns `/v1/health` to 500 with that check `ok: false`, and back to 200 when resolved. Sentry Uptime alerts on 500. Unhandled errors in Core, adapters and clients reach Sentry. |
| 18 | **Pipeline.** Merging to main deploys staging and runs the smoke suite automatically. Production deploys only after approval. A failed production health check leaves the previous version live. |
| 19 | **No skipped items.** With many concurrent workers and during deploy overlap, a subscriber paging by cursor never misses an item. |
| 20 | **Real clients.** WP and Lovable pass the sync scenario suite, and give identical results for the search/filter scenario suite on the same dataset. |
| 21 | **Safe update.** A broken client release is replaced by the next release without manual steps. A broken Lovable site release doesn't stop syncing. |
| 22 | **Backstop.** With bells blocked, a subscriber converges within 15 min. |
| 23 | **Schema and invariants.** Every item served validates against the current schema and invariants. The release report blocks a release that would violate them. |
| 24 | **Recovery.** The scripted restore drill on staging ends with subscribers converged. |
| 25 | **Secrets and privacy.** Credentials are encrypted at rest (`CREDENTIALS_KEY`). Seeded secrets never appear in Sentry, the event log, stdout or `/v1/health`. All hosting and Sentry data stays in the EU. |
| 26 | **Removal.** Removing an office or deactivating a connection tombstones its items. Tombstones are hard-deleted after 90 days. |
| 27 | **Scale and read latency.** Load test on staging at 10x launch: 200 tenants, one tenant with 300k properties. Page size is 100 items (default and max). Time to first byte p95 under 100 ms, full response p95 under 300 ms. |
| 28 | **Functional parity.** Everything in the human-supplied parity inventory is servable from Core data. |
| 29 | **Burst resilience.** 50,000 webhooks in 1 minute across 50,000 different entities: <br>• Every webhook gets 202 within 1 s (p99), with no crash and no lost webhook. <br>• CRM calls stay within rate limits. <br>• Each subscriber gets at most one bell per throttle window. <br>• `webhook_lag` health goes red and back to green. <br>• All entities converge. |
| 30 | **Contract evolution.** <br>• Additive fields and unknown enum values break no client. <br>• A client receiving an item it can't use skips it, reports to Sentry and keeps serving. <br>• The release report flags breaking schema changes and lists client versions currently pulling. |
| 31 | **Purge and resync safety.** Purge-and-resync or resync-with-sweep on a live tenant never leaves a subscriber with fewer items than Core has at the end, and sites keep serving. A subscriber behind the purge watermark is told to resync and converges. |
| 32 | **Near-instant under normal load.** At under 1 webhook/s, webhook received → bell sent is p95 under 2 s excluding CRM fetch time, including while another tenant's 30k-entity initial load runs. |
| 33 | **Race conditions and dedupe.** Each ends with the CRM's current state and no Sentry error: <br>• update then delete before processing → tombstone <br>• delete then late update → tombstone <br>• 100 webhooks for one entity → at most 2 fetches <br>• a webhook during a fetch → exactly one follow-up <br>• a write from any source clears older pending hints <br>• a transient failure → retry, never tombstone |
| 34 | **Initial sync.** A new tenant converges to a full load. A new office loads only that office plus missing referenced entities. A new subscriber converges from Core's store with zero CRM calls. |
| 35 | **Catch-up.** <br>• With webhooks disabled for 6 h, every change converges after the next catch-up. <br>• Unchanged entities cause zero fetches and zero writes. <br>• A catch-up runs at worker start. <br>• A delete whose webhook was lost is tombstoned by the daily id comparison after a confirmed not-found. <br>• A failed catch-up doesn't advance its marker and turns health red. |
| 36 | **Release impact preview.** The release report shows item counts, changed fields and before/after examples for the production data. It performs no writes and no CRM calls. |
| 37 | **Checks.** Each enforced check (§3.1) fails on a seeded violation. Warnings (§3.2) never block. |
| 38 | **Webhook lag.** A webhook whose entity isn't reconciled within 5 min, whether stuck, retrying or parked, turns `webhook_lag` red. It turns green once the entity is reconciled or the parked job is discarded. |

## 11. Rules ledger: what Kowboy supplies

**What it is.** A plain-language list of every piece of logic that is more than copying a CRM field. Golden masters show *what* the output is for examples; the ledger says *why*, so agents implement the general rule.

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
2. Split into `web` and `worker`, with Postgres "reconcile entity" jobs, one pending row per entity, and a priority column (§5).
3. Catch-up per adapter at worker start and every 12 h, plus a daily id comparison (§5.4).
4. Add a short global transaction lock per write, replacing the in-process mutex (§5.7).
5. Throttle bells per subscriber with a leading and trailing edge.
6. Remove `schema_version` and down-converters. One shape, additive changes, and expand-contract as ordinary releases (§6).
7. Add tombstone purge, a watermark, resync-required responses, resync-with-sweep and purge-and-resync (§7).
8. `/v1/health` returns 200 or 500 with named checks, including a 5-min webhook lag; add `/v1/admin/health` and the event log with correlation ids (§8). No Sentry Crons.
9. Reduce page size from 1000 to 100.
10. Add a `CREDENTIALS_KEY` env var.
11. Generate TS types from JSON Schema; use golden masters for the initial build only; ledger format as in §11.
12. Add a manual production approval with a release report and impact preview (§4).
13. Choose hosting in Phase 1 against fixed criteria.
14. Build on dummy data first; real golden masters before the adapters.
15. Recompute automatically after a release that changes mapping or rules.

## 13. Defaults (changeable without a gate)

| Setting | Default |
|---|---|
| Bell throttle window | 10 s |
| Event log retention | 30 days |
| Catch-up | at worker start and every 12 h, 1 h overlap |
| Id comparison for deletes | daily |
| Fetch retries | 5, exponential backoff, then park and report to Sentry |
| Health: worker heartbeat | 2 min |
| Health: webhook lag | 5 min |
| Health: low queue | 24 h |
| Health: subscriber not pulled | 60 min |
| Staging soak before go-live | 7 days |
