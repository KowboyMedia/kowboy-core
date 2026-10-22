<!-- https://connect.maklare.vitec.net/Help/ResourceModel?modelName=SearchProfileV2_SearchProfileForeignCreate, fetched 2026-10-04 -->

# SearchProfileForeignCreate

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
