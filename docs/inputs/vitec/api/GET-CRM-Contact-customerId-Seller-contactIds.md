<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-Seller-contactIds, fetched 2026-10-04 -->

# GET CRM/Contact/{customerId}/Seller/{contactIds}

Hämta lista av säljarrelationer för kontakter, max 20 stycken kontakter åt gången. Om fler än 5 kontakt-ID:n anges, ska de skickas som query-parametrar.

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id. | string | Krävs |
| contactIds | Kontaktidn (kommaseparerade, max 20 stycken). | string | Krävs |

## Response Information

### Resource Description

Hämta lista av säljarrelationer för kontakter, max 20 stycken kontakter åt gången. Om fler än 5 kontakt-ID:n anges, ska de skickas som query-parametrar. Collection of [CrmSellerContact](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmSellerContact)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Id | Kontaktid | string |  |
| SellerOn | Bostäderna som kontakten är säljare på. | Collection of [CrmSellerRelation](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmSellerRelation) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json432)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml432)

```
[
  {
    "id": "sample string 1",
    "sellerOn": [
      {
        "estateId": "sample string 1",
        "estateType": "House",
        "shareHolding": "sample string 2"
      },
      {
        "estateId": "sample string 1",
        "estateType": "House",
        "shareHolding": "sample string 2"
      }
    ]
  },
  {
    "id": "sample string 1",
    "sellerOn": [
      {
        "estateId": "sample string 1",
        "estateType": "House",
        "shareHolding": "sample string 2"
      },
      {
        "estateId": "sample string 1",
        "estateType": "House",
        "shareHolding": "sample string 2"
      }
    ]
  }
]
```
