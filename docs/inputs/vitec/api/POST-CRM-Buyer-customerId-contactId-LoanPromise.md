<!-- https://connect.maklare.vitec.net/Help/Api/POST-CRM-Buyer-customerId-contactId-LoanPromise, fetched 2026-10-04 -->

# POST CRM/Buyer/{customerId}/{contactId}/LoanPromise

Lånelöfte

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId |  | string | Krävs |
| contactId |  | string | Krävs |

## Body Parameters

[LoanPromise](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Buyer_LoanPromise)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Bank | Namn på bank | string |  |
| ValidUntil | Giltigt till | date |  |
| EstateType | Vilken objekttyp lånelöftet är giltigt för | [LoanPromiseEstateType](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Buyer_LoanPromiseEstateType) |  |
| EstateId | Objekt id för objekt kopplat till lånelöftet | string |  |
| Status | Lånelöftets status | [LoanPromiseStatus](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Buyer_LoanPromiseStatus) |  |
| Financing | Finansieringssätt | [LoanPromiseFinancing](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Buyer_LoanPromiseFinancing) |  |

### Request Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json508)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml508)

```
{
  "bank": "sample string 1",
  "validUntil": "2026-10-04T13:51:20.1165649+02:00",
  "estateType": "Apartment",
  "estateId": "sample string 2",
  "status": "AutomaticVerification",
  "financing": "Unknown"
}
```

## Response Information

### Resource Description

Lånelöfte string

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json508)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml508)

```
"sample string 1"
```
