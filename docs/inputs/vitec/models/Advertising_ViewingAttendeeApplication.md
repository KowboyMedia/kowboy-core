<!-- https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_ViewingAttendeeApplication, fetched 2026-10-04 -->

# ViewingAttendeeApplication

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| TimeSlotId | Id på tillfället som ska bokas | string |  |
| FirstName | Förnamn | string |  |
| LastName | Efternamn | string |  |
| Email | Epostadress | string |  |
| CellPhone | Mobiltelefonnummer | string |  |
| Address | Adressuppgifter, valfritt | [FormAddress](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_FormAddress) |  |
| Gdpr | GDPR uppgifter | [FormApplicationGdpr](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_FormApplicationGdpr) |  |
| Lead | Lead uppgifter | [FormApplicationLead](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_FormApplicationLead) |  |
| Confirmation | Bekräftelsehantering | [ViewingConfirmationOptions](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_ViewingConfirmationOptions) |  |
| Marketing | Marknadsföringsuppgifter som t ex UTM taggar | [FormMarketing](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_FormMarketing) |  |
| ReminderTime | Påminnelsetid (Minuter innan visning) | integer |  |
| Validation | Konfiguration av valideringsregler, lämna tom (null) om ni inte har särskilda regler | [ViewingAttendeeApplicationValidation](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_ViewingAttendeeApplicationValidation) |  |
