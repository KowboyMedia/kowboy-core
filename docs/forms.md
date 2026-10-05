# Form submissions: from a site's form to the CRM

**Status:** proposed 2026-10-04. Patric answered 129 with a (inside Core) and 130 with yes,
without cancelling a booking, and then asked for the pros and cons of keeping CRM writes out of
Core, as a per-site plugin or a separate app, before 129 stands; that weighing is in "Where the
writes live" below and 129 is open again in `docs/open-questions.md`. Later the same day he
proposed the forms as a remote widget with a matching step and asked for anti-bot protection;
that is "The form itself" below, questions 137 to 139, which he answered the same day: the widget,
Turnstile, and a wizard whose last step is the search profile; he also pointed to Vitec's search
profile calls in the version 1 API, which closes 131, and 129 stands as a. **All three parts are
built** (Patric: "Go", 2026-10-04; "Built 2026-10-04: Core's part", "the Vitec adapter's part" and
"the widget" below): Core's endpoints, the Vitec adapter against the stand-in, and the widget with
the plugin's script tag. What remains: the theme's `data-viewing` mark and the staging deploy (the
theme thread), Turnstile's keys in the environment, and the real Vitec send (54 f). A
clickable dry run of the wizard, with sample data and no CRM, is published as a private page:
<https://claude.ai/artifact/ALpPRzfUXWSAG4TLpATFEP> (2026-10-04); its markup is the starting point
for `clients/forms-widget/`. **The
ask** (Patric, 2026-10-04): a strategy for form submissions. Vitec offers sending a lead,
sending an interest on a single home, booking a viewing with the viewing slots shown in the
page, and creating a search profile; what Mspecs offers was unknown; a submission must be
sendable securely from any client, WordPress or Lovable; and is this Core's work or a
standalone widget for any site? A second agent reviewed this file on 2026-10-04 and its findings
are worked in.

**One thing to read first, because a note in chat was misread:** a site never contacts a CRM.
In this design the visitor's browser talks to its own site, the site talks to Core with the
tenant token it already holds, and Core talks to the CRM with the connection's login that only
Core holds. The CRM logins stay in Core, which is also why they can cover several brokerages. With the widget (137 a) the browser talks to Core as well, with a public site key that can
post a form and read slots and nothing else; the tenant token and the CRM login never reach it.

## Terms

- **The CRM** is the brokerage's customer system that holds its listings, offices, agents and
  the people who showed interest; Vitec Express today, reached through its API "Vitec Connect",
  and Mspecs later, reached through its "marketing provider" API. **An API** is the set of calls
  one program offers another over the web.
- **Core** reads the CRM and keeps one copy of every record in one shape for every site. The
  **engine** is the part of Core that knows no CRM; an **adapter** is the part that knows one.
  Core runs as two processes: **web**, which answers calls from the sites, and **worker**, which
  does the background work and, today, every call to a CRM.
- **A site** is one website with Core's client in it: a WordPress install with the plugin, or a
  Lovable site with the kit. A site **pulls** its records from Core and renders from its own
  copy. **A tenant** is one brokerage as Core knows it; **a connection** is one CRM login Core
  holds for a tenant, with the offices it covers. **The tenant token** is the secret a site
  holds to pull from Core; it lives in the site's server settings and never in a browser.
- **The CRM login** is what Core uses towards a CRM. Both CRMs hand it to Kowboy as a partner,
  not to a brokerage: Vitec's key pair carries passwords per customer and function group, and
  Mspecs's one provider account reaches every brokerage that added Kowboy's service, with a
  `subscriber-id` naming the brokerage on each call. So one login can reach several brokerages.
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
  Mspecs has viewings with and without slots, each saying whether it allows external booking.
- **A search profile** (sökprofil) is a prospect's wishes (area, price, rooms, size) that the CRM
  matches new listings against and mails the matches for. Mspecs calls it a lead with
  **matching**.
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
  function** is the small server-side program a Lovable site can run on Supabase; **a widget**
  is a small program a page loads by a script tag and that draws its own part of the page, here
  the form's **modal**, a dialog over the page; **a site key** is a public id of one site, safe
  in a browser, that lets a form be posted and nothing more; **a bot gate** is an anti-bot
  service, **Turnstile** (Cloudflare's) or **reCAPTCHA v3** (Google's), that hands the browser a
  token saying a person was likely there, which the server verifies; **a shadow DOM** keeps a
  widget's styles apart from the page's; **a wizard** is a form in steps, one screen at a time.

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
| Cancel a booking           | `PUT Advertising/Message/{customerId}/Estate/{estateId}/Viewing/Attendee/{contactId}/OptOut` | the contact's id from the booking. **Not built** (Patric, 2026-10-04, question 130).                                                                                                                                                                               | nothing                                                                                                                                                                |
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

Not verified, to be settled in the build against a demo or test customer (none today; see
"No write target" under the risks): what Connect answers when a
slot is full or its deadline has passed (the booking call's "validation" flags suggest a refusal
with a message); whether the interest call answers an id; whether a booking changes the estate's
change date and so triggers a notification Core already handles; whether a viewing can carry
several slots.

### Mspecs, from the saved documentation (verified 2026-10-04)

Mspecs's "marketing provider" API is public after all: `integration.mspecs.se` renders its
OpenAPI specification, version 2.1.0, now saved as `docs/inputs/mspecs/marketing-provider.openapi.json`
with a README. (Mspecs belongs to Realforce, the former Adfenix, whose own API is a marketing
platform's: CRM events, single sign-on, reporting; the forms are Mspecs's.) A website builder is
a _marketing provider_ with one provider account over basic authentication; a brokerage adds
the provider's service in Mspecs, Mspecs sends publish events for its deals (homes), and every
call names the brokerage with a `subscriber-id` header. A test system exists at
`test-integration.mspecs.se`. The writes a website can make:

| Form                       | Mspecs call                                                                       | What the CRM takes                                                                                                                                                                                            | What it answers                                                                                                                                                              |
| -------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Interest on one home       | `POST /api/marketing/deals/{dealId}/prospectiveBuyer`                             | first and last name, e-mail and phone (all four required; the phone with its country prefix and digits only), address (optional); an error when the buyer is already on the deal                              | 200, body not specified                                                                                                                                                      |
| Book a viewing             | `POST …/deals/{dealId}/externalViewer/{viewingId}` or `…/slot/{slotId}`           | the same person, an interest level (Mspecs's own list), a description, whether to notify the buyer and the broker                                                                                             | 200, body not specified                                                                                                                                                      |
| The viewing slots for a UI | in the published deal (the publish event and `GET /api/marketing/deals/{dealId}`) | nothing                                                                                                                                                                                                       | viewings by comment, by date, by date and time, or with slots: `slotCapacity`, `slotLength`, `slots[]` with `id`, `startTime`, `freeSpots`; each with `allowExternalBooking` |
| Create a search profile    | `POST /api/marketing/leads/matching`                                              | the person plus at least one matching: rooms, price, living area, hectares, municipality codes, object type and sub types, an area polygon, a comment; "a lead will result in a contact with matchings added" | 200, body not specified                                                                                                                                                      |
| Lead ("Ska du sälja?")     | **no call for a lead without a home**: the lead call needs at least one matching  | question 136                                                                                                                                                                                                  |                                                                                                                                                                              |
| Cancel a booking           | none                                                                              |                                                                                                                                                                                                               |                                                                                                                                                                              |

So the overlap: an interest on a home and a booking of a viewing or a slot exist in both CRMs,
with the same person fields; a search profile with the visitor's own criteria exists in Mspecs
and not in Vitec; a lead without a home exists in Vitec and not in Mspecs. Not verified: what
Mspecs answers in the body of a success, what a refusal looks like (a full slot), and the test
system's access, which comes with the provider agreement.

## Where the writes live: inside Core, a per-site plugin, or a separate app

Patric's question after 129's first answer: CRM writes are a different concern from reading, each
CRM has its own endpoints and credentials, so would they not sit better outside Core, as a
plugin per site, as a separate app inside the site, or as a separate app as first discussed?

### The options

**A. Inside Core (recommended).** The visitor's browser posts the form to its own site. The site's
server adds the tenant token and posts a universal submission to Core. Core finds the connection
the record belongs to, the adapter translates and calls the CRM, and the CRM's answer travels back
to the visitor: "sent", "refused" (a full slot) or "failed" (the CRM did not answer). Core logs
the submission's fate on the record's timeline, without the person. To keep the concern visibly
apart inside Core: the write path is its own folder in the engine (`engine/submissions/`), its
own file in each adapter (`adapters/<crm>/forms.ts`), its own health check, its own card on the
connection's admin page and its own tag in the register, `[core]` for the engine's part and the
adapter's tag for the CRM's.

**B. A separate app.** A second service any site posts to (or embeds by script). It needs the
CRM logins (a second copy of the multi-brokerage secrets), its own registry of tenants, sites and
offices, the record ids (which only Core has, so it pulls from Core like a site), its own hosting,
admin, health and error reporting: Core's shell, a second time, around one feature.

**C. Vitec's ready-made component.** Fastest, and nothing to build in Core: a script tag per
property page with Vitec's key. But the site would then name its CRM and load Vitec's script, which
AGENTS.md's seam forbids ("Clients never name a CRM"); the look is Vitec's; it offers no lead
form outside a listing (the footer's "Ska du sälja din bostad?"); and an Mspecs site would need
something else entirely.

**D. A per-site plugin that writes to the CRM itself.** A WordPress plugin (and, for Lovable, an
edge function) per CRM that holds a CRM login and calls the CRM straight from the site. Core is
untouched.

### Pros and cons of keeping the writes out of Core (B and D)

| Concern                                  | A. Inside Core                                                                                        | B. Separate app                                  | D. Per-site plugin                                                                                                                                                                                                                                                                 |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The CRM login                            | stays in Core, scoped to the tenant's offices by Core                                                 | copied into a second service                     | **in the site.** Mspecs has one provider account for every brokerage: it cannot be given to a site. Vitec issues passwords per customer, to the partner: a site would hold a customer's full advertising rights, read and write, on WordPress, the most attacked platform there is |
| Who knows the CRM                        | the adapters, as today                                                                                | the app and Core, twice                          | **the client and Core, twice**: the seam rule "clients never name a CRM" ends, and the WordPress and Lovable clients each carry one implementation per CRM                                                                                                                         |
| Patching a CRM change                    | once, in Core, every site follows (the Concept's "patch once")                                        | once, in the app                                 | per site, with a plugin release each                                                                                                                                                                                                                                               |
| Implementations to write                 | one engine endpoint + one capability per CRM (2)                                                      | one app + one capability per CRM                 | client types × CRMs (WordPress-Vitec, WordPress-Mspecs, Lovable-Vitec, Lovable-Mspecs: 4)                                                                                                                                                                                          |
| What the visitor's browser can reach     | its own site only                                                                                     | the app's endpoint, by a key                     | its own site only                                                                                                                                                                                                                                                                  |
| Record ids and offices                   | Core has them                                                                                         | pulled from Core like a site                     | the site has them from its pull                                                                                                                                                                                                                                                    |
| Log, health, errors, spam limit          | Core's, one place                                                                                     | the app's, a second place                        | per site, or none                                                                                                                                                                                                                                                                  |
| The "separate concern" feeling           | a write path next to the read path, in its own folder and health check; the first CRM call from `web` | fully separate, at the price of a second product | fully separate                                                                                                                                                                                                                                                                     |
| Sellable to a site Kowboy does not build | later, as a thin client of the same endpoint with a public site key                                   | yes, that is its point                           | yes, but with a CRM login handed to that site                                                                                                                                                                                                                                      |
| Sessions to the first working form       | about three                                                                                           | many more                                        | about two for WordPress-Vitec, then one per client-and-CRM pair                                                                                                                                                                                                                    |
| What Patric runs afterwards              | nothing new                                                                                           | a second product                                 | plugin releases per CRM                                                                                                                                                                                                                                                            |

### Why A still

- **The logins decide it.** Patric's own point, that the Vitec login in Core covers several
  brokerages, is the reason the writes belong where that login is: Core scopes each site to its
  tenant's offices, and nothing multi-brokerage ever reaches a site. Mspecs makes D impossible
  outright: one provider account for every brokerage.
- **It is what the Concept says Core is.** "All data logic lives in Core. Clients are templates
  plus a sync loop." A form is a template plus one post to Core; the CRM's shapes, logins and
  rules stay behind the seam, where every other CRM detail already is. Writing to a CRM on a
  brokerage's behalf with Kowboy's partner login is the same kind of concern as reading from it.
- **Drift is kept out by a boundary, not by a building.** What makes a concern separate is its
  own folder, interface, health check and tag, which A has; a second app adds a second
  deployment and a second registry, not a cleaner line.
- **It is the secure shape, and the one Vitec requires.** Connect must be called from server
  code, never from a browser. In A the CRM login never leaves Core and the tenant token never
  leaves the site's server; the browser only ever talks to its own site.
- **The door to a separate product stays open.** The endpoint takes a universal submission and
  knows no client. If a brokerage without a Kowboy site wants the forms one day, a browser script
  that posts to the same endpoint with a per-site public key and a domain allow-list is a client
  of it, not a second product. That is a "later" line in the feature map.

## The form itself: one widget, what it asks, and the bot gate (Patric, 2026-10-04)

Patric's second thought, after 129: the forms as a modal in a small remote widget, so that one
piece of work serves WordPress, Lovable and any other site; the modal collects more than the
contact, such as what kind of home and which area the visitor is looking for, which the CRM then
matches automatically, a value for the brokerage and a small way to stand out; and every form
needs reliable anti-bot protection, Google's reCAPTCHA v3 or another. He asked for pushback
where it is business-unwise, and for the best idea, business- and technology-wise.

### What each CRM can take beyond the contact (verified against the saved specifications)

| What the visitor could tell                    | Vitec Connect                                                                                                                                   | Mspecs marketing provider API                                                                                                                                                                         |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A message                                      | yes: `contactMessage` on the interest, `lead.message` on the booking and the valuation                                                          | on the viewing only (`description`); the prospective buyer and the lead take none                                                                                                                     |
| What they are looking for (the search profile) | **no field.** Express builds the profile itself from the home the interest names, when the brokerage turns automatic profiles on (question 131) | **yes**: the lead with `matchings[]`: rooms, price, living area, hectares, object type and sub types, municipalities (kommunkod), an area polygon, the brokerage's own matching attributes, a comment |
| The home they have to sell                     | **yes**, on the interest: `presentAccommodation` (type, living space, rooms, price, other, a coordinate) and `assignmentSourceId` (intagskälla) | no field; a seller is a lead with a matching like any other                                                                                                                                           |
| How interested they are                        | `status` on the interest (Interested or higher creates the profile)                                                                             | `interestedStatus` on the viewing, from the brokerage's list                                                                                                                                          |
| Where the form was shown                       | `marketing.referrer` and `marketing.utmTags` on all three                                                                                       | none                                                                                                                                                                                                  |
| Confirmation and reminder                      | the booking's `confirmation` (e-mail, SMS) and `reminderTime`                                                                                   | `disableNotifications` on the viewing                                                                                                                                                                 |

So the extra information that has a destination differs by CRM. On an Mspecs site the "what are
you looking for" step lands as a search profile and is matched. On a Vitec site that step has
nowhere to go, and what Vitec does take beyond the contact is the home the visitor has to sell,
which is the brokerage's intake (intag), the side of the business that pays. A field without a
destination is dropped or ends in the free-text message, where nothing matches it.

### Pushback on the business idea

- **The matching USP holds for Mspecs today and not for Vitec.** Vitec Connect has no call that
  takes a visitor's criteria (131); Express creates the profile itself from the home the interest
  names. A criteria step on a Vitec site would be kept nowhere: Core keeps no person, and the
  CRM has no field. If Vitec offers a profile API on request, the step lights up for Vitec too;
  that is 131 b, and the one way to make the USP whole.
- **The step that pays on a Vitec site is the seller's, not the buyer's.** The interest call
  carries the visitor's present home. "Har du en bostad att sälja?" with type, size, rooms and
  price gives the brokerage an intake lead with substance; that is what Express's assignment
  source exists for.
- **Every extra field costs completions.** The must-haves (name, e-mail, phone, consent) are
  what the CRM calls require and what every brokerage wants first; everything else is optional,
  collapsed behind one line ("En sak till, om du vill"), and the button sends without it. The
  contact is never held hostage to the profile.
- **Ask only what has a destination.** The adapter declares which optional groups its CRM takes
  (`seeking` for Mspecs, `present_home` for Vitec, `message` for both); Core tells the widget;
  the widget shows those and nothing else. No decision on CRM data in Core, and no field
  invented: every field above is in a CRM's specification.
- **The consent must say it.** Matching and later mail from the brokerage are a purpose the
  consent text names, with the brokerage's privacy policy linked; Kowboy handles the person for
  the seconds of the call as the brokerage's processor (personuppgiftsbiträde), so the processor
  agreement with each brokerage names the forms.
- **A modest, real USP.** Vitec's component and Mspecs's own WordPress integration give a
  brokerage a form already. What neither gives is one form across both CRMs with one look, the
  seller's step on Vitec, the profile step on Mspecs, and the same for a brokerage site Kowboy
  did not build by one script tag: the door to the product that B wanted, without building B.

### The widget: one form UI for every client, served by Core (137: the widget, Patric, 2026-10-04)

Patric's picture, which is the decision: a script tag that injects the installation code, hooks
to any button, fills a config element, and brings its own JavaScript and CSS matched to the site.

**What it is.** One small script, built from `clients/forms-widget/` into Core's `dist/` (with
Vite, as the admin area is) and served by the web process at `/widget/forms.js`: no framework,
about 15 kB, Swedish texts built in, the look from CSS variables and the site's own font, inside
a shadow DOM so the site's styles and the widget's never clash; a focus trap, Escape closes,
labels for screen readers. A site includes it once:

```html
<script src="https://core.kowboy.se/widget/forms.js" data-site-key="pk_…" defer></script>
```

and marks its buttons: `data-core-form="interest" data-record="property:<connection>:<id>"`,
`data-core-form="viewing"` on the same record, `data-core-form="lead" data-office="…"`. The
widget opens a modal, asks Core once per page what this site may send (`GET /v1/forms/config`:
the kinds, the optional groups, the site's area list for the profile step, the bot gate's site
key, the consent text and the policy link),
reads the slots for a booking, and posts the submission to Core.

**What changes against the approved design.** The browser talks to Core, not only to its own
site. The tenant token stays on the site's server; the widget carries a **public site key**
(`pk_…`), which can do three things only: read the forms config, read one record's slots and
post a submission. Core checks the request's Origin against the site's registered domains, the
bot gate's token, the schema, the record's tenant and the rate (per key and per address). The
WordPress plugin's forwarding endpoints and the Lovable `core-forms` function are then not
needed: the plugin adds the script tag and a site-key setting, the theme places the buttons, a
Lovable site adds the tag in its layout.

| Concern                            | A widget served by Core                                                                  | A form per client (the design's templates)                     |
| ---------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Implementations of the UI          | one, for WordPress, Lovable and any site                                                 | one per client: PHP in the theme, React in the kit, more later |
| A fix or a new field               | one release of Core; every site has it on the next page view                             | a plugin or theme release per client, deployed per site        |
| The bot gate and validation        | one place, Core, with one secret                                                         | per client, per plugin                                         |
| The look                           | one look, tuned by CSS variables and the site's font; not the theme's markup             | the theme's own markup, as designed                            |
| Without JavaScript                 | nothing; the button falls back to the office's phone and e-mail link                     | a server-rendered form works                                   |
| What the browser reaches           | Core, with a public key, over CORS: a public endpoint to guard (Origin, rate, bot gate)  | its own site only                                              |
| Sites Kowboy does not build        | yes: one script tag and a key                                                            | no                                                             |
| Lovable                            | the same tag, nothing to build in the kit                                                | an edge function and a React form                              |
| Sessions to the first working form | about the same: the widget replaces the plugin's two endpoints and the three theme forms | as planned                                                     |

**Decided: the widget, as the only form UI** (137 a). It is the one way to solve the same for
Lovable and others once, it is where the bot gate can live once, and it opens the product door.
The cost is a public endpoint on Core, which is what the site key, the Origin check, the bot
gate's token and the rate limit are for.

### The bot gate (138: Turnstile, Patric, 2026-10-04)

Patric: reliable anti-bot support is a must, Google's reCAPTCHA v3 or another. Read on
2026-10-04 from the services' own pages:

| Service                  | Cost                                                                                                                                                                                                                            | Any site?                                         | How it tells a person from a bot                                                                                                                                             | Notes                                                                                                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cloudflare Turnstile** | free: unlimited verifications, 20 widgets per account, 10 hostnames per widget; Enterprise for more (`developers.cloudflare.com/turnstile/plans`, page of 2026-08-14)                                                           | yes, "without sending traffic through Cloudflare" | a token from a small browser challenge, invisible for most visitors (managed, non-interactive or invisible mode); Core verifies the token server-side with Kowboy's secret   | "does not access, store, or transmit … form entries"; WCAG 2.2 AAA; a Cloudflare account for the keys, nothing on the site's DNS                                                                                                                      |
| **Google reCAPTCHA v3**  | free up to 10,000 assessments a month, then paid; classic keys are moved into a Google Cloud project automatically (`developers.google.com/recaptcha/docs/faq`, page of 2026-04-02, and the migration overview on Google Cloud) | yes                                               | a score from 0.0 to 1.0 per page action, no interaction; Core verifies server-side and sets the threshold; over the free quota v3 "may fail open" with a static score of 0.9 | Google's badge or a text notice on the page; Google is the company Sweden's IMY ruled against four companies over in 2023 for Google Analytics transfers (no decision names reCAPTCHA); a Google Cloud billing account becomes part of Kowboy's setup |
| Core's own measures      | none                                                                                                                                                                                                                            | yes                                               | a honeypot field, a minimum time from open to submit, a rate limit per key and per address, the same id once                                                                 | always on, under either service; alone they stop simple bots, not farms                                                                                                                                                                               |

**Decided: Turnstile** (138 a), behind one interface in Core (`verifyHuman(token,
address)`) so that reCAPTCHA v3 can be chosen per site when a brokerage insists, and Core's own
measures always on. Turnstile is free at any volume, invisible for most visitors, needs nothing
on the site, and puts no Google name on a Swedish brokerage's privacy page. Its free plan's
twenty widgets are a limit to watch: one widget per brokerage site is the clean setup and caps
at twenty sites; ten hostnames per widget reach two hundred; Enterprise beyond. The widget
renders whichever service the site's config names; the secret is Core's.

### What the modal asks: the wizard (139, Patric, 2026-10-04)

Patric's answer, which replaces the one-screen option: a wizard of up to three steps. A dry run
of it is at <https://claude.ai/artifact/ALpPRzfUXWSAG4TLpATFEP>: the three forms, the steps, the
words, and a panel with what Core would receive, including a refused slot and a CRM that does not
answer.

1. **The intent**, only when the form needs one: the slot for a booking (the slots read live).
   An interest and a lead have no intent step.
2. **The person**: first name and last name in separate fields (both CRMs require them so:
   Vitec's `firstName` and `lastName`, Mspecs's `firstName` and `lastName`, all required),
   e-mail, phone, the consent, and a message where the CRM takes one. **The main submission is
   sent the moment its needed information is in**: a booking after steps 1 and 2, an interest
   or a lead after step 2. Whatever happens after, the CRM already has the person.
3. **"Söker du bostad?"** (Patric's "looking for accommodation", in Swedish), under the
   confirmation of the main submission, as the last and optional step. Patric, 2026-10-04: a
   clear confirmation first (the modal's heading becomes "Din plats är bokad", "Din
   intresseanmälan är skickad" or "Tack, vi hör av oss", with the home and the slot under it),
   then the same heading and text in every form, "Berätta vad du letar efter, så får du tips om
   nya bostäder som passar. Du kan hoppa över det här steget.", marked as a step of the wizard
   ("Steg 3 av 3 · valfritt"), with Skip and Send. Prefilled from the page's home with the
   minimum number of rooms, the minimum living space (the closest whitelisted value lower than
   the home's, Patric, 2026-10-04: 78 kvm prefills 75 kvm, 3 rum prefills 2 rum) and the area;
   the visitor adjusts or skips. Only these two fields and the areas are asked (Patric,
   2026-10-04, "we need only minst antal rum, minst boarea"): the home's type travels unseen, and
   the source form's maxima and price are not asked. Sending it is a second submission of its own kind, `search_profile`; skipping it loses
   nothing. Its fields take only the whitelisted values below.

#### The whitelisted fields of the profile step

The values come from the spekulantregister form Patric pointed at (2026-10-04,
<https://historiskahem.se/spekulantregister/>, read the same day): its selects are the
whitelist, in `kvm`, and Core's schema accepts nothing outside it (a value off the list is a
`400`, never rounded); only the minimum rooms and the minimum living space are asked. "Kommun" is not asked (Patric, 2026-10-04): the municipality
code comes from the home's record and from each area of the site's list.

| Field (`criteria`)                     | Allowed values                                                                                                                                                                                                                                      | Prefilled                                            |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Bostadstyp, `object_type`              | not asked (Patric, 2026-10-04): the home's type from its record, one of `apartment`, `house`, `holiday_house`, `plot`; `null` on the lead, which both CRMs take (Vitec's `subtypes` and Mspecs's `objectType` are optional in their specifications) | the home's type, unseen                              |
| Minst antal rum, `rooms_min`           | 1 to 7 ("N rum"), or empty ("Inget krav")                                                                                                                                                                                                           | the closest value lower than the home's rooms        |
| Minst boarea (kvm), `living_area_min`  | 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140, 150, 160, 170, 180, 200, 250, or empty ("Inget krav")                                                                                  | the closest value lower than the home's living space |
| Områden, `areas[]`                     | ids from the site's own area list, each with its name and municipality code; nothing typed (how it works, below)                                                                                                                                    | the home's area(s); nothing on the lead              |
| `county_municipality_code`             | the home's, from its record; `null` on the lead                                                                                                                                                                                                     | always                                               |
| "Kontakta mig om min nuvarande bostad" | the source form's checkbox, `true` or `false`, beside `criteria`; on an interest and a booking, not on the seller's lead (141 a, Patric, 2026-10-04: the adapter makes the visitor a seller lead too)                                               | unticked                                             |

The rest of the source form is already elsewhere in the wizard or not taken: first name, last
name, mobile, e-mail, the message and the consent box are step 2; its "Adress" (required
there) is the optional `person.address`; its free-text "Adress eller område" box is replaced
by the area chips; its home type, maximum rooms, maximum living space and price range are not
asked.

**How Områden works, and where the list comes from.** Nothing on the page configures it. The
page's config block names only the site key and, per button, the home or the office; the
widget's script then asks Core once per page (`GET /v1/forms/config`, with the site key), and
Core answers with the office's area list from its own store: every area the CRM lists for the
office, already synced as the `area` datatype (id, name, municipality code, the polygon). So the
chips are the same areas as the site's area pages and its search box, fresh without a deploy,
and identical on a WordPress and a Lovable site. On a home's page the home's area(s) come preselected; the visitor
taps more or untaps. On the footer's lead, with no home, none is preselected. Nothing is typed,
so every chosen area is an id the CRM already knows and no matching happens afterwards (a
decision drawn from a value, which Core never makes). Each CRM gets what it matches by: Vitec
the `areaIds`, Mspecs the municipality codes of the chosen areas (it matches by municipality or
polygon, not by area name), the home's when none is chosen. All of it is stored data; no CRM
traffic. Where the CRM lists few areas for the office, the chips are few (known bug 2 on the
staging site: the homes' areas are missing from the office's list; its fix lengthens them).

What the profile becomes in each CRM, verified 2026-10-04:

- **Vitec**: the search profile lives in the version 1 API, category CRM-Contact (saved under
  `docs/inputs/vitec/`, `crm-contact.md` and `api/…CRM-Contact…`). The contact comes first:
  the booking and the valuation already answer a `contactId`; after an interest (which answers
  nothing) the adapter calls `POST Contacts/UpdatePerson`, whose duplicate check on first name,
  last name and one contact method returns the existing or new contact's id. Then
  `POST CRM/Contact/{customerId}/SearchProfile/Residential/{contactId}` with `subtypes` (the
  values from `GET …/SearchProfile/SearchProfileValues`: apartment, villa, holiday home, plot),
  `numberOfRooms.minValue`, `livingSpace.minValue`, `areaIds` (the chosen areas' ids, which
  are the CRM's own), `isAutomaticProfile: false`. The ticked checkbox (141 a) is one more
  call, the valuation on the same contact (`POST …/valuation`, the brokerage's intake lead). **These calls are in
  the CRM function group, granted per customer to the partner**: the login in the environment
  answers the advertising group (200) and the CRM group with 401 today, and that login reads a
  client's production office, so a person in Vitec grants the group on a demo or test customer
  before the first real send (question 54 f).
- **Mspecs**: `POST /api/marketing/leads/matching` with the lead and one matching: `objectType`,
  `minRooms`, `minLivingArea` and `municipalities` from the chosen areas' municipality codes,
  the home's when none is chosen (Mspecs matches by municipality code or a drawn polygon, not by
  area name); the contact and the profile land in one call. The ticked checkbox (141 a) goes in
  the matching's `comment`, the field Mspecs offers for it.

The schema: a fourth kind, `search_profile`, with `person`, `consent`, `source`, a
`criteria` group (`object_type`, `rooms_min` and `living_area_min`, each an enum of the
whitelist above or `null`; `areas[]` as id, name and municipality code; `county_municipality_code`,
the universal name the area and property records carry)
and `contact_about_current_home` (141 a); additive, every field from a CRM's call above or
from the whitelist; the widget prefills it from the record the page shows and Core passes it through.
The adapter manifest lists `search_profile` when its CRM takes it. Vitec's interest also takes
the home the visitor has to sell (`presentAccommodation`), the brokerage's intake lead; the
checkbox of 141 is the small form of it, a text about that home a later question if a
brokerage asks.

#### What similar services offer, and what the widget could add (2026-10-04)

Patric asked whether other services show a way to add value for the brokerages. Read the same
day: every large chain runs a buyer register with matching under its own name (Fastighetsbyrån
"Bostadsbevakning", Bjurfors "Boagenten", Länsförsäkringar "Bostadsbevakaren", Svensk
Fastighetsförmedling "Bostadsbevakning", Mäklarhuset "Bevakning", SkandiaMäklarna
"Spekulantregister"; ekonomifokus.se, "Fastighetsmäklarnas spekulantregister"), registration is
contact details plus home type and areas, and the pull is early access: viewings for the
register only, and on 2026-06-03 Fastighetsbyrån launched "Förtur", homes shown to its
registered buyers behind a login before they are "På gång" or "Till salu" (mynewsdesk press
release). Fastighetsbyrån also sells "Slutprisbevakning", a final-price watch. The wizard
already gives a small brokerage the register with matching, since the CRM does the matching and
the mailing. What it could add, each on data Core already holds:

1. **Pre-market homes.** Vitec's estate statuses include Kommande (`Coming`), Snart till salu
   (`SoonForSale`) and Försprång (`Advantage`), the advertising list carries them when the
   brokerage markets them (`docs/inputs/vitec/enumerations/Api_EstateStatus.md`,
   `advertising-preview.md`), Core syncs them as records with that status, and **the set already
   shows them**: the site's settings page names which status ids are "Till salu", "Kommande" and
   "Sålda", and the listing page has a "Kommande" tab (`core-client/includes/query.php`,
   `kowboy-2026/core/list-property.php`). With item 21's interest button on those cards, "register
   and see the homes first" is selling text on what exists. The chains' gated version (a login)
   is the technical one, and Core's part of it is nothing, the status is in the record; the theme
   would add a page for signed-in visitors. 142 a (Patric, 2026-10-04): Kommande stays public
   for now, the interest button on its cards is the register's door, no gated page.
2. **One tap the second time.** The widget remembers the person in the visitor's own browser
   after a sent form (first-party storage, with a line saying so), so the next booking or
   interest is one tap; the chains get this from a login, the widget without one. Default: in
   the widget build (item 21).
3. **The numbers for the brokerage.** Core keeps every submission with its outcome, the page and
   the UTM tags (the admin area lists them, "Core's part"), so the admin area can show per site
   which pages and campaigns bring buyers and sellers, the proof of the site's worth. Default:
   the submissions page in item 21 shows the counts per kind and outcome and the page; a report
   is later.
4. **Later, on the same data:** a map step that draws the area (both CRMs take polygons, and
   the site holds the areas' polygons); a final-price watch on a sold home (Vitec offers the
   final price; "Later" below); a text about the home to sell (141 c).

**The line, and the suggestion** (Patric, 2026-10-04: "we are now drifting beyond the initial
product", "I am still not convinced this is correctly saved in Core just because they have
technical overlap", "I'm split"). Two things were mixed. The forms (interest, booking, lead,
profile) are the site's basic function: every brokerage site has them, and 129 a keeps their
sending in Core for reasons that are not overlap: the CRM login never leaves Core, the record
and slot ids and the areas are Core's, and one implementation serves WordPress and Lovable
alike. **Core keeps no register and no buyer.** The CRM is the brokerage's spekulantregister;
Core forwards, and the only thing it stores is the delivery log the duplicate guard and the
admin's counts need (id, kind, outcome, the CRM's reference, page, UTM; "Core's part"). The
ideas above add nothing to Core: pre-market homes are a template list the set already has, one
tap is the widget's, the counts are an admin page over the log. The chains built portals with
logins and registers of their own because they own that data at scale; a one-office brokerage
gets the same door through its CRM, with no portal, no login and no second register, which is
the better solution, not a copy: the CRM matches and mails, the site shows, Core forwards. If
even the log is too much, the smaller option is a one-day id-to-outcome store and no counts.

## The design, approved with 130 (Patric, 2026-10-04: yes, without cancelling a booking)

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
`source.utm` its UTM tag list); Mspecs's writes take the same person and address fields, a home,
a viewing and a slot, and `message` as its description. `record` is the record's own identity as
every site already stores it (the envelope's `connection_id` and `remote_id`); `office_id` is the
office id Core already keys records by. A site sends nothing CRM-specific: no status, no lead
source, no customer id, no interest level.

Core answers in one of six ways, always with the submission's `id`; the first four after the CRM
answered, the last two before any CRM call:

| Answer                                       | When                                                                                                                                           | What the visitor is told             |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `200 {"status":"delivered","reference":"…"}` | the CRM took it; `reference` is the CRM's contact id when it gives one                                                                         | "Tack, vi hör av oss"                |
| `409 {"status":"refused","reason":"…"}`      | the CRM said no, in its own words (a full slot, a passed deadline, a person already on the home)                                               | the reason, and the other slots      |
| `502 {"status":"failed"}`                    | the CRM did not answer in time                                                                                                                 | "Det gick inte just nu, försök igen" |
| `400 {"error":"…"}`                          | the submission does not match the schema, names a record of another tenant, or is a lead without `office_id` for a tenant with several offices | the site's own validation message    |
| `501 {"error":"…"}`                          | this tenant's CRM takes no submission of that kind                                                                                             | the site hides that form             |
| `429 {"error":"…"}`                          | more than the limit from one token in a minute                                                                                                 | "Försök igen om en stund"            |

The same `id` posted again within a day answers the stored outcome and sends nothing twice: a
double click or a retried request makes one lead.

With 139, a fourth kind `search_profile` with its `criteria` group joins the schema, additive, as
listed under "What the modal asks"; nothing in the fields above changes.

### Reading the slots

`GET /v1/submissions/slots?connection_id=…&remote_id=…` (same token) answers the home's viewings
as the CRM sees them now, copied and renamed onto universal names and nothing else. Its shape is
the second schema of this design, `schemas/slots.v1.json`, built on the viewing the records
already carry (`schemas/_shared.v1.json`, `viewing`: `id`, `starts_at`, `ends_at`,
`self_registration`) plus what only the CRM's booking data gives: `deadline_at`, `visible`, and
the `slots[]` with `id`, `starts_at`, `ends_at` and what the CRM says about room: Vitec's
"registration available" as `available`, Mspecs's free places as `free_spots`. Each CRM fills
what it has; the site reads what is there and decides nothing is decided in Core.

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
      "slots": [
        { "id": "…", "starts_at": "…", "ends_at": "…", "available": true, "free_spots": 3 },
      ],
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
data that goes stale the moment someone books. (Mspecs sends its slots inside the published
deal, so its adapter answers the slots call from the deal it reads; the site sees one shape
either way.)

### A departure approved with 130: the web process calls the CRM

Today only the worker talks to a CRM; the web process answers the sites and, for a Vitec
notification, only writes the record on the adapter's fetch list (strategy §5.1, "Two
processes"). A submission needs the CRM's answer while the visitor waits, so `submit` and `slots`
run inside the web process and the request: the first CRM calls from `web`. §5.1's two-process
paragraph gains the sentence "for a submission, `web` calls the CRM through the adapter and
waits for the answer", and the sentence "the engine never calls back into CRM-specific code
except through the mappers and lifecycle handlers" gains "and the submission handlers". The
Vitec adapter's speed limit towards Connect is kept per process, so `web` and `worker` each pace
their own calls; Vitec states no rate limit (next-steps item 1), and a submission is one call,
so this costs nothing today and is named here so it is not drifted into. The alternative, a
queue the worker delivers from, would make the visitor's "sent" a promise and hide a full slot
from them; it was weighed and set aside.

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
  to strategy §13's defaults with the build, and changed without a gate after that.

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
- **Eight settings, typed in the admin area on the connection's page**, each with its direction
  and covered by `admin/directions.test.ts`. First the gate, Core's own: "Send forms to Vitec",
  empty or no until the office is confirmed as a demo or test customer (54 f) or goes live, and
  every form is refused before any call while it is not yes, so a connection that reads a client's
  production office for testing (the staging connections) is never written to (added 2026-10-04,
  when the widget put a send one click away on the staging site). Then the brokerage's own knobs,
  which Core copies through and decides none of: the lead source id for the
  website's leads (optional; Vitec uses its preselected one when empty), the intake source id for
  valuations (optional), the status a website interest gets (Vitec's own list; empty leaves it to
  Vitec), whether a booking is confirmed by e-mail, whether it is confirmed by SMS, the
  reminder minutes, and the CRM function group's password when Vitec issued a separate one (empty:
  the Connect key pair). These are the CRM's own knobs, copied through; Core decides none of them.
- `slots` calls the form endpoint and renames the fields.
- `submit` for a `search_profile` (139): the contact id from the booking or valuation answer, else
  `Contacts/UpdatePerson`, then the residential search profile call, both in the CRM function
  group with its own password per customer; the subtypes and area ids are mapped in the adapter.
- The test stand-in Connect (`adapters/vitec/connect.ts`) gets the three calls and the form
  endpoint, and one real send per kind is verified against a demo or test customer Patric has
  confirmed before the first release; never against the login in the environment, which reads a
  client's production office (AGENTS.md, "Stop and ask").

### The Mspecs adapter's part, when the adapter exists

- `submit` maps an `interest` onto the prospective buyer call and a `viewing` onto the viewing or
  slot call; the phone is written the way Mspecs demands it (country prefix, digits only), which
  is the adapter bending to its CRM, not a rule of Core's. Its manifest lists `interest` and
  `viewing`; a `lead` is answered 501 until question 136 settles what the footer form sends to an
  Mspecs brokerage. The interest level and the notification switch are the brokerage's settings
  on the connection's page, as Vitec's are.
- `slots` answers from the deal's own viewings.
- The fourth kind, `search_profile` (139), is Mspecs's lead-with-matching call with one
  matching from the criteria; the area names become the home's municipality code.

### The clients' part

With the widget (137, decided) the clients' part is the script tag, a site-key setting and the
buttons. **Every form on a site is a button that opens the wizard** (Patric, 2026-10-04, 21:08Z):
a viewing's "Boka här" opens the booking, the property page's interest button opens the interest
form, and the footer's "Ska du sälja din bostad?" opens the free valuation (the seller's lead);
the design's two inline forms, the footer's and the property page's, are replaced by a button
each, no fields on the page ("replaced by a button that opens the form instead of showing the
form inputs directly"). **The theme's side is built** (2026-10-04, theme 1.1.7, docs/kowboy-2026.md):
the three buttons carry `data-core-form` (`viewing`, `interest`, `lead`) and `data-record`
(`property:<connection>:<id>`) as above, and lead to the agent's card or the office's details
while the widget is not on the page; the theme's own click handler steps back from a click the
widget has taken (`event.defaultPrevented`), so the widget's handler should prevent the default.
**The plugin's side is built too** (2026-10-04, plugin 0.5.7): a "Site key" field under Forms on
its settings page, and with a key the plugin prints the widget's script tag on every page, with
the site's privacy policy page as `data-policy-url` for the consent line
(`core-client/includes/forms.php`). The widget reads one more optional mark the theme may add:
`data-viewing="<viewing id>"` on a viewing's own "Boka här", so the booking step shows that
viewing's slots only and picks the one free slot when there is one; the viewing's id is the
record's `viewings[].id`. What follows is the form-per-client alternative that was not chosen,
kept for the comparison.

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
- The bot gate is on from the first form (Patric, 2026-10-04): Core verifies the service's token
  server-side (138), with the honeypot, a minimum time and the rate limit always on.
- The widget (137) reaches the same endpoint with a public site key, the site's registered
  domains as the Origin check, and CORS; the key can post a form and read slots, nothing else.

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
6. The widget's three forms pass a browser journey against the real Core on the staging site,
   and the browser never receives the tenant token or the CRM login.
7. A `search_profile` posted after a lead reaches the stand-in CRM as a contact and a profile with
   the criteria mapped, and a skipped third step leaves the main submission delivered.

### Built 2026-10-04: Core's part (plan item 1)

Reviewed on 2026-10-05 in `docs/forms-review.md`: what each part below is, who decided it,
whether a form needs it, two defects (known bugs 3 and 4), and question 144 on what stays.

What exists, proved by acceptance criteria 43 to 47 and 49 (`acceptance/submissions.test.ts`)
against the fake polling CRM, which takes every kind, and the fake webhook CRM, which takes none:

- `schemas/submission.v1.json` and `schemas/slots.v1.json`, as designed above, with two names
  settled on the way: the municipality field of the criteria and of each area is
  `county_municipality_code`, the universal name the area and property records already carry;
  and `consent.given` must be `true`, so an unticked privacy box is not a submission (400).
- `engine/adapter-api/types.ts`: `manifest.submissions`, `Adapter.submit` and `Adapter.slots`
  with the `Submission`, `SubmissionResult` and `Slots` types. `engine/registry.ts` holds the two
  handlers per provider, registered by `main.ts` and the test harness for both roles.
- `POST /v1/submissions` and `GET /v1/submissions/slots` (`engine/http/submissions.ts`): the
  token, the limit (60 a minute per token), the schema, the connection (the record's; for a lead,
  the office's, or the tenant's only office, which Core fills into `office_id`), then the adapter,
  with 20 s for the CRM's answer before the submission counts as failed. A paused connection is 400. The same `id` again, a double click included, answers the first request's outcome for a
  day and sends nothing; the stored row is claimed before the CRM is asked, so two requests at
  once make one send.
- The `submissions` table (migration 010): id, tenant, connection, kind, record, office, outcome,
  the CRM's reference, the refusal's reason or the failure's cause, the times; never the person.
  Rows go with the event retention (30 days).
- The events `submission.received`, `.delivered`, `.refused`, `.failed`, with the id as the
  correlation id, on the record's timeline and in words on the admin pages.
- The health check `submissions.failing` (names the connections, counts in the public detail) and
  the counts per outcome for the last day under each connection on the tenant's page.
- Strategy §5.1 carries the departure (the web process calls the CRM for a submission), §13 the
  two defaults, §10 the criteria 43 to 49.

Then the widget, the site key, the Origin check and Turnstile (plan item 3, below), which
bring criterion 48 and the skipped third step of 49.

### Built 2026-10-04: the Vitec adapter's part (plan item 2)

What exists, proved against the stand-in Connect by `adapters/vitec/forms.test.ts` (five tests,
listed under acceptance criteria 43, 44, 47 and 49) and described in `adapters/vitec/README.md`,
"Forms from the sites":

- `adapters/vitec/forms.ts`: `submit` copies the universal submission onto Connect's calls, one
  per kind, as the table "Vitec Connect, from the saved documentation" gives them: a lead is the
  valuation request (`v2/Advertising/Form/{customerId}/Valuation`, answering the contact id,
  which becomes the reference), an interest the interest registration
  (`Advertising/Estate/{customerId}/{estateId}/interest`, which answers nothing, so the reference
  is null), a viewing the attendance (`…/Viewing/Attend`, the contact id), a search profile
  `Contacts/UpdatePerson` (whose duplicate check answers the existing or the new contact's id)
  then `CRM/Contact/{customerId}/SearchProfile/Residential/{contactId}`. The customer id is the
  `office_id` Core filled in. A ticked current-home box on an interest or a booking (141 a) sends
  the valuation too, on the same person, after the main call. `consent.at` is the interest's GDPR
  date, `source.page` the referrer and `source.utm` the UTM tag list on every call that takes
  marketing.
- The eight settings above, read from the connection's credentials document (one JSON next to
  the key pair), typed on the connection's page beside the Connect username and password
  (`admin/index.ts`), named in the setup directions' step "Forms" and held by
  `admin/directions.test.ts`. Each empty one is left out of the call, so Vitec applies its own
  default. `manifest.submissions` lists all four kinds.
- The outcome: Vitec's 400, 404, 409 and 422 are a refusal whose reason is Vitec's own message
  (the JSON `message` when there is one) with anything that looks like an e-mail address or a
  number scrubbed, so the visitor reads "Visningen är fullbokad" and no third party's details;
  anything else (5xx, a timeout, broken JSON, a network error) is a failure with the error's kind
  and the scrubbed start of the answer as the cause. Every call is a `crm.call` event in the
  submission's chain (the submission id as correlation id) on the home's timeline, without a body.
- `slots` reads `v2/Advertising/Form/{customerId}/Estate/{estateId}` and renames the viewings and
  their time slots onto `schemas/slots.v1.json`; the moments become UTC, `free_spots` is null
  because Connect gives no count. The customer id is the record's office, else the connection's
  first office.
- The stand-in Connect (`adapters/vitec/test/connect.ts`) answers the five calls and the form
  endpoint, keeps every form body for the tests to compare field by field, and can refuse the
  next call with a message.
- `api.ts` gained a JSON `post` next to `get`, with the same key pair, pacing and `crm.call`
  observer, and `scrub`, the e-mail and number scrubber the outcomes use.

Not done, and not doable from here: the real send. Every call above ran against the stand-in
only; the login in the environment reads a client's production office and is never a write
target (AGENTS.md, "Stop and ask"; Patric, 2026-10-04). One real send per kind, and the search
profile's two calls with the CRM function group, wait on a demo or test customer Patric has
confirmed (question 54 f). The code holds the rule too: `submit` refuses every form before any
call while the connection's "Send forms to Vitec" is not yes (`forms.test.ts`, the gate's test),
so the staging Core, which deploys on every push and whose connections read a client's production
office, writes nothing however a form reaches it; the widget's refusal text to the visitor is
"Formulär skickas inte till det här kontoret än".

A note for the widget (plan item 3): the criteria's `object_type` cannot be read off the home by
the widget, because the home's universal `type` is the CRM's own enumeration and reading it would
put CRM knowledge in a client. The widget sends `object_type: null` unless Patric wants the
visitor asked; both adapters take null (Vitec: no subtypes, an open profile).

### Built 2026-10-04: the widget (plan item 3)

What exists, proved by `acceptance/forms-widget.test.ts` (the door, under criteria 46 and 48) and
the browser journey `clients/wordpress/e2e/forms-widget.spec.ts` (the three forms on the test
site through the real theme, plugin and Core, under 48), and described in
`clients/forms-widget/README.md`:

- **The site key and the browser's door.** Every site carries a public key, `pk_…`, next to its
  bell secret (migration 011; shown on the tenant's page with a copy button), and the addresses
  its widget may be used from (typed on the same page; empty means the bell address's site).
  The browser reaches four calls with it and nothing else (`engine/http/forms.ts`):
  `GET /v1/forms/config` (the kinds the tenant's CRMs take, the tenant's area list for the
  chips, the bot gate to render), `GET /v1/forms/record` (the home's street, rooms, living
  space, areas, municipality code and viewing ids, copied from the stored record for the heading
  and the prefill), `GET /v1/forms/slots` and `POST /v1/forms/submissions`, the last two the
  same code as the server's door. Core refuses a missing or unknown key (401), a request whose
  `Origin` is not one of the site's addresses (403, and the preflight answers only a known
  address), a switched-off site (403), a failed bot check (403) and the 11th submission in a
  minute from one address (429), before any CRM call; the tenant's 60 a minute hold as well. The
  server's door, `POST /v1/submissions` with the tenant token, stays for a site that posts from
  its own server; it has no CORS.
- **The bot gate** (138): `engine/human.ts`, one interface, Turnstile behind it. With
  `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET` set, the config names the service and the widget
  renders its challenge while the visitor types (invisible unless the service wants an
  interaction), the token travels as `X-Core-Human`, and Core verifies it with the secret; unset,
  there is no gate, which is the local and test setup. **Production needs the two keys before
  the first form goes live** (a Cloudflare account, one widget per site, ten hostnames each).
  Always on: the widget's honeypot field, at least three seconds from open to send, and Core's
  limits per tenant and per address.
- **The widget** (`clients/forms-widget/`, Vite, no framework, 25 kB, 8 kB over the wire):
  binds every `data-core-form` button on the page and inside every open shadow root through the
  click's composed path, in the capture phase, and prevents the default, so the theme's fallback
  scroll steps back. The wizard of question 139 in its own shadow root: the slots read live (the
  full ones disabled, "N platser kvar" when the CRM counts), the person, the main submission the
  moment its information is in, the confirmation as the heading, the optional profile step with
  the minimums prefilled from the home (the closest whitelisted value below) and the site's
  areas as chips with the home's pressed, "Kontakta mig om min nuvarande bostad" on a home's
  forms only, Skip and Send; the refusal shows the CRM's words and offers another slot, a
  failure says the CRM did not answer and keeps the typed details. The person is remembered in
  the visitor's own browser after a sent form, with a line saying so and "Glöm mig". Served by
  Core at `/widget/forms.js` with a five-minute cache, so a fix reaches every site without a
  deploy of theirs. `object_type` is sent as null: the record's `type` is the CRM's own
  enumeration, which a client never reads; both CRMs take null (Vitec: no subtypes).
- **The plugin** (0.5.7): the "Site key" setting and the script tag (above).

Not done here: the Turnstile keys in the environments, and the lead office for a site with
several offices (the footer's lead has no `data-office`; Core fills the tenant's only office and
refuses a lead for a tenant with several). The theme's `data-viewing` mark (theme 1.1.8) and the
deploy of plugin 0.5.7 to the staging site are the theme thread's, done the same night
(docs/kowboy-2026.md); the site key is pasted in from Core's tenant page, which a session enters
by Patric's sign-in link. Criterion 48 names the local journey; the same walk on the staging site is
the last proof once the deploy is done.

## The decisions (the discover list)

| #   | Question                                                                                                                                                                            | Options                                                                                                                                                                                                                                                | Undo later?                       | Recommended                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 129 | Where do CRM writes live? **Answered 2026-10-04: a, inside Core** ("129 A", and the widget of 137 posts to Core)                                                                    | a) inside Core, its own folder and health check · b) a separate app · c) Vitec's component on the sites · d) a per-site plugin per CRM                                                                                                                 | a→b yes                           | a, for the reasons under "Why A still"                                                                          |
| 130 | Is the design approved? **Answered 2026-10-04: yes, without cancelling a booking.**                                                                                                 |                                                                                                                                                                                                                                                        |                                   |                                                                                                                 |
| 131 | What does "create a search profile" become for Vitec? **Answered 2026-10-04: Vitec's version 1 API has it** (CRM-Contact), see the wizard                                           | a) nothing to build: the interest form with status Interested, and the brokerage turns on automatic profiles in Express · b) Patric asks Vitec whether another API offers it · c) a site-side saved search, later                                      | yes                               | a, the smallest; c is a product of its own                                                                      |
| 132 | May an agent mail Mspecs for the documentation? **Answered 2026-10-04: no mail; the documentation was found online and saved.**                                                     |                                                                                                                                                                                                                                                        |                                   |                                                                                                                 |
| 137 | The form UI: one widget served by Core, or a form per client? **Answered 2026-10-04: a, the widget**                                                                                | a) the widget, posting to Core with a public site key; the plugin and the kit only add the tag · b) a form per client, as the approved design · c) both: the widget and a server-rendered fallback form in the theme                                   | a→b yes, the endpoint is the same | a, under "The widget"                                                                                           |
| 138 | The bot gate: which service? **Answered 2026-10-04: a, Turnstile**                                                                                                                  | a) Turnstile by default, the service pluggable per site, Core's own measures always on · b) reCAPTCHA v3 only · c) Core's own measures only, a service when spam is seen                                                                               | yes                               | a; c is the smaller option and against Patric's "must have"                                                     |
| 139 | What does the modal ask beyond the contact? **Answered 2026-10-04: a wizard, the profile last**                                                                                     | a) one screen with one collapsed optional group the CRM takes · b) a second step after sending · c) the contact only                                                                                                                                   | yes                               | a, under "What the modal asks"                                                                                  |
| 141 | The profile step's checkbox "Kontakta mig om min nuvarande bostad": keep it, drop it, or a text instead? **Answered 2026-10-04: a, keep it**                                        | a) keep it, the adapter makes the visitor a seller lead too · b) drop it · c) a text about the home to sell, one more step                                                                                                                             | yes                               | a; b is the smaller                                                                                             |
| 142 | Pre-market homes (the chains' "register and see homes first"): selling text on the set's Kommande list, a gated page, or nothing? **Answered 2026-10-04: a, Kommande stays public** | a) selling text, the interest button on the Kommande cards is the register's door · b) a gated page behind a login · c) nothing                                                                                                                        | yes                               | a; c is the smaller                                                                                             |
| 136 | What does the footer's lead form send to an Mspecs brokerage, whose lead call needs at least one matching?                                                                          | a) the lead call with one matching from the brokerage's settings (a municipality), so the contact lands in Mspecs · b) the form is hidden on Mspecs sites until Mspecs offers a plain lead · c) the lead goes by e-mail to the office, outside the CRM | yes                               | b, the smallest, until an Mspecs brokerage asks; a is a Core-made matching, which is a rule to write down first |

Settled without a question, as the handbook leaves tooling to the agent: the delivery is
synchronous (the visitor waits a second for the CRM's answer and learns the truth; no queue in
Core, no personal data at rest); the slots are read live, not copied into the record; the
submission id is a UUID in the body; the rate limit is 60 a minute per token.

## Risks and unknowns

- `[crm-vitec]` **Vitec's refusals** (full slot, passed deadline, duplicate person) are not
  documented. The first build sends one of each against a demo or test customer and reads the
  answers before the UI's words are written. Cheap: an hour, once such a customer exists.
- `[crm-vitec]` **Several slots per viewing** were not seen on the test account. The dialog
  handles one or many from the slots call; a person in Vitec could set a multi-slot viewing on
  the test account to prove it (the same kind of step as question 54).
- `[crm-mspecs]` **Mspecs's answers and test access** are unread beyond the specification: the
  success body, the refusal shape, and the provider agreement that opens
  `test-integration.mspecs.se`. The adapter item starts with those.
- `[core]` **Spam** on an open form reaches the CRM as leads. The bot gate is on from the first
  form (138), with the honeypot, the timing and the rate limit under it; Turnstile's free plan
  stops at twenty widgets, which is a count of sites to watch.
- `[crm]` **No write target exists today** (Patric, 2026-10-04: no test CRM writes to a target
  not confirmed as demo or test; the staging site's connections are a client's production
  connections). The Vitec login in the environment reads a client's production office and is
  read-only for Core; Mspecs's test server opens with a provider agreement. Every real send in
  this plan waits for a demo or test customer Patric confirms (question 54 f); until then the
  stand-in CRM is the only write target, and the rule is in AGENTS.md, "Stop and ask".
- `[crm-vitec]` **The CRM function group** is granted per customer to the partner, apart from
  the advertising group; the login in the environment answers 401 for it today (probed
  2026-10-04, read-only), so the search profile needs the grant on the demo or test customer
  (question 54 f).
- `[core]` **The widget's look** must blend with each site's design (norbanmakleri.se for Kowboy
  2026): CSS variables and the site's font carry the look; the theme's own markup does not.
  Cheap to see: the first build is placed on the staging site's property page.

## The plan (items for `docs/next-steps.md`, after 129 stands)

1. ~~`[core]` **The submission endpoint and the adapter capability**~~ (built 2026-10-04, below): the two schemas, the two
   adapter members, `POST /v1/submissions` and `GET /v1/submissions/slots`, the outcomes table,
   the events, the health check and the rate limit, proved by acceptance 1 to 5 against a fake
   adapter. One session. Interface: additive (two new schemas, two optional adapter members) plus
   the §5.1 amendment above.
2. ~~`[crm-vitec]` **The Vitec submit and slots**~~ (built 2026-10-04 against the stand-in, below): the mapping, the seven connection settings with
   their directions, the stand-in's form endpoints, and one real send per kind against a demo or
   test customer Patric has confirmed (54 f, still open: the real send is the one thing left); the search profile's two calls against the stand-in, and
   against that customer once the CRM function group is granted on it. One session.
3. ~~`[core]` **The widget** (137)~~ (built 2026-10-04, below; the staging placement is the
   theme thread's deploy): `clients/forms-widget/`, served at `/widget/forms.js`, the
   config call, Turnstile (138), the wizard with the profile step (139), the public site key and
   the Origin check; the plugin gets the tag and the key setting, the theme the buttons and the
   lead office; placed on the staging site; closes question 105 and item 21. One session.
4. `[client-lovable]` **The tag in the layout**: when the first Lovable site needs a form.
5. `[crm-mspecs]` **Mspecs submit and slots**: with the Mspecs adapter, from the saved
   specification, once a provider agreement opens the test system.

Later, in the feature map: watching the final price (Vitec offers it; no design asks for it yet);
a text about the home the visitor has to sell (Vitec's `presentAccommodation`; 141 is its
checkbox), if a brokerage asks;
a site Kowboy does not build gets the widget by a key (137), which is the product door. Out:
cancelling a booking (Patric, 2026-10-04).
