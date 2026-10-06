# Open questions

The register of everything asked of Patric. A question gets the next number here before it is
asked in chat, chat refers to that number, and Patric answers by number, in any conversation.
Numbers are never reused: an answered question gets its line in `decisions.md` and leaves this
file. Each one is tagged with its part and names what is blocked and the smaller option, so
answering is quick. Next number: 157 (124 was asked in chat only on 2026-10-03 and answered the same day; 116 to 118 were used by the handbook sessions of 2026-09-29 to 2026-10-03, 116 in chat only; 75 to 77 were also used in chat on 2026-09-21 for the porting
plan's questions, which are 78 to 80 here; 62 to 69 were also used in chat on 2026-09-20 for the WordPress
plan's questions, which are 66 to 73 here; 47 and 48 were used in chat on 2026-09-19 for 16 and 2, and the helper-methods
conversation of the same day counted 30 to 49 in chat; none of those are register numbers).

## 156. `[core]` Should the tenant page leave out "Offices it may see" for a CRM whose adapter takes the offices from the CRM itself?

- 2026-10-06 · Patric approved with question 147 a that a Vitec connection's field "Offices it may
  see" goes away and its list stays empty, and answered 154 the same day: "I want to use every
  office belonging to the group "webbplats", if zero or the group doesnt exist, use all offices by
  listing as above." The tenant page draws that field for every CRM and names none, so leaving it
  out for Vitec takes one more optional line in what an adapter tells the admin area
  (`engine/adapter-api/`, a protected path): "this adapter takes its offices from the CRM". The
  page reads it, leaves the field out and saves the connection's list empty.
- What it does to the connections that exist (production has no Vitec connection yet): one that
  names a group id there, such as `G12`, holds no homes under that id, so emptying it takes
  nothing off a site. One that names its own office there loses that office's records from the
  sites at its first save after this, and the adapter loads them again at once, so the site
  takes its homes off and puts them back one time.
- a) **yes** (recommended): the optional line, and the page leaves the field out for Vitec. b)
  **no**: the field stays for every CRM, may now be left empty, and the Vitec setup text says to
  leave it empty.
- Smaller: b. Blocked: nothing; the rest of 147 a and 154 is built with the field still there.
  Answer a or b.

## 150. `[core]` Where should the forms live?

- 2026-10-05 · Patric, after answering 146: "I am still not sure this should live in core, the
  more I think about it, it's a separate app, but it can live in the same repo. List pros and
  cons." The first answer (three options, inside Core recommended) misread his option C as an app
  that reads the homes from Core and keeps a second register of sites. Patric, 21:56 (UTC): "You
  have misunderstood option C." His option C is a cloud app that keeps "1 set of Vitec credentials
  plus token plus office(s) per tenant"; a script tag on the client site binds the forms to
  buttons and draws the form window; a client-side config carries the property id, the office id,
  a token, a namespace and the form choices; the form is sent to the cloud app, which checks it,
  sends it to Vitec and returns the answer; "The only thing the client needs to do, is add our
  tag to GTM or our wp plugin", with configs per site "token, urlpath, DOMpath, type, theme".
  "What did I miss, why do we need to rely on core at all?"
- The answer: it does not need Core. The page already knows the home's and the office's ids (the
  plugin has them from the site's records, where every home carries its `office_id`), and Vitec's
  own form call (`GET v2/Advertising/Form/{customerId}/Estate/{estateId}`) returns the home's
  address and its viewings with their time slots, with the partner login Core already uses (the
  probe of 2026-10-04 in `docs/forms.md`). What the design still needs:
  1. **What "authenticated" can mean in a browser.** The token in the tag is public: anyone can
     read it from the page. What protects a form is that the token works only from its tenant's
     own site addresses (the browser tells the app which page a call comes from, and another
     site's page cannot change that), the bot check, which stops programs, and a limit per
     visitor. The tenant's Vitec password never leaves the app.
  2. **The bot check across many sites.** Cloudflare's free plan lists ten site addresses per pair
     of keys, twenty pairs at most; a cloud app serving many customers' sites is the case
     Cloudflare sells as its Enterprise plan ("Multi-tenant applications such as SaaS platforms
     serving multiple customer domains", Any Hostname page, updated 2026-04-16). So the app keeps
     a pair per ten sites and adds each site's address through Cloudflare's interface, or Kowboy
     pays for Enterprise, or the frame idea is tested (`docs/next-steps.md`, item 21).
  3. **The home's Vitec id on a site Kowboy does not build.** The interest and the booking need
     it; such a site must show it in its page address or its markup for "urlpath" or "DOMpath" to
     read, or only the free valuation works there.
  4. **The Vitec password twice.** A brokerage whose site also reads through Core has the same
     Vitec login in Core and in the app, so a changed password goes in both.
- 2026-10-06 · Patric, 09:15 (UTC): "OK so the benefit with a separat app is that I can deploy it
  to any site. The benefit of having it in Core is that it's integrated and native in our plugin,
  and styled using templates, is that correct?" The answer: half right. Any site is the app's
  gain, but the approved window, added by our plugin and coloured by the site, comes with either;
  Core's gain is less to run. Patric, 09:20: "Is it best as living in the same repo or a separate
  repo? Explain how it's styled, and can we customiez the flow or not? would it be a simpler
  variant would be to have it live completely in the wp theme, and only have submit endpoints
  provided by Core." The answers:
  1. **The repository**: the same one, whichever option is picked. The theme and the plugin are
     here already, and a cloud app takes the Vitec calls and the form window over without a copy,
     under the same checks; a repository of its own pays off only if the forms are sold or handed
     over on their own.
  2. **The look**: the approved window sits in a sealed box in the page (a shadow root), so the
     site's styles cannot reach inside it and its own cannot leak out. From outside, a site sets
     eleven values (`clients/forms-widget/src/styles.css`): the font, which is the site's own
     unless set, nine colours (text, faint text, background, borders, buttons, button text,
     success, error and the backdrop) and the corner rounding. The layout, spacing, sizes and
     texts are the window's own and the same on every site. Our theme sets none of the eleven, so
     the staging site shows the window's own black and white, which is what was approved.
  3. **The steps**: fixed in the window's code and the same on every site
     (`clients/forms-widget/src/wizard.ts`): the interest asks "Dina uppgifter", then "Söker du
     bostad?"; the booking "Välj tid", "Dina uppgifter" and "Söker du bostad?"; the valuation
     "Dina uppgifter", then "Söker du bostad?". A change in the code changes every site at once
     (151 drops the last step on Vitec sites); a choice per site, of steps or fields, is a new
     setting per form, asked first. In the theme, the steps are the theme's own code.
  4. **The theme**: yes, simpler for our WordPress sites, and the simplest of the three. It is the
     form per client that was weighed against the one window on 2026-10-04 (137 b,
     `docs/forms.md`) and set aside then so that one window serves WordPress, Lovable and any
     site. The theme draws the window in its own markup and styles; the visitor's browser sends
     the form to its own site; our plugin, which holds the token the site syncs with, passes it to
     Core; and Core sends it with the Vitec login it holds. That is the path of 146's item 10 ("The
     client site backend calls core with its site key"). Core's part is two addresses for a site's
     server, sending a form and reading a viewing's times, which exist from 2026-10-04
     (`POST /v1/submissions`, `GET /v1/submissions/slots`) and come back from zero, asked as lines
     (155).
- 2026-10-06 · Patric, 11:54 (UTC): "150 A. Let me repeat the solution, if not matched, flag for
  discussion because we are not aligned: Core has form receiver(s), the wp plugin has no form
  specific things except form receivers using wp api, and the default template has: Complete set
  of forms. The forms submit to wp api, the wp api submits serverside to core using the token,
  core uses the token to map to vitec credentials, core submits to vitec. Each call is logged in
  detail if something breaks." That is a, with two differences, flagged as he asked: (1) 146's
  item 2 put a "Formulär" switch under the plugin's menu, and this description leaves the plugin
  only the receivers, so 155's item 2 now follows the newer words and has no switch; (2) "logged
  in detail": Core's rule for forms logs the id and the outcome, never the person
  (`engine/http/submissions.ts`), so 155's item 8 names the detail (the ids, the step reached,
  the CRM's answer and timing, the error text) and keeps the visitor's data out; keeping that
  data for a retry would be a new line. In the same message: "WAIT: I see a lot less moving parts
  by just adding a wp admin > kowboy > forms setting page, accepting vitec credentials. The wp
  plugin sends directly to vitec using the credentials. Core is not even involved, at all.
  Possibly that core could proxy and pass on the submitted form, with the benefit that the client
  does not need to touch the api credentials. If Yes, how can we ensure that Client B with their
  token can write to ClientB.property.sendInterest but not to ClientC.property.sendInterest by
  just edit the form inputs? We cant have leaks between tenants." The direct send is d below: the
  per-site plugin of 129's option D (`docs/forms.md`, "Where the writes live"), set aside on
  2026-10-04 when 129 was answered a.
- How Core keeps tenants apart (the door of 2026-10-04, `engine/http/submissions.ts`, which the
  rebuild brings back): the form never chooses the login. The token, sent by the site's server
  and never in the page, names the tenant; the form may only name a record or an office. Core
  refuses a record whose connection is not that tenant's ("the record is not one of this
  tenant's"), a record that does not exist under that connection ("no such record"), an office
  that is not the tenant's, and a form id another tenant used; then it sends with that
  connection's login and no other. Vitec is the second lock: its password is issued per customer,
  and a call for another customer's estate answers 403 "Access violation" (verified 2026-10-05
  with other ids). So a visitor who edits the inputs on B's site can make B's form fail, never
  reach C. With d the question does not arise: a site holds only its own login.
- What d gains: nothing in Core, no change to the adapter interface, no hop through Core, no
  tenant question. What it costs: the seam ends for the forms (`AGENTS.md`: "no CRM name appears
  in `engine/` or `clients/`" is a CI block, and the Concept says "Clients hold templates and a
  sync loop"), a protected change; the Vitec login is copied into every WordPress site's database,
  where every admin of the site, its host and any faulty plugin can read it, against Vitec's own
  advice to store it encrypted and easy to change, and its warning that a leaked login gives an
  attacker the partner's rights (`docs/inputs/vitec/technical-information.md`, "Säkerhet",
  "Nyckelhantering"); an Mspecs site can never have it (one provider account for every brokerage,
  not for a site); the Vitec calls are written in PHP for WordPress and again for Lovable, and a
  Vitec change is a plugin update on every site; nothing but "no login typed here" keeps a staging
  site from sending; and the log is per site. With a, Core's two addresses serve Lovable too, with
  its own token.
- The four options, the theme added on 2026-10-06, the plugin's own send at 11:54:

  |                                     | a) In our theme (Patric's variant)                                                                                                                                        | b) Cloud app (Patric's option C)                                                                                          | c) Inside Core                                                                                                    | ---                                                                                                        |
  | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
  | Who draws the window                | our theme, in its own markup and styles                                                                                                                                   | a tag on the page (GTM or our plugin) draws the approved window                                                           | the same tag, served by Core                                                                                      | our theme, as a                                                                                            |
  | Its look                            | the theme's styles, all of it                                                                                                                                             | the eleven values set from outside                                                                                        | as b                                                                                                              | as a                                                                                                       |
  | Its steps                           | the theme's code                                                                                                                                                          | the window's code, the same on every site                                                                                 | as b                                                                                                              | as a                                                                                                       |
  | How a form reaches Vitec            | the browser sends it to its own site; our plugin passes it to Core with the site's token; Core sends it with the login it holds                                           | the browser sends it to the app with a public token; the app sends it with its own copy of the login                      | the browser sends it to Core with a public key; Core sends it with the login it holds                             | the browser sends it to its own site; our plugin sends it to Vitec with the login typed on the site        |
  | What visitors and bots reach        | their own site only                                                                                                                                                       | the app                                                                                                                   | Core's own program, beside the sites' updates, the CRM's notifications and the admin area                         | their own site only                                                                                        |
  | Sites                               | our WordPress sites; a Lovable site needs its own form                                                                                                                    | any site, by one tag, where the page shows the home's Vitec id                                                            | our WordPress and Lovable sites; others once Core can hold a site with no bell address                            | our WordPress sites with a Vitec office; never an Mspecs site; a Lovable site needs its own code and login |
  | Core itself                         | two addresses for a site's server, the guard, a log, and an addition to the adapter interface (protected)                                                                 | untouched                                                                                                                 | the same as a, for browsers: a public key per site, the site's allowed addresses, and the window served from Core | untouched                                                                                                  |
  | The Vitec logins                    | one copy, in Core                                                                                                                                                         | a second copy where a brokerage's site also reads through Core                                                            | one copy, in Core                                                                                                 | a copy in every WordPress site's database, typed by Kowboy                                                 |
  | Running cost                        | nothing new                                                                                                                                                               | one more program on staging and one on live, DigitalOcean's smallest size: $5 a month each (pricing page read 2026-10-05) | nothing new                                                                                                       | nothing new                                                                                                |
  | A fix to the window                 | a theme update on every site                                                                                                                                              | one change, every site at once                                                                                            | as b                                                                                                              | a theme update on every site; a Vitec change is a plugin update on every site                              |
  | From 2026-10-04                     | Core's two addresses and the Vitec calls; the window is redrawn in the theme                                                                                              | the window, the Vitec calls and the bot check move into the app; new: the tenant list and the site's config               | all of it                                                                                                         | the window redrawn in the theme; the Vitec calls rewritten in PHP                                          |
  | Rules that change                   | the adapter interface, a protected path                                                                                                                                   | a new top-level folder, named in `AGENTS.md`'s layout                                                                     | the adapter interface, a protected path                                                                           | the seam: "no CRM name in `clients/`" (a CI block) and "Clients never name a CRM" (`AGENTS.md`, protected) |
  | A form on B's site reaching C's CRM | impossible: the token names the tenant, Core refuses a record or office that is not the tenant's, and the login it then uses is scoped by Vitec to that tenant's customer | the same, by the app's token and tenant list                                                                              | the same, by the site's public key                                                                                | impossible: the site holds only its own login                                                              |

- The same in all four: the bot check, with each site's address on Cloudflare's list, and the Vitec
  calls; the guard of 152 in a, b and c.
- Why a is recommended: it is the smallest. Nothing new runs, each Vitec login stays in one place,
  no key sits in the page, the browser reaches only its own site, and the theme styles the window
  and sets its steps. b was recommended from 2026-10-05 for leaving Core untouched and serving any
  site; Patric's variant gives Core the sending by design, and any site is worth b's costs only
  if a site outside our WordPress sites is to get forms, which is for Patric to say. a's costs: a
  Lovable site needs its own form, and a site Kowboy does not build has none until the cloud app
  is built; the approved window is redrawn by the theme, with the same look and steps; and a fix
  to the window is a theme update on every site, not one change in one place. d (11:54) is
  smaller in Core, which it leaves untouched, and bigger everywhere else: the Vitec login copied
  into every WordPress site's database, the Vitec calls written once per client type, no Mspecs
  site ever, and the seam rule ended for the forms; a keeps one copy of each login and one set of
  calls, behind two addresses a Lovable site can use as well.
- a) **theme, Core sends** (recommended): Patric's description of 11:54; our theme draws the
  forms, our plugin passes them to Core with the site's token, Core sends them. b) **cloud app**:
  Patric's option C, reading nothing from Core. c) **inside Core**: the one window, served by
  Core. d) **theme, plugin sends**: the Vitec login typed on a WordPress settings page, Core not
  involved.
- Smaller: a; d in Core alone. Blocked: the rebuild of the forms. Answer a, b, c or d. Patric
  wrote "150 A" at 11:54 and raised d in the same message, so a stands unless he picks d. The
  letters changed on 2026-10-06 when the theme was added; until then a was the cloud app and b
  inside Core.

## 153. `[core]` Is this list the cloud app's first version?

- 2026-10-05 · Applies if 150 is b (the cloud app; a until 2026-10-06). Patric: "mvp even
  simpler". Built from zero (144): only what a form cannot work without, in his format where he
  gave one. Each line is new and is asked here before it is built (`AGENTS.md`, "Stop and ask"):
  1. **The app**: one program in its own top-level folder of Core's repository, run by the same
     host beside Core, at a path under Core's address (live `core.kowboy.cloud/forms/`, staging
     `staging.core.kowboy.cloud/forms/`), so nothing changes at the domain host; it reads nothing
     from Core.
  2. **The tenants**: per tenant a token, the Vitec login (username and password), its office
     ids, and the site addresses the token works from; kept as one secret setting of the app, so
     no database and no admin page; an agent adds a tenant.
  3. **The tag**: one script tag, added by GTM or by our WordPress plugin when its "Formulär"
     switch is on (146, item 2); it draws the approved form window and binds it to buttons by the
     site's config: the token, then per form "urlpath, DOMpath, type, theme" as Patric wrote it,
     and where the page holds the home's and the office's ids (our plugin writes them on the
     button).
  4. **The bot check**: Turnstile, its keys as secret settings of the app; each site's address is
     put on Cloudflare's list when its tenant is added. It takes a Cloudflare account and one key
     of Cloudflare's, created once.
  5. **The Vitec calls**: the interest, the viewing booking with its times read from Vitec when
     the window opens, and the free valuation; the profile step as 151 decides.
  6. **The guard**: staging never sends to a CRM (152).
  7. **The log**: each form's outcome (sent, refused, failed) with no personal data, errors
     reported the way Core's are, and a health check the host watches.
- Not in it: an admin page, a database, form counts, Mspecs, Lovable's own setup beyond the tag,
  and anything in Core.
- a) **yes** (recommended): built as listed once 150 is b. b) **no**: name the lines to strike or
  what to add.
- Smaller: a. Blocked: the cloud app. Answer a or b.

## 155. `[core]` Is this list the theme's first version?

- 2026-10-06 · Applies if 150 is a. Built from zero (144): only what a form cannot work without.
  Each line is new and is asked here before it is built (`AGENTS.md`, "Stop and ask"):
  1. **The window**: our theme draws the approved form window in its own markup and styles, with
     the approved look and steps; the buttons stay as they are.
  2. **The plugin**: nothing for the forms but the receivers (Patric, 2026-10-06 11:54): one
     address on the site that passes a form to Core with the token the site syncs with, and
     passes a viewing's times back; the "Formulär" switch of 146's item 2 is dropped, and the
     theme shows its forms wherever it has them.
  3. **Core's two addresses**: for a site's server, opened by the same token: send a form, and
     read a viewing's times; Core finds the brokerage's connection, and that CRM's code sends the
     form with the login Core holds.
  4. **The adapter interface**: one capability any CRM's code may offer, sending a form and
     reading a viewing's times (a protected path).
  5. **The bot check**: Turnstile in the window, its keys a global setting in Core (146, item 8);
     each site's address is put on Cloudflare's list when the site is added, which takes a
     Cloudflare account and one key of Cloudflare's, created once.
  6. **The Vitec calls**: the interest, the viewing booking with its times read from Vitec when
     the window opens, and the free valuation; the profile step as 151 decides.
  7. **The guard**: staging never sends to a CRM (152).
  8. **The log**: every call Core makes for a form as an event in Core's event log, "in detail
     if something breaks" (Patric, 11:54): the form's id and kind, the record, the connection,
     the step reached, the CRM's answer and how long it took, and the full error text when it
     breaks; never the visitor's name, phone, e-mail or message; errors reported the way Core's
     are.
- Not in it: a page or setting in Core's admin area, a table of forms, form counts, a key in the
  page, the window served by Core, Mspecs and Lovable.
- A proof first (Patric, 2026-10-06, on 147: "you need to do a poc before writing everything"):
  the interest form end to end on the local site, stopped by the guard before Vitec; then the
  rest.
- a) **yes** (recommended): built as listed once 150 is a. b) **no**: name the lines to strike or
  what to add.
- Smaller: a. Blocked: the forms in the theme. Answer a or b.

## 151. `[crm-vitec]` Should Vitec sites skip the "Söker du bostad?" step?

- 2026-10-05 · Patric, on 146's item 10: "Why would you want the crms password? The client site
  backend calls core with its site key, it is then authenticated to make calls using the tenant
  crm auth, why would we need another set of crm auth?" It is not another login: the site still
  calls Core with its own key, and Core uses the Vitec login it holds for the brokerage. That
  login is Kowboy's partner login ("Both CRMs hand it to Kowboy as a partner, not to a
  brokerage", `docs/forms.md`, "Terms"), and Vitec issues it a password per office (or group of
  offices) and per part of its interface ("För varje kund/grupp och funktionsgrupp som partnern
  har rättighet till så skapas också ett lösenord automatiskt"), granted "efter beställning från
  kund", once the brokerage orders it (`docs/inputs/vitec/technical-information.md`). The
  password a Vitec connection holds today opens the advertising part, which reads the homes and
  takes the interest, the viewing booking and the free valuation. The wizard's last step, the
  visitor's search profile (139, 131), is in Vitec's CRM part; the login in the environment
  answered "not authorised" (401) for that part on 2026-10-04. Mspecs needs nothing more for it.
- The step also carries the box "Kontakta mig om min nuvarande bostad" (141 a, on an interest and
  a booking), which makes the visitor a seller lead through the valuation call, in the advertising
  part. Without the step, the box moves to the contact step, so 141 a holds with no second
  password.
- Vitec's own help says Vitec builds a profile by itself from an interest only when the brokerage
  turns automatic profiles on, the interest has the status Interested or higher, and the contact
  allows matching and marketing (`docs/forms.md`, "Read online on 2026-10-04"). The interest call
  has no field for that consent, and whether the status stays in the call is open (146's list
  proposed leaving it out; Patric's answers did not settle it), so whether that happens for a site's
  interest is not known; such a profile follows the home the interest names, not the visitor's
  wishes.
- Patric approved the form designs on 2026-10-05 at 21:38 (UTC), the screens of round 9 in another
  thread: their progress bars count this step as the last one, two steps in the interest's window
  and three in the booking's, though the step's own screen was not among them. With a, a Vitec
  site's windows show one step fewer than those screens.
- a) **skip** (recommended): on a Vitec site the forms end at the interest, the booking or the
  valuation, one step fewer than the approved screens, and the box "Kontakta mig om min nuvarande
  bostad" moves to the contact step; Vitec is the only CRM with forms today, so the profile step is
  not built in the rebuild, and it comes back when a brokerage asks for it. b) **keep**, as in the
  approved screens: each brokerage first orders the CRM part from Vitec for Kowboy, then its
  connection gets that part's password, in the admin area inside Core or in the cloud app's tenant
  list; until then the step is hidden for that office, which, where Core sends the forms (150 a or
  c), needs the adapter interface change named in 146's item 10.
- Smaller: a. Blocked: nothing now; the rebuild's Vitec part. Answer a or b.

## 152. `[core]` Default: a staging or test run of the forms never sends a form to a CRM; only the live one does, with no setting

- 2026-10-05 · Patric, on 146's item 9: "Why would I want a setting to disable all forms centrally,
  I dont understand this option". It was never for turning the forms off on the live service. It
  existed because staging reads a real brokerage's live office (the Vitec login on staging is a
  client's production office): without a guard, a form tried on the staging site would land in that
  brokerage's CRM as a real lead or booking, which the rule of 2026-10-04 forbids (`AGENTS.md`,
  "Stop and ask"). Core already knows which one it is, by the environment name it gives its alerts
  and error reports (staging, production or local, `engine/config.ts`), so no new setting is needed:
  the forms send only where that name is production, and everywhere else they stop before the CRM
  and answer that the form was not sent. This replaces the "Send forms to Vitec" switch on every
  Vitec connection, and 146's item 9. The first real send to Vitec's test customer (54 f), once that
  customer exists, is asked then. The cloud app (150 b) is given the same environment name the same
  way.
- Reply only if you disagree: no.

## 135. `[client-wordpress]` Default: the search tests are listed under acceptance criterion 20, the search suite

- 2026-10-04 · The acceptance list `acceptance/criteria.json` is a protected path, changed on
  Patric's word. Criterion 20, "Real clients pass the sync and search suites", already names the
  WordPress client's three list tests as its search half. The two tests of `docs/search.md`
  built on 2026-10-04 (the search by code, area and name; the links by outline) prove the same
  half and belong under the same number; the acceptance report is regenerated with them. The
  smaller option is to leave the list as it is, and the tests then run without a criterion
  naming them.
- Reply only if you disagree: no.

## 136. `[crm-mspecs]` The footer's lead form on an Mspecs site: Mspecs's lead call needs at least one matching

- 2026-10-04 · Mspecs's marketing provider API (`docs/inputs/mspecs/`) adds a lead only together
  with matching criteria (rooms, price, area, municipalities), which becomes a contact with a
  search profile; it has no plain "contact me" or valuation lead, while Vitec has. The footer's
  "Ska du sälja din bostad?" names no home and no criteria. Blocked: nothing today; no Mspecs
  site exists. Options: a) send the lead call with one matching taken from the brokerage's
  settings, such as its municipality, so the contact lands in Mspecs; b) hide the footer form on
  Mspecs sites until Mspecs offers a plain lead; c) send the footer's lead by e-mail to the
  office, outside the CRM.
- Smaller: b, until an Mspecs brokerage asks; a invents a matching in Core, which is a rule to
  write down first. Answer a, b or c.

## 123. `[crm-vitec]` A whole-day viewing: what the CRM sends, so the page shows no time

- 2026-10-03 · Patric's list says a viewing has an "entire day" flag that hides the time. Vitec's
  viewing carries `id`, `startsAt`, `endsAt`, `comment`, `isDigital`, `isSelfRegistrationEnabled`
  and `isProjectViewing` (field tables, `viewings[]`); no such flag. The page now treats a viewing
  from midnight to midnight, or starting at midnight without an end, as a whole day and shows the
  date alone. Blocked: nothing; a whole-day viewing with other times would show those times.
- Smaller option: keep the midnight rule (a). Else: name the field (b), and the adapter maps it.

## 52. The pairs for the Vitec mapping: no longer needed for the mapping; what remains is Vitec's golden masters

`[crm-vitec]` Patric's plan of 2026-09-19 (a read endpoint on a client site running the old
plugin, plus its Vitec key pair, fetched as pairs and mapped by evidence) was overtaken the same
day by Gate 2: `docs/field-tables.md` names every universal field's Vitec source,
`adapters/vitec/mappers.ts` copies and renames by those tables, and `display` comes from the
approved ledger entries. The mapping needs no evidence from the old sites, and taking anything
from the old plugins is a hard rule against (AGENTS.md). What 52 still delivered is Vitec's golden
masters (Gate 3, AC 1) and the comparison against the old sites (AC 28). Close 52 and take
Vitec's golden masters from the test account's real records on staging instead: an agent keeps a
representative set as `golden/vitec/` cases (payload, universal, display) for Patric's approval,
the protected path's gate; the parity inventory stays a human-supplied list (strategy §10, AC 28)
checked against Core's data. Smaller: yes, close 52 and take them from the test account. Or keep
the pairs.

## 54. Vitec on the test account: six things only a person in Vitec can set up

`[crm-vitec]` Core copies what Vitec sends, so nothing in Core waits on these; the sites'
templates do. One estate per case, set by a person in the Vitec test account, read off staging by
an agent: (a) a new-build project's homes appear in the marketed list with their `projectId`
(assumed on 2026-09-19, so a project page can list them); (b) whether the price text stays when
the price is hidden; (c) whether the area name stays when the address is hidden; (d) what status
a "till salu, visa som kommande" estate carries; (e) how each of the four bid settings shows in
`bidding`; (f) added 2026-10-04: **a demo or test customer the partner may write to**, with the
CRM function group (version 1, category CRM-Contact) granted on it, so the forms and the search
profile (`docs/forms.md`, 139) can be sent for real. The login in the environment reads a
client's production office (Patric, 2026-10-04), so no write ever goes there; it answers 200 for
the advertising group and 401 for the CRM group today. Smaller: (a) alone now, the rest when the
first client template needs them, (f) before the Vitec forms item.

## 80. `[client-wordpress]` Name the first client to port, once the default set is done

Norban is not a client port: norbanmakleri.se runs the default templates of plugin v2 and v3
unchanged, so it is the reference the default set "Kowboy 2026" is ported from (Patric,
2026-09-23), and its office is the test account staging already holds. Client ports start after
the set is done (next-steps item 17), through the automated workflow of
`docs/template-porting.md`. When the set is done, name the first client by the name Cloudways
lists its site, and give its CRM login if staging does not hold that account yet.

## 97. `[crm-vitec]` An agent's picture at width 1920 weighs 6 MB; the old site shows it at 1024

The field tables (approved 2026-09-19) build every image address on Kowboy's CDN at width 1920,
agents' pictures included. On the test account an agent's picture at that width is a 6 MB PNG
(the CDN scales the office's upload, a square PNG), while the same picture at width 1024, the
width norbanmakleri.se uses for agents, is 0.6 MB. On the set's pages the agent pictures are the
last to load, and a phone pays for 6 MB per agent shown. Smaller: the adapter builds an agent's
picture at width 1024 (a field-table change for `image` on an agent, approval needed), the
listings' photos stay at 1920. Or keep 1920 everywhere. Answer "1024" or "keep".

## 100. `[core]` kowboy.se has no email authentication for Postmark, so Gmail delays Core's mail (parked: Patric, 2026-09-28, "save this for later, this session is for template 2026 only"; his lead is to send from kowboy.cloud instead)

Postmark's page for the sign-in mail of 2026-09-28 says: "we recommend that you set up email
authentication for kowboy.se". Without it Gmail's server refuses Core's mail at first and takes
it minutes later (98). The fix is two DNS records on kowboy.se, which Postmark shows under Sender
Signatures, kowboy.se (a DKIM record and a Return-Path record). Only someone with access to
kowboy.se's DNS can add them; the agents have no such access.

**Patric, 2026-09-28:** mail must arrive, a delay is acceptable; "do I need to add the headers?"
The answer: yes, and they are DNS records, not headers, and nothing in Core changes. Without
them Google now takes the mail and shows it nowhere (98), so the records are what makes the mail
arrive at all, delayed or not. In Postmark, open Sender Signatures, kowboy.se, and it shows two
records (a DKIM record and a Return-Path record) to add at kowboy.se's DNS provider (Cloudflare
runs `dev.kowboy.se`'s names, most likely the whole domain); add them, then say "added". Or give
an agent a Cloudflare token limited to DNS for kowboy.se in the session environment's settings
as `CLOUDFLARE_DNS_TOKEN`, then say "token saved", and the agent adds them.

## 105. `[client-wordpress]` The two forms in the design: where a submission goes

"Ska du sälja din bostad?" (every page) and "Är du intresserad av bostaden?" (the single page)
post a name, a phone, an e-mail and a consent. Question 95 already asks whether the interest
form posts to the CRM. For 2026.2 the form block needs a destination now: an e-mail to an
address in the theme options (WordPress's own mail, no plugin; the interest form adds the
listing's address and agent), or the CRM per 95 when it is answered. Answer "email" or "crm".
The smaller option is e-mail, and 95 can move it to the CRM later.

**Patric, 2026-09-28:** "leave for now, they will send to CRM but we need to figure it out first
without blocking this." Open. An agent first stored submissions on the site and mailed them,
which Patric called a drift and had removed the same evening: the form is a dummy that posts
nowhere and whose button does nothing, until this is answered.

## 122. `[crm-vitec]` The area texts ("Område": läge, kommunikation, service, parkering) are empty for every record on the staging site

Every property and every area on the staging site (Vitec test office M31529) carries `surroundings`
with all five texts null, so the "Område" section of the property page and the texts of the area
pages never show (seen 2026-10-03 on Vildgåsvägen 19B and the area Dalhem through `?debugpl`).
The master site shows them. Either the advertising payload does not carry them (then the
adapter needs another Vitec call, like the documents of question 94) or the mapping reads the
wrong field. Default: the adapter session checks Vitec's payload for the area texts and maps
them; until then the section stays hidden, as it does now. Smaller: leave them out.

## 121. `[client-wordpress]` The staging site's WordPress login, so a session can put a change on it

The staging WordPress site (the app "v4-staging" on Cloudways) changes only when a session runs
`scripts/deploy-site.mjs` against it with the site's admin login, or when a `v*` tag publishes a
release to the update channel. A push to the `staging` branch alone changes nothing on the site
(2026-10-03: the punch list was in staging for half an hour and the site showed none of it). The
login lives in Cloudways, not in the agents' environment. Default: the login goes into the
project's cloud environment as `SITE_URL`, `WP_USER` and `WP_PASSWORD`, and a session puts every
change on the site right after saving it to staging. Smaller: Patric runs the script himself, or
asks for a release tag each time.

## 120. `[core]` The Cloudways token: the pair answers "incorrect credentials"

After the token move of 2026-10-03 (question 87, closed), `POST /api/v1/oauth/access_token` with
`CLOUDWAYS_EMAIL` and `CLOUDWAYS_API_KEY` answers 403 "The user credentials were incorrect", which
is not the earlier "insufficient_scope" (a valid but limited token) but a refusal of the pair
itself: the key is not the one Cloudways shows for that email, or the email in the environment is
not the account's. Nothing waits on it today: the staging site is installed through its WordPress
admin by `scripts/deploy-site.mjs`, not through Cloudways' API. In the Cloudways console, under
the account's API settings, copy the API key as it stands (or regenerate it), save it as
`CLOUDWAYS_API_KEY` in the session environment, check that `CLOUDWAYS_EMAIL` is the account's
sign-in email, then say "saved".

## 112. `[agents]` Default: after this collision, the register's numbers come from GitHub issues

Two sessions took the same numbers again: this session registered 87 to 97 on 2026-09-24 and
2026-09-28 (the tokens, the template package, the display fields, the fact tables, the
enumerations, the documents, the forms, the energy value, the agent picture) while the agent-setup
session registered 87 to 92 on 2026-09-27 (the DigitalOcean token, the shared rules, the reply
protocol, the hooks, the cooperation rules, the units of work). Both meanings stand, as the rule
says, and the register check reports 90 and 92 as used twice (87 and 89 to 91 of the other session
are answered and in the decisions). The agent-setup item in `docs/next-steps.md` planned the way
out for exactly this case: each question becomes a GitHub issue and takes the issue's number, and
the register file stays the readable view. Default: the next session makes that move (the open
questions become issues with their texts, the file lists them by issue number, `check-register`
reads the issues' numbers). Smaller: keep counting in the file and accept collisions. Answer
"no" to keep the file.
