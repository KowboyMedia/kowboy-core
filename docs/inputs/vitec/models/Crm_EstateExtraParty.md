<!-- https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_EstateExtraParty, fetched 2026-10-04 -->

# EstateExtraParty

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| EstateId | Bostadens id | string |  |
| RoleCreatedAt | När relationen lades till | date | Datum före år 2024 för relationerna Dödsbodelägare, Firmatecknare, Firmakontaktperson, Förmyndare, God man och Ombud är uppskattningar, då de konverterades från kontakt-kontakt-relationer. |
| PartyRole | Roll | [EstatePartyRelationType](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Enum_EstatePartyRelationType) |  |
| ContactId | Relaterad kontakt | string | Ex. för roll dödsbodelägare är ContactId dödsboet. Kan vara Null om PartyRole är ExtraPartyContactPerson |
