<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Image-GetImageCategories, fetched 2026-10-04 -->

# GET CRM/Image/GetImageCategories

Metod för att hämta bildkategorier

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId |  | string | Krävs |

## Response Information

### Resource Description

Metod för att hämta bildkategorier Collection of [ImageCategories](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Image_ImageCategories)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| CustomerId | Kundid | string |  |
| Categories | Lista av bildkategorier | Collection of string |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json369)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml369)

```
[
  {
    "customerId": "sample string 1",
    "categories": [
      "sample string 1",
      "sample string 2"
    ]
  },
  {
    "customerId": "sample string 1",
    "categories": [
      "sample string 1",
      "sample string 2"
    ]
  }
]
```
