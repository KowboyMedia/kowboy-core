<!-- https://connect.maklare.vitec.net/Help/Api/GET-Advertising-Estate-customerId-estateId, fetched 2026-10-04 -->

# GET Advertising/Estate/{customerId}/{estateId}

Hämta bostad för hemsida.

[Extend API är tillgängligt](https://connect.maklare.vitec.net/Help/TermExtend)

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id | string | Krävs |
| estateId | Bostadsid | string | Krävs |
| extend | Utöka hämtningen, "extensions" i svaret. | string |  |

## Response Information

### Resource Description

Hämta bostad för hemsida.

[Extend API är tillgängligt](https://connect.maklare.vitec.net/Help/TermExtend)

[AdvertisingEstate](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingEstate)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Id | Bostadens id | string |  |
| ReferenceId | Objektnummer | string |  |
| Status | Status på försäljningen/uthyrningen. | [AdvertisingSaleStatus](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingSaleStatus) |  |
| Office | Kontorstillhörighet | [AdvertisingOfficeReference](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingOfficeReference) |  |
| PrimaryAgentId | Id på huvudhandläggare | string |  |
| SecondaryAgentId | Id på andrahandläggare | string |  |
| ProjectId | Projektid om bostaden ingår i ett projekt | string |  |
| Address | Adress och geografiska uppgifter | [AdvertisingAddress](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingAddress) |  |
| Sale | Försäljningen | [AdvertisingSale](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingSale) |  |
| Surroundings | Närområde | [AdvertisingSurroundings](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingSurroundings) |  |
| ChangedAt | När bostaden senast ändrades | date |  |
| Files | Filer | Collection of [AdvertisingFile](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingFile) |  |
| Viewings | Visningar | Collection of [AdvertisingViewing](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingViewing) |  |
| Images | Bilder | Collection of [AdvertisingImage](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingImage) |  |
| Links | Länkar | Collection of [AdvertisingLink](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingLink) |  |
| Type | Typ | [AdvertisingType](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingType) |  |
| Subtype | Sökbegrepp | [AdvertisingSubType](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingSubType) |  |
| Tenure | Upplåtelseform | [AdvertisingTenure](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingTenure) |  |
| Tags | Taggningar (T ex VIP, Exklusiv) | Collection of [AdvertisingEstateTag](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingEstateTag) |  |
| Buildings | Byggnader | Collection of [AdvertisingBuilding](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingBuilding) |  |
| Exterior | Exteriör | [AdvertisingExterior](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingExterior) |  |
| Taxation | Taxeringsvärden | [AdvertisingTaxation](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingTaxation) |  |
| Fees | Utgifter | [AdvertisingFees](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingFees) |  |
| Price | Prisuppgift | [AdvertisingPrice](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingPrice) |  |
| Electricity | Elektricitet | [AdvertisingElectricity](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingElectricity) |  |
| Bidding | Budgivning | [AdvertisingBidding](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingBidding) |  |
| Marketing | Marknadsföring | [AdvertisingMarketing](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingMarketing) |  |
| Pledges | Pantbrev | Collection of [AdvertisingPledge](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingPledge) |  |
| Enrollments | Inskrivningar | [AdvertisingEnrollments](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingEnrollments) |  |
| Extensions | Utöka hämtningen via inparametrar | [AdvertisingEstateExtensions](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingEstateExtensions) |  |
| Currency | Valutan för alla avgifter, priser etc. | string |  |
| Inspection | Besiktning | [AdvertisingEstateInspection](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingEstateInspection) |  |
| Expenses | Utgifter | [AdvertisingEstateExpenses](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingEstateExpenses) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json791)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml791)

```
{
  "id": "sample string 1",
  "referenceId": "sample string 2",
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
  "projectId": "sample string 5",
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
  "sale": {
    "shortDescription": "sample string 1",
    "description": "sample string 2",
    "phrase": "sample string 3",
    "heading": "sample string 4",
    "otherInformation": "sample string 5",
    "possessionEstimation": "sample string 6",
    "possessionAt": "2026-10-04T10:31:59.8869445+02:00",
    "contractDate": "2026-10-04T10:31:59.8869445+02:00",
    "assignmentDate": "2026-10-04T10:31:59.8869445+02:00"
  },
  "surroundings": {
    "service": "sample string 1",
    "communication": "sample string 2",
    "area": "sample string 3",
    "parking": "sample string 4",
    "other": "sample string 5"
  },
  "changedAt": "2026-10-04T10:31:59.8869445+02:00",
  "files": [
    {
      "id": "sample string 1",
      "name": "sample string 2",
      "extension": "sample string 3",
      "dataChangedAt": "2026-10-04T10:31:59.8869445+02:00"
    },
    {
      "id": "sample string 1",
      "name": "sample string 2",
      "extension": "sample string 3",
      "dataChangedAt": "2026-10-04T10:31:59.8869445+02:00"
    }
  ],
  "viewings": [
    {
      "id": "sample string 1",
      "startsAt": "2026-10-04T10:31:59.8869445+02:00",
      "endsAt": "2026-10-04T10:31:59.8869445+02:00",
      "comment": "sample string 4",
      "isDigital": true,
      "isSelfRegistrationEnabled": true,
      "isProjectViewing": true
    },
    {
      "id": "sample string 1",
      "startsAt": "2026-10-04T10:31:59.8869445+02:00",
      "endsAt": "2026-10-04T10:31:59.8869445+02:00",
      "comment": "sample string 4",
      "isDigital": true,
      "isSelfRegistrationEnabled": true,
      "isProjectViewing": true
    }
  ],
  "images": [
    {
      "id": "sample string 1",
      "dataChangedAt": "2026-10-04T10:31:59.8869445+02:00",
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
      "dataChangedAt": "2026-10-04T10:31:59.8869445+02:00",
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
  "type": {
    "id": "sample string 1",
    "name": "sample string 2"
  },
  "subtype": {
    "id": "sample string 1",
    "name": "sample string 2"
  },
  "tenure": {
    "id": "sample string 1",
    "name": "sample string 2"
  },
  "tags": [
    {
      "type": {
        "id": "sample string 1",
        "name": "sample string 2"
      },
      "names": [
        "sample string 1",
        "sample string 2"
      ]
    },
    {
      "type": {
        "id": "sample string 1",
        "name": "sample string 2"
      },
      "names": [
        "sample string 1",
        "sample string 2"
      ]
    }
  ],
  "buildings": [
    {
      "name": "sample string 1",
      "type": "sample string 2",
      "numberOfRooms": 1.1,
      "bedrooms": {
        "count": 1.1,
        "max": 1.1
      },
      "numberOfBathRooms": 1.1,
      "description": "sample string 3",
      "interior": "sample string 4",
      "otherInformation": "sample string 5",
      "yearBuilt": {
        "numeric": 1,
        "text": "sample string 1",
        "description": "sample string 2"
      },
      "ventilation": {
        "type": "sample string 1",
        "inspection": "sample string 2"
      },
      "architecture": [
        {
          "type": {
            "id": "sample string 1",
            "name": "sample string 2"
          },
          "description": "sample string 1"
        },
        {
          "type": {
            "id": "sample string 1",
            "name": "sample string 2"
          },
          "description": "sample string 1"
        }
      ],
      "renovation": {
        "description": "sample string 1"
      },
      "elevator": {
        "description": "sample string 1",
        "isAvailable": true
      },
      "floor": {
        "number": 1.1,
        "total": 1.1,
        "description": "sample string 1"
      },
      "services": [
        {
          "type": {
            "id": "sample string 1",
            "name": "sample string 2"
          },
          "description": "sample string 1"
        },
        {
          "type": {
            "id": "sample string 1",
            "name": "sample string 2"
          },
          "description": "sample string 1"
        }
      ],
      "rooms": [
        {
          "name": "sample string 1",
          "description": "sample string 2"
        },
        {
          "name": "sample string 1",
          "description": "sample string 2"
        }
      ],
      "energyDeclaration": {
        "consumption": 1.1,
        "class": "sample string 1",
        "status": {
          "id": "sample string 1",
          "name": "sample string 2"
        },
        "performedAt": "2026-10-04T10:31:59.8869445+02:00"
      },
      "plot": {
        "description": "sample string 1"
      },
      "exterior": [
        {
          "type": {
            "id": "sample string 1",
            "name": "sample string 2"
          },
          "isAvailable": true,
          "size": 1.1,
          "description": "sample string 1"
        },
        {
          "type": {
            "id": "sample string 1",
            "name": "sample string 2"
          },
          "isAvailable": true,
          "size": 1.1,
          "description": "sample string 1"
        }
      ],
      "expenses": {
        "operation": {
          "sum": 1.1,
          "householdSize": 1,
          "entries": [
            {
              "type": {
                "id": "sample string 1",
                "name": "sample string 2"
              },
              "value": 1.1
            },
            {
              "type": {
                "id": "sample string 1",
                "name": "sample string 2"
              },
              "value": 1.1
            }
          ],
          "description": "sample string 1"
        }
      },
      "area": {
        "grossFloor": 1.1,
        "living": 1.1,
        "building": 1.1,
        "description": "sample string 1",
        "source": "sample string 2"
      },
      "electricity": {
        "company": "sample string 1",
        "distributor": "sample string 2",
        "consumption": 1.1
      },
      "compiledRoomList": "sample string 6"
    },
    {
      "name": "sample string 1",
      "type": "sample string 2",
      "numberOfRooms": 1.1,
      "bedrooms": {
        "count": 1.1,
        "max": 1.1
      },
      "numberOfBathRooms": 1.1,
      "description": "sample string 3",
      "interior": "sample string 4",
      "otherInformation": "sample string 5",
      "yearBuilt": {
        "numeric": 1,
        "text": "sample string 1",
        "description": "sample string 2"
      },
      "ventilation": {
        "type": "sample string 1",
        "inspection": "sample string 2"
      },
      "architecture": [
        {
          "type": {
            "id": "sample string 1",
            "name": "sample string 2"
          },
          "description": "sample string 1"
        },
        {
          "type": {
            "id": "sample string 1",
            "name": "sample string 2"
          },
          "description": "sample string 1"
        }
      ],
      "renovation": {
        "description": "sample string 1"
      },
      "elevator": {
        "description": "sample string 1",
        "isAvailable": true
      },
      "floor": {
        "number": 1.1,
        "total": 1.1,
        "description": "sample string 1"
      },
      "services": [
        {
          "type": {
            "id": "sample string 1",
            "name": "sample string 2"
          },
          "description": "sample string 1"
        },
        {
          "type": {
            "id": "sample string 1",
            "name": "sample string 2"
          },
          "description": "sample string 1"
        }
      ],
      "rooms": [
        {
          "name": "sample string 1",
          "description": "sample string 2"
        },
        {
          "name": "sample string 1",
          "description": "sample string 2"
        }
      ],
      "energyDeclaration": {
        "consumption": 1.1,
        "class": "sample string 1",
        "status": {
          "id": "sample string 1",
          "name": "sample string 2"
        },
        "performedAt": "2026-10-04T10:31:59.8869445+02:00"
      },
      "plot": {
        "description": "sample string 1"
      },
      "exterior": [
        {
          "type": {
            "id": "sample string 1",
            "name": "sample string 2"
          },
          "isAvailable": true,
          "size": 1.1,
          "description": "sample string 1"
        },
        {
          "type": {
            "id": "sample string 1",
            "name": "sample string 2"
          },
          "isAvailable": true,
          "size": 1.1,
          "description": "sample string 1"
        }
      ],
      "expenses": {
        "operation": {
          "sum": 1.1,
          "householdSize": 1,
          "entries": [
            {
              "type": {
                "id": "sample string 1",
                "name": "sample string 2"
              },
              "value": 1.1
            },
            {
              "type": {
                "id": "sample string 1",
                "name": "sample string 2"
              },
              "value": 1.1
            }
          ],
          "description": "sample string 1"
        }
      },
      "area": {
        "grossFloor": 1.1,
        "living": 1.1,
        "building": 1.1,
        "description": "sample string 1",
        "source": "sample string 2"
      },
      "electricity": {
        "company": "sample string 1",
        "distributor": "sample string 2",
        "consumption": 1.1
      },
      "compiledRoomList": "sample string 6"
    }
  ],
  "exterior": {
    "buildingsDescription": "sample string 1",
    "buildingPermission": "sample string 2",
    "entries": [
      {
        "type": {
          "id": "sample string 1",
          "name": "sample string 2"
        },
        "isAvailable": true,
        "size": 1.1,
        "description": "sample string 1"
      },
      {
        "type": {
          "id": "sample string 1",
          "name": "sample string 2"
        },
        "isAvailable": true,
        "size": 1.1,
        "description": "sample string 1"
      }
    ],
    "plot": {
      "size": 1.1,
      "description": "sample string 1",
      "type": "sample string 2"
    }
  },
  "taxation": {
    "isPreliminary": true,
    "propertyDesignations": [
      "sample string 1",
      "sample string 2"
    ],
    "buildingValue": 1.1,
    "landValue": 1.1,
    "totalValue": 1.1,
    "taxFee": 1.1,
    "units": [
      {
        "code": {
          "id": "sample string 1",
          "name": "sample string 2"
        },
        "taxFee": 1.1,
        "year": 1,
        "description": "sample string 1",
        "valuationUnits": [
          {
            "unit": {
              "id": "sample string 1",
              "name": "sample string 2"
            },
            "value": 1.1,
            "year": 1
          },
          {
            "unit": {
              "id": "sample string 1",
              "name": "sample string 2"
            },
            "value": 1.1,
            "year": 1
          }
        ]
      },
      {
        "code": {
          "id": "sample string 1",
          "name": "sample string 2"
        },
        "taxFee": 1.1,
        "year": 1,
        "description": "sample string 1",
        "valuationUnits": [
          {
            "unit": {
              "id": "sample string 1",
              "name": "sample string 2"
            },
            "value": 1.1,
            "year": 1
          },
          {
            "unit": {
              "id": "sample string 1",
              "name": "sample string 2"
            },
            "value": 1.1,
            "year": 1
          }
        ]
      }
    ]
  },
  "fees": {
    "recurring": {
      "value": 1.1,
      "frequency": "Monthly",
      "type": "sample string 2",
      "description": "sample string 3"
    },
    "leasehold": {
      "fee": 1.1,
      "term": "2026-10-04T10:31:59.8869445+02:00"
    },
    "lease": {
      "fee": 1.1,
      "description": "sample string 1",
      "term": "2026-10-04T10:31:59.8869445+02:00",
      "owner": {
        "name": "sample string 1"
      }
    }
  },
  "price": {
    "startingPrice": 1.1,
    "finalPrice": 1.1,
    "startingPriceInOtherCurrency": {
      "value": 1.1,
      "currency": "sample string 2"
    },
    "text": "sample string 1"
  },
  "electricity": {
    "company": "sample string 1",
    "distributor": "sample string 2",
    "consumption": 1.1
  },
  "bidding": {
    "isActive": true,
    "isVerified": true,
    "bids": [
      {
        "placedAt": "2026-10-04T10:31:59.8869445+02:00",
        "amount": 2,
        "isCanceled": true,
        "alias": "sample string 4"
      },
      {
        "placedAt": "2026-10-04T10:31:59.8869445+02:00",
        "amount": 2,
        "isCanceled": true,
        "alias": "sample string 4"
      }
    ]
  },
  "marketing": {
    "isPublished": true,
    "isPreview": true,
    "publishedAt": "2026-10-04T10:31:59.8869445+02:00",
    "isNewHome": true,
    "viewing": {
      "visibleLimit": 1,
      "emptyText": "sample string 1"
    }
  },
  "pledges": [
    {
      "amount": 1.1
    },
    {
      "amount": 1.1
    }
  ],
  "enrollments": {
    "planRegulations": "sample string 1",
    "preferentialAndCommunity": "sample string 2"
  },
  "extensions": {
    "housingCooperative": {
      "description": "sample string 1",
      "apartmentNumber": "sample string 2",
      "apartmentRegistrationNumber": "sample string 3",
      "association": {
        "id": "sample string 1",
        "overrideDescription": {
          "generalAboutAssociation": "sample string 1",
          "renovations": "sample string 2",
          "parking": "sample string 3",
          "tvAndBroadband": "sample string 4",
          "courtyard": "sample string 5",
          "sharedSpaces": "sample string 6",
          "insurance": "sample string 7",
          "other": "sample string 8"
        },
        "overrideEconomy": {
          "monthlyFeeInformation": "sample string 1",
          "finances": "sample string 2",
          "sublettingPolicy": "sample string 3",
          "theAssociationOwnTheGround": "sample string 4",
          "transferFee": 1,
          "transferFeePaidBy": "Undetermined",
          "pledgeFee": 1,
          "allowLegalPersonAsBuyer": "Undetermined",
          "allowsSharedOwnershipInfo": "sample string 5"
        }
      },
      "finances": {
        "isPledged": true,
        "indirectNetDebt": 1.1,
        "repairFundBalance": 1.1,
        "annualFeeShare": 1.1,
        "indirectNetDebtComment": "sample string 1",
        "sharesComment": "sample string 2",
        "shares": 1.1
      },
      "includedLand": {
        "size": 1.1,
        "description": "sample string 1"
      }
    },
    "condominium": {
      "apartmentRegistrationNumber": "sample string 1"
    },
    "foreignProperty": {
      "externalReferenceNumber": "sample string 1",
      "address": {
        "city": "sample string 1",
        "province": "sample string 2"
      },
      "distances": [
        {
          "type": {
            "id": "sample string 1",
            "name": "sample string 2"
          },
          "meters": 1
        },
        {
          "type": {
            "id": "sample string 1",
            "name": "sample string 2"
          },
          "meters": 1
        }
      ],
      "localizations": [
        {
          "language": "sample string 1",
          "shortSaleDescription": "sample string 2",
          "saleDescription": "sample string 3",
          "salePhrase": "sample string 4",
          "saleHeading": "sample string 5",
          "interior": "sample string 6",
          "service": "sample string 7",
          "communication": "sample string 8",
          "area": "sample string 9",
          "parking": "sample string 10",
          "otherSurroundings": "sample string 11"
        },
        {
          "language": "sample string 1",
          "shortSaleDescription": "sample string 2",
          "saleDescription": "sample string 3",
          "salePhrase": "sample string 4",
          "saleHeading": "sample string 5",
          "interior": "sample string 6",
          "service": "sample string 7",
          "communication": "sample string 8",
          "area": "sample string 9",
          "parking": "sample string 10",
          "otherSurroundings": "sample string 11"
        }
      ]
    },
    "farm": {
      "numberOfPartitions": 1,
      "jointlyTaxedProperties": "sample string 1",
      "agriculturalFocus": [
        {
          "id": "sample string 1",
          "name": "sample string 2"
        },
        {
          "id": "sample string 1",
          "name": "sample string 2"
        }
      ],
      "acreage": {
        "source": "sample string 1",
        "entries": [
          {
            "type": {
              "id": "sample string 1",
              "name": "sample string 2"
            },
            "size": 1.1
          },
          {
            "type": {
              "id": "sample string 1",
              "name": "sample string 2"
            },
            "size": 1.1
          }
        ],
        "total": 1.1,
        "sum": 2.1
      },
      "economyBuildings": [
        {
          "name": "sample string 1",
          "description": "sample string 2"
        },
        {
          "name": "sample string 1",
          "description": "sample string 2"
        }
      ],
      "lands": [
        {
          "name": "sample string 1",
          "description": "sample string 2"
        },
        {
          "name": "sample string 1",
          "description": "sample string 2"
        }
      ],
      "otherData": [
        {
          "heading": "sample string 1",
          "text": "sample string 2"
        },
        {
          "heading": "sample string 1",
          "text": "sample string 2"
        }
      ]
    },
    "commercialProperty": {
      "compilationArea": {
        "size": 1.1,
        "source": "sample string 1",
        "income": {
          "rental": 1.1,
          "other": 1.1,
          "source": "sample string 1"
        },
        "flatOperatingCost": 1.1,
        "vacancies": "sample string 2",
        "entries": [
          {
            "type": {
              "id": "sample string 1",
              "name": "sample string 2"
            },
            "size": 1.1,
            "number": 1.1,
            "rentalIncome": {
              "value": 1.1,
              "perSquareMeter": 1.1
            },
            "otherIncome": {
              "value": 1.1,
              "perSquareMeter": 1.1
            },
            "flatOperatingCost": {
              "value": 1.1,
              "perSquareMeter": 1.1
            }
          },
          {
            "type": {
              "id": "sample string 1",
              "name": "sample string 2"
            },
            "size": 1.1,
            "number": 1.1,
            "rentalIncome": {
              "value": 1.1,
              "perSquareMeter": 1.1
            },
            "otherIncome": {
              "value": 1.1,
              "perSquareMeter": 1.1
            },
            "flatOperatingCost": {
              "value": 1.1,
              "perSquareMeter": 1.1
            }
          }
        ]
      },
      "business": {
        "type": {
          "id": "sample string 1",
          "name": "sample string 2"
        },
        "description": "sample string 1",
        "equipment": "sample string 2",
        "startingYear": 1,
        "numberOfEmployees": 1,
        "profit": {
          "id": "sample string 1",
          "name": "sample string 2"
        },
        "revenue": 1.1
      },
      "technicalData": {
        "description": "sample string 1"
      },
      "sharedSpaces": {
        "courtyard": "sample string 1",
        "description": "sample string 2"
      },
      "renovationPlan": {
        "amount": 1.1,
        "description": "sample string 1"
      },
      "offer": {
        "isReceiving": true,
        "deadlineAt": "2026-10-04T10:31:59.8869445+02:00"
      }
    },
    "premises": {
      "technicalData": {
        "description": "sample string 1"
      },
      "focusOn": [
        {
          "id": "sample string 1",
          "name": "sample string 2"
        },
        {
          "id": "sample string 1",
          "name": "sample string 2"
        }
      ],
      "compilationArea": {
        "entries": [
          {
            "name": "sample string 1",
            "size": 1,
            "rent": 1.1,
            "operatingCost": 1.1
          },
          {
            "name": "sample string 1",
            "size": 1,
            "rent": 1.1,
            "operatingCost": 1.1
          }
        ],
        "areaSize": 1.1,
        "rent": 1.1,
        "operatingCost": 1.1
      }
    },
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
      "changedAt": "2026-10-04T10:31:59.8869445+02:00",
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
        "dataChangedAt": "2026-10-04T10:31:59.8869445+02:00",
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
      "changedAt": "2026-10-04T10:31:59.8869445+02:00",
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
        "dataChangedAt": "2026-10-04T10:31:59.8869445+02:00",
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
  "currency": "sample string 7",
  "inspection": {
    "hasBeenPerformed": true
  },
  "expenses": {
    "operation": {
      "sum": 1.1,
      "householdSize": 1,
      "entries": [
        {
          "type": {
            "id": "sample string 1",
            "name": "sample string 2"
          },
          "value": 1.1
        },
        {
          "type": {
            "id": "sample string 1",
            "name": "sample string 2"
          },
          "value": 1.1
        }
      ],
      "description": "sample string 1"
    }
  }
}
```
