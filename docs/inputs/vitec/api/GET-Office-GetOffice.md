<!-- https://connect.maklare.vitec.net/Help/Api/GET-Office-GetOffice, fetched 2026-10-04 -->

# GET Office/GetOffice

För att kunna hämta företagen så krävs det en giltig API nyckel och ett kundid.

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| OfficeId | Unik identifierare på butiken | string |  |
| CustomerId | Kontorsid | string | Required |
| GroupId | Gruppid | string |  |

## Response Information

### Resource Description

Hämtar företag. Hämtar information om mäklarkontoret. Collection of [Office](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Office_Office)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Archived | Arkiverad | boolean |  |
| CustomerId | Kundid | string |  |
| OfficeId | Officeid | string |  |
| Name | Kontorets huvudsakliga namn | string |  |
| CustomerName | Företagsnamn | string |  |
| LegalCustomerName | Juridiskt företagsnamn | string |  |
| Address | Gatuadress | string |  |
| PostalAddress | Postadress | string |  |
| ZipCode | Postnummer | string |  |
| City | Ort | string |  |
| Telephone | Telefon | string |  |
| CompanyPlace | Företagets sätte | string |  |
| EmailAddress | E-postadress | string |  |
| HomePage | Hemsida | string |  |
| Description | Beskrivning Hemsida | string |  |
| CorporateNumber | Organisationsnummer | string |  |
| Bankgiro | Bankgiro | string |  |
| Postalgiro | Plusgiro | string |  |
| VAT | Momsregistreringsnummer | string |  |
| TaxCertificate | F-skattebevis nummer | string |  |
| Coordinate | Kordinater | [Coordinate](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_Coordinate) |  |
| Region | Region | integer |  |
| OfficeNumber | Internt kontorsnummer | integer |  |
| OfficeName | Internt kontorsnamn | string |  |
| Chain | Kedjetillhörighet | [Chain](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Office_Chain) |  |
| DateChanged | Ändringsdatum | date |  |
| PrimaryLeadReceiverId | Primär tips/lead mottagare | string |  |
| SubOffice | Kontoret är ett underkontor | boolean |  |
| Groups | Grupper företaget ingår. | Collection of [Group](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Office_Group) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json559)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml559)

```
[
  {
    "archived": true,
    "customerId": "sample string 2",
    "officeId": "sample string 3",
    "name": "sample string 4",
    "customerName": "sample string 5",
    "legalCustomerName": "sample string 6",
    "address": "sample string 7",
    "postalAddress": "sample string 8",
    "zipCode": "sample string 9",
    "city": "sample string 10",
    "telephone": "sample string 11",
    "companyPlace": "sample string 12",
    "emailAddress": "sample string 13",
    "homePage": "sample string 14",
    "description": "sample string 15",
    "corporateNumber": "sample string 16",
    "bankgiro": "sample string 17",
    "postalgiro": "sample string 18",
    "vat": "sample string 19",
    "taxCertificate": "sample string 20",
    "coordinate": {
      "longitud": 1.1,
      "latitud": 2.1
    },
    "region": 1,
    "officeNumber": 1,
    "officeName": "sample string 21",
    "chain": {
      "id": "sample string 1",
      "name": "sample string 2"
    },
    "dateChanged": "2026-10-04T13:53:35.5594097+02:00",
    "primaryLeadReceiverId": "sample string 23",
    "subOffice": true,
    "groups": [
      {
        "id": "sample string 1",
        "name": "sample string 2"
      },
      {
        "id": "sample string 1",
        "name": "sample string 2"
      }
    ]
  },
  {
    "archived": true,
    "customerId": "sample string 2",
    "officeId": "sample string 3",
    "name": "sample string 4",
    "customerName": "sample string 5",
    "legalCustomerName": "sample string 6",
    "address": "sample string 7",
    "postalAddress": "sample string 8",
    "zipCode": "sample string 9",
    "city": "sample string 10",
    "telephone": "sample string 11",
    "companyPlace": "sample string 12",
    "emailAddress": "sample string 13",
    "homePage": "sample string 14",
    "description": "sample string 15",
    "corporateNumber": "sample string 16",
    "bankgiro": "sample string 17",
    "postalgiro": "sample string 18",
    "vat": "sample string 19",
    "taxCertificate": "sample string 20",
    "coordinate": {
      "longitud": 1.1,
      "latitud": 2.1
    },
    "region": 1,
    "officeNumber": 1,
    "officeName": "sample string 21",
    "chain": {
      "id": "sample string 1",
      "name": "sample string 2"
    },
    "dateChanged": "2026-10-04T13:53:35.5594097+02:00",
    "primaryLeadReceiverId": "sample string 23",
    "subOffice": true,
    "groups": [
      {
        "id": "sample string 1",
        "name": "sample string 2"
      },
      {
        "id": "sample string 1",
        "name": "sample string 2"
      }
    ]
  }
]
```
