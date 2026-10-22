<!-- https://connect.maklare.vitec.net/Help/Api/POST-Contacts-GetContacts, fetched 2026-10-04 -->

# POST Contacts/GetContacts

Hämta kontaktlista. För att kunna hämta en kontaktlista så krävs det en giltig API nyckel och ett kundid. Personlistans personer har en lista av önskemål (LookingForAccommodation). Denna lista är ej längre populerad. En persons önskemål får hämtas vi de metoder som är dedikerade till önskemål.

## Request Information

## Body Parameters

Urval [ContactCriteria](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Contact_ContactCriteria)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| CustomerId | Om kontakt id ska tillhöra en specifikt kontor | string | Kundid måste vara mellan 0 och 40 tecken |
| ContactId | Kontaktid | Collection of string |  |
| UserId | Urval på användarid | string |  |
| Categories | Urval på kategorier | Collection of string |  |
| EmailAddresses | Urval på epostadress | Collection of string |  |
| ContractDateFrom | Kontraktdatum från | date |  |
| ContractDateTo | Kontraktdatum till | date |  |
| ViewingDateFrom | Visiningsdatum från | date |  |
| ViewingDateTo | Visiningsdatum till | date |  |
| BiddingDateFrom | Budgivningsdatum från | date |  |
| BiddingDateTo | Budgivningsdatum till | date |  |
| CreatedDateFrom | Skapatdatum från | date |  |
| CreatedDateTo | Skapatdatum till | date |  |
| ChangedDateFrom | Ändringsdatum från | date |  |
| ChangedDateTo | Ändringsdatum till | date |  |
| SellerRelationDateFrom | Från datum kopplad som säljare på objekt | date |  |
| SellerRelationDateTo | Till datum kopplad som säljare på objekt | date |  |
| BuyerRelationDateFrom | Från datum kopplad som köpare på objekt | date |  |
| BuyerRelationDateTo | Till datum kopplad som köpare på objekt | date |  |
| CustomField | Egendefinerat fält | [FieldValueCriteria](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=CustomField_FieldValueCriteria) |  |
| SocialSecurityNumber | Personnummer | string |  |

### Request Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json745)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml745)

```
{
  "customerId": "sample string 1",
  "contactId": [
    "sample string 1",
    "sample string 2"
  ],
  "userId": "sample string 2",
  "categories": [
    "sample string 1",
    "sample string 2"
  ],
  "emailAddresses": [
    "sample string 1",
    "sample string 2"
  ],
  "contractDateFrom": "2026-10-04T13:53:32.6990353+02:00",
  "contractDateTo": "2026-10-04T13:53:32.6990353+02:00",
  "viewingDateFrom": "2026-10-04T13:53:32.6990353+02:00",
  "viewingDateTo": "2026-10-04T13:53:32.6990353+02:00",
  "biddingDateFrom": "2026-10-04T13:53:32.6990353+02:00",
  "biddingDateTo": "2026-10-04T13:53:32.6990353+02:00",
  "createdDateFrom": "2026-10-04T13:53:32.6990353+02:00",
  "createdDateTo": "2026-10-04T13:53:32.6990353+02:00",
  "changedDateFrom": "2026-10-04T13:53:32.6990353+02:00",
  "changedDateTo": "2026-10-04T13:53:32.6990353+02:00",
  "sellerRelationDateFrom": "2026-10-04T13:53:32.6990353+02:00",
  "sellerRelationDateTo": "2026-10-04T13:53:32.6990353+02:00",
  "buyerRelationDateFrom": "2026-10-04T13:53:32.6990353+02:00",
  "buyerRelationDateTo": "2026-10-04T13:53:32.6990353+02:00",
  "customField": {
    "name": "sample string 1",
    "value": "sample string 2"
  },
  "socialSecurityNumber": "sample string 3"
}
```

## Response Information

### Resource Description

Hämtar lista över kontakter. Collection of [ContactCollection](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Contact_ContactCollection)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| CustomerId | Kundid | string |  |
| Persons | Lista av personkontakter | Collection of [Person](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Contact_Person) |  |
| Estates | Lista av dödsbon | Collection of [Estate](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Contact_Estate) |  |
| Companies | Lista av företagskontakter | Collection of [Company](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Contact_Company) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json745)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml745)

```
[
  {
    "customerId": "sample string 1",
    "persons": [
      {
        "lookingForAccommodation": [
          {
            "id": "sample string 1",
            "areaIds": [
              "sample string 1",
              "sample string 2"
            ],
            "countys": [
              "sample string 1",
              "sample string 2"
            ],
            "countryCode": "sample string 2",
            "polygon": [
              {
                "longitud": 1.1,
                "latitud": 2.1
              },
              {
                "longitud": 1.1,
                "latitud": 2.1
              }
            ],
            "foreignProperty": true,
            "house": true,
            "rowHouse": true,
            "housingCooperative": true,
            "cottage": true,
            "premises": true,
            "plot": true,
            "farm": true,
            "tenancy": true,
            "otherHousing": true,
            "livingSpace": {
              "min": 1.1,
              "max": 1.1
            },
            "numberOfRooms": {
              "min": 1.1,
              "max": 1.1
            },
            "price": {
              "min": 1.1,
              "max": 1.1
            },
            "plotArea": {
              "min": 1.1,
              "max": 1.1
            },
            "specialRequset": "sample string 13",
            "increasedRequirementIDs": [
              "sample string 1",
              "sample string 2"
            ],
            "active": true
          },
          {
            "id": "sample string 1",
            "areaIds": [
              "sample string 1",
              "sample string 2"
            ],
            "countys": [
              "sample string 1",
              "sample string 2"
            ],
            "countryCode": "sample string 2",
            "polygon": [
              {
                "longitud": 1.1,
                "latitud": 2.1
              },
              {
                "longitud": 1.1,
                "latitud": 2.1
              }
            ],
            "foreignProperty": true,
            "house": true,
            "rowHouse": true,
            "housingCooperative": true,
            "cottage": true,
            "premises": true,
            "plot": true,
            "farm": true,
            "tenancy": true,
            "otherHousing": true,
            "livingSpace": {
              "min": 1.1,
              "max": 1.1
            },
            "numberOfRooms": {
              "min": 1.1,
              "max": 1.1
            },
            "price": {
              "min": 1.1,
              "max": 1.1
            },
            "plotArea": {
              "min": 1.1,
              "max": 1.1
            },
            "specialRequset": "sample string 13",
            "increasedRequirementIDs": [
              "sample string 1",
              "sample string 2"
            ],
            "active": true
          }
        ],
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
        "buyerOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House"
          },
          {
            "estateId": "sample string 1",
            "type": "House"
          }
        ],
        "sellerOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House"
          },
          {
            "estateId": "sample string 1",
            "type": "House"
          }
        ],
        "interestOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House",
            "estateType": "House",
            "viewing": true,
            "bidder": true,
            "interestLevel": "Reserved"
          },
          {
            "estateId": "sample string 1",
            "type": "House",
            "estateType": "House",
            "viewing": true,
            "bidder": true,
            "interestLevel": "Reserved"
          }
        ],
        "firstName": "sample string 1",
        "lastName": "sample string 2",
        "socialSecurityNumber": "sample string 3",
        "telePhone": "sample string 4",
        "workPhone": "sample string 5",
        "cellPhone": "sample string 6",
        "gdprApprovalDate": "2026-10-04T13:53:32.6990353+02:00",
        "obtainThrough": "sample string 7",
        "brokerId": "sample string 8",
        "contactId": "sample string 9",
        "customerId": "sample string 10",
        "customFields": [
          {
            "label": "sample string 1",
            "name": "sample string 2",
            "value": "sample string 3"
          },
          {
            "label": "sample string 1",
            "name": "sample string 2",
            "value": "sample string 3"
          }
        ],
        "categories": [
          {
            "id": "sample string 1",
            "name": "sample string 2",
            "readOnly": true
          },
          {
            "id": "sample string 1",
            "name": "sample string 2",
            "readOnly": true
          }
        ],
        "address": {
          "streetAddress": "sample string 1",
          "zipCode": "sample string 2",
          "city": "sample string 3",
          "countryCode": "sample string 4"
        },
        "email": {
          "emailAddress": "sample string 1",
          "emailAddress2": "sample string 2"
        },
        "otherPhone": "sample string 11",
        "wishAdvertising": true,
        "note": "sample string 13",
        "coordinate": {
          "longitud": 1.1,
          "latitud": 2.1
        },
        "createdAt": "2026-10-04T13:53:32.6990353+02:00",
        "changedAt": "2026-10-04T13:53:32.6990353+02:00"
      },
      {
        "lookingForAccommodation": [
          {
            "id": "sample string 1",
            "areaIds": [
              "sample string 1",
              "sample string 2"
            ],
            "countys": [
              "sample string 1",
              "sample string 2"
            ],
            "countryCode": "sample string 2",
            "polygon": [
              {
                "longitud": 1.1,
                "latitud": 2.1
              },
              {
                "longitud": 1.1,
                "latitud": 2.1
              }
            ],
            "foreignProperty": true,
            "house": true,
            "rowHouse": true,
            "housingCooperative": true,
            "cottage": true,
            "premises": true,
            "plot": true,
            "farm": true,
            "tenancy": true,
            "otherHousing": true,
            "livingSpace": {
              "min": 1.1,
              "max": 1.1
            },
            "numberOfRooms": {
              "min": 1.1,
              "max": 1.1
            },
            "price": {
              "min": 1.1,
              "max": 1.1
            },
            "plotArea": {
              "min": 1.1,
              "max": 1.1
            },
            "specialRequset": "sample string 13",
            "increasedRequirementIDs": [
              "sample string 1",
              "sample string 2"
            ],
            "active": true
          },
          {
            "id": "sample string 1",
            "areaIds": [
              "sample string 1",
              "sample string 2"
            ],
            "countys": [
              "sample string 1",
              "sample string 2"
            ],
            "countryCode": "sample string 2",
            "polygon": [
              {
                "longitud": 1.1,
                "latitud": 2.1
              },
              {
                "longitud": 1.1,
                "latitud": 2.1
              }
            ],
            "foreignProperty": true,
            "house": true,
            "rowHouse": true,
            "housingCooperative": true,
            "cottage": true,
            "premises": true,
            "plot": true,
            "farm": true,
            "tenancy": true,
            "otherHousing": true,
            "livingSpace": {
              "min": 1.1,
              "max": 1.1
            },
            "numberOfRooms": {
              "min": 1.1,
              "max": 1.1
            },
            "price": {
              "min": 1.1,
              "max": 1.1
            },
            "plotArea": {
              "min": 1.1,
              "max": 1.1
            },
            "specialRequset": "sample string 13",
            "increasedRequirementIDs": [
              "sample string 1",
              "sample string 2"
            ],
            "active": true
          }
        ],
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
        "buyerOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House"
          },
          {
            "estateId": "sample string 1",
            "type": "House"
          }
        ],
        "sellerOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House"
          },
          {
            "estateId": "sample string 1",
            "type": "House"
          }
        ],
        "interestOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House",
            "estateType": "House",
            "viewing": true,
            "bidder": true,
            "interestLevel": "Reserved"
          },
          {
            "estateId": "sample string 1",
            "type": "House",
            "estateType": "House",
            "viewing": true,
            "bidder": true,
            "interestLevel": "Reserved"
          }
        ],
        "firstName": "sample string 1",
        "lastName": "sample string 2",
        "socialSecurityNumber": "sample string 3",
        "telePhone": "sample string 4",
        "workPhone": "sample string 5",
        "cellPhone": "sample string 6",
        "gdprApprovalDate": "2026-10-04T13:53:32.6990353+02:00",
        "obtainThrough": "sample string 7",
        "brokerId": "sample string 8",
        "contactId": "sample string 9",
        "customerId": "sample string 10",
        "customFields": [
          {
            "label": "sample string 1",
            "name": "sample string 2",
            "value": "sample string 3"
          },
          {
            "label": "sample string 1",
            "name": "sample string 2",
            "value": "sample string 3"
          }
        ],
        "categories": [
          {
            "id": "sample string 1",
            "name": "sample string 2",
            "readOnly": true
          },
          {
            "id": "sample string 1",
            "name": "sample string 2",
            "readOnly": true
          }
        ],
        "address": {
          "streetAddress": "sample string 1",
          "zipCode": "sample string 2",
          "city": "sample string 3",
          "countryCode": "sample string 4"
        },
        "email": {
          "emailAddress": "sample string 1",
          "emailAddress2": "sample string 2"
        },
        "otherPhone": "sample string 11",
        "wishAdvertising": true,
        "note": "sample string 13",
        "coordinate": {
          "longitud": 1.1,
          "latitud": 2.1
        },
        "createdAt": "2026-10-04T13:53:32.6990353+02:00",
        "changedAt": "2026-10-04T13:53:32.6990353+02:00"
      }
    ],
    "estates": [
      {
        "lookingForAccommodation": [
          {
            "id": "sample string 1",
            "areaIds": [
              "sample string 1",
              "sample string 2"
            ],
            "countys": [
              "sample string 1",
              "sample string 2"
            ],
            "countryCode": "sample string 2",
            "polygon": [
              {
                "longitud": 1.1,
                "latitud": 2.1
              },
              {
                "longitud": 1.1,
                "latitud": 2.1
              }
            ],
            "foreignProperty": true,
            "house": true,
            "rowHouse": true,
            "housingCooperative": true,
            "cottage": true,
            "premises": true,
            "plot": true,
            "farm": true,
            "tenancy": true,
            "otherHousing": true,
            "livingSpace": {
              "min": 1.1,
              "max": 1.1
            },
            "numberOfRooms": {
              "min": 1.1,
              "max": 1.1
            },
            "price": {
              "min": 1.1,
              "max": 1.1
            },
            "plotArea": {
              "min": 1.1,
              "max": 1.1
            },
            "specialRequset": "sample string 13",
            "increasedRequirementIDs": [
              "sample string 1",
              "sample string 2"
            ],
            "active": true
          },
          {
            "id": "sample string 1",
            "areaIds": [
              "sample string 1",
              "sample string 2"
            ],
            "countys": [
              "sample string 1",
              "sample string 2"
            ],
            "countryCode": "sample string 2",
            "polygon": [
              {
                "longitud": 1.1,
                "latitud": 2.1
              },
              {
                "longitud": 1.1,
                "latitud": 2.1
              }
            ],
            "foreignProperty": true,
            "house": true,
            "rowHouse": true,
            "housingCooperative": true,
            "cottage": true,
            "premises": true,
            "plot": true,
            "farm": true,
            "tenancy": true,
            "otherHousing": true,
            "livingSpace": {
              "min": 1.1,
              "max": 1.1
            },
            "numberOfRooms": {
              "min": 1.1,
              "max": 1.1
            },
            "price": {
              "min": 1.1,
              "max": 1.1
            },
            "plotArea": {
              "min": 1.1,
              "max": 1.1
            },
            "specialRequset": "sample string 13",
            "increasedRequirementIDs": [
              "sample string 1",
              "sample string 2"
            ],
            "active": true
          }
        ],
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
        "buyerOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House"
          },
          {
            "estateId": "sample string 1",
            "type": "House"
          }
        ],
        "sellerOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House"
          },
          {
            "estateId": "sample string 1",
            "type": "House"
          }
        ],
        "interestOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House",
            "estateType": "House",
            "viewing": true,
            "bidder": true,
            "interestLevel": "Reserved"
          },
          {
            "estateId": "sample string 1",
            "type": "House",
            "estateType": "House",
            "viewing": true,
            "bidder": true,
            "interestLevel": "Reserved"
          }
        ],
        "name": "sample string 1",
        "socialSecurityNumber": "sample string 2",
        "telePhone": "sample string 3",
        "workPhone": "sample string 4",
        "cellPhone": "sample string 5",
        "brokerId": "sample string 6",
        "contactId": "sample string 7",
        "customerId": "sample string 8",
        "customFields": [
          {
            "label": "sample string 1",
            "name": "sample string 2",
            "value": "sample string 3"
          },
          {
            "label": "sample string 1",
            "name": "sample string 2",
            "value": "sample string 3"
          }
        ],
        "categories": [
          {
            "id": "sample string 1",
            "name": "sample string 2",
            "readOnly": true
          },
          {
            "id": "sample string 1",
            "name": "sample string 2",
            "readOnly": true
          }
        ],
        "address": {
          "streetAddress": "sample string 1",
          "zipCode": "sample string 2",
          "city": "sample string 3",
          "countryCode": "sample string 4"
        },
        "email": {
          "emailAddress": "sample string 1",
          "emailAddress2": "sample string 2"
        },
        "otherPhone": "sample string 9",
        "wishAdvertising": true,
        "note": "sample string 11",
        "coordinate": {
          "longitud": 1.1,
          "latitud": 2.1
        },
        "createdAt": "2026-10-04T13:53:32.6990353+02:00",
        "changedAt": "2026-10-04T13:53:32.6990353+02:00"
      },
      {
        "lookingForAccommodation": [
          {
            "id": "sample string 1",
            "areaIds": [
              "sample string 1",
              "sample string 2"
            ],
            "countys": [
              "sample string 1",
              "sample string 2"
            ],
            "countryCode": "sample string 2",
            "polygon": [
              {
                "longitud": 1.1,
                "latitud": 2.1
              },
              {
                "longitud": 1.1,
                "latitud": 2.1
              }
            ],
            "foreignProperty": true,
            "house": true,
            "rowHouse": true,
            "housingCooperative": true,
            "cottage": true,
            "premises": true,
            "plot": true,
            "farm": true,
            "tenancy": true,
            "otherHousing": true,
            "livingSpace": {
              "min": 1.1,
              "max": 1.1
            },
            "numberOfRooms": {
              "min": 1.1,
              "max": 1.1
            },
            "price": {
              "min": 1.1,
              "max": 1.1
            },
            "plotArea": {
              "min": 1.1,
              "max": 1.1
            },
            "specialRequset": "sample string 13",
            "increasedRequirementIDs": [
              "sample string 1",
              "sample string 2"
            ],
            "active": true
          },
          {
            "id": "sample string 1",
            "areaIds": [
              "sample string 1",
              "sample string 2"
            ],
            "countys": [
              "sample string 1",
              "sample string 2"
            ],
            "countryCode": "sample string 2",
            "polygon": [
              {
                "longitud": 1.1,
                "latitud": 2.1
              },
              {
                "longitud": 1.1,
                "latitud": 2.1
              }
            ],
            "foreignProperty": true,
            "house": true,
            "rowHouse": true,
            "housingCooperative": true,
            "cottage": true,
            "premises": true,
            "plot": true,
            "farm": true,
            "tenancy": true,
            "otherHousing": true,
            "livingSpace": {
              "min": 1.1,
              "max": 1.1
            },
            "numberOfRooms": {
              "min": 1.1,
              "max": 1.1
            },
            "price": {
              "min": 1.1,
              "max": 1.1
            },
            "plotArea": {
              "min": 1.1,
              "max": 1.1
            },
            "specialRequset": "sample string 13",
            "increasedRequirementIDs": [
              "sample string 1",
              "sample string 2"
            ],
            "active": true
          }
        ],
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
        "buyerOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House"
          },
          {
            "estateId": "sample string 1",
            "type": "House"
          }
        ],
        "sellerOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House"
          },
          {
            "estateId": "sample string 1",
            "type": "House"
          }
        ],
        "interestOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House",
            "estateType": "House",
            "viewing": true,
            "bidder": true,
            "interestLevel": "Reserved"
          },
          {
            "estateId": "sample string 1",
            "type": "House",
            "estateType": "House",
            "viewing": true,
            "bidder": true,
            "interestLevel": "Reserved"
          }
        ],
        "name": "sample string 1",
        "socialSecurityNumber": "sample string 2",
        "telePhone": "sample string 3",
        "workPhone": "sample string 4",
        "cellPhone": "sample string 5",
        "brokerId": "sample string 6",
        "contactId": "sample string 7",
        "customerId": "sample string 8",
        "customFields": [
          {
            "label": "sample string 1",
            "name": "sample string 2",
            "value": "sample string 3"
          },
          {
            "label": "sample string 1",
            "name": "sample string 2",
            "value": "sample string 3"
          }
        ],
        "categories": [
          {
            "id": "sample string 1",
            "name": "sample string 2",
            "readOnly": true
          },
          {
            "id": "sample string 1",
            "name": "sample string 2",
            "readOnly": true
          }
        ],
        "address": {
          "streetAddress": "sample string 1",
          "zipCode": "sample string 2",
          "city": "sample string 3",
          "countryCode": "sample string 4"
        },
        "email": {
          "emailAddress": "sample string 1",
          "emailAddress2": "sample string 2"
        },
        "otherPhone": "sample string 9",
        "wishAdvertising": true,
        "note": "sample string 11",
        "coordinate": {
          "longitud": 1.1,
          "latitud": 2.1
        },
        "createdAt": "2026-10-04T13:53:32.6990353+02:00",
        "changedAt": "2026-10-04T13:53:32.6990353+02:00"
      }
    ],
    "companies": [
      {
        "lookingForAccommodation": [
          {
            "id": "sample string 1",
            "areaIds": [
              "sample string 1",
              "sample string 2"
            ],
            "countys": [
              "sample string 1",
              "sample string 2"
            ],
            "countryCode": "sample string 2",
            "polygon": [
              {
                "longitud": 1.1,
                "latitud": 2.1
              },
              {
                "longitud": 1.1,
                "latitud": 2.1
              }
            ],
            "foreignProperty": true,
            "house": true,
            "rowHouse": true,
            "housingCooperative": true,
            "cottage": true,
            "premises": true,
            "plot": true,
            "farm": true,
            "tenancy": true,
            "otherHousing": true,
            "livingSpace": {
              "min": 1.1,
              "max": 1.1
            },
            "numberOfRooms": {
              "min": 1.1,
              "max": 1.1
            },
            "price": {
              "min": 1.1,
              "max": 1.1
            },
            "plotArea": {
              "min": 1.1,
              "max": 1.1
            },
            "specialRequset": "sample string 13",
            "increasedRequirementIDs": [
              "sample string 1",
              "sample string 2"
            ],
            "active": true
          },
          {
            "id": "sample string 1",
            "areaIds": [
              "sample string 1",
              "sample string 2"
            ],
            "countys": [
              "sample string 1",
              "sample string 2"
            ],
            "countryCode": "sample string 2",
            "polygon": [
              {
                "longitud": 1.1,
                "latitud": 2.1
              },
              {
                "longitud": 1.1,
                "latitud": 2.1
              }
            ],
            "foreignProperty": true,
            "house": true,
            "rowHouse": true,
            "housingCooperative": true,
            "cottage": true,
            "premises": true,
            "plot": true,
            "farm": true,
            "tenancy": true,
            "otherHousing": true,
            "livingSpace": {
              "min": 1.1,
              "max": 1.1
            },
            "numberOfRooms": {
              "min": 1.1,
              "max": 1.1
            },
            "price": {
              "min": 1.1,
              "max": 1.1
            },
            "plotArea": {
              "min": 1.1,
              "max": 1.1
            },
            "specialRequset": "sample string 13",
            "increasedRequirementIDs": [
              "sample string 1",
              "sample string 2"
            ],
            "active": true
          }
        ],
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
        "buyerOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House"
          },
          {
            "estateId": "sample string 1",
            "type": "House"
          }
        ],
        "sellerOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House"
          },
          {
            "estateId": "sample string 1",
            "type": "House"
          }
        ],
        "interestOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House",
            "estateType": "House",
            "viewing": true,
            "bidder": true,
            "interestLevel": "Reserved"
          },
          {
            "estateId": "sample string 1",
            "type": "House",
            "estateType": "House",
            "viewing": true,
            "bidder": true,
            "interestLevel": "Reserved"
          }
        ],
        "companyName": "sample string 1",
        "corporateNumber": "sample string 2",
        "homePage": "sample string 3",
        "switchPhone": "sample string 4",
        "brokerId": "sample string 5",
        "contactId": "sample string 6",
        "customerId": "sample string 7",
        "customFields": [
          {
            "label": "sample string 1",
            "name": "sample string 2",
            "value": "sample string 3"
          },
          {
            "label": "sample string 1",
            "name": "sample string 2",
            "value": "sample string 3"
          }
        ],
        "categories": [
          {
            "id": "sample string 1",
            "name": "sample string 2",
            "readOnly": true
          },
          {
            "id": "sample string 1",
            "name": "sample string 2",
            "readOnly": true
          }
        ],
        "address": {
          "streetAddress": "sample string 1",
          "zipCode": "sample string 2",
          "city": "sample string 3",
          "countryCode": "sample string 4"
        },
        "email": {
          "emailAddress": "sample string 1",
          "emailAddress2": "sample string 2"
        },
        "otherPhone": "sample string 8",
        "wishAdvertising": true,
        "note": "sample string 10",
        "coordinate": {
          "longitud": 1.1,
          "latitud": 2.1
        },
        "createdAt": "2026-10-04T13:53:32.6990353+02:00",
        "changedAt": "2026-10-04T13:53:32.6990353+02:00"
      },
      {
        "lookingForAccommodation": [
          {
            "id": "sample string 1",
            "areaIds": [
              "sample string 1",
              "sample string 2"
            ],
            "countys": [
              "sample string 1",
              "sample string 2"
            ],
            "countryCode": "sample string 2",
            "polygon": [
              {
                "longitud": 1.1,
                "latitud": 2.1
              },
              {
                "longitud": 1.1,
                "latitud": 2.1
              }
            ],
            "foreignProperty": true,
            "house": true,
            "rowHouse": true,
            "housingCooperative": true,
            "cottage": true,
            "premises": true,
            "plot": true,
            "farm": true,
            "tenancy": true,
            "otherHousing": true,
            "livingSpace": {
              "min": 1.1,
              "max": 1.1
            },
            "numberOfRooms": {
              "min": 1.1,
              "max": 1.1
            },
            "price": {
              "min": 1.1,
              "max": 1.1
            },
            "plotArea": {
              "min": 1.1,
              "max": 1.1
            },
            "specialRequset": "sample string 13",
            "increasedRequirementIDs": [
              "sample string 1",
              "sample string 2"
            ],
            "active": true
          },
          {
            "id": "sample string 1",
            "areaIds": [
              "sample string 1",
              "sample string 2"
            ],
            "countys": [
              "sample string 1",
              "sample string 2"
            ],
            "countryCode": "sample string 2",
            "polygon": [
              {
                "longitud": 1.1,
                "latitud": 2.1
              },
              {
                "longitud": 1.1,
                "latitud": 2.1
              }
            ],
            "foreignProperty": true,
            "house": true,
            "rowHouse": true,
            "housingCooperative": true,
            "cottage": true,
            "premises": true,
            "plot": true,
            "farm": true,
            "tenancy": true,
            "otherHousing": true,
            "livingSpace": {
              "min": 1.1,
              "max": 1.1
            },
            "numberOfRooms": {
              "min": 1.1,
              "max": 1.1
            },
            "price": {
              "min": 1.1,
              "max": 1.1
            },
            "plotArea": {
              "min": 1.1,
              "max": 1.1
            },
            "specialRequset": "sample string 13",
            "increasedRequirementIDs": [
              "sample string 1",
              "sample string 2"
            ],
            "active": true
          }
        ],
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
        "buyerOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House"
          },
          {
            "estateId": "sample string 1",
            "type": "House"
          }
        ],
        "sellerOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House"
          },
          {
            "estateId": "sample string 1",
            "type": "House"
          }
        ],
        "interestOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House",
            "estateType": "House",
            "viewing": true,
            "bidder": true,
            "interestLevel": "Reserved"
          },
          {
            "estateId": "sample string 1",
            "type": "House",
            "estateType": "House",
            "viewing": true,
            "bidder": true,
            "interestLevel": "Reserved"
          }
        ],
        "companyName": "sample string 1",
        "corporateNumber": "sample string 2",
        "homePage": "sample string 3",
        "switchPhone": "sample string 4",
        "brokerId": "sample string 5",
        "contactId": "sample string 6",
        "customerId": "sample string 7",
        "customFields": [
          {
            "label": "sample string 1",
            "name": "sample string 2",
            "value": "sample string 3"
          },
          {
            "label": "sample string 1",
            "name": "sample string 2",
            "value": "sample string 3"
          }
        ],
        "categories": [
          {
            "id": "sample string 1",
            "name": "sample string 2",
            "readOnly": true
          },
          {
            "id": "sample string 1",
            "name": "sample string 2",
            "readOnly": true
          }
        ],
        "address": {
          "streetAddress": "sample string 1",
          "zipCode": "sample string 2",
          "city": "sample string 3",
          "countryCode": "sample string 4"
        },
        "email": {
          "emailAddress": "sample string 1",
          "emailAddress2": "sample string 2"
        },
        "otherPhone": "sample string 8",
        "wishAdvertising": true,
        "note": "sample string 10",
        "coordinate": {
          "longitud": 1.1,
          "latitud": 2.1
        },
        "createdAt": "2026-10-04T13:53:32.6990353+02:00",
        "changedAt": "2026-10-04T13:53:32.6990353+02:00"
      }
    ]
  },
  {
    "customerId": "sample string 1",
    "persons": [
      {
        "lookingForAccommodation": [
          {
            "id": "sample string 1",
            "areaIds": [
              "sample string 1",
              "sample string 2"
            ],
            "countys": [
              "sample string 1",
              "sample string 2"
            ],
            "countryCode": "sample string 2",
            "polygon": [
              {
                "longitud": 1.1,
                "latitud": 2.1
              },
              {
                "longitud": 1.1,
                "latitud": 2.1
              }
            ],
            "foreignProperty": true,
            "house": true,
            "rowHouse": true,
            "housingCooperative": true,
            "cottage": true,
            "premises": true,
            "plot": true,
            "farm": true,
            "tenancy": true,
            "otherHousing": true,
            "livingSpace": {
              "min": 1.1,
              "max": 1.1
            },
            "numberOfRooms": {
              "min": 1.1,
              "max": 1.1
            },
            "price": {
              "min": 1.1,
              "max": 1.1
            },
            "plotArea": {
              "min": 1.1,
              "max": 1.1
            },
            "specialRequset": "sample string 13",
            "increasedRequirementIDs": [
              "sample string 1",
              "sample string 2"
            ],
            "active": true
          },
          {
            "id": "sample string 1",
            "areaIds": [
              "sample string 1",
              "sample string 2"
            ],
            "countys": [
              "sample string 1",
              "sample string 2"
            ],
            "countryCode": "sample string 2",
            "polygon": [
              {
                "longitud": 1.1,
                "latitud": 2.1
              },
              {
                "longitud": 1.1,
                "latitud": 2.1
              }
            ],
            "foreignProperty": true,
            "house": true,
            "rowHouse": true,
            "housingCooperative": true,
            "cottage": true,
            "premises": true,
            "plot": true,
            "farm": true,
            "tenancy": true,
            "otherHousing": true,
            "livingSpace": {
              "min": 1.1,
              "max": 1.1
            },
            "numberOfRooms": {
              "min": 1.1,
              "max": 1.1
            },
            "price": {
              "min": 1.1,
              "max": 1.1
            },
            "plotArea": {
              "min": 1.1,
              "max": 1.1
            },
            "specialRequset": "sample string 13",
            "increasedRequirementIDs": [
              "sample string 1",
              "sample string 2"
            ],
            "active": true
          }
        ],
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
        "buyerOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House"
          },
          {
            "estateId": "sample string 1",
            "type": "House"
          }
        ],
        "sellerOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House"
          },
          {
            "estateId": "sample string 1",
            "type": "House"
          }
        ],
        "interestOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House",
            "estateType": "House",
            "viewing": true,
            "bidder": true,
            "interestLevel": "Reserved"
          },
          {
            "estateId": "sample string 1",
            "type": "House",
            "estateType": "House",
            "viewing": true,
            "bidder": true,
            "interestLevel": "Reserved"
          }
        ],
        "firstName": "sample string 1",
        "lastName": "sample string 2",
        "socialSecurityNumber": "sample string 3",
        "telePhone": "sample string 4",
        "workPhone": "sample string 5",
        "cellPhone": "sample string 6",
        "gdprApprovalDate": "2026-10-04T13:53:32.6990353+02:00",
        "obtainThrough": "sample string 7",
        "brokerId": "sample string 8",
        "contactId": "sample string 9",
        "customerId": "sample string 10",
        "customFields": [
          {
            "label": "sample string 1",
            "name": "sample string 2",
            "value": "sample string 3"
          },
          {
            "label": "sample string 1",
            "name": "sample string 2",
            "value": "sample string 3"
          }
        ],
        "categories": [
          {
            "id": "sample string 1",
            "name": "sample string 2",
            "readOnly": true
          },
          {
            "id": "sample string 1",
            "name": "sample string 2",
            "readOnly": true
          }
        ],
        "address": {
          "streetAddress": "sample string 1",
          "zipCode": "sample string 2",
          "city": "sample string 3",
          "countryCode": "sample string 4"
        },
        "email": {
          "emailAddress": "sample string 1",
          "emailAddress2": "sample string 2"
        },
        "otherPhone": "sample string 11",
        "wishAdvertising": true,
        "note": "sample string 13",
        "coordinate": {
          "longitud": 1.1,
          "latitud": 2.1
        },
        "createdAt": "2026-10-04T13:53:32.6990353+02:00",
        "changedAt": "2026-10-04T13:53:32.6990353+02:00"
      },
      {
        "lookingForAccommodation": [
          {
            "id": "sample string 1",
            "areaIds": [
              "sample string 1",
              "sample string 2"
            ],
            "countys": [
              "sample string 1",
              "sample string 2"
            ],
            "countryCode": "sample string 2",
            "polygon": [
              {
                "longitud": 1.1,
                "latitud": 2.1
              },
              {
                "longitud": 1.1,
                "latitud": 2.1
              }
            ],
            "foreignProperty": true,
            "house": true,
            "rowHouse": true,
            "housingCooperative": true,
            "cottage": true,
            "premises": true,
            "plot": true,
            "farm": true,
            "tenancy": true,
            "otherHousing": true,
            "livingSpace": {
              "min": 1.1,
              "max": 1.1
            },
            "numberOfRooms": {
              "min": 1.1,
              "max": 1.1
            },
            "price": {
              "min": 1.1,
              "max": 1.1
            },
            "plotArea": {
              "min": 1.1,
              "max": 1.1
            },
            "specialRequset": "sample string 13",
            "increasedRequirementIDs": [
              "sample string 1",
              "sample string 2"
            ],
            "active": true
          },
          {
            "id": "sample string 1",
            "areaIds": [
              "sample string 1",
              "sample string 2"
            ],
            "countys": [
              "sample string 1",
              "sample string 2"
            ],
            "countryCode": "sample string 2",
            "polygon": [
              {
                "longitud": 1.1,
                "latitud": 2.1
              },
              {
                "longitud": 1.1,
                "latitud": 2.1
              }
            ],
            "foreignProperty": true,
            "house": true,
            "rowHouse": true,
            "housingCooperative": true,
            "cottage": true,
            "premises": true,
            "plot": true,
            "farm": true,
            "tenancy": true,
            "otherHousing": true,
            "livingSpace": {
              "min": 1.1,
              "max": 1.1
            },
            "numberOfRooms": {
              "min": 1.1,
              "max": 1.1
            },
            "price": {
              "min": 1.1,
              "max": 1.1
            },
            "plotArea": {
              "min": 1.1,
              "max": 1.1
            },
            "specialRequset": "sample string 13",
            "increasedRequirementIDs": [
              "sample string 1",
              "sample string 2"
            ],
            "active": true
          }
        ],
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
        "buyerOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House"
          },
          {
            "estateId": "sample string 1",
            "type": "House"
          }
        ],
        "sellerOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House"
          },
          {
            "estateId": "sample string 1",
            "type": "House"
          }
        ],
        "interestOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House",
            "estateType": "House",
            "viewing": true,
            "bidder": true,
            "interestLevel": "Reserved"
          },
          {
            "estateId": "sample string 1",
            "type": "House",
            "estateType": "House",
            "viewing": true,
            "bidder": true,
            "interestLevel": "Reserved"
          }
        ],
        "firstName": "sample string 1",
        "lastName": "sample string 2",
        "socialSecurityNumber": "sample string 3",
        "telePhone": "sample string 4",
        "workPhone": "sample string 5",
        "cellPhone": "sample string 6",
        "gdprApprovalDate": "2026-10-04T13:53:32.6990353+02:00",
        "obtainThrough": "sample string 7",
        "brokerId": "sample string 8",
        "contactId": "sample string 9",
        "customerId": "sample string 10",
        "customFields": [
          {
            "label": "sample string 1",
            "name": "sample string 2",
            "value": "sample string 3"
          },
          {
            "label": "sample string 1",
            "name": "sample string 2",
            "value": "sample string 3"
          }
        ],
        "categories": [
          {
            "id": "sample string 1",
            "name": "sample string 2",
            "readOnly": true
          },
          {
            "id": "sample string 1",
            "name": "sample string 2",
            "readOnly": true
          }
        ],
        "address": {
          "streetAddress": "sample string 1",
          "zipCode": "sample string 2",
          "city": "sample string 3",
          "countryCode": "sample string 4"
        },
        "email": {
          "emailAddress": "sample string 1",
          "emailAddress2": "sample string 2"
        },
        "otherPhone": "sample string 11",
        "wishAdvertising": true,
        "note": "sample string 13",
        "coordinate": {
          "longitud": 1.1,
          "latitud": 2.1
        },
        "createdAt": "2026-10-04T13:53:32.6990353+02:00",
        "changedAt": "2026-10-04T13:53:32.6990353+02:00"
      }
    ],
    "estates": [
      {
        "lookingForAccommodation": [
          {
            "id": "sample string 1",
            "areaIds": [
              "sample string 1",
              "sample string 2"
            ],
            "countys": [
              "sample string 1",
              "sample string 2"
            ],
            "countryCode": "sample string 2",
            "polygon": [
              {
                "longitud": 1.1,
                "latitud": 2.1
              },
              {
                "longitud": 1.1,
                "latitud": 2.1
              }
            ],
            "foreignProperty": true,
            "house": true,
            "rowHouse": true,
            "housingCooperative": true,
            "cottage": true,
            "premises": true,
            "plot": true,
            "farm": true,
            "tenancy": true,
            "otherHousing": true,
            "livingSpace": {
              "min": 1.1,
              "max": 1.1
            },
            "numberOfRooms": {
              "min": 1.1,
              "max": 1.1
            },
            "price": {
              "min": 1.1,
              "max": 1.1
            },
            "plotArea": {
              "min": 1.1,
              "max": 1.1
            },
            "specialRequset": "sample string 13",
            "increasedRequirementIDs": [
              "sample string 1",
              "sample string 2"
            ],
            "active": true
          },
          {
            "id": "sample string 1",
            "areaIds": [
              "sample string 1",
              "sample string 2"
            ],
            "countys": [
              "sample string 1",
              "sample string 2"
            ],
            "countryCode": "sample string 2",
            "polygon": [
              {
                "longitud": 1.1,
                "latitud": 2.1
              },
              {
                "longitud": 1.1,
                "latitud": 2.1
              }
            ],
            "foreignProperty": true,
            "house": true,
            "rowHouse": true,
            "housingCooperative": true,
            "cottage": true,
            "premises": true,
            "plot": true,
            "farm": true,
            "tenancy": true,
            "otherHousing": true,
            "livingSpace": {
              "min": 1.1,
              "max": 1.1
            },
            "numberOfRooms": {
              "min": 1.1,
              "max": 1.1
            },
            "price": {
              "min": 1.1,
              "max": 1.1
            },
            "plotArea": {
              "min": 1.1,
              "max": 1.1
            },
            "specialRequset": "sample string 13",
            "increasedRequirementIDs": [
              "sample string 1",
              "sample string 2"
            ],
            "active": true
          }
        ],
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
        "buyerOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House"
          },
          {
            "estateId": "sample string 1",
            "type": "House"
          }
        ],
        "sellerOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House"
          },
          {
            "estateId": "sample string 1",
            "type": "House"
          }
        ],
        "interestOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House",
            "estateType": "House",
            "viewing": true,
            "bidder": true,
            "interestLevel": "Reserved"
          },
          {
            "estateId": "sample string 1",
            "type": "House",
            "estateType": "House",
            "viewing": true,
            "bidder": true,
            "interestLevel": "Reserved"
          }
        ],
        "name": "sample string 1",
        "socialSecurityNumber": "sample string 2",
        "telePhone": "sample string 3",
        "workPhone": "sample string 4",
        "cellPhone": "sample string 5",
        "brokerId": "sample string 6",
        "contactId": "sample string 7",
        "customerId": "sample string 8",
        "customFields": [
          {
            "label": "sample string 1",
            "name": "sample string 2",
            "value": "sample string 3"
          },
          {
            "label": "sample string 1",
            "name": "sample string 2",
            "value": "sample string 3"
          }
        ],
        "categories": [
          {
            "id": "sample string 1",
            "name": "sample string 2",
            "readOnly": true
          },
          {
            "id": "sample string 1",
            "name": "sample string 2",
            "readOnly": true
          }
        ],
        "address": {
          "streetAddress": "sample string 1",
          "zipCode": "sample string 2",
          "city": "sample string 3",
          "countryCode": "sample string 4"
        },
        "email": {
          "emailAddress": "sample string 1",
          "emailAddress2": "sample string 2"
        },
        "otherPhone": "sample string 9",
        "wishAdvertising": true,
        "note": "sample string 11",
        "coordinate": {
          "longitud": 1.1,
          "latitud": 2.1
        },
        "createdAt": "2026-10-04T13:53:32.6990353+02:00",
        "changedAt": "2026-10-04T13:53:32.6990353+02:00"
      },
      {
        "lookingForAccommodation": [
          {
            "id": "sample string 1",
            "areaIds": [
              "sample string 1",
              "sample string 2"
            ],
            "countys": [
              "sample string 1",
              "sample string 2"
            ],
            "countryCode": "sample string 2",
            "polygon": [
              {
                "longitud": 1.1,
                "latitud": 2.1
              },
              {
                "longitud": 1.1,
                "latitud": 2.1
              }
            ],
            "foreignProperty": true,
            "house": true,
            "rowHouse": true,
            "housingCooperative": true,
            "cottage": true,
            "premises": true,
            "plot": true,
            "farm": true,
            "tenancy": true,
            "otherHousing": true,
            "livingSpace": {
              "min": 1.1,
              "max": 1.1
            },
            "numberOfRooms": {
              "min": 1.1,
              "max": 1.1
            },
            "price": {
              "min": 1.1,
              "max": 1.1
            },
            "plotArea": {
              "min": 1.1,
              "max": 1.1
            },
            "specialRequset": "sample string 13",
            "increasedRequirementIDs": [
              "sample string 1",
              "sample string 2"
            ],
            "active": true
          },
          {
            "id": "sample string 1",
            "areaIds": [
              "sample string 1",
              "sample string 2"
            ],
            "countys": [
              "sample string 1",
              "sample string 2"
            ],
            "countryCode": "sample string 2",
            "polygon": [
              {
                "longitud": 1.1,
                "latitud": 2.1
              },
              {
                "longitud": 1.1,
                "latitud": 2.1
              }
            ],
            "foreignProperty": true,
            "house": true,
            "rowHouse": true,
            "housingCooperative": true,
            "cottage": true,
            "premises": true,
            "plot": true,
            "farm": true,
            "tenancy": true,
            "otherHousing": true,
            "livingSpace": {
              "min": 1.1,
              "max": 1.1
            },
            "numberOfRooms": {
              "min": 1.1,
              "max": 1.1
            },
            "price": {
              "min": 1.1,
              "max": 1.1
            },
            "plotArea": {
              "min": 1.1,
              "max": 1.1
            },
            "specialRequset": "sample string 13",
            "increasedRequirementIDs": [
              "sample string 1",
              "sample string 2"
            ],
            "active": true
          }
        ],
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
        "buyerOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House"
          },
          {
            "estateId": "sample string 1",
            "type": "House"
          }
        ],
        "sellerOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House"
          },
          {
            "estateId": "sample string 1",
            "type": "House"
          }
        ],
        "interestOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House",
            "estateType": "House",
            "viewing": true,
            "bidder": true,
            "interestLevel": "Reserved"
          },
          {
            "estateId": "sample string 1",
            "type": "House",
            "estateType": "House",
            "viewing": true,
            "bidder": true,
            "interestLevel": "Reserved"
          }
        ],
        "name": "sample string 1",
        "socialSecurityNumber": "sample string 2",
        "telePhone": "sample string 3",
        "workPhone": "sample string 4",
        "cellPhone": "sample string 5",
        "brokerId": "sample string 6",
        "contactId": "sample string 7",
        "customerId": "sample string 8",
        "customFields": [
          {
            "label": "sample string 1",
            "name": "sample string 2",
            "value": "sample string 3"
          },
          {
            "label": "sample string 1",
            "name": "sample string 2",
            "value": "sample string 3"
          }
        ],
        "categories": [
          {
            "id": "sample string 1",
            "name": "sample string 2",
            "readOnly": true
          },
          {
            "id": "sample string 1",
            "name": "sample string 2",
            "readOnly": true
          }
        ],
        "address": {
          "streetAddress": "sample string 1",
          "zipCode": "sample string 2",
          "city": "sample string 3",
          "countryCode": "sample string 4"
        },
        "email": {
          "emailAddress": "sample string 1",
          "emailAddress2": "sample string 2"
        },
        "otherPhone": "sample string 9",
        "wishAdvertising": true,
        "note": "sample string 11",
        "coordinate": {
          "longitud": 1.1,
          "latitud": 2.1
        },
        "createdAt": "2026-10-04T13:53:32.6990353+02:00",
        "changedAt": "2026-10-04T13:53:32.6990353+02:00"
      }
    ],
    "companies": [
      {
        "lookingForAccommodation": [
          {
            "id": "sample string 1",
            "areaIds": [
              "sample string 1",
              "sample string 2"
            ],
            "countys": [
              "sample string 1",
              "sample string 2"
            ],
            "countryCode": "sample string 2",
            "polygon": [
              {
                "longitud": 1.1,
                "latitud": 2.1
              },
              {
                "longitud": 1.1,
                "latitud": 2.1
              }
            ],
            "foreignProperty": true,
            "house": true,
            "rowHouse": true,
            "housingCooperative": true,
            "cottage": true,
            "premises": true,
            "plot": true,
            "farm": true,
            "tenancy": true,
            "otherHousing": true,
            "livingSpace": {
              "min": 1.1,
              "max": 1.1
            },
            "numberOfRooms": {
              "min": 1.1,
              "max": 1.1
            },
            "price": {
              "min": 1.1,
              "max": 1.1
            },
            "plotArea": {
              "min": 1.1,
              "max": 1.1
            },
            "specialRequset": "sample string 13",
            "increasedRequirementIDs": [
              "sample string 1",
              "sample string 2"
            ],
            "active": true
          },
          {
            "id": "sample string 1",
            "areaIds": [
              "sample string 1",
              "sample string 2"
            ],
            "countys": [
              "sample string 1",
              "sample string 2"
            ],
            "countryCode": "sample string 2",
            "polygon": [
              {
                "longitud": 1.1,
                "latitud": 2.1
              },
              {
                "longitud": 1.1,
                "latitud": 2.1
              }
            ],
            "foreignProperty": true,
            "house": true,
            "rowHouse": true,
            "housingCooperative": true,
            "cottage": true,
            "premises": true,
            "plot": true,
            "farm": true,
            "tenancy": true,
            "otherHousing": true,
            "livingSpace": {
              "min": 1.1,
              "max": 1.1
            },
            "numberOfRooms": {
              "min": 1.1,
              "max": 1.1
            },
            "price": {
              "min": 1.1,
              "max": 1.1
            },
            "plotArea": {
              "min": 1.1,
              "max": 1.1
            },
            "specialRequset": "sample string 13",
            "increasedRequirementIDs": [
              "sample string 1",
              "sample string 2"
            ],
            "active": true
          }
        ],
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
        "buyerOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House"
          },
          {
            "estateId": "sample string 1",
            "type": "House"
          }
        ],
        "sellerOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House"
          },
          {
            "estateId": "sample string 1",
            "type": "House"
          }
        ],
        "interestOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House",
            "estateType": "House",
            "viewing": true,
            "bidder": true,
            "interestLevel": "Reserved"
          },
          {
            "estateId": "sample string 1",
            "type": "House",
            "estateType": "House",
            "viewing": true,
            "bidder": true,
            "interestLevel": "Reserved"
          }
        ],
        "companyName": "sample string 1",
        "corporateNumber": "sample string 2",
        "homePage": "sample string 3",
        "switchPhone": "sample string 4",
        "brokerId": "sample string 5",
        "contactId": "sample string 6",
        "customerId": "sample string 7",
        "customFields": [
          {
            "label": "sample string 1",
            "name": "sample string 2",
            "value": "sample string 3"
          },
          {
            "label": "sample string 1",
            "name": "sample string 2",
            "value": "sample string 3"
          }
        ],
        "categories": [
          {
            "id": "sample string 1",
            "name": "sample string 2",
            "readOnly": true
          },
          {
            "id": "sample string 1",
            "name": "sample string 2",
            "readOnly": true
          }
        ],
        "address": {
          "streetAddress": "sample string 1",
          "zipCode": "sample string 2",
          "city": "sample string 3",
          "countryCode": "sample string 4"
        },
        "email": {
          "emailAddress": "sample string 1",
          "emailAddress2": "sample string 2"
        },
        "otherPhone": "sample string 8",
        "wishAdvertising": true,
        "note": "sample string 10",
        "coordinate": {
          "longitud": 1.1,
          "latitud": 2.1
        },
        "createdAt": "2026-10-04T13:53:32.6990353+02:00",
        "changedAt": "2026-10-04T13:53:32.6990353+02:00"
      },
      {
        "lookingForAccommodation": [
          {
            "id": "sample string 1",
            "areaIds": [
              "sample string 1",
              "sample string 2"
            ],
            "countys": [
              "sample string 1",
              "sample string 2"
            ],
            "countryCode": "sample string 2",
            "polygon": [
              {
                "longitud": 1.1,
                "latitud": 2.1
              },
              {
                "longitud": 1.1,
                "latitud": 2.1
              }
            ],
            "foreignProperty": true,
            "house": true,
            "rowHouse": true,
            "housingCooperative": true,
            "cottage": true,
            "premises": true,
            "plot": true,
            "farm": true,
            "tenancy": true,
            "otherHousing": true,
            "livingSpace": {
              "min": 1.1,
              "max": 1.1
            },
            "numberOfRooms": {
              "min": 1.1,
              "max": 1.1
            },
            "price": {
              "min": 1.1,
              "max": 1.1
            },
            "plotArea": {
              "min": 1.1,
              "max": 1.1
            },
            "specialRequset": "sample string 13",
            "increasedRequirementIDs": [
              "sample string 1",
              "sample string 2"
            ],
            "active": true
          },
          {
            "id": "sample string 1",
            "areaIds": [
              "sample string 1",
              "sample string 2"
            ],
            "countys": [
              "sample string 1",
              "sample string 2"
            ],
            "countryCode": "sample string 2",
            "polygon": [
              {
                "longitud": 1.1,
                "latitud": 2.1
              },
              {
                "longitud": 1.1,
                "latitud": 2.1
              }
            ],
            "foreignProperty": true,
            "house": true,
            "rowHouse": true,
            "housingCooperative": true,
            "cottage": true,
            "premises": true,
            "plot": true,
            "farm": true,
            "tenancy": true,
            "otherHousing": true,
            "livingSpace": {
              "min": 1.1,
              "max": 1.1
            },
            "numberOfRooms": {
              "min": 1.1,
              "max": 1.1
            },
            "price": {
              "min": 1.1,
              "max": 1.1
            },
            "plotArea": {
              "min": 1.1,
              "max": 1.1
            },
            "specialRequset": "sample string 13",
            "increasedRequirementIDs": [
              "sample string 1",
              "sample string 2"
            ],
            "active": true
          }
        ],
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
        "buyerOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House"
          },
          {
            "estateId": "sample string 1",
            "type": "House"
          }
        ],
        "sellerOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House"
          },
          {
            "estateId": "sample string 1",
            "type": "House"
          }
        ],
        "interestOnObjects": [
          {
            "estateId": "sample string 1",
            "type": "House",
            "estateType": "House",
            "viewing": true,
            "bidder": true,
            "interestLevel": "Reserved"
          },
          {
            "estateId": "sample string 1",
            "type": "House",
            "estateType": "House",
            "viewing": true,
            "bidder": true,
            "interestLevel": "Reserved"
          }
        ],
        "companyName": "sample string 1",
        "corporateNumber": "sample string 2",
        "homePage": "sample string 3",
        "switchPhone": "sample string 4",
        "brokerId": "sample string 5",
        "contactId": "sample string 6",
        "customerId": "sample string 7",
        "customFields": [
          {
            "label": "sample string 1",
            "name": "sample string 2",
            "value": "sample string 3"
          },
          {
            "label": "sample string 1",
            "name": "sample string 2",
            "value": "sample string 3"
          }
        ],
        "categories": [
          {
            "id": "sample string 1",
            "name": "sample string 2",
            "readOnly": true
          },
          {
            "id": "sample string 1",
            "name": "sample string 2",
            "readOnly": true
          }
        ],
        "address": {
          "streetAddress": "sample string 1",
          "zipCode": "sample string 2",
          "city": "sample string 3",
          "countryCode": "sample string 4"
        },
        "email": {
          "emailAddress": "sample string 1",
          "emailAddress2": "sample string 2"
        },
        "otherPhone": "sample string 8",
        "wishAdvertising": true,
        "note": "sample string 10",
        "coordinate": {
          "longitud": 1.1,
          "latitud": 2.1
        },
        "createdAt": "2026-10-04T13:53:32.6990353+02:00",
        "changedAt": "2026-10-04T13:53:32.6990353+02:00"
      }
    ]
  }
]
```
