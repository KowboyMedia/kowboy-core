# Form submissions: from a site's form to the CRM

**Status:** proposed 2026-10-04, waiting on questions 129 and 130 in `docs/open-questions.md`.
Nothing here is built. **The ask** (Patric, 2026-10-04): a strategy for form submissions. Vitec
offers sending a lead, sending an interest on a single home, booking a viewing with the viewing
slots shown in the page, and creating a search profile; what Mspecs offers is unknown; a
submission must be sendable securely from any client, WordPress or Lovable; and is this Core's
work or a standalone widget for any site? The recommendation is in "The recommendation" below;
the reasoning is in the rest of this file, so chat can point to it. A second agent reviewed this
file on 2026-10-04 and its findings are worked in.

## Terms

- **The CRM** is the brokerage's customer system that holds its listings, offices, agents and
  the people who showed interest; Vitec Express today, reached through its API "Vitec Connect",
  and Mspecs later. **An API** is the set of calls one program offers another over the web.
- **Core** reads the CRM and keeps one copy of every record in one shape for every site. The
  **engine** is the part of Core that knows no CRM; an **adapter** is the part that knows one.
  Core runs as two processes: **web**, which answers calls from the sites, and **worker**, which
  does the background work and, today, every call to a CRM.
- **A site** is one website with Core's client in it: a WordPress install with the plugin, or a
  Lovable site with the kit. A site **pulls** its records from Core and renders from its own
  copy. **A tenant** is one brokerage as Core knows it; **a connection** is one CRM login Core
  holds for a tenant, with the offices it covers. **The tenant token** is the secret a site
  holds to pull from Core; it lives in the site's server settings and never in a browser.
- **A form** is a set of fields a visitor fills in on a site page. **A submission** is one
  filled form on its way from the site to the CRM. The design has two forms today, both
  dummies: "Ska du sälja din bostad?" in every page's footer (**the lead form**) and "Är du
  intresserad av bostaden?" on a home's page (**the interest form**); the viewing's "Boka här"
  button is a third (**the booking**).
- **A lead** is, in the CRMs' words, a person to contact; in Vitec every submission below creates
  one, attached to a **lead source** (leadkälla) the brokerage configures in Express.
- **A viewing** (visning) is a time when a home can be seen. **A time slot** (tidsslott) is one
  bookable part of a viewing. Vitec's booking call takes a slot's id, not a viewing's, so a
  viewing without a slot cannot be booked; every viewing seen on the test account had one slot.
- **A search profile** (sökprofil) is a prospect's wishes (area, price, rooms, size) that the CRM
  matches new listings against and mails the matches for.
- **The event log** is Core's record of what happened to each record, read in the admin area.
  **A health check** is one line of `/v1/health` that turns red when something is wrong.
  **Sentry** is the service Core reports its errors to.
- Technical words used below, once each: **a schema** is the written shape of a message, which
  Core checks every message against with its library **ajv**; **a UUID** is a random id long
  enough never to repeat; **TLS** is the encryption of web traffic (the "https"); **basic
  authentication** is a login sent as user name and password with every call; **a script tag**
  is a line of a web page that loads a program from another server; **UTM tags** are the marks a
  marketing link carries so a campaign can be credited; **a nonce** is a one-time code a site
  puts in its own form so that only its own pages can post it; **a honeypot** is a hidden field a
  visitor never fills and a bot does; **a captcha** is a puzzle that tells a person from a bot;
  **CORS** is the browser rule that says which other websites a page may call; **an edge
  function** is the small server-side program a Lovable site can run on Supabase.

## What the two CRMs offer

### Vitec Connect, from the saved documentation (verified)

Read from the vendor documentation saved under `docs/inputs/vitec/` (fetched 2026-09-16, the spec
of record). Connect is called with the partner's key pair over basic authentication and, in
Vitec's own words, "is designed to be called from server code; a call must never come from a
browser" (`technical-information.md`, "Säkerhet"). Every form call takes the office's customer
id (`M31529` and the like), which Core keeps as the office id.

| Form                       | Connect call                                                                                 | What the CRM takes                                                                                                                                                                                                                                                 | What it answers                                                                                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lead ("Ska du sälja?")     | `POST v2/Advertising/Form/{customerId}/Valuation`                                            | first and last name, e-mail, mobile, address (optional), GDPR approved (yes/no), a message, a lead source and an intake source (optional, the brokerage's ids), a receiving user (optional), the page the form was on and its UTM tags                             | the contact's id                                                                                                                                                       |
| Interest on one home       | `POST Advertising/Estate/{customerId}/{estateId}/interest`                                   | first and last name (required), e-mail or a phone number (one required), address, personal number (optional), the GDPR approval date, present accommodation (optional), a message, a status (Interested, Very interested, …), a lead source, the page and UTM tags | not documented; Vitec checks for a duplicate person                                                                                                                    |
| Book a viewing             | `POST v2/Advertising/Form/{customerId}/Estate/{estateId}/Viewing/Attend`                     | the time slot's id, first and last name, e-mail, mobile, address (optional), GDPR approved, lead source and message, confirmation by e-mail and by SMS (yes/no each), a reminder in minutes, whether to check the booking limit and the deadline                   | the contact's id                                                                                                                                                       |
| The viewing slots for a UI | `GET v2/Advertising/Form/{customerId}/Estate/{estateId}`                                     | nothing                                                                                                                                                                                                                                                            | office, agents, address, viewings with their deadline, self-registration and visibility flags, and each viewing's time slots: id, start, end, "registration available" |
| Cancel a booking           | `PUT Advertising/Message/{customerId}/Estate/{estateId}/Viewing/Attendee/{contactId}/OptOut` | the contact's id from the booking                                                                                                                                                                                                                                  | nothing                                                                                                                                                                |
| Watch the final price      | `POST Advertising/Estate/{customerId}/{estateId}/FinalPriceWatched`                          | the person, a prospective-buyer status, a lead source, a message, the page and UTM tags                                                                                                                                                                            | a string                                                                                                                                                               |
| Create a search profile    | **none** in the saved advertising section                                                    |                                                                                                                                                                                                                                                                    |                                                                                                                                                                        |

### Read online on 2026-10-04, not saved

These facts come from pages read in the session, not from `docs/inputs/`; they can be read again
at the addresses given, and the probe can be run again with the test account's login in the
session environment.

- **Connect's other sections.** The help index at `connect.maklare.vitec.net/Help` lists five
  sections: advertising, aml, businessintelligence2, economy, mypages1. Their endpoint lists were
  read: none creates, reads or changes a search profile (mypages1 is a seller's and buyer's own
  pages: documents and questionnaires on one estate). So Connect, as a whole, has no search
  profile call.
- **The probe** (test office `M31529`, `GET v2/Advertising/Form/{customerId}/Estate/{estateId}`
  and `GET Advertising/Estate/{customerId}/{estateId}` for the environment's test estate and for
  three estates with viewings from the estate list; nothing written):
  - The form call answers the partner login Core already holds (HTTP 200), so no new right is
    needed from Vitec.
  - Every viewing carried exactly one time slot. A viewing with several slots was not seen.
  - The form call lists past viewings too (2023 and 2024 ones), while the advertising payload
    Core copies lists none of those: the record's `viewings[]` is the upcoming ones, the form call
    is the history. A site keeps showing viewings from its record and asks for slots only when a
    visitor books.
  - `deadlineAt` was the viewing's start or null; `isSelfRegistrationEnabled` differed per
    viewing, as the record's `self_registration` already does.
- **Search profiles in Vitec Express.** The product's help (Mäklarhjälpen, "Nya matchningen")
  says a search profile is created by a person in Express, or automatically when a contact
  arrives with status Interested or higher, "for example through an interest registration on the
  website", provided the contact allows matching and marketing; Express then mails the matches.
  So "create a search profile from the site" is, in Vitec's world, the interest form with status
  Interested plus a setting the brokerage turns on in Express. No API creates a profile with the
  visitor's own criteria. Question 131 asks what to do with that.
- **Vitec's ready-made component.** `connect.maklare.vitec.net/Help/KomponentKontakta` (linked
  from the saved `advertising.md`) describes "Kontakta oss formulär": a script tag with a key
  Vitec hands out per list of domains and the estate's id, which draws Vitec's own form for an
  interest, a viewing booking and "tip a friend" on the page, and fires an event when one is
  sent. It is weighed as option C below.

Not verified, to be settled in the build against the test account: what Connect answers when a
slot is full or its deadline has passed (the booking call's "validation" flags suggest a refusal
with a message); whether the interest call answers an id; whether a booking changes the estate's
change date and so triggers a notification Core already handles; whether a viewing can carry
several slots.

### Mspecs (partly verified, read online 2026-10-04, not saved)

Nothing about Mspecs is in this repository: no adapter, no documentation. What is public:

- Mspecs's support centre (`support.mspecs.se`, "Integrera hemsida med Mspecs") says the API
  documentation for a website is sent by Mspecs support on request (support@mspecs.se), and the
  one public article on booking a viewing from a website carries its documentation as an attached
  file (`Routes.pdf`) that could not be read from here.
- Mspecs's own WordPress integration (`mspecs.github.io/wp-api-plugin`) documents three writes
  towards Mspecs: add a prospective buyer to a deal (a home), add a buyer to a viewing, and add a
  buyer to a viewing's slot. It authenticates with a token created in Mspecs's company settings
  plus a webhook secret. It documents no valuation lead and no search profile.
- A web agency's page (`prowebb.se`) lists "intresseanmälan, visningsbokning,
  spekulantregistrering" among what Mspecs's API allows; a vendor's list, not verified against
  the API.

So the overlap that can be stated today: an interest on a home and a booking of a viewing slot
exist in both CRMs; a lead that names no home exists in Vitec and is unknown in Mspecs; a search
profile is offered by neither as far as can be seen. The rest waits on Mspecs's documentation
(question 132).

## The recommendation: inside Core, as one capability; the forms stay the site's

Build the submissions inside Core: one CRM-agnostic endpoint in the engine that a site posts to
with the tenant token it already holds, and one small capability per adapter that translates the
universal submission into the CRM's call. The forms themselves, their look and their words, stay
in each client's templates, where the design's two forms already are. A standalone widget is not
built now; the endpoint is designed so that one can be a later, thin client of it.

### The options

**A. Inside Core (recommended).** The visitor's browser posts the form to its own site. The site's
server adds the tenant token and posts a universal submission to Core. Core finds the connection
the record belongs to, the adapter translates and calls the CRM, and the CRM's answer travels back
to the visitor: "sent", "refused" (a full slot) or "failed" (the CRM did not answer). Core logs
the submission's fate on the record's timeline, without the person.

**B. A standalone widget service.** A separate application any site embeds with a script tag. It
needs its own registry of customers, CRM logins, keys and allowed domains, its own adapter per
CRM, its own hosting and its own admin: everything Core already has, a second time. Its key sits
in the browser, so it needs the domain allow-list and rate limiting that browser-facing keys need.
Its look is the widget's, not the site's, unless it is themed per customer. It is a second product
to run and to sell, and the first working form is several sessions further away.

**C. Vitec's ready-made component.** Fastest, and nothing to build in Core: a script tag per
property page with Vitec's key. But the site would then name its CRM and load Vitec's script, which
AGENTS.md's seam forbids ("Clients never name a CRM"); the look is Vitec's; it offers no lead
form outside a listing (the footer's "Ska du sälja din bostad?"); and an Mspecs site would need
something else entirely.

| Criterion                              | A. Inside Core                       | B. Standalone widget                 | C. Vitec's component                      |
| -------------------------------------- | ------------------------------------ | ------------------------------------ | ----------------------------------------- |
| Where the CRM login lives              | in Core, where it already is         | in a second registry                 | at Vitec, behind a browser key            |
| What the browser can reach             | its own site only                    | the widget's public endpoint, by key | Vitec's endpoint, by key                  |
| Design control                         | the site's templates                 | the widget's theme                   | Vitec's form                              |
| Works for WordPress and Lovable alike  | yes, one endpoint                    | yes                                  | yes, for Vitec tenants only               |
| Works for a site Kowboy does not build | not today; a later thin client       | yes, that is its point               | yes                                       |
| A lead with no home (the footer form)  | yes                                  | yes                                  | no                                        |
| Mspecs later                           | one more adapter capability          | one more adapter, twice              | no                                        |
| Sessions to the first working form     | about three (Core, Vitec, WordPress) | many more                            | one                                       |
| What Patric runs afterwards            | nothing new                          | a second product                     | a key and a domain list per site at Vitec |

### Why A

- **It is what the Concept says Core is.** "All data logic lives in Core. Clients are templates
  plus a sync loop." A form is a template plus one post to Core; the CRM's shapes, logins and
  rules stay behind the seam, where every other CRM detail already is.
- **It is the secure shape, and the one Vitec requires.** Connect must be called from server
  code, never from a browser. In A the CRM login never leaves Core and the tenant token never
  leaves the site's server; the browser only ever talks to its own site.
- **Simple beats clever.** One endpoint, two schemas, one adapter capability, a few files. B
  rebuilds Core's registry and hosting for one feature; C buys speed with a CRM name in the client
  and a form the design cannot own.
- **The door to a widget stays open.** The endpoint takes a universal submission and knows no
  client. If a brokerage without a Kowboy site wants the forms one day, a browser script that
  posts to the same endpoint with a per-site public key and a domain allow-list is a client of it,
  not a second product. That is a "later" line in the feature map, not a reason to build it now.

## The design, for approval (question 130)

### The universal submission

One contract for every client and every CRM, `schemas/submission.v1.json` (a new schema;
`schemas/` is protected, hence the question). Every field traces to the design's forms or to a
field the CRM calls above take; nothing is invented.

```jsonc
POST /v1/submissions            Authorization: Bearer <tenant token>, X-Core-Site: <the site's bell URL>
{
  "id": "6f1c…",                // a UUID the site makes once per filled form, so a repeat is one lead
  "kind": "lead" | "interest" | "viewing",
  "record": {                   // the home, as the site's copy names it; required for interest and viewing
    "datatype": "property",
    "connection_id": "…",
    "remote_id": "…"
  },
  "office_id": "…",             // a lead with no home: the office that receives it
  "slot_id": "…",               // viewing only: the time slot booked (from the slots call below)
  "person": {
    "first_name": "…", "last_name": "…",
    "email": "…", "phone": "…",
    "address": { "street": "…", "postal_code": "…", "city": "…" }   // optional
  },
  "message": "…",               // optional, the visitor's own words
  "consent": { "given": true, "at": "2026-10-04T10:12:00Z" },         // the privacy checkbox and when
  "source": { "page": "https://…", "utm": { "utm_source": "…" } }     // optional
}
```

Where each field comes from: `person` and `consent` are the design's form fields (`lead-form.php`:
first name, last name, mobile, e-mail, the consent box); `message`, `address`, `slot_id` and
`source` are what Vitec's calls take (`source.page` is Vitec's "the page the form was shown on",
`source.utm` its UTM tag list; Mspecs's publicly listed writes take a person, a home, a viewing
and a slot, which fit the same fields); `record` is the record's own identity as every site
already stores it (the envelope's `connection_id` and `remote_id`); `office_id` is the office id
Core already keys records by. A site sends nothing CRM-specific: no status, no lead source, no
customer id.

Core answers in one of six ways, always with the submission's `id`; the first four after the CRM
answered, the last two before any CRM call:

| Answer                                       | When                                                                                                                                           | What the visitor is told             |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `200 {"status":"delivered","reference":"…"}` | the CRM took it; `reference` is the CRM's contact id when it gives one                                                                         | "Tack, vi hör av oss"                |
| `409 {"status":"refused","reason":"…"}`      | the CRM said no, in its own words (a full slot, a passed deadline)                                                                             | the reason, and the other slots      |
| `502 {"status":"failed"}`                    | the CRM did not answer in time                                                                                                                 | "Det gick inte just nu, försök igen" |
| `400 {"error":"…"}`                          | the submission does not match the schema, names a record of another tenant, or is a lead without `office_id` for a tenant with several offices | the site's own validation message    |
| `501 {"error":"…"}`                          | this tenant's CRM takes no submission of that kind                                                                                             | the site hides that form             |
| `429 {"error":"…"}`                          | more than the limit from one token in a minute                                                                                                 | "Försök igen om en stund"            |

The same `id` posted again within a day answers the stored outcome and sends nothing twice: a
double click or a retried request makes one lead.

### Reading the slots

`GET /v1/submissions/slots?connection_id=…&remote_id=…` (same token) answers the home's viewings
as the CRM sees them now, copied and renamed onto universal names and nothing else. Its shape is
the second schema of this design, `schemas/slots.v1.json`, built on the viewing the records
already carry (`schemas/_shared.v1.json`, `viewing`: `id`, `starts_at`, `ends_at`,
`self_registration`) plus what only the form call gives: `deadline_at`, `visible` and the
`slots[]` with `id`, `starts_at`, `ends_at`, `available`.

```jsonc
{
  "viewings": [
    {
      "id": "…",
      "starts_at": "…",
      "ends_at": "…",
      "deadline_at": "…",
      "self_registration": true,
      "visible": true,
      "slots": [{ "id": "…", "starts_at": "…", "ends_at": "…", "available": true }],
    },
  ],
}
```

The record a site holds keeps its `viewings[]` as today, so a page needs nothing live to show
them; a site asks for slots only when a visitor opens the booking, which is what Vitec's own
component does. This is one live read per booking attempt, never per page view, so Vitec's rule
to store and reuse listing data is kept. When Core cannot answer, the booking says "try again
later" and the page stands. The slots are not copied into the record: that would double the CRM
calls of every fetch, add a second payload to `raw` and change every property golden master for
data that goes stale the moment someone books.

### A departure to approve with 130: the web process calls the CRM

Today only the worker talks to a CRM; the web process answers the sites and, for a Vitec
notification, only writes the record on the adapter's fetch list (strategy §5.1, "Two
processes"). A submission needs the CRM's answer while the visitor waits, so `submit` and `slots`
run inside the web process and the request: the first CRM calls from `web`. On approval, §5.1's
two-process paragraph gains the sentence "for a submission, `web` calls the CRM through the
adapter and waits for the answer", and the sentence "the engine never calls back into
CRM-specific code except through the mappers and lifecycle handlers" gains "and the submission
handlers". The Vitec adapter's speed limit towards Connect is kept per process, so `web` and
`worker` each pace their own calls; Vitec states no rate limit (next-steps item 1), and a
submission is one call, so this costs nothing today and is named here so it is not drifted into.
The alternative, a queue the worker delivers from, would make the visitor's "sent" a promise and
hide a full slot from them; it was weighed and set aside.

### Core's part (the engine, CRM-agnostic)

- **Authenticate and check**: the tenant comes from the token, as for every subscriber call; the
  body is validated against the schema with ajv, which Core already uses; the record must belong
  to one of the tenant's connections, else 400.
- **Find the connection**: for an interest or a booking, from `record.connection_id`. For a lead,
  from `office_id`: the connection that licenses that office, or that holds the office's record
  when the connection licenses every office. A tenant with exactly one office needs no
  `office_id`; any other tenant's lead without one is answered 400 with a message that says so.
  A lookup, never a judgement.
- **Hand it to the adapter** of that connection's provider (below) and wait for its answer, inside
  the web process and the request (the departure above).
- **Keep the outcome, never the person**: a `submissions` table with the id, kind, record, outcome,
  the CRM's reference and the time, so a repeated id answers the same and the admin area can list
  what was sent; no name, no e-mail, no phone is stored in Core, logged, or sent to Sentry.
- **Events** on the record's timeline, with a correlation id: `submission.received`, then
  `submission.delivered`, `submission.refused` or `submission.failed`, each with the kind and the
  outcome, never the person.
- **A health check** `submissions.failing`: red while the latest submission to a connection
  failed because the CRM did not answer, green on the next delivered one; the admin area's
  connection page shows the count of each outcome for the last day.
- **A speed limit** per tenant token, 60 submissions a minute, answered 429 above it; to be added
  to strategy §13's defaults on approval, and changed without a gate after that.

### The adapter capability (the adapter API, protected)

Two optional members on `Adapter` in `engine/adapter-api/`, which is why the engine never names a
CRM and every CRM gets the same treatment:

```ts
manifest.submissions?: ('lead' | 'interest' | 'viewing')[];   // the kinds this CRM takes
submit?(connection, submission): Promise<
  | { outcome: 'delivered'; reference?: string }
  | { outcome: 'refused'; reason: string }
  | { outcome: 'failed'; detail: string }>;
slots?(connection, record): Promise<Slots>;                    // the shape of schemas/slots.v1.json
```

A kind the manifest does not list is answered `501` without calling the adapter. This is the
generic capability item 21 in `docs/next-steps.md` asked for.

### The Vitec adapter's part

- `submit` maps the universal submission onto the three calls in the table above, through the
  same `api.ts` (the key pair, the speed limit, the 30-second timeout). The customer id is the
  record's office id, or `office_id` for a lead. `consent.at` becomes the interest's GDPR date and
  `consent.given` the form calls' "GDPR approved"; `source.page` becomes `Marketing.Referrer` and
  `source.utm` the UTM tag list.
- **Six settings the brokerage owns, typed in the admin area on the connection's page**, each
  with its direction and covered by `admin/directions.test.ts`: the lead source id for the
  website's leads (optional; Vitec uses its preselected one when empty), the intake source id for
  valuations (optional), the status a website interest gets (Vitec's own list; empty leaves it to
  Vitec), whether a booking is confirmed by e-mail, whether it is confirmed by SMS, and the
  reminder minutes. These are the CRM's own knobs, copied through; Core decides none of them.
- `slots` calls the form endpoint and renames the fields.
- The test stand-in Connect (`adapters/vitec/connect.ts`) gets the three calls and the form
  endpoint, and one real send per kind is verified against the test account before the first
  release, since the test account exists for that.

### The clients' part

Both clients already hold the tenant token on their server side and send `X-Core-Site`; the
browser never sees either.

- **WordPress**: the plugin gets `POST /wp-json/core/v1/submit` and `GET /wp-json/core/v1/slots`,
  which add the token and forward to Core, with a nonce and a honeypot field against bots. The
  theme's lead form posts a `lead` with the office the plugin's settings page names for the
  footer's leads (a dropdown of the site's offices, needed only when the site holds more than
  one), the interest form an `interest` with the page's record, and "Boka här" opens a dialog
  that reads the slots and posts a `viewing`; when a viewing has one slot, the dialog picks it.
  The dummy form of question 105 becomes real, and 105 closes with this item.
- **Lovable**: the kit gets a second edge function, `core-forms`, with the same secrets as
  `core-sync`, that forwards the two calls; the site's React form posts to it. Built when the
  first Lovable site needs a form.

### Security, in one place

- The CRM login stays in Core, encrypted as today; the tenant token stays on the site's server;
  the browser talks only to its own site over TLS, and the site to Core over TLS.
- Core validates every submission against the schema, refuses a record that is not the tenant's,
  limits the rate per token, and makes a repeated id harmless.
- Core stores and logs ids and outcomes, never the person; the consent and its time go to the CRM,
  which is where the person's data is meant to live. Sentry gets a failure's cause, never a field.
- The site adds a honeypot and a nonce; a captcha is not added until spam is seen, and would be a
  question then.
- A later widget for sites Kowboy does not build would get a public site key, a domain allow-list
  and CORS on the same endpoint; nothing in the design above has to change for it.

### Acceptance, proposed (numbered on approval; `acceptance/` is protected)

1. A `lead`, an `interest` and a `viewing` posted with a tenant token reach the stand-in CRM with
   every universal field mapped, and the site receives `delivered` with the CRM's reference.
2. A refusal and a failure from the CRM reach the visitor as `refused` with the reason and
   `failed`, appear on the record's timeline, and carry no personal data in events, logs or the
   error tracker; `submissions.failing` turns red on the failure and green on the next delivery.
3. The same `id` posted twice sends once and answers the same outcome.
4. A record of another tenant, a body outside the schema, a lead without an office for a tenant
   with several, a kind the CRM does not take and the 61st submission in a minute are refused
   with 400, 501 or 429 before any CRM call.
5. The slots call answers the stand-in's viewings and slots under the universal names, valid
   against `schemas/slots.v1.json`.
6. The WordPress plugin's forwarding endpoints and the theme's three forms pass the template
   test against the real Core, and the browser never receives the tenant token.

## The decisions (the discover list)

| #   | Question                                                                                                                    | Options                                                                                                                                                                                                           | Undo later? | Recommended                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------ |
| 129 | Do form submissions live inside Core or as a standalone widget product?                                                     | a) inside Core, forms in the clients' templates · b) a standalone widget service · c) Vitec's ready-made component on the sites                                                                                   | a→b yes     | a, for the reasons above                                     |
| 130 | Is the design above approved: the two schemas, the two adapter members, the web process calling the CRM, the clients' part? | a) yes, build it as written · b) no, with what to change                                                                                                                                                          | partly      | a                                                            |
| 131 | What does "create a search profile" become for Vitec, since Connect has no such call?                                       | a) nothing to build: the interest form with status Interested, and the brokerage turns on automatic profiles in Express · b) Patric asks Vitec whether another API offers it · c) a site-side saved search, later | yes         | a, the smallest; c is a product of its own                   |
| 132 | May an agent mail Mspecs support from Patric's mailbox for the website API documentation?                                   | yes / no                                                                                                                                                                                                          | yes         | yes; the Mspecs half of this strategy waits on that document |

Settled without a question, as the handbook leaves tooling to the agent: the delivery is
synchronous (the visitor waits a second for the CRM's answer and learns the truth; no queue in
Core, no personal data at rest); the slots are read live, not copied into the record; the
submission id is a UUID in the body; the rate limit is 60 a minute per token.

## Risks and unknowns

- `[crm-vitec]` **Vitec's refusals** (full slot, passed deadline, duplicate person) are not
  documented. The first build sends one of each against the test account and reads the answers
  before the UI's words are written. Cheap: an hour against the test account.
- `[crm-vitec]` **Several slots per viewing** were not seen on the test account. The dialog
  handles one or many from the slots call; a person in Vitec could set a multi-slot viewing on
  the test account to prove it (the same kind of step as question 54).
- `[crm-mspecs]` **Mspecs's API** is unread. Everything Mspecs-specific waits on 132; the
  universal contract was shaped so that the publicly listed Mspecs writes (prospective buyer,
  viewing, viewing slot) fit it without a new field.
- `[core]` **Spam** on an open form reaches the CRM as leads. The honeypot, the nonce and the
  rate limit are the first line; a captcha is a question when spam is seen, not before.

## The plan (items for `docs/next-steps.md`, after 129 and 130)

1. `[core]` **The submission endpoint and the adapter capability**: the two schemas, the two
   adapter members, `POST /v1/submissions` and `GET /v1/submissions/slots`, the outcomes table,
   the events, the health check and the rate limit, proved by acceptance 1 to 5 against a fake
   adapter. One session. Interface: additive (two new schemas, two optional adapter members) plus
   the §5.1 amendment above.
2. `[crm-vitec]` **The Vitec submit and slots**: the mapping, the six connection settings with
   their directions, the stand-in's form endpoints, and one real send per kind against the test
   account. One session.
3. `[client-wordpress]` **The three forms on Kowboy 2026**: the plugin's two forwarding endpoints
   and its lead-office setting, the footer lead form, the interest form and the booking dialog,
   deployed to the staging site; closes question 105 and item 21. One session.
4. `[client-lovable]` **The forms function in the kit**: when the first Lovable site needs a form.
5. `[crm-mspecs]` **Mspecs submit and slots**: when the documentation has arrived and the Mspecs
   adapter exists.

Later, in the feature map: watching the final price (Vitec offers it; no design asks for it yet);
cancelling a booking (needs the CRM's contact id kept somewhere, a personal-data question);
a widget for sites Kowboy does not build (a public site key on the same endpoint); a site-side
saved search if 131 picks c.
