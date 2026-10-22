<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Newsletter-customerId-NewsletterLists, fetched 2026-10-04 -->

# GET CRM/Newsletter/{customerId}/NewsletterLists

Hämtar en lista med alla nyhetsbrevslistor

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kundid | string | Krävs |

## Response Information

### Resource Description

Hämtar en lista med alla nyhetsbrevslistor Collection of [NewsletterList](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Newsletter_NewsletterList)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Id | Id | string |  |
| Name | Namn på listan | string |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json117)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml117)

```
[
  {
    "id": "sample string 1",
    "name": "sample string 2"
  },
  {
    "id": "sample string 1",
    "name": "sample string 2"
  }
]
```
