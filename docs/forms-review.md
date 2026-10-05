# The forms build, reviewed (2026-10-05)

On 2026-10-05 Patric wrote that the forms build "added tons of bloat to the core admin", that he
was not confident about its architectural decisions, that "you should have asked me about
those", and asked what else was missed and how to solve it. This file is a fresh-eyes review of
everything the build of 2026-10-04 added to Core: the four saved changes of that evening, which
built Core's part, the Vitec adapter's part, the form window and the Vitec safety switch. For
each part it says who decided it, whether a visitor's form needs it to reach the CRM, and what
question 144 would do with it. It was written from the changes and from the questions as Patric
saw them, and checked by a second agent with no part in the build.

## In short

- `[core]` The build added about 2,000 lines of program code to Core, which grew by about 12
  percent, plus about 1,300 lines for the form window Core hands to the sites.
- `[core]` Patric decided the large pieces, each as its own question: forms go through Core
  (129 a), one form window served by Core (137 a), Cloudflare Turnstile as the bot check (138 a),
  the wizard (139), Vitec's search profile (131) and the current-home box (141 a).
- `[core]` Most of what fills the admin area came in through two long documents he answered as a
  whole: the design of question 130 ("build it as written", answered "yes but without cancel a
  booking") and the plan he answered with "Go". Each bundled about a dozen decisions into one
  answer, against the handbook's rule of one decision per question. The six Vitec fields, the
  count line, the server door and the visitor remembered in the browser came in that way.
- `[core]` Four things were added during the build with no question and no line in either
  document: the "Send forms to Vitec" switch, the "CRM password" field, the site's typed
  addresses, and a fourth call from the browser. Each was the build's own way of carrying out
  something Patric had decided; none was asked.
- `[core]` Two defects were found. Saving one forms field on a Vitec connection erases the
  connection's Vitec login (proved with a test on 2026-10-05). The bot check is off whenever its
  two keys are missing, which is the case on staging and live.
- `[core]` The build skipped the handbook's fresh-eyes review before reporting done.
- `[core]` Question 144 offers three ways out, question 145 a rule for the future.

## Words used here

- **The admin area** is Core's own set of pages, where a person sets up customers, their
  connections and their sites.
- **A connection** is Core's link to one brokerage's account in a CRM such as Vitec, with the
  login Core reads it with.
- **A site** is a website that shows a customer's homes and gets them from Core.
- **The form window** (the "widget") is the small program Core hands to every site. It opens
  the booking, interest and valuation forms over the page and sends them to Core.
- **The browser door** is the set of web addresses the form window calls from a visitor's
  browser, carrying the site's public key. **The server door** is the same service for a site's
  own server, carrying the customer's secret token.
- **The site key** is the public code that tells Core which site a form comes from.
- **The bot check** tells a person from a program before Core accepts a form (Turnstile).
- **The register** is `docs/open-questions.md`, where every question to Patric gets its number.

## What you see in the admin area

| What it is                                                                                                                 | Who decided                                                                                                                                                              | Does a form need it to reach the CRM?                                                                                                             | Under 144 a                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Send forms to Vitec" on every Vitec connection                                                                            | Added during the build to carry out Patric's rule of 2026-10-04 that no test form reaches a brokerage not confirmed as a test one; in no question or document            | No: it stops forms                                                                                                                                | Cut; Core sends no form unless its environment allows it                                                                                                |
| Six Vitec fields: lead source, intake source, status of an interest, booking confirmed by e-mail, by SMS, reminder minutes | The 130 design ("five connection settings" in the question, six in the design he approved), never asked one by one                                                       | No. Vitec takes a form without any of them; left empty, a booking still gets the build's own choice (e-mail confirmation on, no SMS, no reminder) | Cut, taking back this part of 130; a booking always asks Vitec for its e-mail confirmation, which the form window promises, with no SMS and no reminder |
| "CRM password" on every Vitec connection                                                                                   | Added during the build as the place to type the password the plan names for Vitec's CRM part; Vitec gives each customer and each function group its own password         | Yes, for the search profile only                                                                                                                  | Keep                                                                                                                                                    |
| "Addresses its forms widget may be used from" on every site                                                                | The 130 and 137 designs approved a check against the site's registered addresses; typing them on the page, with the bell address as the fallback, was the build's choice | No: the bell address already names the site, and the staging site's forms opened with this field empty on 2026-10-05                              | Cut; the check uses the bell address's site                                                                                                             |
| "Its site key, for the forms widget (public)" on every site                                                                | Patric, 137 a (a site includes the form window with a public key)                                                                                                        | Yes: the site's plugin needs it                                                                                                                   | Keep                                                                                                                                                    |
| "Forms, last day: delivered, refused, unanswered" under every connection                                                   | The 130 design, not its question; on 2026-10-04 at 15:53 the forms thread named "no counts" as the smaller option, but not as a question                                 | No                                                                                                                                                | Cut, taking back this part of the 130 design; the health check and the events tell the same                                                             |
| The health check "submissions.failing" on Overview, red while a CRM stops answering forms                                  | The 130 question                                                                                                                                                         | No, but it is how anyone learns that forms stop arriving                                                                                          | Keep                                                                                                                                                    |
| Four event lines on a home's timeline: a visitor sent a form, the CRM took it, refused it, did not answer                  | The 130 question                                                                                                                                                         | No, but they are the only trace of what happened to a form                                                                                        | Keep                                                                                                                                                    |
| The "Forms" step in the Vitec page's setup directions                                                                      | Claude, because this project's rules say every field is explained there                                                                                                  | No                                                                                                                                                | Shrinks to what remains                                                                                                                                 |

## What runs without being seen

| What it is                                                                                                                                                 | Who decided                                                                                                                                                         | Does a form need it to reach the CRM?                                     | Under 144 a                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| The form window and its wizard, served by Core                                                                                                             | Patric, 137 a and 139                                                                                                                                               | Yes                                                                       | Keep                                                                                       |
| The browser door's three calls: what this site may send, a home's viewing times, and the form itself                                                       | Patric, 137 a                                                                                                                                                       | Yes                                                                       | Keep                                                                                       |
| A fourth browser call that gives the form window the home's street, rooms and area                                                                         | Added during the build: the plan has the page carry only the site key and the home, so this call is how the window gets the facts for the prefill approved with 139 | Yes, for the prefill                                                      | Keep                                                                                       |
| The server door: the form and viewing-time calls for a site's own server, with the customer's secret token                                                 | The 130 question and the plan answered with "Go"                                                                                                                    | No: nothing calls it today                                                | Keep: its own part is about 20 lines, the rest is the sending path the browser door shares |
| The outcomes table: each form's id, kind, home and what the CRM answered, never the person, kept 30 days                                                   | The 130 question                                                                                                                                                    | Yes: it makes a double click send one form, and it feeds the health check | Keep                                                                                       |
| The bot check (Turnstile)                                                                                                                                  | Patric, 138 a                                                                                                                                                       | Yes, before forms go live                                                 | Keep, and fixed (known bug 4)                                                              |
| The form window remembers the visitor's name, e-mail and phone in their own browser after a sent form, with a "Glöm mig" link                              | The plan answered with "Go", as a "Default" that never reached the register                                                                                         | No                                                                        | Cut, taking back this Default                                                              |
| The limits: 60 forms a minute per customer, 10 a minute per visitor, 20 seconds to wait for the CRM, a form sent twice answers the first outcome for a day | The 60 in the 130 question, a limit per visitor in the 137 design, the one-day answer in the 130 design; the numbers 10 and 20 seconds were the build's tuning      | Yes, as protection                                                        | Keep                                                                                       |
| Core's web process waits for the CRM's answer while the visitor waits                                                                                      | Named as a departure in the 130 design                                                                                                                              | Yes                                                                       | Keep                                                                                       |
| The Vitec mapping: the valuation request, the interest, the booking and the search profile                                                                 | Patric, 130, 131 and 141 a                                                                                                                                          | Yes                                                                       | Keep                                                                                       |
| Two data shapes (schemas), two members of the adapter interface, acceptance criteria 43 to 49                                                              | Patric, 130 and "Go"                                                                                                                                                | Yes                                                                       | Keep; the tests under 43, 44, 46 and 48 change                                             |
| The WordPress plugin's "Site key" setting and the script tag it prints                                                                                     | Patric, 137 a                                                                                                                                                       | Yes                                                                       | Keep; the plugin's, not Core's                                                             |

## The size

The four saved changes of the forms build, counted line by line (lines added):

| Kind                        | Lines added |
| --------------------------- | ----------- |
| Core's program code         | 2,013       |
| The form window Core serves | 1,270       |
| The WordPress plugin        | 51          |
| Build settings              | 24          |
| Tests and the test CRM      | 1,510       |
| Documents                   | 487         |

Core's program code before the build: 16,424 lines. After: 18,391 lines. Growth: 18,391 −
16,424 = 1,967 lines, and 1,967 ÷ 16,424 ≈ 0.12, so about 12 percent. The largest parts are the
path that takes a form and sends it, which both doors share (about 640 lines, of which the server
door's own part is about 20), the Vitec adapter's forms (about 500 lines) and the two data shapes
(about 250 lines). The admin area's share is about 140 lines: the eight field definitions take
53, the tenant page 35, its side in the engine 47 and the directions 5. What makes the admin area
look heavy is nine fields and two lines on the tenant page.

## What else was missed

1. `[core]` **Saving one forms field on a Vitec connection erases the Vitec login** (known bug
   3). The eight forms fields are stored inside the connection's login, which the admin area
   never shows back and replaces whole when anything is typed. A test on 2026-10-05 stored a
   login, typed only "yes" in "Send forms to Vitec" and saved: what remained was
   `{"send_forms":"yes"}`, and the username and password were gone. It works the other way too:
   typing a new Vitec password erases all eight forms fields and quietly turns "Send forms to
   Vitec" back to no. The page cannot show whether the switch is on, and it draws the yes-or-no
   fields as free text, so "Yes" with a capital letter counts as no, and "nej" in the e-mail
   field counts as yes. The root is older than the forms: typing only a new Vitec password
   already lost the username; the forms build put eight more fields into the same login.
2. `[core]` **The bot check is off whenever its keys are missing** (known bug 4). Patric decided
   the check is on from the first form (138); the build lets every form through when its two
   keys are unset, which is the case on staging and live, and the reply of 2026-10-04 mentioned
   it as a note, not a question. A program posting straight to Core then meets only the limits:
   the hidden trap field and the minimum time live in the form window, which such a program
   skips; the limit per visitor reads the first address in a header the sender can write to,
   and whether the hosting platform cleans that header is not checked; and a program can use up
   the customer's 60 forms a minute, so real visitors are refused. The Settings page of the admin
   area does not list the two keys, so nobody can see that they are missing.
3. `[crm-vitec]` **No form has reached a real Vitec.** Every call ran against the test stand-in;
   the first real send waits on a demo or test customer from Vitec (54 f).
4. `[core]` **A customer with several offices cannot receive the free valuation.** The footer's
   button names no office, and Core refuses a valuation without one for such a customer. It is
   written down as "later", with no question asked.
5. `[core]` **Questions that bundled many decisions, and no fresh-eyes review.** Question 130 and
   the plan answered with "Go" each asked one yes for about a dozen decisions; the handbook asks
   one decision per question, and a round of several with "ok" to take every recommendation.
   Before reporting done, the handbook also asks a second agent with no memory of the build to
   check every change against the decision that asked for it; the forms build's checklists and
   saved changes show no such step, unlike the search work of the same day.
6. `[core]` **Register numbers and notes in the admin area.** "(question 54 f)", "(Patric,
   2026-10-04)" and "(docs/forms.md)" stood in the switch's help and in the Vitec page's
   directions. They were removed on 2026-10-05.

## The other changes of 2026-10-03 and 2026-10-04

- `[core]` Core's engine and the Vitec adapter changed in those two days only for Patric's
  answers: 90 to 96 on 2026-10-03 (the fact tables, the association codes, the documents) and
  119 (percentages keep every decimal).
- `[client-wordpress]` Of the 54 decisions written down on those two days, 50 cite Patric's word,
  a closed question or an unopposed Default. A citation is not the whole story, as the forms
  build's lines show. The four without one: a note on a refused Cloudways login, the bids
  display from his punch list, the list blocks' place from the search design, and a choice made
  alone that he already corrected: the search box was first built as our own box instead of a
  market-leading library, and he chose Tom Select (140 a).
- `[core]` Two ideas in the forms strategy were written as "Defaults" but never put in the
  register: the visitor remembered in the browser (built) and a page of form counts per page and
  campaign (not built).

## How to solve it (question 144)

- **a) Cut to the minimum (recommended).** It takes back parts Patric approved inside the 130
  design and the "Go" plan, named here so that his answer decides each of them.
  - Goes: the "Send forms to Vitec" switch, the six Vitec fields, the typed addresses, the count
    line and the visitor remembered in the browser.
  - In their place: Core sends no form unless its environment allows it, so staging and a local
    run send nothing and live sends; when the test customer of 54 f exists, the same setting can
    name it, and nothing of that is built before. A booking always asks Vitec for its e-mail
    confirmation, which the form window promises, with no SMS and no reminder. The lead source,
    the intake source and the interest's status are left out, so Vitec's own choices apply. The
    address check uses the bell address's site.
  - Fixed: a save keeps every stored login field that was not typed (known bug 3, needed for the
    CRM password and for a new Vitec password). Without the bot check's keys Core refuses forms,
    reads the visitor's address the way the hosting platform documents, and the Settings page
    lists the two keys (known bug 4).
  - Kept: everything marked "Keep" above, including the server door, the fourth browser call and
    the CRM password.
  - Protected paths it changes: the tests listed under acceptance criteria 43, 44, 46 and 48, and
    their names in `acceptance/criteria.json`; the criteria's own words stay.
- **b) Hide.** Everything stays, and the forms fields fold into a closed "Advanced" box on the
  connection. Both defects are fixed: the settings leave the login, show their stored values and
  draw their choices, and the bot check is fixed as in a. The parts that were never asked stay.
- **c) Start over.** The whole forms build leaves Core, the site's buttons fall back to the
  agent card, and each part comes back only after its own question. It costs the evening's work,
  and the forms come back only as fast as each part is asked and built again.

Recommended: a. It keeps every decision Patric made as its own question, takes back the bundled
parts that fill the admin area, fixes both defects and leaves Core smaller. What remains is the
"Keep" list above, and any line of it can be struck in the same reply.

A later idea, not part of a: the plugin could fetch its site key from Core with the customer's
token it already holds, so nobody copies the key and the site key line leaves the admin area too.

## A rule so it does not happen again (question 145)

The handbook already says architecture is decided, not drifted into, one decision per question,
and that a reviewer rejects any change no decision asked for. The forms build slipped through
three gaps: one yes to a long design was read as approval of everything in it, the build added
its own means while building, and the review that would have caught both was skipped. The
proposed addition to `AGENTS.md`, under "Stop and ask" (a protected file, so it needs Patric's
yes):

> - anything new that a person sees in the admin area (a page, a section, a field, a setting, a
>   line) or that runs in Core (a web address, a table or column, an event, a health check, an
>   environment setting, an outside service) is named as its own line in a register question
>   before it is built, even inside a design: an approval covers only the lines its question
>   listed, a round may still be answered "ok" for all of them, and anything the build finds it
>   needs beyond them is a new question, not a choice (Patric, 2026-10-05: "you should have asked
>   me about those"). Text a user reads (the admin area, the form window, Core's answers to
>   sites) never cites a register number, a person, a date or an internal document (Patric,
>   2026-10-05: "that certainly does not belong in production").

The same rule could hold for every repository; if Patric wants that, it goes into the handbook
in a session on the handbook's own repository.
