<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-contactId-PartyRoles, fetched 2026-10-04 -->

# GET CRM/Contact/{customerId}/{contactId}/PartyRoles

Alla köp-, sälj- och extra köp-/sälj-relationer en kontakt har

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kundid | string | Krävs |
| contactId | Kontaktid | string | Krävs |

## Response Information

### Resource Description

Alla köp-, sälj- och extra köp-/sälj-relationer en kontakt har [ContactPartyRoles](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_ContactPartyRoles)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Buyer | Köpare | Collection of [EstateParty](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_EstateParty) |  |
| ExtraBuyer | Relation/extra kontakt till köpare | Collection of [EstateExtraParty](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_EstateExtraParty) |  |
| Seller | Säljare | Collection of [EstateParty](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_EstateParty) |  |
| ExtraSeller | Relation/extra kontakt till säljare | Collection of [EstateExtraParty](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_EstateExtraParty) |  |
| Tenant | Hyresgäst | Collection of [EstateParty](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_EstateParty) | För lokaler |
| ExtraTenant | Relation/extra kontakt till hyresgäst | Collection of [EstateExtraParty](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_EstateExtraParty) | För lokaler |
| Owner | Ägare/uthyrare | Collection of [EstateParty](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_EstateParty) | För lokaler |
| ExtraOwner | Relation/extra kontakt till ägare/uthyrare | Collection of [EstateExtraParty](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_EstateExtraParty) | För lokaler |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json135)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml135)

```
{
  "buyer": [
    {
      "estateId": "sample string 1",
      "roleCreatedAt": "2026-10-04T13:51:40.3548718+02:00"
    },
    {
      "estateId": "sample string 1",
      "roleCreatedAt": "2026-10-04T13:51:40.3548718+02:00"
    }
  ],
  "extraBuyer": [
    {
      "estateId": "sample string 1",
      "roleCreatedAt": "2026-10-04T13:51:40.3548718+02:00",
      "partyRole": "ExtraPartyContactPerson",
      "contactId": "sample string 3"
    },
    {
      "estateId": "sample string 1",
      "roleCreatedAt": "2026-10-04T13:51:40.3548718+02:00",
      "partyRole": "ExtraPartyContactPerson",
      "contactId": "sample string 3"
    }
  ],
  "seller": [
    {
      "estateId": "sample string 1",
      "roleCreatedAt": "2026-10-04T13:51:40.3548718+02:00"
    },
    {
      "estateId": "sample string 1",
      "roleCreatedAt": "2026-10-04T13:51:40.3548718+02:00"
    }
  ],
  "extraSeller": [
    {
      "estateId": "sample string 1",
      "roleCreatedAt": "2026-10-04T13:51:40.3548718+02:00",
      "partyRole": "ExtraPartyContactPerson",
      "contactId": "sample string 3"
    },
    {
      "estateId": "sample string 1",
      "roleCreatedAt": "2026-10-04T13:51:40.3548718+02:00",
      "partyRole": "ExtraPartyContactPerson",
      "contactId": "sample string 3"
    }
  ],
  "tenant": [
    {
      "estateId": "sample string 1",
      "roleCreatedAt": "2026-10-04T13:51:40.3548718+02:00"
    },
    {
      "estateId": "sample string 1",
      "roleCreatedAt": "2026-10-04T13:51:40.3548718+02:00"
    }
  ],
  "extraTenant": [
    {
      "estateId": "sample string 1",
      "roleCreatedAt": "2026-10-04T13:51:40.3548718+02:00",
      "partyRole": "ExtraPartyContactPerson",
      "contactId": "sample string 3"
    },
    {
      "estateId": "sample string 1",
      "roleCreatedAt": "2026-10-04T13:51:40.3548718+02:00",
      "partyRole": "ExtraPartyContactPerson",
      "contactId": "sample string 3"
    }
  ],
  "owner": [
    {
      "estateId": "sample string 1",
      "roleCreatedAt": "2026-10-04T13:51:40.3548718+02:00"
    },
    {
      "estateId": "sample string 1",
      "roleCreatedAt": "2026-10-04T13:51:40.3548718+02:00"
    }
  ],
  "extraOwner": [
    {
      "estateId": "sample string 1",
      "roleCreatedAt": "2026-10-04T13:51:40.3548718+02:00",
      "partyRole": "ExtraPartyContactPerson",
      "contactId": "sample string 3"
    },
    {
      "estateId": "sample string 1",
      "roleCreatedAt": "2026-10-04T13:51:40.3548718+02:00",
      "partyRole": "ExtraPartyContactPerson",
      "contactId": "sample string 3"
    }
  ]
}
```
