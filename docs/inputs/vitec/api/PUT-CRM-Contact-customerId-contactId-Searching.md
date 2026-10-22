<!-- https://connect.maklare.vitec.net/Help/Api/PUT-CRM-Contact-customerId-contactId-Searching, fetched 2026-10-04 -->

# PUT CRM/Contact/{customerId}/{contactId}/Searching

Ska kontaktens sökprofiler matchas

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | kund-id | string | Krävs |
| contactId | Kontaktid. | string | Krävs |

## Body Parameters

Data [CrmContactSearching](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmContactSearching)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| ShouldBeMatched |  | [ShouldbeMatched](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Searchprofile_ShouldbeMatched) |  |

### Request Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json994)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml994)

```
{
  "shouldBeMatched": "Yes"
}
```

## Response Information

### Resource Description

Ska kontaktens sökprofiler matchas

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input
