<!-- https://connect.maklare.vitec.net/Help/Category?version=v1&categoryId=CRM-Contact, fetched 2026-10-04 -->

### CRM med inriktning kontakter

### BuyerSettings

CRM metoder för en köpare

| API | Beskrivning |
| --- | --- |
| [GET CRM/Buyer/{customerId}/{contactId}/Estate/{estateId}/Economy](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Buyer-customerId-contactId-Estate-estateId-Economy) | Bank- och försäkringsppgifter |
| [POST CRM/Buyer/{customerId}/{contactId}/LoanPromise](https://connect.maklare.vitec.net/Help/Api/POST-CRM-Buyer-customerId-contactId-LoanPromise) | Lånelöfte |

### Note

| API | Beskrivning |
| --- | --- |
| [POST Note/{customerId}](https://connect.maklare.vitec.net/Help/Api/POST-Note-customerId) | Sparar en anteckning |
| [GET Note/{customerId}/GetNotes](https://connect.maklare.vitec.net/Help/Api/GET-Note-customerId-GetNotes) | Hämtar lista av anteckningar för en kontakt |

### Task

Används för att hämta uppgifter

| API | Beskrivning |
| --- | --- |
| [GET Task/GetTasks](https://connect.maklare.vitec.net/Help/Api/GET-Task-GetTasks) | Hämtar alla fördefinierade typade uppgifter |

### Image

Bilder

| API | Beskrivning |
| --- | --- |
| [GET CRM/Image/GetImage](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Image-GetImage) | Hämtar bilder. |
| [POST CRM/Image/{customerId}/{estateId}](https://connect.maklare.vitec.net/Help/Api/POST-CRM-Image-customerId-estateId) | Metod för att lägga till en ny bild (gif,jpg,tiff,bmp,png) till en bostad. |
| [PUT CRM/Image/{customerId}/{imageId}](https://connect.maklare.vitec.net/Help/Api/PUT-CRM-Image-customerId-imageId) | Metod för att uppdatera en bild (gif,jpg,tiff,bmp,png). |
| [GET CRM/Image/GetImageCategories](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Image-GetImageCategories) | Metod för att hämta bildkategorier |
| [DELETE CRM/Image/{customerId}/{imageId}](https://connect.maklare.vitec.net/Help/Api/DELETE-CRM-Image-customerId-imageId) | Metod för att ta bort en bild |

### CrmOffice

CRM metoder för kontor

| API | Beskrivning |
| --- | --- |
| [GET CRM/Office/{customerId}/{id}/FocusAreas](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Office-customerId-id-FocusAreas) | Hämta fokusområden för huvudkontor |

### CRM Newsletter

CRM metoder för nyhetsbrev

| API | Beskrivning |
| --- | --- |
| [GET CRM/Newsletter/{customerId}/NewsletterLists](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Newsletter-customerId-NewsletterLists) | Hämtar en lista med alla nyhetsbrevslistor |
| [GET CRM/Newsletter/{customerId}/NewsletterlistContacts/{listId}](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Newsletter-customerId-NewsletterlistContacts-listId) | Hämtar en lista med kontakter som ingår i en nyhetsbrevslista |
| [POST CRM/Newsletter/{customerId}/NewsletterList/{listId}/{contactId}](https://connect.maklare.vitec.net/Help/Api/POST-CRM-Newsletter-customerId-NewsletterList-listId-contactId) | Lägg till kontakten i nyhetsbrevslistan. |
| [DELETE CRM/Newsletter/{customerId}/NewsletterList/{listId}/{contactId}](https://connect.maklare.vitec.net/Help/Api/DELETE-CRM-Newsletter-customerId-NewsletterList-listId-contactId) | Ta bort kontakten från en nyhetsbrevslista |

### Officegroups

Kontorsgrupper

| API | Beskrivning |
| --- | --- |
| [GET CRM/Officegroups/{customerId}](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Officegroups-customerId) | Hämta kontorsgrupper |

### Report

Rapporter

| API | Beskrivning |
| --- | --- |
| [GET CRM/Report/{customerId}/ViewingParticipant](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Report-customerId-ViewingParticipant) |  |

### Customer Satisfaction

Hantering av kundundersökningar

| API | Beskrivning |
| --- | --- |
| [POST CRM/Estate/{customerId}/{estateId}/CustomerSatisfaction](https://connect.maklare.vitec.net/Help/Api/POST-CRM-Estate-customerId-estateId-CustomerSatisfaction) | Sparar ett enkätsvar som visar hur nöjd en kund utifrån rollen som visningsdeltagare, säljare eller köpare var med handläggarens arbete. |

### Usergroups

Användargrupper

| API | Beskrivning |
| --- | --- |
| [GET CRM/Usergroups/{customerId}](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Usergroups-customerId) | Hämta användargrupp |

### SellerSettings

CRM metoder för en säljare

| API | Beskrivning |
| --- | --- |
| [GET CRM/Seller/{customerId}/{contactId}/Estate/{estateId}/Economy](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Seller-customerId-contactId-Estate-estateId-Economy) | Bankuppgifter |

### Category

Hämtar kategorier

| API | Beskrivning |
| --- | --- |
| [GET Category/GetCategories](https://connect.maklare.vitec.net/Help/Api/GET-Category-GetCategories) | Hämtar kategorier. För att kunna hämta kategorier så krävs det en giltig API nyckel och ett kundid |

### SpeculatorSettings

CRM metoder för en spekulant

| API | Beskrivning |
| --- | --- |
| [PUT CRM/Speculator/{customerId}/{contactId}/Estate/{estateId}](https://connect.maklare.vitec.net/Help/Api/PUT-CRM-Speculator-customerId-contactId-Estate-estateId) |  |

### CRM Kontakter

CRM metoder för en kontakt

| API | Beskrivning |
| --- | --- |
| [GET CRM/Contact/{customerId}](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId) | Hämta lista av kontakter som matchar ett kriterie. |
| [GET CRM/Contact/{customerId}/Search](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-Search) | Fritextsökning (Namn, personnummer, e-postadress, telefonnummer etc). |
| [GET CRM/Contact/{customerId}/search/SocialNumber](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-search-SocialNumber) | Sökning på personnummer eller organisationsnummer. |
| [GET CRM/Contact/{customerId}/{contactId}](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-contactId) | Hämta kontakt |
| [GET CRM/Contact/{customerId}/{contactIds}](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-contactIds) | Hämta lista utav kontakter, max 20 stycken åt gången. |
| [GET CRM/Contact/{customerId}/Company/{contactId}](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-Company-contactId) | Hämta företagskontakt |
| [GET CRM/Contact/{customerId}/Company/{contactIds}](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-Company-contactIds) | Hämta lista utav företagskontakter, max 20 stycken åt gången. Om fler än 5 kontakt-ID:n anges, ska de skickas som query-parametrar. |
| [GET CRM/Contact/{customerId}/Company](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-Company) | Hämta lista utav företagskontakter, max 20 stycken åt gången. Om fler än 5 kontakt-ID:n anges, ska de skickas som query-parametrar. |
| [GET CRM/Contact/{customerId}/Person/{contactId}](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-Person-contactId) | Hämta personkontakt |
| [GET CRM/Contact/{customerId}/Person/{contactIds}](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-Person-contactIds) | Hämta lista utav personkontakter, max 20 stycken åt gången.Om fler än 5 kontakt-ID:n anges, ska de skickas som query-parametrar. |
| [GET CRM/Contact/{customerId}/Person](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-Person) | Hämta lista utav personkontakter, max 20 stycken åt gången.Om fler än 5 kontakt-ID:n anges, ska de skickas som query-parametrar. |
| [GET CRM/Contact/{customerId}/DeceasedEstate/{contactId}](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-DeceasedEstate-contactId) | Hämta dödsbokontakt |
| [GET CRM/Contact/{customerId}/DeceasedEstate/{contactIds}](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-DeceasedEstate-contactIds) | Hämta lista utav dödsbokontakter, max 20 stycken åt gången. Om fler än 5 kontakt-ID:n anges, ska de skickas som query-parametrar. |
| [GET CRM/Contact/{customerId}/DeceasedEstate](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-DeceasedEstate) | Hämta lista utav dödsbokontakter, max 20 stycken åt gången. Om fler än 5 kontakt-ID:n anges, ska de skickas som query-parametrar. |
| [GET CRM/Contact/{customerId}/PresentAccomodation/{contactId}](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-PresentAccomodation-contactId) | Hämta nuvarande boende för en kontakt. |
| [POST CRM/Contact/{customerId}/PresentAccomodation/{contactId}](https://connect.maklare.vitec.net/Help/Api/POST-CRM-Contact-customerId-PresentAccomodation-contactId) | Nuvarande boende för en kontakt. |
| [GET CRM/Contact/{customerId}/PresentAccomodation/{contactIds}](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-PresentAccomodation-contactIds) | Hämta lista av nuvarande boenden för kontakter, max 20 stycken kontakter åt gången. Om fler än 5 kontakt-ID:n anges, ska de skickas som query-parametrar. |
| [GET CRM/Contact/{customerId}/PresentAccomodation](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-PresentAccomodation) | Hämta lista av nuvarande boenden för kontakter, max 20 stycken kontakter åt gången. Om fler än 5 kontakt-ID:n anges, ska de skickas som query-parametrar. |
| [GET CRM/Contact/{customerId}/PresentAccomodation/Statistics](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-PresentAccomodation-Statistics) | Hämta statistik gällande lämnarinfo för spekulanter på sålda objekt |
| [GET CRM/Contact/{customerId}/Speculator/{contactId}](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-Speculator-contactId) | Hämta spekulantrelationerna för en kontakt. |
| [GET CRM/Contact/{customerId}/Speculator/{contactIds}](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-Speculator-contactIds) | Hämta lista av spekulantrelationer för kontakter, max 20 stycken kontakter åt gången. Om fler än 5 kontakt-ID:n anges, ska de skickas som query-parametrar. |
| [GET CRM/Contact/{customerId}/Speculator](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-Speculator) | Hämta lista av spekulantrelationer för kontakter, max 20 stycken kontakter åt gången. Om fler än 5 kontakt-ID:n anges, ska de skickas som query-parametrar. |
| [GET CRM/Contact/{customerId}/Buyer/{contactId}](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-Buyer-contactId) | Hämta köparrelationerna för en kontakt. |
| [GET CRM/Contact/{customerId}/Buyer/{contactIds}](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-Buyer-contactIds) | Hämta lista av köparrelationer för kontakter, max 20 stycken kontakter åt gången. Om fler än 5 kontakt-ID:n anges, ska de skickas som query-parametrar. |
| [GET CRM/Contact/{customerId}/Buyer](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-Buyer) | Hämta lista av köparrelationer för kontakter, max 20 stycken kontakter åt gången. Om fler än 5 kontakt-ID:n anges, ska de skickas som query-parametrar. |
| [GET CRM/Contact/{customerId}/Seller/{contactId}](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-Seller-contactId) | Hämta säljarrelationerna för en kontakt. |
| [GET CRM/Contact/{customerId}/Seller/{contactIds}](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-Seller-contactIds) | Hämta lista av säljarrelationer för kontakter, max 20 stycken kontakter åt gången. Om fler än 5 kontakt-ID:n anges, ska de skickas som query-parametrar. |
| [GET CRM/Contact/{customerId}/Seller](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-Seller) | Hämta lista av säljarrelationer för kontakter, max 20 stycken kontakter åt gången. Om fler än 5 kontakt-ID:n anges, ska de skickas som query-parametrar. |
| [PUT CRM/Contact/{customerId}/{contactId}/OptOut](https://connect.maklare.vitec.net/Help/Api/PUT-CRM-Contact-customerId-contactId-OptOut) | Avregistrera utskick |
| [DELETE CRM/Contact/{customerId}/{contactId}/Category/{id}](https://connect.maklare.vitec.net/Help/Api/DELETE-CRM-Contact-customerId-contactId-Category-id) | Ta bort en kategori från en kontakt. |
| [GET CRM/Contact/{customerId}/EstateValuation/{contactId}](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-EstateValuation-contactId) | Hämtar ut information om tjänsten "Ditt bostadsvärde" för en kontakt |
| [GET CRM/Contact/{customerId}/EstateValuation/{contactIds}](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-EstateValuation-contactIds) | Hämtar ut information om tjänsten "Ditt bostadsvärde" för en lista av kontakter, max 20 stycken åt gången. |
| [PUT CRM/Contact/{customerId}/{contactId}/SearchProfile/External](https://connect.maklare.vitec.net/Help/Api/PUT-CRM-Contact-customerId-contactId-SearchProfile-External) | Skapa/uppdatera information om sökprofil hos extern partner för kontakt |
| [DELETE CRM/Contact/{customerId}/{contactId}/SearchProfile/External](https://connect.maklare.vitec.net/Help/Api/DELETE-CRM-Contact-customerId-contactId-SearchProfile-External) | Ta bort information om en sökprofil hos extern partner för kontakt |
| [GET CRM/Contact/{customerId}/{contactId}/{objectLeadType}/{contactLeadType}/{logLeadType}/{outgoingLeadType}/Lead](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-contactId-objectLeadType-contactLeadType-logLeadType-outgoingLeadType-Lead) | Hämta info om leads för en kontakt. |
| [GET CRM/Contact/{customerId}/{contactIds}/{objectLeadType}/{contactLeadType}/{logLeadType}/{outgoingLeadType}/Lead](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-contactIds-objectLeadType-contactLeadType-logLeadType-outgoingLeadType-Lead) | Hämta lista av info om leads för kontakter, max 20 stycken kontakter åt gången. |
| [GET CRM/Contact/{customerId}/{contactId}/Tip](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-contactId-Tip) | Hämta info om tips för en kontakt. |
| [GET CRM/Contact/{customerId}/{contactIds}/Tip](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-contactIds-Tip) | Hämta lista av info om tips för kontakter, max 20 stycken kontakter åt gången. |
| [GET CRM/Contact/{customerId}/{contactId}/ComebackMeeting](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-contactId-ComebackMeeting) | Hämta info om återkomster för en kontakt. |
| [GET CRM/Contact/{customerId}/{contactIds}/ComebackMeeting](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-contactIds-ComebackMeeting) | Hämta lista av info om återkomster för kontakter, max 20 stycken kontakter åt gången. |
| [GET CRM/Contact/{customerId}/{contactId}/Meeting](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-contactId-Meeting) | Hämta info om möten för en kontakt. |
| [PUT CRM/Contact/{customerId}/{contactId}/Searching](https://connect.maklare.vitec.net/Help/Api/PUT-CRM-Contact-customerId-contactId-Searching) | Ska kontaktens sökprofiler matchas |
| [GET CRM/Contact/{customerId}/{contactIds}/Meeting](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-contactIds-Meeting) | Hämta lista av info om möten för kontakter, max 20 stycken kontakter åt gången. |
| [GET CRM/Contact/{customerId}/{contactId}/Order/EndPrice](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-contactId-Order-EndPrice) | Hämta info om kontakts tjänster avseende "Slutpriser i området". |
| [GET CRM/Contact/{customerId}/{contactIds}/Order/EndPrice](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-contactIds-Order-EndPrice) | Hämta lista av info om kontakts tjänster avseende "Slutpriser i området", max 20 stycken kontakter åt gången. |
| [POST CRM/Contact/{customerId}/{contactId}/NewAddress](https://connect.maklare.vitec.net/Help/Api/POST-CRM-Contact-customerId-contactId-NewAddress) | Uppdatera personens nya adress. |
| [POST CRM/Contact/{customerId}/{contactId}/Verify](https://connect.maklare.vitec.net/Help/Api/POST-CRM-Contact-customerId-contactId-Verify) | Ange att personen är verifierad via t ex BankId. |
| [GET CRM/Contact/{customerId}/{contactId}/Relations](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-contactId-Relations) | Lista med företag där kontakten är firmatecknare eller kontaktperson och/eller dödsbon där kontakten är dödsbodelägare |
| [GET CRM/Contact/{customerId}/{contactId}/ContactRelations](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-contactId-ContactRelations) | Kontakt-kontakt-relationer en kontakt har. |
| [GET CRM/Contact/{customerId}/{contactId}/PartyRoles](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-contactId-PartyRoles) | Alla köp-, sälj- och extra köp-/sälj-relationer en kontakt har |

### Bid

Bud

| API | Beskrivning |
| --- | --- |
| [GET CRM/Bid/{customerId}/{id}](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Bid-customerId-id) | Hämta information om ett bud |
| [DELETE CRM/Bid/{customerId}/{id}](https://connect.maklare.vitec.net/Help/Api/DELETE-CRM-Bid-customerId-id) | Annulera ett bud |
| [GET CRM/Bids/{customerId}](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Bids-customerId) | Hämta information om synliga bud kopplat till en budgivare och/eller bostad. |
| [GET CRM/HiddenBids/{customerId}](https://connect.maklare.vitec.net/Help/Api/GET-CRM-HiddenBids-customerId) | Hämta information om dolda bud kopplat till en budgivare och/eller bostad. |
| [POST CRM/Bid/{customerId}/{estateId}/{contactId}](https://connect.maklare.vitec.net/Help/Api/POST-CRM-Bid-customerId-estateId-contactId) | Metod för att lägga bud på en bostad. |

### Meeting

Resurser för möten

| API | Beskrivning |
| --- | --- |
| [GET Meeting/{customerId}/{id}](https://connect.maklare.vitec.net/Help/Api/GET-Meeting-customerId-id) | Hämtar ett bokat möte |
| [POST Meeting/GetMeetings](https://connect.maklare.vitec.net/Help/Api/POST-Meeting-GetMeetings) | Hämtar bokade möten. |
| [POST Meeting/Assignment/{customerId}/{estateId}](https://connect.maklare.vitec.net/Help/Api/POST-Meeting-Assignment-customerId-estateId) | Boka intagsmöte |
| [POST Meeting/Comeback/{customerId}/{contactId}](https://connect.maklare.vitec.net/Help/Api/POST-Meeting-Comeback-customerId-contactId) | Skapa återkomst |

### User

Användarinformation.

| API | Beskrivning |
| --- | --- |
| [GET User/GetUser](https://connect.maklare.vitec.net/Help/Api/GET-User-GetUser) | Hämtar lista över publika användare. |
| [GET User/GetAllUsers](https://connect.maklare.vitec.net/Help/Api/GET-User-GetAllUsers) | Hämtar lista över alla användare. |
| [POST User/Notify/{customerId}](https://connect.maklare.vitec.net/Help/Api/POST-User-Notify-customerId) | Notifierar användare |

### FocusArea

Focusområden

| API | Beskrivning |
| --- | --- |
| [GET CRM/Focusarea/{customerId}/{latitude}/{longitude}/Owner](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Focusarea-customerId-latitude-longitude-Owner) | Hämtar användare eller kontor vars focusområden innehåller koordinat |
| [GET CRM/Focusarea/{customerId}/User/{userId}](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Focusarea-customerId-User-userId) | Hämtar användarens focusområden. |
| [POST CRM/Focusarea/{customerId}/User/{userId}](https://connect.maklare.vitec.net/Help/Api/POST-CRM-Focusarea-customerId-User-userId) | Uppdaterar användarens focusområden. |
| [DELETE CRM/Focusarea/{customerId}/User/{userId}](https://connect.maklare.vitec.net/Help/Api/DELETE-CRM-Focusarea-customerId-User-userId) | Tar bort alla fokusområden från användaren |

### IncreasedRequirements

Utökade krav

| API | Beskrivning |
| --- | --- |
| [GET IncreasedRequirement/{customerId}](https://connect.maklare.vitec.net/Help/Api/GET-IncreasedRequirement-customerId) | Hämta utökadekrav |

### Searchprofiles

| API | Beskrivning |
| --- | --- |
| [GET CRM/Contact/{customerId}/SearchProfile/SearchProfileValues](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-SearchProfile-SearchProfileValues) | Hämtar undertyper och giltiga värden för sökprofiler |
| [PUT CRM/Contact/{customerId}/SearchProfile/Extend/{contactId}](https://connect.maklare.vitec.net/Help/Api/PUT-CRM-Contact-customerId-SearchProfile-Extend-contactId) | Förläng en kontakts samtliga sökprofilers giltighetsdatum |
| [GET CRM/Contact/{customerId}/SearchProfile/{contactId}/{searchprofileId}](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Contact-customerId-SearchProfile-contactId-searchprofileId) | Hämtar en kontakts sökprofiler |
| [POST CRM/Contact/{customerId}/SearchProfile/Residential/{contactId}](https://connect.maklare.vitec.net/Help/Api/POST-CRM-Contact-customerId-SearchProfile-Residential-contactId) | Skapa en sökprofil av typen boende(villa, lägenhet, tomt, radhus, fritidshus) |
| [PUT CRM/Contact/{customerId}/SearchProfile/Residential/{id}](https://connect.maklare.vitec.net/Help/Api/PUT-CRM-Contact-customerId-SearchProfile-Residential-id) | Uppdatera en sökprofil av typen boende(villa, lägenhet, tomt, radhus, fritidshus) |
| [POST CRM/Contact/{customerId}/SearchProfile/Farm/{contactId}](https://connect.maklare.vitec.net/Help/Api/POST-CRM-Contact-customerId-SearchProfile-Farm-contactId) | Skapa en sökprofil av typen gård |
| [PUT CRM/Contact/{customerId}/SearchProfile/Farm/{id}](https://connect.maklare.vitec.net/Help/Api/PUT-CRM-Contact-customerId-SearchProfile-Farm-id) | Uppdatera en sökprofil av typen gård |
| [POST CRM/Contact/{customerId}/SearchProfile/Foreign/{contactId}](https://connect.maklare.vitec.net/Help/Api/POST-CRM-Contact-customerId-SearchProfile-Foreign-contactId) | Skapa en sökprofil av typen utlandsbostad |
| [PUT CRM/Contact/{customerId}/SearchProfile/Foreign/{id}](https://connect.maklare.vitec.net/Help/Api/PUT-CRM-Contact-customerId-SearchProfile-Foreign-id) | Uppdatera en sökprofil av typen utlandsbostad |
| [POST CRM/Contact/{customerId}/SearchProfile/Commercial/{contactId}](https://connect.maklare.vitec.net/Help/Api/POST-CRM-Contact-customerId-SearchProfile-Commercial-contactId) | Skapa en sökprofil av typen kommersiell fastighet |
| [PUT CRM/Contact/{customerId}/SearchProfile/Commercial/{id}](https://connect.maklare.vitec.net/Help/Api/PUT-CRM-Contact-customerId-SearchProfile-Commercial-id) | Uppdatera en sökprofil av typen kommersiell fastighet |
| [POST CRM/Contact/{customerId}/SearchProfile/Premises/{contactId}](https://connect.maklare.vitec.net/Help/Api/POST-CRM-Contact-customerId-SearchProfile-Premises-contactId) | Skapa en sökprofil av typen lokal |
| [PUT CRM/Contact/{customerId}/SearchProfile/Premises/{id}](https://connect.maklare.vitec.net/Help/Api/PUT-CRM-Contact-customerId-SearchProfile-Premises-id) | Uppdatera en sökprofil av typen lokal |
| [DELETE CRM/Contact/{customerId}/SearchProfile/{id}](https://connect.maklare.vitec.net/Help/Api/DELETE-CRM-Contact-customerId-SearchProfile-id) | Radera en kontakts sökprofil |
| [DELETE CRM/Contact/{customerId}/SearchProfiles/{contactId}](https://connect.maklare.vitec.net/Help/Api/DELETE-CRM-Contact-customerId-SearchProfiles-contactId) | Radera en kontakts samtliga sökprofiler av samtliga typer |

### CRM Merge

CRM metoder för sammanslagning av kontakter

| API | Beskrivning |
| --- | --- |
| [POST CRM/MergeContact/{customerId}/{targetContactId}/Merge/{contactIds}](https://connect.maklare.vitec.net/Help/Api/POST-CRM-MergeContact-customerId-targetContactId-Merge-contactIds) |  |
| [PUT CRM/MergeContact/{customerId}/{contactId}/Merge](https://connect.maklare.vitec.net/Help/Api/PUT-CRM-MergeContact-customerId-contactId-Merge) | Uppdatera sammanslagen kontakt |

### CustomField

Hämtar egendefinerade fält.

| API | Beskrivning |
| --- | --- |
| [GET CustomField/Get](https://connect.maklare.vitec.net/Help/Api/GET-CustomField-Get) | Hämtar egendefinerade fält. |

### Contacts

Hämtar lista över kontakter. Skapar eller uppdaterar nya kontakter.

| API | Beskrivning |
| --- | --- |
| [POST Contacts/GetContacts](https://connect.maklare.vitec.net/Help/Api/POST-Contacts-GetContacts) | Hämtar lista över kontakter. |
| [POST Contacts/GetContactsSyncList](https://connect.maklare.vitec.net/Help/Api/POST-Contacts-GetContactsSyncList) | Hämtar lista över kontakters id och ändringsdatum. |
| [GET Contacts/GetContactsWithPhonenumber](https://connect.maklare.vitec.net/Help/Api/GET-Contacts-GetContactsWithPhonenumber) | Hämtar lista av kontaktid med telfonnummer |
| [POST Contacts/UpdatePerson](https://connect.maklare.vitec.net/Help/Api/POST-Contacts-UpdatePerson) | Skapar en ny eller uppdaterar en befintlig kontaktperson. Dubblettkontroll sker på 1) kontaktid, 2) personnummer, 3) förnamn och efternamn, och något av telefonnummer, mobilnummer eller epostadress. Matar man in information i något av ovanstående fält, så fylls övriga fält i automatiskt. Minst ett fält behöver vara ifyllt för att dubblettkontroll ska kunna göras. Om dubblettkontrollen inte hittar en redan befintlig kontakt skapas en ny. |
| [POST Contacts/UpdateCompany](https://connect.maklare.vitec.net/Help/Api/POST-Contacts-UpdateCompany) | Skapar en ny eller uppdaterar en befintlig företagskontakt. Dubblettkontroll sker på 1) kontaktid, 2) organisationsnummer, 3) företagsnamn, telefonnummer eller epostadress. Matar man in information i något av ovanstående fält, så fylls övriga fält i automatiskt. Minst ett fält behöver vara ifyllt för att dubblettkontroll ska kunna göras. Om dubblettkontrollen inte hittar en redan befintlig kontakt skapas en ny. |

### CrmSubOffice

Underkontor

| API | Beskrivning |
| --- | --- |
| [GET CRM/Office/{customerId}/Sub/{subOfficeId}](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Office-customerId-Sub-subOfficeId) | Hämta ett underkontor |
| [GET CRM/Office/{customerId}/Sub/{subOfficeIds}](https://connect.maklare.vitec.net/Help/Api/GET-CRM-Office-customerId-Sub-subOfficeIds) | Hämta flera underkontor |

### Office

Information om mäklarkontoret.

| API | Beskrivning |
| --- | --- |
| [GET Office/GetOffice](https://connect.maklare.vitec.net/Help/Api/GET-Office-GetOffice) | Hämtar företag. Hämtar information om mäklarkontoret. |

### Appointment

Kalenderhändeler

| API | Beskrivning |
| --- | --- |
| [POST Appointment/{customerId}/{id}](https://connect.maklare.vitec.net/Help/Api/POST-Appointment-customerId-id) | Skapa kalenderhändelse |
