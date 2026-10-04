<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-contactId-Relations, fetched 2026-10-04 -->

# GET CRM/Contact/{customerId}/{contactId}/Relations

Lista med företag där kontakten är firmatecknare eller kontaktperson och/eller dödsbon där kontakten är dödsbodelägare. Ersätts med GET CRM/Contact/{customerId}/{contactId}/ContactRelations

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kundid | string | Krävs |
| contactId | Kontaktid | string | Krävs |

## Response Information

### Resource Description

Lista med företag där kontakten är firmatecknare eller kontaktperson och/eller dödsbon där kontakten är dödsbodelägare Collection of [Relation](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_Relation)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Id | Id | string |  |
| Name | Namn | string |  |
| Type | Typ av relation | [RelatedContactType](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_RelatedContactType) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json698)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml698)

```
[
  {
    "id": "sample string 1",
    "name": "sample string 2",
    "type": "Unknown"
  },
  {
    "id": "sample string 1",
    "name": "sample string 2",
    "type": "Unknown"
  }
]
```
