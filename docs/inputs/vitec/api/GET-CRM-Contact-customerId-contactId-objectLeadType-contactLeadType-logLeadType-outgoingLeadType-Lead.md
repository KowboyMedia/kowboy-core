<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-contactId-objectLeadType-contactLeadType-logLeadType-outgoingLeadType-Lead, fetched 2026-10-04 -->

# GET CRM/Contact/{customerId}/{contactId}/{objectLeadType}/{contactLeadType}/{logLeadType}/{outgoingLeadType}/Lead

Hämta info om leads för en kontakt.

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id. | string | Krävs |
| contactId | Kontaktid. | string | Krävs |
| objectLeadType | ObjectLeadType. | boolean | Krävs |
| contactLeadType | ContactLeadType. | boolean | Krävs |
| logLeadType | LogLeadType. | boolean | Krävs |
| outgoingLeadType | OutgoingLeadType. | boolean | Krävs |

## Response Information

### Resource Description

Hämta info om leads för en kontakt. [CrmContactLead](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmContactLead)

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

- [application/json, text/json](https://connect.maklare.vitec.net#json713)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml713)

```
{
  "contactId": "sample string 1",
  "leads": [
    {
      "id": "sample string 1",
      "createdAt": "2026-10-04T13:51:35.8889895+02:00",
      "leadType": "Object",
      "leadTypeId": "sample string 3"
    },
    {
      "id": "sample string 1",
      "createdAt": "2026-10-04T13:51:35.8889895+02:00",
      "leadType": "Object",
      "leadTypeId": "sample string 3"
    }
  ]
}
```
