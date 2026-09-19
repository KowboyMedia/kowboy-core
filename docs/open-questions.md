# Open questions

The register of everything asked of Patric. A question gets the next number here before it is
asked in chat, chat refers to that number, and Patric answers by number, in any conversation.
Numbers are never reused: an answered question gets its line in `decisions.md` and leaves this
file. Each one is tagged with its part and names what is blocked and the smaller option, so
answering is quick. Next number: 52 (47 and 48 were used in chat on 2026-09-19 for 16 and 2, and are not assigned).

## 5. There are no business rules, and none can be written yet

`engine/rules/run.ts` computes nothing. It guarantees `display` exists and gives rules one place to
live. Earlier it formatted prices, areas, room counts, addresses and slugs; all of that was
invented from the SRS's illustrative example and has been removed.

A rule needs two things first: a field to compute over, and a ledger entry saying what the output
should be. `rules-ledger/` is protected and empty, so nothing can be written until an entry exists.

## 50. The CDN's URL scheme for images

`[core]` `[crm]` The universal model carries image URLs as Kowboy CDN URLs, rewritten from the
CRM's URLs in the adapter's mapping (question 6, 2026-09-19). The rewrite needs the CDN's rule:
how a CRM image's address becomes its CDN address (a prefix in front of the CRM's URL, an id, or a
hash). Give the rule or the CDN app's documentation; nothing can be mapped until then.

## 51. The universal field names: drafted for your correction, or sent by you

`[core]` `[crm-vitec]` `[client-wordpress]` `[client-lovable]` The adapter maps the CRM's fields
onto universal names, so templates and the search table use the same names for every CRM; today
`data` still carries Vitec's names (`price.starting_price`, `buildings[].area.living`). The earlier
ask for "the plugin's field list" was for those universal names. Smaller: I draft one table per
entity from the SRS and Vitec's payload (name, type, meaning, the Vitec field behind it, whether
the search table indexes it), and you strike and rename in the table. Or you send the names.
