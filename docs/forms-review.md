# The forms build, reviewed (2026-10-05)

On 2026-10-05 Patric wrote that the forms build "added tons of bloat to the core admin", that he
was not confident about its architectural decisions, that "you should have asked me about
those", and asked what else was missed and how to solve it. This file is a fresh-eyes review of
everything the build of 2026-10-04 added to Core (the four saved changes of the evening of
2026-10-04 that built Core's part, the Vitec adapter's part, the form window and the Vitec
safety switch). For each part it says who decided it, whether a visitor's form needs it to reach
the CRM, and what question 144 would do with it. It was written from the changes themselves, not
from `docs/forms.md`.

## In short

- `[core]` The build added about 2,000 lines of program code to Core, which grew by about 12
  percent, plus about 1,300 lines for the form window Core hands to the sites.
- `[core]` Patric decided the large pieces: forms go through Core (129 a), one form window
  served by Core (137 a), Cloudflare Turnstile as the bot check (138 a), the wizard (139), the
  design with its counts and health check ("yes but without cancel a booking", 130), and "Go".
- `[core]` The build added six things nobody asked him: the "Send forms to Vitec" switch, the
  "CRM password" field, the site's "Addresses" field, a fourth browser call, the visitor
  remembered in the browser, and keeping the server door after the form window replaced it.
- `[crm-vitec]` Six more Vitec fields were written into the design he approved with 130, but
  were never asked one by one.
- `[core]` Two defects were found. Saving one of the forms fields on a Vitec connection erases
  the connection's Vitec login (proved with a test on 2026-10-05). The bot check is off whenever
  its two keys are missing, and they are missing on staging and live.
- `[core]` The handbook's fresh-eyes review before reporting done was skipped for this build;
  its first check, "which decision asked for this?", would have caught the additions.
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

| What it is                                                                                                                                           | Who decided                                                                                                                          | Does a form need it to reach the CRM?                                                                                       | Under 144 a                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| "Send forms to Vitec" on every Vitec connection                                                                                                      | Claude alone, to carry out Patric's rule of 2026-10-04 that no test form reaches a brokerage not confirmed as a test one             | No: it stops forms                                                                                                          | Cut; staging refuses every form by its own environment setting instead |
| Six Vitec fields on every Vitec connection: lead source, intake source, status of an interest, booking confirmed by e-mail, by SMS, reminder minutes | Written into the design approved with 130, never asked one by one                                                                    | No: each is optional, and empty leaves the choice to Vitec                                                                  | Cut; one comes back when a brokerage asks for it                       |
| "CRM password" on every Vitec connection                                                                                                             | Claude alone                                                                                                                         | Only for the search profile, and only if Vitec gives a customer a separate password, which is not known before 54 f         | Cut; the search profile uses the Vitec login                           |
| "Addresses its forms widget may be used from" on every site                                                                                          | Claude alone; the 137 design named only a check of the site's address                                                                | No: the site's bell address already names the site, and the staging site's forms opened with this field empty on 2026-10-05 | Cut                                                                    |
| "Its site key, for the forms widget (public)" on every site                                                                                          | Patric, with 137 a (a site includes the form window with a public key)                                                               | Yes: the site's plugin needs it                                                                                             | Keep                                                                   |
| "Forms, last day: delivered, refused, unanswered" under every connection                                                                             | The 130 design; on 2026-10-04 at 15:53 the forms thread named "no counts" as the smaller option, which was never asked as a question | No                                                                                                                          | Cut; the health check and the events tell the same                     |
| The health check "submissions.failing" on Overview, red while a CRM stops answering forms                                                            | The 130 design                                                                                                                       | No, but it is how anyone learns that forms stop arriving                                                                    | Keep                                                                   |
| Four event lines on a home's timeline: a visitor sent a form, the CRM took it, refused it, did not answer                                            | The 130 design                                                                                                                       | No, but they are the only trace of what happened to a form                                                                  | Keep                                                                   |
| The "Forms" step in the Vitec page's setup directions                                                                                                | Claude, because this project's rules say every field is explained there                                                              | No                                                                                                                          | Shrinks to one sentence                                                |

## What runs without being seen

| What it is                                                                                                                                                     | Who decided                                                                                     | Does a form need it to reach the CRM?                                     | Under 144 a                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| The form window and its wizard, served by Core                                                                                                                 | Patric, 137 a and 139                                                                           | Yes                                                                       | Keep                                                                |
| The browser door's three calls: what this site may send, a home's viewing times, and the form itself                                                           | Patric, 137 a                                                                                   | Yes                                                                       | Keep                                                                |
| A fourth browser call that gives the form window the home's street, rooms and area, for its heading and its prefilled answers                                  | Claude alone; the 137 design said "three things only"                                           | Partly: the page could carry the same values                              | Keep, unless Patric strikes it                                      |
| The server door: the same form and viewing-time calls for a site's own server, with the customer's secret token                                                | The 130 design; Claude kept it after 137 a made the form window the only form                   | No: nothing calls it                                                      | Cut; its tests move to the browser door                             |
| The outcomes table: each form's id, kind, home and what the CRM answered, never the person, kept 30 days                                                       | The 130 design                                                                                  | Yes: it makes a double click send one form, and it feeds the health check | Keep                                                                |
| The bot check (Turnstile)                                                                                                                                      | Patric, 138 a                                                                                   | Yes, before forms go live                                                 | Keep, and it refuses forms while its keys are missing (known bug 4) |
| The form window remembers the visitor's name, e-mail and phone in their own browser after a sent form, with a "Glöm mig" link                                  | Claude alone; written into the strategy as a "Default" on 2026-10-04, never put in the register | No                                                                        | Cut                                                                 |
| The limits: 60 forms a minute per customer, 10 a minute per visitor, 20 seconds to wait for the CRM, and a form sent twice answers the first outcome for a day | The 60 was in the 130 design; the rest Claude, as tuning                                        | Yes, as protection                                                        | Keep                                                                |
| Core's web process waits for the CRM's answer while the visitor waits                                                                                          | Named as a departure in the 130 design                                                          | Yes                                                                       | Keep                                                                |
| The Vitec mapping: the valuation request, the interest, the booking and the search profile                                                                     | Patric, 130, 131 and 141 a                                                                      | Yes                                                                       | Keep; a booking keeps Vitec's e-mail confirmation on, as today      |
| Two data shapes (schemas), two members of the adapter interface, acceptance criteria 43 to 49                                                                  | Patric, 130 and "Go"                                                                            | Yes                                                                       | Keep                                                                |
| The WordPress plugin's "Site key" setting and the script tag it prints                                                                                         | Patric, 137 a                                                                                   | Yes                                                                       | Keep; the plugin's, not Core's                                      |

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
two doors for forms (about 640 lines) and the two
data shapes (about 250 lines); the Vitec adapter's forms take about 500 more. The admin
area's own share is about 140 lines, most of them the fields' help texts; what makes it look
heavy is nine fields and two lines on the tenant page.

## What else was missed

1. `[core]` **Saving one forms field on a Vitec connection erases the Vitec login** (known bug
   3). The eight forms fields are stored inside the connection's login, which the admin area
   never shows back and replaces whole when anything is typed. A test on 2026-10-05 stored a
   login, typed only "yes" in "Send forms to Vitec" and saved: what remained was
   `{"send_forms":"yes"}`, and the username and password were gone. The same page cannot show
   whether the switch is on, and it draws the yes-or-no fields as free text, so "Yes" with a
   capital letter counts as no.
2. `[core]` **The bot check is off whenever its keys are missing** (known bug 4). Patric decided
   the check is on from the first form (138); the build lets every form through when
   `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET` are unset, which is the case on staging and live
   today. The 2026-10-04 reply mentioned it as a note, not as a question.
3. `[crm-vitec]` **No form has reached a real Vitec.** Every call ran against the test stand-in;
   the first real send waits on a demo or test customer from Vitec (54 f).
4. `[core]` **A customer with several offices cannot receive the free valuation.** The footer's
   button names no office, and Core refuses a valuation without one for such a customer. It is
   written down as "later", with no question asked.
5. `[core]` **No fresh-eyes review before "done".** The handbook asks a second agent with no
   memory of the build to check every change against the decision that asked for it before the
   owner sees it. The forms build's checklists and saved changes show no such step, unlike the
   search work of the same day.
6. `[core]` **Register numbers and notes in the admin area.** "(question 54 f)", "(Patric,
   2026-10-04)" and "(docs/forms.md)" stood in the switch's help and in the Vitec page's
   directions. They were removed on 2026-10-05.

## The other changes of 2026-10-03 and 2026-10-04

- `[core]` Core's engine changed once more in those two days, for Patric's answer 119
  (percentages keep every decimal). Nothing else in the engine, the admin area or the Vitec
  adapter was decided alone.
- `[client-wordpress]` Of the 54 decisions written down on those two days, 49 cite Patric's
  word, a closed question or an unopposed Default. A citation is not the whole story: the forms
  build's lines cite his decisions and still carry the additions above. Of the five without one,
  one is the forms build's door (above), one is operational (a refused Cloudways login), and two
  follow work Patric asked for: the bids display from his punch list, and the list blocks' place
  from the search design.
- `[client-wordpress]` The fifth was a choice made alone that Patric already corrected: the
  search box was first built as our own box instead of a market-leading library, and he chose
  Tom Select (140 a).
- `[core]` Two ideas in the forms strategy were written as "Defaults" but never put in the
  register: the visitor remembered in the browser (built) and a page of form counts per page and
  campaign (not built).

## How to solve it (question 144)

- **a) Cut to the minimum (recommended).** Removed: the eight fields on every Vitec connection,
  the addresses field on every site, the count line under every connection, the server door and
  the visitor's memory in the browser. Changed: the safety switch becomes one setting of the
  staging environment, so staging sends no form to any CRM and live sends; the bot check
  refuses forms while its keys are missing; the Vitec directions shrink to one sentence. Kept:
  everything else in the tables above marked "Keep". When the test customer of 54 f exists, the
  same staging setting can name it, so the first real send can run from staging. The admin area
  is left with one line per site (the site key), one health check and the event lines. The
  acceptance tests move from the server door to the browser door, which is a change to a
  protected path that this answer approves.
- **b) Hide.** Everything stays, and the forms fields fold into a closed "Advanced" box on the
  connection. The two defects are fixed. No code goes, and the parts nobody asked for stay.
- **c) Start over.** The whole forms build leaves Core, the site's buttons fall back to the
  agent card, and each part comes back only after its own question. It costs the evening's work
  and the forms come back only as fast as each part is asked and built again.

Recommended: a. It keeps every decision Patric made, removes what nobody asked for, fixes the
two defects and leaves Core smaller, and what remains is the "Keep" list above, which he can
read and strike from in one reply.

A later idea, not part of a: the plugin could fetch its site key from Core with the customer's
token it already holds, so nobody copies the key and the site key line leaves the admin area too.

## A rule so it does not happen again (question 145)

The handbook already says architecture is decided, not drifted into, and that a reviewer
rejects any change no decision asked for. The forms build slipped through one gap: it treated
"approved with 130" as approval of everything written in a long design, and added more during
the build. The proposed addition to `AGENTS.md`, under "Stop and ask" (a protected file, so it
needs Patric's yes):

> - anything new that a person sees in the admin area (a page, a section, a field, a setting, a
>   line) or that runs in Core (a web address, a table or column, an event, a health check, an
>   environment setting, an outside service), even when it follows from an approved design: an
>   approval covers only what its question named, and anything else is its own register question
>   with options before it is built (Patric, 2026-10-05: "you should have asked me about those").
>   Text a user reads (the admin area, the form window, Core's answers to sites) never cites a
>   register number, a person, a date or an internal document (Patric, 2026-10-05: "that
>   certainly does not belong in production").

The same rule could hold for every repository; if Patric wants that, it goes into the handbook
in a session on the handbook's own repository.
