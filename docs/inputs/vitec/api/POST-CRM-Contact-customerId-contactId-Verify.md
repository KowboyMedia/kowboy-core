<!-- https://connect.maklare.vitec.net/Help/Api/POST-CRM-Contact-customerId-contactId-Verify, fetched 2026-10-04 -->

# POST CRM/Contact/{customerId}/{contactId}/Verify

Ange att personen är verifierad via t ex BankId.

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id. | string | Krävs |
| contactId | Kontaktid. | string | Krävs |

## Body Parameters

Kontaktens verifieringsuppgifter [CrmVerifyPerson](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmVerifyPerson)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| VerificationMethod | Verifieringsmetod | [VerificationMethod](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_VerificationMethod) |  |

### Request Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json385)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml385)

```
{
  "verificationMethod": "BankId"
}
```

## Response Information

### Resource Description

Ange att personen är verifierad via t ex BankId. boolean

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json385)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml385)

```
true
```
