<!-- https://connect.maklare.vitec.net/Help/Api/GET-Task-GetTasks, fetched 2026-10-04 -->

# GET Task/GetTasks

Hämtar alla fördefinierade typade uppgifter

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund id | string | Krävs |

## Response Information

### Resource Description

Hämtar alla fördefinierade typade uppgifter Collection of [PredefinedTask](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Task_PredefinedTask)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Id | Uppgifts id | string |  |
| Description | Beskrivning på uppgiften | string |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json291)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml291)

```
[
  {
    "id": "sample string 1",
    "description": "sample string 2"
  },
  {
    "id": "sample string 1",
    "description": "sample string 2"
  }
]
```
