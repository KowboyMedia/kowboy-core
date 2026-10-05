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
connection then can no longer read Vitec. "Yes" with a capital letter counts as no.

**Why.** The forms build stored its settings inside the connection's login document
(`adapters/vitec/forms.ts`, `settingsOf`), which the admin area never sends to the browser and
replaces whole when anything is typed (`engine/admin/tenants.ts`, `credentialsOf`).

**What fixing it takes.** Question 144 decides: with a the eight fields go and the bug with them;
with b the settings leave the login document, show their stored values and draw their choices.
Until then, nobody types into those fields.

## 4. `[core]` The forms' bot check lets every form through when its keys are missing

**What happens.** With `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET` unset, which is the case on
staging and live on 2026-10-05, Core accepts a form without any bot check (`engine/human.ts`,
`verifyHuman` answers true when no check is set up). Patric decided the check is on from the
first form (138).

**Why.** The build made "no keys" mean "no check", so the local tests need no Cloudflare account,
and the same rule holds in every environment.

**What fixing it takes.** Core refuses a form while the keys are missing, except in the test
setup, and the two keys go into the staging and live environments before the first form goes
live. Done with question 144's answer.
