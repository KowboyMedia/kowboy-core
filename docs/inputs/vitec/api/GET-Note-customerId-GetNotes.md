<!-- https://connect.maklare.vitec.net/Help/Api/GET-Note-customerId-GetNotes, fetched 2026-10-04 -->

# GET Note/{customerId}/GetNotes

Hämtar lista av anteckningar för en kontakt

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| contactId | kontaktId | string | Krävs |
| customerId | Kund-id | string |  |

## Response Information

### Resource Description

Hämtar lista av anteckningar för en kontakt Collection of [SimpleNote](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Note_SimpleNote)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Id | Id | string |  |
| Date | Datum för anteckningen | date |  |
| UserId | Användarid | string |  |
| Text | Beskrivning | string |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json55)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml55)

```
[
  {
    "id": "sample string 1",
    "date": "2026-10-04T13:51:20.7571988+02:00",
    "userId": "sample string 2",
    "text": "sample string 3"
  },
  {
    "id": "sample string 1",
    "date": "2026-10-04T13:51:20.7571988+02:00",
    "userId": "sample string 2",
    "text": "sample string 3"
  }
]
```
