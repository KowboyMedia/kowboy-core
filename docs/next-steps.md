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
3. **After Gate 2:** update `schemas/`, then build the Vitec adapter: mappers against golden
   masters first, then the fetch layer (bulk sync via the marketing endpoints, webhooks, catch-up)
   per strategy §5.3. Images and documents are ignored; a separate app serves the CDN.
   Status 2026-09-18: the fetch layer is built (`adapters/vitec/`: webhooks, fetch list, catch-up,
   comparison, health; the list defines what exists), and the mappers mirror the whole payload
   with the spine on top. `schemas/` stays permissive until the plugin's field names arrive;
   golden masters for Vitec wait for Gate 3.
4. ~~**In parallel, approved:** the client sync loops in `clients/wordpress/` and
   `clients/lovable-kit/` per SRS §8 and Appendices A and B.~~ Done 2026-09-15: both loops, both
   bell endpoints, both backstops, the WordPress updater and WP-CLI, and one scenario suite that
   runs each real client against the real Core (`clients/README.md`). 2026-09-16: bells are
   answered inside the WordPress request, the backstop is a bundled Action Scheduler action, the
   Lovable function chains itself, a `v*` tag publishes the plugin to a DigitalOcean Space, and
   the client criteria are in the acceptance report. Patric adds the Space variables and secrets
   to the repository before the first tag (`.github/workflows/release.yml`). Templates, search,
   routing, the example Lovable site and the search/filter half of AC 20 wait for the model
   (item 3).

5. ~~**Standing request (Patric, 2026-09-16):** run the Vitec probe as soon as test credentials
   are in the environment, settle open question 18 and adjust the adapter.~~ Done 2026-09-17: paging
   settled and the lister simplified, a made-up id is 404, and Patric closed the rest by scope:
   Core syncs what Vitec's list returns and nothing else, a Remove or an id gone from the list
   removes the record, and Core judges nothing (AGENTS.md, `docs/decisions.md`).

6. **Confirm on staging that Vitec sends a `Remove` when a listing is taken off the website**
   (Patric, 2026-09-17). Core removes the listing on that notification; if none came, the daily
   comparison against the list would remove it within a day. Needs: Vitec's subscription for the
   test account pointing at the staging app (estates advertised on the website only, `Update` and
   `Remove`), a Vitec connection on staging (an agent sets it up; needs a way in from chat first),
   and someone taking a listing off the website in the Vitec test account. The staging event log
   then shows the notification and the removal.

7. ~~**Admin panel** (question 29, yes 2026-09-18).~~ Built 2026-09-18: `/admin` on the web
   process with the eight panels of `docs/admin-panel.md`, the Vitec panel in
   `adapters/vitec/admin/`, tested as AC 42. Users and roles, and anything a site does, stay out.

## Later, when Patric supplies them

- The platform → Phase 1b. Done 2026-09-17: both apps are live on the cluster and every health
  check is green, `kowboy-core-staging` (the `staging` branch on every push, database
  `core_staging`) and `kowboy-core` (`main`, deployed when an agent asks on Patric's word,
  database `defaultdb`); both specs are committed back. Left: Vitec's subscriptions pointing at
  each app (Patric gives Vitec the URLs, handed over in chat), a Vitec connection on each app
  (item 6), Sentry, and question 27 on the release flow.
- Sentry DSN → replace the placeholder in `engine/errors.ts`.
- The WordPress plugin's field specification → item 2, then the Vitec mappers and `schemas/`.
- Vitec test credentials and a staging deploy → open question 18.
- Mspecs documentation → second adapter.
- Rules ledger, parity inventory, real golden masters → Phase 5.

## Standing rules for every session

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
- Never invent a contract field or a business rule.
