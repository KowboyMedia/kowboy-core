<!-- https://connect.maklare.vitec.net/Help/ResourceModel?modelName=SearchProfileV2_SearchProfilePremises, fetched 2026-10-04 -->

# SearchProfilePremises

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Id | Sökprofilid | string |  |
| DateCreated | Skapad datum | date |  |
| ValidTo | Giltig till | date |  |
| SumArea | Summa areor i kvm min/max. Valbara värden finns i "PlotAreaSteps" som fås via anrop till GET CRM/Contact/{customerId}/SearchProfile/SearchProfileValues. | [RangeOfInt32](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_RangeOfInt32) |  |
| Subtypes | Typ av lokal | Collection of [SubtypePremises](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=SearchProfileV2_SubtypePremises) |  |
| AreaIds | Områdes id:n | Collection of string |  |
| MunicipalityCodes | Kommunkoder | Collection of string |  |
| IsAutomaticProfile | Sökprofilen är automatskapad | boolean |  |
| Price | Pris min/max. Valbara värden för svenska objekt finns i "DomesticPriceSteps" som fås via anrop till GET CRM/Contact/{customerId}/SearchProfile/SearchProfileValues. För utlandsbostäder skall istället "ForeignPriceSteps" användas. | [RangeOfInt32](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_RangeOfInt32) |  |
| DrawnAreas | Ritat område | Collection of [Polygon](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_Polygon) |  |
| DrawnAreasName | Namn på ritat område | string |  |
| IncreasedRequirementIds | Utökade krav id:n (increased requirements) Valbara värden för olika objettyper fås via anrop till GET IncreasedRequirement/{customerId}. | Collection of string |  |
