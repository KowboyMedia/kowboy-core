<!-- https://connect.maklare.vitec.net/Help/Api/POST-Advertising-Estate-customerId-estateId-FinalPriceWatched, fetched 2026-10-04 -->

# POST Advertising/Estate/{customerId}/{estateId}/FinalPriceWatched

Skickar in en ny bevakning av slutpris för en kontakt till en bostad. Innan nya personer läggs in i mäklarsystemet, görs alltid en dubblettkontroll.

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id | string | Krävs |
| estateId | Id för aktuell bostad | string | Krävs |

## Body Parameters

Uppgifter för bevakningen [AdvertisingFinalPriceWatchedApplication](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingFinalPriceWatchedApplication)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Person | Kontaktperson som leadet avser | [AdvertisingLeadPerson](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingLeadPerson) | En kontaktperson måste anges |
| ProspectiveBuyerStatus | Den status som kontakten ska få till bostaden om kontakten inte redan finns på bostaden | [AdvertisingFinalPriceWatchedProspectiveBuyerStatus](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingFinalPriceWatchedProspectiveBuyerStatus) |  |
| LeadSourceId | Leadskälla - Det lead som skapas i samband med intresseanmälan kommer att kopplas till aktuell leadskälla. Om fältet inte anges, kommer leadet att kopplas till en förvald leadskälla som används för intresseanmälningar. | string |  |
| Marketing | Marknadsföringsuppgifter som t ex UTM taggar | [FormMarketing](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_FormMarketing) |  |
| Message | Ett meddelande till mottagaren av leadet | string |  |

### Request Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json651)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml651)

```
{
  "person": {
    "firstName": "sample string 1",
    "lastName": "sample string 2",
    "socialSecurityNumber": "sample string 3",
    "isForeignSocialSecurityNumber": true,
    "address": {
      "streetAddress": "sample string 1",
      "zipCode": "sample string 2",
      "city": "sample string 3"
    },
    "email": {
      "emailAddress": "sample string 1",
      "emailAddress2": "sample string 2"
    },
    "telephone": {
      "home": "sample string 1",
      "work": "sample string 2",
      "cell": "sample string 3",
      "other": "sample string 4"
    }
  },
  "prospectiveBuyerStatus": "Assigned",
  "leadSourceId": "sample string 1",
  "marketing": {
    "referrer": "sample string 1",
    "utmTags": [
      {
        "name": "sample string 1",
        "value": "sample string 2"
      },
      {
        "name": "sample string 1",
        "value": "sample string 2"
      }
    ]
  },
  "message": "sample string 2"
}
```

## Response Information

### Resource Description

Skickar in en ny bevakning av slutpris för en kontakt till en bostad. Innan nya personer läggs in i mäklarsystemet, görs alltid en dubblettkontroll. string

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json651)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml651)

```
"sample string 1"
```
