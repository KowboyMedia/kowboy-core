<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Office-customerId-Sub-subOfficeIds, fetched 2026-10-04 -->

# GET CRM/Office/{customerId}/Sub/{subOfficeIds}

Hämta flera underkontor

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id | string | Krävs |
| subOfficeIds | Underkontorens idn | string | Krävs |

## Response Information

### Resource Description

Hämta flera underkontor Collection of [CrmSubOffice](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=CrmOffice_CrmSubOffice)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| CustomerId | Kundid | string |  |
| Id | Officeid | string |  |
| Name | Företagsnamn | string |  |
| LegalName | Juridiskt företagsnamn | string |  |
| Address | Gatuadress | string |  |
| PostalAddress | Postadress | string |  |
| ZipCode | Postnummer | string |  |
| City | Ort | string |  |
| Telephone | Telefon | string |  |
| CompanyPlace | Företagets sätte | string |  |
| EmailAddress | E-postadress | string |  |
| HomePage | Hemsida | string |  |
| CorporateNumber | Organisationsnummer | string |  |
| Bankgiro | Bankgiro | string |  |
| Postalgiro | Plusgiro | string |  |
| DateChanged | Ändringsdatum | date |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json230)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml230)

```
[
  {
    "customerId": "sample string 1",
    "id": "sample string 2",
    "name": "sample string 3",
    "legalName": "sample string 4",
    "address": "sample string 5",
    "postalAddress": "sample string 6",
    "zipCode": "sample string 7",
    "city": "sample string 8",
    "telephone": "sample string 9",
    "companyPlace": "sample string 10",
    "emailAddress": "sample string 11",
    "homePage": "sample string 12",
    "corporateNumber": "sample string 13",
    "bankgiro": "sample string 14",
    "postalgiro": "sample string 15",
    "dateChanged": "2026-10-04T13:53:35.2303509+02:00"
  },
  {
    "customerId": "sample string 1",
    "id": "sample string 2",
    "name": "sample string 3",
    "legalName": "sample string 4",
    "address": "sample string 5",
    "postalAddress": "sample string 6",
    "zipCode": "sample string 7",
    "city": "sample string 8",
    "telephone": "sample string 9",
    "companyPlace": "sample string 10",
    "emailAddress": "sample string 11",
    "homePage": "sample string 12",
    "corporateNumber": "sample string 13",
    "bankgiro": "sample string 14",
    "postalgiro": "sample string 15",
    "dateChanged": "2026-10-04T13:53:35.2303509+02:00"
  }
]
```
