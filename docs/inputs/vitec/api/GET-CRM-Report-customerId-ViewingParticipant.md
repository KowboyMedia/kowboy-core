<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Report-customerId-ViewingParticipant, fetched 2026-10-04 -->

# GET CRM/Report/{customerId}/ViewingParticipant

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId |  | string | Krävs |
| ViewingStartDate | Visningar från och med | date |  |
| ViewingEndDate | Visningar till och med | date |  |
| CustomerIds | Kund-id lista separerade med komma | string |  |
| PageSize | Max antal rader i varje anrop, Max 300 | integer |  |
| PageIndex | Sidnummer som ska hämtas, 0-indexerat | integer |  |

## Response Information

### Resource Description

[CrmViewingParticipantReport](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Reports_CrmViewingParticipantReport)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Rows |  | Collection of [CrmViewingParticipantReportRow](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Reports_CrmViewingParticipantReportRow) |  |
| TotalPageCount |  | integer |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json619)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml619)

```
{
  "rows": [
    {
      "contact": {
        "id": null,
        "firstName": "sample string 1",
        "lastName": "sample string 2",
        "cellPhone": "sample string 3",
        "email": "sample string 4"
      },
      "viewing": {
        "date": "2026-10-04T13:51:24.4006326+02:00"
      },
      "followedUp": "Completed",
      "estate": {
        "id": null,
        "streetAddress": "sample string 1",
        "zipCode": "sample string 2",
        "city": "sample string 3",
        "area": "sample string 4"
      },
      "office": {
        "customerId": "sample string 1",
        "name": "sample string 2"
      },
      "responsibleBroker": {
        "name": "sample string 1"
      }
    },
    {
      "contact": {
        "id": null,
        "firstName": "sample string 1",
        "lastName": "sample string 2",
        "cellPhone": "sample string 3",
        "email": "sample string 4"
      },
      "viewing": {
        "date": "2026-10-04T13:51:24.4006326+02:00"
      },
      "followedUp": "Completed",
      "estate": {
        "id": null,
        "streetAddress": "sample string 1",
        "zipCode": "sample string 2",
        "city": "sample string 3",
        "area": "sample string 4"
      },
      "office": {
        "customerId": "sample string 1",
        "name": "sample string 2"
      },
      "responsibleBroker": {
        "name": "sample string 1"
      }
    }
  ],
  "totalPageCount": 1
}
```
