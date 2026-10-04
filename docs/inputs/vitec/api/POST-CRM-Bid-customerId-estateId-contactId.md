<!-- https://connect.maklare.vitec.net/Help/Api/POST-CRM-Bid-customerId-estateId-contactId, fetched 2026-10-04 -->

# POST CRM/Bid/{customerId}/{estateId}/{contactId}

Metod för att lägga bud på en bostad.

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kundid | string | Krävs |
| estateId | Bostadsid | string | Krävs |
| contactId | KontaktId | string | Krävs |

## Body Parameters

Buddata [BidData](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Bid_BidData)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Alias | Bud alias | string |  |
| Amount | Budbelopp | string |  |
| CreatedAt | Datum och tid för budet | date |  |
| Condition | Villkor för budet | string |  |
| IsHidden | Anger om budet är dolt | boolean |  |

### Request Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json635)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml635)

```
{
  "alias": "sample string 1",
  "amount": "sample string 2",
  "createdAt": "2026-10-04T13:51:41.8747292+02:00",
  "condition": "sample string 4",
  "isHidden": true
}
```

## Response Information

### Resource Description

Metod för att lägga bud på en bostad. string

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json635)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml635)

```
"sample string 1"
```
