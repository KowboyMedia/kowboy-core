# Next steps

The standing to-do for any session. When Patric says **"Resume next steps"**, read this file, do
the first item that is not done, and keep the file current. Decisions and open questions live in
`docs/decisions.md` and `docs/open-questions.md`; this file is only the order of work.

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
   (R-001 to R-014, drafted for Patric's review) with a property's sections as data. Golden masters
   for Vitec still wait for the pairs of question 52.
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
    site's template, per the register.

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
- Rules ledger, parity inventory, real golden masters → Phase 5. The ledger's first fourteen entries are drafted (2026-09-19, for Patric's review); parity and golden masters wait for the pairs of question 52.

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
  `VITEC_ESTATE_ID` (the Vitec test account, `scripts/vitec-probe.ts`) and `GITHUB_TOKEN` (the
  repository, but not its settings: variables and secrets answer 403). There is no Sentry token.
  Values are never printed, logged or committed.
- A new session's branch starts from `main`, which is production and far behind `staging`
  (2026-09-19: a side session started 53 changes back and had to be combined afterwards). Before
  any work, a fresh branch is moved onto staging's latest and pushed
  (`git fetch origin staging && git reset --hard origin/staging`); a branch that already carries
  work merges `origin/staging` into itself instead. AGENTS.md and this file are read from there.
- Never invent a contract field or a business rule.
- Core parses no CRM data (AGENTS.md): every tag, slug, status, flag or formatted string is the
  site's, from the payload it stores. Never propose otherwise, in code or in chat.
