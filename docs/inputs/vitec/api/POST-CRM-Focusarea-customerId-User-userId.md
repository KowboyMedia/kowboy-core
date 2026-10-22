<!-- https://connect.maklare.vitec.net/Help/Api/POST-CRM-Focusarea-customerId-User-userId, fetched 2026-10-04 -->

# POST CRM/Focusarea/{customerId}/User/{userId}

Uppdaterar användarens focusområden.

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kundid | string | Krävs |
| userId | AnvändarId | string | Krävs |

## Body Parameters

[FocusArea](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=User_FocusArea)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Areas | Id på område , saknas vid "Egenritade områden" | Collection of [Area](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=User_Area) |  |
| OwnSearchArea | Området som 2d-polygon i WGS84. Returneras enbart för "Egenritade Områden" | [OwnSearchArea](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=User_OwnSearchArea) |  |

### Request Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json558)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml558)

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

## Response Information

### Resource Description

Uppdaterar användarens focusområden.

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input
