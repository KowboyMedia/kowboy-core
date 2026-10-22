<!-- https://connect.maklare.vitec.net/Help/Api/POST-Meeting-GetMeetings, fetched 2026-10-04 -->

# POST Meeting/GetMeetings

Hämtar bokade möten.

## Request Information

## Body Parameters

Urval [MeetingCreateria](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Meeting_MeetingCreateria)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| CustomerId | Kund id | string | Kund id måste anges |
| DateFrom | Datum från | date | Datum från måste anges |
| DateTo | Datum till | date | Datum till måste anges |
| Search | Typ av mötesfiltrering. True resulterar i att filtrering blir på bokningsdatum. False resulterar i en filtrering på mötesdatum. | boolean |  |
| Type | Typ av möten. Om inget anges så hämtas endast intagsmöten (Assignment). | [MeetingTypeCriteria](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Meeting_MeetingTypeCriteria) |  |

### Request Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json276)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml276)

```
{
  "customerId": "sample string 1",
  "dateFrom": "2026-10-04T13:51:42.5309772+02:00",
  "dateTo": "2026-10-04T13:51:42.5309772+02:00",
  "search": true,
  "type": "Assignment"
}
```

## Response Information

### Resource Description

Hämtar bokade möten. Collection of [Meeting](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Meeting_Meeting)

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

- [application/json, text/json](https://connect.maklare.vitec.net#json276)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml276)

```
[
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
    "meetingDate": "2026-10-04T13:51:42.5309772+02:00",
    "type": "Assignment",
    "state": "Booked",
    "brokerId": "sample string 7",
    "brokerName": "sample string 8",
    "bookedById": "sample string 9",
    "bookedByName": "sample string 10",
    "bookedDate": "2026-10-04T13:51:42.5309772+02:00",
    "signatureDate": "2026-10-04T13:51:42.5309772+02:00",
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
    "agreementDate": "2026-10-04T13:51:42.5309772+02:00",
    "commissionType": "Sale",
    "accessDate": "2026-10-04T13:51:42.5309772+02:00",
    "estateId": "sample string 15"
  },
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
    "meetingDate": "2026-10-04T13:51:42.5309772+02:00",
    "type": "Assignment",
    "state": "Booked",
    "brokerId": "sample string 7",
    "brokerName": "sample string 8",
    "bookedById": "sample string 9",
    "bookedByName": "sample string 10",
    "bookedDate": "2026-10-04T13:51:42.5309772+02:00",
    "signatureDate": "2026-10-04T13:51:42.5309772+02:00",
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
    "agreementDate": "2026-10-04T13:51:42.5309772+02:00",
    "commissionType": "Sale",
    "accessDate": "2026-10-04T13:51:42.5309772+02:00",
    "estateId": "sample string 15"
  }
]
```
