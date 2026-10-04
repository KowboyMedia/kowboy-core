<!-- https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingArea, fetched 2026-10-04 -->

# AdvertisingArea

Område för annonsering på hemsida

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Id | Id | string |  |
| Name | Namn | string |  |
| CountyMunicipalityCode | LKF kod | string |  |
| Coordinates | Områdets koordinater i formatet GeoJSON Multipolygon (longitud, latitud) | Collection of Collection of Collection of Collection of decimal number |  |
| ChangedAt | När området senast ändrades | date |  |
| Office | Kontor | [AdvertisingOfficeReference](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingOfficeReference) |  |
| Surroundings | Närområde | [AdvertisingSurroundings](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingSurroundings) |  |
| Images | Bilder | Collection of [AdvertisingImage](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingImage) |  |
