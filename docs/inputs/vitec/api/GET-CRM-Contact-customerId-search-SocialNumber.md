<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-search-SocialNumber, fetched 2026-10-04 -->

# GET CRM/Contact/{customerId}/search/SocialNumber

Sökning på personnummer eller organisationsnummer.

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id | string | Krävs |
| SocialNumber | Personnummer, Organisationsnummer | string | Min length: 10 Max length: 13 Required |
| MaxSize | Max resultat, default är 50 och max är 1 000 | integer |  |

## Response Information

### Resource Description

Sökning på personnummer eller organisationsnummer. [CrmContactSearchList](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Search_CrmContactSearchList)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Matches | Kontakter som matchats | Collection of [CrmContactSearchMatch](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Search_CrmContactSearchMatch) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json791)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml791)

```
{
  "matches": [
    {
      "id": "sample string 1",
      "changedAt": "2026-10-04T13:51:26.7937792+02:00",
      "customerId": "sample string 3",
      "contactClassTypes": [
        "Person",
        "Person"
      ]
    },
    {
      "id": "sample string 1",
      "changedAt": "2026-10-04T13:51:26.7937792+02:00",
      "customerId": "sample string 3",
      "contactClassTypes": [
        "Person",
        "Person"
      ]
    }
  ]
}
```
