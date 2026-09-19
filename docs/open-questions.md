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

## 50. Images: the widths the CDN serves, and what a record carries per image

`[core]` `[crm-vitec]` Seen on norbanmakleri.se (2026-09-19, your pointer): an image address is
`https://cdn-realestate.kowboy.se/r2/<customer id>/<record id>/<image id>_<width>.<extension>`,
with the same ids Vitec Connect gives Core (`M31529`, `OBJ31529_…` or `HAN…`, `MED…`) and the
extension from the payload; property pages use width 1920, agent pictures 1024. Two things the
site cannot tell: (a) which widths the CDN serves, only those two or any; (b) what a record
carries per image. Smaller: per image its id, order, category, extension and one address at width
1920, with the pattern documented so a template can ask for another width. Say the widths, and
yes or no to the smaller shape.

## 51. The universal field names: drafted for your correction, or sent by you

`[core]` `[crm-vitec]` `[client-wordpress]` `[client-lovable]` The adapter maps the CRM's fields
onto universal names, so templates and the search table use the same names for every CRM; today
`data` still carries Vitec's names (`price.starting_price`, `buildings[].area.living`). The earlier
ask for "the plugin's field list" was for those universal names. Smaller: I draft one table per
entity from the SRS and Vitec's payload (name, type, meaning, the Vitec field behind it, whether
the search table indexes it), and you strike and rename in the table. Or you send the names.
