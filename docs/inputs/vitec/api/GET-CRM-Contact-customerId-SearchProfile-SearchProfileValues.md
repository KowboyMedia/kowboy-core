<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-SearchProfile-SearchProfileValues, fetched 2026-10-04 -->

# GET CRM/Contact/{customerId}/SearchProfile/SearchProfileValues

Hämtar undertyper och giltiga värden för sökprofiler

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kundid | string | Krävs |

## Response Information

### Resource Description

Hämtar undertyper och giltiga värden för sökprofiler [SearchProfilesInfo](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=SearchProfileV2_SearchProfilesInfo)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| SelectableResidentialSubtypes | Valbara undertyper för boenden(villa, lägenhet, fritidshus, tomt) | Collection of [SubtypeResidential](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=SearchProfileV2_SubtypeResidential) |  |
| SelectableFarmSubtypes | Valbara undertyper för gårdar | Collection of [SubtypeFarm](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=SearchProfileV2_SubtypeFarm) |  |
| SelectableForeignSubtypes | Valbara undertyper för utlandsboenden | Collection of [SubtypeForeign](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=SearchProfileV2_SubtypeForeign) |  |
| SelectableCommercialSubtypes | Valbara undertyper för kommersiella fastigheter | Collection of [SubtypeCommercial](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=SearchProfileV2_SubtypeCommercial) |  |
| SelectablePremisesSubtypes | Valbara undertyper för lokaler | Collection of [SubtypePremises](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=SearchProfileV2_SubtypePremises) |  |
| DomesticPriceSteps | Valbara värden för pris i SEK för inhemska objekt | Collection of decimal number |  |
| ForeignPriceSteps | Valbara värden för pris i valt lands valuta för utländska objekt | Collection of decimal number |  |
| RoomSteps | Valbara värden för rum och sovrum | Collection of decimal number |  |
| LivingAreaSteps | Valbara värden för boarea | Collection of decimal number |  |
| MonthlyFeeSteps | Valbara värden för månadsavgift | Collection of decimal number |  |
| PlotAreaSteps | Valbara värden för tomtarea i kvm | Collection of decimal number |  |
| FarmAreaStepsHectare | Valbara värden för areor för gårdar i hektar | Collection of decimal number |  |

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
{
  "selectableResidentialSubtypes": [
    "Apartment",
    "Apartment"
  ],
  "selectableFarmSubtypes": [
    "Agriculture",
    "Agriculture"
  ],
  "selectableForeignSubtypes": [
    "Apartment",
    "Apartment"
  ],
  "selectableCommercialSubtypes": [
    "Residential",
    "Residential"
  ],
  "selectablePremisesSubtypes": [
    "Retail",
    "Retail"
  ],
  "domesticPriceSteps": [
    1.1,
    2.1
  ],
  "foreignPriceSteps": [
    1.1,
    2.1
  ],
  "roomSteps": [
    1.1,
    2.1
  ],
  "livingAreaSteps": [
    1.1,
    2.1
  ],
  "monthlyFeeSteps": [
    1.1,
    2.1
  ],
  "plotAreaSteps": [
    1.1,
    2.1
  ],
  "farmAreaStepsHectare": [
    1.1,
    2.1
  ]
}
```
