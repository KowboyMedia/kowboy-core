<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-PresentAccomodation-contactId, fetched 2026-10-04 -->

# GET CRM/Contact/{customerId}/PresentAccomodation/{contactId}

Hämta nuvarande boende för en kontakt.

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id. | string | Krävs |
| contactId | Kontaktid. | string | Krävs |

## Response Information

### Resource Description

Hämta nuvarande boende för en kontakt. [CrmPresentAccomodation](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmPresentAccomodation)

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

- [application/json, text/json](https://connect.maklare.vitec.net#json401)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml401)

```
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
  "changedAt": "2026-10-04T13:51:30.4813346+02:00",
  "movedInDate": "2026-10-04T13:51:30.4813346+02:00"
}
```
