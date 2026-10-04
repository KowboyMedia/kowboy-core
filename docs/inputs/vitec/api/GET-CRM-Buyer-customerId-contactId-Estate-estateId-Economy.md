<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Buyer-customerId-contactId-Estate-estateId-Economy, fetched 2026-10-04 -->

# GET CRM/Buyer/{customerId}/{contactId}/Estate/{estateId}/Economy

Bank- och försäkringsppgifter

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId |  | string | Krävs |
| contactId |  | string | Krävs |
| estateId |  | string | Krävs |

## Response Information

### Resource Description

Bank- och försäkringsppgifter [BuyerEconomy](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Buyer_BuyerEconomy)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Bank | Köparens bank | [Bank](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Buyer_Bank) |  |
| InsuranceCompany | Köparens försäkringsbolag | [InsuranceCompany](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Buyer_InsuranceCompany) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json291)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml291)

```
{
  "bank": {
    "name": "sample string 1",
    "clearingNumber": "sample string 2",
    "accountNumber": "sample string 3"
  },
  "insuranceCompany": {
    "name": "sample string 1"
  }
}
```
