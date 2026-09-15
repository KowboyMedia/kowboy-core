# Next steps

The standing to-do for any session. When Patric says **"Resume next steps"**, read this file, do
the first item that is not done, and keep the file current. Decisions and open questions live in
`docs/decisions.md` and `docs/open-questions.md`; this file is only the order of work.

## Now

1. **Fetch the Vitec Connect documentation** and save it as the spec of record under
   `docs/inputs/vitec/`: the advertising section
   (https://connect.maklare.vitec.net/Help/Section?id=advertising), the full datamodels (not the
   default limited ones), authentication and installation id, pagination, rate limits. If the fetch
   is refused with 403 from the proxy, tell Patric and carry on with whatever else is open. Status
   2026-09-15: still refused after the domain was allowed; the environment reaches github.com and
   registry.npmjs.org but not `connect.maklare.vitec.net` or `example.com`, so its policy is an
   allowlist and the Vitec host is not on it yet (open question 7). The other way in is to paste the
   pages into `docs/inputs/vitec/`.
2. **Propose the universal data model** from those documents, one field table per datatype
   (`property`, `agent`, `office`, `area`, `association`), every field traceable to a Vitec field or
   an SRS rule. Raise it as numbered issues for Gate 2. Do not touch `schemas/` until approved.
3. **After Gate 2:** update `schemas/`, then build the Vitec adapter: mappers against golden
   masters first, then the fetch layer (bulk sync via the marketing endpoints, webhooks, catch-up)
   per strategy §5.3. Images and documents are ignored; a separate app serves the CDN.
4. ~~**In parallel, approved:** the client sync loops in `clients/wordpress/` and
   `clients/lovable-kit/` per SRS §8 and Appendices A and B.~~ Done 2026-09-15: both loops, both
   bell endpoints, both backstops, the WordPress updater and WP-CLI, and one scenario suite that
   runs each real client against the real Core (`clients/README.md`). Open questions 10 to 14 came
   out of it and need answers. Templates, search, routing, the example Lovable site and the
   search/filter half of AC 20 wait for the model (item 3).

## Later, when Patric supplies them

- The platform (DigitalOcean App Platform, managed Postgres, EU) and its `DATABASE_URL` → Phase 1b.
- Sentry DSN → replace the placeholder in `engine/errors.ts`.
- Mspecs documentation → second adapter.
- Rules ledger, parity inventory, real golden masters → Phase 5.

## Standing rules for every session

- Raise problems as a numbered list with an optional suggested solution; Patric decides by number.
- A closed gate is not a note: build only what does not depend on it and leave the gap empty.
- Never invent a contract field or a business rule.
