<!-- https://connect.maklare.vitec.net/Help/Api/PUT-CRM-MergeContact-customerId-contactId-Merge, fetched 2026-10-04 -->

# PUT CRM/MergeContact/{customerId}/{contactId}/Merge

Uppdatera sammanslagen kontakt

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id | string | Krävs |
| contactId | Id på kontakt som ska uppdateras | string | Krävs |

## Body Parameters

Konakakt information som ska uppateras [MergeContact](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_MergeContact)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| SocialSecurityNumber | Personnummer | string |  |
| FirstName | Kontaktens förnamn | string |  |
| LastName | Kontaktens efternamn | string |  |
| Phone | Kontaktens telefonnummer | [Phone](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_Phone) |  |
| Email | Kontaktens e-postadress | [Email](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_Email) |  |
| Address | Kontaktens adress | [Address](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_Address) |  |
| KeepAllSearchProfiles |  | boolean |  |

### Request Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json136)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml136)

```
{
  "socialSecurityNumber": "sample string 1",
  "firstName": "sample string 2",
  "lastName": "sample string 3",
  "phone": {
    "home": "sample string 1",
    "cell": "sample string 2",
    "other": "sample string 3"
  },
  "email": {
    "emailAddress": "sample string 1",
    "emailAddress2": "sample string 2"
  },
  "address": {
    "streetAddress": "sample string 1",
    "zipCode": "sample string 2",
    "city": "sample string 3"
  },
  "keepAllSearchProfiles": true
}
```

## Response Information

### Resource Description

Uppdatera sammanslagen kontakt [MergeContact](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_MergeContact)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| SocialSecurityNumber | Personnummer | string |  |
| FirstName | Kontaktens förnamn | string |  |
| LastName | Kontaktens efternamn | string |  |
| Phone | Kontaktens telefonnummer | [Phone](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_Phone) |  |
| Email | Kontaktens e-postadress | [Email](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_Email) |  |
| Address | Kontaktens adress | [Address](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_Address) |  |
| KeepAllSearchProfiles |  | boolean |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json136)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml136)

```
{
  "socialSecurityNumber": "sample string 1",
  "firstName": "sample string 2",
  "lastName": "sample string 3",
  "phone": {
    "home": "sample string 1",
    "cell": "sample string 2",
    "other": "sample string 3"
  },
  "email": {
    "emailAddress": "sample string 1",
    "emailAddress2": "sample string 2"
  },
  "address": {
    "streetAddress": "sample string 1",
    "zipCode": "sample string 2",
    "city": "sample string 3"
  },
  "keepAllSearchProfiles": true
}
```
