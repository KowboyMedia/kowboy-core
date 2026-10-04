<!-- https://connect.maklare.vitec.net/Help/AdvertisingPreview, fetched 2026-10-04 -->

## Förhandsgranska bostäder på hemsida

### Bakgrund

Det finns ett behov av att presentera en bostadsbeskrivning innan bostaden är annonserad, en så kallad förhandsgranskning av bostaden. Det vara bra att få en uppfattning över hur annonsen ser ut innan den publiceras och eventuellt få ett godkännande av säljaren.

### Flöden

Det flöde vi rekommenderar för förhandsgranskningar är dessa 2 scenarion:

- Användaren eller säljaren klickar på förhandsgranska

- En landningssida visas

- Bostaden finns lagrad, beskrivningen visas

- Samtidigt hämtas bostaden via Connect för att se till så att bostaden är uppdaterad till senaste

- Om en uppdatering av bostaden finns så uppdateras beskrivningen och presenterar den uppdaterade versionen

- Användaren eller säljaren klickar på förhandsgranska

- En landningssida visas

- Bostaden finns inte lagrad, sidan visar att förhandsgranskningen förbereds

- Samtidigt hämtas bostaden via Connect

- När bostaden är hämtad så visas beskrivningen

- Finns inte bostaden så presenteras information om att bostaden saknas

### Validering

Behöver också se till att vi inte visar vilken bostad som helst. Statusen bör vara kundbearbetning, uppdrag, snart till salu, kommande eller till salu. Är bostaden annonserad så bör vanliga beskrivningen visas.

### Vitec förhandsgranskning API

Då vi har ett väl definierat flöde som vi rekommenderar här, så har vi byggt en landningssida som ni kan använda för att förenkla förhandsgranskningar för er. Där vi tar hand om flödet och valideringen åt er. Det ni behöver tänka på är följande:

- Skapa en API GET metod för att initiera förhandsgranskning

- Skapa en API GET metod för att verifiera att ni hämtat uppdateringen

Vid initiering av förhandsgranskningen så anropas en URL hos er via GET. T ex : https://www.example.com/api/preview/init?customerId=M123&estateId=OBJ123_1234567890. Vi förväntar oss ett JSON som svar i formatet:

```
{
    "url": "https://www.example.com/preview/splash",
    "state": "aaaaa-bbbbb-ccccc-ddddd"
}
```

- "url" är en URL till befintlig förhandsgranskning, en sida som ni vill visa under tiden som förhandsgranskningen laddas eller null om ni inte vill visa någon sida

- "state" parametern ni returneras kommer vi att skicka med i verifieringsanropet och kan vara vad ni vill eller utelämnas om ni inte behöver ha ett state mellan anropen

Efter initieringen så kommer vi att anropa med jämna mellanrum en verifieringsurl hos er för att verifiera att ni hämtat uppdateringen. T ex : https://www.example.com/api/preview/verify?customerId=M123&estateId=OBJ123_1234567890&state=aaaaa-bbbbb-ccccc-ddddd. Vi förväntar oss ett JSON som svar i formatet:

```
{
    "isReady": true,
    "url": "https://www.example.com/description/OBJ123_1234567890",
    "errorMessage": "Sample string"
}
```

- "isReady" är en boolean som indikerar om uppdateringen är klar eller inte

- "url" är en URL till förhandsgranskningen av annonsen, eller null om isReady är false

- "errorMessage" är en sträng som innehåller ett felmeddelande om något gick fel

När vi får "isReady": true från er så kommer vi att visa URL:en i "url" eller refresha sidan om "url" samma som initieringsanropet svarade.

Får vi ett felmeddelande i "errorMessage" så kommer den informationen att presenteras på landningssidan och förhandsgranskningen kommer att avbrytas.
