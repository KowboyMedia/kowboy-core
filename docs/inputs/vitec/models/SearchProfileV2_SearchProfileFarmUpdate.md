<!-- https://connect.maklare.vitec.net/Help/ResourceModel?modelName=SearchProfileV2_SearchProfileFarmUpdate, fetched 2026-10-04 -->

# SearchProfileFarmUpdate

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Subtypes | Typ av gård | Collection of [SubtypeFarm](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=SearchProfileV2_SubtypeFarm) |  |
| AreaIds | Områdes id:n | Collection of string |  |
| MunicipalityCodes | Kommunkoder | Collection of string |  |
| TotalArea | Total area. Anges i hektar(ha) Valbara värden finns i "FarmAreaStepsHectare" som fås via anrop till GET CRM/Contact/{customerId}/SearchProfile/SearchProfileValues. | [RangeOfInt32](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_RangeOfInt32) |  |
| LivingSpace | Boarea min/max. Valbara värden finns i "LivingAreaSteps" som fås via anrop till GET CRM/Contact/{customerId}/SearchProfile/SearchProfileValues. | [RangeOfInt32](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_RangeOfInt32) |  |
| NumberOfRooms | Antal rum min/max. Valbara värden finns i "RoomSteps" som fås via anrop till GET CRM/Contact/{customerId}/SearchProfile/SearchProfileValues. | [RangeOfInt32](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_RangeOfInt32) |  |
| Bedrooms | Antal sovrum. Valbara värden finns i "RoomSteps" som fås via anrop till GET CRM/Contact/{customerId}/SearchProfile/SearchProfileValues. | integer |  |
| IsAutomaticProfile | Sökprofilen är automatskapad | boolean |  |
| Price | Pris min/max. Valbara värden för svenska objekt finns i "DomesticPriceSteps" som fås via anrop till GET CRM/Contact/{customerId}/SearchProfile/SearchProfileValues. För utlandsbostäder skall istället "ForeignPriceSteps" användas. | [RangeOfInt32](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_RangeOfInt32) |  |
| DrawnAreas | Ritat område | Collection of [Polygon](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_Polygon) |  |
| DrawnAreasName | Namn på ritat område | string |  |
| IncreasedRequirementIds | Utökade krav id:n (increased requirements) Valbara värden för olika objettyper fås via anrop till GET IncreasedRequirement/{customerId}. | Collection of string |  |
