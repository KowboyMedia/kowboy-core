<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Bid-customerId-id, fetched 2026-10-04 -->

# GET CRM/Bid/{customerId}/{id}

Hämta information om ett bud

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kundid | string | Krävs |
| id | Budid | string | Krävs |

## Response Information

### Resource Description

Hämta information om ett bud [Bid](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Bid_Bid)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Id | Budets id | string |  |
| EstateId | Bostadsid | string |  |
| ContactId | Kontaktid | string |  |
| IsCanceled | Om budet är makulerat | boolean |  |
| IdentifiedBidder | Identifierad budgivare | boolean |  |
| Alias | Bud alias | string |  |
| Amount | Budbelopp | string |  |
| CreatedAt | Datum och tid för budet | date |  |
| Condition | Villkor för budet | string |  |
| IsHidden | Anger om budet är dolt | boolean |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json463)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml463)

```
{
  "id": "sample string 1",
  "estateId": "sample string 2",
  "contactId": "sample string 3",
  "isCanceled": true,
  "identifiedBidder": true,
  "alias": "sample string 6",
  "amount": "sample string 7",
  "createdAt": "2026-10-04T13:51:40.6866725+02:00",
  "condition": "sample string 9",
  "isHidden": true
}
```
