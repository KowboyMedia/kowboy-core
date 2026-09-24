# Open questions

The register of everything asked of Patric. A question gets the next number here before it is
asked in chat, chat refers to that number, and Patric answers by number, in any conversation.
Numbers are never reused: an answered question gets its line in `decisions.md` and leaves this
file. Each one is tagged with its part and names what is blocked and the smaller option, so
answering is quick. Next number: 97 (75 to 77 were also used in chat on 2026-09-21 for the porting
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

## 87. `[core]` The two tokens are most likely in each other's slot in the session environment

Both refusals of 2026-09-23 have one likely cause. The value stored as `DIGITALOCEAN_ACCESS_TOKEN`
has the shape of a Cloudways token (67 characters, starting with `cw_`), not of a DigitalOcean
one (those start with `dop_v1_`), so DigitalOcean refuses it with "401 Unauthorized". The value
stored as `CLOUDWAYS_API_KEY` is also Cloudways-shaped but is still the limited token of
2026-09-21 (question 81), so Cloudways answers "insufficient_scope". The simplest reading: on
2026-09-21 the new, wider Cloudways token was saved into the DigitalOcean slot by mistake, and the
DigitalOcean token was overwritten by it. Neither token "stopped working"; one is in the wrong
place and the other is gone. An agent cannot test the swap itself: the session's safety rules
refuse sending a credential to a service other than the one it is stored for. In the session
environment's settings: move the value now in `DIGITALOCEAN_ACCESS_TOKEN` into `CLOUDWAYS_API_KEY`,
then make a new DigitalOcean personal access token with read and write on apps and save it as
`DIGITALOCEAN_ACCESS_TOKEN`, then say "saved"; the next session checks both.

## 88. `[client-wordpress]` The Cloudways token: settled by 87 if the swap is right

Registered on 2026-09-23 as a separate refusal before the shapes were compared. If 87's move
gives Cloudways the wider token, nothing more is needed here and 88 closes with 87. If Cloudways
still answers "insufficient_scope" after the move, the token of 2026-09-21 was also limited, and
a new one with access to the whole account (servers and applications) is needed under
`CLOUDWAYS_API_KEY`.

## 89. `[client-wordpress]` The "kowboy-v4" package is not in this repository

Next-steps item 17 step 2 takes the package's rendered markup, flattened to plain HTML and sliced
one file per view, and its CSS and JavaScript (question 86). The package was attached in a
conversation outside this repository, and nothing of it is saved here: no zip, no folder, no
file named after it. On Patric's "go ahead" of 2026-09-24 the set was written from what
norbanmakleri.se shows (the smaller option; the master is the only acceptance), with the set's own
stylesheet and script. Answer "from the site" to close this, or attach the package's zip if its
markup and assets should replace the set's, and an agent swaps them in.

## 90. `[core]` The display fields drafted for the default set: validate R-015 to R-019 and Vitec's golden masters

Next-steps item 18: every value norbanmakleri.se shows that `display` did not carry was drafted
on 2026-09-24 from the site's pages against the same records on the test account. Five entries,
each implemented in the engine with a test and shown by the set: R-015 the office's price wording
with a capital first letter ("Utgångspris"); R-016 the fee as an amount alone ("2 882 kr", the
card's "Avgift 2 882 kr"); R-017 floor and elevator in one line ("2 av 4, hiss finns"); R-018 the
exterior features the home has ("Uteplats finns"); R-019 an association's transfer fee and
pledge fee ("1 480 kr", "592 kr"). And `golden/vitec/`: eight cases from the test account's real
records (three properties, an agent, the office, an area, an association, a project), each with
its payload, its universal record and its `display`, proved by `acceptance/golden.test.ts`.
Everything sits in the change of 2026-09-24 for review through the protected paths. Answer "90
yes" to validate all five and the golden masters, or name the entry and what to change.

## 91. `[core]` Decimals: the master writes "1.5 rum" and "82.5 kvm", the ledger a comma

R-001 (approved 2026-09-19) writes a fraction with a decimal comma, the Swedish way: "1,5 rum",
"82,5 kvm". norbanmakleri.se writes "1.5 rum" and "82.5 kvm" on its cards and pages. The set
follows the ledger, so those cards read differently from the master. Keep the comma (smaller,
nothing changes), or amend R-001 to the master's point? Answer "comma" or "point".

## 92. `[core]` The fact tables: the master's sections against R-013

R-013 (approved 2026-09-19) lays a property page's facts out in seventeen sections (Bostaden,
Interiör, Byggnad, Våning och hiss, Energideklaration, ...). norbanmakleri.se lays the same facts
out in eleven, with other headers and other rows: Grundinformation (Upplåtelseform, Bostadstyp,
Adress without a comma, Område, Fastighetsbeteckning), Interiör (Boarea, Antal rum as a bare
number, Areakälla), Beskrivning (the selling text), Byggnad, Ventilation (its own section),
Energideklaration (with "Energiprestanda primärenergital", question 96), "Andelstal, avgifter och
insats" (Andel i förening "1.151 %", Andel av årsavgift, Månadsavgift "2882 kr" unformatted,
Kommentar, Bostadens indirekta nettoskuldsättning with its comment on the same line), Våning/hiss
(R-017's line), Driftskostnader (El, V/A, Personer i hushållet, Kommentar, Summa per år),
Föreningen (from the association's record; the set renders it as sent, R-019's fees prepared)
and Dokument (question 94). The set shows R-013's sections today plus a "Föreningen" section of
its own, so the page differs from the master in headers, order and a few row formats. Rewrite
R-013's definition to the master's eleven sections (a change to the approved ledger and the
recompute), or keep R-013 and accept the difference? Answer "master" or "keep".

## 93. `[crm-vitec]` Enumerations Vitec sends as bare strings have no name to show

Some of Vitec's enumerated values arrive as a bare id without a name: on an association
`transfer_fee_paid_by` is "Buyer", `allow_legal_person_as_buyer` is "Undetermined",
`genuine_association` is "PrivateHousingCompany"; the master shows "Köpare", "Ej angiven" and
"Äkta". The field tables copy enumerations as `{id, name}` when Vitec sends both; here it sends
the id only, and the names are in Vitec's enumeration documentation (`docs/inputs/vitec/enumerations/`).
Smaller: the adapter maps these three fields to `{id, name}` with the name from that documentation,
a field-table change for the association (approval needed); or leave them as ids and the set
shows the id. Answer "map" or "leave".

## 94. `[crm-vitec]` The documents the master lists are not in the advertising payload

norbanmakleri.se lists a property's documents under "Dokument" (Ekonomisk plan,
Energideklaration, Stadgar, Årsredovisning 2024, each opened in a viewer). The Connect payload
Core fetches carries `files: []` for the same property (Cyklopgatan 35B), so Core has no
documents to deliver and the set shows no "Dokument" section. Either the files come from an
endpoint the adapter does not read yet (a question to Vitec, or to the documentation), or the
old site kept them from another source. Smaller: leave documents out of the set until the source
is known. Answer "leave out" or "find the source", and if you know where the old site took them
from, say so.

## 95. `[client-wordpress]` Two things on the master that post to the CRM: the viewing booking and the interest form

On norbanmakleri.se a viewing has a "Boka här" button that opens Vitec's booking page for that
viewing, and every property page ends in a form ("Är du intresserad av bostaden?") that posts a
lead to Vitec. Neither is data: the booking address is built from the CRM's ids by the old plugin,
and the lead form needs a Core endpoint that forwards to the CRM (Connect has one,
`POST .../interest`), an adapter capability nothing in Core offers yet. The set shows the viewing
without a button and no form. Smaller: leave both out of the set now and plan the lead endpoint as
its own item. Answer "later" or "now".

## 96. `[crm-vitec]` The master shows an energy performance value the payload does not carry

norbanmakleri.se shows "Energiprestanda primärenergital: 59 kWh per kvm och år" for Cyklopgatan
35B; the Connect payload's energy declaration for the same property has `consumption: null`, so
Core has no value. The old site took it from somewhere else. Smaller: the set shows the row only
when Core has the value (as now). Answer "as now", or say where the value comes from.
