<!-- https://connect.maklare.vitec.net/Help/Api/PUT-CRM-Speculator-customerId-contactId-Estate-estateId, fetched 2026-10-04 -->

# PUT CRM/Speculator/{customerId}/{contactId}/Estate/{estateId}

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId |  | string | Krävs |
| contactId |  | string | Krävs |
| estateId |  | string | Krävs |

## Body Parameters

[SpeculatorRelation](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Speculator_SpeculatorRelation)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Note | Notering | string |  |
| Status | Status | [Status](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Speculator_Status) |  |

### Request Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json931)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml931)

```
{
  "note": "sample string 1",
  "status": "JoinedBidding"
}
```

## Response Information

### Resource Description

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input
