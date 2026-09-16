<!-- https://connect.maklare.vitec.net/Help/Api/GET-Advertising-Brand-customerId, fetched 2026-09-16 -->

# GET Advertising/Brand/{customerId}

Hämta varumärke för hemsida.

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Varumärke-id | string | Krävs |

## Response Information

### Resource Description

Hämta varumärke för hemsida.

[AdvertisingBrand](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingBrand)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Id | Id | string |  |
| Name | Namn | string |  |
| CreatedAt | Skapad | date |  |
| ChangedAt | Senast ändrad | date |  |
| Segments | Del av varumärke | Collection of [AdvertisingBrandSegment](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingBrandSegment) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json642)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml642)

```
{
  "id": "sample string 1",
  "name": "sample string 2",
  "createdAt": "2026-09-16T05:55:35.3844471+02:00",
  "changedAt": "2026-09-16T05:55:35.3844471+02:00",
  "segments": [
    {
      "id": "sample string 1",
      "name": "sample string 2",
      "createdAt": "2026-09-16T05:55:35.3844471+02:00",
      "changedAt": "2026-09-16T05:55:35.3844471+02:00"
    },
    {
      "id": "sample string 1",
      "name": "sample string 2",
      "createdAt": "2026-09-16T05:55:35.3844471+02:00",
      "changedAt": "2026-09-16T05:55:35.3844471+02:00"
    }
  ]
}
```
