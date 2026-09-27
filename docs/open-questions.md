# Open questions

The register of everything asked of Patric. A question gets the next number here before it is
asked in chat, chat refers to that number, and Patric answers by number, in any conversation.
Numbers are never reused: an answered question gets its line in `decisions.md` and leaves this
file. Each one is tagged with its part and names what is blocked and the smaller option, so
answering is quick. Next number: 92 (75 to 77 were also used in chat on 2026-09-21 for the porting
plan's questions, which are 78 to 80 here; 62 to 69 were also used in chat on 2026-09-20 for the WordPress
plan's questions, which are 66 to 73 here; 47 and 48 were used in chat on 2026-09-19 for 16 and 2, and the helper-methods
conversation of the same day counted 30 to 49 in chat; none of those are register numbers).

## 52. The pairs for the Vitec mapping: no longer needed for the mapping; what remains is Vitec's golden masters

`[crm-vitec]` Patric's plan of 2026-09-19 (a read endpoint on a client site running the old
plugin, plus its Vitec key pair, fetched as pairs and mapped by evidence) was overtaken the same
day by Gate 2: `docs/field-tables.md` names every universal field's Vitec source,
`adapters/vitec/mappers.ts` copies and renames by those tables, and `display` comes from the
approved ledger entries. The mapping needs no evidence from the old sites, and taking anything
from the old plugins is a hard rule against (AGENTS.md). What 52 still delivered is Vitec's golden
masters (Gate 3, AC 1) and the comparison against the old sites (AC 28). Close 52 and take
Vitec's golden masters from the test account's real records on staging instead: an agent keeps a
representative set as `golden/vitec/` cases (payload, universal, display) for Patric's approval,
the protected path's gate; the parity inventory stays a human-supplied list (strategy §10, AC 28)
checked against Core's data. Smaller: yes, close 52 and take them from the test account. Or keep
the pairs.

## 54. Vitec on the test account: five things only a person in Vitec can set up

`[crm-vitec]` Core copies what Vitec sends, so nothing in Core waits on these; the sites'
templates do. One estate per case, set by a person in the Vitec test account, read off staging by
an agent: (a) a new-build project's homes appear in the marketed list with their `projectId`
(assumed on 2026-09-19, so a project page can list them); (b) whether the price text stays when
the price is hidden; (c) whether the area name stays when the address is hidden; (d) what status
a "till salu, visa som kommande" estate carries; (e) how each of the four bid settings shows in
`bidding`. Smaller: (a) alone now, the rest when the first client template needs them.

## 80. `[client-wordpress]` Name the first client to port, once the default set is done

Norban is not a client port: norbanmakleri.se runs the default templates of plugin v2 and v3
unchanged, so it is the reference the default set "Kowboy 2026" is ported from (Patric,
2026-09-23), and its office is the test account staging already holds. Client ports start after
the set is done (next-steps item 17), through the automated workflow of
`docs/template-porting.md`. When the set is done, name the first client by the name Cloudways
lists its site, and give its CRM login if staging does not hold that account yet.

## 87. `[core]` The DigitalOcean token in the session environment is refused

On 2026-09-23, after the release, the token stored as `DIGITALOCEAN_ACCESS_TOKEN` in the session
environment answered "401 Unauthorized" to a plain read of the account's apps, so an agent can no
longer see the live app's deployments, change either app's settings or ask for a deployment. The
release itself did not need it: live deploys itself on every change to `main`. It is needed for
the next settings change on either app (the Postmark token for live's sign-in link, question 79's
Space keys, Sentry) and for reading deployment state. Make a new personal access token in the
DigitalOcean account with read and write on apps, save it in the session environment's settings
under the same name, then say "saved"; the next session picks it up.

## 88. `[agents]` Split the agent instructions into a Kowboy-wide file and a project file

Today `AGENTS.md` mixes two kinds of rule: how agents work with Patric (the reply protocol, the
register, the decisions log, "do it yourself first", "a closed gate is not a note", the coding
principles), which is the same for every Kowboy project, and what is true only in Core (the seam,
the layout, the slugs, the legacy rule). The first kind is what Patric wants in every repository.
Claude Code on the web reads only files inside the repository: a personal `~/.claude/CLAUDE.md`,
plugins named in the repository's settings and the automatic memory all live on a local machine and
are not loaded in a cloud session (Claude Code documentation, "Claude Code on the web", read
2026-09-27). So the only way to have the same rules everywhere is a copy of one shared file in
every repository. Proposed: `AGENTS-shared.md` (the Kowboy-wide rules, about 150 lines) beside
`AGENTS.md` (Core only, about 90 lines, down from 177); `CLAUDE.md` imports both; the project file
wins where they differ; the shared file is protected like `AGENTS.md`. Every rule of the old file
keeps its words and its provenance; nothing is dropped. The change is prepared and waits for this
answer. Smaller: keep one file and copy its "Working with Patric" section into other projects by
hand. Answer yes (split) or no (one file).

## 89. `[agents]` The reply protocol becomes four blocks: Questions, Done, Notes, Next

Two rules in `AGENTS.md` contradict each other: "three labelled blocks ... and nothing outside
them" (Patric, 2026-09-21) and "every reply ends with one or two plain lines saying what Patric
does next" (Patric, 2026-09-20), so the closing lines were either outside the blocks or missing.
Proposed: a fourth block, **Next**, holding those one or two lines, so every reply is Questions,
Done, Notes (omitted when empty) and Next, with nothing outside them. The other reply rules (one
register number per ask, a real question or a real instruction, one line per ask with the
reasoning in the register) are gathered under the same heading instead of being spread over six
bullets written on different days. Smaller: keep the three blocks and drop the closing lines.
Answer yes (four blocks) or no (three blocks, no closing lines).

## 90. `[agents]` Two hooks: the project's memory at session start, and one reminder line per turn

A hook is a small script Claude Code runs at a fixed moment; what a session-start hook or a
per-prompt hook prints is added to what the agent sees (Claude Code documentation, "Hooks", read
2026-09-27). Proposed: (1) `.claude/hooks/context.sh` at session start prints "Where to pick up"
from `docs/next-steps.md`, the open questions with the register's next number, the known bugs, and
how far the session's copy is behind staging, so a session begins where the last one ended without
being told; (2) `.claude/hooks/turn.sh` before every answer prints one line, "Reply protocol: four
blocks, Questions (register numbers, next is N) / Done / Notes / Next; one line each, reasoning in
the register". The second one exists because rules read once at the start are followed less as a
session grows long: a controlled study of 1,650 Claude Code sessions (McMillan, arXiv 2605.10039,
May 2026) found compliance with a file rule fell about 5.6% for every further function the agent
wrote, while file length made no difference. One line per turn costs about 40 tokens. The reply
format is the rule Patric has had to restate three times (2026-09-20, 21 and 23). Both hooks are
read-only and never fail the session. Smaller: (1) alone. Answer both, first only, or none.

## 91. `[agents]` Where the shared file lives, and how it reaches the other repositories

`AGENTS-shared.md` (question 88) must be the same in every repository, and Claude Code on the web
loads nothing from outside the repository, so a copy sits in each one and one place is the source.
Three ways: (a) a new small repository, `KowboyMedia/agents`, holding the shared file, the two
hooks, the register check and empty starting versions of the four memory files; a standard GitHub
Action there (a file-sync action such as `BetaHuhn/repo-file-sync-action`) copies the shared file
and hooks into every listed repository whenever they change, as a change for approval; the
repository is also marked as a GitHub template, so a new project starts with everything in place.
One-time cost: Patric creates the empty repository (an agent cannot create repositories from this
session) and adds one access token with write permission on the target repositories to its
settings. (b) Core is the source, with the same action; no new repository, but agency-wide rules
live inside one product. (c) No automation: an agent copies the file into a repository when asked.
Zero setup, and the copies drift apart. Smaller: (c). Recommended: (a), because it is the standard
way, one place to edit, and nothing to remember. Answer a, b or c; for a, also create the empty
repository `KowboyMedia/agents` and say "created".
