# Open questions

The register of everything asked of Patric. A question gets the next number here before it is
asked in chat, chat refers to that number, and Patric answers by number, in any conversation.
Numbers are never reused: an answered question gets its line in `decisions.md` and leaves this
file. Each one is tagged with its part and names what is blocked and the smaller option, so
answering is quick. Next number: 93 (75 to 77 were also used in chat on 2026-09-21 for the porting
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

## 89. `[agents]` Default: the reply protocol becomes four blocks: Questions, Done, Notes, Next

Two rules in `AGENTS.md` contradict each other: "three labelled blocks ... and nothing outside
them" (Patric, 2026-09-21) and "every reply ends with one or two plain lines saying what Patric
does next" (Patric, 2026-09-20), so the closing lines were either outside the blocks or missing.
Proposed: a fourth block, **Next**, holding those one or two lines, so every reply is Questions,
Done, Notes (omitted when empty) and Next, with nothing outside them. The other reply rules (one
register number per ask, a real question or a real instruction, one line per ask with the
reasoning in the register) are gathered under the same heading instead of being spread over six
bullets written on different days. Smaller: keep the three blocks and drop the closing lines.
Default applied 2026-09-27 under the Decide/Default rule: four blocks, until Patric says otherwise.

## 90. `[agents]` Default: two hooks, the project's memory at session start and one reminder line per turn

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
read-only and never fail the session. Smaller: (1) alone. Default applied 2026-09-27 under the Decide/Default rule: both, until Patric says otherwise.

## 92. `[agents]` Default: four rules on how work is cut and carried

Added to `AGENTS-shared.md` on 2026-09-27 from the ranking of what makes an agent-driven workflow
succeed; each is a Default, applied until Patric says otherwise. (1) One item of `docs/next-steps.md`
per session, marked "in progress" with the date, so two sessions never work the same item and the
number collisions of parallel sessions have less room. (2) Plan before building for anything that
touches more than a few files, a protected path or the contract: the plan goes into the item first.
(3) Two failed fixes end the attempt: what was tried goes into the item and a fresh session takes it,
because a long session of corrections follows its rules less than a clean one (a controlled study of
1,650 Claude Code sessions, May 2026, found compliance fell about 5.6% per further function written).
(4) A flaky test is a known bug the day it is seen, never re-run into green and never deleted, because
a test that sometimes fails teaches an agent to ignore failures. Smaller: none of them. Objection:
name the number of the rule to drop.
