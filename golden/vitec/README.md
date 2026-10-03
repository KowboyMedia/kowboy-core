# golden/vitec

Vitec's golden masters (Gate 3, AC 1; question 52): real records of the test account on staging
(Norban's office, `M31529`), the same objects norbanmakleri.se shows, so a case's `display.json` can
be read against that page. Drafted by an agent on 2026-09-24 and approved by Patric on 2026-10-03 (question 90; this
folder is protected). The three property cases were regenerated the same day when R-013 took the
master's sections (question 92) and `documents[]` arrived (question 94). Each case is one directory:

```
golden/vitec/<datatype>/<case>/
  payload.json     the Connect payload, untouched, keys sorted
  canonical.json   the universal model the Vitec mappers must produce, without `display`
  display.json     the `display` object the ledger entries give, R-015 to R-019 included
```

Cases: `property/for-sale` (Cyklopgatan 35B), `property/sold` (Aglaiavägen 32),
`property/coming-with-viewing` (Piggränd 3), `agent/with-reviews`, `office/basic`,
`area/basic`, `association/basic`, `project/basic`. `acceptance/golden.test.ts` proves every
provider folder under `golden/`.
