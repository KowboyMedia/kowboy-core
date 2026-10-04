<!-- https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmPersonContact, fetched 2026-10-04 -->

# CrmPersonContact

Personkontakt

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Type | Kontakttyp (Person, företag eller dödsbo) | [ContactType](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_ContactType) |  |
| FirstName | Förnamn | string | Förnamn måste vara mellan 0 och 30 tecken |
| LastName | Efternamn | string | Efternamn måste vara mellan 0 och 30 tecken |
| SocialSecurityNumber | Personnummer | string | Personnummer måste vara mellan 0 och 20 tecken |
| IsForeignSocialSecurityNumber | Annat format/utländskt personnummer | boolean |  |
| DateOfBirth | Födelsedatum | date |  |
| Telephone | Telefonnummer | [PersonTelephoneNumbers](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_PersonTelephoneNumbers) |  |
| LeadScore | Antal lead score stjärnor | integer |  |
| WantsToBeMatched | Ska matchas/bevakas | [MatchingWatched](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Interest_MatchingWatched) |  |
| MatchingChangedAt | Senast uppdaterad angående matchning | date |  |
| IsDeceased | Avliden | boolean |  |
| IsCompanyPerson | Är kopplad till företag | boolean |  |
| GDPRApprovalDate | GDPR informerad den | date |  |
| Id | Kontakt id | string | Kontaktid måste vara mellan 0 och 40 tecken |
| CustomerId | Kund-id | string | Kund-id krävs Kund-id måste vara mellan 0 och 40 tecken |
| AgentId | Mäklarens id | string |  |
| Address | Adress | [CrmContactAddress](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmContactAddress) |  |
| Email | Email | [Email](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_Email) |  |
| AdvertisingEnabled | Reklamutskick tillåts | boolean |  |
| Note | Anteckning | string |  |
| Categories | Kategorier | Collection of [Category](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Category_Category) |  |
| CreatedAt | Skapad | date |  |
| ChangedAt | Ändrad | date |  |
