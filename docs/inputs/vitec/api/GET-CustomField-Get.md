<!-- https://connect.maklare.vitec.net/Help/Api/GET-CustomField-Get, fetched 2026-10-04 -->

# GET CustomField/Get

Hämtar egendefinerade fält.

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund id | string | Krävs |

## Response Information

### Resource Description

Hämtar egendefinerade fält. Collection of [CustomFields](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=CustomField_CustomFields)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| CustomerId | Kund id | string |  |
| Fields | Lista av egendefinerade fält. | Collection of [Field](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=CustomField_Field) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json465)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml465)

```
[
  {
    "customerId": "sample string 1",
    "fields": [
      {
        "label": "sample string 1",
        "name": "sample string 2",
        "type": "sample string 3",
        "validFor": [
          "House",
          "House"
        ]
      },
      {
        "label": "sample string 1",
        "name": "sample string 2",
        "type": "sample string 3",
        "validFor": [
          "House",
          "House"
        ]
      }
    ]
  },
  {
    "customerId": "sample string 1",
    "fields": [
      {
        "label": "sample string 1",
        "name": "sample string 2",
        "type": "sample string 3",
        "validFor": [
          "House",
          "House"
        ]
      },
      {
        "label": "sample string 1",
        "name": "sample string 2",
        "type": "sample string 3",
        "validFor": [
          "House",
          "House"
        ]
      }
    ]
  }
]
```
