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
Sections: Bostaden, Interiör, Byggnad, Våning och hiss, Energideklaration, Balkong uteplats
och parkering, Tomt, Avgift och driftskostnader, Andelstal och ekonomi, Taxering,
Pantbrev och inskrivningar, Gård, Fastigheten, Lokalen, Utlandsbostaden, Omgivning,
Övrigt.
CRMs: all
Examples: engine/rules/rules.test.ts
