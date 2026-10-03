R-013 Sections, the fact tables
When: a property page shows its facts
Then: display.sections is a list of sections, each a header and label/value rows, rendered
from one definition (engine/rules/sections.ts) over the universal names. A row is
there when its value is; a section is there when it has a row; the order is the
definition's. Values follow R-001 to R-012 and the units named per row (kvm, kr,
kr/år, ha, m, %, kWh). Lists the CRM sends as named entries (architecture, services,
operating costs, exterior features, acreage, lands, economy buildings, distances,
compilation areas, rooms) become one row per entry, labelled by the entry's own name.
No section is chosen by the property's type: a farm's rows appear because the farm's
fields are there. Headers and labels are Swedish and live in the definition, so a
change is an edit there, a release and the automatic recompute, never a client
release (Patric, 2026-09-19, question 42).
Sections, headers, rows and order follow norbanmakleri.se, the master of the default set (Patric,
2026-10-03, question 92, "same as norbanmakleri.se"): Grundinformation (Upplåtelseform, Bostadstyp,
Adress as street, postal code and city with spaces only, Område, Fastighetsbeteckning), Interiör
(Boarea, Antal rum as a bare number, Areakälla), Beskrivning (the long selling text, else the
short one), Byggnad (Byggnadstyp, Byggår, the architecture entries), Ventilation (Typ),
Energideklaration (Energideklaration per R-011, Energiprestanda primärenergital in kWh per kvm
och år, Energiklass), "Andelstal, avgifter och insats" (Andel i förening, Andel av årsavgift, the
fee per R-016 labelled by its type, Kommentar till månadsavgift, Bostadens indirekta
nettoskuldsättning with its comment on the same line after a comma), Våning/hiss (Våning per
R-017), Driftskostnader (one row per operating cost, Personer i hushållet, Kommentar
driftskostnader, Summa per år per R-009). Rows the master has the data for and does not show
(Objektnummer, Kommun, Lägenhetsnummer, the exterior features) are left out of the tables. After
those come the sections for facts the master's pages never carried, kept so a home of another kind
still shows them: Tomt, Taxering, Pantbrev och inskrivningar, Gård, Fastigheten, Lokalen,
Utlandsbostaden, Omgivning, Övrigt. The association's own rows (Föreningen) and the documents
(Dokument) come from the association's record and the documents list, so the site renders them
after these sections (question 94).
CRMs: all
Examples: engine/rules/rules.test.ts
