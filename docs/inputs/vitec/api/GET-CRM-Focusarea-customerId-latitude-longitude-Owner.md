<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Focusarea-customerId-latitude-longitude-Owner, fetched 2026-10-04 -->

# GET CRM/Focusarea/{customerId}/{latitude}/{longitude}/Owner

Hämtar användare eller kontor vars focusområden innehåller koordinat

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kundid | string | Krävs |
| longitude | Longitud WGS84 decimalform | decimal number | Krävs |
| latitude | Latitude WGS84 decimalform | decimal number | Krävs |
| ownerType | Typ av ägare | [OwnerType](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=FocusArea_OwnerType) |  |

## Response Information

### Resource Description

Hämtar användare eller kontor vars focusområden innehåller koordinat Collection of [Owner](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=FocusArea_Owner)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Name | Namn på ägaren | string |  |
| OwnerType | Typ av ägare | [OwnerType](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=FocusArea_OwnerType) |  |
| Id | Id på ägaren | string |  |
| CustomerId | Kundnummer (huvudkontor för användare) | string |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json11)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml11)

```
[
  {
    "name": "sample string 1",
    "ownerType": "Users",
    "id": "sample string 2",
    "customerId": "sample string 3"
  },
  {
    "name": "sample string 1",
    "ownerType": "Users",
    "id": "sample string 2",
    "customerId": "sample string 3"
  }
]
```
