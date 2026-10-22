<!-- https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingLeadPerson, fetched 2026-10-04 -->

# AdvertisingLeadPerson

Kontaktperson som leadet avser

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| FirstName | Förnamn | string | Förnamn krävs Förnamn måste vara mellan 1 och 40 tecken |
| LastName | Efternamn | string | Efternamn krävs Efternamn måste vara mellan 1 och 40 tecken |
| SocialSecurityNumber | Personnummer | string | Personnummer måste vara mellan 0 och 20 tecken |
| IsForeignSocialSecurityNumber | Annat format/utländskt personnummer | boolean |  |
| Address | Adress | [AdvertisingLeadAddress](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Advertising_AdvertisingLeadAddress) |  |
| Email | Email | [Email](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_Email) | Epostadress, telefonnummer eller mobilnummer måste anges |
| Telephone | Telefonnummer | [PersonTelephoneNumbers](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=Models_PersonTelephoneNumbers) | Epostadress, telefonnummer eller mobilnummer måste anges |
