<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-contactIds-objectLeadType-contactLeadType-logLeadType-outgoingLeadType-Lead, fetched 2026-10-04 -->

# GET CRM/Contact/{customerId}/{contactIds}/{objectLeadType}/{contactLeadType}/{logLeadType}/{outgoingLeadType}/Lead

Hämta lista av info om leads för kontakter, max 20 stycken kontakter åt gången.

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id. | string | Krävs |
| contactIds | Kontaktidn (kommaseparerade, max 20 stycken). | string | Krävs |
| objectLeadType | ObjectLeadType. | boolean | Krävs |
| contactLeadType | ContactLeadType. | boolean | Krävs |
| logLeadType | LogLeadType. | boolean | Krävs |
| outgoingLeadType | OutgoingLeadType. | boolean | Krävs |

## Response Information

### Resource Description

Hämta lista av info om leads för kontakter, max 20 stycken kontakter åt gången. Collection of [CrmContactLead](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmContactLead)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| ContactId | KontaktId | string |  |
| Leads | Lista med info om leads | Collection of [CrmLead](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmLead) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json104)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml104)

```
[
  {
    "contactId": "sample string 1",
    "leads": [
      {
        "id": "sample string 1",
        "createdAt": "2026-10-04T13:51:36.2137494+02:00",
        "leadType": "Object",
        "leadTypeId": "sample string 3"
      },
      {
        "id": "sample string 1",
        "createdAt": "2026-10-04T13:51:36.2137494+02:00",
        "leadType": "Object",
        "leadTypeId": "sample string 3"
      }
    ]
  },
  {
    "contactId": "sample string 1",
    "leads": [
      {
        "id": "sample string 1",
        "createdAt": "2026-10-04T13:51:36.2137494+02:00",
        "leadType": "Object",
        "leadTypeId": "sample string 3"
      },
      {
        "id": "sample string 1",
        "createdAt": "2026-10-04T13:51:36.2137494+02:00",
        "leadType": "Object",
        "leadTypeId": "sample string 3"
      }
    ]
  }
]
```
