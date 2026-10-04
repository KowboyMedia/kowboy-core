<!-- https://connect.maklare.vitec.net/Help/Api/GET-IncreasedRequirement-customerId, fetched 2026-10-04 -->

# GET IncreasedRequirement/{customerId}

Hämta utökadekrav

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId |  | string | Krävs |

## Response Information

### Resource Description

Hämta utökadekrav Collection of [IncreasedRequirementCollection](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=IncreasedRequirement_IncreasedRequirementCollection)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| CustomerId | Kundnummer | string |  |
| IncreasedRequirements | Utökade krav | Collection of [IncreasedRequirement](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=IncreasedRequirement_IncreasedRequirement) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json105)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml105)

```
[
  {
    "customerId": "sample string 1",
    "increasedRequirements": [
      {
        "id": "sample string 1",
        "text": "sample string 2",
        "validForTypes": [
          "House",
          "House"
        ]
      },
      {
        "id": "sample string 1",
        "text": "sample string 2",
        "validForTypes": [
          "House",
          "House"
        ]
      }
    ]
  },
  {
    "customerId": "sample string 1",
    "increasedRequirements": [
      {
        "id": "sample string 1",
        "text": "sample string 2",
        "validForTypes": [
          "House",
          "House"
        ]
      },
      {
        "id": "sample string 1",
        "text": "sample string 2",
        "validForTypes": [
          "House",
          "House"
        ]
      }
    ]
  }
]
```
