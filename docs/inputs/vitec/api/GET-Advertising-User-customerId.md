<!-- https://connect.maklare.vitec.net/Help/Api/GET-Advertising-User-customerId, fetched 2026-09-16 -->

# GET Advertising/User/{customerId}

Hämta användarlista för hemsida

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

Hämta användarlista för hemsida [PageOfAdvertising_AdvertisingUserListRow](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_PageOfAdvertising_AdvertisingUserListRow)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Index |  | integer |  |
| Count |  | integer |  |
| TotalRowCount |  | integer |  |
| Rows |  | Collection of [AdvertisingUserListRow](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingUserListRow) |  |

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
  "index": 1,
  "count": 2,
  "totalRowCount": 3,
  "rows": [
    {
      "id": "sample string 1",
      "isVisibleInStaffList": true,
      "changedAt": "2026-09-16T05:56:26.5907246+02:00",
      "offices": [
        {
          "id": "sample string 1",
          "customerId": "sample string 2",
          "isVisibleInStaffList": true
        },
        {
          "id": "sample string 1",
          "customerId": "sample string 2",
          "isVisibleInStaffList": true
        }
      ]
    },
    {
      "id": "sample string 1",
      "isVisibleInStaffList": true,
      "changedAt": "2026-09-16T05:56:26.5907246+02:00",
      "offices": [
        {
          "id": "sample string 1",
          "customerId": "sample string 2",
          "isVisibleInStaffList": true
        },
        {
          "id": "sample string 1",
          "customerId": "sample string 2",
          "isVisibleInStaffList": true
        }
      ]
    }
  ]
}
```
