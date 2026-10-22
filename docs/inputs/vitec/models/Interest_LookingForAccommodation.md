<!-- https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Interest_LookingForAccommodation, fetched 2026-10-04 -->

# LookingForAccommodation

Sökpreferenser

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Id | Sökpreferens Id | string |  |
| AreaIds | Lista av områden.Endast områden med polygoner kan användas | Collection of string |  |
| Countys | Län, LK-Koder | Collection of string |  |
| CountryCode | Landskod | string |  |
| Polygon | Polygon | Collection of [Coordinate](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_Coordinate) | En polygon måste innehålla minst fyra punkter. En polygons första och sista punkt måste vara identiska för att sluta polygonen. |
| ForeignProperty | Önskemålet gäller utlandsbostäder | boolean |  |
| House | Hus | boolean | Minst en önskad bostadstyp måste väljas. |
| RowHouse | Radhus | boolean | Minst en önskad bostadstyp måste väljas. |
| HousingCooperative | Bostadsrätt | boolean | Minst en önskad bostadstyp måste väljas. |
| Cottage | Fritidshus | boolean | Minst en önskad bostadstyp måste väljas. |
| Premises | Lokal | boolean | Minst en önskad bostadstyp måste väljas. |
| Plot | Tomt | boolean | Minst en önskad bostadstyp måste väljas. |
| Farm | Gård | boolean | Minst en önskad bostadstyp måste väljas. |
| Tenancy | Hyresrätt | boolean | Minst en önskad bostadstyp måste väljas. |
| OtherHousing | Övrig boform | boolean | Minst en önskad bostadstyp måste väljas. |
| LivingSpace | Boarea | [Interval](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Interest_Interval) |  |
| NumberOfRooms | Antal rum | [Interval](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Interest_Interval) |  |
| Price | Pris | [Interval](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Interest_Interval) |  |
| PlotArea | Tomtarea | [Interval](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Interest_Interval) |  |
| SpecialRequset | Special förfrågan | string |  |
| IncreasedRequirementIDs | Utökade krav | Collection of string |  |
| Active | Aktivt önskemål (ska matchas) | boolean |  |
