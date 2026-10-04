<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-contactId-ContactRelations, fetched 2026-10-04 -->

# GET CRM/Contact/{customerId}/{contactId}/ContactRelations

Kontakt-kontakt-relationer en kontakt har. För kontakt-objekt relationer använd GET CRM/Contact/{customerId}/{contactId}/PartyRelations

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kundid | string | Krävs |
| contactId | Kontaktid | string | Krävs |

## Response Information

### Resource Description

Kontakt-kontakt-relationer en kontakt har. [ContactRelations](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_ContactRelations)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Relations | Relationer | Collection of [ContactRelation](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_ContactRelation) | Tex firmatecknare för företag, dödsbodelägare för dödsbo och fullmaktstagare för personer |
| ReverseRelations | Omvända relationer | Collection of [ReverseContactRelation](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_ReverseContactRelation) | Tex företag, dödsbo och fullmaktsgivare |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json916)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml916)

```
{
  "relations": [
    {
      "relation": "EstateParty",
      "contactId": "sample string 1"
    },
    {
      "relation": "EstateParty",
      "contactId": "sample string 1"
    }
  ],
  "reverseRelations": [
    {
      "relation": "EstateParty",
      "contactId": "sample string 1"
    },
    {
      "relation": "EstateParty",
      "contactId": "sample string 1"
    }
  ]
}
```
