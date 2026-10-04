<!-- https://connect.maklare.vitec.net/Help/Section?id=advertising, fetched 2026-10-04 -->

API:er för att bygga hemsidor med bostadsförsäljningar

När ni bygger listor och beskrivningar via Connect så krävs det att ni mellanlagrar informationen ni hämtar från Connect, så att listor och beskrivningar visas snabbare. När ni har hämtat information från Connect så skall informationen sparas och återanvändas. T ex om ni ska bygga en beskrivning så hämtar ni bostadsinformationen en gång och återanvänder informationen när olika besökare besöker bostadsbeskrivningen. Än viktigare är att detta görs för bilder och filer då de kan vara stora och ta lång tid att hämta.

Ytterligare dokumentation:

- [Infoga färdigt formulär för intresseanmälan, boka visning, värdering](https://connect.maklare.vitec.net/Help/KomponentKontakta)

- [Migrera från version 1.0](https://connect.maklare.vitec.net/Help/AdvertisingMigration)

- [Förhandsgranskningar av bostäder](https://connect.maklare.vitec.net/Help/AdvertisingPreview)

### Open API Specification

Ni hittar Connect Open API Specification/swagger advertising [här (/swagger/docs/advertising)](https://connect.maklare.vitec.net/swagger/docs/advertising) .

### Varumärke

Kundens varumärke för användning på hemsida

| API | Beskrivning |
| --- | --- |
| [GET Advertising/Brand/List/{customerId}](https://connect.maklare.vitec.net/Help/Api/GET-Advertising-Brand-List-customerId) | Hämta lista av varumärken för hemsida. |
| [GET Advertising/Brand/{customerId}](https://connect.maklare.vitec.net/Help/Api/GET-Advertising-Brand-customerId) | Hämta varumärke för hemsida. |

### Område

Områden för hemsida

| API | Beskrivning |
| --- | --- |
| [GET Advertising/Area/{customerId}](https://connect.maklare.vitec.net/Help/Api/GET-Advertising-Area-customerId) | Hämta områdeslista för hemsida |
| [GET Advertising/Area/{customerId}/{areaId}](https://connect.maklare.vitec.net/Help/Api/GET-Advertising-Area-customerId-areaId) | Hämta område för hemsida. |

### Användare för hemsida

Användare för hemsida

| API | Beskrivning |
| --- | --- |
| [GET Advertising/User/{customerId}](https://connect.maklare.vitec.net/Help/Api/GET-Advertising-User-customerId) | Hämta användarlista för hemsida |
| [GET Advertising/User/{customerId}/{userId}](https://connect.maklare.vitec.net/Help/Api/GET-Advertising-User-customerId-userId) | Hämta användare för hemsida. |

### Föreningar för hemsida

Föreningar för hemsida

| API | Beskrivning |
| --- | --- |
| [GET Advertising/Association/{customerId}/{associationId}](https://connect.maklare.vitec.net/Help/Api/GET-Advertising-Association-customerId-associationId) | Hämtar bostadsrättsförening |

### Meddelanden

Hantering av utskick och meddelanden

| API | Beskrivning |
| --- | --- |
| [PUT Advertising/Message/{customerId}/Estate/{estateId}/Viewing/Attendee/{contactId}/OptOut](https://connect.maklare.vitec.net/Help/Api/PUT-Advertising-Message-customerId-Estate-estateId-Viewing-Attendee-contactId-OptOut) | Avbokar en kontakt från en visning |

### Filer

Filer för hemsida

| API | Beskrivning |
| --- | --- |
| [GET Advertising/File/{customerId}/{fileId}](https://connect.maklare.vitec.net/Help/Api/GET-Advertising-File-customerId-fileId) | Hämtar filer. |

### Formulär

Formulär på hemsida

| API | Beskrivning |
| --- | --- |
| [GET v2/Advertising/Form/{customerId}/Estate/{estateId}](https://connect.maklare.vitec.net/Help/Api/GET-v2-Advertising-Form-customerId-Estate-estateId) | Hämtar bostadsinformation som behövs för kontaktformulär |
| [POST v2/Advertising/Form/{customerId}/Estate/{estateId}/Viewing/Attend](https://connect.maklare.vitec.net/Help/Api/POST-v2-Advertising-Form-customerId-Estate-estateId-Viewing-Attend) | Lägg till en visningsdeltagare |
| [POST v2/Advertising/Form/{customerId}/Valuation](https://connect.maklare.vitec.net/Help/Api/POST-v2-Advertising-Form-customerId-Valuation) | Värderingsförfrågan |

### Bilder

Bilder för hemsida

| API | Beskrivning |
| --- | --- |
| [GET Advertising/Image/{customerId}/{imageId}](https://connect.maklare.vitec.net/Help/Api/GET-Advertising-Image-customerId-imageId) | Hämtar bilder. |

### Kontor

Kontor för hemsida

| API | Beskrivning |
| --- | --- |
| [GET Advertising/Office/{customerId}](https://connect.maklare.vitec.net/Help/Api/GET-Advertising-Office-customerId) | Hämta kontorslista för hemsida |
| [GET Advertising/Office/{customerId}/{officeId}](https://connect.maklare.vitec.net/Help/Api/GET-Advertising-Office-customerId-officeId) | Hämta kontor för hemsida. |

### Projekt

Projekt för hemsida

| API | Beskrivning |
| --- | --- |
| [GET Advertising/Project/{customerId}](https://connect.maklare.vitec.net/Help/Api/GET-Advertising-Project-customerId) | Hämta projektlista för publicerade projekt för hemsida |
| [GET Advertising/Project/{customerId}/{projectId}](https://connect.maklare.vitec.net/Help/Api/GET-Advertising-Project-customerId-projectId) | Hämta projekt för hemsida. [Extend API är tillgängligt](https://connect.maklare.vitec.net/Help/TermExtend) |

### Bostäder

Hantera bostäder och intresseanmälan för hemsida

| API | Beskrivning |
| --- | --- |
| [GET Advertising/Estate/{customerId}](https://connect.maklare.vitec.net/Help/Api/GET-Advertising-Estate-customerId) | Hämta bostadslista för publicerade bostäder för hemsida |
| [GET Advertising/Estate/{customerId}/{estateId}](https://connect.maklare.vitec.net/Help/Api/GET-Advertising-Estate-customerId-estateId) | Hämta bostad för hemsida. [Extend API är tillgängligt](https://connect.maklare.vitec.net/Help/TermExtend) |
| [POST Advertising/Estate/{customerId}/{estateId}/interest](https://connect.maklare.vitec.net/Help/Api/POST-Advertising-Estate-customerId-estateId-interest) | Skickar in en ny intresseanmälan för en kontakt till en bostad. Innan nya personer läggs in i mäklarsystemet, görs alltid en dubblettkontroll. |
| [POST Advertising/Estate/{customerId}/{estateId}/FinalPriceWatched](https://connect.maklare.vitec.net/Help/Api/POST-Advertising-Estate-customerId-estateId-FinalPriceWatched) | Skickar in en ny bevakning av slutpris för en kontakt till en bostad. Innan nya personer läggs in i mäklarsystemet, görs alltid en dubblettkontroll. |
