<!-- https://connect.maklare.vitec.net/Help/Api/GET-Advertising-Project-customerId, fetched 2026-09-16 -->

# GET Advertising/Project/{customerId}

Hämta projektlista för publicerade projekt för hemsida

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id | string | Krävs |
| ChangedAtMinValue | Ändringsdatum minvärde | date |  |
| ChangedAtMaxValue | Ändringsdatum maxvärde | date |  |
| Status | Status | [ProjectStatusFlags](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Api_ProjectStatusFlags) |  |
| PageSize | Sid-storlek | integer |  |
| PageIndex | Sid-index | integer |  |

## Response Information

### Resource Description

Hämta projektlista för publicerade projekt för hemsida [PageOfAdvertising_AdvertisingProjectListRow](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_PageOfAdvertising_AdvertisingProjectListRow)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Index |  | integer |  |
| Count |  | integer |  |
| TotalRowCount |  | integer |  |
| Rows |  | Collection of [AdvertisingProjectListRow](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingProjectListRow) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json236)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml236)

```
{
  "index": 1,
  "count": 2,
  "totalRowCount": 3,
  "rows": [
    {
      "id": "sample string 1",
      "customerId": "sample string 2",
      "changedAt": "2026-09-16T06:05:13.2362523+02:00"
    },
    {
      "id": "sample string 1",
      "customerId": "sample string 2",
      "changedAt": "2026-09-16T06:05:13.2362523+02:00"
    }
  ]
}
```
