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
3. **After Gate 2:** update `schemas/`, then build the Vitec adapter: mappers against golden
   masters first, then the fetch layer (bulk sync via the marketing endpoints, webhooks, catch-up)
   per strategy §5.3. Images and documents are ignored; a separate app serves the CDN.
   Status 2026-09-16: the fetch layer is built ahead of the mappers (`adapters/vitec/`: webhooks,
   fetch list, catch-up, comparison, health), and the mappers map the spine only. The descriptive
   mapping and `schemas/` wait for the field specification (item 2); golden masters for Vitec wait
   for Gate 3.
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

5. ~~**Standing request (Patric, 2026-09-16):** as soon as Vitec test credentials are in the
   environment, run `npm run build && node dist/scripts/vitec-probe.js`, settle open question 18,
   adjust the adapter if Vitec differs from its documentation, and delete the question.~~ Done
   2026-09-17: the probe ran read-only against Connect and the adapter follows what it found
   (paging from 0, Swedish wall-clock dates, the office record's own id); Patric closed 18: Core
   carries every estate, marketed or not, and the clients check the marketing flags. The probe
   stays as a diagnostic.
6. **Phase 1b, delegated (Patric, 2026-09-17).** With `DIGITALOCEAN_ACCESS_TOKEN` in the
   environment, an agent lists what already exists in Frankfurt and reports it before touching
   anything, creates the managed cluster (PostgreSQL 16, Frankfurt, `kowboy-core-db`, database
   `core`, user `core`) and the app from `.do/app.yaml`, generating `ADMIN_SECRET`,
   `CREDENTIALS_KEY` and `VITEC_WEBHOOK_TOKEN` itself (`openssl rand -base64 32` each) and storing
   them encrypted in the app, commits the spec DigitalOcean returns, and checks `/v1/health`. It
   hands Patric `ADMIN_SECRET` and `VITEC_WEBHOOK_TOKEN` once in the chat, for his password manager
   and the environment: agents need the first for admin calls, Vitec's subscriptions the second in
   the webhook URL (`adapters/vitec/README.md`). Then staging the same way. Blocked until the token
   is there.
7. ~~**Preview (AC 42).**~~ Built 2026-09-17 (Patric: the link comes from Vitec's preview button,
   and the site must have the change before the page opens): Vitec's landing page is answered by
   the adapter, the engine makes the site's preview link, and both clients pull before they answer
   it (`adapters/vitec/README.md`, "Previews"). Left for the templates, with the model (item 2):
   the page itself, shown through the link only while the estate's status is one Vitec previews
   and it is not marketed. Vitec is given the two preview URLs with the webhook URL (item 6).

## Later, when Patric supplies them

- A DigitalOcean token in the environment → item 6.
- Sentry DSN → replace the placeholder in `engine/errors.ts`.
- The WordPress plugin's field specification → item 2, then the Vitec mappers and `schemas/`.
- Mspecs documentation → second adapter.
- Rules ledger, parity inventory, real golden masters → Phase 5.

## Standing rules for every session

- Raise problems as a numbered list with an optional suggested solution; Patric decides by number.
  The numbers are the register `docs/open-questions.md`: next free number there, never reused,
  answered ones move to `docs/decisions.md`.
  Tag each item with its part: `[core]`, `[crm]`, `[crm-vitec]`, `[crm-mspecs]`, `[client-wordpress]`,
  `[client-lovable]`.
- A closed gate is not a note: build only what does not depend on it and leave the gap empty.
- Never invent a contract field or a business rule.
