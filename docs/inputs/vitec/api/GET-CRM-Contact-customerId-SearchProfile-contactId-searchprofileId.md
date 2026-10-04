<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-SearchProfile-contactId-searchprofileId, fetched 2026-10-04 -->

# GET CRM/Contact/{customerId}/SearchProfile/{contactId}/{searchprofileId}

Hämtar en kontakts sökprofiler

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kundid | string | Krävs |
| contactId | Kriterie | string | Krävs |
| searchprofileId | Sökprofilens id. Utelämna för att få kontaktens samtliga profiler. | string |  |

## Response Information

### Resource Description

Hämtar en kontakts sökprofiler [SearchProfiles](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=SearchProfileV2_SearchProfiles)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| ResidentialProfiles | Sökprofiler för boende | Collection of [SearchProfileResidential](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=SearchProfileV2_SearchProfileResidential) |  |
| FarmProfiles | Sökprofiler för gårdar | Collection of [SearchProfileFarm](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=SearchProfileV2_SearchProfileFarm) |  |
| CommercialProfiles | Sökprofiler för kommersiella fastigheter | Collection of [SearchProfileCommercial](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=SearchProfileV2_SearchProfileCommercial) |  |
| ForeignProfiles | Sökprofiler för utländska boenden | Collection of [SearchProfileForeign](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=SearchProfileV2_SearchProfileForeign) |  |
| PremiseProfiles | Sökprofiler för lokaler | Collection of [SearchProfilePremises](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=SearchProfileV2_SearchProfilePremises) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json89)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml89)

```
{
  "residentialProfiles": [
    {
      "id": "sample string 1",
      "dateCreated": "2026-10-04T13:53:28.0740523+02:00",
      "validTo": "2026-10-04T13:53:28.0740523+02:00",
      "subtypes": [
        "Apartment",
        "Apartment"
      ],
      "areaIds": [
        "sample string 1",
        "sample string 2"
      ],
      "municipalityCodes": [
        "sample string 1",
        "sample string 2"
      ],
      "newProduction": true,
      "livingSpace": {
        "maxValue": 1,
        "minValue": 1
      },
      "numberOfRooms": {
        "maxValue": 1,
        "minValue": 1
      },
      "bedrooms": 1,
      "plotArea": {
        "maxValue": 1,
        "minValue": 1
      },
      "monthlyFee": 1,
      "isAutomaticProfile": true,
      "price": {
        "maxValue": 1,
        "minValue": 1
      },
      "drawnAreas": [
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
      "drawnAreasName": "sample string 5",
      "increasedRequirementIds": [
        "sample string 1",
        "sample string 2"
      ]
    },
    {
      "id": "sample string 1",
      "dateCreated": "2026-10-04T13:53:28.0740523+02:00",
      "validTo": "2026-10-04T13:53:28.0740523+02:00",
      "subtypes": [
        "Apartment",
        "Apartment"
      ],
      "areaIds": [
        "sample string 1",
        "sample string 2"
      ],
      "municipalityCodes": [
        "sample string 1",
        "sample string 2"
      ],
      "newProduction": true,
      "livingSpace": {
        "maxValue": 1,
        "minValue": 1
      },
      "numberOfRooms": {
        "maxValue": 1,
        "minValue": 1
      },
      "bedrooms": 1,
      "plotArea": {
        "maxValue": 1,
        "minValue": 1
      },
      "monthlyFee": 1,
      "isAutomaticProfile": true,
      "price": {
        "maxValue": 1,
        "minValue": 1
      },
      "drawnAreas": [
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
      "drawnAreasName": "sample string 5",
      "increasedRequirementIds": [
        "sample string 1",
        "sample string 2"
      ]
    }
  ],
  "farmProfiles": [
    {
      "id": "sample string 1",
      "dateCreated": "2026-10-04T13:53:28.0740523+02:00",
      "validTo": "2026-10-04T13:53:28.0740523+02:00",
      "subtypes": [
        "Agriculture",
        "Agriculture"
      ],
      "areaIds": [
        "sample string 1",
        "sample string 2"
      ],
      "municipalityCodes": [
        "sample string 1",
        "sample string 2"
      ],
      "livingSpace": {
        "maxValue": 1,
        "minValue": 1
      },
      "numberOfRooms": {
        "maxValue": 1,
        "minValue": 1
      },
      "bedrooms": 1,
      "plotArea": {
        "maxValue": 1,
        "minValue": 1
      },
      "monthlyFee": 1,
      "isAutomaticProfile": true,
      "price": {
        "maxValue": 1,
        "minValue": 1
      },
      "drawnAreas": [
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
      "drawnAreasName": "sample string 5",
      "increasedRequirementIds": [
        "sample string 1",
        "sample string 2"
      ]
    },
    {
      "id": "sample string 1",
      "dateCreated": "2026-10-04T13:53:28.0740523+02:00",
      "validTo": "2026-10-04T13:53:28.0740523+02:00",
      "subtypes": [
        "Agriculture",
        "Agriculture"
      ],
      "areaIds": [
        "sample string 1",
        "sample string 2"
      ],
      "municipalityCodes": [
        "sample string 1",
        "sample string 2"
      ],
      "livingSpace": {
        "maxValue": 1,
        "minValue": 1
      },
      "numberOfRooms": {
        "maxValue": 1,
        "minValue": 1
      },
      "bedrooms": 1,
      "plotArea": {
        "maxValue": 1,
        "minValue": 1
      },
      "monthlyFee": 1,
      "isAutomaticProfile": true,
      "price": {
        "maxValue": 1,
        "minValue": 1
      },
      "drawnAreas": [
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
      "drawnAreasName": "sample string 5",
      "increasedRequirementIds": [
        "sample string 1",
        "sample string 2"
      ]
    }
  ],
  "commercialProfiles": [
    {
      "id": "sample string 1",
      "dateCreated": "2026-10-04T13:53:28.0740523+02:00",
      "validTo": "2026-10-04T13:53:28.0740523+02:00",
      "plotArea": {
        "maxValue": 1,
        "minValue": 1
      },
      "sumArea": {
        "maxValue": 1,
        "minValue": 1
      },
      "subtypes": [
        "Residential",
        "Residential"
      ],
      "areaIds": [
        "sample string 1",
        "sample string 2"
      ],
      "municipalityCodes": [
        "sample string 1",
        "sample string 2"
      ],
      "isAutomaticProfile": true,
      "price": {
        "maxValue": 1,
        "minValue": 1
      },
      "drawnAreas": [
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
      "drawnAreasName": "sample string 5",
      "increasedRequirementIds": [
        "sample string 1",
        "sample string 2"
      ]
    },
    {
      "id": "sample string 1",
      "dateCreated": "2026-10-04T13:53:28.0740523+02:00",
      "validTo": "2026-10-04T13:53:28.0740523+02:00",
      "plotArea": {
        "maxValue": 1,
        "minValue": 1
      },
      "sumArea": {
        "maxValue": 1,
        "minValue": 1
      },
      "subtypes": [
        "Residential",
        "Residential"
      ],
      "areaIds": [
        "sample string 1",
        "sample string 2"
      ],
      "municipalityCodes": [
        "sample string 1",
        "sample string 2"
      ],
      "isAutomaticProfile": true,
      "price": {
        "maxValue": 1,
        "minValue": 1
      },
      "drawnAreas": [
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
      "drawnAreasName": "sample string 5",
      "increasedRequirementIds": [
        "sample string 1",
        "sample string 2"
      ]
    }
  ],
  "foreignProfiles": [
    {
      "id": "sample string 1",
      "dateCreated": "2026-10-04T13:53:28.0740523+02:00",
      "validTo": "2026-10-04T13:53:28.0740523+02:00",
      "countryCode": "sample string 4",
      "areaIds": [
        "sample string 1",
        "sample string 2"
      ],
      "subtypes": [
        "Apartment",
        "Apartment"
      ],
      "features": [
        "Balcony",
        "Balcony"
      ],
      "shoppingCentreMaxDist": 1,
      "centreMaxDist": 1,
      "airportMaxDist": 1,
      "golfCourceMaxDist": 1,
      "seaMaxDist": 1,
      "supermarketMaxDist": 1,
      "poolMaxDist": 1,
      "hospitalMaxDist": 1,
      "beachMaxDist": 1,
      "livingSpace": {
        "maxValue": 1,
        "minValue": 1
      },
      "numberOfRooms": {
        "maxValue": 1,
        "minValue": 1
      },
      "bedrooms": 1,
      "plotArea": {
        "maxValue": 1,
        "minValue": 1
      },
      "monthlyFee": 1,
      "isAutomaticProfile": true,
      "price": {
        "maxValue": 1,
        "minValue": 1
      },
      "drawnAreas": [
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
      "drawnAreasName": "sample string 6",
      "increasedRequirementIds": [
        "sample string 1",
        "sample string 2"
      ]
    },
    {
      "id": "sample string 1",
      "dateCreated": "2026-10-04T13:53:28.0740523+02:00",
      "validTo": "2026-10-04T13:53:28.0740523+02:00",
      "countryCode": "sample string 4",
      "areaIds": [
        "sample string 1",
        "sample string 2"
      ],
      "subtypes": [
        "Apartment",
        "Apartment"
      ],
      "features": [
        "Balcony",
        "Balcony"
      ],
      "shoppingCentreMaxDist": 1,
      "centreMaxDist": 1,
      "airportMaxDist": 1,
      "golfCourceMaxDist": 1,
      "seaMaxDist": 1,
      "supermarketMaxDist": 1,
      "poolMaxDist": 1,
      "hospitalMaxDist": 1,
      "beachMaxDist": 1,
      "livingSpace": {
        "maxValue": 1,
        "minValue": 1
      },
      "numberOfRooms": {
        "maxValue": 1,
        "minValue": 1
      },
      "bedrooms": 1,
      "plotArea": {
        "maxValue": 1,
        "minValue": 1
      },
      "monthlyFee": 1,
      "isAutomaticProfile": true,
      "price": {
        "maxValue": 1,
        "minValue": 1
      },
      "drawnAreas": [
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
      "drawnAreasName": "sample string 6",
      "increasedRequirementIds": [
        "sample string 1",
        "sample string 2"
      ]
    }
  ],
  "premiseProfiles": [
    {
      "id": "sample string 1",
      "dateCreated": "2026-10-04T13:53:28.0740523+02:00",
      "validTo": "2026-10-04T13:53:28.0740523+02:00",
      "sumArea": {
        "maxValue": 1,
        "minValue": 1
      },
      "subtypes": [
        "Retail",
        "Retail"
      ],
      "areaIds": [
        "sample string 1",
        "sample string 2"
      ],
      "municipalityCodes": [
        "sample string 1",
        "sample string 2"
      ],
      "isAutomaticProfile": true,
      "price": {
        "maxValue": 1,
        "minValue": 1
      },
      "drawnAreas": [
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
      "drawnAreasName": "sample string 5",
      "increasedRequirementIds": [
        "sample string 1",
        "sample string 2"
      ]
    },
    {
      "id": "sample string 1",
      "dateCreated": "2026-10-04T13:53:28.0740523+02:00",
      "validTo": "2026-10-04T13:53:28.0740523+02:00",
      "sumArea": {
        "maxValue": 1,
        "minValue": 1
      },
      "subtypes": [
        "Retail",
        "Retail"
      ],
      "areaIds": [
        "sample string 1",
        "sample string 2"
      ],
      "municipalityCodes": [
        "sample string 1",
        "sample string 2"
      ],
      "isAutomaticProfile": true,
      "price": {
        "maxValue": 1,
        "minValue": 1
      },
      "drawnAreas": [
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
      "drawnAreasName": "sample string 5",
      "increasedRequirementIds": [
        "sample string 1",
        "sample string 2"
      ]
    }
  ]
}
```
