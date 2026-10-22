<!-- https://connect.maklare.vitec.net/Help/Api/POST-Appointment-customerId-id, fetched 2026-10-04 -->

# POST Appointment/{customerId}/{id}

Skapa kalenderhändelse

## Request Information

### URI Parameters

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| customerId | Kund-id | string | Krävs |
| id | Id på användaren | string | Krävs |

## Body Parameters

Kalenderhändelse [Appointment](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Appointment_Appointment)

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Subject | Ämne | string |  |
| Location | Plats | string |  |
| StartsAt | Startdatum och tid | date |  |
| EndsAt | Slutdatum och tid | date |  |
| AllDayEvent | Hela dagen | boolean |  |
| Note | Anteckning | string |  |
| Recurrence | Återkommande | boolean |  |
| RecurrencePattern | Återkommande per år/månad/vecka/dag | [RecurrencePattern](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Appointment_RecurrencePattern) |  |
| RecurrenceDayOfWeeks | Dag/dagar i veckan (används får veckoliga möten) | Collection of [DayOfWeek](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Appointment_DayOfWeek) |  |
| RecurrenceInterval | Interval | integer |  |
| RecurrenceMonth | Månaden (används för månatliga möten) | integer |  |
| RecurrenceDay | Dag i månaden (använs för årliga och månatliga möten) | integer |  |

### Request Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json886)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml886)

```
{
  "subject": "sample string 1",
  "location": "sample string 2",
  "startsAt": "2026-10-04T13:53:35.8865996+02:00",
  "endsAt": "2026-10-04T13:53:35.8865996+02:00",
  "allDayEvent": true,
  "note": "sample string 5",
  "recurrence": true,
  "recurrencePattern": "Daily",
  "recurrenceDayOfWeeks": [
    "Sunday",
    "Sunday"
  ],
  "recurrenceInterval": 6,
  "recurrenceMonth": 7,
  "recurrenceDay": 8
}
```

## Response Information

### Resource Description

Skapa kalenderhändelse string

## Kodexempel

- [CURL kommando](https://connect.maklare.vitec.net#curl-command)

- [Powershell](https://connect.maklare.vitec.net#powershell)

- [.NET c#](https://connect.maklare.vitec.net#csharp)

- [PHP](https://connect.maklare.vitec.net#php)

## Testformulär

### Text input

## Response Formats

- [application/json, text/json](https://connect.maklare.vitec.net#json886)

- [application/xml, text/xml](https://connect.maklare.vitec.net#xml886)

```
"sample string 1"
```
