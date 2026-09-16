<!-- https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingInterestApplication, fetched 2026-09-16 -->

# AdvertisingInterestApplication

Innehåller uppgifter om intresseanmälan till en bostad

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| LeadSourceId | Leadskälla - Det lead som skapas i samband med intresseanmälan kommer att kopplas till aktuell leadskälla. Om fältet inte anges, kommer leadet att kopplas till en förvald leadskälla som används för intresseanmälningar. | string |  |
| AssignmentSourceId | Intagskälla för den bostad som personen eventuellt lämnar. Skall bara anges om angiven leadskälla används för att koppla leadet till en bostad som kontaktpersonen eventuellt skall sälja. | string |  |
| Marketing | Marknadsföringsuppgifter som t ex UTM taggar | [FormMarketing](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_FormMarketing) |  |
| FirstName | Förnamn | string | Förnamn krävs Förnamn måste vara mellan 1 och 40 tecken |
| LastName | Efternamn | string | Efternamn krävs Efternamn måste vara mellan 1 och 40 tecken |
| SocialSecurityNumber | Personnummer | string | Personnummer måste vara mellan 0 och 20 tecken |
| IsForeignSocialSecurityNumber | Annat format/utländskt personnummer | boolean |  |
| Address | Adress | [ContactAddress](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=InterestApplication_ContactAddress) |  |
| Telephone | Telefonnummer | [PersonTelephoneNumbers](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_PersonTelephoneNumbers) | Epostadress, telefonnummer (bostad eller arbete) eller mobilnummer måste anges. |
| Email | Email | [Email](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_Email) | Epostadress, telefonnummer (bostad eller arbete) eller mobilnummer måste anges. |
| GDPRApprovalDate | GDPR informerad den | date |  |
| PresentAccommodation | Uppgifter om nuvarande boende | [ContactPresentAccommodation](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=InterestApplication_ContactPresentAccommodation) |  |
| ContactMessage | Meddelande från kontaktpersonen | string |  |
| Status | Status | [Status](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=InterestApplication_Status) |  |
