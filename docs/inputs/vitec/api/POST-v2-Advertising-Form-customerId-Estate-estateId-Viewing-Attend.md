<!-- https://connect.maklare.vitec.net/Help/Api/POST-v2-Advertising-Form-customerId-Estate-estateId-Viewing-Attend, fetched 2026-09-16 -->

# POST v2/Advertising/Form/{customerId}/Estate/{estateId}/Viewing/Attend

Lägg till en visningsdeltagare

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id | string | Krävs |
| estateId | Bostadsid | string | Krävs |

## Body Parameters

Anmälningsuppgifter [ViewingAttendeeApplication](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_ViewingAttendeeApplication)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| TimeSlotId | Id på tillfället som ska bokas | string |  |
| FirstName | Förnamn | string |  |
| LastName | Efternamn | string |  |
| Email | Epostadress | string |  |
| CellPhone | Mobiltelefonnummer | string |  |
| Address | Adressuppgifter, valfritt | [FormAddress](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_FormAddress) |  |
| Gdpr | GDPR uppgifter | [FormApplicationGdpr](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_FormApplicationGdpr) |  |
| Lead | Lead uppgifter | [FormApplicationLead](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_FormApplicationLead) |  |
| Confirmation | Bekräftelsehantering | [ViewingConfirmationOptions](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_ViewingConfirmationOptions) |  |
| Marketing | Marknadsföringsuppgifter som t ex UTM taggar | [FormMarketing](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_FormMarketing) |  |
| ReminderTime | Påminnelsetid (Minuter innan visning) | integer |  |
| Validation | Konfiguration av valideringsregler, lämna tom (null) om ni inte har särskilda regler | [ViewingAttendeeApplicationValidation](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_ViewingAttendeeApplicationValidation) |  |

### Request Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json673)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml673)

```

{
  "timeSlotId": "sample string 1",
  "firstName": "sample string 2",
  "lastName": "sample string 3",
  "email": "sample string 4",
  "cellPhone": "sample string 5",
  "address": {
    "streetAddress": "sample string 1",
    "zipCode": "sample string 2",
    "city": "sample string 3"
  },
  "gdpr": {
    "hasApproved": true
  },
  "lead": {
    "leadSourceId": "sample string 1",
    "message": "sample string 2"
  },
  "confirmation": {
    "isEmailEnabled": true,
    "isSmsEnabled": true
  },
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
  "reminderTime": 1,
  "validation": {
    "isBookingLimitEnabled": true,
    "isDeadLineEnabled": true
  }
}
```

## Response Information

### Resource Description

Lägg till en visningsdeltagare [AttendViewingResult](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AttendViewingResult)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| ContactId | Den bokade kontaktens id | string |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json673)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml673)

```

{
  "contactId": "sample string 1"
}
```
