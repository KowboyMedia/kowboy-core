# Admin texts: Forms (draft for review)

Files read: AGENTS.md; docs/admin-panel.md; docs/forms.md (terms, "Built 2026-10-06", the short retry); docs/decisions.md and docs/next-steps.md (the forms lines, 160, 165, 172); docs/open-questions.md (165, 166); admin/src/pages/forms.tsx; engine/admin/forms.ts; engine/http/submissions.ts; engine/admin/index.ts; engine/storage/submissions.ts; engine/registry.ts; engine/health.ts; engine/admin/summary.ts; engine/alerts.ts; engine/attention.ts; engine/admin/overview.ts; admin/src/pages/overview.tsx; admin/src/pages/tenant.tsx; engine/admin/tenants.ts; engine/admin/audit.ts; engine/admin/records.ts; engine/admin/crms.ts; engine/admin/http.ts; engine/admin/pages.ts; engine/admin/words.ts (in the working tree, another thread's, not committed); admin/src/lib/api.ts, scope.ts, format.ts; admin/src/components/confirm.tsx, empty.tsx; admin/src/pages/events.tsx; engine/adapter-api/types.ts; adapters/vitec/forms.ts and api.ts; the theme's form window (assets/kowboy-2026.js, parts/form-window.php) and the plugin's receiver (core-client/includes/forms.php); acceptance/submissions.test.ts, acceptance/criteria.json, admin/e2e/journeys.spec.ts. Texts examined: 72. Texts that fail: 48.

Every target fits question 165 as answered on 2026-10-06 (commit 417d91b): the CRM's code tries a form again only within the form's 15 seconds, the visitor then sees the error, and Failed forms with Send again stays. No target says that Core tries a form later, or that the visitor was told the form was received.

## engine/health.ts (another thread's file; the tile is drawn by admin/src/pages/overview.tsx and the mail by engine/alerts.ts)

### Check `submissions.failing`, its name as the tile's title · Overview, check tile; alert mail
- Now: "submissions.failing"
- Target: "Sending forms to the CRMs"
- Why: 2, the check's name stands where its title belongs.
- Needs: a line in the title map the Overview's thread builds for the checks (overview.tsx draws `name` today).

### `submissions.failing` detail · Overview, check tile; alert mail; the public health answer
- Now: "1 connection(s) whose latest form submission the CRM did not answer"
- Target: one connection: "The last form a visitor sent through one CRM connection could not be sent. Send that form again on Failed forms once the cause shown there is fixed. The check turns green when the CRM answers a form through that connection." Several: "The last form a visitor sent through each of {n} CRM connections could not be sent. Send those forms again on Failed forms once the cause shown there is fixed. The check turns green when the CRM answers a form through every one of those connections." Rendered (n = 3): "The last form a visitor sent through each of 3 CRM connections could not be sent. Send those forms again on Failed forms once the cause shown there is fixed. The check turns green when the CRM answers a form through every one of those connections."
- Link: the tile to Failed forms (`/forms`), as "Go to Failed forms".
- Why: 1 and 4: no meaning and no next step, "connection(s)", and "did not answer" is wrong for an error answer, which turns the check red too.
- Needs: `submissions.failing` in the Overview's `WHERE` map, to `/forms` (overview.tsx, another thread's). The detail stays free of names, because `/v1/health` shows it to anyone.

### `submissions.failing` names · Overview, check tile; alert mail
- Now: "vitec-2"
- Target: "{tenant}'s {CRM} connection, short name {short name}", one per connection. Rendered: "Kowboy test account's Vitec connection, short name vitec-2"
- Link: each to its block on the tenant's page, `/tenants/{tenant id}#connection:{short name}`; in the mail the whole address, `https://staging.core.kowboy.cloud/admin/tenants/1#connection:vitec-2` (the tenant number is illustrative).
- Why: 2 and 3: a short name alone, with no tenant and no link.
- Needs: the tenant's id and name and the CRM for each short name. A protected test pins `names` to the short names (acceptance/submissions.test.ts: `red?.names` equals `[CONNECTION]`), so the smallest way keeps `names` as they are and has the Overview and the alert look each one up, as engine/attention.ts already does for a connection (`tenantOf`), with the CRM written by `crmName` (engine/admin/words.ts). Changing `names` itself needs approval for that test.

### The check turning red and green again · Events; alert mail (the frame is summary.ts's and alerts.ts's)
- Now: "the check submissions.failing turned red: 1 connection(s) whose latest form submission the CRM did not answer (vitec-2)"; "the check submissions.failing is green again"
- Target: red: "Sending forms to the CRMs turned red. {detail}", then in the mail one line per connection, "{name}: {address}". Rendered: "Sending forms to the CRMs turned red. The last form a visitor sent through one CRM connection could not be sent. Send that form again on Failed forms once the cause shown there is fixed. The check turns green when the CRM answers a form through that connection." and "Kowboy test account's Vitec connection, short name vitec-2: https://staging.core.kowboy.cloud/admin/tenants/1#connection:vitec-2". Green: "Sending forms to the CRMs is green again. Each CRM answered the last form sent through its connection."
- Link: the connection lines as above; Failed forms in the mail as `https://staging.core.kowboy.cloud/admin/forms`.
- Why: 2 and 4: the check's name, "connection(s)", and a short name in brackets with no tenant.
- Needs: the title and the names lookup above, in the thread that owns summary.ts and alerts.ts.

## engine/admin/summary.ts (another thread's file)

### `FORMS['lead']` · every form sentence: a home's timeline, Events
- Now: "a lead", as in "the CRM refused a lead: …"
- Target: "a valuation or contact request"
- Why: 2: Failed forms calls the same form "Valuation or contact request", so one thing has two words.

### `FORMS` fallback · the same sentences
- Now: "a form submission"
- Target: "a form"
- Why: 4: "submission" is a word the reader would have to ask about.

### `'submission.received'` · a home's timeline, Events
- Now: "a visitor sent an interest in the home through a site"
- Target: "A visitor sent {form} from the site {site name}." Rendered: "A visitor sent an interest in the home from the site v4-staging (Cloudways)." With no site known: "A visitor sent an interest in the home from one of the tenant's sites."
- Link: the site to its block on the tenant's page, `/tenants/{tenant id}#site:{site id}`.
- Why: 2 and 4: the site is not named, and the line is not a whole sentence.
- Needs: the site's name. The event row carries the site's number (`subscriber_id`), but `summarise()` reads only the fields, so the caller looks the site up by that number, as the Overview's site rows do.

### `'submission.delivered'` · a home's timeline, Events
- Now: "the CRM took a lead (C-2)" (the id as in the tests)
- Target: with an id: "{Form} was delivered to the CRM, which gave it the id {id}." Without one: "{Form} was delivered to the CRM." Rendered: "A valuation or contact request was delivered to the CRM, which gave it the id C-2."
- Why: 2 and 4: an id in brackets with nothing saying whose it is, and "took" where the area says "delivered".

### `'submission.refused'` · a home's timeline, Events
- Now: on staging, "the CRM refused an interest in the home: Det här är en testsida, så formuläret skickades inte vidare till mäklaren."; on production, "the CRM refused a viewing booking: Visningen är fullbokad" (the CRM's words as in the Vitec tests)
- Target: refused by the CRM: "The CRM refused {form}, with the reason “{reason}”." With no reason: "The CRM refused {form} and gave no reason." Held back: "Core held back {form}, since only production sends forms to a CRM." Rendered: "The CRM refused a viewing booking, with the reason “Visningen är fullbokad”." and "Core held back an interest in the home, since only production sends forms to a CRM."
- Link: Failed forms (`/forms`), while the form is kept.
- Why: 5: on staging it says the CRM refused a form Core never sent, in a sentence written for the visitor.
- Needs: telling the held-back form apart. Its reason is Core's own sentence `NOT_LIVE` (engine/registry.ts), so `summarise` compares `reason` with it; no new field.

### `'submission.failed'` · a home's timeline, Events
- Now: "the CRM did not answer an interest in the home: the CRM did not answer within 20 s"; from Vitec, "the CRM did not answer a lead: unavailable: v2/Advertising/Form/M30011/Valuation: HTTP 503 Service Unavailable"
- Target: "{Form} could not be sent to the CRM: {cause}." With no cause: "{Form} could not be sent to the CRM, and no cause was recorded." Rendered: "A valuation or contact request could not be sent to the CRM: Vitec was down or busy and did not take the form."
- Link: Failed forms (`/forms`), while the form is kept.
- Why: 4 and 5: "did not answer" twice, wrong when the CRM answered with an error, and the cause is code.
- Needs: the cause in words from the CRM's code (below, "The Vitec code's failure words").

### `ADMIN` has no `form_sent_again` · Events, a home's timeline
- Now: "patric@kowboy.se form sent again"
- Target: "{person} sent a form to the CRM again". Rendered: "patric@kowboy.se sent a form to the CRM again"
- Why: 4: not a sentence, because the fallback reads the event's type as words.
- Needs: one line in `ADMIN`, `form_sent_again: 'sent a form to the CRM again'`. The CRM's answer is the `submission.*` sentence that follows it.

## admin/src/pages/tenant.tsx

### The forms line under each connection · a tenant's page, connection block
- Now: on production, "Forms, last day: 3 delivered · 0 refused by the CRM · 1 unanswered by the CRM"; on staging, "Forms, last day: 0 delivered · 4 refused by the CRM · 0 unanswered by the CRM"
- Target: with no forms: "No visitor sent a form through this connection in the last 24 hours." Otherwise: "Forms in the last 24 hours: {parts}." The parts, in this order and only when not zero: "{n} delivered", "{n} refused by the CRM", "{n} could not be sent", "{n} held back because this is not production", with "none delivered" first when none was. Then, when any form was not delivered: "Forms not delivered are on Failed forms." Rendered: "Forms in the last 24 hours: 3 delivered, 1 could not be sent. Forms not delivered are on Failed forms." On staging: "Forms in the last 24 hours: none delivered, 4 held back because this is not production. Forms not delivered are on Failed forms."
- Link: "Failed forms" to `/forms`.
- Why: 4 and 5: dots stand in for words, "last day" is vague, "unanswered" is wrong for an error answer, and on staging "refused by the CRM" counts forms the CRM never saw.
- Needs: the held-back forms counted apart: `submissionCounts` counts the refusals whose `detail` is `NOT_LIVE` on their own.

### The forms line's `title` · tooltip on that line
- Now: "Forms visitors sent through Core to this CRM in the last day, by what the CRM answered. The visitor is never stored here."
- Target: no tooltip, since the line says it. If one stays: "What became of the forms visitors sent through this connection in the last 24 hours. Core keeps what a visitor wrote until the form is delivered, and for 30 days when it is not."
- Why: 5: "The visitor is never stored here" has not been true since 160 a: Core keeps what the visitor wrote, encrypted, until the CRM takes the form, and 30 days when it does not. docs/admin-panel.md says the same ("The visitor is never stored in Core") and needs the same fix.

## admin/src/pages/forms.tsx

### `PageHeader` `what` · Failed forms, the page's description
- Now: "Forms visitors sent that the CRM refused or did not answer, newest first. Core keeps each one for 30 days from when it was sent, with what the visitor wrote, so it can be sent again. A form the CRM takes leaves this list."
- Target: "Forms that visitors sent from a site but that were not delivered to the CRM, newest first. Until a form is sent again and delivered, the brokerage may not have that request. Core keeps what each visitor wrote for 30 days from when the form was sent, then deletes it. A form Core turned away before sending it, for example while its connection was paused, is not kept and does not show here."
- Why: 1 and 5: it does not say what a missing form means for the brokerage, it says "the CRM refused" for forms Core held back on staging, and it lets a reader think every lost form is here.

### `Empty` · Failed forms, empty list
- Now: "No form is waiting. When the CRM refuses a form or does not answer, the form is listed here with what the visitor wrote."
- Target: "No form is waiting to be sent again, so nothing needs doing. A form that is not delivered to the CRM shows up here for 30 days, with what the visitor wrote."
- Why: 1: it does not say what the form would wait for, nor that nothing needs doing.
- Needs: the page shows this text also when the list could not be read (it never looks at `query.isError`), so a failed read says nothing is waiting. That case needs its own words: "Core could not read the failed forms just now. Reload the page."

### `forms-count` · Failed forms, above the cards
- Now: "3 form(s) the CRM did not take."
- Target: one: "One form from the last 30 days was not delivered." Several: "{n} forms from the last 30 days were not delivered." Rendered: "3 forms from the last 30 days were not delivered."
- Why: 4: "form(s)".

### `KINDS['interest']` · card title
- Now: "Interest"
- Target: "Interest in a home"
- Why: 2 and 5: on its own the word can mean anything, and the event log says "an interest in the home".

### `OUTCOMES['refused']` · card badge
- Now: "Refused", on every card on staging
- Target: refused by the CRM: "Refused by the CRM". Held back: "Held back".
- Why: 5: on staging Core held the form back, and the CRM never saw it.
- Needs: engine/admin/forms.ts returns a held-back form as an outcome of its own, for example `held`, when its `detail` is Core's own `NOT_LIVE` (engine/registry.ts). It is one more value of a field the page already reads.

### `OUTCOMES['failed']` · card badge
- Now: "No answer"
- Target: "Could not be sent"
- Why: 5: the CRM may have answered with an error, such as a refused login or an answer that could not be read. "No answer" stays right for `unanswered`.

### `CardDescription` · card, under the title
- Now: "Kowboy test account, sent 2026-10-06 18:42:10"
- Target: "Sent {date} from the site {site name}, through {tenant}'s {CRM} connection, short name {short name}." With no site known: "Sent {date} through {tenant}'s {CRM} connection, short name {short name}." Rendered: "Sent 2026-10-06 18:42:10 from the site v4-staging (Cloudways), through Kowboy test account's Vitec connection, short name vitec-2."
- Link: the connection to `/tenants/{tenant id}#connection:{short name}`, where a paused connection or a refused login is fixed; the site to `/tenants/{tenant id}#site:{site id}`.
- Why: 2 and 3: the connection the form went through is not named, and nothing links.
- Needs: the CRM: `keptSubmissions` joins `connections` for `provider`, written by `crmName`. The site: the form's `submission.received` event carries `subscriber_id`, and forms.ts can read that event by the form's id, which is its correlation id.

### `why()`, outcome `unanswered` · card, line "Why"
- Now: "Core stopped before the CRM answered."
- Target: "Core was interrupted, for example by a restart, before the CRM answered. The CRM may or may not have the form."
- Why: 1: it does not say what that means, which is that the brokerage may already have the form.

### `why()`, outcomes `refused` and `failed` · card, line "Why"
- Now: the stored words as they are. On staging: "Det här är en testsida, så formuläret skickades inte vidare till mäklaren." From Vitec: "unavailable: v2/Advertising/Form/M30011/Valuation: HTTP 503 Service Unavailable". From Core: "the CRM did not answer within 20 s".
- Target: refused by the CRM: "The CRM refused the form, with the reason “{reason}”." Held back: "Held back: only production sends forms to a CRM, so Core kept this form here. Nothing needs doing." Could not be sent: "The form could not be sent: {cause}." Rendered: "The CRM refused the form, with the reason “Visningen är fullbokad”." and "The form could not be sent: Vitec refused Core's login for this office."
- Why: 2 and 4: the line is the stored text with no sentence of its own: on staging a Swedish sentence written for the visitor, from Vitec a call's path and a status code.
- Needs: the held-back outcome (above) and the causes in words (below). The journey "failed forms" (admin/e2e/journeys.spec.ts) reads "Det här är en testsida" here and changes with it.

### `why()`, nothing stored · card, line "Why"
- Now: "Nothing was said."
- Target: refused by the CRM: "The CRM refused the form and gave no reason." Could not be sent: "The form could not be sent, and no cause was recorded."
- Why: 2: it does not say who said nothing.

### Line "The home" · card
- Now: "OBJ31529_2041198534", as a link
- Target: "{address or name}, the CRM's id {id}". Rendered: "Storgatan 12, Lidingö, the CRM's id OBJ31529_2041198534"
- Link: the home's record, `/records/{connection}/property/{id}`, as now.
- Why: 2: the home is named by its id alone.
- Needs: the home's address: `keptSubmissions` left-joins `items` on the form's tenant, connection, entity type and id, and reads the address line as Records does (`displayLine` in engine/admin/records.ts). The journey "failed forms" finds the link by the name "OBJ-1" and changes with it.

### Line "Office" · card
- Now: "Lidingö (M30011)", or "—" with no office (the working tree is changing the first to "Lidingö (office id M30011)")
- Target: "{office name}, the CRM's office id {office id}". With no name known: "The CRM's office id {office id}". With no office: "Not known". Rendered: "Lidingö, the CRM's office id M30011"
- Link: Records for that office, `/records?tenant={tenant id}&office={office id}`.
- Why: 2, 3 and 4: brackets and a dash stand in for words, and nothing links.
- Needs: `officeLabel` (admin/src/lib/scope.ts, another thread's, being edited now) holds the words; the page passes `row.tenantId` to it, so an office id that two tenants share takes this tenant's name.

### Line "Viewing time booked" · card
- Now: "Viewing time booked: T-1" (the CRM's id for the time; "T-1" as in the tests)
- Target: label "Viewing time chosen"; value "the CRM's id {id}". Rendered: "Viewing time chosen: the CRM's id T-1"
- Why: 5: "booked" is wrong, since the booking did not go through, and the reader needs a time where an id stands.
- Needs: a decision. The form carries only the time's id (schemas/submission.v1.json, protected), so showing the time needs the window to send the chosen time with the form (a schema change) or the page to ask the CRM for the home's times (one CRM read per card). Either is a register question.

### `criteriaText` · card, line "Search profile" (shown only for a search profile, which the window does not ask for while question 151 is open)
- Now: "type holiday_house, at least 3 rooms, at least 60 m², in Lidingö, Danderyd", or "Anything"
- Target: "{A type of home, or Any home}, at least {n} rooms, at least {n} m², in {areas}", the types written "apartment", "house", "holiday home" and "plot", the areas joined as "A, B and C". With no wishes: "Any home, anywhere". Rendered: "A holiday home, at least 3 rooms, at least 60 m², in Lidingö and Danderyd"
- Why: 2: the type is shown as its code value.

### Line "Consent given" · card
- Now: "Consent given: 2026-10-06 18:41:55"
- Target: label "Agreed to be contacted"; the time as now. Rendered: "Agreed to be contacted: 2026-10-06 18:41:55"
- Why: 5: the reader has to guess what was agreed to. The box the visitor ticked agrees to be contacted by the agent under the privacy policy.

### Line "Sent from" · card
- Now: "Sent from: https://wordpress-1545003-6698706.cloudwaysapps.com/objekt/till-salu-lidingo-storgatan-12-obj31529_2041198534/", as plain text
- Target: label "Sent from the page"; the same address as a link.
- Link: the page itself, opened in a new tab.
- Why: 3: an address that is not a link.

### Line "Campaign" · card
- Now: "utm_source: facebook, utm_medium: social, utm_campaign: hostkampanj"
- Target: label "Campaign tags"; each tag as "{name} {value}", with `utm_source` written "source", `utm_medium` "medium", `utm_campaign` "campaign", `utm_term` "term", `utm_content` "content", and any other tag without its `utm_` and with spaces for underscores. Rendered: "source facebook, medium social, campaign hostkampanj"
- Why: 2: the tags' keys are code.

### Line "Form id" · card
- Now: "Form id: 3f8e2c1a-5b7d-4e9f-a1c2-7d6e5f4a3b2c"
- Target: label "Core's id for the form"; value "{id}. Every step of this form is on Events." Rendered: "3f8e2c1a-5b7d-4e9f-a1c2-7d6e5f4a3b2c. Every step of this form is on Events."
- Link: "Every step of this form is on Events" to `/events?correlation={id}`, the form's chain, where each try and the CRM's answer to it are.
- Why: 2 and 3: whose id it is goes unsaid, and the id opens nothing.

### Explanation beside "Send again" · card
- Now: "Sends this form to the CRM again. Press it once the reason above is dealt with, for example when the CRM answers again."
- Target: "Sends this form to the CRM once more, through {tenant}'s {CRM} connection, as the visitor filled it in, and shows the CRM's answer. Press it once the cause above is fixed. If the cause cannot be fixed, leave the form, and Core deletes the form 30 days after the visitor sent it." Held back: "Sends this form to the CRM once more. Only production sends forms to a CRM, so here Core holds the form back again." Rendered: "Sends this form to the CRM once more, through Kowboy test account's Vitec connection, as the visitor filled it in, and shows the CRM's answer. Press it once the cause above is fixed. If the cause cannot be fixed, leave the form, and Core deletes the form 30 days after the visitor sent it."
- Why: 1 and 5: "when the CRM answers again" gives the reader nothing to look at, and on staging a press can only be held back again.
- Needs: the CRM and the held-back outcome (above). The journey "failed forms" reads "Sends this form to the CRM again." and changes with it.

### `Confirm` `what` · the question before "Send again"
- Now: "Core sends the form to the CRM of Kowboy test account once more, as the visitor filled it in, and shows the CRM's answer. If the CRM took it the first time without answering, it may get it twice."
- Target: could not be sent, or no answer: "Core sends this {kind} to the CRM once more, through {tenant}'s {CRM} connection, as the visitor filled it in. The brokerage may get the {kind} twice. The CRM may have taken the first send without Core hearing back. The visitor may also have sent the form again after being told that it did not go through." Refused by the CRM: the same without the third sentence. Held back: "Only production sends forms to a CRM, so here Core holds the form back again." Rendered: "Core sends this interest in a home to the CRM once more, through Kowboy test account's Vitec connection, as the visitor filled it in. The brokerage may get the interest in a home twice. The CRM may have taken the first send without Core hearing back. The visitor may also have sent the form again after being told that it did not go through."
- Why: 4: "it" stands for the form and for the CRM in one clause, and the other way to a double, the visitor's own new try after the error, is missing.

### Toast after a delivered send · toast
- Now: "The CRM took the form, as C-2." or "The CRM took the form."
- Target: "Delivered to the CRM, which gave the form the id {id}. The form leaves this list." Without an id: "Delivered to the CRM. The form leaves this list." Rendered: "Delivered to the CRM, which gave the form the id C-2. The form leaves this list."
- Why: 2: "as C-2" does not say whose id it is.

### Toast after a refused send · toast
- Now: on staging, "Refused again: Det här är en testsida, så formuläret skickades inte vidare till mäklaren."; on production, "Refused again: Visningen är fullbokad"
- Target: refused by the CRM: "The CRM refused the form again, with the reason “{reason}”. The form stays on this list." Held back: "Held back again: only production sends forms to a CRM. The form stays on this list." Rendered: "The CRM refused the form again, with the reason “Visningen är fullbokad”. The form stays on this list."
- Why: 5: on staging it says refused for a form the CRM never saw, in the visitor's Swedish sentence.
- Needs: the held-back outcome in the answer of "Send again", made in the admin route (engine/admin/index.ts) so a site's answer stays as it is. The journey "failed forms" reads "Refused again:" and changes with it.

### Toast after a send that could not be sent again · toast
- Now: "The CRM did not answer again: unavailable: v2/Advertising/Form/M30011/Valuation: HTTP 503 Service Unavailable"
- Target: "The form could not be sent again: {cause}. The form stays on this list." Rendered: "The form could not be sent again: Vitec was down or busy and did not take the form. The form stays on this list."
- Why: 4 and 5: "did not answer" is wrong for an error answer, and the cause is code.
- Needs: the causes in words (below).

## engine/admin/forms.ts: the reasons it hands the page

### `NOT_LIVE` (engine/registry.ts) as the admin area shows it · line "Why", toast, event log
- Now: "Det här är en testsida, så formuläret skickades inte vidare till mäklaren."
- Target: on the admin pages, never this sentence; the held-back words above instead, "Held back: only production sends forms to a CRM, so Core kept this form here. Nothing needs doing." The sentence stays as it is for the visitor.
- Why: 2: Swedish written for the visitor ("this is a test site"), where the reader needs to know that Core, not the CRM, stopped the form.
- Needs: the held-back outcome, from one comparison with `NOT_LIVE` in engine/admin/forms.ts, the admin route of "Send again", `submissionCounts` and `summarise`.

### The Vitec code's failure words (adapters/vitec/forms.ts and api.ts, the Vitec thread's) · line "Why", toast, event log
- Now: "unavailable: v2/Advertising/Form/M30011/Valuation: HTTP 503 Service Unavailable"; "unavailable: The operation was aborted due to timeout"; "unavailable: v2/Advertising/Form/M30011/Valuation: not sent, the form's time ran out"; "forbidden: Advertising/Estate/M30011/OBJ31529_2041198534/interest: HTTP 403 …"; "broken: v2/Advertising/Form/M30011/Valuation: broken JSON: …"; "no office (customer id) to send to"; "other: a interest without a home"
- Target: one cause each, written by the Vitec code as its `detail`:
  - down or busy (a 5xx or 429 answer): "Vitec was down or busy and did not take the form"
  - no connection, or no answer in time: "Vitec could not be reached in time"
  - the form's time ran out before a try: "the 15 seconds a form may take ran out before Vitec could be asked again"
  - a 401 or 403 answer: "Vitec refused Core's login for this office"
  - an answer that could not be read: "Vitec's answer could not be read, so Vitec may have the form"
  - no office: "Core found no office to send the form to"
  - no home, for an interest or a booking: "the form names no home"
  - Rendered in the line "Why": "The form could not be sent: Vitec refused Core's login for this office."
- Link: none here; the card's connection link is where a refused login is fixed.
- Why: 2 and 4: a failure kind, a call's path and a status code, which no reader outside the code can use.
- Needs: the Vitec thread's change. The path, the status and every try stay on the form's chain on Events as its `crm.call` events, so an engineer loses nothing.

## engine/http/submissions.ts and engine/admin/index.ts: the answers of "Send again"

All of these show as a toast. Each needs the same thing: `route` returns which case stopped it beside its words, so `sendAgain` words that case for the admin area with the tenant's name (`tenantById`) and the CRM's (`crmName`), while a site's answers keep their own words.

### `sendAgain`, no form kept (404) · toast
- Now: "Core keeps no such form."
- Target: "Not sent: Core no longer keeps this form. Either the CRM has taken the form since, or 30 days have passed since the visitor sent it."
- Why: 1: it does not say why the form is gone.

### `route`, the connection is paused (409) · toast
- Now: "Not sent: the connection is paused."
- Target: "Not sent: {tenant}'s {CRM} connection is paused. Resume the connection on {tenant}'s page and save, then send the form again." Rendered: "Not sent: Kowboy test account's Vitec connection is paused. Resume the connection on Kowboy test account's page and save, then send the form again."
- Why: 1 and 2: which connection is paused, and where to resume it, goes unsaid.

### `route`, the home's connection is not the tenant's (409) · toast
- Now: "Not sent: the record is not one of this tenant’s."
- Target: "Not sent: {tenant} no longer has the CRM connection that this form's home came through." Rendered: "Not sent: Kowboy test account no longer has the CRM connection that this form's home came through."
- Why: 2: "record" and "this tenant" are the code's words.

### `route`, no such record (409) · toast
- Now: "Not sent: no such record."
- Target: "Not sent: the home is no longer on the CRM's list, and Core sends no form about a removed home."
- Why: 1 and 2: "record" is the code's word, and why the form cannot go is unsaid.

### `route`, the office is not the tenant's (409) · toast
- Now: "Not sent: the office is not one of this tenant’s."
- Target: "Not sent: the office this form is for is no longer one of {tenant}'s offices." Rendered: "Not sent: the office this form is for is no longer one of Kowboy test account's offices."
- Why: 2: "this tenant" where its name belongs.

### `route`, no office named and several offices (409) · toast
- Now: "Not sent: office_id is required: this tenant has several offices."
- Target: "Not sent: the form names no office, and {tenant} has several, so Core cannot tell which office should get the form." Rendered: "Not sent: the form names no office, and Kowboy test account has several, so Core cannot tell which office should get the form."
- Why: 2: a field's key, `office_id`.

### `route`, no office at all (409) · toast
- Now: "Not sent: this tenant has no office to receive it."
- Target: "Not sent: {tenant} has no office in Core to receive the form." Rendered: "Not sent: Kowboy test account has no office in Core to receive the form."
- Why: 2: "this tenant" where its name belongs.

### `route`, a kind the CRM does not take (409) · toast
- Now: "Not sent: this tenant's CRM takes no search profile."
- Target: "Not sent: {CRM} does not take {kinds} from Core." Rendered: "Not sent: Vitec does not take search profiles from Core."
- Why: 2: the CRM is not named.

### `claimAgain` finds the form on its way (409) · toast
- Now: "This form is on its way to the CRM now, or the CRM took it."
- Target: "Not sent: this form is being sent right now, perhaps by someone else. Reload the page in a minute to see how that send ended."
- Why: 1 and 5: the usual case, another send still on its way, is not said plainly, and the card then leaves the list until a reload (the list is not refreshed live) without the page saying so.

## Words to settle

The glossary has no words for a form's outcome or its kind. Proposed, one word for each thing:

| Write | For | Never |
| --- | --- | --- |
| delivered | the CRM took the form | taken, accepted, submitted |
| refused by the CRM | the CRM said no to the form | refused alone, rejected |
| could not be sent | the CRM did not answer in time, could not be reached, or answered with an error | failed, unanswered |
| no answer | Core was interrupted before the CRM answered, so the CRM may have the form | unanswered, lost |
| held back | a form Core did not send because this is not production | refused, the guard, not the live service, test site |
| turned away | a form Core did not take from a site at all (the bot check, too many at once, a home or office Core does not know, a paused connection), so it is not kept | rejected, a status code |
| production, staging | the copy of Core, as the top bar names it | the live service |
| form | what a visitor sends from a site | submission |
| valuation or contact request, interest in a home, viewing booking, search profile | the four kinds of form | lead, interest alone, `search_profile` |
| visitor; what the visitor wrote | the person who filled in a form, and what that person filled in | the person, the content, the details |
| Core's id for the form | the form's own id | form id, correlation id, chain |
| the CRM's id | the id the CRM gives a delivered form | reference |
| in the last 24 hours | the window of the tenant page's forms line | last day |
| Vitec | a CRM by its name, as `crmName` writes it | `vitec` |
