<!-- https://connect.maklare.vitec.net/Help/Api/POST-CRM-Contact-customerId-SearchProfile-Commercial-contactId, fetched 2026-10-04 -->

# POST CRM/Contact/{customerId}/SearchProfile/Commercial/{contactId}

Skapa en sökprofil av typen kommersiell fastighet

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kundid | string | Krävs |
| contactId | Kontaktid | string | Krävs |

## Body Parameters

Sökprofilen [SearchProfileCommercialCreate](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=SearchProfileV2_SearchProfileCommercialCreate)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| PlotArea | Tomtarea i kvm Valbara värden finns i "PlotAreaSteps" som fås via anrop till GET CRM/Contact/{customerId}/SearchProfile/SearchProfileValues. | [RangeOfInt32](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_RangeOfInt32) |  |
| SumArea | Summa areor i kvm min/max. Valbara värden finns i "PlotAreaSteps" som fås via anrop till GET CRM/Contact/{customerId}/SearchProfile/SearchProfileValues. | [RangeOfInt32](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_RangeOfInt32) |  |
| Subtypes | Typ av kommersiell fastighet | Collection of [SubtypeCommercial](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=SearchProfileV2_SubtypeCommercial) |  |
| AreaIds | Områdes id:n | Collection of string |  |
| MunicipalityCodes | Kommunkoder | Collection of string |  |
| IsAutomaticProfile | Sökprofilen är automatskapad | boolean |  |
| Price | Pris min/max. Valbara värden för svenska objekt finns i "DomesticPriceSteps" som fås via anrop till GET CRM/Contact/{customerId}/SearchProfile/SearchProfileValues. För utlandsbostäder skall istället "ForeignPriceSteps" användas. | [RangeOfInt32](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_RangeOfInt32) |  |
| DrawnAreas | Ritat område | Collection of [Polygon](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_Polygon) |  |
| DrawnAreasName | Namn på ritat område | string |  |
| IncreasedRequirementIds | Utökade krav id:n (increased requirements) Valbara värden för olika objettyper fås via anrop till GET IncreasedRequirement/{customerId}. | Collection of string |  |

### Request Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json433)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml433)

```
{
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
  "drawnAreasName": "sample string 2",
  "increasedRequirementIds": [
    "sample string 1",
    "sample string 2"
  ]
}
```

## Response Information

### Resource Description

Skapa en sökprofil av typen kommersiell fastighet string

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json433)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml433)

```
"sample string 1"
```
