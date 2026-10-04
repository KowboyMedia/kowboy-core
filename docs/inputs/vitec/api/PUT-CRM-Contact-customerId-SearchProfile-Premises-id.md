<!-- https://connect.maklare.vitec.net/Help/Api/PUT-CRM-Contact-customerId-SearchProfile-Premises-id, fetched 2026-10-04 -->

# PUT CRM/Contact/{customerId}/SearchProfile/Premises/{id}

Uppdatera en sökprofil av typen lokal

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kundid | string | Krävs |
| id | Sökprofilens id | string | Krävs |

## Body Parameters

Sökprofil [SearchProfilePremisesUpdate](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=SearchProfileV2_SearchProfilePremisesUpdate)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| SumArea | Summa areor | [RangeOfInt32](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_RangeOfInt32) |  |
| Subtypes | Typ av lokal | Collection of [SubtypePremises](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=SearchProfileV2_SubtypePremises) |  |
| AreaIds | Områdes id:n | Collection of string |  |
| MunicipalityCodes | Kommunkoder | Collection of string |  |
| IsAutomaticProfile | Sökprofilen är automatskapad | boolean |  |
| Price | Pris min/max. Valbara värden för svenska objekt finns i "DomesticPriceSteps" som fås via anrop till GET CRM/Contact/{customerId}/SearchProfile/SearchProfileValues. För utlandsbostäder skall istället "ForeignPriceSteps" användas. | [RangeOfInt32](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_RangeOfInt32) |  |
| DrawnAreas | Ritat område | Collection of [Polygon](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_Polygon) |  |
| DrawnAreasName | Namn på ritat område | string |  |
| IncreasedRequirementIds | Utökade krav id:n (increased requirements) Valbara värden för olika objettyper fås via anrop till GET IncreasedRequirement/{customerId}. | Collection of string |  |

### Request Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json199)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml199)

```
{
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
  "drawnAreasName": "sample string 2",
  "increasedRequirementIds": [
    "sample string 1",
    "sample string 2"
  ]
}
```

## Response Information

### Resource Description

Uppdatera en sökprofil av typen lokal

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input
