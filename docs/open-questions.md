# Open questions

The register of everything asked of Patric. A question gets the next number here before it is
asked in chat, chat refers to that number, and Patric answers by number, in any conversation.
Numbers are never reused: an answered question gets its line in `decisions.md` and leaves this
file. Each one is tagged with its part and names what is blocked and the smaller option, so
answering is quick. Next number: 86 (75 to 77 were also used in chat on 2026-09-21 for the porting
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

## 76. `[core]` The adapter API gained one optional field on an action: `help`

You asked for descriptive text on every action in the area ("Both are missing descriptive text.
Add descriptive text to all actions and make a note to keep them updated on related changes",
2026-09-21). An action is declared by the adapter, not by the area, so the sentence has to live
where the action lives: `AdminAction` in `engine/adapter-api/types.ts` now carries `help`, one
sentence saying what the button does and when a person would press it. The area shows it next to
the button and inside the confirmation where there is one, and an acceptance test refuses an
action without it, which is the note you asked for: a new or changed action cannot arrive
unexplained. The field is optional in the type and required in practice by that test, so no
adapter breaks. `engine/adapter-api/` is a protected path, and this is the additive kind of change
the contract allows (expand, never rename or remove), but it still needs your word. Answer yes to
keep it, or no and the sentences move into the area, where they would have to be kept in step with
every adapter by hand.

## 77. `[core]` One acceptance test can fail on a slow machine, and it is the test's own doing

`acceptance/adapters.test.ts`, "absorbs a burst of webhooks without a fetch per webhook", sends a
hundred notifications and then counts what is waiting on the fake CRM's list, expecting one. The
fake CRM empties that list every fifty milliseconds on a timer of its own, so on a machine where
the hundred notifications take longer than that, the list is already empty when the test counts:
the test fails although Core did exactly the right thing. It failed once here on 2026-09-21 and
passed on every run after, which is the shape of a race, not of a bug. What the test proves — a
burst becomes one fetch, not a hundred — is worth keeping, and AGENTS.md counts a test that fails
for reasons of its own as a design problem rather than something to re-run. The smaller fix is to
let the test stop that timer while it counts, which is four lines in the test and changes nothing
about Core. `acceptance/` is a protected path, so it waits for your yes.

## 80. `[client-wordpress]` Name the first client to port: the site whose templates are the reference

The porting workflow (`docs/template-porting.md`) starts from one client: its live site on
Cloudways is copied twice onto the porting server, a source with the old plugin and a target
with Core's plugin, and the new default templates are written to make the target show what the
source shows. Patric called this site "our reference site, which runs the original templates" on
2026-09-20 but did not name it. An agent needs the name as Cloudways lists the app, and the
client's CRM login if staging does not hold that account yet (the test account `M31529` is on
staging already; a client's is not).

## 85. `[client-wordpress]` Which of the four versions of the default templates is the master

Patric's direction (2026-09-21): norbanmakleri.se is meant to run a complete set of the default
templates, so anything customised inside norban is a developer's mistake, although the code there
may be the correct code merely placed in the wrong spot; the master is one of the four versions
(norban live, plugin v2, plugin v3, the theme in `saas-acf-template`), and he picks it after
seeing them. What the agent delivers for that pick, once the three apps stand: every public page
of norbanmakleri.se, the v2 app and the v3 app fetched and compared region by region, with the
differences listed per page and per version; and, since the theme in `saas-acf-template` is
Kowboy's own child theme, its three property list-item files read and judged against the v2
app's own list item, so the report says whether they are a misplaced default or a deviation. The
old plugins' files stay unopened. Answer then by naming the master version.
