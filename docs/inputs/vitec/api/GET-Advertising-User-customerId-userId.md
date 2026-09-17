<!-- https://connect.maklare.vitec.net/Help/Api/GET-Advertising-User-customerId-userId, fetched 2026-09-16 -->

# GET Advertising/User/{customerId}/{userId}

Hämta användare för hemsida.

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id | string | Krävs |
| userId | Användare-id | string | Krävs |

## Response Information

### Resource Description

Hämta användare för hemsida.

[AdvertisingUser](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingUser)

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

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json48)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml48)

```
{
  "id": "sample string 1",
  "name": "sample string 2",
  "title": "sample string 3",
  "category": "sample string 4",
  "emailAddress": "sample string 5",
  "description": "sample string 6",
  "spokenLanguages": [
    "sample string 1",
    "sample string 2"
  ],
  "changedAt": "2026-09-16T06:05:10.0488004+02:00",
  "telephone": {
    "cell": {
      "msisdn": "sample string 1",
      "display": "sample string 2"
    },
    "public": {
      "msisdn": "sample string 1",
      "display": "sample string 2"
    }
  },
  "image": {
    "id": "sample string 1",
    "dataChangedAt": "2026-09-16T06:05:10.0488004+02:00",
    "description": "sample string 3",
    "name": "sample string 4",
    "category": {
      "id": "sample string 1",
      "name": "sample string 2"
    },
    "extension": "sample string 5",
    "cdnReferences": [
      {
        "name": "sample string 1",
        "url": "sample string 2"
      },
      {
        "name": "sample string 1",
        "url": "sample string 2"
      }
    ]
  },
  "isVisibleInStaffList": true,
  "offices": [
    {
      "id": "sample string 1",
      "customerId": "sample string 2",
      "orderNumber": 3,
      "isVisibleInStaffList": true,
      "telephone": {
        "personal": {
          "msisdn": "sample string 1",
          "display": "sample string 2"
        }
      }
    },
    {
      "id": "sample string 1",
      "customerId": "sample string 2",
      "orderNumber": 3,
      "isVisibleInStaffList": true,
      "telephone": {
        "personal": {
          "msisdn": "sample string 1",
          "display": "sample string 2"
        }
      }
    }
  ],
  "reviews": [
    {
      "text": "sample string 1",
      "authorName": "sample string 2"
    },
    {
      "text": "sample string 1",
      "authorName": "sample string 2"
    }
  ]
}
```
