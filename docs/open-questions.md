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

## 81. `[client-wordpress]` The Cloudways token in the agents' environment cannot list servers: make one with a wider scope

`CLOUDWAYS_EMAIL` and `CLOUDWAYS_API_KEY` exist since 2026-09-21 (79 closed). The key is an API v2
access token, and Cloudways answers every server call with `insufficient_scope` ("This token does
not have access to this endpoint"): listing servers, an app's credentials, alerts, all refused,
while the public catalogue of app types answers. So the token was made with a limited scope, and
nothing in the porting workflow can start: no server list, so no app can be made, copied,
password-protected or read. Needed: a token whose scope covers reading servers and apps and the
writes the workflow makes (create and clone apps, read an app's WordPress login, map a domain,
set cron and password protection, back up). Smallest for you: replace the key with a **Full
Access** token, since every scope the work needs is in it, and an agent never touches anything
but the porting server; or a Limited Scope token with those groups. Answer by replacing the
variable; nothing else is needed.

## 82. `[client-wordpress]` The default set is written against three apps on dev.kowboy.se, not against a client's pair

Your instruction of 2026-09-21: three apps on dev.kowboy.se, plugin v2, plugin v3 and Core's
plugin (v4), each with the Vitec test account and the default plugin templates, and the "Kowboy
2026" set written to match. The stored plan (`docs/template-porting.md`, `default-templates.md`)
makes a pair per client instead, a copy of the client's live site as the source, and starts with
the reference client (question 80). The triple fits the default set better: the test account is
on staging already, no client's data or login is involved, and every page exists on all three.
`*.dev.kowboy.se` already points at one server (165.22.87.59, answering 403 for every name; the
bare `dev.kowboy.se` has no record), so the apps would be `v2.dev.kowboy.se`,
`v3.dev.kowboy.se` and `v4.dev.kowboy.se` on that server, mapped through the Cloudways API once 81
is answered. Answer yes: the triple replaces the pair for the default set, question 80 stays for
the client ports that follow (norbanmakleri.se first, as its theme is the one in
`saas-acf-template`); or no, and say what differs. Smaller: yes.

## 83. `[client-wordpress]` The name of the template package: "kowboy-core-wordpress-templates" and "Kowboy 2026"

You named the set "Kowboy 2026" in a "kowboy-core-wordpress-templates namespace" in this
repository, with more sets to come. The stored shape (your answer to question 69, 2026-09-20) is
one folder per set under `clients/wordpress/templates/<set>/`, each a WordPress plugin, the first
one packaged as `core-client-templates-2026`, next to the sync plugin `core-client`. The two
agree on everything but the names. Proposed: the folder `clients/wordpress/templates/` is the
namespace and holds every set; the first set's folder and plugin slug are `kowboy-2026`, its
display name "Kowboy 2026", its package `core-client-templates-kowboy-2026.zip` and `.json` on
the Space; later sets follow the same pattern. Answer yes, or give the exact slug you want, and
the agent names everything after it. Smaller: yes.

## 84. `[client-wordpress]` The first round's scope: properties, agents and areas, list and single

Your list of 2026-09-21: properties list and single, agents list and single, areas list and
single. The stored list (`docs/default-templates.md`) is wider: the cards, the single pages of
every entity (property, project, agent, office, area, association) and the list wrappers (the
filter form and the script that reloads a list without a page load). Read as: the first round
is your six pages, compared and matched first; offices, associations, projects and the list
wrappers follow in the same loop once the six match. Answer yes to that order, or name what is
out for good. Smaller: yes.

## 85. `[client-wordpress]` Which output is the master when the default templates differ, and whether the old files may be diffed

You listed four versions of the default templates: the one running on norbanmakleri.se, the
one inside plugin v2, the one inside plugin v3, and the theme in `saas-acf-template`. The stored
decision (2026-09-20, question 70) makes the v3 site's rendered output the specification, and
AGENTS.md forbids reading the old plugins' files, so the four can only be compared by what the
three apps of 82 render; which files differ inside the zips is not something an agent may look
at. What is known without opening anything: norbanmakleri.se runs the plugin folder
`kowboy-plugin-v2` under a Neve child theme, and the theme in `saas-acf-template` is that child
theme, whose own Kowboy files are three property list-item templates under `templates/2025/`
(last changed 2026-06-12); it holds no single-page templates, so norban's single pages are the
plugin's own. The repositories `kowboy-plugin-v2`, `kowboy-plugin-v3` and `saas-acf-template`
are checked out in this session; the two plugins stay unopened, the theme's own templates are
readable by the stored rule (a client's theme files are Kowboy's, the plugin's are not). Proposed:
the v3 app with its default templates is the master for "Kowboy 2026"; v2 and norban are looked
at only where v3 shows nothing for a value, and every such case is a line in the inventory;
norban's three list-item overrides are that client's port under 80. Answer yes, or name another
master. Smaller: yes.
