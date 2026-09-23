# Open questions

The register of everything asked of Patric. A question gets the next number here before it is
asked in chat, chat refers to that number, and Patric answers by number, in any conversation.
Numbers are never reused: an answered question gets its line in `decisions.md` and leaves this
file. Each one is tagged with its part and names what is blocked and the smaller option, so
answering is quick. Next number: 90 (75 to 77 were also used in chat on 2026-09-21 for the porting
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

## 88. `[client-wordpress]` The Cloudways token in the session environment is still the limited one

On 2026-09-23 a new session, the first after the token was replaced (question 81, 2026-09-21),
sent the token stored as `CLOUDWAYS_API_KEY` to the account call that lists the servers, and
Cloudways answered "insufficient_scope: this token does not have access to this endpoint", the
same refusal as before. So either the environment still holds the old token or the new one was
also made with a limited scope. Without it no agent can find the server behind 165.22.87.59 or
make `v4.dev.kowboy.se`, the target of next-steps item 17; the local WordPress of the test suite
stays the target meanwhile, so the set itself is not blocked. In Cloudways, make an API token
with access to the whole account (servers and applications, not only the public catalogue),
save it in the session environment's settings under the same name, then say "saved"; the next
session picks it up.

## 89. `[client-wordpress]` The "kowboy-v4" package is not in this repository

Next-steps item 17 step 2 takes the package's rendered markup, flattened to plain HTML and sliced
one file per view, and its CSS and JavaScript (question 86). The package was attached in a
conversation outside this repository, and nothing of it is saved here: no zip, no folder, no
file named after it. Two ways forward, pick one: attach the package's zip in the chat that
resumes item 17, and the agent takes its markup and assets as decided; or answer "from the site",
and the agent writes the markup new from what norbanmakleri.se shows on its pages, which is the
master anyway and readable over HTTPS, with the set's own CSS written to match. Smaller: "from
the site", since the master is the only acceptance and no attachment is needed.
