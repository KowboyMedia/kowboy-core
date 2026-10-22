<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-Speculator, fetched 2026-10-04 -->

# GET CRM/Contact/{customerId}/Speculator

Hämta lista av spekulantrelationer för kontakter, max 20 stycken kontakter åt gången. Om fler än 5 kontakt-ID:n anges, ska de skickas som query-parametrar.

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id. | string | Krävs |
| contactIds | Kontaktidn (kommaseparerade, max 20 stycken). | string | Krävs |

## Response Information

### Resource Description

Hämta lista av spekulantrelationer för kontakter, max 20 stycken kontakter åt gången. Om fler än 5 kontakt-ID:n anges, ska de skickas som query-parametrar. Collection of [CrmSpeculatorContact](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmSpeculatorContact)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Id | Kontaktid | string |  |
| SpeculatorOn | Bostäderna som kontakten är och har varit spekulant på. | Collection of [CrmSpeculatorRelation](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmSpeculatorRelation) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json229)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml229)

```
[
  {
    "id": "sample string 1",
    "speculatorOn": [
      {
        "estateId": "sample string 1",
        "estateType": "House",
        "level": "Reserved"
      },
      {
        "estateId": "sample string 1",
        "estateType": "House",
        "level": "Reserved"
      }
    ]
  },
  {
    "id": "sample string 1",
    "speculatorOn": [
      {
        "estateId": "sample string 1",
        "estateType": "House",
        "level": "Reserved"
      },
      {
        "estateId": "sample string 1",
        "estateType": "House",
        "level": "Reserved"
      }
    ]
  }
]
```
