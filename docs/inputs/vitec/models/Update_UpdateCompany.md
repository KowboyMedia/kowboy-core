<!-- https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Update_UpdateCompany, fetched 2026-10-04 -->

# UpdateCompany

Företagskontakt som används vid uppdatering

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| CompanyName | Företagsnamn | string | Företagsnamn måste vara mellan 0 och 100 tecken, tomsträng mellanslag eller null uppdaterar inte företagsnamnet |
| CorporateNumber | Organisationsnummer | string | Organisationsnummer måste vara mellan 0 och 20 tecken |
| IsForeignCorporateNumber | Annat format/utländskt organisationsnummer | boolean |  |
| HomePage | Hemsida | string | Hemsida måste vara mellan 0 och 60 tecken |
| SwitchPhone | Telefon växel | string | Växelnummer måste vara mellan 0 och 17 tecken |
| ContactId | Kontakt id | string | Kontaktid måste vara mellan 0 och 40 tecken |
| CustomerId | Kund Id | string | Kundid krävs Kundid måste vara mellan 0 och 40 tecken |
| CategoryIds | Kontaktkategori id | Collection of string |  |
| Address | Adress | [Address](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_Address) |  |
| Email | Email | [Email](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_Email) |  |
| UserId | Användarid som kontakten ska kopplas till | string |  |
| OtherPhone | Telefon annat | string | Övrigt telefonnummer måste vara mellan 0 och 17 tecken |
| WishAdvertising | Önskar reklamutskick | boolean |  |
| Note | Anteckning | string |  |
| Coordinate | Koordinater | [Coordinate](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_Coordinate) |  |
| Task | Typad uppgift | [Task](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Task_Task) |  |
| CustomField | Egendefinerat fält | [FieldValueCriteria](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=CustomField_FieldValueCriteria) |  |
| LeadScore | Antal lead score stjärnor | integer |  |
