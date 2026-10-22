<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Office-customerId-id-FocusAreas, fetched 2026-10-04 -->

# GET CRM/Office/{customerId}/{id}/FocusAreas

Hämta fokusområden för huvudkontor

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id | string | Krävs |
| id | Gruppid/KundId/Kontorsid/Kontorsgruppsid | string | Krävs |

## Response Information

### Resource Description

Hämta fokusområden för huvudkontor Collection of [FocusArea](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=FocusArea_FocusArea)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Id | Id på område , saknas vid "Egenritade områden" | string |  |
| Polygons | Området som 2d-polygon i WGS84. Returneras enbart för "Egenritade Områden" | Collection of [Polygon](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_Polygon) |  |
| Name | Områdesnamn | string |  |
| CustomerId | Kundid | string |  |
| OfficeId | Kontorsid | string |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json807)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml807)

```
[
  {
    "id": "sample string 1",
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
    ],
    "name": "sample string 2",
    "customerId": "sample string 3",
    "officeId": "sample string 4"
  },
  {
    "id": "sample string 1",
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
    ],
    "name": "sample string 2",
    "customerId": "sample string 3",
    "officeId": "sample string 4"
  }
]
```
