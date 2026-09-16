<!-- https://connect.maklare.vitec.net/Help/Api/GET-Advertising-Estate-customerId, fetched 2026-09-16 -->

# GET Advertising/Estate/{customerId}

Hämta bostadslista för publicerade bostäder för hemsida

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id | string | Krävs |
| ChangedAtMinValue | Ändringsdatum minvärde | date |  |
| ChangedAtMaxValue | Ändringsdatum maxvärde | date |  |
| Status | Status | [EstateStatusFlags](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Api_EstateStatusFlags) |  |
| Type | Type | [EstateClassTypeFlags](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Api_EstateClassTypeFlags) |  |
| PageSize | Sid-storlek | integer |  |
| PageIndex | Sid-index | integer |  |

## Response Information

### Resource Description

Hämta bostadslista för publicerade bostäder för hemsida [PageOfAdvertising_AdvertisingEstateListRow](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_PageOfAdvertising_AdvertisingEstateListRow)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Index |  | integer |  |
| Count |  | integer |  |
| TotalRowCount |  | integer |  |
| Rows |  | Collection of [AdvertisingEstateListRow](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingEstateListRow) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json34)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml34)

```

{
  "index": 1,
  "count": 2,
  "totalRowCount": 3,
  "rows": [
    {
      "id": "sample string 1",
      "customerId": "sample string 2",
      "changedAt": "2026-09-16T05:51:40.0798551+02:00"
    },
    {
      "id": "sample string 1",
      "customerId": "sample string 2",
      "changedAt": "2026-09-16T05:51:40.0798551+02:00"
    }
  ]
}
```
