# Open questions

The register of everything asked of Patric. A question gets the next number here before it is
asked in chat, chat refers to that number, and Patric answers by number, in any conversation.
Numbers are never reused: an answered question gets its line in `decisions.md` and leaves this
file. Each one is tagged with its part and names what is blocked and the smaller option, so
answering is quick. Next number: 56 (47 and 48 were used in chat on 2026-09-19 for 16 and 2, and the helper-methods
conversation of the same day counted 30 to 49 in chat; none of those are register numbers).

## 52. The pairs for the Vitec mapping: a read endpoint on a client site, plus its Vitec key pair

`[crm-vitec]` Patric's plan (2026-09-19): a small snippet on a client site running the old plugin
answers, behind a secret header and read-only, (a) the ids per datatype and (b) the mapped record
by id, and where the plugin keeps it, the raw API answer it stored for that record; the client's
Vitec Connect key pair goes onto staging as a connection. An agent then fetches each pair at the
same moment, maps by evidence, keeps a representative set as golden masters and flags only what the
evidence cannot settle. Closes when the endpoint's address, its secret and the key pair arrive.
The same pairs are the parity check of `display` against what the old sites show (the
helper-methods conversation's item 38, 2026-09-19).

## 53. The display conventions: as drafted, or changed

`[core]` The display strings are built plain, by the fourteen ledger entries in `rules-ledger/`:
a hard space between digit groups and before a unit ("4 950 000 kr", "82 m²"), a decimal comma
("3,5 rum"), the currency as its Swedish word, dates in Swedish time as `2026-09-19`, no HTML,
and the site escapes. Nothing is blocked; the sites build on them. Smaller: yes, they stand as
drafted (a change later is a ledger entry, a release and a recompute). Or name the entry and the
change.

## 54. Vitec on the test account: five things only a person in Vitec can set up

`[crm-vitec]` Core copies what Vitec sends, so nothing in Core waits on these; the sites'
templates do. One estate per case, set by a person in the Vitec test account, read off staging by
an agent: (a) a new-build project's homes appear in the marketed list with their `projectId`
(assumed on 2026-09-19, so a project page can list them); (b) whether the price text stays when
the price is hidden; (c) whether the area name stays when the address is hidden; (d) what status
a "till salu, visa som kommande" estate carries; (e) how each of the four bid settings shows in
`bidding`. Smaller: (a) alone now, the rest when the first client template needs them.

## 55. WordPress lists: a project's homes out by default, in by the project id

`[client-wordpress]` Patric decided (2026-09-19) that a project's homes stay out of the regular
property lists and are listed on the project's page through the property-list shortcode filtered
on the project id. What is left is the shape: the shortcode gets a `project_id` attribute, and a
list without one leaves out every property that carries a `project_id`. Smaller: yes, that
shape, built with the templates (next-steps item 10). Or name another.
