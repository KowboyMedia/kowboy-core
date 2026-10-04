<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-contactId-Meeting, fetched 2026-10-04 -->

# GET CRM/Contact/{customerId}/{contactId}/Meeting

Hämta info om möten för en kontakt.

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id. | string | Krävs |
| contactId | Kontaktid. | string | Krävs |

## Response Information

### Resource Description

Hämta info om möten för en kontakt. [CrmContactMeeting](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmContactMeeting)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| ContactId | KontaktId | string |  |
| Meetings | Lista med info om möten | Collection of [CrmMeeting](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmMeeting) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json682)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml682)

```
{
  "contactId": "sample string 1",
  "meetings": [
    {
      "id": "sample string 1",
      "createdAt": "2026-10-04T13:51:37.6232161+02:00",
      "meetingDate": "2026-10-04T13:51:37.6232161+02:00"
    },
    {
      "id": "sample string 1",
      "createdAt": "2026-10-04T13:51:37.6232161+02:00",
      "meetingDate": "2026-10-04T13:51:37.6232161+02:00"
    }
  ]
}
```
