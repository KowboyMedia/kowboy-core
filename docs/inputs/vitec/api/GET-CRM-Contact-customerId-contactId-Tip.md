<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-contactId-Tip, fetched 2026-10-04 -->

# GET CRM/Contact/{customerId}/{contactId}/Tip

Hämta info om tips för en kontakt.

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id. | string | Krävs |
| contactId | Kontaktid. | string | Krävs |

## Response Information

### Resource Description

Hämta info om tips för en kontakt. [CrmContactTip](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmContactTip)

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

- [application/json, text/json](https://connect.maklare.vitec.net#json416)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml416)

```
{
  "contactId": "sample string 1",
  "tips": [
    {
      "id": "sample string 1",
      "createdAt": "2026-10-04T13:51:36.5294705+02:00"
    },
    {
      "id": "sample string 1",
      "createdAt": "2026-10-04T13:51:36.5294705+02:00"
    }
  ]
}
```
