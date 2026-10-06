# Known bugs

Things that are wrong and known, each with what happens, why, and what fixing it takes. An entry
leaves this file when the fix is live, with a line in `docs/decisions.md`. Numbers are never
reused. A known bug is not an open question: nobody has to decide anything, someone has to do it.

## 1. `[crm]` The burst test races the fake CRM's timer, and no adapter states its burst window

**What happens.** `acceptance/adapters.test.ts`, "absorbs a burst of webhooks without a fetch per
webhook", sends a hundred notifications for one record to the fake webhook adapter and then counts
what waits on its fetch list, expecting one entry. The fake adapter drains that list on a timer of
its own every 50 ms. On a busy machine the hundred notifications take longer than that, the list
has been drained by the time the test counts, and the test fails although Core did exactly the
right thing: one fetch, not a hundred. Seen once on 2026-09-21 under the full parallel run; every
run after passed.

**Why.** Both adapters already collapse a burst: the fake keeps a record listed twice once (a map
keyed by the record), and Vitec does the same in its `vitec_fetch_list` table (one row per record,
`on conflict … do nothing`). What neither states is the _window_: how long a burst is allowed to
gather before the fetch goes out. The fake's 50 ms and Vitec's 250 ms are internal constants, not
a requirement anyone wrote down, so a test has nothing to hold still and nothing to assert against.
Strategy §5.1 now says what a CRM must do (Patric, 2026-09-21: act near-immediately, batch a burst,
never forever); the adapters do it, but do not say so.

**What fixing it takes.** In each adapter, the burst window becomes a named, bounded setting with
its value in the adapter's README, and the fake adapter offers a way to hold its drain while a test
counts. The test then holds the window, sends the burst, counts one, releases the window and sees
one fetch. Four lines in the test, a handful in each adapter; `acceptance/` is a protected path, so
the change goes through review like any other. Out of scope of the admin-area session that found
it (Patric, 2026-09-21).

## 2. `[crm-vitec]` The homes' areas are missing from the areas the adapter lists, so their area pages do not exist

**What happens.** On the staging site (2026-10-04) the nine homes for sale name areas in Malmö
and Lund (Elinegård, Värnhem, Brunnshög, with ids like `SOM9918AD86…`), and none of those areas
is among the 56 areas the site holds; the area pages for them answer with the Områden index, and
until plugin 0.5.3 the search box offered no area at all, since it offered only areas with a
record.

**Why.** The adapter lists areas per office (`adapters/vitec/api.ts`, `list`), and the test
office's area list holds Ekerö, Helsingborg and a few Malmö areas, not the ones its marketed
estates name. Whether Vitec lists an estate's area under another office or customer, or the
test account's data is simply mixed, is not known.

**What fixing it takes.** Find out from Vitec Connect where an estate's area is listed when it
is not in its office's list (a question to Vitec, or a look at the list endpoints of the test
account), and fetch it from there; then the area pages exist and the box names the areas from
their records. The box and the pills already work without the records (plugin 0.5.3).

## 3. `[core]` Saving one forms field on a Vitec connection erases the connection's Vitec login

**What happens.** On the tenant page, the eight forms fields of a Vitec connection ("Send forms
to Vitec", the six Vitec choices, "CRM password") start empty, never show what is stored, and
draw their yes-or-no choices as free text. Typing one of them and saving replaces the stored
login with only what was typed: a test on 2026-10-05 stored a username and a password, typed
"yes" in "Send forms to Vitec" and saved, and what remained was `{"send_forms":"yes"}`. The
connection then can no longer read Vitec. It works the other way too: typing a new Vitec password
erases all eight forms fields and quietly turns "Send forms to Vitec" back to no. "Yes" with a
capital letter counts as no, and "nej" or a typo in "Confirm a booking by e-mail" counts as yes.

**Why.** The admin area never sends a stored login to the browser, and a save keeps only the
fields that were typed (`engine/admin/tenants.ts`, `credentialsOf`), replacing the whole stored
document. That was already true before the forms: typing only a new Vitec password lost the
username. The forms build put its eight settings into the same document
(`adapters/vitec/forms.ts`, `settingsOf`).

**Fixed on staging 2026-10-06** (the Vitec office build, `engine/admin/login.ts`): a save, and
"Check the login", put the typed fields over the stored ones, so typing one field no longer loses
the others; `acceptance/admin.test.ts` proves it. What remains is the forms fields' own: they show
nothing stored, draw their choices as free text and read "Yes" with a capital as no. The entry
leaves this file when the fix is on production.

**What fixing it took.** A save keeps every stored field that was not typed. With question 144
a, seven of the eight fields go and only the CRM password stays in the login; with b, the
settings also leave the login, show their stored values and draw their choices. Until then,
nobody types into those fields.

**The rest fixed on staging 2026-10-06** (the forms' first version, question 155 line 5): the
seven forms fields left the Vitec connection, so nothing about forms is typed there and the
fields that showed nothing stored and read "Yes" as no are gone. The CRM password left the
connection too on 2026-10-06 (Patric: a Vitec connection has one username and one password, used
for every call). The guard of question 152
replaces "Send forms to Vitec": only the live service hands a form to the CRM. The entry leaves
this file when the fix is on production.

**The stored values of the seven fields** (question 174, yes). A save drops a stored field the
login form no longer has, but a login nobody saves keeps them. So the worker removes exactly those
seven keys from every stored Vitec login when it starts (`main.ts`, `removeLoginFields` in
`engine/admin/login.ts`) and logs "removed the old forms fields from N stored login(s)". Staging
logged 0 on 2026-10-06. The step ships with the next release and comes out in the first commit
after production's worker log shows that line.

## 4. `[core]` The forms' bot check lets every form through when its keys are missing

**What happens.** With `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET` unset, which is the case on
staging and live on 2026-10-05, Core accepts a form without any bot check (`engine/human.ts`,
`verifyHuman` answers true when no check is set up). Patric decided the check is on from the first
form, with a hidden trap field, a minimum time and the limits always on as Core's own measures
(138). A program posting straight to Core then meets only the limits: the build checks the trap
field and the minimum time only in the form window, not in Core, so such a program skips them; the
limit per visitor reads the first address of the `X-Forwarded-For` header, which a sender can write
to, and whether the hosting platform cleans that header is not checked (`engine/http/forms.ts`,
`addressOf`); and a program can use up the customer's 60 forms a minute, so real visitors are
refused. The Settings page of the admin area does not list the two keys, so nobody sees that they
are missing.

**Why.** The build made "no keys" mean "no check", so the local tests need no Cloudflare
account, and the same rule holds in every environment.

**What fixing it takes.** Core refuses a form while the keys are missing (the tests give Core a
stand-in check instead), checks the trap field and the minimum time itself as 138 decided, without
changing the form's data shape, reads the visitor's address the way the hosting platform documents,
and the Settings page lists the two keys; the two keys go into the staging and live environments
before the first form goes live. Done with question 144's answer.

**Fixed on staging 2026-10-06** (the forms' first version, `engine/http/submissions.ts`): the live
service refuses every form while the keys are missing (503, reported to the error tracker), and
with the keys every form needs the proof its window earned (403 without it), checked before
Core's limit, so a program without a proof neither reaches the CRM nor uses up the customer's 60 a
minute; the tests give Core a stand-in check. The browser's door is gone, and with it the limit
per visitor address and the header it read. What remains: the two keys are in no environment yet
(they come with each site's address on Cloudflare's list), and the Settings page does not list
them, which needs a question before it is built. The trap field and the minimum time stay in the
window only; a program that skips them still needs the bot check's proof. The entry leaves this
file when the fix is on production.

## 6. `[client-wordpress]` The WordPress test site in a cloud session answers a critical error, so the WordPress suites cannot run there

**What happens.** On 2026-10-06, in a cloud session whose start hook reported "WordPress prepared",
`npm run test:wordpress` failed 17 of 21 template tests and the WordPress browser journeys: every
page the tests fetch came back empty or as WordPress's "There has been a critical error on this
website", and a `wp eval` call died with a PHP fatal (`array_keys(): Argument #1 must be of type
array, null given`). The sync suite against Core passed 20 of 21; the one failure is the must-use
updater offering a release (AC 21), which reads the same site. The engine's own suites, the admin
area's journeys and the acceptance tests all passed in the same session, so the acceptance report
was not regenerated there: it would have recorded the site's state as Core's.

**Why.** Not established. The PHP side of the prepared site is at fault, not Core: Core answered
every pull. Likely the prepared WordPress install or its PHP does not match what the theme
"Kowboy 2026" and the plugin now need.

**What fixing it takes.** Run `clients/wordpress/test/setup.sh` by hand in a cloud session and read
the PHP error log, then fix the start hook or the setup script so the site renders; regenerate
`acceptance/report.md` where the WordPress suites run.
