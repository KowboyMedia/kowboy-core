<!-- https://connect.maklare.vitec.net/Help/Api/POST-Advertising-Estate-customerId-estateId-interest, fetched 2026-09-16 -->

# POST Advertising/Estate/{customerId}/{estateId}/interest

Skickar in en ny intresseanmälan för en kontakt till en bostad. Innan nya personer läggs in i mäklarsystemet, görs alltid en dubblettkontroll.

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id | string | Krävs |
| estateId | Id för aktuell bostad | string | Krävs |

## Body Parameters

Uppgifter för intresseanmälan [AdvertisingInterestApplication](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingInterestApplication)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| LeadSourceId | Leadskälla - Det lead som skapas i samband med intresseanmälan kommer att kopplas till aktuell leadskälla. Om fältet inte anges, kommer leadet att kopplas till en förvald leadskälla som används för intresseanmälningar. | string |  |
| AssignmentSourceId | Intagskälla för den bostad som personen eventuellt lämnar. Skall bara anges om angiven leadskälla används för att koppla leadet till en bostad som kontaktpersonen eventuellt skall sälja. | string |  |
| Marketing | Marknadsföringsuppgifter som t ex UTM taggar | [FormMarketing](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_FormMarketing) |  |
| FirstName | Förnamn | string | Förnamn krävs Förnamn måste vara mellan 1 och 40 tecken |
| LastName | Efternamn | string | Efternamn krävs Efternamn måste vara mellan 1 och 40 tecken |
| SocialSecurityNumber | Personnummer | string | Personnummer måste vara mellan 0 och 20 tecken |
| IsForeignSocialSecurityNumber | Annat format/utländskt personnummer | boolean |  |
| Address | Adress | [ContactAddress](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=InterestApplication_ContactAddress) |  |
| Telephone | Telefonnummer | [PersonTelephoneNumbers](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_PersonTelephoneNumbers) | Epostadress, telefonnummer (bostad eller arbete) eller mobilnummer måste anges. |
| Email | Email | [Email](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_Email) | Epostadress, telefonnummer (bostad eller arbete) eller mobilnummer måste anges. |
| GDPRApprovalDate | GDPR informerad den | date |  |
| PresentAccommodation | Uppgifter om nuvarande boende | [ContactPresentAccommodation](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=InterestApplication_ContactPresentAccommodation) |  |
| ContactMessage | Meddelande från kontaktpersonen | string |  |
| Status | Status | [Status](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=InterestApplication_Status) |  |

### Request Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json877)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml877)

```

{
  "leadSourceId": "sample string 1",
  "assignmentSourceId": "sample string 2",
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
  "firstName": "sample string 3",
  "lastName": "sample string 4",
  "socialSecurityNumber": "sample string 5",
  "isForeignSocialSecurityNumber": true,
  "address": {
    "streetAddress": "sample string 1",
    "zipCode": "sample string 2",
    "city": "sample string 3"
  },
  "telephone": {
    "home": "sample string 1",
    "work": "sample string 2",
    "cell": "sample string 3",
    "other": "sample string 4"
  },
  "email": {
    "emailAddress": "sample string 1",
    "emailAddress2": "sample string 2"
  },
  "gdprApprovalDate": "2026-09-16T05:55:43.35153+02:00",
  "presentAccommodation": {
    "estateType": "House",
    "livingSpace": 1.1,
    "numberOfRooms": 1.1,
    "price": 1.1,
    "other": "sample string 1",
    "coordinate": {
      "longitud": 1.1,
      "latitud": 2.1
    }
  },
  "contactMessage": "sample string 6",
  "status": "Interested"
}
```

## Response Information

### Resource Description

Skickar in en ny intresseanmälan för en kontakt till en bostad. Innan nya personer läggs in i mäklarsystemet, görs alltid en dubblettkontroll.

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input
