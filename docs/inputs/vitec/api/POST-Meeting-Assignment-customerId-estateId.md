<!-- https://connect.maklare.vitec.net/Help/Api/POST-Meeting-Assignment-customerId-estateId, fetched 2026-10-04 -->

# POST Meeting/Assignment/{customerId}/{estateId}

Boka intagsmöte

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kundid | string | Krävs |
| estateId | Objektid | string | Krävs |

## Body Parameters

Intagsmöte [AssignmentMeeting](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Meeting_AssignmentMeeting)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| StartsAt |  | date |  |
| EndsAt |  | date |  |
| Location |  | string |  |
| Note |  | string |  |
| ContactId |  | string |  |

### Request Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json588)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml588)

```
{
  "startsAt": "2026-10-04T13:51:42.8401764+02:00",
  "endsAt": "2026-10-04T13:51:42.8401764+02:00",
  "location": "sample string 3",
  "note": "sample string 4",
  "contactId": "sample string 5"
}
```

## Response Information

### Resource Description

Boka intagsmöte string

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json588)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml588)

```
"sample string 1"
```
