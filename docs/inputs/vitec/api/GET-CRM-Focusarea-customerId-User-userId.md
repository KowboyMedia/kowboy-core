<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Focusarea-customerId-User-userId, fetched 2026-10-04 -->

# GET CRM/Focusarea/{customerId}/User/{userId}

Hämtar användarens focusområden.

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kundid | string | Krävs |
| userId | AnvändarId | string | Krävs |

## Response Information

### Resource Description

Hämtar användarens focusområden. [FocusArea](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=User_FocusArea)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Areas | Id på område , saknas vid "Egenritade områden" | Collection of [Area](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=User_Area) |  |
| OwnSearchArea | Området som 2d-polygon i WGS84. Returneras enbart för "Egenritade Områden" | [OwnSearchArea](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=User_OwnSearchArea) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json323)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml323)

```
{
  "areas": [
    {
      "id": "sample string 1",
      "dispencer": true
    },
    {
      "id": "sample string 1",
      "dispencer": true
    }
  ],
  "ownSearchArea": {
    "dispencer": true,
    "polygons": [
      {
        "coordinates": [
          {
            "longitud": 1.1,
            "latitud": 2.1
          },
          {
            "longitud": 1.1,
            "latitud": 2.1
          }
        ]
      },
      {
        "coordinates": [
          {
            "longitud": 1.1,
            "latitud": 2.1
          },
          {
            "longitud": 1.1,
            "latitud": 2.1
          }
        ]
      }
    ]
  }
}
```
