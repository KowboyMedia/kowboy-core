<!-- https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Update_UpdatePerson, fetched 2026-10-04 -->

# UpdatePerson

Personkontakt som används vid uppdatering

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| FirstName | Förnamn | string | Förnamn måste vara mellan 0 och 30 tecken, tomsträng mellanslag eller null uppdaterar inte förnamnet |
| LastName | Efternamn | string | Efternamn måste vara mellan 0 och 30 tecken, tomsträng mellanslag eller null uppdaterar inte namnet |
| SocialSecurityNumber | Personnummer | string | Personnummer måste vara mellan 0 och 20 tecken |
| IsForeignSocialSecurityNumber | Annat format/utländskt personnummer | boolean |  |
| TelePhone | Telefon bostad | string | Epostadress, telefonnummer (bostad eller arbete) eller mobilnummer måste anges. Telefonnummer måste vara mellan 0 och 17 tecken |
| WorkPhone | Telefon arbete | string | Epostadress, telefonnummer (bostad eller arbete) eller mobilnummer måste anges. Arbetsnummer måste vara mellan 0 och 17 tecken |
| CellPhone | Mobiltelefon | string | Epostadress, telefonnummer (bostad eller arbete) eller mobilnummer måste anges. Mobilnummer måste vara mellan 0 och 17 tecken |
| Approval | PUL-Godkännande | boolean |  |
| ApprovalDate | PUL-Godkännande datum | date |  |
| GDPRApprovalDate | GDPR informerad den | date |  |
| ObtainThrough | Informerad via | [ObtainMethod](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Update_ObtainMethod) |  |
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
