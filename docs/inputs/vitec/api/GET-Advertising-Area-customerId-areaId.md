<!-- https://connect.maklare.vitec.net/Help/Api/GET-Advertising-Area-customerId-areaId, fetched 2026-09-16 -->

# GET Advertising/Area/{customerId}/{areaId}

Hämta område för hemsida.

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id | string | Krävs |
| areaId | Områdesid | string | Krävs |

## Response Information

### Resource Description

Hämta område för hemsida.

[AdvertisingArea](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingArea)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Id | Id | string |  |
| Name | Namn | string |  |
| CountyMunicipalityCode | LKF kod | string |  |
| Coordinates | Områdets koordinater i formatet GeoJSON Multipolygon (longitud, latitud) | Collection of Collection of Collection of Collection of decimal number |  |
| ChangedAt | När området senast ändrades | date |  |
| Office | Kontor | [AdvertisingOfficeReference](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingOfficeReference) |  |
| Surroundings | Närområde | [AdvertisingSurroundings](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingSurroundings) |  |
| Images | Bilder | Collection of [AdvertisingImage](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingImage) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json345)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml345)

```
{
  "id": "sample string 1",
  "name": "sample string 2",
  "countyMunicipalityCode": "sample string 3",
  "coordinates": [
    [
      [
        [
          1.1,
          2.1
        ],
        [
          1.1,
          2.1
        ]
      ],
      [
        [
          1.1,
          2.1
        ],
        [
          1.1,
          2.1
        ]
      ]
    ],
    [
      [
        [
          1.1,
          2.1
        ],
        [
          1.1,
          2.1
        ]
      ],
      [
        [
          1.1,
          2.1
        ],
        [
          1.1,
          2.1
        ]
      ]
    ]
  ],
  "changedAt": "2026-09-16T06:05:09.3300605+02:00",
  "office": {
    "id": "sample string 1",
    "customerId": "sample string 2"
  },
  "surroundings": {
    "service": "sample string 1",
    "communication": "sample string 2",
    "area": "sample string 3",
    "parking": "sample string 4",
    "other": "sample string 5"
  },
  "images": [
    {
      "id": "sample string 1",
      "dataChangedAt": "2026-09-16T06:05:09.3300605+02:00",
      "description": "sample string 3",
      "name": "sample string 4",
      "category": {
        "id": "sample string 1",
        "name": "sample string 2"
      },
      "extension": "sample string 5",
      "cdnReferences": [
        {
          "name": "sample string 1",
          "url": "sample string 2"
        },
        {
          "name": "sample string 1",
          "url": "sample string 2"
        }
      ]
    },
    {
      "id": "sample string 1",
      "dataChangedAt": "2026-09-16T06:05:09.3300605+02:00",
      "description": "sample string 3",
      "name": "sample string 4",
      "category": {
        "id": "sample string 1",
        "name": "sample string 2"
      },
      "extension": "sample string 5",
      "cdnReferences": [
        {
          "name": "sample string 1",
          "url": "sample string 2"
        },
        {
          "name": "sample string 1",
          "url": "sample string 2"
        }
      ]
    }
  ]
}
```
