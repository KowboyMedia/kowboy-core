<!-- https://connect.maklare.vitec.net/Help/Api/POST-v2-Advertising-Form-customerId-Valuation, fetched 2026-10-04 -->

# POST v2/Advertising/Form/{customerId}/Valuation

Värderingsförfrågan

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id | string | Krävs |

## Body Parameters

Anmälningsuppgifter [ValuationApplication](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_ValuationApplication)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| FirstName | Förnamn | string |  |
| LastName | Efternamn | string |  |
| Email | Epostadress | string |  |
| CellPhone | Mobiltelefonnummer | string |  |
| Address | Adressuppgifter, valfritt | [FormAddress](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_FormAddress) |  |
| Gdpr | GDPR uppgifter | [FormApplicationGdpr](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_FormApplicationGdpr) |  |
| Lead | Lead uppgifter | [FormValuationApplicationLead](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_FormValuationApplicationLead) |  |
| Marketing | Marknadsföringsuppgifter som t ex UTM taggar | [FormMarketing](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_FormMarketing) |  |
| Receiver | Mottagare av värderingsförfrågan | [ApplicationReceiver](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_ApplicationReceiver) |  |

### Request Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json646)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml646)

```
{
  "firstName": "sample string 1",
  "lastName": "sample string 2",
  "email": "sample string 3",
  "cellPhone": "sample string 4",
  "address": {
    "streetAddress": "sample string 1",
    "zipCode": "sample string 2",
    "city": "sample string 3"
  },
  "gdpr": {
    "hasApproved": true
  },
  "lead": {
    "assignmentSourceId": "sample string 1",
    "leadSourceId": "sample string 2",
    "message": "sample string 3"
  },
  "marketing": {
    "referrer": "sample string 1",
    "utmTags": [
      {
        "name": "sample string 1",
        "value": "sample string 2"
      },
      {
        "name": "sample string 1",
        "value": "sample string 2"
      }
    ]
  },
  "receiver": {
    "userId": "sample string 1"
  }
}
```

## Response Information

### Resource Description

Värderingsförfrågan [ValuationResult](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_ValuationResult)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| ContactId |  | string |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json646)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml646)

```
{
  "contactId": "sample string 1"
}
```
