<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-contactIds-Order-EndPrice, fetched 2026-10-04 -->

# GET CRM/Contact/{customerId}/{contactIds}/Order/EndPrice

Hämta lista av info om kontakts tjänster avseende "Slutpriser i området", max 20 stycken kontakter åt gången.

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id. | string | Krävs |
| contactIds | Kontaktidn (kommaseparerade, max 20 stycken). | string | Krävs |

## Response Information

### Resource Description

Hämta lista av info om kontakts tjänster avseende "Slutpriser i området", max 20 stycken kontakter åt gången. Collection of [CrmContactEndPrice](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmContactEndPrice)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| ContactId | KontaktId | string |  |
| Orders | Lista med info om kontakts tjänster avseende "Slutpriser i området" | Collection of [CrmEndPriceOrder](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmEndPriceOrder) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json760)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml760)

```
[
  {
    "contactId": "sample string 1",
    "orders": [
      {
        "id": "sample string 1",
        "createdAt": "2026-10-04T13:51:38.8106962+02:00",
        "startDate": "2026-10-04T13:51:38.8106962+02:00"
      },
      {
        "id": "sample string 1",
        "createdAt": "2026-10-04T13:51:38.8106962+02:00",
        "startDate": "2026-10-04T13:51:38.8106962+02:00"
      }
    ]
  },
  {
    "contactId": "sample string 1",
    "orders": [
      {
        "id": "sample string 1",
        "createdAt": "2026-10-04T13:51:38.8106962+02:00",
        "startDate": "2026-10-04T13:51:38.8106962+02:00"
      },
      {
        "id": "sample string 1",
        "createdAt": "2026-10-04T13:51:38.8106962+02:00",
        "startDate": "2026-10-04T13:51:38.8106962+02:00"
      }
    ]
  }
]
```
