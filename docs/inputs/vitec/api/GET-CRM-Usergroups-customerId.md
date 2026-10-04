<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Usergroups-customerId, fetched 2026-10-04 -->

# GET CRM/Usergroups/{customerId}

Hämta användargrupp

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kundid | string | Krävs |

## Response Information

### Resource Description

Hämta användargrupp Collection of [UserGroup](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=CRM_UserGroup)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| UserGroupId | Användar | string |  |
| CustomerIds | Kundid | Collection of string |  |
| Name | Namn | string |  |
| Users | Användare | Collection of [User](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=CRM_User) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json244)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml244)

```
[
  {
    "userGroupId": "sample string 1",
    "customerIds": [
      "sample string 1",
      "sample string 2"
    ],
    "name": "sample string 2",
    "users": [
      {
        "userId": "sample string 1"
      },
      {
        "userId": "sample string 1"
      }
    ]
  },
  {
    "userGroupId": "sample string 1",
    "customerIds": [
      "sample string 1",
      "sample string 2"
    ],
    "name": "sample string 2",
    "users": [
      {
        "userId": "sample string 1"
      },
      {
        "userId": "sample string 1"
      }
    ]
  }
]
```
