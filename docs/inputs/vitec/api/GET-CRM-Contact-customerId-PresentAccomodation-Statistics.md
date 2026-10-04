<!-- https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-PresentAccomodation-Statistics, fetched 2026-10-04 -->

# GET CRM/Contact/{customerId}/PresentAccomodation/Statistics

Hämta statistik gällande lämnarinfo för spekulanter på sålda objekt

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id. | string | Krävs |
| userId | Användar-id | string |  |
| dateFrom | Datum från | date |  |
| dateTo | Datum till | date |  |

## Response Information

### Resource Description

Hämta statistik gällande lämnarinfo för spekulanter på sålda objekt [CrmPresentAccomodationStatistics](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmPresentAccomodationStatistics)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Office |  | Collection of [CrmPresentAccomodationStatisticsOffice](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Crm_CrmPresentAccomodationStatisticsOffice) |  |

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json479)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml479)

```
{
  "office": [
    {
      "customerId": "sample string 1",
      "name": "sample string 2",
      "users": [
        {
          "id": "sample string 1",
          "name": "sample string 2",
          "estates": 3,
          "prospectives": [
            {
              "prospectives": 1,
              "interestLevel": "Reserved"
            },
            {
              "prospectives": 1,
              "interestLevel": "Reserved"
            }
          ],
          "showingParticipants": 4,
          "bidders": 5,
          "askedProspectives": [
            {
              "prospectives": 1,
              "interestLevel": "Reserved"
            },
            {
              "prospectives": 1,
              "interestLevel": "Reserved"
            }
          ],
          "askedProspectivesOwningAccomodation": [
            {
              "prospectives": 1,
              "interestLevel": "Reserved"
            },
            {
              "prospectives": 1,
              "interestLevel": "Reserved"
            }
          ]
        },
        {
          "id": "sample string 1",
          "name": "sample string 2",
          "estates": 3,
          "prospectives": [
            {
              "prospectives": 1,
              "interestLevel": "Reserved"
            },
            {
              "prospectives": 1,
              "interestLevel": "Reserved"
            }
          ],
          "showingParticipants": 4,
          "bidders": 5,
          "askedProspectives": [
            {
              "prospectives": 1,
              "interestLevel": "Reserved"
            },
            {
              "prospectives": 1,
              "interestLevel": "Reserved"
            }
          ],
          "askedProspectivesOwningAccomodation": [
            {
              "prospectives": 1,
              "interestLevel": "Reserved"
            },
            {
              "prospectives": 1,
              "interestLevel": "Reserved"
            }
          ]
        }
      ]
    },
    {
      "customerId": "sample string 1",
      "name": "sample string 2",
      "users": [
        {
          "id": "sample string 1",
          "name": "sample string 2",
          "estates": 3,
          "prospectives": [
            {
              "prospectives": 1,
              "interestLevel": "Reserved"
            },
            {
              "prospectives": 1,
              "interestLevel": "Reserved"
            }
          ],
          "showingParticipants": 4,
          "bidders": 5,
          "askedProspectives": [
            {
              "prospectives": 1,
              "interestLevel": "Reserved"
            },
            {
              "prospectives": 1,
              "interestLevel": "Reserved"
            }
          ],
          "askedProspectivesOwningAccomodation": [
            {
              "prospectives": 1,
              "interestLevel": "Reserved"
            },
            {
              "prospectives": 1,
              "interestLevel": "Reserved"
            }
          ]
        },
        {
          "id": "sample string 1",
          "name": "sample string 2",
          "estates": 3,
          "prospectives": [
            {
              "prospectives": 1,
              "interestLevel": "Reserved"
            },
            {
              "prospectives": 1,
              "interestLevel": "Reserved"
            }
          ],
          "showingParticipants": 4,
          "bidders": 5,
          "askedProspectives": [
            {
              "prospectives": 1,
              "interestLevel": "Reserved"
            },
            {
              "prospectives": 1,
              "interestLevel": "Reserved"
            }
          ],
          "askedProspectivesOwningAccomodation": [
            {
              "prospectives": 1,
              "interestLevel": "Reserved"
            },
            {
              "prospectives": 1,
              "interestLevel": "Reserved"
            }
          ]
        }
      ]
    }
  ]
}
```
