<!-- https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingAssociation, fetched 2026-10-04 -->

# AdvertisingAssociation

Bostadsrättsförening

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
