# Decisions

One line per structural decision: date, decision, reference. Append only. Details live in [strategy.md](strategy.md).

- 2026-09-15 · Gate 1 approved: strategy and acceptance criteria · strategy §9, §10
- 2026-09-15 · Product renamed Kore → Kowboy Core ("Core"); CRM-agnostic part is the "engine" · strategy header
- 2026-09-15 · SRS v1.2 amendments accepted · strategy §12
- 2026-09-15 · TypeScript + Postgres, monorepo, web and worker roles, Postgres job queue with priority column, no Redis · strategy §2, §5
- 2026-09-15 · Hosting chosen at the start of Phase 1 against fixed criteria; Render excluded · strategy §2
- 2026-09-15 · Manual production approval per release, with a release report and impact preview on production data · strategy §4
- 2026-09-15 · Build on dummy data first; golden masters are acceptance for the initial build only, retired at go-live · strategy §9
- 2026-09-15 · Agents never access legacy repos or code · AGENTS.md rule 5
- 2026-09-15 · Short global transaction lock per write so seq order equals commit order · strategy §5.7
- 2026-09-15 · One contract shape, additive only, expand-contract with client contract number; no versions or converters · strategy §6
- 2026-09-15 · Catch-up per adapter: hourly with 1 h overlap, at worker start, daily id comparison · strategy §5.4
- 2026-09-15 · Event log in Postgres with correlation ids, 30-day retention · strategy §8.2
- 2026-09-15 · Plain-code rules (no classes, one code path per concern, complexity and indirection limits, no dead code) · strategy §3
- 2026-09-15 · Rejected: code-size budgets, AI reviewer gate, scheduled drift audits, down-converters, Redis · strategy §3
- 2026-09-15 · Checks split into 6 enforced blocks, warnings, automatic fixes and guidelines; no language-feature bans · strategy §3
- 2026-09-15 · Expand-contract as ordinary releases; no contract numbers or automated removal gates (supersedes earlier line) · strategy §6
- 2026-09-15 · Catch-up at worker start and every 12 h (supersedes hourly) · strategy §5.4
- 2026-09-15 · Health check `webhook_lag`: red if any webhook is unresolved after 5 min · strategy §8.1
- 2026-09-15 · Items store `raw` and `data` (universal model incl. display) as separate columns · strategy §2
