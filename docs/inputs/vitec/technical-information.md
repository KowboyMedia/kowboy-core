<!-- https://connect.maklare.vitec.net/Help/TechnicalInformation, fetched 2026-10-04 -->

## Teknisk Beskrivning

Bakgrund

Connect är ett API som möjliggör samverkan med mäklarsystemet. Det innebär att andra system och applikationer kan komma åt den information som finns i mäklarsystemet, till exempel data om bostäder och kontakter, för att använda vidare i det externa systemet.

Exempel på användningsområden kan vara objektpresentationer, intresseanmälningar eller liknande på mäklarens hemsida, där man kan vilja särskilja sig från standardprodukten genom att låta en datakonsult bygga en egen lösning som stämmer mer överens med företagets övriga grafiska profil. Ett annat exempel är om man vill att ekonomiska data ska föras över till ett externt ekonomi- eller löneprogram.

Connect använder samma affärslogik och regler som Vitec Express.

Via anrop till Vitec Connect går det att läsa och skriva information och köra funktioner i Vitec Express.

När ni bygger listor och beskrivningar via Connect så krävs det att ni mellanlagrar informationen ni hämtar från Connect, så att listor och beskrivningar visas snabbare. När ni har hämtat information från Connect så skall informationen sparas och återanvändas. T ex om ni ska bygga en beskrivning så hämtar ni bostadsinformationen en gång och återanvänder informationen när olika besökare besöker bostadsbeskrivningen. Än viktigare är att detta görs för bilder och filer då de kan vara stora och ta lång tid att hämta.

Rättighetsmodell

För att kunna anropa Connect så måste du vara en registrerad partner. Registrering sker kostnadsfritt i Vitec Connect Portalen. Efter registreringen skapas ett användarnamn.

För varje kund/grupp och funktionsgrupp som partnern har rättighet till så skapas också ett lösenord automatiskt. Lösenord och användarnamn används sedan vid varje anrop till Vitec Connect.

Användarnamn används som username och lösenord som password och anges enligt http basic authentication. Se client side authentication på [https://datatracker.ietf.org/doc/html/rfc2617](https://datatracker.ietf.org/doc/html/rfc2617) eller [https://en.wikipedia.org/wiki/Basic_access_authentication](https://en.wikipedia.org/wiki/Basic_access_authentication) . Den färdiga base64-kodade strängen finns även att tillgå i portalen.

Utifrån behov tilldelas sedan rättighet att köra funktionsgrupper för en eller flera kunder. T.ex. kan en partner ha rätt till de funktioner för att bygga en hemsida för en kund och ha rätt att läsa information från Beslutsstöd för en annan kund.

Tilldelning av rättigheter sker av Vitec efter beställning från kund. Framöver är tanken att kund själv kommer kunna tilldela rättigheterna.

Anrop

Ett anrop till Connect utför en funktion, t.ex. hämta en villa, spara en intresseanmälan, och sker enligt REST [https://en.wikipedia.org/wiki/REST](https://en.wikipedia.org/wiki/REST) .

Vid varje anrop skickas autentiseringsinformation med (se Rättighetsmodell), information om vilken funktion som ska utföras (URI) och olika inparametrar beroende på funktion. I de flesta funktioner måste kund eller grupp specificeras vilket görs genom parametern customer (se mer nedan).

Ett exempelanrop kan se ut enligt nedan (kursiv text är parametervärden: GET BusinessIntelligence/OfficeStatistics?customer=G2&dateFrom=2014-01- 01&dateTo=2014-01-31

Anropet sager att vi anropar funktionen OfficeStatistics bland BusinessIntelligence funktionerna och vi vill hämta data för perioden 2014-01-01 till 2014-01-31 för grupp 2.

Om vi har rätt att hämta den information för den gruppen kommer vi få ett JSON-formaterat resultat som svar. Exempelvis:

```
[
    {
        "customerId": 1,
        "name": "sample string 2",
        "commission": 3.1,
        "totalSales": 4.1,
        "commissionPercentage": 5.1,
        "averageCommission": 6.1,
        "attemptedIntakes": 7,
        "sold": 8
    },
    {
        "customerId": 1,
        "name": "sample string 2",
        "commission": 3.1,
        "totalSales": 4.1,
        "commissionPercentage": 5.1,
        "averageCommission": 6.1,
        "attemptedIntakes": 7,
        "sold": 8
    }
]
```

Vilken information som returneras beror naturligtvis på vilken funktion som anropats.

Skulle något gå fel under anropet så returneras ett felet med korrekt http-retur-kod och ett JSON-felmeddelande. Exempel på fel kan vara felaktigt inloggning, felaktiga inparametrar eller att något gick fel på servern när funktionen utfördes.

Parametern kund-id (customerId)

Parametern kund-id specificerar för vilken eller vilka kunder man vill få information. Eftersom Connect ger tillgång till flera olika produkter så finns det olika kundnummer-serier. Varje kundnummer måste därför föregås av ett prefix.

- S30164 - Kundnummer 30164 för Säljstöd

- M30011 - Kundnummer 30011 för Mäklarsystem

- O311 - Kundnummer 311 för Vitec ekonomisystem

Därtill kan även en grupp av kunder anropas genom att ange deras gruppnummer

- G2 - Grupp 2

- T2 - Kundmiljö 2

Säkerhet

Vitec Connect är designat för att anropas från serverbaserad kod. Anrop ska med andra ord aldrig ske direkt från en webbläsare. Vid anrop direkt från en webbläsare exponeras lösenord och ger möjlighet för en utomstående att se och därmed använda samma inloggning. En angripare får därmed samma rättigheter (möjligheter) som partnern.

All kommunikation mot funktioner i Connect sker via TLS (SSL). Certifikatet är ett wildcardcertfikat för *.maklare.vitec.net. Certifikatet förnyas normalt vartannat år och ingen information skickas ut innan certifikatet förnyas.

I övrigt styrs säkerheten via ovan beskrivna rättighetsmodell.

Portalen

Vitec Connect Portalen är till för att en partner ska kunna administrera sitt företagskonto och sina kontaktpersoner. Utöver det går det även att se vilka funktionsgrupper som får köras för olika kunder.

I portalen finns även tillgång till hjälp och en logg över de senaste anropet gjorda från den inloggade partnern.

Var noga med att hålla kontaktinformationen aktuell för att få nyheter och information om Vitec Connect.

Att tänka på - Felhantering

Då Vitec omöjligt kan garantera 100% upptid mellan klienten som hämtar och servern som levererar information är det viktigt att alla lösningar byggs med ordentlig felhantering. Kan inte information hämtas bör ett välformaterat meddelande visas för slutanvändaren om denna påverkas. Kan inte informationen sparas bör den mellanlagras för omförsök.

Att tänka på - Nyckelhantering

Lösenordet bör lagras på ett sätt så den inte lätt kan nås av annan part, gärna krypterad. Den bör inte vara hårdkodad utan ligga på ett sätt så att den är lätt att uppdatera om behovet skulle uppstå.
