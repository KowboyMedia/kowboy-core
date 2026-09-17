<!-- https://connect.maklare.vitec.net/Help/Api/GET-Advertising-Project-customerId-projectId, fetched 2026-09-16 -->

# GET Advertising/Project/{customerId}/{projectId}

Hämta projekt för hemsida.

[Extend API är tillgängligt](https://connect.maklare.vitec.net/Help/TermExtend)

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id | string | Krävs |
| projectId | projektid | string | Krävs |
| extend | Utöka hämtningen, "extensions" i svaret. | string |  |

## Response Information

### Resource Description

Hämta projekt för hemsida.

[Extend API är tillgängligt](https://connect.maklare.vitec.net/Help/TermExtend)

[AdvertisingProject](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingProject)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Id | Projektets id | string |  |
| Name | Name of project | string |  |
| Status | Status på projektet. | [AdvertisingProjectStatus](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingProjectStatus) |  |
| Office | Kontor | [AdvertisingOfficeReference](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingOfficeReference) |  |
| PrimaryAgentId | Id på huvudhandläggare | string |  |
| SecondaryAgentId | Id på andrahandläggare | string |  |
| Address | Adress och geografiska uppgifter | [AdvertisingProjectAddress](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingProjectAddress) |  |
| Surroundings | Närområde | [AdvertisingSurroundings](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingSurroundings) |  |
| ChangedAt | När projektet senast ändrades | date |  |
| Files | Filer | Collection of [AdvertisingFile](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingFile) |  |
| Viewings | Visningar | Collection of [AdvertisingViewing](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingViewing) |  |
| Images | Bilder | Collection of [AdvertisingImage](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingImage) |  |
| Links | Länkar | Collection of [AdvertisingLink](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingLink) |  |
| Marketing | Marknadsföring | [AdvertisingMarketing](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingMarketing) |  |
| Extensions | Utöka hämtningen via inparametrar | [AdvertisingProjectExtensions](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingProjectExtensions) |  |
| Currency | Valutan för alla avgifter, priser etc. | string |  |
| Estates | Uppgifter om bostäderna i projektet | [AdvertisingProjectEstates](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingProjectEstates) |  |
| Sale | Uppgifter kring försäljningen av bostäderna i projektet | [AdvertisingProjectSale](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingProjectSale) |  |
| Producer | Producent | [AdvertisingProjectProducer](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingProjectProducer) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json590)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml590)

```
{
  "id": "sample string 1",
  "name": "sample string 2",
  "status": {
    "id": "sample string 1",
    "name": "sample string 2"
  },
  "office": {
    "id": "sample string 1",
    "customerId": "sample string 2"
  },
  "primaryAgentId": "sample string 3",
  "secondaryAgentId": "sample string 4",
  "address": {
    "streetAddress": "sample string 1",
    "zipCode": {
      "numerical": 1,
      "value": "sample string 1"
    },
    "postalTown": "sample string 2",
    "area": {
      "id": "sample string 1",
      "name": "sample string 2"
    },
    "municipality": "sample string 3",
    "countryCode": "sample string 4",
    "countyMunicipalityCode": "sample string 5",
    "wgs84Coordinate": {
      "longitude": 1.1,
      "latitude": 2.1
    },
    "directions": "sample string 6"
  },
  "surroundings": {
    "service": "sample string 1",
    "communication": "sample string 2",
    "area": "sample string 3",
    "parking": "sample string 4",
    "other": "sample string 5"
  },
  "changedAt": "2026-09-16T05:56:30.5443577+02:00",
  "files": [
    {
      "id": "sample string 1",
      "name": "sample string 2",
      "extension": "sample string 3",
      "dataChangedAt": "2026-09-16T05:56:30.5443577+02:00"
    },
    {
      "id": "sample string 1",
      "name": "sample string 2",
      "extension": "sample string 3",
      "dataChangedAt": "2026-09-16T05:56:30.5443577+02:00"
    }
  ],
  "viewings": [
    {
      "id": "sample string 1",
      "startsAt": "2026-09-16T05:56:30.5443577+02:00",
      "endsAt": "2026-09-16T05:56:30.5443577+02:00",
      "comment": "sample string 4",
      "isDigital": true,
      "isSelfRegistrationEnabled": true,
      "isProjectViewing": true
    },
    {
      "id": "sample string 1",
      "startsAt": "2026-09-16T05:56:30.5443577+02:00",
      "endsAt": "2026-09-16T05:56:30.5443577+02:00",
      "comment": "sample string 4",
      "isDigital": true,
      "isSelfRegistrationEnabled": true,
      "isProjectViewing": true
    }
  ],
  "images": [
    {
      "id": "sample string 1",
      "dataChangedAt": "2026-09-16T05:56:30.5443577+02:00",
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
      "dataChangedAt": "2026-09-16T05:56:30.5443577+02:00",
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
  ],
  "links": [
    {
      "name": "sample string 1",
      "category": {
        "id": "sample string 1",
        "name": "sample string 2"
      },
      "url": "sample string 2"
    },
    {
      "name": "sample string 1",
      "category": {
        "id": "sample string 1",
        "name": "sample string 2"
      },
      "url": "sample string 2"
    }
  ],
  "marketing": {
    "isPublished": true,
    "isPreview": true,
    "publishedAt": "2026-09-16T05:56:30.5443577+02:00",
    "isNewHome": true,
    "viewing": {
      "visibleLimit": 1,
      "emptyText": "sample string 1"
    }
  },
  "extensions": {
    "primaryAgent": {
      "id": "sample string 1",
      "name": "sample string 2",
      "title": "sample string 3",
      "category": "sample string 4",
      "emailAddress": "sample string 5",
      "description": "sample string 6",
      "spokenLanguages": [
        "sample string 1",
        "sample string 2"
      ],
      "changedAt": "2026-09-16T05:56:30.5443577+02:00",
      "telephone": {
        "cell": {
          "msisdn": "sample string 1",
          "display": "sample string 2"
        },
        "public": {
          "msisdn": "sample string 1",
          "display": "sample string 2"
        }
      },
      "image": {
        "id": "sample string 1",
        "dataChangedAt": "2026-09-16T05:56:30.5443577+02:00",
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
      "isVisibleInStaffList": true,
      "offices": [
        {
          "id": "sample string 1",
          "customerId": "sample string 2",
          "orderNumber": 3,
          "isVisibleInStaffList": true,
          "telephone": {
            "personal": {
              "msisdn": "sample string 1",
              "display": "sample string 2"
            }
          }
        },
        {
          "id": "sample string 1",
          "customerId": "sample string 2",
          "orderNumber": 3,
          "isVisibleInStaffList": true,
          "telephone": {
            "personal": {
              "msisdn": "sample string 1",
              "display": "sample string 2"
            }
          }
        }
      ],
      "reviews": [
        {
          "text": "sample string 1",
          "authorName": "sample string 2"
        },
        {
          "text": "sample string 1",
          "authorName": "sample string 2"
        }
      ]
    },
    "secondaryAgent": {
      "id": "sample string 1",
      "name": "sample string 2",
      "title": "sample string 3",
      "category": "sample string 4",
      "emailAddress": "sample string 5",
      "description": "sample string 6",
      "spokenLanguages": [
        "sample string 1",
        "sample string 2"
      ],
      "changedAt": "2026-09-16T05:56:30.5443577+02:00",
      "telephone": {
        "cell": {
          "msisdn": "sample string 1",
          "display": "sample string 2"
        },
        "public": {
          "msisdn": "sample string 1",
          "display": "sample string 2"
        }
      },
      "image": {
        "id": "sample string 1",
        "dataChangedAt": "2026-09-16T05:56:30.5443577+02:00",
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
      "isVisibleInStaffList": true,
      "offices": [
        {
          "id": "sample string 1",
          "customerId": "sample string 2",
          "orderNumber": 3,
          "isVisibleInStaffList": true,
          "telephone": {
            "personal": {
              "msisdn": "sample string 1",
              "display": "sample string 2"
            }
          }
        },
        {
          "id": "sample string 1",
          "customerId": "sample string 2",
          "orderNumber": 3,
          "isVisibleInStaffList": true,
          "telephone": {
            "personal": {
              "msisdn": "sample string 1",
              "display": "sample string 2"
            }
          }
        }
      ],
      "reviews": [
        {
          "text": "sample string 1",
          "authorName": "sample string 2"
        },
        {
          "text": "sample string 1",
          "authorName": "sample string 2"
        }
      ]
    }
  },
  "currency": "sample string 6",
  "estates": {
    "price": {
      "maxValue": 1,
      "minValue": 1
    },
    "monthlyFee": {
      "maxValue": 1,
      "minValue": 1
    },
    "livingSpace": {
      "maxValue": 1.1,
      "minValue": 1.1
    },
    "numberOfRooms": {
      "maxValue": 1.1,
      "minValue": 1.1
    },
    "plot": {
      "maxValue": 1.1,
      "minValue": 1.1
    }
  },
  "sale": {
    "shortDescription": "sample string 1",
    "description": "sample string 2",
    "phrase": "sample string 3",
    "heading": "sample string 4",
    "otherInformation": "sample string 5",
    "startsAt": "2026-09-16T05:56:30.5443577+02:00",
    "possessionEstimation": "sample string 6"
  },
  "producer": {
    "name": "sample string 1"
  }
}
```
