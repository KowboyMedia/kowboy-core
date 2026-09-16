<!-- https://connect.maklare.vitec.net/Help/Api/GET-Advertising-Office-customerId, fetched 2026-09-16 -->

# GET Advertising/Office/{customerId}

Hämta kontorslista för hemsida

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id | string | Krävs |
| ChangedAtMinValue | Ändringsdatum minvärde | date |  |
| ChangedAtMaxValue | Ändringsdatum maxvärde | date |  |
| PageSize | Sid-storlek | integer |  |
| PageIndex | Sid-index | integer |  |

## Response Information

### Resource Description

Hämta kontorslista för hemsida [PageOfAdvertising_AdvertisingOfficeListRow](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_PageOfAdvertising_AdvertisingOfficeListRow)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Index |  | integer |  |
| Count |  | integer |  |
| TotalRowCount |  | integer |  |
| Rows |  | Collection of [AdvertisingOfficeListRow](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingOfficeListRow) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json612)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml612)

```

{
  "index": 1,
  "count": 2,
  "totalRowCount": 3,
  "rows": [
    {
      "id": "sample string 1",
      "customerId": "sample string 2",
      "changedAt": "2026-09-16T05:55:41.117094+02:00"
    },
    {
      "id": "sample string 1",
      "customerId": "sample string 2",
      "changedAt": "2026-09-16T05:55:41.117094+02:00"
    }
  ]
}
```
