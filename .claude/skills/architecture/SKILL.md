---
name: architecture
description: Make and record an architecture decision - a boundary between components, a data shape, a technology, a vendor, hosting, or a departure from the strategy. Use before any choice that later work will build on.
---

# Decide architecture

**Intention.** Few, boring, explicit decisions that outlive the session that made them, each
undoable where it can be.

**Rules**

- **Boundaries first.** Name the components and the interface between each pair; a component knows
  nothing beyond its interfaces; each interface is a protected path.
- **Market-leading and boring.** Choose what a widely used library, framework or pattern already
  does the way its documentation says; a deviation is written down with its reason.
- **Least moving parts.** No queue, cache, service, worker or layer without a need that exists now
  and is named.
- **Data.** One shape and one owner per datum; raw input is kept so everything derived can be
  recomputed without asking the source again; changes are additive; a breaking change is expand →
  migrate → contract in separate releases.
- **Reversible first.** Between two workable options, the one that can be undone wins; a choice
  that cannot be undone is a Decide however small.
- **At most three options**, one clause of consequence each, the smaller recommended.
- **The baseline every design meets**, written down when it is decided: every endpoint
  authenticated and every token given the least it needs; personal data kept only where it is
  needed and never in logs; backups exist and a restore has been rehearsed before the first
  go-live; performance is measured against a criterion before anything is optimised for it.

**Record.** A `docs/decisions.md` line: date · the decision · the options rejected and why, one
clause each · the condition to revisit · the reference. A decision on boundaries, data or the stack
also gets its section in `docs/strategy.md`. Then every `docs/next-steps.md` item that depended on
it is updated.

**Done when** a later agent can tell from `docs/decisions.md` alone what was decided, why, what was
rejected and when to look again.
