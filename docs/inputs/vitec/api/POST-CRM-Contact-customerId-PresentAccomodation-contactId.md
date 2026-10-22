<!-- https://connect.maklare.vitec.net/Help/Api/POST-CRM-Contact-customerId-PresentAccomodation-contactId, fetched 2026-10-04 -->

# POST CRM/Contact/{customerId}/PresentAccomodation/{contactId}

Nuvarande boende för en kontakt.

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id. | string | Krävs |
| contactId | Kontaktid. | string | Krävs |

## Body Parameters

Nuvarande boende [CrmPresentAccomodation](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Request_CrmPresentAccomodation)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| EstateType | Bostadstyp | [EstateType](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Request_EstateType) |  |
| LivingSpace | Boarea | decimal number |  |
| NumberOfRooms | Antal rum | decimal number |  |
| Price | Pris | decimal number |  |
| MonthlyCost | Månadskostnad (avgift/hyra) bara relevant för hyres- och bostadsrättsbostäder | integer |  |
| Other | Övrig information | string |  |
| Coordinate | Koordinater i koordinatsystemet WGS84 | [Wgs84Coordinate](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_Wgs84Coordinate) |  |
| MovedInDate | När flyttade man in i sitt nuvarande boende | date |  |

### Request Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json635)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml635)

```
{
  "estateType": "None",
  "livingSpace": 1.1,
  "numberOfRooms": 1.1,
  "price": 1.1,
  "monthlyCost": 1,
  "other": "sample string 1",
  "coordinate": {
    "longitude": 1.1,
    "latitude": 2.1
  },
  "movedInDate": "2026-10-04T13:51:30.6971344+02:00"
}
```

## Response Information

### Resource Description

Nuvarande boende för en kontakt. string

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json635)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml635)

```
"sample string 1"
```
