<!-- https://connect.maklare.vitec.net/Help/Api/GET-Meeting-customerId-id, fetched 2026-10-04 -->

# GET Meeting/{customerId}/{id}

Hämtar ett bokat möte

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id | string | Krävs |
| id | Mötets id | string | Krävs |

## Response Information

### Resource Description

Hämtar ett bokat möte [Meeting](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Meeting_Meeting)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Id | Mötesid | string |  |
| ContactId | Kontakt id | string |  |
| ContactName | Kontaktnamn | string |  |
| Address | Adress | [Address](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_Address) |  |
| TelePhone | Telefonnummer bostad | string |  |
| CellPhone | Telefonnummer | string |  |
| MeetingDate | Mötesdatum | date |  |
| Type | Mötestyp | [MeetingType](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Meeting_MeetingType) |  |
| State | Status på mötet | [MeetingState](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Meeting_MeetingState) |  |
| BrokerId | Mäklarens id | string |  |
| BrokerName | Mäklarens namn | string |  |
| BookedById | Bokarens id | string |  |
| BookedByName | Bokarens name | string |  |
| BookedDate | Bokningsdatum | date |  |
| SignatureDate | Uppdragsdatum | date |  |
| EstateStatus | Objektets status | [Status](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Common_Status) |  |
| CommissionWithoutTaxes | Provision ex.moms | decimal number |  |
| CommissionSource | Intagskälla (Kontakttyp) Ska inte användas längre. Använd AssignmentSource istället | string |  |
| AssignmentSource | Intagskälla (Kontakttyp) | [AssignmentSource](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Meeting_AssignmentSource) |  |
| CancelledBy | Avbokad av (Mäklare, Kund) | string |  |
| AgreementDate | Försäljning = Kontraktsdatum, Värdering = Värderingsdag, Skrivning = Datum för skrivuppdrag | date |  |
| CommissionType | Uppdragstyp | [CommissionType](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Enum_CommissionType) |  |
| AccessDate | Tillträdesdatum | date |  |
| EstateId | Objektets id | string |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json948)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml948)

```
{
  "id": "sample string 1",
  "contactId": "sample string 2",
  "contactName": "sample string 3",
  "address": {
    "streetAddress": "sample string 1",
    "zipCode": "sample string 2",
    "city": "sample string 3",
    "countryCode": "sample string 4"
  },
  "telePhone": "sample string 4",
  "cellPhone": "sample string 5",
  "meetingDate": "2026-10-04T13:51:42.199552+02:00",
  "type": "Assignment",
  "state": "Booked",
  "brokerId": "sample string 7",
  "brokerName": "sample string 8",
  "bookedById": "sample string 9",
  "bookedByName": "sample string 10",
  "bookedDate": "2026-10-04T13:51:42.199552+02:00",
  "signatureDate": "2026-10-04T13:51:42.199552+02:00",
  "estateStatus": {
    "id": "sample string 1",
    "name": "sample string 2"
  },
  "commissionWithoutTaxes": 12.0,
  "commissionSource": "sample string 13",
  "assignmentSource": {
    "id": 1,
    "name": "sample string 2"
  },
  "cancelledBy": "sample string 14",
  "agreementDate": "2026-10-04T13:51:42.199552+02:00",
  "commissionType": "Sale",
  "accessDate": "2026-10-04T13:51:42.199552+02:00",
  "estateId": "sample string 15"
}
```
