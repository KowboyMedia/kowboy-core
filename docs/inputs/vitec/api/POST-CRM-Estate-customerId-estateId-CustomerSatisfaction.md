<!-- https://connect.maklare.vitec.net/Help/Api/POST-CRM-Estate-customerId-estateId-CustomerSatisfaction, fetched 2026-10-04 -->

# POST CRM/Estate/{customerId}/{estateId}/CustomerSatisfaction

Sparar ett enkätsvar som visar hur nöjd en kund utifrån rollen som visningsdeltagare, säljare eller köpare var med handläggarens arbete.

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kundid | string | Krävs |
| estateId | Id för objekt kopplat till den affär som enkätsvaret avser | string | Krävs |

## Body Parameters

Innehåller uppgifter om kundens enkätsvar [CustomerSatisfactionSurvey](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=CustomerSatisfaction_CustomerSatisfactionSurvey)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| ReportDate | Datum då enkäten utfördes eller datum då kunden träffade handläggaren. Om värdet utelämnas kommer dagens datum användas. Datumet används i periodeiseringen för beräkningen av nyckeltal för en handläggare eller ett kontor. | date |  |
| ContactId | Id på kunden som lämnar enkätsvaret. | string | Id för kontakten som lämnar enkätsvaret måste anges |
| IsAnonymous | Anger om enkätsvaret skall behandlas anonymt eller ej. Om enkätsvaret är anonymt visas det inte på kontaktkortet i systemet, men kommer ändå att ligga till grund för beräkning av nyckeltal för handläggaren. | boolean | Ange om enkätsvaret skall behandlas anonymt eller ej |
| AgentId | Id på handläggare som enkätsvaret avser. Om värdet utelämnas antas svaret avse ansvarig handläggare på bostaden. | string |  |
| ParticipantRole | Anger om kunden som svarade på enkäten är visningsdeltagare, säljare eller köpare. | [SurveyParticipantRole](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=CustomerSatisfaction_SurveyParticipantRole) | Ange om kunden som svarade på enkäten är köpare, säljare eller visningsdeltagare |
| Result | Resultat på enkätsvaret, dvs det värde som angavs i enkäten. | integer | Ett värde mellan 0 och 100 måste anges för enkätsvaret. |
| CalculatedResult | Beräknat värde utifrån enkätsvaret. Om enkätsvaret konverteras till annan skala anges det konverterade värdet, annars anges enkätsvaret även i detta fält. Om systemet INTE skall användas för att beräkna nyckeltal utifrån enkäter utelämnas fältet. | [CalculatedResult](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=CustomerSatisfaction_CalculatedResult) |  |

### Request Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json931)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml931)

```
{
  "reportDate": "2026-10-04T05:06:32.4641172+02:00",
  "contactId": "sample string 1",
  "isAnonymous": true,
  "agentId": "sample string 3",
  "participantRole": "Buyer",
  "result": 1,
  "calculatedResult": {
    "value": 1,
    "method": "NPS"
  }
}
```

## Response Information

### Resource Description

Sparar ett enkätsvar som visar hur nöjd en kund utifrån rollen som visningsdeltagare, säljare eller köpare var med handläggarens arbete.

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input
