<!-- https://connect.maklare.vitec.net/Help/ResourceModel?modelName=User_User, fetched 2026-10-04 -->

# User

Användare

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Archived | Arkiverad | boolean |  |
| Public | Publik | boolean |  |
| UserId | Användarid | string |  |
| CustomerId | Kontorsid | Collection of string |  |
| OrderNumber | Sorteringsnummer-OBS obsolete. Använd sorteringsnumret under CustomerIdsWithSortOrder istället | integer |  |
| UserName | Namn | string |  |
| Department | Avdelning | string |  |
| Category | Kategori | string |  |
| Title | Titel | string |  |
| ExtraTitle | Extra Titel | string |  |
| AllowLogOn | Tillåt inloggning | boolean |  |
| EmailAddress | Epostadress | string |  |
| TelePhone | Telefonnummer | string |  |
| CellPhone | Mobilnummer | string |  |
| DirectPhonenumbers | Telefonnummer direkt | Collection of [DirectPhoneNumber](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=User_DirectPhoneNumber) |  |
| PublicPhonenumber | Publikt telefonnummer | string |  |
| SpokenLanguages | Talade språk | Collection of string |  |
| Bank | Banknamn | string |  |
| CleringNumber | Cleringnummer utfasad - finns i account | string |  |
| Account | Konto | string |  |
| AccountType | Kontotyp | [AccountType](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=User_AccountType) |  |
| Iban | Ibannummer | string |  |
| Swift | Swiftnummer | string |  |
| Comment | Kommentar | string |  |
| Image | Bild | [Image](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Image_Image) |  |
| PublishedOnOffice | Företag där användaren är publik | Collection of string |  |
| InternalEmployeeNumber |  | integer |  |
| ExternalUserId |  | string |  |
| CustomerIdsWithSortOrder | Kundid och sorteringnummer | Collection of [CustomerIdWithOrderNumber](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=User_CustomerIdWithOrderNumber) |  |
| DateChanged | Ändringsdatum | date |  |
| SubOffices | Underkontor som användaren är kopplad till | Collection of [UserSubOffice](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=User_UserSubOffice) |  |
| Reviews | Kundomdömen | Collection of [UserReview](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=User_UserReview) |  |
