<!-- https://connect.maklare.vitec.net/Help/Api/PUT-CRM-Contact-customerId-SearchProfile-Foreign-id, fetched 2026-10-04 -->

# PUT CRM/Contact/{customerId}/SearchProfile/Foreign/{id}

Uppdatera en sökprofil av typen utlandsbostad

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kundid | string | Krävs |
| id | Sökprofilens id | string | Krävs |

## Body Parameters

Sökprofil [SearchProfileForeignUpdate](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=SearchProfileV2_SearchProfileForeignUpdate)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| CountryCode | Landskod | string |  |
| Subtypes | Typ av utlandsboende | Collection of [SubtypeForeign](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=SearchProfileV2_SubtypeForeign) |  |
| Features | Egenskaper för utlandsboende | Collection of [ForeignFeature](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=SearchProfileV2_ForeignFeature) |  |
| AreaIds | Områdes id:n | Collection of string |  |
| ShoppingCentreMaxDist | Affärscentrum | integer |  |
| CentreMaxDist | Centrum | integer |  |
| AirportMaxDist | Flyplats | integer |  |
| GolfCourceMaxDist | Golfbana | integer |  |
| SeaMaxDist | Hav | integer |  |
| SupermarketMaxDist | Mataffär | integer |  |
| PoolMaxDist | Pool | integer |  |
| HospitalMaxDist | Sjukhus | integer |  |
| BeachMaxDist | Strand | integer |  |
| LivingSpace | Boarea min/max. Valbara värden finns i "LivingAreaSteps" som fås via anrop till GET CRM/Contact/{customerId}/SearchProfile/SearchProfileValues. | [RangeOfInt32](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_RangeOfInt32) |  |
| NumberOfRooms | Antal rum min/max. Valbara värden finns i "RoomSteps" som fås via anrop till GET CRM/Contact/{customerId}/SearchProfile/SearchProfileValues. | [RangeOfInt32](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_RangeOfInt32) |  |
| Bedrooms | Antal sovrum. Valbara värden finns i "RoomSteps" som fås via anrop till GET CRM/Contact/{customerId}/SearchProfile/SearchProfileValues. | integer |  |
| PlotArea | Tomtarea min/max anges i kvm. Valbara värden finns i "PlotAreaSteps" som fås via anrop till GET CRM/Contact/{customerId}/SearchProfile/SearchProfileValues. | [RangeOfInt32](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_RangeOfInt32) |  |
| MonthlyFee | Månadsavgift. Valbara värden finns i "MonthlyFeeSteps" som fås via anrop till GET CRM/Contact/{customerId}/SearchProfile/SearchProfileValues. | integer |  |
| IsAutomaticProfile | Sökprofilen är automatskapad | boolean |  |
| Price | Pris min/max. Valbara värden för svenska objekt finns i "DomesticPriceSteps" som fås via anrop till GET CRM/Contact/{customerId}/SearchProfile/SearchProfileValues. För utlandsbostäder skall istället "ForeignPriceSteps" användas. | [RangeOfInt32](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_RangeOfInt32) |  |
| DrawnAreas | Ritat område | Collection of [Polygon](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_Polygon) |  |
| DrawnAreasName | Namn på ritat område | string |  |
| IncreasedRequirementIds | Utökade krav id:n (increased requirements) Valbara värden för olika objettyper fås via anrop till GET IncreasedRequirement/{customerId}. | Collection of string |  |

### Request Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json105)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml105)

```
{
  "countryCode": "sample string 1",
  "subtypes": [
    "Apartment",
    "Apartment"
  ],
  "features": [
    "Balcony",
    "Balcony"
  ],
  "areaIds": [
    "sample string 1",
    "sample string 2"
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
  "drawnAreasName": "sample string 3",
  "increasedRequirementIds": [
    "sample string 1",
    "sample string 2"
  ]
}
```

## Response Information

### Resource Description

Uppdatera en sökprofil av typen utlandsbostad

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input
