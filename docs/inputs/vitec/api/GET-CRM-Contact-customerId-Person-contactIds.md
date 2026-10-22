<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-Person-contactIds, fetched 2026-10-04 -->

# GET CRM/Contact/{customerId}/Person/{contactIds}

Hämta lista utav personkontakter, max 20 stycken åt gången.Om fler än 5 kontakt-ID:n anges, ska de skickas som query-parametrar.

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id. | string | Krävs |
| contactIds | Kontaktidn (kommaseparerade, max 20 stycken). | string | Krävs |

## Response Information

### Resource Description

Hämta lista utav personkontakter, max 20 stycken åt gången.Om fler än 5 kontakt-ID:n anges, ska de skickas som query-parametrar. Collection of [CrmPersonContact](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmPersonContact)

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

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json920)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml920)

```
[
  {
    "type": "Person",
    "firstName": "sample string 1",
    "lastName": "sample string 2",
    "socialSecurityNumber": "sample string 3",
    "isForeignSocialSecurityNumber": true,
    "dateOfBirth": "2026-10-04T13:51:28.9471175+02:00",
    "telephone": {
      "home": "sample string 1",
      "work": "sample string 2",
      "cell": "sample string 3",
      "other": "sample string 4"
    },
    "leadScore": 4,
    "wantsToBeMatched": "Yes",
    "matchingChangedAt": "2026-10-04T13:51:28.9471175+02:00",
    "isDeceased": true,
    "isCompanyPerson": true,
    "gdprApprovalDate": "2026-10-04T13:51:28.9471175+02:00",
    "id": "sample string 7",
    "customerId": "sample string 8",
    "agentId": "sample string 9",
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
    "note": "sample string 11",
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
    "createdAt": "2026-10-04T13:51:28.9471175+02:00",
    "changedAt": "2026-10-04T13:51:28.9471175+02:00"
  },
  {
    "type": "Person",
    "firstName": "sample string 1",
    "lastName": "sample string 2",
    "socialSecurityNumber": "sample string 3",
    "isForeignSocialSecurityNumber": true,
    "dateOfBirth": "2026-10-04T13:51:28.9471175+02:00",
    "telephone": {
      "home": "sample string 1",
      "work": "sample string 2",
      "cell": "sample string 3",
      "other": "sample string 4"
    },
    "leadScore": 4,
    "wantsToBeMatched": "Yes",
    "matchingChangedAt": "2026-10-04T13:51:28.9471175+02:00",
    "isDeceased": true,
    "isCompanyPerson": true,
    "gdprApprovalDate": "2026-10-04T13:51:28.9471175+02:00",
    "id": "sample string 7",
    "customerId": "sample string 8",
    "agentId": "sample string 9",
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
    "note": "sample string 11",
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
    "createdAt": "2026-10-04T13:51:28.9471175+02:00",
    "changedAt": "2026-10-04T13:51:28.9471175+02:00"
  }
]
```
