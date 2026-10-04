<!-- https://connect.maklare.vitec.net/Help/Api/POST-CRM-Contact-customerId-SearchProfile-Residential-contactId, fetched 2026-10-04 -->

# POST CRM/Contact/{customerId}/SearchProfile/Residential/{contactId}

Skapa en sökprofil av typen boende(villa, lägenhet, tomt, radhus, fritidshus)

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kundid | string | Krävs |
| contactId | Kontaktid | string | Krävs |

## Body Parameters

Sökprofilen [SearchProfileResidentialCreate](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=SearchProfileV2_SearchProfileResidentialCreate)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Subtypes | Typ av boende | Collection of [SubtypeResidential](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=SearchProfileV2_SubtypeResidential) |  |
| AreaIds | Områdes id:n | Collection of string |  |
| MunicipalityCodes | Kommunkoder | Collection of string |  |
| NewProduction | Nyproduktion. True filtrerar på endast nyproduktion, false filtrerar på ej nyproduktion och null anger inget filter. | boolean |  |
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

- [application/json, text/json](https://connect.maklare.vitec.net#json465)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml465)

```
{
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
  "drawnAreasName": "sample string 2",
  "increasedRequirementIds": [
    "sample string 1",
    "sample string 2"
  ]
}
```

## Response Information

### Resource Description

Skapa en sökprofil av typen boende(villa, lägenhet, tomt, radhus, fritidshus) string

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
"sample string 1"
```
