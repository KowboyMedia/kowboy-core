# AGENTS.md - <project name>

Every agent reads `KOWBOY-HANDBOOK.md` (how agents work at Kowboy) and then this file (what is true
only here) before doing any work; where they differ, this file wins. `CLAUDE.md` only imports the
two. This file is protected, and changes need approval.

## What this is

<One or two sentences: what the project does and who uses it. Delete this section if the README
already says it.>

| Document                                         | Role                                                                              |
| ------------------------------------------------ | --------------------------------------------------------------------------------- |
| [docs/decisions.md](docs/decisions.md)           | One line per structural decision. Append only.                                    |
| [docs/open-questions.md](docs/open-questions.md) | The register of questions to Patric; its header says the next number.             |
| [docs/next-steps.md](docs/next-steps.md)         | The order of work. "Resume next steps" means: do the first item that is not done. |
| [docs/known-bugs.md](docs/known-bugs.md)         | What is wrong and known, with what fixing it takes.                               |

Components and their tags: `[handbook]` (the agent setup itself), <one tag per part of this project>.

Design: <none, or `DESIGN.md` (see the design skill)>.

## Commands

<Exact commands an agent cannot guess. Delete lines that do not apply.>

- Install: `<command>`
- Test (one file): `<command> <path>`; full suite: `<command>`
- Lint, format, typecheck: `<command>`
- Build / run locally: `<command>`

## Enforced: CI blocks merge or deploy

These are the only hard blocks. Don't add more without approval.

1. **Build, typecheck and all tests pass.** A skipped test counts as a failure.
2. **Protected paths need approval** (CODEOWNERS): this file, `DESIGN.md` where it exists, <others>.
3. **No committed secrets.**

## Warnings: reported, never block

Lint findings, dead code, new runtime dependencies, and the register check (duplicate question or
bug numbers, a header counter that is not ahead of every number).

## Principles

<Only what is true here and differs from the shared file and from the language's defaults: the
architecture's one or two load-bearing rules, gotchas an agent cannot infer from the code. Add a
rule when an agent gets the same thing wrong twice; delete one when nobody would get it wrong
without it.>

## Stop and ask

In addition to the shared list, stop and ask when a task needs any of these:

- <a change to this project's contract, schema, data model or public interface>

## Definition of done

In addition to the shared definition:

1. <project-specific item, or delete this section>
