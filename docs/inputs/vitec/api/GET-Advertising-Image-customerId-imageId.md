<!-- https://connect.maklare.vitec.net/Help/Api/GET-Advertising-Image-customerId-imageId, fetched 2026-09-16 -->

# GET Advertising/Image/{customerId}/{imageId}

Hämtar bild.

För att kunna hämta en bild så krävs det en giltig API nyckel och ett kundid. Det krävs även ett giltig bild id för att kunna hämta en bild.

[Det finns dessutom extra parametrar för t ex skalning och beskärning av bilden, mer information finns här](https://connect.maklare.vitec.net/Help/ImageApi)

OBS! Om inga parametrar för bild API:et används, så kommer ni att få bilden exakt som bilden ligger lagrad i datakällan.

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kundid | string | Krävs |
| imageId | Bildid | string | Krävs |

## Response Information

### Resource Description

Hämtar bilder. Collection of byte

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/octet-stream](https://connect.maklare.vitec.net#octet-stream393)

- [text/x-base64](https://connect.maklare.vitec.net#x-base64393)

- [application/json, text/json](https://connect.maklare.vitec.net#json393)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml393)

```

@@
```

Sample not available.

```

"QEA="
```
