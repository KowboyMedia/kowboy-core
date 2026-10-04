<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-Buyer-contactId, fetched 2026-10-04 -->

# GET CRM/Contact/{customerId}/Buyer/{contactId}

Hämta köparrelationerna för en kontakt.

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id. | string | Krävs |
| contactId | Kontaktid. | string | Krävs |

## Response Information

### Resource Description

Hämta köparrelationerna för en kontakt. [CrmBuyerContact](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmBuyerContact)

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

- [application/json, text/json](https://connect.maklare.vitec.net#json542)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml542)

```
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
```
