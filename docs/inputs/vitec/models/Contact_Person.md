<!-- https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Contact_Person, fetched 2026-10-04 -->

# Person

Personkontakt

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| FirstName | Förnamn | string | Förnamn måste vara mellan 0 och 30 tecken |
| LastName | Efternamn | string | Efternamn måste vara mellan 0 och 30 tecken |
| SocialSecurityNumber | Personnummer | string | Personnummer måste vara mellan 0 och 15 tecken |
| TelePhone | Telefon bostad | string | Telefonnummer måste vara mellan 0 och 17 tecken |
| WorkPhone | Telefon arbete | string | Arbetsnummer måste vara mellan 0 och 17 tecken |
| CellPhone | Mobiltelefon | string | Mobilnummer måste vara mellan 0 och 17 tecken |
| GDPRApprovalDate | GDPR informerad den | date |  |
| ObtainThrough | Informerad via | string |  |
| BrokerId | Mäklarens id | string |  |
| ContactId | Kontakt id | string | Kontaktid måste vara mellan 0 och 40 tecken |
| CustomerId | Kundid | string | Kundid krävs Kundid måste vara mellan 0 och 40 tecken |
| CustomFields | Egendefinierade fält | Collection of [FieldValue](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=CustomField_FieldValue) |  |
| Categories | Kontaktkategori id | Collection of [Category](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Category_Category) |  |
| Address | Adress | [Address](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_Address) |  |
| Email | Email | [Email](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_Email) |  |
| OtherPhone | Telefon annat | string | Övrigt telefonnummer måste vara mellan 0 och 17 tecken |
| WishAdvertising | Önskar reklamutskick | boolean |  |
| Note | Anteckning | string |  |
| Coordinate | Koordinater | [Coordinate](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_Coordinate) |  |
| CreatedAt | Skapad | date |  |
| ChangedAt | Ändrad | date |  |
| LookingForAccommodation | Önskemål | Collection of [LookingForAccommodation](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Interest_LookingForAccommodation) |  |
| PresentAccommodation | Nuvarande boende | [PresentAccommodation](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Interest_PresentAccommodation) |  |
| BuyerOnObjects | Objekt som kontakten köper | Collection of [BuyerOnObject](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Contact_BuyerOnObject) |  |
| SellerOnObjects | Objekt som kontakten säljer | Collection of [SellerOnObject](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Contact_SellerOnObject) |  |
| InterestOnObjects | Objekt som kontakten är intreserad av | Collection of [IntrestOnObject](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Contact_IntrestOnObject) |  |
