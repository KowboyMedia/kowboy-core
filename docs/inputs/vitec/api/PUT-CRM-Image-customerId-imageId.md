<!-- https://connect.maklare.vitec.net/Help/Api/PUT-CRM-Image-customerId-imageId, fetched 2026-10-04 -->

# PUT CRM/Image/{customerId}/{imageId}

Metod för att uppdatera en bild (gif,jpg,tiff,bmp,png).

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kundid | string | Krävs |
| imageId | Bildid | string | Krävs |

## Body Parameters

Bilddata [ImageData](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Image_ImageData)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Data | Data (gif,jpg,tiff,bmp,png) | Collection of byte |  |
| Name | Namn på bilden | string |  |
| Caption | Bildtext | string |  |
| Advertise | Annoneras | boolean |  |
| Category | Bildkategori | string |  |

### Request Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json55)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml55)

```
{
  "data": "QEA=",
  "name": "sample string 1",
  "caption": "sample string 2",
  "advertise": true,
  "category": "sample string 3"
}
```

## Response Information

### Resource Description

Metod för att uppdatera en bild (gif,jpg,tiff,bmp,png).

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input
