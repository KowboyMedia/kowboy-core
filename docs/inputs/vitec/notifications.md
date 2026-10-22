<!-- https://connect.maklare.vitec.net/Help/NotificationsApi, fetched 2026-10-04 -->

Prenumerationer kan sättas upp för information som förändras i Vitec via Express eller Connect. När information förändras så kontrollerar Vitec vilka prenumerationer som berörs. Om det finns prenumerationer som matchar förändringarna så skickas notifieringar ut för berörda prenumerationerna.

Den URL som notifieras ska omgående returnera en HTTP-statuskod i 200-serien. Tidsgränsen är två sekunder. En höjning görs endast om det är absolut nödvändigt och då endast tillfälligt. Återförsök är inte aktiverade som standard. Om återförsök har aktiverats kan HTTP-svar i 500-serien leda till ett nytt leveransförsök. HTTP-svar i 300- och 400-serierna samt timeout leder inte till återförsök.

### Manuell notifikation

Innan Vitec aktiverar prenumerationen så kan ni prova att manuellt skapa en notifiering via [Vitec Connect notifikationstest](https://connect.maklare.vitec.net/Help/TryOutSubscription)

### Prenumeration

En prenumeration beskriver kriterier över vilka förändringar som ska trigga notifieringar.

För vanliga förändringar väljer ni uppdateringar, raderingar (om möjligt) eller båda. Sammanslagningar har en separat händelsetyp.

- Update - Uppdatering

- Remove - Radering

- Merge - Sammanslagning av kontakter (se Sammanslagningar)

För att skapa en prenumeration, kontakta Vitec så sätter vi upp en prenumeration åt er.

### Gemensamma parametrar

Notifieringar skickas med HTTP POST och innehållstypen application/json. Parameternamn skrivs som i exemplen, bland annat subtype med litet t. Utöver parametrarna för respektive prenumerationsmål ingår följande:

- tenantId: Id för kundens tenant

- chainId: Kedje-id. Ingår i URL:en när värdet finns; i JSON kan värdet vara null.

- subtype: Undertyp. När undertyp saknas är värdet null i JSON och parametern utelämnas från URL:en.

Relationsparametrarna relId1/relType1, relId2/relType2 och relId3/relType3 skickas endast när motsvarande relations-id finns. Om relationens typ saknas är relType-värdet null i JSON och utelämnas från URL:en. Data skickas endast i JSON. För bostäder, projekt och inkommande leads ingår data vid Update, inte vid Remove. För bostäder och projekt ingår data.status endast när status finns tillgänglig.

De prenumerationsmål som ni kan prenumerera på är följande:

- [Bostad](https://connect.maklare.vitec.net#webhook-estate)

- [Projekt](https://connect.maklare.vitec.net#webhook-project)

- [Användare](https://connect.maklare.vitec.net#webhook-user)

- [Kontor](https://connect.maklare.vitec.net#webhook-office)

- [Kontakt](https://connect.maklare.vitec.net#webhook-contact)

- [Kontaktrelation](https://connect.maklare.vitec.net#webhook-estate-contact)

- [Visningsdeltagare](https://connect.maklare.vitec.net#webhook-viewing-attendee)

- [Användartillhörighet](https://connect.maklare.vitec.net#webhook-user-affiliation)

- [Mötesbokning](https://connect.maklare.vitec.net#webhook-meeting)

- [Notering](https://connect.maklare.vitec.net#webhook-note)

- [Område](https://connect.maklare.vitec.net#webhook-area)

- [Inkommande lead](https://connect.maklare.vitec.net#webhook-incoming-lead)

- [Sammanslagningar](https://connect.maklare.vitec.net#webhook-merge)

[Prova exemplet i notifikationstestet](https://connect.maklare.vitec.net/Help/TryOutSubscription?eventType=Estate&name=prenumerationsnamn&licenseId=M11385&chainId=G1&tenantId=T1&targetId=OBJ11385_1395932274&subtype=HousingCooperative)

För bostäder så går det att specificera om notifieringen endast gäller bostäder som annonseras på hemsida och vilken typ av status som bostaden ska ha. Ni väljer också vilka typer av bostäder som prenumerationen ska gälla för.

- House - Villa

- Cottage - Fritidshus

- HousingCooperative - Bostadsrätt

- Plot - Tomt

- Condominium - Ägarlägenhet

- Farm - Lantbruk

- ForeignProperty - Utlandsbostad

- CommercialProperty - Kommersiellt objekt

- Premises - Lokal

Parametrarna kommer både med som url parametrar och som POST data i JSON format. Undantaget är data parametern som endast skickas med i POST datat.

- name: Namnet på prenumerationen

- type: Estate

- subtype: House, Cottage, HousingCooperative, Plot, Condominium, Farm, ForeignProperty, CommercialProperty, Premises

- data.status: Status på bostaden

- id: Id på bostaden

- event: Update, Remove

- customerId: Kund-id på det kontoret som ändringen tillhör

Möjliga värden på bostadsstatus:

- AssignmentAttempt - Intagsförsök

- AssignmentAccepted - Intaget

- ForSale - Till salu

- Sold - Såld

- Paused - Vilande

- NoAssignment - Inget uppdrag

- AssignmentWithdrawn - Återtagen

- ReservedNotForSale - Reserverad/Ej till salu

- NotForSale - Ej till salu

- SoldReferenceObject - Såld/Referensbostad

- Coming - Kommande

- SoonForSale - Snart till salu

- PreSale - Försprång (Mellan kommande och till salu)

- ReadyForRent - Hyresledig

- TentativelyRented - Uthyrd preliminärt

- Rented - Uthyrd

- AppointedAdmission - Tillträdd

Exempel på notifiering för en förändring på en bostadsrätt med status till salu http://connect.maklare.vitec.net/Reciever/?name=prenumerationsnamn&type=Estate&event=Update&customerId=M11385&id=OBJ11385_1395932274&subtype=HousingCooperative&chainId=G1&tenantId=T1

POST data:

```
{
  "name": "prenumerationsnamn",
  "type": "Estate",
  "event": "Update",
  "customerId": "M11385",
  "id": "OBJ11385_1395932274",
  "subtype": "HousingCooperative",
  "data": {
    "status": "ForSale"
  },
  "chainId": "G1",
  "tenantId": "T1"
}
```

[Prova exemplet i notifikationstestet](https://connect.maklare.vitec.net/Help/TryOutSubscription?eventType=Project&name=prenumerationsnamn&licenseId=M11385&chainId=G1&tenantId=T1&targetId=PRO11385_1395932274)

För projekt så går det att specificera om notifieringen endast gäller projekt som annonseras på hemsida och vilken typ av status som projektet ska ha.

Parametrarna kommer både med som url parametrar och som POST data i JSON format. Undantaget är data parametern som endast skickas med i POST datat.

- name: Namnet på prenumerationen

- type: Project

- data.status: Status på projektet

- id: Id på projektet

- event: Update, Remove

- customerId: Kund-id på det kontoret som ändringen tillhör

Möjliga värden på projektstatus:

- Paused - Vilande

- Ongoing - Pågående

- SoldOut - Slutsålt

- Upcoming - Kommande

[Prova exemplet i notifikationstestet](https://connect.maklare.vitec.net/Help/TryOutSubscription?eventType=User&name=prenumerationsnamn&licenseId=M11385&chainId=G1&tenantId=T1&targetId=HANE99C53F2DE4F489AB1E464D0F9AFFACD&subtype=User)

Parametrarna kommer både med som url parametrar och som POST data i JSON format.

- name: Namnet på prenumerationen

- type: User

- subtype: User

- id: Id på användaren

- event: Update, Remove

- customerId: Kund-id på det kontoret som ändringen tillhör

Exempel:

http://connect.maklare.vitec.net/Reciever/?name=prenumerationsnamn&type=User&event=Update&customerId=M11385&id=HANE99C53F2DE4F489AB1E464D0F9AFFACD&subtype=User&chainId=G1&tenantId=T1

POST data:

```
{
  "name": "prenumerationsnamn",
  "type": "User",
  "event": "Update",
  "customerId": "M11385",
  "id": "HANE99C53F2DE4F489AB1E464D0F9AFFACD",
  "subtype": "User",
  "chainId": "G1",
  "tenantId": "T1"
}
```

[Prova exemplet i notifikationstestet](https://connect.maklare.vitec.net/Help/TryOutSubscription?eventType=Office&name=prenumerationsnamn&licenseId=M11385&chainId=G1&tenantId=T1&targetId=M11385)

Parametrarna kommer både med som url parametrar och som POST data i JSON format.

- name: Namnet på prenumerationen

- type: Office

- subtype: Office

- id: Id på kontoret

- event: Update, Remove

- customerId: Kund-id på det kontoret som ändringen tillhör

[Prova exemplet i notifikationstestet](https://connect.maklare.vitec.net/Help/TryOutSubscription?eventType=Contact&name=prenumerationsnamn&licenseId=M11385&chainId=G1&tenantId=T1&targetId=ADR3ADC7B7B0A9447CA97FCAB43E36B582C&subtype=Person)

För kontakter går det att ange vilken typ av kontakt som avses (personer, företag, dödsbon och/eller föreningar).

Parametrarna kommer både med som url parametrar och som POST data i JSON format.

- name: Namnet på prenumerationen

- type: Contact

- subtype: Person, Company, Estate, Association

- id: Id på kontakten

- event: Update, Remove

- customerId: Kund-id på det kontoret som ändringen tillhör

[Prova exemplet i notifikationstestet](https://connect.maklare.vitec.net/Help/TryOutSubscription?eventType=EstateContact&name=prenumerationsnamn&licenseId=M11385&chainId=G1&tenantId=T1&subtype=Seller&relId1=OBJ11385_1395932274&relType1=HousingCooperative&relId2=ADRB1173057ECD04D66B9D798812E09C1B5&relType2=Estate)

Ni väljer vilka typer av kontaktrelationer som prenumerationen ska gälla för.

- Buyer - Köpare

- Seller - Säljare

- Speculator - Spekulanter

- ExtraBuyer - Extra köpare

- ExtraSeller - Extra säljare

Parametrarna kommer både med som url parametrar och som POST data i JSON format.

- name: Namnet på prenumerationen

- type: EstateContact

- subtype: Buyer, Seller, Speculator, ExtraBuyer, ExtraSeller

- relId1: Id på bostaden

- relType1: Bostadens typ

- relId2: Id på kontakten

- relType2: Kontaktens typ

- event: Update, Remove

- customerId: Kund-id på det kontoret som ändringen tillhör

Exempel på notifiering för en förändring där en säljare tillkommer på en bostad

http://connect.maklare.vitec.net/Reciever/?name=prenumerationsnamn&type=EstateContact&event=Update&customerId=M11385&subtype=Seller&relId1=OBJ11385_1395932274&relType1=HousingCooperative&relId2=ADRB1173057ECD04D66B9D798812E09C1B5&relType2=Estate&chainId=G1&tenantId=T1

POST data:

```
{
  "name": "prenumerationsnamn",
  "type": "EstateContact",
  "event": "Update",
  "customerId": "M11385",
  "subtype": "Seller",
  "relId1": "OBJ11385_1395932274",
  "relType1": "HousingCooperative",
  "relId2": "ADRB1173057ECD04D66B9D798812E09C1B5",
  "relType2": "Estate",
  "chainId": "G1",
  "tenantId": "T1"
}
```

[Prova exemplet i notifikationstestet](https://connect.maklare.vitec.net/Help/TryOutSubscription?eventType=EstateContact&name=prenumerationsnamn&licenseId=M11385&chainId=G1&tenantId=T1&targetId=VIDE98B8FEE41064A77889D5D592D169F26&subtype=ViewingParticipant&relId1=OBJ11385_1395932274&relType1=HousingCooperative&relId2=ADRB1DEE2F28780457D9D9791F5E3C3C2A1&relType2=Person&relId3=VISF20A42E75479481A98E2D55322305353)

Parametrarna kommer både med som url parametrar och som POST data i JSON format.

- name: Namnet på prenumerationen

- type: EstateContact

- id: Id på visningsdeltagaren

- event: Update, Remove

- customerId: Kund-id på det kontoret som ändringen tillhör

- subtype: ViewingParticipant

- relId1: Id på bostaden

- relType1: Bostadens typ

- relId2: Id på kontakten

- relType2: Kontaktens typ

- relId3: Id på visningen

- relType3: Viewing

Exempel på notifiering för en förändring där en ny visningsdeltagare läggs till

http://connect.maklare.vitec.net/Reciever/?name=prenumerationsnamn&type=EstateContact&event=Update&customerId=M11385&subtype=ViewingParticipant&relId1=OBJ11385_1395932274&relType1=HousingCooperative&relId2=ADRB1DEE2F28780457D9D9791F5E3C3C2A1&relType2=Person&relId3=VISF20A42E75479481A98E2D55322305353&relType3=Viewing&id=VIDE98B8FEE41064A77889D5D592D169F26&chainId=G1&tenantId=T1

POST data:

```
{
  "name": "prenumerationsnamn",
  "type": "EstateContact",
  "event": "Update",
  "customerId": "M11385",
  "subtype": "ViewingParticipant",
  "relId1": "OBJ11385_1395932274",
  "relType1": "HousingCooperative",
  "relId2": "ADRB1DEE2F28780457D9D9791F5E3C3C2A1",
  "relType2": "Person",
  "relId3": "VISF20A42E75479481A98E2D55322305353",
  "relType3": "Viewing",
  "id": "VIDE98B8FEE41064A77889D5D592D169F26",
  "chainId": "G1",
  "tenantId": "T1"
}
```

[Prova exemplet i notifikationstestet](https://connect.maklare.vitec.net/Help/TryOutSubscription?eventType=OfficeEstateAgent&name=prenumerationsnamn&licenseId=M11385&chainId=G1&tenantId=T1&subtype=Affiliation&relId1=HANE99C53F2DE4F489AB1E464D0F9AFFACD&relType1=User&relId2=M11385&relType2=Office)

Parametrarna kommer både med som url parametrar och som POST data i JSON format.

- name: Namnet på prenumerationen

- type: OfficeEstateAgent

- subtype: Affiliation

- relId1: Id på användaren

- relType1: User

- relId2: CustomerId för kontoret, exempel M20005

- relType2: Office

- event: Update, Remove

- customerId: Kund-id på det kontoret som ändringen tillhör

Exempel på notifiering för en förändring där en mäklare har fått en ny tillhörighet till ett kontor

http://connect.maklare.vitec.net/Reciever/?name=prenumerationsnamn&type=OfficeEstateAgent&event=Update&customerId=M11385&subtype=Affiliation&relId1=HANE99C53F2DE4F489AB1E464D0F9AFFACD&relType1=User&relId2=M11385&relType2=Office&chainId=G1&tenantId=T1

POST data:

```
{
  "name": "prenumerationsnamn",
  "type": "OfficeEstateAgent",
  "event": "Update",
  "customerId": "M11385",
  "subtype": "Affiliation",
  "relId1": "HANE99C53F2DE4F489AB1E464D0F9AFFACD",
  "relType1": "User",
  "relId2": "M11385",
  "relType2": "Office",
  "chainId": "G1",
  "tenantId": "T1"
}
```

[Prova exemplet i notifikationstestet](https://connect.maklare.vitec.net/Help/TryOutSubscription?eventType=Meeting&name=prenumerationsnamn&licenseId=M11385&chainId=G1&tenantId=T1&targetId=CAL7216862FF0AD4AE38061A04A9AC4D60D&relId1=OBJ11385_1395932274&relType1=HousingCooperative&relId2=ADR3ADC7B7B0A9447CA97FCAB43E36B582C&relType2=Person)

Parametrarna kommer både med som url parametrar och som POST data i JSON format.

- name: Namnet på prenumerationen

- id: Id på mötesbokningen

- type: Meeting

- event: Update, Remove

- customerId: Kund-id på det kontoret som ändringen tillhör

- relId1: Id på bostaden

- relType1: Bostadens typ

- relId2: Id på kontakten

- relType2: Kontaktens typ

Exempel på notifiering för en förändring där en ny mötebokning läggs till

http://connect.maklare.vitec.net/Reciever/?name=prenumerationsnamn&type=Meeting&event=Update&customerId=M11385&id=CAL7216862FF0AD4AE38061A04A9AC4D60D&relId1=OBJ11385_1395932274&relType1=HousingCooperative&relId2=ADR3ADC7B7B0A9447CA97FCAB43E36B582C&relType2=Person&chainId=G1&tenantId=T1

POST data:

```
{
  "name": "prenumerationsnamn",
  "type": "Meeting",
  "event": "Update",
  "customerId": "M11385",
  "id": "CAL7216862FF0AD4AE38061A04A9AC4D60D",
  "relId1": "OBJ11385_1395932274",
  "relType1": "HousingCooperative",
  "relId2": "ADR3ADC7B7B0A9447CA97FCAB43E36B582C",
  "relType2": "Person",
  "chainId": "G1",
  "tenantId": "T1"
}
```

[Prova exemplet i notifikationstestet](https://connect.maklare.vitec.net/Help/TryOutSubscription?eventType=Note&name=prenumerationsnamn&licenseId=M11385&chainId=G1&tenantId=T1&targetId=NOT7216862FF0AD4AE38061A04A9AC4D60D&relId1=OBJ11385_1395932274&relType1=HousingCooperative&relId2=ADR3ADC7B7B0A9447CA97FCAB43E36B582C&relType2=Person)

[Prova en notering kopplad till ett projekt](https://connect.maklare.vitec.net/Help/TryOutSubscription?eventType=Note&name=prenumerationsnamn&licenseId=M11385&chainId=G1&tenantId=T1&targetId=NOT7216862FF0AD4AE38061A04A9AC4D60D&relId1=PRO11385_1395932274&relType1=Project&relId2=ADR3ADC7B7B0A9447CA97FCAB43E36B582C&relType2=Person)

Parametrarna kommer både med som url parametrar och som POST data i JSON format.

- name: Namnet på prenumerationen

- id: Id på noteringen

- type: Note

- event: Update, Remove

- customerId: Kund-id på det kontoret som ändringen tillhör

- relId1: Id på bostaden eller projektet

- relType1: Bostadens typ, eller null i JSON för ett projekt (utelämnas från URL:en)

- relId2: Id på kontakten

- relType2: Kontaktens typ

Exempel på notifiering för en förändring där en ny notering läggs till

http://connect.maklare.vitec.net/Reciever/?name=prenumerationsnamn&type=Note&event=Update&customerId=M11385&id=NOT7216862FF0AD4AE38061A04A9AC4D60D&relId1=OBJ11385_1395932274&relType1=HousingCooperative&relId2=ADR3ADC7B7B0A9447CA97FCAB43E36B582C&relType2=Person&chainId=G1&tenantId=T1

POST data:

```
{
  "name": "prenumerationsnamn",
  "type": "Note",
  "event": "Update",
  "customerId": "M11385",
  "id": "NOT7216862FF0AD4AE38061A04A9AC4D60D",
  "relId1": "OBJ11385_1395932274",
  "relType1": "HousingCooperative",
  "relId2": "ADR3ADC7B7B0A9447CA97FCAB43E36B582C",
  "relType2": "Person",
  "chainId": "G1",
  "tenantId": "T1"
}
```

[Prova exemplet i notifikationstestet](https://connect.maklare.vitec.net/Help/TryOutSubscription?eventType=Area&name=prenumerationsnamn&licenseId=M11385&chainId=G1&tenantId=T1&targetId=STD7216862FF0AD4AE38061A04A9AC4D60D)

Parametrarna kommer både med som url parametrar och som POST data i JSON format.

- name: Namnet på prenumerationen

- type: Area

- id: Id på området

- event: Update, Remove

- customerId: Kund-id på det kontoret som ändringen tillhör

Exempel på notifiering för en förändring där ett område ändras

http://connect.maklare.vitec.net/Reciever/?name=prenumerationsnamn&type=Area&event=Update&customerId=M11385&id=STD7216862FF0AD4AE38061A04A9AC4D60D&chainId=G1&tenantId=T1

POST data:

```
{
  "name": "prenumerationsnamn",
  "type": "Area",
  "event": "Update",
  "customerId": "M11385",
  "id": "STD7216862FF0AD4AE38061A04A9AC4D60D",
  "chainId": "G1",
  "tenantId": "T1"
}
```

[Prova exemplet i notifikationstestet](https://connect.maklare.vitec.net/Help/TryOutSubscription?eventType=IncomingLead&name=prenumerationsnamn&licenseId=M11385&chainId=G1&tenantId=T1&targetId=LED7216862FF0AD4AE38061A04A9AC4D60D&partnerId=PC1&externalId=lead-id-of-partner&leadCause=LeadAccepted)

Gäller inkommande leads från externa tjänster. Notifieringar kommer enbart att skickas för inkommna leads som levererats av samma partner.

Parametrarna kommer både med som url parametrar och som POST data i JSON format. Undantaget är data parametern som endast skickas med i POST datat.

- name: Namnet på prenumerationen

- type: IncomingLead

- data.partnerId: Id på partner som är källan av leadet

- data.externalId: Id på leadet hos partnern som skickat leadet

- data.cause: Orsaken till lead uppdateringen

- id: Id på leadet

- event: Update, Remove

- customerId: Kund-id på det kontoret som ändringen tillhör

Möjliga värden på cause parametern är:

- LeadAccepted - Ett bostad-lead blir accepterat. Status för affären - Pågående

- LeadContacted - Ett kontaktlead får status "Kontaktad", dvs flödet tar slut. Kan jämföras med uppdrag för ett bostad-lead. Status för affären - Finns ingen affär, men motsvarande Uppdrag

- NewMeeting - Ett nytt kundmöte har skapats för en bostad med koppling till ett bostad-lead. Status för affären - Pågående

- NewComeback - En ny återkomst har skapats för en kontakt med koppling till ett lead (bostad eller kontakt-lead). Status för affären - Pågående

- LeadPostponed - Leadet har blivit uppskjutet. Status för affären - Pågående

- LeadCanceled - Ett lead har blivit avböjt eller borttaget eller en bostad har fått status "Inget uppdrag" eller motsvarande. Status för affären - Inget uppdrag

- Assigned - Bostaden har fått status uppdrag eller högre. Status för affären - Uppdrag

- AssignedValuation - Uppdragstyp för bostaden ändras till Värdering. Kan t.ex. hända när ett kundmöte följs upp. Status för affären - Uppdrag (Värderingsuppdrag)

- AssignedContractWriting - Uppdragstyp för bostaden ändras till Skrivning. Status för affären - Uppdrag (Skrivuppdrag)

- NoAssigment - Bostaden har fått status Inget uppdrag, Återtagen eller Ej till salu.

Exempel på notifiering för en uppdatering av ett inkommande lead

http://connect.maklare.vitec.net/Reciever/?name=prenumerationsnamn&type=IncomingLead&event=Update&customerId=M11385&id=LED7216862FF0AD4AE38061A04A9AC4D60D&chainId=G1&tenantId=T1

POST data:

```
{
  "name": "prenumerationsnamn",
  "type": "IncomingLead",
  "event": "Update",
  "customerId": "M11385",
  "id": "LED7216862FF0AD4AE38061A04A9AC4D60D",
  "data": {
    "partnerId": "PC1",
    "externalId": "lead-id-of-partner",
    "cause": "LeadAccepted"
  },
  "chainId": "G1",
  "tenantId": "T1"
}
```

[Prova exemplet i notifikationstestet](https://connect.maklare.vitec.net/Help/TryOutSubscription?eventType=Merge&name=prenumerationsnamn&licenseId=M11385&chainId=G1&tenantId=T1&targetId=ADR8462BF8CEC9D4A3D875A7B4449997B00&subtype=Person&sourceId=ADRAC382A6314634AEB9ECC72A284B0DE09)

Parametrarna kommer både med som url parametrar och som POST data i JSON format. Undantagen är destinationId och sourceIds som endast skickas i POST-datat.

- name: Namnet på prenumerationen

- type: Merge

- event: Merge

- customerId: Kund-id på det kontoret som ändringen tillhör

- subtype: Person

- id: Id på målet med sammanslagningen

- destinationId: Id på målet med sammanslagningen

- sourceIds: Array med id på sammanslagna källor, dessa kommer att vara raderade och ersatta med destinationId

Exempel på notifiering för en sammanslagning för kontakt

http://connect.maklare.vitec.net/Reciever/?name=prenumerationsnamn&id=ADR8462BF8CEC9D4A3D875A7B4449997B00&type=Merge&event=Merge&customerId=M11385&subtype=Person&chainId=G1&tenantId=T1

POST data:

```
{
  "name": "prenumerationsnamn",
  "id": "ADR8462BF8CEC9D4A3D875A7B4449997B00",
  "type": "Merge",
  "event": "Merge",
  "customerId": "M11385",
  "subtype": "Person",
  "destinationId": "ADR8462BF8CEC9D4A3D875A7B4449997B00",
  "sourceIds": [
    "ADRAC382A6314634AEB9ECC72A284B0DE09"
  ],
  "chainId": "G1",
  "tenantId": "T1"
}
```
