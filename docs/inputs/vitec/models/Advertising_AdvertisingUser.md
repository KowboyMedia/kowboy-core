<!-- https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingUser, fetched 2026-09-16 -->

# AdvertisingUser

Användare

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Id | Id | string |  |
| Name | Namn | string |  |
| Title | Titel | string |  |
| Category | Kategori | string |  |
| EmailAddress | E-postadress | string |  |
| Description | Beskrivning | string |  |
| SpokenLanguages | Talade språk | Collection of string |  |
| ChangedAt | När mäklaren senast ändrades | date |  |
| Telephone | Telefonnummer | [AdvertisingUserTelephoneNumbers](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingUserTelephoneNumbers) |  |
| Image | Bild | [AdvertisingImage](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingImage) |  |
| IsVisibleInStaffList | Om användaren ska visas i personallistan | boolean |  |
| Offices | Användarens tillhörighet till kontor | Collection of [AdvertisingUserOffice](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingUserOffice) |  |
| Reviews | Kundomdömen, senaste först | Collection of [AdvertisingUserReview](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingUserReview) |  |
