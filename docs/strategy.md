# Kowboy Core - Delivery Strategy

**Status:** v4, **Gate 1 approved 2026-09-15** (amended same day) · **Inputs:** Kowboy_Kore_Concept.md, Kowboy_Kore_SRS_v1.2.md (treated as suggestions), Patric's decisions of 2026-09-15

**Naming:** the product is **Kowboy Core**, or just **Core** (formerly "Kore"). The CRM-agnostic part inside it is called the **engine**. Every `Kore`/`kore` identifier in the SRS becomes `Core`/`core`, for example `X-Core-Secret` and `/wp-json/core/v1/bell`.

## 1. Goal

Get from the Concept and SRS to a production deploy. Agents do the building and Patric approves. The operating model has three parts:

- **Agents build, CI decides correctness.** Automated tests are the definition of done. Patric's check on staging is a release decision, not a substitute for tests.
- **Patric approves behaviour, never code.** He sees plain-language summaries, field tables, golden masters and a green or red acceptance report.
- **Drift is blocked by machines first and prose second.** If an AGENTS.md rule can be checked by a tool, CI checks it.

## 2. Architecture decisions

| Concern | Decision | Why |
|---|---|---|
| Language | TypeScript strict, Node LTS | Agents are strongest here; one language for engine and adapters |
| Processes | **One codebase, two roles:** `web` (API, webhook intake, health) and `worker` (jobs, schedules, bells) | Intake stays fast whatever the workers are doing |
| Database | Postgres, plain SQL migrations, no ORM | Fewest abstractions |
| Queue | **Postgres job table, no Redis** (§5) | One database is the only stateful thing |
| Contract | JSON Schema per datatype per version is the source of truth; TS types are generated from it | Schema and code can't drift apart |
| Tests | Vitest against real Postgres in CI; golden masters are table-driven | Adding a golden-master case adds a test with no new code |
| Guards | Biome, dependency-cruiser (seam), forbidden-strings script, size limits | Machine-enforced architecture |
| CI/CD | GitHub Actions and GitHub Environments | The production approval is one button |
| Monitoring | **`/v1/health`** returns 200 when every check passes and 500 when any fails, with the same payload (§8). Any external monitor can watch it. We use Sentry Uptime. | One status signal, tool-agnostic |
| Errors | **Sentry, EU region**, in Core and both clients | One error surface |
| WP client | PHP 8.3, PHPUnit, PHPStan, wp-env | |
| Lovable client | Supabase edge functions (Deno), Supabase CLI, staging and prod projects | Required by Lovable |
| Repos | Monorepo `kowboy-core`: `engine/`, `adapters/<provider>/`, `clients/wordpress/`, `clients/lovable-kit/`, `schemas/`, `golden/`, `rules-ledger/`, `acceptance/`. The Lovable example site gets its own repo. | CI runs the real clients against the real Core |

### Hosting: decided at the start of Phase 1

Render is excluded. At the start of Phase 1 an agent compares market-leading options and picks against the criteria below. The shortlist includes Google Cloud Run with Cloud SQL, AWS ECS Fargate with RDS, Azure Container Apps, and Fly.io/Railway for contrast. The pick is recorded in `docs/decisions.md` and sent to Patric as an FYI with a monthly cost estimate. It only becomes a decision if he objects.

Hard criteria:
- **Billing:** no servers or OS to manage, and billed per instance or resource, not per invocation.
- **Region:** EU for both app and database.
- **Database:** managed Postgres with point-in-time recovery, in the same region as the app.
- **Processes:** separate `web` and `worker` services, each able to scale horizontally.
- **Deploys:** health-gated zero-downtime deploys and one-command rollback.
- **Config and access:** infrastructure as code in the repo, and a CLI or API agents can drive.
- **Maturity:** a published SLA and strong operator reputation.

## 3. Drift resistance (the heart of AGENTS.md)

`CLAUDE.md` contains one line pointing to `AGENTS.md`. Every rule is tagged **[CI]** (enforced by a check) or **[PROSE]** (judgment).

1. **Concept rules verbatim**, plus the escalation rule: "if both options look reasonable, ask Patric."
2. **No legacy access [PROSE, absolute].** Agents never read, request or search the old plugin repos or any legacy code. Humans extract requirements and write them as specs, ledger entries or golden masters.
3. **Glossary [CI].** The glossary is fixed. The forbidden-strings check rejects `Kore`.
4. **Fixed layout [CI].** Only approved top-level folders may exist, and each has a one-line purpose.
5. **The seam [CI].** The engine never imports adapters. No CRM name appears in `engine/` or `clients/`. Adapters never touch engine tables.
6. **Protected paths [CI].** Changes to `schemas/`, `golden/<real provider>/`, `rules-ledger/`, `acceptance/`, `AGENTS.md` and infra files need Patric's approval (CODEOWNERS). Agents may never make a test pass by editing its expected output. `golden/fake/` (dummy data) is agent-owned.
7. **Size limits [CI].** Max file length, function length and complexity. No `any`, no lint suppressions, no skipped tests.
8. **Dependency allowlist [CI].** A new runtime dependency or vendor fails CI until approved.
9. **Pairing [CI].** Every ledger rule has a rule file and a test. Every golden-master case is complete. Every acceptance criterion maps to a named test.
10. **Generated files are never hand-edited [CI].** CI regenerates them and fails on any diff.
11. **Contract compatibility [CI].** A non-additive change to a served schema version fails CI (§6).
12. **One way to do each thing [PROSE + reference implementations].** One logging helper, one error type, one job pattern, one SQL pattern.
13. **Definition of done [CI].** Everything green, the acceptance report updated, and a `docs/decisions.md` line for any structural choice.
14. **Stop-and-ask triggers [PROSE].** Agents stop for: a contract, golden-master or ledger change, a new dependency, vendor or cost, a gap the Concept doesn't settle, or a production incident.

## 4. Pipeline and release gate

```
PR ──► CI: typecheck · lint · guards · unit · golden masters · contract tests (Core + fake adapter + real clients)
merge main ──► auto-deploy STAGING (Core + staging WP site + staging Lovable site)
          ──► automated smoke suite on staging
          ──► agent posts release note to Patric (plain language)
Patric checks staging clients ──► clicks Approve ──► deploy PRODUCTION (health-gated, old version stays live on failure)
```

- **The release note** says what changed in plain language, what to look at on the staging sites (with direct links), acceptance report status, and any risk.
- **One approval per release** promotes Core, the WP plugin channel and the Lovable kit.
- Every deploy tags a Sentry release.

## 5. Webhooks, jobs, bells and scale

**Normal load** is under 1 webhook per second, and changes must reach subscribers **near-instantly**. **Bursts**, for the same or different entities, must never crash Core or overload CRMs, the database or subscribers. **Design target:** 10x launch load.

### 5.1 One job per entity: "reconcile this entity"

- **A webhook is only a hint:** "entity X may have changed." The job fetches the entity's current state from the CRM:
  - **Found:** upsert.
  - **Definitive not-found:** tombstone. This is the normal outcome of "updated then deleted before we processed it", and is traced, not reported as an error.
  - **Fetch failed:** retry with backoff. Never tombstone on failure. After the final retry, report to Sentry and the trace, and park the job.
- **Order-independent.** Late, duplicate and out-of-order webhooks all end in the CRM's current state.

### 5.2 Dedupe: at most one pending job per entity

The queue holds **one row per entity**, keyed on `(connection, datatype, remote_id)`. Each row carries the time of the latest request.

- **Duplicate requests while pending:** they update the timestamp and don't add rows.
- **Stale requests are satisfied, from any source:** whenever the entity is fetched and written (webhook job, scheduled sync, initial load, resync), every request received *before that fetch started* is removed. They are irrelevant because the entity is already up to date.
- **Requests that arrive during a fetch** trigger exactly one follow-up run, because the CRM may have changed after we read it.
- **No fixed delay.** Under normal load a job starts immediately.

### 5.3 Two lanes: live and bulk

- **Live lane:** webhook jobs, always served first, so near-instant delivery holds even while a 30k-entity initial load runs.
- **Bulk lane:** initial loads, office additions and resyncs. It uses the capacity live jobs leave free.

### 5.4 Intake never falls over

- **Minimal work.** The webhook handler validates the signature, does one upsert and returns 202. It holds no in-memory queue.
- **Database failure.** If the database can't accept the write, intake returns 503 so the CRM retries.

### 5.5 Workers protect everything downstream

- **CRMs:** concurrency and rate limit per connection.
- **Database:** a global worker concurrency cap.
- **Fairness:** jobs are claimed round-robin across tenants with `FOR UPDATE SKIP LOCKED`.
- **Writes:** serialized per tenant. Commit order equals `seq` order within a tenant.

### 5.6 Bells are throttled per subscriber

- **Leading edge:** the first change after a quiet period rings immediately.
- **Trailing edge:** further changes within the window (10 s) collapse into one bell at the end.
- **Result:** at most one bell per subscriber per window, however many entities changed.

## 6. Data-model changes that would break clients

- **Clients always pin `schema_version`.** The API requires it and has no "latest" default.
- **Breaking changes** create a new version plus one down-converter per older version still served. Breaking means rename, remove, retype, a changed enum meaning, or a new enum value.
- **Old-version golden masters stay frozen and green** for as long as that version is served.
- **A version is retired only after 30 days with no pulls** in the pull log, and never earlier than 90 days after its successor shipped.
- **A converter failure for one item** skips that item and reports to Sentry. The sync keeps going.

## 7. Onboarding, deletes, retention, purge and resync

### 7.1 Initial sync

| Situation | Operator action | What happens |
|---|---|---|
| **New tenant** | Add tenant and connection (SQL), then `event: connection_added` | The adapter enqueues a full load of every licensed office in the bulk lane: offices, then agents, areas, associations, properties. |
| **New office in an existing tenant** | Add the office to `licensed_offices`, then `event: offices_added` | Only that office's entities are loaded, plus any tenant-wide entities they reference (agents, associations) that are missing. Other offices are untouched. |
| **New subscriber on an existing tenant** | Add subscriber (SQL) | The subscriber starts at `after = 0` and pulls everything Core already holds. No CRM traffic. |
| **Office removed / connection deactivated** | Update SQL, then `event: offices_removed` / `connection_removed` | The affected entities become tombstones. |

Load progress is visible through the admin queue counts per connection and the trace.

### 7.2 Deletes and recovery

- **Soft delete.** A deleted entity becomes a tombstone with a new `seq`. Tombstones are hard-deleted after **90 days**, and Core keeps a purge watermark per tenant.
- **Stale cursor.** A subscriber behind the watermark gets *resync-required*. It then pulls everything and deletes local items not seen, only after a complete, successful pull.
- **Resync with sweep (operator).** Re-fetch a scope via the bulk lane, rebuild into place, then tombstone anything not seen.
- **Purge and resync (operator).** For broken stored data. The same flow with existing rows discarded first. Subscribers keep serving their local copy until the rebuild completes.
- **Hard rule:** no operator action may, as a side effect, make a subscriber empty its store.

### 7.3 Patching display or canonical data

- **Non-breaking fix** (display string, mapping bug, new field). The release bumps `rules_version`. After the production deploy, a **recompute runs automatically** in the bulk lane over rows with an older `rules_version`, using stored raw payloads and making no CRM calls. Rows whose `content_hash` changes get a new `seq`. Unchanged rows are untouched. Bells go out normally and are throttled. Subscribers pull the changed items with their normal delta loop. `remote_updated_at` is never touched, so "updated" dates and sitemap `lastmod` don't move. The release note states how many items the recompute is expected to change.
- **Breaking change.** This ships as a new `schema_version` (§6), and the same recompute runs. Clients pinned to an old version receive the down-converted item. Its `content_hash` is computed per served version, so they skip items whose old-version content didn't change.
- **Template-only change in a client** (no data change). An admin `forcerefresh` bell, as in the SRS.

## 8. Health and debugging visibility

### 8.1 `GET /v1/health` (no auth)

Returns **200 if every check passes, 500 if any fails, with the same payload either way**. It contains counts only, no tenant names.

```json
{
  "ok": false,
  "version": "1.4.0",
  "checks": {
    "db":          { "ok": true },
    "worker":      { "ok": true,  "last_heartbeat_s": 4,   "limit_s": 120 },
    "live_queue":  { "ok": false, "oldest_job_age_s": 1320, "limit_s": 900 },
    "bulk_queue":  { "ok": true,  "oldest_job_age_s": 3600, "limit_s": 86400 },
    "schedules":   { "ok": true,  "late": 0 },
    "subscribers": { "ok": true,  "not_pulled_60m": 0 }
  }
}
```

| Check | Fails when |
|---|---|
| `db` | The database is unreachable |
| `worker` | No worker heartbeat for 2 min |
| `live_queue` | The oldest waiting live job (not counting parked jobs) is older than **15 min** |
| `bulk_queue` | The oldest waiting bulk job is older than 24 h |
| `schedules` | Any adapter's scheduled run is overdue |
| `subscribers` | Any active subscriber hasn't pulled for 60 min |

`GET /v1/admin/health` returns the same checks with names, such as *which* subscriber or connection. Sentry Uptime watches `/v1/health` and alerts on 500. Sentry handles errors. There are no other monitoring tools.

### 8.2 "Why didn't property X update after trigger from CRM Y?"

- **`trace` table**, one row per decision about an entity: webhook received, deduped, fetch outcome (found, not-found, failed plus attempt), mapped, dropped (plus reason), hash unchanged, written (`seq`), tombstoned, bell sent or throttled (status). Rows are kept for 30 days.
- **Pull log.** Clients send a subscriber label, and Core stores the last cursor, `schema_version` and time per subscriber and datatype.
- **`GET /v1/admin/trace?remote_id=…`** returns one timeline. Example: "webhook 10:02:01 → fetched → written seq 48213 → bell to acme-prod 10:02:02 → 500 → acme-prod last pulled after=48100 at 09:45."

## 9. Phases and approval gates

| Phase | Who | Output | Exit |
|---|---|---|---|
| **0. Decide** | Patric | Strategy and AC v1.3 | **GATE 1: approved 2026-09-15** |
| **1. Foundation** | Agent | Hosting pick (FYI), repo, AGENTS.md, CI guards, staging and prod environments, Sentry, health endpoint, release gate | A trivial change reaches staging, Patric's approve button promotes it, and a failing health check raises an alert |
| **2. Canonical model** | Agent drafts, Patric approves | JSON Schemas for the five datatypes, a **field table per datatype**, and agent-written **dummy data** (`golden/fake/`: invented provider payload → canonical → display) | **GATE 2:** Patric approves the field tables |
| **3. Engine** | Agent | Engine, jobs, lanes, bells, health, trace, versioning, fake adapter, fake subscriber, all on dummy data | Engine acceptance criteria green |
| **4. Clients** | Agent | WP plugin, Lovable kit, example site, staging client sites, against the fake adapter | Client acceptance criteria green |
| **5. Real data** | Humans supply | Real golden-master cases per CRM, rules ledger (§11), parity inventory, CRM rate limits and webhook docs, test credentials | **GATE 3:** Patric approves the golden masters and ledger |
| **6. Adapters** | Agent | Vitec and Mspecs, golden masters first, then test accounts on staging | Adapter acceptance criteria green; staging ingesting live test data |
| **7. Soak & go-live** | Agent, then Patric | 7 days on staging with no unresolved Sentry issues, burst and load tests, restore drill, parity check | **GATE 4:** first production tenant |

After Gate 4, every production release goes through the one-click release gate (§4). Humans can prepare Phase 5 material whenever they like; only Phase 6 waits for it. The dummy data stays forever as the fake provider's test suite.

**Golden-master case format:**

```
golden/<provider>/<datatype>/<case>/
  payload.json     CRM payload, untouched
  canonical.json   same entity in the universal data model
  display.json     human-readable output used by websites
```

## 10. Acceptance Criteria v1.4

### SRS AC 1-15, with clarifications

| AC | Clarification |
|---|---|
| 1 | For every golden-master case, the output matches `canonical.json` and `display.json` exactly (canonical JSON: sorted keys, UTF-8), and validates against its schema. |
| 5 | Applies to the WP and Lovable clients too (AC 20). |
| 8 | "Keep serving" means every page type returns 200 with the last synced content through a 24 h Core outage. |
| 9 | Also covers shrinking (AC 26). |
| 11 | The malformed record also appears in the trace. Other records in the same run are still written. |
| 13 | The recompute runs automatically after a release that bumps `rules_version`, in the bulk lane, and each rewritten item gets a `recomputed` trace entry. |
| 14 | Also loads missing tenant-wide entities the new office references. Other offices get no new `seq`. |
| 15 | "Exactly" means zero new `seq` values when the mapper is unchanged. |

### Additions

| AC | Criterion |
|---|---|
| 16 | **Traceability.** For each "not updated" cause (deduped, unlicensed, hash unchanged, malformed, not-found, fetch failed, bell throttled, bell failed, subscriber not pulling), `/v1/admin/trace` names the cause. |
| 17 | **Health and alerting,** verified by injected faults on staging. Each failure in §8.1 turns `/v1/health` to 500 with that check `ok: false`, and back to 200 when resolved. A Sentry Uptime alert fires on 500. Unhandled errors in Core, adapters and clients reach Sentry. |
| 18 | **Pipeline.** Merging to main deploys staging and runs the smoke suite automatically. Production deploys only after Patric's approval. A failed production health check leaves the previous version live. |
| 19 | **Deploy overlap.** While old and new instances overlap, commit order equals `seq` order per tenant and no job is lost. |
| 20 | **Real clients.** WP and Lovable pass the sync scenario suite, and return identical results for the search/filter scenario suite on the same dataset. |
| 21 | **Safe update.** A broken client release is replaced by the next release without manual steps. A broken Lovable site release doesn't stop syncing. |
| 22 | **Backstop.** With bells blocked, a subscriber converges within 15 min. |
| 23 | **Schema.** Every item served validates against the schema version the client requested. |
| 24 | **Recovery.** The scripted restore drill on staging ends with subscribers converged. |
| 25 | **Secrets and privacy.** Credentials are encrypted at rest (`CREDENTIALS_KEY`). Seeded secrets never appear in Sentry, the trace, stdout or `/v1/health`. All hosting and Sentry data stays in the EU. |
| 26 | **Removal.** Removing an office or deactivating a connection tombstones its items. Tombstones are hard-deleted after 90 days. |
| 27 | **Scale and read latency.** Load test on staging at 10x launch: 200 tenants, one tenant with 300k properties. `/v1/changes` page size is **100 items (default and max)**. For a 100-item page: **time to first byte p95 under 100 ms**, full response p95 under 300 ms. |
| 28 | **Functional parity.** Everything in the human-supplied parity inventory is servable from Core data. |
| 29 | **Burst resilience.** 50,000 webhooks in 1 minute across 50,000 different entities: <br>• Every webhook gets 202 within 1 s (p99), with no crash and no lost webhook. <br>• CRM calls stay within rate limits. <br>• Each subscriber gets at most one bell per throttle window. <br>• `live_queue` health goes red and back to green. <br>• All entities converge. |
| 30 | **Non-breaking evolution.** After a breaking schema change ships as v2, a client pinned to v1 keeps syncing, gets byte-identical v1 golden-master output, and never errors. v1 can't be retired while the pull log shows v1 pulls in the last 30 days. |
| 31 | **Purge and resync safety.** Purge-and-resync or resync-with-sweep on a live tenant never leaves a subscriber with fewer items than Core has at the end, and sites keep serving throughout. A subscriber behind the purge watermark is told to resync and converges. |
| 32 | **Near-instant under normal load.** At under 1 webhook/s, webhook received → bell sent is p95 under 2 s excluding CRM fetch time. **This also holds while another tenant's 30k-entity initial load runs.** |
| 33 | **Race conditions and dedupe.** Each ends with the CRM's current state, no Sentry error, and a trace entry: <br>• update then delete before processing → tombstone <br>• delete then late update webhook → tombstone <br>• 100 webhooks for one entity → at most 2 fetches <br>• a webhook during that entity's fetch → exactly one follow-up run <br>• a write from any source (e.g. resync) removes older pending requests for that entity <br>• a transient fetch failure → retry, never tombstone |
| 34 | **Initial sync.** A new tenant converges to a full load of all licensed offices. A new office in an existing tenant loads only that office plus missing referenced entities. A new subscriber on an existing tenant converges from Core's store with zero CRM calls. |

## 11. Rules ledger: what Kowboy supplies

**What it is.** The golden masters show *what* the output should be for specific examples. The ledger says *why*, so an agent can implement the general rule and not just the examples. It covers every piece of logic that is more than copying a CRM field into the canonical model.

**What belongs in it.** Only rules whose answer depends on CRM data alone (SRS §7 placement rule). Illustrative examples:

- Which CRM statuses count as `coming_soon`, `for_sale`, `sold` or `withdrawn`
- When the price is shown as a number and when as "Pris på begäran"
- How living and additional space combine into "82 + 12 m²"
- Price, phone number and address formatting
- Which images are dropped and how they are ordered
- When a sold price is hidden

**What does not belong in it:** anything that depends on the current time, the viewer or site configuration. Past viewings, wording per site and layout are subscriber concerns.

**Format.** One entry per rule, plain language, no code:

```
R-012  Price on request
When:     the price is 0, empty, or flagged "on request" in the CRM
Then:     price = null, display.price = "Pris på begäran"
CRMs:     both (note any per-CRM differences)
Examples: golden/vitec/property/price-on-request, golden/mspecs/property/no-price
```

**How it's used:**
- Each entry becomes one rule file plus a test, linked by its ID (CI checks the pairing).
- The ledger can start incomplete. A rule added later ships in a release, and `recompute` fixes all stored data without CRM traffic.
- Agents may not invent rules. A gap goes to Patric as a question.

## 12. Changes to the SRS

1. Rename Kore to Kowboy Core (Core); the CRM-agnostic part becomes the engine.
2. Split into `web` and `worker` roles, with Postgres "reconcile entity" jobs, one pending row per entity, and live and bulk lanes (§5).
3. Throttle bells per subscriber with a leading and trailing edge.
4. Serialize writes per tenant with a database lock, replacing the global in-process mutex.
5. Make `schema_version` required, retire versions based on the pull log, and treat new enum values as breaking (§6).
6. Add tombstone purge, a watermark, resync-required responses, and resync-with-sweep and purge-and-resync operations (§7).
7. `/v1/health` returns 200 or 500 with named checks; add `/v1/admin/health`, the trace table, pull log and trace endpoint (§8). No Sentry Crons.
8. Reduce page size from 1000 to 100.
9. Add a `CREDENTIALS_KEY` env var.
10. Generate TS types from the JSON Schemas; use the three-file golden-master format; ledger format as in §11.
11. Add a manual production approval gate.
12. Choose hosting in Phase 1 against fixed criteria.
13. Build on dummy data first; real golden masters come before the adapters.
14. Recompute runs automatically after a release that bumps `rules_version`; `content_hash` is computed per served schema version (§7.3).

## 13. Defaults chosen by the agent (Patric may override any time; none block)

| Setting | Default |
|---|---|
| Bell throttle window | 10 s |
| Trace retention | 30 days |
| Staging soak before go-live | 7 days |
| Fetch retries | 5, exponential backoff, then park and report to Sentry |
| Health: worker heartbeat | 2 min |
| Health: live queue | 15 min |
| Health: bulk queue | 24 h |
| Health: subscriber not pulled | 60 min |

## 14. Next

Phase 1 starts on Patric's go.
