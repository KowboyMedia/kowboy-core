<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Officegroups-customerId, fetched 2026-10-04 -->

# GET CRM/Officegroups/{customerId}

Hämta kontorsgrupper

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kundid | string | Krävs |

## Response Information

### Resource Description

Hämta kontorsgrupper Collection of [OfficeGroup](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=CRM_OfficeGroup)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Id | Kontorsgruppid | string |  |
| Name | Namn | string |  |
| Offices | Användare | Collection of [Office](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=CRM_Office) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json306)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml306)

```
[
  {
    "id": "sample string 1",
    "name": "sample string 2",
    "offices": [
      {
        "id": "sample string 1"
      },
      {
        "id": "sample string 1"
      }
    ]
  },
  {
    "id": "sample string 1",
    "name": "sample string 2",
    "offices": [
      {
        "id": "sample string 1"
      },
      {
        "id": "sample string 1"
      }
    ]
  }
]
```
