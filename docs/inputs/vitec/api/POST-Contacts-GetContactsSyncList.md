<!-- https://connect.maklare.vitec.net/Help/Api/POST-Contacts-GetContactsSyncList, fetched 2026-10-04 -->

# POST Contacts/GetContactsSyncList

Hämta kontaktlista. För att kunna hämta en kontaktlista så krävs det en giltig API nyckel och ett kundid.

## Request Information

## Body Parameters

Urval [ContactCriteria](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Contact_ContactCriteria)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| CustomerId | Om kontakt id ska tillhöra en specifikt kontor | string | Kundid måste vara mellan 0 och 40 tecken |
| ContactId | Kontaktid | Collection of string |  |
| UserId | Urval på användarid | string |  |
| Categories | Urval på kategorier | Collection of string |  |
| EmailAddresses | Urval på epostadress | Collection of string |  |
| ContractDateFrom | Kontraktdatum från | date |  |
| ContractDateTo | Kontraktdatum till | date |  |
| ViewingDateFrom | Visiningsdatum från | date |  |
| ViewingDateTo | Visiningsdatum till | date |  |
| BiddingDateFrom | Budgivningsdatum från | date |  |
| BiddingDateTo | Budgivningsdatum till | date |  |
| CreatedDateFrom | Skapatdatum från | date |  |
| CreatedDateTo | Skapatdatum till | date |  |
| ChangedDateFrom | Ändringsdatum från | date |  |
| ChangedDateTo | Ändringsdatum till | date |  |
| SellerRelationDateFrom | Från datum kopplad som säljare på objekt | date |  |
| SellerRelationDateTo | Till datum kopplad som säljare på objekt | date |  |
| BuyerRelationDateFrom | Från datum kopplad som köpare på objekt | date |  |
| BuyerRelationDateTo | Till datum kopplad som köpare på objekt | date |  |
| CustomField | Egendefinerat fält | [FieldValueCriteria](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=CustomField_FieldValueCriteria) |  |
| SocialSecurityNumber | Personnummer | string |  |

### Request Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json278)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml278)

```
{
  "customerId": "sample string 1",
  "contactId": [
    "sample string 1",
    "sample string 2"
  ],
  "userId": "sample string 2",
  "categories": [
    "sample string 1",
    "sample string 2"
  ],
  "emailAddresses": [
    "sample string 1",
    "sample string 2"
  ],
  "contractDateFrom": "2026-10-04T08:01:46.9677456+02:00",
  "contractDateTo": "2026-10-04T08:01:46.9677456+02:00",
  "viewingDateFrom": "2026-10-04T08:01:46.9677456+02:00",
  "viewingDateTo": "2026-10-04T08:01:46.9677456+02:00",
  "biddingDateFrom": "2026-10-04T08:01:46.9677456+02:00",
  "biddingDateTo": "2026-10-04T08:01:46.9677456+02:00",
  "createdDateFrom": "2026-10-04T08:01:46.9677456+02:00",
  "createdDateTo": "2026-10-04T08:01:46.9677456+02:00",
  "changedDateFrom": "2026-10-04T08:01:46.9677456+02:00",
  "changedDateTo": "2026-10-04T08:01:46.9677456+02:00",
  "sellerRelationDateFrom": "2026-10-04T08:01:46.9677456+02:00",
  "sellerRelationDateTo": "2026-10-04T08:01:46.9677456+02:00",
  "buyerRelationDateFrom": "2026-10-04T08:01:46.9677456+02:00",
  "buyerRelationDateTo": "2026-10-04T08:01:46.9677456+02:00",
  "customField": {
    "name": "sample string 1",
    "value": "sample string 2"
  },
  "socialSecurityNumber": "sample string 3"
}
```

## Response Information

### Resource Description

Hämtar lista över kontakters id och ändringsdatum. Collection of [ContactCollectionForSyncList](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Contact_ContactCollectionForSyncList)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| CustomerId | Kund id | string |  |
| Persons | Lista av personkontakter | Collection of [PersonForSyncList](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Contact_PersonForSyncList) |  |
| Companies | Lista av företagskontakter | Collection of [CompanyForSyncList](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Contact_CompanyForSyncList) |  |
| Estates | Lista av dödsbokontakter | Collection of [EstateForSyncList](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Contact_EstateForSyncList) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json293)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml293)

```
[
  {
    "customerId": "sample string 1",
    "persons": [
      {
        "contactId": "sample string 1",
        "dateChanged": "2026-10-04T08:01:46.9677456+02:00"
      },
      {
        "contactId": "sample string 1",
        "dateChanged": "2026-10-04T08:01:46.9677456+02:00"
      }
    ],
    "companies": [
      {
        "contactId": "sample string 1",
        "dateChanged": "2026-10-04T08:01:46.9677456+02:00"
      },
      {
        "contactId": "sample string 1",
        "dateChanged": "2026-10-04T08:01:46.9677456+02:00"
      }
    ],
    "estates": [
      {
        "contactId": "sample string 1",
        "dateChanged": "2026-10-04T08:01:46.9677456+02:00"
      },
      {
        "contactId": "sample string 1",
        "dateChanged": "2026-10-04T08:01:46.9677456+02:00"
      }
    ]
  },
  {
    "customerId": "sample string 1",
    "persons": [
      {
        "contactId": "sample string 1",
        "dateChanged": "2026-10-04T08:01:46.9677456+02:00"
      },
      {
        "contactId": "sample string 1",
        "dateChanged": "2026-10-04T08:01:46.9677456+02:00"
      }
    ],
    "companies": [
      {
        "contactId": "sample string 1",
        "dateChanged": "2026-10-04T08:01:46.9677456+02:00"
      },
      {
        "contactId": "sample string 1",
        "dateChanged": "2026-10-04T08:01:46.9677456+02:00"
      }
    ],
    "estates": [
      {
        "contactId": "sample string 1",
        "dateChanged": "2026-10-04T08:01:46.9677456+02:00"
      },
      {
        "contactId": "sample string 1",
        "dateChanged": "2026-10-04T08:01:46.9677456+02:00"
      }
    ]
  }
]
```
