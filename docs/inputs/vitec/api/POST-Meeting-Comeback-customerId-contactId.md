<!-- https://connect.maklare.vitec.net/Help/Api/POST-Meeting-Comeback-customerId-contactId, fetched 2026-10-04 -->

# POST Meeting/Comeback/{customerId}/{contactId}

Skapa återkomst

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kundid | string | Krävs |
| contactId | Id på kontakt | string | Krävs |

## Body Parameters

Återkomst [Comeback](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Meeting_Comeback)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Date | Tid och datum för återkomsten | date |  |
| MeetingId | Id på ursprungligt kundmötee | string |  |
| EstateId | Id på bostad | string |  |
| Participant | Deltagare | [Participant](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Meeting_Participant) |  |
| Note | Anteckning | string |  |

### Request Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json918)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml918)

```
{
  "date": "2026-10-04T13:51:43.1559676+02:00",
  "meetingId": "sample string 2",
  "estateId": "sample string 3",
  "participant": {
    "userId": "sample string 1",
    "userGroupId": "sample string 2",
    "officeId": "sample string 3"
  },
  "note": "sample string 4"
}
```

## Response Information

### Resource Description

Skapa återkomst string

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json918)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml918)

```
"sample string 1"
```
