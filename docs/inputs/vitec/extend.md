<!-- https://connect.maklare.vitec.net/Help/TermExtend, fetched 2026-10-04 -->

Beskrivning

Det finns API metoder i Connect som stödjer vårat extend API. Förutom det grunddata som dessa metoder hämtar, så kan de dessutom utökas till att hämta mer information.

Observera att utökningarna kan ha egna notifieringar, och ifall ni lyssnar på notifieringar så kan det vara enklare att hämta utökningarna via separata metoder.

Till exempel om en klass har utdata i formatet:

```
{
    "id": "ESTATEID",
    /* Other fields */
    "extensions": {
        "farm": null,
        "premises": null,
        "housingCooperative": null,
        "foreignProperty": null,
        "primaryAgent": null,
        "secondaryAgent": null
    }
}
```

Så kan ni välja att hämta "farm", "premises", "primaryAgent", "secondaryAgent" genom att ange URL parametern extend till API metoden och sätta den till "farm+premises+primaryAgent+secondaryAgent". Exempel: /Advertising/Estate/M123/ESTATEID?extend=farm+premises+primaryAgent+secondaryAgent.

Informationen kommer enbart att hämtas ifall det är aktuellt. Det vill säga om objektet är en gård så kommer den inte att hämta information för lokaler. Finns det ingen andra handläggare, så kommer den inte att hämtas.

```
{
    "id": "ESTATEID",
    /* Other fields */
    "extensions": {
        "farm": { /* Farm fields */ },
        "premises": null,
        "housingCooperative": null,
        "foreignProperty": null,
        "primaryAgent": { /* Primary agent fields */ },
        "secondaryAgent": null
    }
}
```

Det finns också förkortningar för att förenkla anropen i vissa lägen.

- $estate motsvarar "House+HousingCooperative+Cottage+Condominium+Farm+Plot+Premises+CommercialProperty+ForeignProperty"
