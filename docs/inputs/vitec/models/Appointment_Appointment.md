<!-- https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Appointment_Appointment, fetched 2026-10-04 -->

# Appointment

Kalenderhändelse

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
