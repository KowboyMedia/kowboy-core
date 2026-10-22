<!-- https://connect.maklare.vitec.net/Help/Api/POST-Contacts-UpdateCompany, fetched 2026-10-04 -->

# POST Contacts/UpdateCompany

Skicka in ny eller uppdatera befintlig företagskontakt. För att kunna uppdatera eller skapa en kontakt så krävs det en giltig API nyckel och ett kundid (Customerld). Finns Contactld (kontaktid) sker kontrollen på detta och alla inskickade fält uppdateras på företaget. Saknas Contactld (kontaktid) sker kontrollen på CorporateHumber (organisationsnummer) och alla övriga fält på företaget uppdateras. Finns ingen av ovanstående fält sker kontrollen på CompanyHame (företagsnamn) och dessutom på SwitchPhone (telefonnummer) eller EmailAddress (Epostadressl). Lämnas dessa fält tomma sker ingen dubblett kontroll men minst en måste skickas in för att identifiera en dubblett. Hittas ingen dubblett skapas ett nytt företag.

## Request Information

## Body Parameters

Kontakt [UpdateCompany](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Update_UpdateCompany)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| CompanyName | Företagsnamn | string | Företagsnamn måste vara mellan 0 och 100 tecken, tomsträng mellanslag eller null uppdaterar inte företagsnamnet |
| CorporateNumber | Organisationsnummer | string | Organisationsnummer måste vara mellan 0 och 20 tecken |
| IsForeignCorporateNumber | Annat format/utländskt organisationsnummer | boolean |  |
| HomePage | Hemsida | string | Hemsida måste vara mellan 0 och 60 tecken |
| SwitchPhone | Telefon växel | string | Växelnummer måste vara mellan 0 och 17 tecken |
| ContactId | Kontakt id | string | Kontaktid måste vara mellan 0 och 40 tecken |
| CustomerId | Kund Id | string | Kundid krävs Kundid måste vara mellan 0 och 40 tecken |
| CategoryIds | Kontaktkategori id | Collection of string |  |
| Address | Adress | [Address](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_Address) |  |
| Email | Email | [Email](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_Email) |  |
| UserId | Användarid som kontakten ska kopplas till | string |  |
| OtherPhone | Telefon annat | string | Övrigt telefonnummer måste vara mellan 0 och 17 tecken |
| WishAdvertising | Önskar reklamutskick | boolean |  |
| Note | Anteckning | string |  |
| Coordinate | Koordinater | [Coordinate](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_Coordinate) |  |
| Task | Typad uppgift | [Task](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Task_Task) |  |
| CustomField | Egendefinerat fält | [FieldValueCriteria](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=CustomField_FieldValueCriteria) |  |
| LeadScore | Antal lead score stjärnor | integer |  |

### Request Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json495)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml495)

```
{
  "companyName": "sample string 1",
  "corporateNumber": "sample string 2",
  "isForeignCorporateNumber": true,
  "homePage": "sample string 3",
  "switchPhone": "sample string 4",
  "contactId": "sample string 5",
  "customerId": "sample string 6",
  "categoryIds": [
    "sample string 1",
    "sample string 2"
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
  "userId": "sample string 7",
  "otherPhone": "sample string 8",
  "wishAdvertising": true,
  "note": "sample string 9",
  "coordinate": {
    "longitud": 1.1,
    "latitud": 2.1
  },
  "task": {
    "predefinedTaskId": "sample string 1",
    "note": "sample string 2",
    "estateId": "sample string 3",
    "assignedTo": "sample string 4"
  },
  "customField": {
    "name": "sample string 1",
    "value": "sample string 2"
  },
  "leadScore": 1
}
```

## Response Information

### Resource Description

Skapar en ny eller uppdaterar en befintlig företagskontakt. Dubblettkontroll sker på 1) kontaktid, 2) organisationsnummer, 3) företagsnamn, telefonnummer eller epostadress. Matar man in information i något av ovanstående fält, så fylls övriga fält i automatiskt. Minst ett fält behöver vara ifyllt för att dubblettkontroll ska kunna göras. Om dubblettkontrollen inte hittar en redan befintlig kontakt skapas en ny. string

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json495)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml495)

```
"sample string 1"
```
