# Decisions

One line per structural decision: date, decision, reference. Append only. Details live in [strategy.md](strategy.md).

- 2026-09-15 · Gate 1 approved: strategy v4 and acceptance criteria v1.4 · strategy §9, §10
- 2026-09-15 · Product renamed Kore → Kowboy Core ("Core"); CRM-agnostic part is the "engine" · strategy header
- 2026-09-15 · SRS v1.2 amendments 1-14 accepted · strategy §12
- 2026-09-15 · TypeScript + Postgres, monorepo, web and worker roles, Postgres job queue (no Redis) · strategy §2, §5
- 2026-09-15 · Hosting to be chosen at the start of Phase 1 against fixed criteria; Render excluded · strategy §2
- 2026-09-15 · Manual production approval per release (GitHub Environment) · strategy §4
- 2026-09-15 · Build on dummy data (`golden/fake/`) first; real golden masters before adapters · strategy §9
- 2026-09-15 · Agents never access legacy repos or code · AGENTS.md rule 1
