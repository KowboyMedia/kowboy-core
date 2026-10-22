<!-- https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Meeting_Meeting, fetched 2026-10-04 -->

# Meeting

Möte

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Id | Mötesid | string |  |
| ContactId | Kontakt id | string |  |
| ContactName | Kontaktnamn | string |  |
| Address | Adress | [Address](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_Address) |  |
| TelePhone | Telefonnummer bostad | string |  |
| CellPhone | Telefonnummer | string |  |
| MeetingDate | Mötesdatum | date |  |
| Type | Mötestyp | [MeetingType](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Meeting_MeetingType) |  |
| State | Status på mötet | [MeetingState](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Meeting_MeetingState) |  |
| BrokerId | Mäklarens id | string |  |
| BrokerName | Mäklarens namn | string |  |
| BookedById | Bokarens id | string |  |
| BookedByName | Bokarens name | string |  |
| BookedDate | Bokningsdatum | date |  |
| SignatureDate | Uppdragsdatum | date |  |
| EstateStatus | Objektets status | [Status](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Common_Status) |  |
| CommissionWithoutTaxes | Provision ex.moms | decimal number |  |
| CommissionSource | Intagskälla (Kontakttyp) Ska inte användas längre. Använd AssignmentSource istället | string |  |
| AssignmentSource | Intagskälla (Kontakttyp) | [AssignmentSource](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Meeting_AssignmentSource) |  |
| CancelledBy | Avbokad av (Mäklare, Kund) | string |  |
| AgreementDate | Försäljning = Kontraktsdatum, Värdering = Värderingsdag, Skrivning = Datum för skrivuppdrag | date |  |
| CommissionType | Uppdragstyp | [CommissionType](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Enum_CommissionType) |  |
| AccessDate | Tillträdesdatum | date |  |
| EstateId | Objektets id | string |  |
