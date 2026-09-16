<!-- https://connect.maklare.vitec.net/Help/Api/GET-v2-Advertising-Form-customerId-Estate-estateId, fetched 2026-09-16 -->

# GET v2/Advertising/Form/{customerId}/Estate/{estateId}

Hämtar bostadsinformation som behövs för kontaktformulär

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id | string | Krävs |
| estateId | Id för aktuell bostad | string | Krävs |

## Response Information

### Resource Description

Hämtar bostadsinformation som behövs för kontaktformulär [AdvertisingFormContactEstate](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingFormContactEstate)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Id | Id på bostaden | string |  |
| Office | Kontor | [AdvertisingFormContactEstateOffice](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingFormContactEstateOffice) |  |
| Agents | Handläggare kopplade till bostaden, en av dem kommer att vara primär | Collection of [AdvertisingFormContactEstateAgent](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingFormContactEstateAgent) |  |
| Address | Adressuppgifter | [AdvertisingFormContactEstateAddress](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingFormContactEstateAddress) |  |
| Viewings | Visningar | Collection of [AdvertisingFormContactEstateViewing](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingFormContactEstateViewing) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json220)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml220)

```
{
  "id": "sample string 1",
  "office": {
    "customerId": "sample string 1",
    "name": "sample string 2"
  },
  "agents": [
    {
      "id": "sample string 1",
      "name": "sample string 2",
      "email": "sample string 3",
      "isPrimary": true
    },
    {
      "id": "sample string 1",
      "name": "sample string 2",
      "email": "sample string 3",
      "isPrimary": true
    }
  ],
  "address": {
    "unitDesignation": "sample string 1",
    "streetAddress": "sample string 2",
    "zipCode": "sample string 3",
    "city": "sample string 4",
    "coordinate": {
      "longitude": 1.1,
      "latitude": 2.1
    }
  },
  "viewings": [
    {
      "id": "sample string 1",
      "startsAt": "2026-09-16T06:05:11.2050353+02:00",
      "endsAt": "2026-09-16T06:05:11.2050353+02:00",
      "deadlineAt": "2026-09-16T06:05:11.2050353+02:00",
      "isSelfRegistrationEnabled": true,
      "isVisible": true,
      "comment": "sample string 4",
      "timeSlots": [
        {
          "id": "sample string 1",
          "startsAt": "2026-09-16T06:05:11.2050353+02:00",
          "endsAt": "2026-09-16T06:05:11.2050353+02:00",
          "isRegistrationAvailable": true
        },
        {
          "id": "sample string 1",
          "startsAt": "2026-09-16T06:05:11.2050353+02:00",
          "endsAt": "2026-09-16T06:05:11.2050353+02:00",
          "isRegistrationAvailable": true
        }
      ]
    },
    {
      "id": "sample string 1",
      "startsAt": "2026-09-16T06:05:11.2050353+02:00",
      "endsAt": "2026-09-16T06:05:11.2050353+02:00",
      "deadlineAt": "2026-09-16T06:05:11.2050353+02:00",
      "isSelfRegistrationEnabled": true,
      "isVisible": true,
      "comment": "sample string 4",
      "timeSlots": [
        {
          "id": "sample string 1",
          "startsAt": "2026-09-16T06:05:11.2050353+02:00",
          "endsAt": "2026-09-16T06:05:11.2050353+02:00",
          "isRegistrationAvailable": true
        },
        {
          "id": "sample string 1",
          "startsAt": "2026-09-16T06:05:11.2050353+02:00",
          "endsAt": "2026-09-16T06:05:11.2050353+02:00",
          "isRegistrationAvailable": true
        }
      ]
    }
  ]
}
```
