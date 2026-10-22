<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-Buyer, fetched 2026-10-04 -->

# GET CRM/Contact/{customerId}/Buyer

Hämta lista av köparrelationer för kontakter, max 20 stycken kontakter åt gången. Om fler än 5 kontakt-ID:n anges, ska de skickas som query-parametrar.

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id. | string | Krävs |
| contactIds | Kontaktidn (kommaseparerade, max 20 stycken). | string | Krävs |

## Response Information

### Resource Description

Hämta lista av köparrelationer för kontakter, max 20 stycken kontakter åt gången. Om fler än 5 kontakt-ID:n anges, ska de skickas som query-parametrar. Collection of [CrmBuyerContact](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmBuyerContact)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Id | Kontaktid | string |  |
| BuyerOn | Bostäderna som kontakten är köpare på. | Collection of [CrmBuyerRelation](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmBuyerRelation) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json979)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml979)

```
[
  {
    "id": "sample string 1",
    "buyerOn": [
      {
        "estateId": "sample string 1",
        "estateType": "House"
      },
      {
        "estateId": "sample string 1",
        "estateType": "House"
      }
    ]
  },
  {
    "id": "sample string 1",
    "buyerOn": [
      {
        "estateId": "sample string 1",
        "estateType": "House"
      },
      {
        "estateId": "sample string 1",
        "estateType": "House"
      }
    ]
  }
]
```
