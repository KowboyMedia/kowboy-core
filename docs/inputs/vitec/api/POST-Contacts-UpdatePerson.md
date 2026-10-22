<!-- https://connect.maklare.vitec.net/Help/Api/POST-Contacts-UpdatePerson, fetched 2026-10-04 -->

# POST Contacts/UpdatePerson

Skicka in ny eller uppdatera befintlig kontaktperson. För att kunna uppdatera eller skapa en kontakt så krävs det en giltig API nyckel och ett kundid (Customerld). Finns Contactld (kontaktid) sker kontrollen på detta och alla inskickade fält uppdateras på kontakten. Saknas Contactld (kontaktid) sker kontrollen på SocialSecurityNumber (personummer) och alla övriga fält på konten uppdateras. Finns ingen av ovanstånde fält så sker kontrollen på FirstName (förnamn) och LastName (efternamn) och dessutom på något av telephone (telefonnummer), cellphone (mobilnummer) eller EmailAddress (Epostadress1). Lämnas dessa fält tomma sker ingen dubblett kontroll men minst ett av dessa måste skickas in för att identifiera en dubblett. Hittas ingen dubblett skapas en ny person.

## Request Information

## Body Parameters

Kontakt [UpdatePerson](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Update_UpdatePerson)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| FirstName | Förnamn | string | Förnamn måste vara mellan 0 och 30 tecken, tomsträng mellanslag eller null uppdaterar inte förnamnet |
| LastName | Efternamn | string | Efternamn måste vara mellan 0 och 30 tecken, tomsträng mellanslag eller null uppdaterar inte namnet |
| SocialSecurityNumber | Personnummer | string | Personnummer måste vara mellan 0 och 20 tecken |
| IsForeignSocialSecurityNumber | Annat format/utländskt personnummer | boolean |  |
| TelePhone | Telefon bostad | string | Epostadress, telefonnummer (bostad eller arbete) eller mobilnummer måste anges. Telefonnummer måste vara mellan 0 och 17 tecken |
| WorkPhone | Telefon arbete | string | Epostadress, telefonnummer (bostad eller arbete) eller mobilnummer måste anges. Arbetsnummer måste vara mellan 0 och 17 tecken |
| CellPhone | Mobiltelefon | string | Epostadress, telefonnummer (bostad eller arbete) eller mobilnummer måste anges. Mobilnummer måste vara mellan 0 och 17 tecken |
| Approval | PUL-Godkännande | boolean |  |
| ApprovalDate | PUL-Godkännande datum | date |  |
| GDPRApprovalDate | GDPR informerad den | date |  |
| ObtainThrough | Informerad via | [ObtainMethod](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Update_ObtainMethod) |  |
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

- [application/json, text/json](https://connect.maklare.vitec.net#json918)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml918)

```
{
  "firstName": "sample string 1",
  "lastName": "sample string 2",
  "socialSecurityNumber": "sample string 3",
  "isForeignSocialSecurityNumber": true,
  "telePhone": "sample string 4",
  "workPhone": "sample string 5",
  "cellPhone": "sample string 6",
  "approval": true,
  "approvalDate": "2026-10-04T13:50:21.793426+02:00",
  "gdprApprovalDate": "2026-10-04T13:50:21.793426+02:00",
  "obtainThrough": "Interest",
  "contactId": "sample string 7",
  "customerId": "sample string 8",
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
  "userId": "sample string 9",
  "otherPhone": "sample string 10",
  "wishAdvertising": true,
  "note": "sample string 11",
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

Skapar en ny eller uppdaterar en befintlig kontaktperson. Dubblettkontroll sker på 1) kontaktid, 2) personnummer, 3) förnamn och efternamn, och något av telefonnummer, mobilnummer eller epostadress. Matar man in information i något av ovanstående fält, så fylls övriga fält i automatiskt. Minst ett fält behöver vara ifyllt för att dubblettkontroll ska kunna göras. Om dubblettkontrollen inte hittar en redan befintlig kontakt skapas en ny. string

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json918)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml918)

```
"sample string 1"
```
