<!-- https://connect.maklare.vitec.net/Help/Api/POST-CRM-Contact-customerId-contactId-NewAddress, fetched 2026-10-04 -->

# POST CRM/Contact/{customerId}/{contactId}/NewAddress

Uppdatera personens nya adress.

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id. | string | Krävs |
| contactId | Kontaktid. | string | Krävs |

## Body Parameters

Kontaktens nya adress [CrmPersonNewAddress](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmPersonNewAddress)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| StreetAddress | Gatuadress | string | Gatuaddress måste vara mellan 0 och 68 tecken |
| ZipCode | Postnummer | string | Postnummer måste vara mellan 0 och 15 tecken |
| City | Postort | string | Postort måste vara mellan 0 och 25 tecken |
| CountryCode | Landskod | string | Landskod måste vara mellan 0 och 2 tecken |
| NewAddressFrom |  | date |  |
| Type |  | [NewAddressType](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_NewAddressType) |  |
| EstateId |  | string |  |
| Latitude |  | decimal number |  |
| Longitude |  | decimal number |  |

### Request Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json73)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml73)

```
{
  "streetAddress": "sample string 1",
  "zipCode": "sample string 2",
  "city": "sample string 3",
  "countryCode": "sample string 4",
  "newAddressFrom": "2026-10-04T13:51:39.1361272+02:00",
  "type": "FromDate",
  "estateId": "sample string 5",
  "latitude": 1.1,
  "longitude": 1.1
}
```

## Response Information

### Resource Description

Uppdatera personens nya adress. string

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json73)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml73)

```
"sample string 1"
```
