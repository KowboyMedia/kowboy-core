<!-- https://connect.maklare.vitec.net/Help/Api/POST-Note-customerId, fetched 2026-10-04 -->

# POST Note/{customerId}

Sparar en anteckning

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId |  | string | Krävs |

## Body Parameters

[Note](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Note_Note)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Date | Datum för anteckningen | date |  |
| UserId | Användarid | string |  |
| Text | Beskrivning | string |  |
| ContactId | Kontakt id | string |  |
| EstateId | Objekt id | string |  |

### Request Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json744)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml744)

```
{
  "date": "2026-10-04T13:51:20.4319303+02:00",
  "userId": "sample string 1",
  "text": "sample string 2",
  "contactId": "sample string 3",
  "estateId": "sample string 4"
}
```

## Response Information

### Resource Description

Sparar en anteckning

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input
