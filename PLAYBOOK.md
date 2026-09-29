# Playbook - how a Kowboy project is built by agents

`KOWBOY-HANDBOOK.md` holds the rules that hold all the time; the first of them is that the agent
leads and Patric decides. This playbook holds the procedure for each phase of the work: what to read, what to produce, and what must be true at the end. Claude
Code loads a phase as a skill when it applies and when it is called by name (`/plan`, `/review`),
from the kowboy-handbook plugin or from the repository's `.claude/skills/` copy; any other agent
reads the file before the phase.

| Phase               | File                                   | Read it when                                                                                                                                                              |
| ------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Start a project     | `.claude/skills/start/SKILL.md`        | a repository is new, or lacks a strategy, acceptance criteria or the four memory files                                                                                    |
| Discover            | `.claude/skills/discover/SKILL.md`     | at the start of a project, before a feature larger than one item, whenever Patric describes a wish                                                                        |
| Plan an item        | `.claude/skills/plan/SKILL.md`         | before any change that is more than one sentence, touches a protected path or spans components                                                                            |
| Design              | `.claude/skills/design/SKILL.md`       | a change creates or restyles something people look at, in a repository with a `DESIGN.md`; a change inside the existing pattern, text, a known form or a bug fix skips it |
| Decide architecture | `.claude/skills/architecture/SKILL.md` | before a choice that later work builds on: a boundary, a data shape, a technology, a vendor, hosting                                                                      |
| Build               | `.claude/skills/build/SKILL.md`        | while writing code, tests and docs for a planned item                                                                                                                     |
| Review              | `.claude/skills/review/SKILL.md`       | before anything is reported done to Patric, as a second agent with no memory of building it                                                                               |
| Release and operate | `.claude/skills/release/SKILL.md`      | when Patric says "release", when a health check goes red, when something is wrong in production                                                                           |
| Status              | `.claude/skills/status/SKILL.md`       | when Patric says "status"                                                                                                                                                 |

Every phase ends with the memory current: `docs/next-steps.md`, `docs/decisions.md`,
`docs/open-questions.md`, `docs/known-bugs.md`.
