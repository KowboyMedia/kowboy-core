<!-- https://connect.maklare.vitec.net/Help/Api/GET-Category-GetCategories, fetched 2026-10-04 -->

# GET Category/GetCategories

Hämtar kategorier. För att kunna hämta kategorier så krävs det en giltig API nyckel och ett kundid

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund id | string | Krävs |

## Response Information

### Resource Description

Hämtar kategorier. För att kunna hämta kategorier så krävs det en giltig API nyckel och ett kundid [Categories](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Category_Categories)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| CompanyCategories | Företagskategorier | Collection of [Category](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Category_Category) |  |
| PersonCategories | Personkategorier | Collection of [Category](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Category_Category) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json697)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml697)

```
{
  "companyCategories": [
    {
      "id": "sample string 1",
      "name": "sample string 2",
      "readOnly": true
    },
    {
      "id": "sample string 1",
      "name": "sample string 2",
      "readOnly": true
    }
  ],
  "personCategories": [
    {
      "id": "sample string 1",
      "name": "sample string 2",
      "readOnly": true
    },
    {
      "id": "sample string 1",
      "name": "sample string 2",
      "readOnly": true
    }
  ]
}
```
