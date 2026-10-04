<!-- https://connect.maklare.vitec.net/Help/Api/GET-User-GetUser, fetched 2026-10-04 -->

# GET User/GetUser

Hämta användarlista för publika användare. För att kunna hämta användarlista så krävs det en giltig API nyckel och ett kundid.

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| UserId | Användarid | string |  |
| SearchText | Text som filtrerar på namn eller titel | string |  |
| CustomerId | Kundid | string |  |

## Response Information

### Resource Description

Hämtar lista över publika användare. Collection of [User](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=User_User)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Archived | Arkiverad | boolean |  |
| Public | Publik | boolean |  |
| UserId | Användarid | string |  |
| CustomerId | Kontorsid | Collection of string |  |
| OrderNumber | Sorteringsnummer-OBS obsolete. Använd sorteringsnumret under CustomerIdsWithSortOrder istället | integer |  |
| UserName | Namn | string |  |
| Department | Avdelning | string |  |
| Category | Kategori | string |  |
| Title | Titel | string |  |
| ExtraTitle | Extra Titel | string |  |
| AllowLogOn | Tillåt inloggning | boolean |  |
| EmailAddress | Epostadress | string |  |
| TelePhone | Telefonnummer | string |  |
| CellPhone | Mobilnummer | string |  |
| DirectPhonenumbers | Telefonnummer direkt | Collection of [DirectPhoneNumber](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=User_DirectPhoneNumber) |  |
| PublicPhonenumber | Publikt telefonnummer | string |  |
| SpokenLanguages | Talade språk | Collection of string |  |
| Bank | Banknamn | string |  |
| CleringNumber | Cleringnummer utfasad - finns i account | string |  |
| Account | Konto | string |  |
| AccountType | Kontotyp | [AccountType](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=User_AccountType) |  |
| Iban | Ibannummer | string |  |
| Swift | Swiftnummer | string |  |
| Comment | Kommentar | string |  |
| Image | Bild | [Image](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Image_Image) |  |
| PublishedOnOffice | Företag där användaren är publik | Collection of string |  |
| InternalEmployeeNumber |  | integer |  |
| ExternalUserId |  | string |  |
| CustomerIdsWithSortOrder | Kundid och sorteringnummer | Collection of [CustomerIdWithOrderNumber](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=User_CustomerIdWithOrderNumber) |  |
| DateChanged | Ändringsdatum | date |  |
| SubOffices | Underkontor som användaren är kopplad till | Collection of [UserSubOffice](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=User_UserSubOffice) |  |
| Reviews | Kundomdömen | Collection of [UserReview](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=User_UserReview) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json244)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml244)

```
[
  {
    "archived": true,
    "public": true,
    "userId": "sample string 2",
    "customerId": [
      "sample string 1",
      "sample string 2"
    ],
    "orderNumber": 1,
    "userName": "sample string 3",
    "department": "sample string 4",
    "category": "sample string 5",
    "title": "sample string 6",
    "extraTitle": "sample string 7",
    "allowLogOn": true,
    "emailAddress": "sample string 9",
    "telePhone": "sample string 10",
    "cellPhone": "sample string 11",
    "directPhonenumbers": [
      {
        "customerId": "sample string 1",
        "phonenumber": "sample string 2"
      },
      {
        "customerId": "sample string 1",
        "phonenumber": "sample string 2"
      }
    ],
    "publicPhonenumber": "sample string 12",
    "spokenLanguages": [
      "sample string 1",
      "sample string 2"
    ],
    "bank": "sample string 13",
    "cleringNumber": "sample string 14",
    "account": "sample string 15",
    "accountType": "BankAccount",
    "iban": "sample string 16",
    "swift": "sample string 17",
    "comment": "sample string 18",
    "image": {
      "imageId": "sample string 1",
      "dateChanged": "2026-10-04T13:43:38.5650653+02:00",
      "dateChangedImageData": "2026-10-04T13:43:38.5650653+02:00",
      "url": "sample string 4",
      "showImageOnInternet": true,
      "extension": "sample string 6",
      "cdnReferences": [
        {
          "name": "sample string 1",
          "url": "sample string 2"
        },
        {
          "name": "sample string 1",
          "url": "sample string 2"
        }
      ]
    },
    "publishedOnOffice": [
      "sample string 1",
      "sample string 2"
    ],
    "internalEmployeeNumber": 1,
    "externalUserId": "sample string 19",
    "customerIdsWithSortOrder": [
      {
        "customerId": "sample string 1",
        "orderNumber": 1,
        "mainBusiness": true,
        "officeId": "sample string 2"
      },
      {
        "customerId": "sample string 1",
        "orderNumber": 1,
        "mainBusiness": true,
        "officeId": "sample string 2"
      }
    ],
    "dateChanged": "2026-10-04T13:43:38.5650653+02:00",
    "subOffices": [
      {
        "id": "sample string 1"
      },
      {
        "id": "sample string 1"
      }
    ],
    "reviews": [
      {
        "review": "sample string 1",
        "madeBy": "sample string 2"
      },
      {
        "review": "sample string 1",
        "madeBy": "sample string 2"
      }
    ]
  },
  {
    "archived": true,
    "public": true,
    "userId": "sample string 2",
    "customerId": [
      "sample string 1",
      "sample string 2"
    ],
    "orderNumber": 1,
    "userName": "sample string 3",
    "department": "sample string 4",
    "category": "sample string 5",
    "title": "sample string 6",
    "extraTitle": "sample string 7",
    "allowLogOn": true,
    "emailAddress": "sample string 9",
    "telePhone": "sample string 10",
    "cellPhone": "sample string 11",
    "directPhonenumbers": [
      {
        "customerId": "sample string 1",
        "phonenumber": "sample string 2"
      },
      {
        "customerId": "sample string 1",
        "phonenumber": "sample string 2"
      }
    ],
    "publicPhonenumber": "sample string 12",
    "spokenLanguages": [
      "sample string 1",
      "sample string 2"
    ],
    "bank": "sample string 13",
    "cleringNumber": "sample string 14",
    "account": "sample string 15",
    "accountType": "BankAccount",
    "iban": "sample string 16",
    "swift": "sample string 17",
    "comment": "sample string 18",
    "image": {
      "imageId": "sample string 1",
      "dateChanged": "2026-10-04T13:43:38.5650653+02:00",
      "dateChangedImageData": "2026-10-04T13:43:38.5650653+02:00",
      "url": "sample string 4",
      "showImageOnInternet": true,
      "extension": "sample string 6",
      "cdnReferences": [
        {
          "name": "sample string 1",
          "url": "sample string 2"
        },
        {
          "name": "sample string 1",
          "url": "sample string 2"
        }
      ]
    },
    "publishedOnOffice": [
      "sample string 1",
      "sample string 2"
    ],
    "internalEmployeeNumber": 1,
    "externalUserId": "sample string 19",
    "customerIdsWithSortOrder": [
      {
        "customerId": "sample string 1",
        "orderNumber": 1,
        "mainBusiness": true,
        "officeId": "sample string 2"
      },
      {
        "customerId": "sample string 1",
        "orderNumber": 1,
        "mainBusiness": true,
        "officeId": "sample string 2"
      }
    ],
    "dateChanged": "2026-10-04T13:43:38.5650653+02:00",
    "subOffices": [
      {
        "id": "sample string 1"
      },
      {
        "id": "sample string 1"
      }
    ],
    "reviews": [
      {
        "review": "sample string 1",
        "madeBy": "sample string 2"
      },
      {
        "review": "sample string 1",
        "madeBy": "sample string 2"
      }
    ]
  }
]
```
