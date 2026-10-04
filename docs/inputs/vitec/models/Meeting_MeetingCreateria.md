<!-- https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Meeting_MeetingCreateria, fetched 2026-10-04 -->

# MeetingCreateria

Sökkriterier på möten.

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| CustomerId | Kund id | string | Kund id måste anges |
| DateFrom | Datum från | date | Datum från måste anges |
| DateTo | Datum till | date | Datum till måste anges |
| Search | Typ av mötesfiltrering. True resulterar i att filtrering blir på bokningsdatum. False resulterar i en filtrering på mötesdatum. | boolean |  |
| Type | Typ av möten. Om inget anges så hämtas endast intagsmöten (Assignment). | [MeetingTypeCriteria](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Meeting_MeetingTypeCriteria) |  |
