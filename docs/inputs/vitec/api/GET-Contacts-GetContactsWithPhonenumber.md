<!-- https://connect.maklare.vitec.net/Help/Api/GET-Contacts-GetContactsWithPhonenumber, fetched 2026-10-04 -->

# GET Contacts/GetContactsWithPhonenumber

Hämtar lista av kontaktid med telfonnummer

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| phoneNumber | Telefonnummer. | string | Krävs |
| customerId | Kund-id. | string |  |

## Response Information

### Resource Description

Hämtar lista av kontaktid med telfonnummer Collection of [CustomerContactIds](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Contact_CustomerContactIds)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| CustomerId | Kundid | string |  |
| ContactIds | Kontaktids | Collection of string |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json714)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml714)

```
[
  {
    "customerId": "sample string 1",
    "contactIds": [
      "sample string 1",
      "sample string 2"
    ]
  },
  {
    "customerId": "sample string 1",
    "contactIds": [
      "sample string 1",
      "sample string 2"
    ]
  }
]
```
