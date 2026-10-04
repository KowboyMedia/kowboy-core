<!-- https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmCompanyContact, fetched 2026-10-04 -->

# CrmCompanyContact

Företagskontakt

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Type | Kontakttyp (Person, företag eller dödsbo) | [ContactType](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_ContactType) |  |
| Name | Företagsnamn | string | Företagsnamn måste vara mellan 0 och 100 tecken |
| CorporateNumber | Organisationsnummer | string | Organisationsnummer måste vara mellan 0 och 20 tecken |
| IsForeignCorporateNumber | Annat format/utländskt organisationsnummer | boolean |  |
| HomePage | Hemsida | string | Hemsida måste vara mellan 0 och 60 tecken |
| Telephone | Telefonnummer | [CompanyTelephoneNumbers](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CompanyTelephoneNumbers) |  |
| LeadScore | Antal lead score stjärnor | integer |  |
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
