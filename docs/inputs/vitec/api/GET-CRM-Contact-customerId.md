<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId, fetched 2026-10-04 -->

# GET CRM/Contact/{customerId}

Hämta lista av kontakter som matchar ett kriterie.

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id. | string | Krävs |
| AgentId | Urval på användareid | string |  |
| CreatedAtFrom | Skapad från och med | date |  |
| CreatedAtTo | Skapad till och med | date |  |
| ChangedAtFrom | Ändrad från och med | date |  |
| ChangedAtTo | Ändrad till och med | date |  |
| CustomFieldName | Egendefinerat fältnamn | string |  |
| CustomFieldValue | Egendefinerat fältvärde | string |  |
| LeadScore | Antal lead score stjärnor | integer |  |
| ContactScheduledOrderType | Typ av aktiv tjänst på kontakten | [ContactScheduledOrderType](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=ContactScheduledOrder_ContactScheduledOrderType) |  |
| NewsletterListId | Nyhetsbrevslista kontakten tillhör | string |  |

## Response Information

### Resource Description

Hämta lista av kontakter som matchar ett kriterie. [CrmContactList](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmContactList)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Persons | Personer som matchats | Collection of [CrmContactReference](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmContactReference) |  |
| Companies | Företag som matchats | Collection of [CrmContactReference](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmContactReference) |  |
| DeceasedEstates | Dödsbon som matchats | Collection of [CrmContactReference](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmContactReference) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json244)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml244)

```
{
  "persons": [
    {
      "id": "sample string 1",
      "changedAt": "2026-10-04T10:38:07.9668184+02:00",
      "customerId": "sample string 3"
    },
    {
      "id": "sample string 1",
      "changedAt": "2026-10-04T10:38:07.9668184+02:00",
      "customerId": "sample string 3"
    }
  ],
  "companies": [
    {
      "id": "sample string 1",
      "changedAt": "2026-10-04T10:38:07.9668184+02:00",
      "customerId": "sample string 3"
    },
    {
      "id": "sample string 1",
      "changedAt": "2026-10-04T10:38:07.9668184+02:00",
      "customerId": "sample string 3"
    }
  ],
  "deceasedEstates": [
    {
      "id": "sample string 1",
      "changedAt": "2026-10-04T10:38:07.9668184+02:00",
      "customerId": "sample string 3"
    },
    {
      "id": "sample string 1",
      "changedAt": "2026-10-04T10:38:07.9668184+02:00",
      "customerId": "sample string 3"
    }
  ]
}
```
