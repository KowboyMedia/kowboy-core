<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-EstateValuation-contactId, fetched 2026-10-04 -->

# GET CRM/Contact/{customerId}/EstateValuation/{contactId}

Hämtar ut information om tjänsten "Ditt bostadsvärde" för en kontakt

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kundid | string | Krävs |
| contactId | Kontaktid | string | Krävs |

## Response Information

### Resource Description

Hämtar ut information om tjänsten "Ditt bostadsvärde" för en kontakt [CrmEstateValuation](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmEstateValuation)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| ContactId | KontaktId | string |  |
| Estates | Lista med objekt där tjänsten finns | Collection of [ValuedEstate](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_ValuedEstate) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json573)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml573)

```
{
  "contactId": "sample string 1",
  "estates": [
    {
      "estateId": "sample string 1",
      "initialValuationDate": "2026-10-04T13:51:34.717129+02:00",
      "initialValuation": 1,
      "endDate": "2026-10-04T13:51:34.717129+02:00",
      "valuationHistory": [
        {
          "initialValuationDate": "2026-10-04T13:51:34.717129+02:00",
          "initialValuation": 1,
          "valuation": 1,
          "valuationDate": "2026-10-04T13:51:34.717129+02:00",
          "manuallyChanged": true
        },
        {
          "initialValuationDate": "2026-10-04T13:51:34.717129+02:00",
          "initialValuation": 1,
          "valuation": 1,
          "valuationDate": "2026-10-04T13:51:34.717129+02:00",
          "manuallyChanged": true
        }
      ]
    },
    {
      "estateId": "sample string 1",
      "initialValuationDate": "2026-10-04T13:51:34.717129+02:00",
      "initialValuation": 1,
      "endDate": "2026-10-04T13:51:34.717129+02:00",
      "valuationHistory": [
        {
          "initialValuationDate": "2026-10-04T13:51:34.717129+02:00",
          "initialValuation": 1,
          "valuation": 1,
          "valuationDate": "2026-10-04T13:51:34.717129+02:00",
          "manuallyChanged": true
        },
        {
          "initialValuationDate": "2026-10-04T13:51:34.717129+02:00",
          "initialValuation": 1,
          "valuation": 1,
          "valuationDate": "2026-10-04T13:51:34.717129+02:00",
          "manuallyChanged": true
        }
      ]
    }
  ]
}
```
