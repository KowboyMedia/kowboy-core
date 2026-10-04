<!-- https://connect.maklare.vitec.net/Help/Api/POST-User-Notify-customerId, fetched 2026-10-04 -->

# POST User/Notify/{customerId}

Notifierar användare

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId |  | string | Krävs |

## Body Parameters

[Notification](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=User_Notification)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Header | Rubrik | string |  |
| Message | Meddelande | string |  |
| SMS | SMS notifiering | boolean |  |
| Express | Express notifiering | boolean |  |
| Recipients | Notifierings mottagare(userId) | Collection of string |  |

### Request Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json760)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml760)

```
{
  "header": "sample string 1",
  "message": "sample string 2",
  "sms": true,
  "express": true,
  "recipients": [
    "sample string 1",
    "sample string 2"
  ]
}
```

## Response Information

### Resource Description

Notifierar användare boolean

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json760)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml760)

```
true
```
