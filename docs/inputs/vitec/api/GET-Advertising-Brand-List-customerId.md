<!-- https://connect.maklare.vitec.net/Help/Api/GET-Advertising-Brand-List-customerId, fetched 2026-10-04 -->

# GET Advertising/Brand/List/{customerId}

Hämta lista av varumärken för hemsida.

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId |  | string | Krävs |
| Paging | Sidhantering | [Paging](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_Paging) |  |
| ChangedAtMinValue | Ändringsdatum minvärde | date |  |
| ChangedAtMaxValue | Ändringsdatum maxvärde | date |  |

## Response Information

### Resource Description

Hämta lista av varumärken för hemsida.

[PageOfAdvertising_AdvertisingBrand](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_PageOfAdvertising_AdvertisingBrand)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Index |  | integer |  |
| Count |  | integer |  |
| TotalRowCount |  | integer |  |
| Rows |  | Collection of [AdvertisingBrand](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingBrand) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json244)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml244)

```
{
  "index": 1,
  "count": 2,
  "totalRowCount": 3,
  "rows": [
    {
      "id": "sample string 1",
      "name": "sample string 2",
      "createdAt": "2026-10-04T13:51:12.8536693+02:00",
      "changedAt": "2026-10-04T13:51:12.8536693+02:00",
      "segments": [
        {
          "id": "sample string 1",
          "name": "sample string 2",
          "createdAt": "2026-10-04T13:51:12.8536693+02:00",
          "changedAt": "2026-10-04T13:51:12.8536693+02:00"
        },
        {
          "id": "sample string 1",
          "name": "sample string 2",
          "createdAt": "2026-10-04T13:51:12.8536693+02:00",
          "changedAt": "2026-10-04T13:51:12.8536693+02:00"
        }
      ]
    },
    {
      "id": "sample string 1",
      "name": "sample string 2",
      "createdAt": "2026-10-04T13:51:12.8536693+02:00",
      "changedAt": "2026-10-04T13:51:12.8536693+02:00",
      "segments": [
        {
          "id": "sample string 1",
          "name": "sample string 2",
          "createdAt": "2026-10-04T13:51:12.8536693+02:00",
          "changedAt": "2026-10-04T13:51:12.8536693+02:00"
        },
        {
          "id": "sample string 1",
          "name": "sample string 2",
          "createdAt": "2026-10-04T13:51:12.8536693+02:00",
          "changedAt": "2026-10-04T13:51:12.8536693+02:00"
        }
      ]
    }
  ]
}
```
