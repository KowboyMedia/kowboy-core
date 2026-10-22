<!-- https://connect.maklare.vitec.net/Help/Api/GET-Advertising-Office-customerId-officeId, fetched 2026-10-04 -->

# GET Advertising/Office/{customerId}/{officeId}

Hämta kontor för hemsida.

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id | string | Krävs |
| officeId | Kontorsid | string | Krävs |

## Response Information

### Resource Description

Hämta kontor för hemsida.

[AdvertisingOffice](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingOffice)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Id | Id | string |  |
| CustomerId | Kund-id | string |  |
| ChangedAt | Ändringsdatum | date |  |
| BrandId | Varumärkes-id | string |  |
| Name | Namn på kontoret | string |  |
| StreetAddress | Gatuadress/Besöksadress | string |  |
| ZipCode | Postnr | [AdvertisingZipCode](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingZipCode) |  |
| PostalTown | Ort | string |  |
| Telephone | Telefonnummer | [AdvertisingOfficeTelephoneNumbers](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingOfficeTelephoneNumbers) |  |
| EmailAddress | E-postadress | string |  |
| Seat | Säte | string |  |
| Description | Beskrivning | string |  |
| Coordinate | Koordinater | [Wgs84Coordinate](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_Wgs84Coordinate) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json526)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml526)

```
{
  "id": "sample string 1",
  "customerId": "sample string 2",
  "changedAt": "2026-10-04T08:16:45.4007623+02:00",
  "brandId": "sample string 3",
  "name": "sample string 4",
  "streetAddress": "sample string 5",
  "zipCode": {
    "numerical": 1,
    "value": "sample string 1"
  },
  "postalTown": "sample string 6",
  "telephone": {
    "switch": {
      "msisdn": "sample string 1",
      "display": "sample string 2"
    }
  },
  "emailAddress": "sample string 7",
  "seat": "sample string 8",
  "description": "sample string 9",
  "coordinate": {
    "longitude": 1.1,
    "latitude": 2.1
  }
}
```
