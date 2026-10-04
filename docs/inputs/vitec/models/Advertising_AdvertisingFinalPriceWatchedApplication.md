<!-- https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingFinalPriceWatchedApplication, fetched 2026-10-04 -->

# AdvertisingFinalPriceWatchedApplication

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Person | Kontaktperson som leadet avser | [AdvertisingLeadPerson](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingLeadPerson) | En kontaktperson måste anges |
| ProspectiveBuyerStatus | Den status som kontakten ska få till bostaden om kontakten inte redan finns på bostaden | [AdvertisingFinalPriceWatchedProspectiveBuyerStatus](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingFinalPriceWatchedProspectiveBuyerStatus) |  |
| LeadSourceId | Leadskälla - Det lead som skapas i samband med intresseanmälan kommer att kopplas till aktuell leadskälla. Om fältet inte anges, kommer leadet att kopplas till en förvald leadskälla som används för intresseanmälningar. | string |  |
| Marketing | Marknadsföringsuppgifter som t ex UTM taggar | [FormMarketing](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_FormMarketing) |  |
| Message | Ett meddelande till mottagaren av leadet | string |  |
