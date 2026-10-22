<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-contactIds-Tip, fetched 2026-10-04 -->

# GET CRM/Contact/{customerId}/{contactIds}/Tip

Hämta lista av info om tips för kontakter, max 20 stycken kontakter åt gången.

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id. | string | Krävs |
| contactIds | Kontaktidn (kommaseparerade, max 20 stycken). | string | Krävs |

## Response Information

### Resource Description

Hämta lista av info om tips för kontakter, max 20 stycken kontakter åt gången. Collection of [CrmContactTip](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmContactTip)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| ContactId | KontaktId | string |  |
| Tips | Lista med info om tips | Collection of [CrmTip](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmTip) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json729)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml729)

```
[
  {
    "contactId": "sample string 1",
    "tips": [
      {
        "id": "sample string 1",
        "createdAt": "2026-10-04T13:51:36.7611426+02:00"
      },
      {
        "id": "sample string 1",
        "createdAt": "2026-10-04T13:51:36.7611426+02:00"
      }
    ]
  },
  {
    "contactId": "sample string 1",
    "tips": [
      {
        "id": "sample string 1",
        "createdAt": "2026-10-04T13:51:36.7611426+02:00"
      },
      {
        "id": "sample string 1",
        "createdAt": "2026-10-04T13:51:36.7611426+02:00"
      }
    ]
  }
]
```
