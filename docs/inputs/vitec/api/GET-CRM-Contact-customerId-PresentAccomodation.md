<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-PresentAccomodation, fetched 2026-10-04 -->

# GET CRM/Contact/{customerId}/PresentAccomodation

Hämta lista av nuvarande boenden för kontakter, max 20 stycken kontakter åt gången. Om fler än 5 kontakt-ID:n anges, ska de skickas som query-parametrar.

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id. | string | Krävs |
| contactIds | Kontaktidn (kommaseparerade, max 20 stycken). | string | Krävs |

## Response Information

### Resource Description

Hämta lista av nuvarande boenden för kontakter, max 20 stycken kontakter åt gången. Om fler än 5 kontakt-ID:n anges, ska de skickas som query-parametrar. Collection of [CrmPresentAccomodation](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmPresentAccomodation)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| HasBeenAsked | Har blivit tillfrågad | boolean |  |
| EstateType | Bostadstyp | [EstateType](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_EstateType) |  |
| LivingSpace | Boarea | decimal number |  |
| NumberOfRooms | Antal rum | decimal number |  |
| Price | Pris | decimal number |  |
| Other | Övrig information | string |  |
| Coordinate | Koordinater i koordinatsystemet WGS84 | [Wgs84Coordinate](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_Wgs84Coordinate) |  |
| ChangedAt | Ändringsdatum | date |  |
| MovedInDate |  | date |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json260)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml260)

```
[
  {
    "hasBeenAsked": true,
    "estateType": "House",
    "livingSpace": 2.1,
    "numberOfRooms": 3.1,
    "price": 4.1,
    "other": "sample string 5",
    "coordinate": {
      "longitude": 1.1,
      "latitude": 2.1
    },
    "changedAt": "2026-10-04T13:51:31.3533925+02:00",
    "movedInDate": "2026-10-04T13:51:31.3533925+02:00"
  },
  {
    "hasBeenAsked": true,
    "estateType": "House",
    "livingSpace": 2.1,
    "numberOfRooms": 3.1,
    "price": 4.1,
    "other": "sample string 5",
    "coordinate": {
      "longitude": 1.1,
      "latitude": 2.1
    },
    "changedAt": "2026-10-04T13:51:31.3533925+02:00",
    "movedInDate": "2026-10-04T13:51:31.3533925+02:00"
  }
]
```
