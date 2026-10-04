<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-Seller-contactId, fetched 2026-10-04 -->

# GET CRM/Contact/{customerId}/Seller/{contactId}

Hämta säljarrelationerna för en kontakt.

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id. | string | Krävs |
| contactId | Kontaktid. | string | Krävs |

## Response Information

### Resource Description

Hämta säljarrelationerna för en kontakt. [CrmSellerContact](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmSellerContact)

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

- [application/json, text/json](https://connect.maklare.vitec.net#json213)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml213)

```
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
```
