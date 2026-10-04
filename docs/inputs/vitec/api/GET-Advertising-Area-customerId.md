<!-- https://connect.maklare.vitec.net/Help/Api/GET-Advertising-Area-customerId, fetched 2026-10-04 -->

# GET Advertising/Area/{customerId}

Hämta områdeslista för hemsida

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

Hämta områdeslista för hemsida [PageOfAdvertising_AdvertisingAreaListRow](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_PageOfAdvertising_AdvertisingAreaListRow)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Index |  | integer |  |
| Count |  | integer |  |
| TotalRowCount |  | integer |  |
| Rows |  | Collection of [AdvertisingAreaListRow](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingAreaListRow) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json916)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml916)

```
{
  "index": 1,
  "count": 2,
  "totalRowCount": 3,
  "rows": [
    {
      "id": "sample string 1",
      "customerId": "sample string 2",
      "changedAt": "2026-10-04T13:51:13.4942929+02:00"
    },
    {
      "id": "sample string 1",
      "customerId": "sample string 2",
      "changedAt": "2026-10-04T13:51:13.4942929+02:00"
    }
  ]
}
```
