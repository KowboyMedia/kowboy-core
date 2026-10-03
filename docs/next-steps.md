# Next steps

The standing to-do for any session. When Patric says **"Resume next steps"**, read this file, do
the first item that is not done, and keep the file current. Decisions and open questions live in
`docs/decisions.md` and `docs/open-questions.md`; this file is only the order of work.

## Where to pick up (convergence point, 2026-09-23)

Everything up to 2026-09-23 is combined into staging. On 2026-09-24 one session built **the
default template set "Kowboy 2026"**, item 17 steps 1 to 3 and item 18, on the local WordPress
(`docs/default-templates.md`, "Built on 2026-09-24"), and it waits for Patric's answers 90 to 96 (89 closed on 2026-09-28: the set was rebuilt on the attached package)
and the tokens 87 and 88. "Resume next steps" means: act on whatever of 87 to 96 Patric has
answered (each answer names its work), then item 17 step 4 on `v4.dev.kowboy.se` once the
Cloudways token reads (88) and the sign-in mail arrives (98; the state of 2026-09-28 is under
item 17), then step 5's live run. Read `docs/default-templates.md` first (what the
set is, the scaffolding, the master, what stands, the comparison), `docs/field-tables.md` (the
universal names and `display`), `rules-ledger/` (R-001 to R-014 approved, R-015 to R-019
drafted), and `clients/wordpress/README.md` (the plugin the set plugs into). Items 6, 11, 13, 14,
16 and 22 wait on the things named in them and are not picked up by "resume". After the set: the
client ports (item 16, first client by question 80).

## Agent setup (from the 2026-09-27 review of how agents and Patric work together)

- ~~**Environment health at session start.**~~ Done 2026-09-27: `scripts/check-environment.mjs`
  asks DigitalOcean, Cloudways, the Vitec test account and Postmark whether their credentials still
  answer, and `.claude/hooks/context.sh` prints the result at session start.
- ~~**Skills for the repeated procedures**~~ Done 2026-09-27 as the playbook, which since
  2026-10-03 comes with the handbook plugin instead of living here; the template port of
  `docs/template-porting.md` becomes a skill when the first port runs.
- ~~**The handbook comes from the account, not from a copy**~~ (decision of 2026-10-01, question
  117). Done 2026-10-03: `KOWBOY-HANDBOOK.md`, `PLAYBOOK.md`, `.handbook/` and the nine skill
  folders under `.claude/skills/` are deleted, `CLAUDE.md` imports only `AGENTS.md`, and
  `AGENTS.md` and `README.md` no longer name the handbook file. Core's own hooks and
  `.claude/settings.json` stay. Patric chose to combine it into staging at once (question 118,
  2026-10-03), so the account's plugin is the only path for the shared rules from here on.
- **If register numbers collide again** after the register check, move the counter out of the
  files: each question becomes a GitHub issue and takes its number, the register file stays the
  readable view. Not before a collision is seen with the check in place.
- **Unattended sessions**, later: a scheduled "resume next steps" run when the gates are quiet, so
  work continues without Patric; the closed-gate rule already keeps such a run from inventing.

## Now

1. ~~**Fetch the Vitec Connect documentation**~~ Done 2026-09-16: `docs/inputs/vitec/` holds the
   advertising section, one page per endpoint, every model and enumeration those pages reach, the
   OpenAPI specification, the technical description (HTTP basic authentication with a key pair from
   the Connect portal, customer-id prefixes such as `M30011`, security), the notifications (the
   webhooks: subscriptions Vitec sets up, POSTs with `type`, `event`, `customerId`, `id`), the
   Extend API (the full model behind `?extend=`), previews and the migration notes. Refresh with
   `node scripts/fetch-vitec-docs.mjs`. Pagination is `paging.pageSize` and `paging.pageIndex` on
   the list endpoints; a rate limit is not stated anywhere in the documentation, and Patric confirmed there is none: the adapter runs five fetches at once, configurable (proposal point 10).
2. **Propose the universal data model** from those documents, one field table per datatype
   (`property`, `agent`, `office`, `area`, `association`), every field traceable to a Vitec field or
   an SRS rule. Raise it as numbered issues for Gate 2. Do not touch `schemas/` until approved.
   Status 2026-09-16: proposed in `docs/data-model-proposal.md` as the technical shape only:
   identity, relations, change date, scope, and everything else mirrored mechanically from the
   CRM (`docs/data-model-reference.md`, generated). Mappings, enumerations, search scalars and
   display strings are the rules-ledger phase, not Gate 2. Patric's answers of 2026-09-16 are worked in (relations, tenant scope, loose areas, `project` as a sixth datatype, no files, five fetches at once); three decisions at the proposal's end are Gate 2.
   Later on 2026-09-16 Patric chose the WordPress plugin's universal model over the mirror and
   approved `project` as the sixth datatype. The plugin's field specification was not attached, so
   the model waits for it; the sixth datatype is in.
   2026-09-18: the entire payload reaches the sites (question 28): `raw` in the envelope, `data`
   the mechanical mirror with the spine on top, both clients keep `raw`. The plugin's field names
   are laid on top as renames when the list arrives; `display` waits for the rules ledger.
   2026-09-19: Gate 2 passed. Patric approved the thin universal model (`docs/field-tables.md`,
   closing question 51) with the additions he named: the bid history with cancelled bids, every
   viewing, every image, the rooms, the whole `buildings[]`, and a project's homes by `project_id`;
   `schemas/` carries it.
3. **After Gate 2:** update `schemas/`, then build the Vitec adapter: mappers against golden
   masters first, then the fetch layer (bulk sync via the marketing endpoints, webhooks, catch-up)
   per strategy §5.3. Images and documents are ignored; a separate app serves the CDN.
   Status 2026-09-18: the fetch layer is built (`adapters/vitec/`: webhooks, fetch list, catch-up,
   comparison, health; the list defines what exists), and the mappers mirror the whole payload
   with the spine on top. `schemas/` stays permissive until the plugin's field names arrive;
   golden masters for Vitec wait for Gate 3.
   2026-09-19: the mappers copy and rename onto the universal names and keep the rest mirrored
   next to them, `schemas/` carries the names, and `display` comes from the first ledger entries
   (R-001 to R-014, approved by Patric the same day, question 53) with a property's sections as
   data. Golden masters for Vitec wait on question 52.
4. ~~**In parallel, approved:** the client sync loops in `clients/wordpress/` and
   `clients/lovable-kit/` per SRS §8 and Appendices A and B.~~ Done 2026-09-15: both loops, both
   bell endpoints, both backstops, the WordPress updater and WP-CLI, and one scenario suite that
   runs each real client against the real Core (`clients/README.md`). 2026-09-16: bells are
   answered inside the WordPress request, the backstop is a bundled Action Scheduler action, the
   Lovable function chains itself, a `v*` tag publishes the plugin to a DigitalOcean Space, and
   the client criteria are in the acceptance report. Before the first tag the Space must exist with an
   access key pair and the repository's settings must hold them (`.github/workflows/release.yml`:
   variables `DO_SPACES_BUCKET` and `DO_SPACES_REGION`, secrets `DO_SPACES_KEY` and
   `DO_SPACES_SECRET`); on 2026-09-19 neither the Space nor a Spaces key exists. An agent creates
   both with the DigitalOcean token when the first plugin release is near; storing the four values
   in the repository's settings is the one step for a repository admin, since the session's GitHub
   token cannot. Templates, search,
   routing, the example Lovable site and the search/filter half of AC 20 wait for the model
   (item 3). 2026-09-19: the model is in (item 2); the templates are item 10.

5. ~~**Standing request (Patric, 2026-09-16):** run the Vitec probe as soon as test credentials
   are in the environment, settle open question 18 and adjust the adapter.~~ Done 2026-09-17: paging
   settled and the lister simplified, a made-up id is 404, and Patric closed the rest by scope:
   Core syncs what Vitec's list returns and nothing else, a Remove or an id gone from the list
   removes the record, and Core judges nothing (AGENTS.md, `docs/decisions.md`).

6. **Confirm on staging that Vitec sends a `Remove` when a listing is taken off the website**
   (Patric, 2026-09-17). Core removes the listing on that notification; if none came, the daily
   comparison against the list would remove it within a day. Needs: Vitec's subscription for the
   test account pointing at the staging app (estates advertised on the website only, `Update` and
   `Remove`) and someone taking a listing off the website in the Vitec test account. The staging
   event log then shows the notification and the removal. Done 2026-09-18: the test account runs
   on staging, set up through the admin panel as tenant `kowboy-test`, connection `vitec-test`,
   office `M31529`; the full load finished within two minutes with 646 properties, 427
   associations, 56 areas, 6 agents, 5 projects and 1 office live, health green and the fetch list
   empty. Still needed: Vitec's subscription for the test account pointing at the staging app's
   webhook URL (it is on the panel's Vitec page), and the listing taken off the website.

7. ~~**Admin panel** (question 29, yes 2026-09-18).~~ Built 2026-09-18: `/admin` on the web
   process with the eight panels of `docs/admin-panel.md`, the Vitec panel in
   `adapters/vitec/admin/`, tested as AC 42. Users and roles, and anything a site does, stay out.
   The login is by email link since the same day (question 30: no shared password), mailed
   through Postmark (question 31); staging has the token, production gets it with the release.
   Checked 2026-09-20 on staging as Patric and in a browser against a local copy, every page and
   every button: two fixes followed, a recompute that failed in the web process (the mappers were
   not registered there) and event filters that showed a database error for a bad date or
   number; both are tests now. Later that day (Patric): the first page is a dashboard with
   figures and hourly charts, Items got figures, filters, a selection to recompute and a live
   activity list, the token is on the tenant's page, JSON is shown in a viewer, the email mask is
   gone, the texts are current and AGENTS.md keeps them so. Queued rows and "Update from CRM"
   wait on question 57 (two additive adapter capabilities); Patric recomputes staging's records
   himself (question 56). Same day, on Patric's third telling: a tenant is made and changed on
   one page and one flow (name, the CRM with its panel for the login and offices, the sites),
   with one Save; the tests and the browser walk drive that flow as a person would.
   Later that day Patric judged the panel below a professional product's bar and asked for the
   use cases, a catalogue of what comparable products offer, MoSCoW ratings and a rebuild
   proposal before anything is built: `docs/admin-panel-rebuild.md`, questions 59 to 61. His
   answer the same day: every Must and Should, from scratch, nothing carried over. Built and in
   staging on 2026-09-20: the admin API, the browser app under `admin/`, jobs, the live feed,
   alerts, the Vitec adapter's panel as data, and browser journeys as an enforced check
   (`docs/admin-panel.md`). Later that day Patric judged it a reskin: the pages, layouts and
   flows were inherited from the first build. The next rebuild starts from the requirement
   sheets, with the design approved before any code, and is not built until he says so
   (`docs/admin-panel-rebuild.md` §7, questions 62 to 65). Later still that day both panels
   were removed for good, the old operator endpoints and scripts cut (65), the public health
   check reworded to counts (62), every Vitec notification stored (63), pulls named by site,
   and a site's deletion made to take its history; the brief for the next panel is
   `docs/admin-panel-rebuild.md` §8 and the work is item 15.

8. ~~**Setup directions on each adapter's panel, and a licence notice in the plugin** (Patric,
   2026-09-18).~~ Done 2026-09-18: the Vitec panel opens with "Set up Vitec", kept true by
   `adapters/vitec/admin/directions.test.ts`; the plugin shows one notice in the site's admin
   while it is unlinked, its licence is off or its last sync failed; an inactive tenant gets no
   bell and no page, and every client keeps what it shows (scenario suite).
9. ~~**Link a site from its tenant's page** (questions 39 and 40).~~ Settled 2026-09-18: the
   token paste stays; a tenant's page holds its licence, token, connections and sites, and the
   global lists are overviews.

10. **Client templates on the universal model** (after Gate 2, 2026-09-19): the WordPress
    templates and the Lovable example site read the universal names and `display`
    (`docs/field-tables.md`), a property page renders `display.sections` as its fact tables, the
    regular property lists leave out a project's homes (those with a `project_id`), and the
    project's page lists them through the property-list shortcode filtered on the project id
    (Patric, 2026-09-19). Status and bidding come as sent; what a site shows for them is the
    site's template, per the register. 2026-09-19: the shape is settled (question 55): the shortcode
    gets a `project_id` attribute, and a list without one leaves out every property that carries a
    `project_id`. 2026-09-20: folded into item 12, `docs/default-templates.md`.

11. **The staging site** (Patric, 2026-09-20; strategy §4's staging WordPress site): plan in
    `docs/staging-site.md`. The blank WordPress site Kowboy sets up (Patric, evening), on
    Cloudways (question 66; nothing depends on the host), on the `kowboy-test` tenant staging
    holds, reached through the plugin's
    real update channel (a staging channel on the Space, published and tested by a post-deploy
    job on staging Core), driven over HTTPS through the WordPress API, Core's admin API and a
    staging-only driver, with a loop that runs until every client criterion a live site can prove
    is green; caches invalidated the WordPress way and proved once with the host's cache plugin
    (questions 67 and 68 closed). Waits on question 79 (the Cloudways API key); then the agent makes the site itself (item 16). The parts that need
    no answer may start: the plugin's updater changes, trash-then-delete, the ETag on record
    pages, the Space and the staging channel, the driver, the job.
12. **The default templates** (Patric, 2026-09-20; item 10 folds in): plan in
    `docs/default-templates.md`. A separate package per template set, `core-client-templates-2026`
    first (question 69 answered). Patric's strategy of the evening: the templates are written new
    to match the output of a WordPress site running plugin v3 with a client's data, page by page,
    on the blank site of item 11; the old plugin's files are never read (question 70 closed). The
    installer is decided: one upload, the updater placed by the plugin, updates through
    WordPress's own Plugins page, template sets installed from the plugin's settings page, the
    channels written by jobs on the Core apps. 2026-09-21: the two sites became a pair of environments
    per client made by the agent, item 16; 71, 73 and 74 are superseded. The package skeleton,
    the selector, the override rule, the installer and the release per set may start now.
13. **Documentation for implementers, people and agents alike** (Patric, 2026-09-20, recorded and
    not yet discussed): how to build a site on Core, what to keep in mind and what to recommend to
    the customer, written for an agent that reads the data as much as for a developer: absence
    means "do not show", what is the site's own decision, the query functions, viewings in the
    past, and the answer to question 72 once it is given. Planned when Patric says so.
14. **Hidden values and the listing state** (question 72, approved 2026-09-20, both parts): one
    ledger entry saying a prepared string is absent when the CRM says hide (price, address, bids,
    and whatever else a CRM flags), waiting on question 54 (b), (c) and (e) for how Vitec
    expresses each; and `state` as `{id, name}` on property and project, a few Core states mapped
    from the CRM's status by a ledger table with one row set per CRM, applied by the adapter,
    `status` untouched next to it; the field tables, `schemas/`, the rules and their tests, and
    AGENTS.md's "no status, no visibility" sentence amended to "only by ledger entries", all in
    one change for Patric's review through the protected paths.

15. ~~**Design the admin panel from the requirement sheets** (`docs/admin-panel-rebuild.md` §8)~~
    Done 2026-09-20 on Patric's word, "Admin area v3 build. Build the admin area as described."
    The design is `docs/admin-panel-design.md`: the pattern study (Airbyte, Stripe, Sentry,
    React-admin, Refine and shadcn/ui, read that day), the information architecture, and every
    Must and Should of §3 placed on a page. Built the same day: a JSON admin API under
    `/v1/admin/` in `engine/admin/`, and the app in `admin/` on Refine and shadcn/ui (question 64)
    served under `/admin` by the web process. Eight destinations: Overview, Flow, Records,
    Tenants, Runs, Events, CRMs, Settings. What it is, is `docs/admin-panel.md`. Proved by
    `acceptance/admin.test.ts` through HTTP and by thirteen browser journeys in `admin/e2e`, both
    named under AC 42. The Coulds of §3 are still not built and stay listed there.
    2026-09-21: the settings the area needs are on the staging app, on Patric's "allow"
    (`ADMIN_EMAILS`, who may open it, and `PUBLIC_URL`, where the sign-in link points); the three
    settings of the removed panels (`ADMIN_SECRET`, `ADMIN_EMAIL_DOMAINS`,
    `ADMIN_LOGIN_WITHOUT_EMAIL`) went with them, and the spec DigitalOcean returned is committed
    back. Question 75 is closed: AGENTS.md's layout map names `engine/admin/` and `admin/` as they
    are. Left: (a) Patric walks the area on staging once this change is there, and says what he
    would change. (b) Production has never held `POSTMARK_SERVER_TOKEN` or `PUBLIC_URL`, so its
    sign-in link cannot be mailed; both go on with the release, and that write needs Patric's
    "allow" for production the way every production write does.
    2026-09-21, the first round of Patric's own remarks, all built: Swedish dates and figures
    everywhere; **Remember this device** for thirty days, per device, with the devices listed on
    Settings and one button to forget the others; `ADMIN_EMAIL_DOMAINS` back with a new meaning —
    everyone at `kowboy.se` may sign in, and nothing on the sign-in page says so; a record's
    timeline as sentences with no payload in it, written by one engine module the Events page and
    Flow read too; honest danger, so fetching again and recomputing one record are plain buttons;
    a sentence on every adapter action, kept honest by a test (question 76); Runs renamed
    **Manual sync**; one scope picker — tenant, connection, office, entity — on both Manual sync
    and Records, where nothing is typed any more; "select all" meaning every record the search
    matches, on pages of 500; a stored login tried by Core itself, with the secret nowhere in the
    page; and a **Go to…** button that spells out the keys of the palette.
    2026-09-21, the addresses: both apps now carry their own domain on App Platform,
    `core.kowboy.cloud` and `staging.core.kowboy.cloud`, and DigitalOcean is waiting for the two
    CNAME records in the `kowboy.cloud` zone at Strato (`core` → `kowboy-core-wyvhr.ondigitalocean.app`,
    `staging.core` → `kowboy-core-staging-t7ig3.ondigitalocean.app`), which only Patric can add.
    Both records were added the same afternoon, DigitalOcean issued both certificates by itself,
    and both addresses answer: `https://core.kowboy.cloud/v1/health` and
    `https://staging.core.kowboy.cloud/v1/health`. `PUBLIC_URL` points at the new address on each
    app, so the sign-in link and the links in alerts carry it; production holds it for the first
    time, though it still cannot mail a sign-in link until it has the Postmark token. The
    `*.ondigitalocean.app` addresses keep answering as well, so Vitec's subscriptions are
    untouched; the new notification URLs are the same paths on the new addresses, for whenever
    Vitec is given them.

16. **Porting any client's templates to version 4** (Patric, 2026-09-21): plan in
    `docs/template-porting.md`. 2026-09-23: client ports start after the default set (item 17) is
    done; norbanmakleri.se is that set's reference, not a client port, and the first client is
    named then (question 80). Three kinds of port share the one workflow, the default set, a Kowboy client on plugin v1 to
    v3, and a site that never ran Kowboy; the shared work is mapping every field by intention. One porting server with a pair of sites per client, the source a
    copy of the client's live site with the old plugin, the target a copy with Core's plugin and
    the client's template set, made through the host's API, compared page by page and iterated
    by an agent until the target shows the same; gaps raised by step 2's rule. Cloudways (question
    75, 2026-09-21); waits on question 79, the Cloudways API key in the agents' environment.
    After that nothing needs a person except a client's CRM login the first time it reaches
    staging.
    2026-09-21, later: the two variables exist, but the token was made with a limited scope and
    Cloudways refuses every account call (`insufficient_scope`), so nothing was made: question 81. The same day Patric asked for the default set, "Kowboy 2026", to be written against
    three apps on `dev.kowboy.se` (plugin v2, plugin v3 and Core's plugin, each with the Vitec
    test account and the default plugin templates) instead of a client's pair; the differences
    from the stored plan are questions 82 to 85 (`docs/template-porting.md`, "The default set").
    Patric's answers the same evening: the default set is its own concern, item 17; this item
    keeps the client ports, starting with question 80. The token was replaced the same evening
    (81 closed); a running session keeps the environment it started with, so the next session
    is the first to use it.

    **Resuming in a new session, once question 79 is answered**, in this order:

    1. Check the environment: `CLOUDWAYS_EMAIL` and `CLOUDWAYS_API_KEY` exist (values never
       printed). Get a token from the Cloudways API (`https://api.cloudways.com/api/v2/…`; v1
       retired in March 2026; email and key in, a short-lived bearer token out) and list the
       account's servers and apps, so the session knows which client sites live there and
       whether the porting server already exists. The exact calls are read from the API
       reference with the key in hand; `docs/template-porting.md` names what they must do.
    2. If no porting server exists: make one in the account (DigitalOcean underneath, Frankfurt,
       the smallest 2 GB size, name `kowboy-porting`), and write its id and address into
       `docs/template-porting.md` under a new "The server" heading.
    3. Make the first pair for the first client (question 80): copy the client's live app to the
       porting server as `<client>-source`, password-protect it, keep search engines out, stop
       its mail and, where its old plugin has the switch, its CRM polling; copy it again as
       `<client>-target`, read both apps' WordPress logins from the API, and on the target
       replace the old plugin with Core's plugin, the staging-only driver and the client's
       template set, install the updater, and point it at staging Core with a tenant for that
       client (the client's CRM login from Patric if staging does not hold it; the tenant page
       gives the token and the bell secret).
    4. Then item 11's loop (the Space and the staging channel, the driver, the packaging-and-
       smoke job on staging Core, the first sync visible in a browser) and this item's steps 2
       to 6 (inventory, port, compare, gaps, delivery).
    5. Write every id, address and login location (never a secret) into `docs/template-porting.md`
       as it is made, so the next session finds it there.

17. **The default set "Kowboy 2026"** (Patric, 2026-09-21; questions 82 to 85 closed, 85 on
    2026-09-23: the master is norbanmakleri.se as it runs live, so the v2 and v3 apps are not
    needed): `docs/default-templates.md`, "The scaffolding" and "How the default set is made".
    The target is `v4.dev.kowboy.se` on the Cloudways server `*.dev.kowboy.se` points at, with
    Core's plugin, the set `kowboy-2026` and staging Core's tenant `kowboy-test` (the same office
    as Norban, `M31529`); until it stands, the local WordPress of the test suite is the target.
    In this order:
    1. The set's skeleton (`clients/wordpress/templates/kowboy-2026/`), the selector, the
       override rule, the installer and the release per set; the query function in the sync
       plugin (item 12's parts that needed no answer).
    2. The templates, one file per view by the scaffolding decision: the v4 package's markup
       flattened to plain HTML, sliced per file, a logic block on top; its CSS and JavaScript in
       the set's assets; shadow DOM as the setting; the first page of a list rendered on the
       server and hydrated by one reload on load; the parameter set passed through untouched.
    3. The display fields, first attempt (item 18), in the same go.
    4. The loop, norbanmakleri.se against the target: the for-sale list, the sold list, the
       cards, the object pages and the agent pages first, then the rest; every gap in the model
       or the helpers as one row of the numbered table in chat.
    5. AC 28 and AC 20's search half, the report regenerated.
       **State 2026-09-24:** steps 1, 2, 3 and 5 done, step 4 done against the master on the
       local WordPress (the gaps are questions 91 to 96); `v4.dev.kowboy.se` waits on the
       Cloudways token (question 88: the token in the environment still answers
       `insufficient_scope`, most likely because the two tokens sit in each other's slot, 87). A
       new session with a working token finds the server behind 165.22.87.59, makes
       `v4.dev.kowboy.se`, installs the plugin and the set from the branch, links it to staging's
       tenant `kowboy-test`, runs the comparison there, and writes id, address and where the login
       lives into `docs/default-templates.md`; never a secret.
       **State 2026-09-28:** Patric: the set "does not look correct at all", the fields might be
       right, and the loop is to run on a real site so an agent can iterate on the look. The
       app "v4-staging" was made on the dev server (application 6698706 on server 1545003), and
       `scripts/deploy-site.mjs` installs the plugin and every set on any site through its
       WordPress admin (proved on a local copy). The same evening Patric pasted the app's
       address (`wordpress-1545003-6698706.cloudwaysapps.com`) and its login, and Postmark's
       record: the sign-in mail arrives, nine minutes late (98 closed, 100 registered). The
       plugin's PHP requirement is now 8.2, Patric's pick of compatibility over a newer floor
       (99 closed), and the plugin and the set are installed and active on the site, the settings
       written. `v4.dev.kowboy.se` is not needed (88 closed). Staging Core's sign-in mail is
       taken by Google and shown nowhere (98; the fix is the DNS records of 100), so the site is
       joined to `kowboy-test` as soon as Patric pastes a sign-in link from Postmark's message
       page: add the site, write token and bell secret into its settings with the deploy script,
       ring it: all done the same night, with the pasted link. The site holds every record of
       the test office, speaks Swedish, and its pages answer (`docs/staging-site.md`, "The loop
       as it runs"). Next: the page-by-page loop against norbanmakleri.se with
       `scripts/shoot-site.mjs`, and question 101 (the slug rule) when Patric answers it.
       **State 2026-10-03:** Patric answered 90 to 96: the drafted strings and the golden
       masters are validated, the comma stays, the fact tables follow the master's sections
       (R-013 rewritten, the three property golden masters regenerated), the three coded
       association values carry their names, documents come from both the home and its
       association with their CDN address and the set lists them under "Dokument", the energy
       row shows only with a value, and the booking button and the lead form are item 21. Open
       from this round: 119 (the decimals of an association's share). Next: the page-by-page
       loop on the staging site.

18. **The display fields, first attempt** (Patric, 2026-09-23): for every value
    norbanmakleri.se shows on a card, a list or a single page, the prepared string `display`
    must carry, named by intention (`display.living_area` may read a little differently on
    another set, the intention is the same). An agent drafts the whole list from the site's
    output against staging's records for the same objects, as ledger entries and golden
    masters (`golden/vitec/`, question 52), and Patric validates every one himself, in one
    review. Done together with item 17 step 3. **Drafted 2026-09-24:** R-015 to R-019, eight
    golden cases, question 90. **Validated 2026-10-03** (Patric, "90 a"): done.

19. **A porting factory, exploration only** (Patric, 2026-09-23): whether a skill or workflow
    inside Claude Code can run a port from two inputs, a source and a target, asking its
    questions, approvals and assumptions in batches and reporting the differences a client must
    know; how it would be packaged. Planned when Patric says so, after items 17 and 18.

20. **The set "Kowboy 2026.2" from the Figma design** (Patric, 2026-09-28; supersedes item 17's
    look): `docs/kowboy-2026.md` holds the pages, the sections, the shape (one theme) and the
    order of work. **State 2026-09-28, night:** built, set to the file's values, reviewed by a
    second agent and fixed, combined into staging (the change #61); the review's fixes wait on
    the session's line for the next combine. The phone layout checked against the file's phone frames
    and fixed. Open: 105 (the forms are dummies, and the phone frames draw the sell form's fields
    differently from the desktop frames) and the site's own content (pictures, logotype,
    address).

21. **The booking button and the interest form** (Patric, 2026-10-03, question 95: "separate, add
    them to todo list"): on norbanmakleri.se a viewing has a "Boka här" button that opens the
    CRM's booking page for that viewing, and every property page ends in a form that posts a lead
    to the CRM. Neither is data the adapter copies: the booking address is built from the CRM's
    ids, and the lead needs a Core endpoint that forwards to the CRM (Connect has `POST
…/interest`), an adapter capability nothing in `engine/adapter-api/` offers yet. Plan first
    (a generic engine capability any adapter could use, approval needed), then build; the set
    shows viewings without a button and no form until then. Question 105 (the design's two forms)
    is settled in the same item.

22. **Offices and agents typed on the site** (Patric, 2026-10-03: "add offices and agents inside
    the wp admin, not fetched from the CRM"; the strategy with both homes in
    `docs/site-records.md`). Waits on questions 125 (where they live), 126 (a typed agent the CRM
    later carries) and the Default 128; 127 (a CRM record changed on the site) is the look-ahead
    and waits in the register. Not started.
    - **Component:** `[client-wordpress]`, the sync plugin. With 125 (b) the item is reshaped into
      a `[core]` item (a manual adapter) and a plugin item, in that order.
    - **What changes for the product:** an administrator adds an office or an agent the CRM does
      not carry, in the Kowboy Estates menu, and the site shows it in the same lists and pages as
      the CRM's, ordered and hidden by the same staff-list rule; CRM records stay read-only.
    - **The tests that prove it** (`clients/wordpress/templates.test.ts`, against the real
      WordPress): "a typed agent lists among the CRM agents by its order number and on its
      office's page"; "a typed agent hidden by its staff-list switch is in no list and on its own
      page"; "a rebuild keeps every typed record and deletes nothing of the site's own"; "an
      administrator adds and edits a typed agent and cannot edit a CRM agent" (through the
      admin's capabilities); "a deleted typed record is gone from the index". The acceptance
      criterion is proposed with the item and numbered on approval.
    - **Interface touched:** none of Core's. The plugin's index gains no column: the site's own
      rows use the connection `site`, and the rebuild's sweep skips them.
    - **Unknowns, a time-boxed spike first:** whether WordPress's capability map lets a type allow
      "Add New" while every CRM post of the same type stays locked per post (`create_posts` is per
      type, `edit_post` per post through `map_meta_cap`); proved by the admin test above before the
      form is built.
    - **Decides:** 125, 126. **Defaults:** 128 (the form's fields, any office for a typed agent,
      the typed order number places the agent among the CRM agents, administrators and editors
      edit, draft means not shown).
    - **Does not do:** a CRM record changed on the site (127, later); the Lovable kit; responsive
      sizes for a library portrait (one size first, WordPress's own sizes a few lines later);
      typed properties, areas, associations or projects.
    - **Size:** one session.

## Later, when Patric supplies them

- The platform → Phase 1b. Done 2026-09-17: both apps are live on the cluster and every health
  check is green, `kowboy-core-staging` (the `staging` branch on every push, database
  `core_staging`) and `kowboy-core` (`main` on every merge, database `defaultdb`); both specs are
  committed back. Left: Vitec's subscriptions pointing at each app (Patric gives Vitec the URLs,
  handed over in chat), a Vitec connection on production (staging has one since 2026-09-18, item
  6), and Sentry. The database cluster accepts connections only from the two apps (question 33,
  2026-09-18).
- Sentry: wired into Core 2026-09-18 (question 36); the DSN is on staging, production gets it with the release. The same error leaves once a day whichever process hits it, and at most twenty distinct errors a day per app, for the 5,000-a-month plan; the sites' errors go through the same gate since 2026-09-19 (question 46). Left: an uptime alert on production's `/v1/health` (an auth token for an agent, or a click in Sentry), and projects for the two clients.
- ~~The universal field names (question 51: drafted for Patric's correction, or sent by him) → item 2, then the Vitec mappers and `schemas/`.~~ Done 2026-09-19 (item 2).
- Vitec test credentials and a staging deploy → open question 18.
- Mspecs documentation → second adapter.
- Rules ledger, parity inventory, real golden masters → Phase 5. The ledger's first fourteen entries are approved (2026-09-19, question 53); parity and golden masters wait on question 52.

## Standing rules for every session

- Before a push, one full run: `npm run typecheck` (TypeScript and Deno, not `tsc` alone), seam,
  secrets and build, then `npm run report` (both suites once, and the report with them). Not
  `npm test`, the WordPress suite and the report as three runs.

- Raise problems as a numbered list with an optional suggested solution; Patric decides by number.
  The numbers are the register `docs/open-questions.md`: next free number there, never reused,
  answered ones move to `docs/decisions.md`.
  Tag each item with its part: `[core]`, `[crm]`, `[crm-vitec]`, `[crm-mspecs]`, `[client-wordpress]`,
  `[client-lovable]`.
- A closed gate is not a note: build only what does not depend on it and leave the gap empty.
- Writes to the DigitalOcean account that touch production (creating or changing the production
  app, asking for a deployment) are refused by the session's permission classifier until Patric
  says "allow" in chat; the agent then adds `Bash(python3 *)` and `Bash(curl *)` to
  `.claude/settings.local.json` (gitignored), does the work, and removes them again.
- The session environment carries API access as environment variables, and agents use it
  themselves instead of asking Patric for a console (verified 2026-09-19): `DIGITALOCEAN_ACCESS_TOKEN`
  (the account with both apps; their addresses come from `GET /v2/apps`; production writes wait
  for "allow" as above), `VITEC_USERNAME`, `VITEC_PASSWORD`, `VITEC_OFFICE_ID` and
  `VITEC_ESTATE_ID` (the Vitec test account) and `GITHUB_TOKEN` (the repository, but not its
  settings: variables and secrets answer 403); `CLOUDWAYS_EMAIL` and `CLOUDWAYS_API_KEY` once
  Patric adds them (question 79): the porting server and every site on it,
  `docs/template-porting.md`. There is no Sentry token. Values are never printed, logged or
  committed. Nothing but web traffic leaves the environment: no SSH, no SFTP, on any port
  (checked 2026-09-21).
- A new session's branch starts from `main`, which is production and far behind `staging`
  (2026-09-19: a side session started 53 changes back and had to be combined afterwards). Before
  any work, a fresh branch is moved onto staging's latest and pushed
  (`git fetch origin staging && git reset --hard origin/staging`); a branch that already carries
  work merges `origin/staging` into itself instead. AGENTS.md and this file are read from there.
  The rule is right as long as live lags staging; the release flow of 2026-09-18 (checks,
  staging, then live on Patric's word) is the final one and only its last step has gone unused:
  nothing has been promoted to live since 2026-09-18. When Patric says "release", an agent
  promotes staging to live, and a session started from live is then no worse off. On 2026-09-21
  two sessions ran side by side and one of them (`brave-gates`) was never combined with
  staging until 2026-09-23; a session ends by combining, always.
- Never invent a contract field or a business rule.
- An ask to Patric is one line, what is needed and how to answer, with the whole reasoning in the
  register entry; technical choices are never asked (AGENTS.md "Working with Patric", 2026-09-20).
- Core parses no CRM data (AGENTS.md): every tag, slug, status, flag or formatted string is the
  site's, from the payload it stores. Never propose otherwise, in code or in chat.
