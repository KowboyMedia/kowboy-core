<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Newsletter-customerId-NewsletterlistContacts-listId, fetched 2026-10-04 -->

# GET CRM/Newsletter/{customerId}/NewsletterlistContacts/{listId}

Hämtar en lista med kontakter som ingår i en nyhetsbrevslista

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kundid | string | Krävs |
| listId | Id på nyhetsbrevslistan | string | Krävs |

## Response Information

### Resource Description

Hämtar en lista med kontakter som ingår i en nyhetsbrevslista Collection of [NewsletterListContact](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Newsletter_NewsletterListContact)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Id | Id | string |  |
| Name | Kontaktens namn | string |  |
| Email | Kontaktens epost | string |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json432)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml432)

```
[
  {
    "id": "sample string 1",
    "name": "sample string 2",
    "email": "sample string 3"
  },
  {
    "id": "sample string 1",
    "name": "sample string 2",
    "email": "sample string 3"
  }
]
```
