<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Seller-customerId-contactId-Estate-estateId-Economy, fetched 2026-10-04 -->

# GET CRM/Seller/{customerId}/{contactId}/Estate/{estateId}/Economy

Bankuppgifter

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId |  | string | Krävs |
| contactId |  | string | Krävs |
| estateId |  | string | Krävs |

## Response Information

### Resource Description

Bankuppgifter [SellerEconomy](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Seller_SellerEconomy)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Bank | Säljarens bank | [Bank](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Seller_Bank) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json462)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml462)

```
{
  "bank": {
    "name": "sample string 1",
    "clearingNumber": "sample string 2",
    "accountNumber": "sample string 3"
  }
}
```
