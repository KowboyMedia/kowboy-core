<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-Search, fetched 2026-10-04 -->

# GET CRM/Contact/{customerId}/Search

Fritextsökning (Namn, personnummer, e-postadress, telefonnummer etc).

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id | string | Krävs |
| Term | Namn, personnummer, e-postadress, telefonnummer etc | string | Min length: 5 Required |
| MaxSize | Max resultat, default är 50 och max är 1 000 | integer |  |

## Response Information

### Resource Description

Fritextsökning (Namn, personnummer, e-postadress, telefonnummer etc). [CrmContactSearchList](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmContactSearchList)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Matches | Personer som matchats | Collection of [CrmContactSearchMatch](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmContactSearchMatch) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json571)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml571)

```
{
  "matches": [
    {
      "id": "sample string 1",
      "changedAt": "2026-10-04T13:51:26.4761185+02:00",
      "customerId": "sample string 3",
      "type": "Person",
      "score": 4.1
    },
    {
      "id": "sample string 1",
      "changedAt": "2026-10-04T13:51:26.4761185+02:00",
      "customerId": "sample string 3",
      "type": "Person",
      "score": 4.1
    }
  ]
}
```
