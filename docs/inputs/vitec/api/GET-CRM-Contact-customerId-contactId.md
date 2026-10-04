<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-contactId, fetched 2026-10-04 -->

# GET CRM/Contact/{customerId}/{contactId}

Hämta kontakt

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id. | string | Krävs |
| contactId | Kontaktid. | string | Krävs |

## Response Information

### Resource Description

Hämta kontakt

- [CrmCompanyContact](https://connect.maklare.vitec.net#CrmCompanyContact103)

- [CrmPersonContact](https://connect.maklare.vitec.net#CrmPersonContact103)

- [CrmDeceasedEstateContact](https://connect.maklare.vitec.net#CrmDeceasedEstateContact103)

[CrmCompanyContact](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmCompanyContact)

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

[CrmPersonContact](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmPersonContact)

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

[CrmDeceasedEstateContact](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmDeceasedEstateContact)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Type | Kontakttyp (Person, företag eller dödsbo) | [ContactType](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_ContactType) |  |
| Name | Namn | string | Nam måste vara mellan 0 och 30 tecken |
| SocialSecurityNumber | Personnummer | string | Personnummer måste vara mellan 0 och 20 tecken |
| IsForeignIdSocialSecurityNumber | Annat format/utländskt personnummer | boolean |  |
| Telephone | Telefonnummer | [PersonTelephoneNumbers](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_PersonTelephoneNumbers) |  |
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

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json118)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml118)

```
{
  "id": "sample string 1",
  "type": "Person",
  "customerId": "sample string 2",
  "agentId": "sample string 3",
  "address": {
    "streetAddress": "sample string 1",
    "zipCode": "sample string 2",
    "city": "sample string 3",
    "countryCode": "sample string 4",
    "wgs84Coordinate": {
      "longitude": 1.1,
      "latitude": 2.1
    }
  },
  "email": {
    "emailAddress": "sample string 1",
    "emailAddress2": "sample string 2"
  },
  "advertisingEnabled": true,
  "note": "sample string 5",
  "categories": [
    {
      "id": "sample string 1",
      "name": "sample string 2",
      "readOnly": true
    },
    {
      "id": "sample string 1",
      "name": "sample string 2",
      "readOnly": true
    }
  ],
  "createdAt": "2026-10-04T13:51:27.0252255+02:00",
  "changedAt": "2026-10-04T13:51:27.0252255+02:00"
}
```
