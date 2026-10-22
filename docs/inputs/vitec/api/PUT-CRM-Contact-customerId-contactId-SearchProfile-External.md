<!-- https://connect.maklare.vitec.net/Help/Api/PUT-CRM-Contact-customerId-contactId-SearchProfile-External, fetched 2026-10-04 -->

# PUT CRM/Contact/{customerId}/{contactId}/SearchProfile/External

Skapa/uppdatera information om sökprofil hos extern partner för kontakt

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kundid | string | Krävs |
| contactId | Kontaktid | string | Krävs |

## Body Parameters

[ExternalSearchProfileData](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_ExternalSearchProfileData)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| ExternalId | Externt id på sökprofilen | string | Required |
| EstateId | Bostadsid (Obligatoriskt om man skapar en ny sökprofil) | string |  |
| IsActive | Är sökprofilen aktiv (Obligatoriskt om man uppdaterar en sökprofil) | boolean |  |

### Request Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json198)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml198)

```
{
  "externalId": "sample string 1",
  "estateId": "sample string 2",
  "isActive": true
}
```

## Response Information

### Resource Description

Skapa/uppdatera information om sökprofil hos extern partner för kontakt

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input
