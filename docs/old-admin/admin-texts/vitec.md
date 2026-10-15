# Admin texts: Vitec office whitelist (draft for review)

Files read: adapters/vitec/admin/index.ts, adapters/vitec/admin/directions.ts, adapters/vitec/admin/directions.test.ts, adapters/vitec/index.ts, adapters/vitec/offices.ts, adapters/vitec/api.ts, adapters/vitec/store.ts, adapters/vitec/forms.ts, adapters/vitec/mappers.ts, adapters/vitec/README.md, adapters/vitec/vitec.test.ts, adapters/vitec/qa.test.ts, engine/adapter-api/types.ts, engine/admin/summary.ts, engine/admin/words.ts, engine/admin/crms.ts, engine/admin/records.ts, engine/admin/tenants.ts, engine/admin/login.ts, engine/admin/feed.ts, engine/admin/pages.ts, engine/attention.ts, engine/alerts.ts, engine/ingest.ts, engine/storage/items.ts, engine/http/submissions.ts, admin/src/components/adapter-sections.tsx, admin/src/pages/crm.tsx, admin/src/pages/tenant.tsx, admin/src/pages/overview.tsx, admin/src/pages/events.tsx, admin/src/pages/record.tsx, admin/src/pages/sync.tsx, admin/src/lib/format.ts, clients/wordpress/themes/kowboy-2026/assets/kowboy-2026.js, docs/admin-panel.md, docs/staging-site.md, golden/vitec. Texts examined: 141. Texts that fail: 110.

Drafted against `staging` at 37d0358: the login fields are “Username”, “Password”, “Customer or group id” and “Use Vitec’s QA environment”, and under a connection the adapter shows only the card “Offices Vitec lists” with the button “Fetch offices”. The Vitec health checks are left out, since another list covers them. A label, a help, a value or cell template, a row of column headers, an empty state, a toast, an error, an event’s reason or detail, a reason word and a setup step each count once. “(QA)” after an office id is kept as it is everywhere.

Example data: the tenant Kowboy test account (tenant 1) on staging Core, https://staging.core.kowboy.cloud; its Vitec connection, short name vitec-2; the office Norban Mäkleri, Vitec’s office id M31529, whose office record in Vitec is FIR31529; the home Cyklopgatan 35B, Vitec’s id OBJ31529_2041198534.

Needs and decisions that recur, named by letter below:

- **N1 The tenant’s name.** The adapter gets a connection with its tenant’s number but not its name, so it cannot write “Kowboy test account’s Vitec connection”. Smallest way: the engine adds the tenant’s name to the connection it hands the adapter (engine/adapter-api, protected, needs approval).
- **N2 Links.** An adapter’s value cannot be a link today; it is text, a number, yes or no, a coloured state or a moment. Smallest way: one more value form, a text with an address inside the admin area, which `Value` in admin/src/components/adapter-sections.tsx draws as a link (engine/adapter-api, needs approval). A table’s empty state would take the same form. Toasts stay without links.
- **N3 A record’s address.** The adapter knows a record’s Vitec id, not the address Core holds for it. Until the engine hands it over, the text says “Vitec’s id …” and links to the record’s page, which shows the address.
- **N4 Words for record types.** The adapter may not import engine/admin/words.ts (the seam). Smallest way: the adapter keeps its own six words (home, new-build project, agent, office, area, housing cooperative), or engine/adapter-api passes the engine’s words on (needs approval).
- **N5 Tests.** These targets change words that tests pin: adapters/vitec/vitec.test.ts lines 546, 733, 784, 966, 990, 1009, 1095, 1129, 1134, 1140, 1243, 1244 and 1291, and adapters/vitec/qa.test.ts lines 250, 322 and 380 (the first two expect an office cell to be exactly “M1 (QA)”). qa.test.ts line 341 and vitec.test.ts line 556 look for “M1 (QA)” and “Fetch offices” inside a longer text, which the targets keep.
- **D1 An office’s agents stay on the sites.** When an office leaves the sites, the code takes off its homes, its new-build projects and the office itself. Its agents, areas and housing cooperatives carry no office in Core and stay (adapters/vitec/index.ts `takeOff`, engine/storage/items.ts `liveRemoteIds`), and no later comparison looks at them again. Today’s texts say the agents go too. The targets say what the code does; whether the agents should go as well is a decision.
- **D2 Code names in the setup steps.** directions.test.ts requires the check names and event types in the steps, and a cold reader must not meet them there. Smallest way within the test as it stands: one last step, “Names in the code”, that holds them all (under adapters/vitec/admin/directions.ts below). Later, when each check has a title, the test can look for the titles instead.

## adapters/vitec/index.ts

### takenOffBecause(): the office left the group · Overview, Needs attention; mail and Slack alert
- Now: "2026-10-06 21:15 | an office was taken off the sites — office M31529 was taken off the sites: it is no longer in the office group Webbplats in Vitec | office Norban Mäkleri (M31529) / tenant Kowboy test account". In the mail: "Which: office Norban Mäkleri (M31529), tenant Kowboy test account, connection vitec-2", "What happened: office M31529 was taken off the sites: it is no longer in the office group Webbplats in Vitec", "Open it: https://staging.core.kowboy.cloud/admin/records?tenant=1&office=M31529&deleted=true"
- Target: the reason "the brokerage took the office out of its office group “Webbplats” in Vitec. Its homes, its new-build projects and the office itself left the sites, and its agents stay. Nothing needs doing if the brokerage meant it. To bring the office back, the brokerage puts it in the group again, and “Fetch offices” on the tenant’s page acts on it within a minute." Rendered whole: "office M31529 was taken off the sites: the brokerage took the office out of its office group “Webbplats” in Vitec. Its homes, its new-build projects and the office itself left the sites, and its agents stay. Nothing needs doing if the brokerage meant it. To bring the office back, the brokerage puts it in the group again, and “Fetch offices” on the tenant’s page acts on it within a minute."
- Link: the line already opens the office’s removed records on Records; the tenant’s page for “Fetch offices”, /tenants/1#connection:vitec-2
- Why: 1, it says what happened but not what it means or what to do; 4, “Webbplats” unquoted reads as a word.
- Needs: D1. The engine’s words in front, “office M31529 was taken off the sites:”, name the office by its id although the event carries its name (engine/admin/summary.ts, another list).

### takenOffBecause(): Vitec still refuses the office · Overview, Needs attention; mail and Slack alert
- Now: "2026-10-07 21:16 | an office was taken off the sites — office M31529 was taken off the sites: Vitec still refused it at the next daily check | office Norban Mäkleri (M31529) / tenant Kowboy test account"
- Target: "Vitec has refused for a day to let this login read the office. Its homes, its new-build projects and the office itself left the sites, and its agents stay. This happens, for example, when the brokerage’s Vitec subscription for the office ended or the password changed. Ask the brokerage. When Vitec lets the login read the office again, the office comes back at the next daily check, or within a minute after “Fetch offices” on the tenant’s page."
- Link: as above
- Why: 1, no meaning and no next step.
- Needs: D1.

### takenOffBecause(): the office cannot be read · Overview, Needs attention; mail and Slack alert
- Now: "… office M31529 was taken off the sites: Vitec has no such office" (or another answer of Vitec’s, or "it no longer reads with this login")
- Target: "Vitec still lists the office behind the customer or group id, but answers that the office does not exist when Core reads it. Its homes, its new-build projects and the office itself left the sites, and its agents stay. Ask Vitec about the office if it should be on the sites." For another answer: "Vitec still lists the office behind the customer or group id, but Core could not read it, because {Vitec’s answer in words, see adapters/vitec/api.ts}. Its homes, its new-build projects and the office itself left the sites, and its agents stay. Ask Vitec why the office cannot be read."
- Link: as above
- Why: 1; 4, “reads with this login” is a term.
- Needs: D1.

### takenOffBecause(): the id no longer lists the office · Overview, Needs attention; mail and Slack alert
- Now: "… office M31529 was taken off the sites: the id on the connection no longer lists it"
- Target: "Vitec no longer lists the office behind {id}, the customer or group id on the connection. Its homes, its new-build projects and the office itself left the sites, and its agents stay. If the office should be on the sites, check the field “Customer or group id” on the tenant’s page with the brokerage." Rendered: "Vitec no longer lists the office behind G2, the customer or group id on the connection. …"
- Link: /tenants/1#connection:vitec-2
- Why: 2, “the id” does not say which; 1.
- Needs: D1. The id is in the check the adapter already holds.

### settleSwitch(): the login was switched · Overview, Needs attention; mail and Slack alert
- Now: "… office M31529 was taken off the sites: the login was switched to Vitec’s QA environment" (or "… to live Vitec")
- Target, to QA: "someone switched the connection’s login to Vitec’s QA environment, Vitec’s test system, on the tenant’s page. The homes, new-build projects and offices live Vitec gave left the sites, and their agents stay. Core now loads the offices from the QA environment. Nothing needs doing if the switch was meant. To undo it, type no in the field “Use Vitec’s QA environment” on the tenant’s page and save." To live Vitec: the same with “live Vitec” and “the QA environment” swapped, and “type yes”.
- Link: /tenants/1#connection:vitec-2
- Why: 1, no meaning and no next step.
- Needs: D1, which holds here too: the other system’s agents stay on the sites.

### noteFailure(): connection.paused detail · Overview, Needs attention; mail and Slack alert
- Now: "2026-10-06 21:40 | a connection paused after failures — the connection paused after 5 failures in a row: VitecError: Advertising/Estate/M31529/OBJ31529_2041198534: HTTP 503 <html><head><title>503 Service Temporarily Unavailable</title></head><body>… | connection vitec-2 / tenant Kowboy test account"
- Target: the detail "the last call failed because {the error in words, see adapters/vitec/api.ts}. Core asks Vitec nothing for this connection until {time}, then tries again by itself and waits longer after each new failure, at most 30 minutes. Until Vitec answers, the sites keep showing the homes as they are, and changes wait. Nothing needs doing while Vitec is down. Once Vitec answers again, “Ask Vitec again now” on the Vitec page starts at once." Rendered whole: "the connection paused after 5 failures in a row: the last call failed because Vitec’s service did not work, and Vitec’s answer code was 503. Core asks Vitec nothing for this connection until 21:42, then tries again by itself …"
- Link: the line already opens the tenant’s page; the Vitec page, /crms/vitec, for the button
- Why: 2, code text and a web page’s HTML; 1, no meaning for the sites and no next step; 4.
- Needs: none; the time is the event’s own `until`. See “stopped asking” under Words to settle.

### noteRefusedLogin(): login.refused detail · Overview, Needs attention; mail and Slack alert
- Now: "2026-10-06 21:12 | the CRM refuses a login — the CRM refuses the login: Vitec refuses this login for M31529 | connection vitec-2 / tenant Kowboy test account"
- Target: "Vitec no longer lets this username and password read {id}, the customer or group id on the connection. The offices behind it stay on the sites for one more day without updates, and leave the sites if Vitec still refuses at the next daily check. This happens, for example, when the brokerage’s Vitec subscription ended or the password changed. Ask the brokerage. If the password changed, type the new one in the field “Password” on the tenant’s page, press “Check the login” and save." Rendered: "the CRM refuses the login: Vitec no longer lets this username and password read M31529, the customer or group id on the connection. …"
- Link: the line already opens /tenants/1#connection:vitec-2
- Why: 1, nothing on what the sites see or what to do.
- Needs: N5.

### markBlocked(): the refusal’s words · Vitec page, “Refused offices”, column “What Vitec said”; Events
- Now: "VitecError: Advertising/Estate/M31529: HTTP 403" (a refusal met while fetching), "Vitec refuses this login" (met at the daily check) or "Vitec refuses this login for G2"
- Target: "Vitec does not let this login read the office." For a refused id: "Vitec does not let this login read G2, the customer or group id the office is listed under."
- Link: none
- Why: 2, code text; 4.

### fetchOne(): fetch.orphan detail · Events; the record’s timeline
- Now: "fetch orphan" with the detail "no active connection licenses this office" (for QA: "… in Vitec’s QA environment")
- Target: "No connection fetches this record’s office any more, for example because the office left the group “Webbplats” or its connection was paused. Core did not fetch the record. Nothing needs doing." For QA: "No connection fetches this record’s office in Vitec’s QA environment any more, …"
- Link: none
- Why: 4, “licenses” is a term; 1.

### failed(): fetch.failed detail · the record’s timeline; Events
- Now: "fetch failed" with the detail "VitecError: Advertising/Estate/M31529/OBJ31529_2041198534: HTTP 500 …"
- Target: "Core gave up fetching this home from Vitec after six failed tries. The last try failed because {the error in words}. The sites show the home as it was before. Once Vitec answers for it, press “Retry now” beside it in the fetch list on the Vitec page."
- Link: /crms/vitec
- Why: 1, 2.
- Needs: N4; the engine’s sentence for the type (under “Event types” below).

### tickOnce(): schedule.failed detail · Events
- Now: "schedule failed" with the detail "TimeoutError: The operation was aborted due to timeout"
- Target: "Core’s regular work for this connection stopped with an error, because {the error in words}. Core tries again within a minute. Nothing needs doing unless this repeats every minute. If it does, the Vitec page shows whether Vitec answers."
- Link: /crms/vitec
- Why: 1, 2.

### submit(): the login cannot be used · Failed forms; the event sentence
- Now: "the CRM did not answer a lead: the connection’s login is not readable"
- Target: "the form was not sent to Vitec, because the connection has no username or password saved. Type them on the tenant’s page, save, and send the form again from Failed forms."
- Link: /tenants/1#connection:vitec-2 and /forms
- Why: 1; 4, “not readable” is a term.
- Needs: the engine’s words in front, “the CRM did not answer”, are wrong here, since Vitec was not asked (engine/admin/summary.ts, another list).

### notified(): a notification turned away or left alone · Events; the record’s timeline (five texts)
The short answers to Vitec can stay as they are; these targets are the event’s detail.
- Now: "bad token". Target: "A notification came to Vitec’s address with a wrong secret, so Core turned it away. If Vitec sent it, Vitec holds an old address. Give Vitec the address under “Notification addresses and call limits” on the Vitec page again."
- Now: "malformed body". Target: "Core could not read the notification, so it turned it away. The change still reaches the sites with the next catch-up, within 12 hours, and a removal with the next comparison, within a day."
- Now: "type is required". Target: "The notification did not say what kind of record changed, so Core turned it away. The change still reaches the sites with the next catch-up, within 12 hours, and a removal with the next comparison, within a day."
- Now: "customerId and id are required". Target: "The notification did not name the office or the record, so Core turned it away. The change still reaches the sites with the next catch-up, within 12 hours, and a removal with the next comparison, within a day."
- Now: "a type Core does not sync". Target: "The notification was about a kind of record the sites do not show, so Core did nothing. Nothing needs doing."
- Link: /crms/vitec for the address
- Why: 1; 2, “token” and “customerId” are code words; 4.

### Event types the adapter logs without a sentence · Events; the record’s timeline (seven texts)
Today the engine reads the type as words. Targets in the engine’s CRM-neutral words:
- Now: "office blocked". Target: "the CRM does not let the login read the office {office_id}, so Core stopped fetching it"
- Now: "office unblocked". Target: "the CRM lets the login read the office {office_id} again, and Core fetches it again"
- Now: "webhook received". Target: "the CRM sent a notification about it, and Core fetches it" (turned away: "the CRM sent a notification, and Core turned it away: {detail}")
- Now: "fetch orphan". Target: "Core did not fetch it: {detail}"
- Now: "fetch failed". Target: "Core gave up fetching it from the CRM after {attempts} tries: {detail}"
- Now: "schedule failed". Target: "the connection’s regular work failed: {detail}"
- Now: "crm call". Target: "Core read it from the CRM in {seconds} seconds", for a form "Core sent the form to the CRM, which answered in {seconds} seconds", and for a failure "Core’s call to the CRM failed: {error in words}"
- Link: none
- Why: 2, the event shows its type.
- Needs: a line for each in engine/admin/summary.ts, the engine’s file, as `office.taken_off` already has (another list).

## adapters/vitec/admin/index.ts

### credentials, “Customer or group id”, help · tenant page, under the field
- Now: "The id Vitec issued this login for: a customer id such as M30011, or a group id such as G2. Core asks Vitec once a day which offices sit behind it; “Offices Vitec lists” below shows which ones reach the sites, and why."
- Target: "The id Vitec issued this login for, a customer id such as M30011 or a group id such as G2. Without it, Core cannot ask Vitec for offices, and nothing reaches the sites. Core asks Vitec once a day which offices sit behind the id. After the save, the card “Offices Vitec lists” below shows which offices reach the sites. A changed id counts from the next daily check, or within a minute after “Fetch offices”."
- Link: none
- Why: 1, an empty id, which the page allows, is not explained; 4, two facts joined by a semicolon; 5, the card appears only after a save.
- Needs: another thread is reworking this field’s hint; this draft follows the current file.

### officesSection(), help · tenant page, card “Offices Vitec lists”
- Now: "Which offices reach this tenant’s sites is decided in Vitec, not here. Once a day, Core asks Vitec which offices sit behind the customer or group id; when the brokerage has an office group called “Webbplats” in Vitec, only the offices in it reach the sites, and otherwise every office does. An office that leaves the group, or that Vitec still refuses to let this login read a day after the first refusal, is taken off the sites with its homes and agents."
- Target: "Vitec decides which offices reach this tenant’s sites, and nothing is chosen here. Once a day, Core asks Vitec which offices sit behind the customer or group id above. When the brokerage keeps an office group called “Webbplats” in Vitec, only the offices in that group reach the sites. When there is no such group, or it holds none of these offices, every office behind the id reaches the sites. An office that leaves the group leaves the sites at the next check, with its homes and new-build projects, and its agents stay. An office Vitec refuses to let this login read stays on the sites for one more day, and leaves them if Vitec still refuses it then."
- Link: none
- Why: the agents do not leave the sites; 4, two facts and a pronoun over a semicolon.
- Needs: D1.

### lastCheckText(): Vitec did not answer · card “Offices Vitec lists”, “Last check”
- Now: "2026-10-06 21:12: Vitec did not answer, so the offices of the last answer stay synced and Core asks again within the hour"
- Target: "Vitec did not answer the check at {time}. The offices of the last answer stay on the sites, and Core asks again within the hour. Nothing needs doing." Rendered: "Vitec did not answer the check at 2026-10-06 21:12. The offices of the last answer stay on the sites, and Core asks again within the hour. Nothing needs doing."
- Link: none
- Why: 1, nothing on what to do; 4, a colon stands for words.

### lastCheckText(): no office · card “Offices Vitec lists”, “Last check”
- Now: "2026-10-06 21:12: Vitec has listed no office that reads", also shown when no customer or group id is typed and Vitec was never asked
- Target, one of three:
  - No id typed: "No customer or group id is typed above, so Core has not asked Vitec, and nothing reaches the sites. Type the id Vitec issued the login for in the field “Customer or group id”, save, and press “Fetch offices”."
  - Vitec did not answer, and no earlier answer exists: "Vitec did not answer the check at 2026-10-06 21:12, so nothing reaches the sites yet. Core asks again within the hour."
  - Vitec answered: "At the check at 2026-10-06 21:12, Vitec listed no office this login may read behind M31529, so nothing reaches the sites. Check the customer or group id and the login’s rights with the brokerage."
- Link: none
- Why: false when no id is typed, since Vitec was not asked; 1; 4, “reads” is a term.
- Needs: the first case comes from the login itself. The other two need to know whether Vitec answered, which the check knows but does not keep (adapters/vitec/offices.ts `checkOffices`): keep it with the check.

### refusedText(): the office is still on the sites · card, column “Readable with this login”
- Now: "no: Vitec refuses this login since 2026-10-05 21:12; taken off the sites if still refused at the next daily check"
- Target: "No. Vitec has refused this login since 2026-10-05 21:12. The office stays on the sites until the next daily check, and leaves them if Vitec still refuses it then." On the row of a refused customer or group id, where the same words stand in the column for the office: "Vitec has refused this login the whole id since 2026-10-05 21:12. The offices behind the id stay on the sites until the next daily check, and leave them if Vitec still refuses then."
- Link: none
- Why: 4, a colon and a semicolon stand for words, and the parts are not sentences.

### refusedText(): the office is not on the sites · card, column “Readable with this login”
- Now: "no: Vitec refuses this login since 2026-10-04 21:12; taken off the sites"
- Target: "No. Vitec has refused this login since 2026-10-04 21:12, and the office is not on the sites."
- Link: none
- Why: false for an office that never was on the sites, such as one outside the group “Webbplats”; 4.

### groupsText(): the groups · card, “Office groups in Vitec”
- Now: "Webbplats (1), Övrigt (1)"
- Target: "{group} with {one office or n offices}", the groups joined by “and”. Rendered: "Webbplats with 1 office and Övrigt with 1 office"
- Link: none
- Why: 4, brackets stand for words.
- Needs: N5.

### groupsText(): no group · card, “Office groups in Vitec”
- Now: "none"
- Target: "None, so every office behind the id reaches the sites."
- Link: none
- Why: 1, no meaning.

### officesSection(), column headers · card table
- Now: "Id typed | Office | Name | Readable with this login | Synced to the sites"
- Target: "Customer or group id | Vitec’s office id | Office | Readable with this login | On the sites"
- Link: none
- Why: 2, “Id typed” is not the field’s name and “Office” holds ids; 4, “synced”.

### officesSection(), office cell · card table
- Now: "M31529 (FIR31529)"
- Target: "M31529", and in the column “Office” the office’s name linked to its records: "Norban Mäkleri"
- Link: /records?tenant=1&office=M31529
- Why: 2, FIR31529 is Vitec’s inner record id, a second id nobody needs here; 3; 4, brackets.
- Needs: N2.

### officesSection(), empty state · card table
- Now: "Not checked yet: the first check runs at the worker’s next tick."
- Target: "Core has not asked Vitec about the offices yet. The first check runs within a minute of the save. Reload the page to see it." After a check without an id: "No office to show, because no customer or group id is typed above."
- Link: none
- Why: 4, “the worker’s next tick”; false after a check without an id.

### probe(): no username or password · tenant page, “Check the login”, toast
- Now: "The CRM refused the login" over "The login needs a username and a password."
- Target: "Vitec was not asked, because the field “Username” or “Password” is empty. Type both and press “Check the login” again."
- Link: none
- Why: 1; the toast’s title says Vitec refused, which it did not.
- Needs: the title “The CRM refused the login” is the app’s (admin/src/pages/tenant.tsx) and is wrong whenever the CRM was not asked. Smallest way: the title “The login was not accepted”.

### probe(): no id · tenant page, “Check the login”, toast
- Now: "The CRM refused the login" over "Type the customer or group id the login was issued for."
- Target: "Vitec was not asked, because the field “Customer or group id” is empty. Without the id, nothing reaches the sites. Type the id Vitec issued the login for, such as M30011 or G2, and press “Check the login” again."
- Link: none
- Why: 1; 2, the field’s name is not used.
- Needs: the toast’s title, as above.

### probe(): Vitec answers · tenant page, “Check the login”, toast
- Now: "The CRM accepted the login" over "M31529: Vitec answers, 1 office record(s) listed". An id Vitec does not know gives "M31529: Vitec answers, 0 office record(s) listed" under the same title.
- Target: "Vitec accepts the login and lists {one office or n offices} behind {id}." Rendered: "Vitec accepts the login and lists 1 office behind M31529." When Vitec lists none: "Vitec accepts the login but lists no office behind M31529, so nothing would reach the sites. Check the customer or group id with the brokerage."
- Link: none
- Why: 4, “record(s)” and a colon for words; 5, a yes with no office misleads.
- Needs: N5. Decision: the check answers no when Vitec lists no office behind the id (one line in `probe`, and the toast’s title follows).

### probe(): Vitec refuses · tenant page, “Check the login”, toast
- Now: "The CRM refused the login" over "M31529: Vitec refuses this login for that office (VitecError: Advertising/Office/M31529: HTTP 401 )"
- Target: "Vitec does not let this username and password read M31529. Check both with the brokerage or in Vitec’s partner portal, type them again and press “Check the login” again."
- Link: none
- Why: 2, code text; 4, brackets; 1, no next step.

### probe(): another failure · tenant page, “Check the login”, toast
- Now: "The CRM refused the login" over "M31529: TimeoutError: The operation was aborted due to timeout"
- Target: "The login could not be checked, because {the error in words}. Try again in a few minutes." Rendered: "The login could not be checked, because Vitec did not answer within 30 seconds. Try again in a few minutes."
- Link: none
- Why: 2; 4.
- Needs: the toast’s title, as above.

### panel(), card title “Notification URL” · Vitec page
- Now: "Notification URL"
- Target: "Notification addresses and call limits"
- Link: none
- Why: 5, the card also holds live Vitec’s address and the limits on Core’s calls, which a reader takes for notification settings.

### panel(), card help · Vitec page
- Now: "Give this address to Vitec for the subscription. Vitec then calls it for every Update and Remove of an estate advertised on the website, and Core fetches or removes the record. For a login to Vitec’s QA environment, give Vitec’s QA environment the address “URL for Vitec’s QA” instead."
- Target: "Vitec tells Core at these addresses each time a home on the website, a new-build project, an agent, an office or an area changes or is removed. Core then fetches the record or takes it off the sites, usually within seconds. Ask Vitec to send the brokerage’s notifications to the address for live Vitec. For a login to Vitec’s QA environment, ask Vitec to send QA’s notifications to the address for Vitec’s QA. Without notifications, changes still reach the sites with the catch-up, up to 12 hours later."
- Link: none
- Why: 4, “the subscription” and “Update and Remove of an estate” are Vitec’s terms; 1, nothing on what happens without it.

### panel(), “URL” and “URL for Vitec’s QA” · Vitec page (two texts)
- Now: "URL: /v1/hook/vitec/webhook/3f9c…e1 on this app’s domain" and "URL for Vitec’s QA: /v1/hook/vitec/qa/3f9c…e1 on this app’s domain"
- Target: "Address for live Vitec: https://staging.core.kowboy.cloud/v1/hook/vitec/webhook/3f9c…e1" and "Address for Vitec’s QA: https://staging.core.kowboy.cloud/v1/hook/vitec/qa/3f9c…e1"
- Link: none
- Why: 5, the reader must put the address together; 4, “this app’s domain”.
- Needs: Core’s own public address at this point. The engine knows it, since its alerts use it for “Open it”. Smallest way: the engine hands it to the adapter’s page, or the app puts the page’s own address in front of the path.

### webhookUrl(): no secret set · Vitec page
- Now: "VITEC_WEBHOOK_TOKEN is not set; the listener answers 503"
- Target: "Not set up. The server setting VITEC_WEBHOOK_TOKEN is empty, so Core turns every notification from Vitec away, and changes reach the sites only with the catch-up, up to 12 hours later. Set it in Core’s server settings."
- Link: none
- Why: 1; 4, “listener” and “503”.

### panel(), “Vitec Connect” · Vitec page
- Now: "Vitec Connect: https://connect.maklare.vitec.net"
- Target: "Live Vitec’s address: https://connect.maklare.vitec.net"
- Link: none
- Why: 4, “Connect” is Vitec’s product name.

### panel(), “Requests at once” and “Requests per second” · Vitec page (two texts)
- Now: "Requests at once: 5" and "Requests per second: 10"
- Target: "Calls to Vitec at once: 5" and "Calls to Vitec per second: 10"
- Link: none
- Why: 5, requests to whom is not said.

### connectionsSection(), help · Vitec page, “Connections and schedules”
- Now: "A catch-up fetches everything that changed since the last one, in case a notification was missed; a comparison fetches Vitec’s list and removes what is no longer on it. Both run on their own; the buttons run them at the worker’s next tick."
- Target: "Every 12 hours, a catch-up asks Vitec for everything that changed since the last catch-up, in case a notification went missing. Once a day, a comparison reads Vitec’s whole list and takes off the sites whatever is no longer on it. Both run by themselves. The buttons in a row run them for that connection within a minute."
- Link: none
- Why: 4, semicolons and “the worker’s next tick”; 1, how often is not said.

### connectionsSection(), column headers · Vitec page
- Now: "Connection | Offices | Active | State | Last catch-up | Changes since | Last comparison | Fetch list"
- Target: "Connection | Offices | Fetching | State | Last catch-up | Changes fetched up to | Last comparison | Fetch list"
- Link: none
- Why: 2, the tenant’s page calls “Active” fetching and paused; 5, “Changes since” leaves out what.

### connectionsSection(), connection cell · Vitec page
- Now: "vitec-2"
- Target: "{tenant}’s Vitec connection, short name {short name}". Rendered: "Kowboy test account’s Vitec connection, short name vitec-2"
- Link: /tenants/1#connection:vitec-2
- Why: 2, the short name alone; 3.
- Needs: N1, N2.

### connectionsSection(), offices cell · Vitec page
- Now: "M31529"
- Target: "{office name}, Vitec’s office id {id}", several joined by “and”, and “No office yet” for none. Rendered: "Norban Mäkleri, Vitec’s office id M31529"
- Link: /records?tenant=1&office=M31529
- Why: 2, the id alone; 3.
- Needs: N2. The names are in the connection’s last office check, which the adapter keeps.

### connectionsSection(), State, stopped after failures · Vitec page
- Now: "paused until 2026-10-06T19:52:00.000Z"
- Target: "Not asking Vitec until {time}, after five failed calls in a row". Rendered: "Not asking Vitec until 2026-10-06 21:52, after five failed calls in a row"
- Link: none
- Why: 4, a machine time in another time zone; 2, “paused” means a person’s pause on the tenant’s page.

### connectionsSection(), State, fetching · Vitec page
- Now: "fetching", also for a connection paused on the tenant’s page and for one without a usable login
- Target: "Fetching" for a connection Core fetches for; "Paused on the tenant’s page, so Core asks Vitec nothing for it"; "Fetching nothing, because Vitec has given no office"; "Fetching nothing, because the login has no username or password"
- Link: none
- Why: false for a paused connection, which Core skips.

### moment(): due now · Vitec page, “Last catch-up” and “Last comparison”
- Now: "due at the worker’s next tick"
- Target: "Runs within a minute"
- Link: none
- Why: 4, “the worker’s next tick”.

### fetchListText() · Vitec page, column “Fetch list”
- Now: "3 waiting · 1 retrying · 0 given up"
- Target: "{n records} waiting, {n records} to be tried again, {n} given up", a zero said as “none”, and “Nothing waiting” when all are zero. Rendered: "3 records waiting, 1 record to be tried again, none given up"
- Link: none
- Why: 4, dots stand for words and numbers stand without a noun.

### connectionsSection(), empty state · Vitec page
- Now: "No Vitec connections yet: make a tenant with the CRM vitec."
- Target: "No tenant has a Vitec connection yet. To add one, open Tenants, press “New tenant” and choose vitec as its CRM."
- Link: /tenants
- Why: 3; 4, a colon stands for words.
- Needs: N2.

### “Catch up now”, help · Vitec page
- Now: "Asks Vitec for everything that changed since the last catch-up and fetches it. This runs by itself every few minutes; press it when a notification looks to have been missed and you do not want to wait."
- Target: "Asks Vitec within a minute for everything that changed since the last catch-up, and fetches it. A catch-up runs by itself every 12 hours. Press it when a change made in Vitec has not reached the sites, for example because a notification went missing."
- Link: none
- Why: false, a catch-up runs every 12 hours, not every few minutes; 4.

### “Compare now”, help · Vitec page
- Now: "Fetches Vitec’s own list of what is marketed and removes from Core anything no longer on it. This runs by itself once a day; press it when a listing has been taken off the website and should disappear from the sites now."
- Target: "Asks Vitec within a minute for its whole list of what is marketed, and takes off the sites every home, new-build project, agent, office or area no longer on it. A comparison runs by itself once a day. Press it when a home the brokerage stopped marketing in Vitec still shows on the sites."
- Link: none
- Why: 2, “listing” and “the website” are not the area’s words for a home and the sites; 4, a semicolon.

### “Resume now”, label and help · Vitec page (two texts)
- Now: "Resume now", beside "This connection stopped asking Vitec after five failures in a row and is waiting out its pause. Press this to start again at once, once you believe Vitec is answering."
- Target: "Ask Vitec again now", beside "Core stopped asking Vitec for this connection after five failed calls in a row, and asks again by itself at the time under State. Press this to ask again at once, for example when Vitec says its service is back."
- Link: none
- Why: 2, “Resume” is the tenant page’s button for a person’s pause; 4, “waiting out its pause”.

### blockedSection(), help · Vitec page, “Refused offices”
- Now: "An office is listed here when Vitec refuses to let the login read it. From that moment Core sends Vitec no call about the office, and its waiting records stay on the fetch list. The first refusal also stops every other call with the same login until Core has checked the offices, which happens within a minute. After that, Core checks the offices once a day, and that check is the only call that asks about a refused office. When Vitec lets the login read the office again, the office leaves this list and is loaded again in full. When Vitec still refuses it a day later, everything of that office is taken off the sites. “Fetch offices” on the tenant’s page asks Vitec at once instead of waiting a day."
- Target: "An office shows here when Vitec refuses to let the login read it, for example after a cancelled subscription or a changed password. From then on, Core asks Vitec about the office only at the daily office check, and the office’s homes on the sites stop updating. The first refusal also stops every call with the same login until Core has checked the offices, within a minute. When Vitec lets the login read the office again, the office leaves this list and is loaded again in full. When Vitec still refuses it a day after the first refusal, the office leaves the sites with its homes and new-build projects, and its agents stay. Ask the brokerage about a refused office. After a fix, press “Fetch offices” on the tenant’s page, and Core checks within a minute."
- Link: each row’s tenant page, /tenants/1#connection:vitec-2
- Why: “everything of that office” leaves the sites is false for its agents; 1, nothing on what the sites see meanwhile or what to do.
- Needs: D1; N1 and N2 for the link.

### officeLabel() · Vitec page, column “Office” in “Refused offices” and “Fetch list”; toasts
- Now: "M31529", or "M31529 (QA)" for an office of Vitec’s QA environment
- Target: "{office name}, Vitec’s office id {id}", with the mark as it is. Rendered: "Norban Mäkleri, Vitec’s office id M31529" and "Norban Mäkleri, Vitec’s office id M31529 (QA)"
- Link: /records?tenant=1&office=M31529, or /records?office=M31529 when more than one tenant fetches the office
- Why: 2, the id alone; 3.
- Needs: the office’s name, which the adapter keeps in each connection’s last office check and can look up there; N2.

### fetchListSection(), help · Vitec page, “Fetch list”
- Now: "Records Core is about to fetch: notifications and “fetch again” first, then loads and catch-ups. A retrying record failed and waits for its next attempt; after six failures it is given up, and Retry or Drop is yours. A connection that fails five times in a row pauses, two minutes doubling to thirty, and probes its way back."
- Target: "The first 50 records Core is about to fetch from Vitec or take off the sites. Notifications, removals and “Fetch again” go first, then the loads of whole offices and the catch-ups. A record that failed is tried again after 10 seconds, and after twice as long each further time. After six failed tries Core gives the record up, and it waits here for “Retry now” or “Drop”. When five calls in a row fail for one connection, Core stops asking Vitec for that connection for two minutes, then for twice as long each time, at most 30 minutes."
- Link: none
- Why: 4, “loads”, “probes its way back” and a semicolon, and “Retry” is not the button’s name; 1.

### fetchListSection(), column headers · Vitec page
- Now: "Office | Datatype | Record | Reason | Attempts | Due | Last error"
- Target: "Office | Type | Record | Why it waits | Tries | Next try | Last error"
- Link: none
- Why: 2, “Datatype” is the code’s word; 4.

### fetchListSection(), type cell · Vitec page
- Now: "property"
- Target: "home", and “new-build project”, “agent”, “office”, “area” or “housing cooperative” for the others
- Link: none
- Why: 2, the code’s word.
- Needs: N4.

### fetchListSection(), record cell · Vitec page
- Now: "OBJ31529_2041198534"
- Target: "{address or name}, Vitec’s id {id}". Rendered: "Cyklopgatan 35B, Vitec’s id OBJ31529_2041198534", and until the address is at hand "Vitec’s id OBJ31529_2041198534"
- Link: /records/vitec-2/property/OBJ31529_2041198534
- Why: 2, an id alone; 3.
- Needs: N3, N2. The connection for the link is the one that fetches the office, which `queue()` already finds.

### fetchListSection(), “given up” · Vitec page, column “Next try”
- Now: "given up"
- Target: "Given up after six failed tries"
- Link: none
- Why: 1, after what and why is not said.

### “Retry now”, help · Vitec page, beside each row
- Now: "Puts this record at the front of the fetch list, whatever its attempt count. For a record that was given up on after six failures and that you believe Vitec can answer for now."
- Target: "Puts this record back in line to be fetched now, with its count of tries from zero. Press it for a record Core gave up on after six failed tries, once you believe Vitec answers for it again."
- Link: none
- Why: 4, the second sentence is not a whole sentence, and “attempt count” is a term.
- Needs: a row’s button explains itself only on hover (`title` in `SectionTable`, admin/src/components/adapter-sections.tsx), against the rule that a button explains itself beside it; the app’s change.

### “Drop”, help · Vitec page, beside each row
- Now: "Takes this record off the fetch list without fetching it. Core keeps whatever it already holds for it; the next notification or comparison will put it back."
- Target: "Takes this record off the fetch list without fetching it. The sites keep the record as they show it now. Vitec’s next notification about the record puts it back, and so does a catch-up after it changes again in Vitec. A dropped removal comes back with the next daily comparison. Press it for a record Core gave up on that should not be fetched, for example while you ask Vitec about it."
- Link: none
- Why: false, a comparison never puts back a record to fetch, only a removal; 1, when to press it is missing.
- Needs: the hover rule, as above.

### ACTIONS.catch_up, toast · Vitec page
- Now: "vitec-2 catches up at the worker’s next tick."
- Target: "{connection} asks Vitec for its changes within a minute." Rendered: "Kowboy test account’s Vitec connection, short name vitec-2, asks Vitec for its changes within a minute."
- Link: none
- Why: 2, the short name alone; 4.
- Needs: N1, N5.

### ACTIONS.compare, toast · Vitec page
- Now: "vitec-2 compares its list at the worker’s next tick."
- Target: "Kowboy test account’s Vitec connection, short name vitec-2, compares Vitec’s list within a minute. Whatever Vitec no longer lists then leaves the sites."
- Link: none
- Why: 2; 4; 1, what it brings is not said.
- Needs: N1.

### ACTIONS.check_offices, toast · tenant page, after “Fetch offices”
- Now: "vitec-2 asks Vitec for its offices at the worker’s next tick; reload the page in a minute to see the answer."
- Target: "Core asks Vitec within a minute which offices reach the sites through Kowboy test account’s Vitec connection, short name vitec-2. Reload this page in a minute to see the answer."
- Link: none
- Why: 2; 4, a semicolon and “the worker’s next tick”.
- Needs: N1, N5.

### ACTIONS.resume, toast · Vitec page
- Now: "vitec-2 fetches again."
- Target: "Kowboy test account’s Vitec connection, short name vitec-2, asks Vitec again now."
- Link: none
- Why: 2.
- Needs: N1.

### ACTIONS.retry, toast · Vitec page
- Now: "property OBJ31529_2041198534 of M31529 is fetched next."
- Target: "The home with Vitec’s id OBJ31529_2041198534, of Norban Mäkleri, Vitec’s office id M31529, is fetched again now."
- Link: none
- Why: 2, code words and ids alone.
- Needs: N3, N4, and the office’s name as for officeLabel().

### ACTIONS.drop, toast · Vitec page
- Now: "property OBJ31529_2041198534 of M31529 (QA) is off the list."
- Target: "The home with Vitec’s id OBJ31529_2041198534, of Norban Mäkleri, Vitec’s office id M31529 (QA), is off the fetch list. The sites keep it as they show it now."
- Link: none
- Why: 2; 1, what it means for the sites.
- Needs: as above; qa.test.ts line 341 still finds “M1 (QA)”.

### ACTIONS guards and act() · any Vitec button, red toast (three texts)
- Now: "Error: which connection?", "Error: which record?" and "Error: no such action: catch_up_all"
- Target: "Nothing was done, because the button did not say which connection it is for. Reload the page and press it again."; "Nothing was done, because the button did not say which record it is for. Reload the page and press it again."; "Nothing was done, because Vitec’s page has no such button any more. Reload the page."
- Link: none
- Why: 1; 4.
- Needs: the engine puts “Error: ” in front (engine/admin/crms.ts, `String(error)`), the engine’s list.

### inspect() errors · a record’s page, “Ask the CRM now”, red toast (two texts)
- Now: "Error: the connection’s login is not readable" and "Error: the connection has no office to ask for"
- Target: "Vitec was not asked, because the connection has no username or password saved. Type them on the tenant’s page and save." and "Vitec was not asked, because Vitec has given this connection no office yet. The card “Offices Vitec lists” on the tenant’s page says why."
- Link: /tenants/1#connection:vitec-2
- Why: 1; 4, “not readable”.
- Needs: the engine’s “Error: ” in front (engine/admin/records.ts).

## adapters/vitec/offices.ts

### readOne(): “Vitec has no such office” · tenant page, card “Offices Vitec lists”, column “Readable with this login”
- Now: "Vitec has no such office"
- Target: "No. Vitec lists this office behind the id but answers that it does not exist, so it does not reach the sites."
- Link: none
- Why: 1; 5, the office is in Vitec’s own list, so the words read as a contradiction.

### failure(): “Vitec refuses this login” · Vitec page, “Refused offices”, “What Vitec said”; the card’s id row; events
- Now: "Vitec refuses this login"
- Target: "Vitec does not let this login read the office." For an id: "Vitec does not let this login read M31529."
- Link: none
- Why: 2, in a list of offices “this login” does not say which; 4.
- Needs: N5.

### checkId(): the groups are refused · tenant page, card, “Office groups in Vitec”
- Now: "Vitec refuses this login its office groups"
- Target: "Vitec does not show this login the office groups, so Core cannot see a group “Webbplats” and every office behind the id reaches the sites. If the brokerage uses that group, ask Vitec to let this login read office groups."
- Link: none
- Why: 1, what it means for the sites is the point and is missing.
- Needs: N5.

## adapters/vitec/api.ts

### get(): Vitec answered with an error · Vitec page, “Last error”; Flow; the paused alert; “Check the login”; “Ask the CRM now”
- Now: "VitecError: Advertising/Estate/M31529/OBJ31529_2041198534: HTTP 503 <html><head><title>503 Service Temporarily Unavailable</title></head><body>…"
- Target, by what Vitec answered:
  - 401 or 403: "Vitec does not let this login read it. Vitec’s answer code was 403."
  - 429: "Vitec asked Core to call less often. Vitec’s answer code was 429."
  - 500 and above: "Vitec’s service did not work. Vitec’s answer code was 503."
  - another code: "Vitec turned the call down with the words “{Vitec’s words}”. Vitec’s answer code was 400." Vitec’s words go in only when they are text, never a web page.
  - no answer in time: "Vitec did not answer within 30 seconds."
  - no connection: "Core could not reach Vitec."
- Link: none
- Why: 2, code, a path and a web page’s HTML; 4.
- Needs: none beyond the adapter. One function in api.ts gives the words from the kind and the code, and the event log and the error tracker keep the path and the raw answer for an engineer.

### get(): an answer Core cannot read · same places
- Now: "VitecError: Advertising/Estate/M31529/OBJ31529_2041198534: broken JSON: <!DOCTYPE html><html lang="sv">…"
- Target: "Vitec answered with something Core cannot read."
- Link: none
- Why: 2; 4.
- Needs: `kindOf()` recognises this error by the words “broken JSON” in its message, so that mark moves to a field of the error.

### Blocked: a call Core kept back · “Check the login” toast; a record’s page, “Ask the CRM now”; Failed forms
- Now: "Vitec refuses to let this login read office M31529, so Core sends Vitec nothing about it. Only the daily office check asks Vitec again; “Fetch offices” on the tenant’s page asks now." On a record’s page it reads "Blocked: Vitec refuses …", and on Failed forms "the CRM did not answer a lead: blocked: Vitec refuses …"
- Target: "Core did not ask Vitec, because Vitec refuses to let this login read the office {office}. Core asks Vitec about the office again only at the daily office check. Once the brokerage has sorted it out with Vitec, press “Fetch offices” on the tenant’s page, and Core checks within a minute." Rendered: "Core did not ask Vitec, because Vitec refuses to let this login read the office Norban Mäkleri, Vitec’s office id M31529. …" For a form: "The form was not sent, because Vitec refuses to let this login read the office Norban Mäkleri, Vitec’s office id M31529. Send it again from Failed forms once Vitec no longer refuses the office."
- Link: /tenants/1#connection:vitec-2, and /forms for a form
- Why: 2, the office by its id alone; 4, a semicolon joins two facts and “Blocked:” or “blocked:” stands in front; “asks now” is in fact within a minute.
- Needs: the office’s name, as for officeLabel(); N1 and N2 for the link. For a QA office, the words “in its QA environment” stay.

### post(): Vitec answered a form with an error · Failed forms; the event sentence
- Now: "the CRM did not answer a lead: unavailable: v2/Advertising/Form/M31529/Valuation: HTTP 503 Service Unavailable"
- Target: the words of get() above, then what became of the form (under adapters/vitec/forms.ts, outcomeOf()). Rendered: "Vitec did not take the lead, because Vitec’s service did not work. Vitec’s answer code was 503. Send it again from Failed forms when Vitec works."
- Link: /forms
- Why: 2, “unavailable:” and a path; 4.

### post(): the form’s time ran out · Failed forms; the event sentence
- Now: "the CRM did not answer a lead: unavailable: v2/Advertising/Form/M31529/Valuation: not sent, the form's time ran out"
- Target: "Core stopped trying after 15 seconds, so the form was not sent to Vitec and the visitor read that it was not sent. Send it again from Failed forms."
- Link: /forms
- Why: 2, a path; 4, “unavailable:” as a label.

## adapters/vitec/forms.ts

### submit(): no office · Failed forms; the event sentence
- Now: "the CRM did not answer a lead: no office (customer id) to send to"
- Target: "the form was not sent to Vitec, because Core could not tell which office it is for."
- Link: /forms
- Why: 4, brackets; 1.
- Needs: unclear what the reader can do, because the office comes from the engine (engine/http/submissions.ts), from the home or the visitor’s choice. The engine’s words “the CRM did not answer” are wrong here, since Vitec was not asked.

### searchProfile(): no search wishes · Failed forms; the event sentence
- Now: "the CRM did not answer a search profile: other: a search profile without criteria"
- Target: "the search profile was not sent to Vitec, because the site’s form held no search wishes. The site’s search profile form needs checking."
- Link: /forms
- Why: 4, “other:” and “criteria”; 1.

### searchProfile(): no contact number · Failed forms; the event sentence
- Now: "the CRM did not answer a search profile: other: UpdatePerson answered no contact id"
- Target: "Vitec took the visitor as a contact but gave back no contact number, so the search profile was not added. Send it again from Failed forms."
- Link: /forms
- Why: 2, Vitec’s call name; 4.

### estateOf(): no home · Failed forms; the event sentence
- Now: "the CRM did not answer a viewing booking: other: a viewing without a home"
- Target: "the booking was not sent to Vitec, because the form did not say which home it is for." For an interest: "the interest was not sent to Vitec, because the form did not say which home it is for."
- Link: /forms
- Why: 4; 1.

### wordsOf(): a refusal without Vitec’s words · the visitor’s form window on the site; Failed forms
- Now: the visitor reads "Det gick tyvärr inte" and below it "Vitec answered HTTP 404"; Failed forms reads "the CRM refused a lead: Vitec answered HTTP 404"
- Target: to the visitor, nothing after the site’s own Swedish words; on Failed forms, "Vitec said no without giving a reason. Vitec’s answer code was 404."
- Link: /forms
- Why: Core’s answer to a site names a CRM and an answer code to a visitor, in English (2, 4); 1.
- Needs: decision. Today one reason serves both the visitor and Failed forms. Smallest way: Core sends the site a reason only when Vitec gave words, and Failed forms keeps the code. Unclear in what language Vitec words its refusals, since no example is in the repository.

### outcomeOf(): a form that failed · Failed forms; the event sentence
- Now: "the CRM did not answer a lead: unavailable: v2/Advertising/Form/M31529/Valuation: HTTP 503 Service Unavailable"
- Target, by kind:
  - Vitec down or silent: "Vitec did not take the lead, because {the error in words}. Send it again from Failed forms when Vitec works."
  - An answer Core cannot read: "Vitec’s answer could not be read, so it is unclear whether Vitec took the lead. Check in Vitec before sending it again."
  - The login refused: "Vitec does not let this login send forms. Check the login on the tenant’s page, then send the form again from Failed forms."
- Link: /forms, and /tenants/1#connection:vitec-2 for the login
- Why: 2, “unavailable:” and a path; 4.

## adapters/vitec/store.ts

### Reason · Vitec page, “Fetch list”, column “Why it waits”; Flow, “Waiting to be fetched from the CRM: {reason}.” (six texts)
- Now: "webhook". Target: "Vitec sent a notification that it changed"
- Now: "remove". Target: "Vitec no longer lists it, so it leaves the sites"
- Now: "load". Target: "Core loads its office in full"
- Now: "catch_up". Target: "the catch-up found it changed"
- Now: "reference". Target: "another record names it, as a home names its housing cooperative"
- Now: "refetch". Target: "someone asked to fetch it again"
- Rendered on Flow: "Waiting to be fetched from the CRM: Vitec sent a notification that it changed."
- Link: none
- Why: 2, the code’s words.
- Needs: the stored values stay; the adapter gives the words in `queue()` and in the column. Flow’s own words, “Waiting to be fetched from the CRM”, are wrong for a removal, which is never fetched (engine/admin/feed.ts, the engine’s list).

## adapters/vitec/admin/directions.ts

What directions.test.ts checks: in the steps’ text, every login field’s label (Username, Password, Customer or group id, Use Vitec’s QA environment), both address paths (/v1/hook/vitec/webhook/ and /v1/hook/vitec/qa/), every lifecycle event the adapter handles (connection_added, offices_added, offices_removed, resync, refetch) and every health check as vitec.<name> (vitec.webhook_lag, vitec.retries, vitec.catch_up, vitec.offices, vitec.connect). In the settings, the four keys (VITEC_WEBHOOK_TOKEN, VITEC_BASE_URL, VITEC_FETCH_CONCURRENCY, VITEC_REQUESTS_PER_SECOND), each with a value and a help longer than ten characters, and the same keys in README.md. The acceptance test checks that every “On <Page>” names a page of the menu. The targets keep all of these: the labels and paths in the steps, the code names in one last step (D2).

### Step “Tenant and login” · Vitec page, “Setting it up”
- Now: "On Tenants, press “New tenant”, give the customer’s name and choose the CRM vitec. Type the Username and Password Vitec issued for the brokerage (one pair, used for every call; Vitec’s partner portal shows them) and the Customer or group id Vitec issued them for (a customer id such as M30011, or a group id such as G2); no offices are typed, Vitec decides them (the next step). “Check the login” tries them at Vitec before anything is saved. Add the sites and save: the tenant is made, its token and every site’s bell secret are on the page, and Core asks Vitec which offices to load and loads every record of them (the event connection_added). A connection with no office to load fetches nothing, and vitec.catch_up says so. Vitec also runs a QA environment, which is Vitec’s test system. For a login Vitec issued for its QA environment, also type yes in the field “Use Vitec’s QA environment”. …" (and on to "an office of a QA login shows (QA) after its id.")
- Target: "On Tenants, press “New tenant”, type the brokerage’s name and choose vitec as the CRM. Type the Username and Password Vitec issued for the brokerage, which Vitec’s partner portal shows. Type the Customer or group id Vitec issued them for, a customer id such as M30011 or a group id such as G2. No offices are typed, because Vitec decides them, as the next step says. “Check the login” tries the login at Vitec before anything is saved. Add the brokerage’s sites and press “Save”. The tenant’s page then shows the tenant’s token and each site’s bell secret, which go into the sites’ plugin. Core asks Vitec which offices reach the sites and loads everything Vitec publishes for them. For a login Vitec issued for its QA environment, which is Vitec’s test system, also type yes in the field “Use Vitec’s QA environment”. Core sends every call of a QA login to https://connect-qa.maklare.vitec.net and keeps its records apart from live Vitec’s, and a slow QA environment never holds up live Vitec. Give a QA login a tenant of its own, so that test homes never reach a real website. On this page, an office of a QA login shows (QA) after its id."
- Link: none
- Why: 2, an event type and a check’s name; 4, brackets and a semicolon stand for words.
- Needs: D2.

### Step “Which offices reach the sites” · Vitec page, “Setting it up”
- Now: "This is decided in Vitec, not here. Once a day, Core asks Vitec which offices sit behind the customer or group id; when the brokerage has an office group called “Webbplats” in Vitec, only the offices in it reach the sites, and otherwise every office does. So tell the brokerage: to choose which offices show on the website, put them in the office group “Webbplats” in Vitec. An office that leaves the group, or that Vitec still refuses to let the login read a day after the first refusal, is taken off the sites with its homes and agents. On the tenant’s page, “Offices Vitec lists” shows the last answer, and “Fetch offices” asks at once instead of waiting a day."
- Target: "Vitec decides this, and nothing is chosen in Core. Once a day, Core asks Vitec which offices sit behind the customer or group id. When the brokerage keeps an office group called “Webbplats” in Vitec, only the offices in that group reach the sites. When there is no such group, or it holds none of these offices, every office behind the id reaches the sites. So tell the brokerage to put the offices it wants on its website in the office group “Webbplats” in Vitec. An office that leaves the group leaves the sites at the next check, with its homes and new-build projects, and its agents stay. When Vitec refuses to let the login read an office, the office stays on the sites for one more day, and leaves them if Vitec still refuses it then. On the tenant’s page, the card “Offices Vitec lists” shows the last answer, and “Fetch offices” asks Vitec within a minute instead of waiting a day."
- Link: none
- Why: the agents do not leave the sites; 4, a semicolon joins two facts.
- Needs: D1.

### Step “Notifications” · Vitec page, “Setting it up”
- Now: "Give Vitec the notification URL below, /v1/hook/vitec/webhook/… on this app’s domain with the token filled in, and ask for subscriptions on Estate, limited to estates advertised on the website, for Update and Remove, and on Project, User, Office and Area. Until they exist, changes arrive with the catch-up instead. For a QA login, give Vitec’s QA environment the second URL below instead: /v1/hook/vitec/qa/… with the same token. Core knows from that URL that a notification is about QA’s records."
- Target: "Ask Vitec to send the brokerage’s notifications to the address for live Vitec, under “Notification addresses and call limits” below. That address is Core’s own address, then /v1/hook/vitec/webhook/ and the secret. Ask for notifications on Estate, limited to estates advertised on the website, for Update and Remove, and on Project, User, Office and Area. These are Vitec’s own names for homes, new-build projects, agents, offices and areas. Until the notifications are set up, changes reach the sites with the catch-up, up to 12 hours later. For a QA login, ask Vitec to send QA’s notifications to the address for Vitec’s QA instead, which ends in /v1/hook/vitec/qa/ and the same secret. From that address, Core knows the notifications are about QA’s records."
- Link: none
- Why: 4, “this app’s domain with the token filled in”, and “subscriptions on Estate” unexplained; 1, how late changes come without notifications.

### Step “Changes later” · Vitec page, “Setting it up”
- Now: "Offices are never typed in Core: to change which ones reach the sites, the brokerage changes its office group “Webbplats” in Vitec, and “Fetch offices” on the tenant’s page acts on it at once (an office that came is loaded, one that went is taken off the sites). Core’s own office list of a Vitec connection stays empty, and when Core changes it anyway (the events offices_added and offices_removed) the adapter only asks Vitec again. On Manual sync, the tenant as the scope and “Fetch from the CRM, recompute and send to the sites” fetch Vitec’s list once more, for the entity types ticked or all, and remove what is no longer on it (resync); with an office or one record id in the scope, only the records Core holds there are fetched once more (refetch). “Remove everything” on the tenant’s page (connection_removed) takes every record off the sites. A saved login switched between live Vitec and its QA environment, by typing yes or no in the field “Use Vitec’s QA environment”, has everything the other system gave taken off the sites at the worker’s next tick. Until that tick, the login syncs no office. Its offices are then loaded again in full from the system it is for now. On a record’s own page, “Fetch again” (refetch) fetches that record once more, and “Ask the CRM now” shows it raw and unified without writing anything."
- Target: "Offices are never typed in Core. To change which offices reach the sites, the brokerage changes its office group “Webbplats” in Vitec, and “Fetch offices” on the tenant’s page acts on it within a minute. An office that came is loaded in full, and an office that left leaves the sites. On Manual sync, choose the tenant under “What to sync” and “Fetch from the CRM, recompute and send to the sites” under “How far to go”, then press “Start”. Core then reads Vitec’s whole list again, fetches everything on it and takes off the sites whatever is no longer on it. With an office or one record’s CRM id in the choice, Core fetches again only the records it holds there. On a record’s own page, “Fetch again” fetches that record once more, and “Ask the CRM now” shows what Vitec holds for it without writing anything. A saved login switched between live Vitec and its QA environment, by typing yes or no in the field “Use Vitec’s QA environment”, fetches nothing until Core has checked it, within a minute. Core then takes the homes, new-build projects and offices of the other system off the sites, and loads the offices again from the system chosen. The bin beside a connection on the tenant’s page, followed by “Save”, takes every record of that connection off the sites at their next update. “Remove everything” deletes the whole tenant in Core, and its sites keep what they show until the plugin is taken off them."
- Link: none
- Why: false, “Remove everything” leaves the sites as they are (the tenant page’s own confirmation says so), and the switch leaves the other system’s agents; 2, event types; 4, “the worker’s next tick”, “raw and unified”.
- Needs: D1, D2.

### Step “Forms” · Vitec page, “Setting it up”
- Now: "A visitor’s forms on the sites reach Vitec through Core: the free valuation is Vitec’s valuation request (the seller’s lead), the interest in a home its interest registration, the booking its viewing attendance, and the search profile a contact with a residential search profile in the CRM function group. … On Overview, submissions.failing is red while the latest form to a connection went unanswered by Vitec; every call shows on the home’s timeline as crm.call."
- Target: "Visitors’ forms on the sites reach Vitec through Core. The free valuation becomes Vitec’s valuation request, a lead for the seller. An interest in a home becomes Vitec’s interest registration, and a viewing booking becomes Vitec’s viewing attendance. A search profile becomes a contact with a search profile in Vitec. Nothing about forms is typed on the connection, so Vitec’s own defaults stand for the lead source, the intake source and an interest’s status. A booking asks Vitec to confirm it to the visitor by e-mail, with no text message and no reminder. Only Core’s live service sends forms to Vitec. On any other copy of Core, such as staging, a form stops just before Vitec and the visitor reads that it was not sent, while the viewing times are still read. A form for a tenant with a QA login goes to Vitec’s QA environment, and also only from Core’s live service. On Overview, a check turns red while the latest form to a connection went unanswered by Vitec. A form Vitec did not take shows on Failed forms, where it can be read and sent again. Every call Core makes to Vitec for a home shows in the home’s timeline on Records."
- Link: none
- Why: 2, a check’s name and an event type; 4, brackets and a semicolon.
- Needs: D2.

### Step “Check” · Vitec page, “Setting it up”
- Now: "On Overview, vitec.webhook_lag, vitec.retries, vitec.catch_up, vitec.offices and vitec.connect are green, and the first notification shows on a record’s timeline as webhook.received. On Flow, the records Vitec sends appear as they arrive."
- Target: "On Overview, the five Vitec checks are green: no notification waits more than five minutes, no record failed three fetches in a row, every connection has caught up on time, Vitec refuses no office, and Core asks Vitec for every connection. The first notification from Vitec shows in the record’s timeline on Records. On Flow, the records Vitec sends appear as they arrive." Then one more step, titled “Names in the code”: "For the engineer: the five Vitec checks on Overview are vitec.webhook_lag, vitec.retries, vitec.catch_up, vitec.offices and vitec.connect. Saving a new connection sends the adapter connection_added, and a change to Core’s own office list sends offices_added or offices_removed, after which the adapter asks Vitec again. A Manual sync of a tenant that fetches from the CRM is resync, and one of an office or a record, like “Fetch again”, is refetch."
- Link: none
- Why: 2, only check names and an event type.
- Needs: D2.

### Setting VITEC_WEBHOOK_TOKEN, help · Vitec page, “Setting it up”
- Now: "The secret in the notification URL; without it the listener answers 503."
- Target: "The secret at the end of both notification addresses. Without it, Core turns every notification from Vitec away, and changes reach the sites only with the catch-up, up to 12 hours later."
- Link: none
- Why: 4, “listener”, “503” and a semicolon; 1.

### Setting VITEC_FETCH_CONCURRENCY, help · Vitec page, “Setting it up”
- Now: "Requests to Connect at once, lists included, for live Vitec and for its QA environment each."
- Target: "How many calls Core makes to Vitec at the same time, counted apart for live Vitec and for its QA environment. A higher number loads a large brokerage faster and puts more load on Vitec."
- Link: none
- Why: 4, “Connect” and “lists included”; 1.

### Setting VITEC_REQUESTS_PER_SECOND, help · Vitec page, “Setting it up”
- Now: "The speed limit towards Connect, so a load never looks like an attack, for live Vitec and for its QA environment each."
- Target: "How many calls Core makes to Vitec in one second at most, counted apart for live Vitec and for its QA environment, so that loading a whole brokerage never looks like an attack to Vitec."
- Link: none
- Why: 4, “towards Connect” and “a load”.

## Words to settle

- **stopped asking Vitec** for Core’s own pause after five failed calls in a row (code: `paused_until`). Keep “paused” only for a connection a person paused on the tenant’s page (“Pause this connection”, the badge “paused”). The button becomes “Ask Vitec again now”, and the engine’s title “a connection paused after failures” would follow as “Core stopped asking a CRM after failures” (another list).
- **notification** for Vitec telling Core that a record changed or went (code: webhook, hook). Never “webhook”. The address is “the address for live Vitec” and “the address for Vitec’s QA”.
- **catch-up**: every 12 hours, Core asks Vitec for everything changed since the last catch-up. Keep, and say how often where it first shows.
- **comparison**: once a day, Core reads Vitec’s whole list and takes off the sites whatever is no longer on it. Keep.
- **the daily office check**: Core asking Vitec once a day which offices reach the sites. The button stays “Fetch offices”, the owner’s word, although “fetch” elsewhere means reading records; its help says what it does.
- **fetch list**: the records Core is about to fetch from Vitec or take off the sites. Keep.
- **load an office in full**: fetching everything of one office, for a new connection, an office that came or a Manual sync. Never “load” alone.
- **refused**: Vitec not letting the login read an office or an id. Never “blocked”, the code’s word.
- **given up**: Core stopped trying to fetch a record after six failed tries. Keep.
- **call**: one request from Core to Vitec. Never “request”.
- **Vitec’s answer code**: Vitec’s HTTP status, kept at the end of an error for whoever phones Vitec. Never “HTTP 503” in a sentence.
- **Vitec’s office id**: the customer id Vitec gives an office (M31529), on Vitec’s own page; the glossary’s “the CRM’s office id” elsewhere. The office record’s id (FIR31529) is never shown.
- **customer or group id**: the id a Vitec login is issued for (M30011 or G2), as the field names it.
- **on the sites** for an office whose records Core sends (column “On the sites”), and **reach the sites** in sentences. Never “synced”.
- **live Vitec** and **Vitec’s QA environment, Vitec’s test system** for the two systems; the first mention on a page says “test system”. “(QA)” after an office id stays as it is.
- **username and password** for the login’s two fields, as their labels say. Never “key pair” or “Connect username”.
