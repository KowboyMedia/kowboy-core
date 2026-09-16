<!-- https://connect.maklare.vitec.net/Help/Api/GET-Advertising-Association-customerId-associationId, fetched 2026-09-16 -->

# GET Advertising/Association/{customerId}/{associationId}

Hämtar bostadsrättsförening

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId |  | string | Krävs |
| associationId |  | string | Krävs |

## Response Information

### Resource Description

Hämtar bostadsrättsförening [AdvertisingAssociation](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingAssociation)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Id | Id | string |  |
| ChangedAt | När föreningen senast ändrades | date |  |
| Name | Föreningsnamn | string |  |
| CorporateNumber | Organisationsnummer | string |  |
| OrganizationalForm | Organisationsform | [OrganizationalForm](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Association_OrganizationalForm) |  |
| Email | Epostadress | string |  |
| HomePage | Hemsida | string |  |
| GenuineAssociation | Äkta/oäkta bostadsrättsförening | [AssociationTaxation](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Association_AssociationTaxation) |  |
| NumberOfApartments | Antal lägenheter | integer |  |
| NumberOfRentalApartments | Varav hyresrätter | integer |  |
| NumberOfPremises | Antal lokaler | integer |  |
| Descriptions | Beskrivningar | [AssociationDescriptions](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Association_AssociationDescriptions) | Kan ersättas på objekt med OverridenDescriptions |
| Economy | Ekonomi | [AssociationEconomy](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Association_AssociationEconomy) | Kan ersättas på objekt med OverridenEconomy |
| PublicContact | Kontaktperson | [AssociationContact](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AssociationContact) | Kan vara null |
| Documents | Annonserade dokument | Collection of [Document](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Common_Document) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json360)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml360)

```

{
  "id": "sample string 1",
  "changedAt": "2026-09-16T05:56:27.3094809+02:00",
  "name": "sample string 3",
  "corporateNumber": "sample string 4",
  "organizationalForm": "TenantOwnedAssociation",
  "email": "sample string 5",
  "homePage": "sample string 6",
  "genuineAssociation": "Undetermined",
  "numberOfApartments": 1,
  "numberOfRentalApartments": 1,
  "numberOfPremises": 1,
  "descriptions": {
    "generalAboutAssociation": "sample string 1",
    "renovations": "sample string 2",
    "parking": "sample string 3",
    "tvAndBroadband": "sample string 4",
    "courtyard": "sample string 5",
    "sharedSpaces": "sample string 6",
    "insurance": "sample string 7",
    "other": "sample string 8"
  },
  "economy": {
    "monthlyFeeInformation": "sample string 1",
    "finances": "sample string 2",
    "sublettingPolicy": "sample string 3",
    "theAssociationOwnTheGround": "sample string 4",
    "transferFee": 1,
    "transferFeePaidBy": "Undetermined",
    "pledgeFee": 1,
    "allowLegalPersonAsBuyer": "Undetermined",
    "allowsSharedOwnershipInfo": "sample string 5"
  },
  "publicContact": {
    "name": "sample string 1",
    "cellPhone": "sample string 2",
    "otherPhone": "sample string 3",
    "email": "sample string 4"
  },
  "documents": [
    {
      "name": "sample string 1",
      "id": "sample string 2",
      "extension": "sample string 3",
      "url": "sample string 4",
      "dateChangedData": "2026-09-16T05:56:27.3094809+02:00",
      "category": "sample string 5"
    },
    {
      "name": "sample string 1",
      "id": "sample string 2",
      "extension": "sample string 3",
      "url": "sample string 4",
      "dateChangedData": "2026-09-16T05:56:27.3094809+02:00",
      "category": "sample string 5"
    }
  ]
}
```
