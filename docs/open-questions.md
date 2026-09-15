# Open questions

Everything an agent could not settle from the Concept, the SRS, the strategy or the rules ledger.
Each one names what is blocked and what the smaller option would be, so answering is quick.
Answered questions move to `decisions.md` and are deleted from here.

## 1. Gate 2 cannot be held yet: there is no data model to approve

`docs/field-tables.md` no longer proposes a model. The invented fields are gone, the contract is
the structural spine, and the schemas say `INCOMPLETE`.

Defining the real model needs the CRM data models (question 7), the parity inventory and the rules
ledger. Until then Gate 2 has nothing to approve, and building the clients or the adapters against
this contract means building against identity and references only.

## 2. Protected paths created by an agent

`schemas/`, `acceptance/` and `golden/fake/` did not exist before. CODEOWNERS now protects the
first two, so this is the one time they are created without a prior review. They need your read.

## 4. Where an adapter keeps its own tables

The strategy says an adapter owns its queue, dedupe and retries "in its own tables", and that
adapters know nothing about engine storage. The adapter API offers no database handle, so a real
adapter would open its own connection pool to the same Postgres. The fake adapters keep their
fetch list in memory, so nothing was decided by accident. Two options when Vitec is built:

- **a.** The adapter opens its own pool from `DATABASE_URL` and owns its migrations. No change to
  the adapter API.
- **b.** The adapter API gains a scoped SQL handle for adapter-owned tables. That is an adapter API
  change, which needs approval.

Option a is smaller and needs no approval, so that is the default unless you say otherwise.

## 5. There are no business rules, and none can be written yet

`engine/rules/run.ts` computes nothing. It guarantees `display` exists and gives rules one place to
live. Earlier it formatted prices, areas, room counts, addresses and slugs; all of that was
invented from the SRS's illustrative example and has been removed.

A rule needs two things first: a field to compute over, and a ledger entry saying what the output
should be. `rules-ledger/` is protected and empty, so nothing can be written until an entry exists.

## 6. Images, when the model is defined

Kowboy serves images through a separate CDN app. The SRS says images are CRM CDN URLs with a sort
order (§6.6), but there is no image field in the contract today and none will be added on a guess.
When the model is defined, say whether Core carries image URLs at all or leaves them out entirely.

## 7. Vitec Connect documentation is unreachable from this environment

**Update 2026-09-15:** still refused after the domain was allowed. The proxy passes github.com,
api.github.com, raw.githubusercontent.com, registry.npmjs.org, jsr.io and packagist.org, and refuses
`connect.maklare.vitec.net`, `example.com`, `wordpress.org` and `deno.land`, so the policy in force
is an allowlist and the Vitec host is not on it. Worth checking: whether the change was saved on the
environment this branch's sessions use, and whether a new session picked it up.

`https://connect.maklare.vitec.net/Help/Section?id=advertising` is refused by the environment's
network egress proxy, which answers 403 to the CONNECT before any request is made. **No approval
prompt can appear for this**: the block is the environment's network policy, chosen when the
environment was created, not a per-tool permission this session can ask for.

Two ways to unblock, either is fine:

- **Allow the domain.** The environment's network policy is edited where the environment is
  configured (claude.ai/code → environments); `connect.maklare.vitec.net` needs to be reachable.
  Documented at https://code.claude.com/docs/en/claude-code-on-the-web.
- **Paste the documentation in.** Save the relevant pages into `docs/inputs/` as a human-supplied
  spec. That is the path AGENTS.md already describes for anything from outside.

Either way, what is needed is: the marketing endpoints, how to ask for the full datamodel rather
than the default limited one, authentication and the installation id, pagination, and rate limits.

## 8. Phase 1 cannot exit without the platform

Phase 1's exit is a real PR → staging → production deploy, and AC 18, 24, 27 need a live
environment. The app is built to run on DigitalOcean App Platform with managed Postgres, but
nothing is deployed. Phase 1 is split in the strategy into Foundation (done) and Deploy (waiting
on you).

## 9. The adapter API cannot stamp an adapter's own events

`logEvent(type, fields)` writes a row with no correlation id and no entity reference, so an
adapter's own events (a webhook arriving, a CRM call and its timing) cannot be linked to the write
they caused. `ingest` does take a correlation id, so the chain works from the fetch onwards, and
the fake adapter proves it.

AC 16 asks for one query returning the whole timeline **across webhook, fetch, CRM call, write,
bell and pull**. Meeting it fully needs one added argument:

```ts
logEvent(type, fields, context?: { correlationId?, connectionId?, datatype?, remoteId? })
```

That is an adapter API change, so it needs approval (E3). It is additive and breaks no caller.

## 10. Action Scheduler or WP-Cron for the WordPress client

SRS Appendix A says the bell "schedules the sync via Action Scheduler". Action Scheduler is a
library the plugin would have to ship, which makes it a new runtime dependency (AGENTS.md: ask
first). The plugin was built without it: a bell leaves a note for any running sync, schedules a
WP-Cron event and spawns cron; the 15 minute backstop is a WP-Cron event. Both paths are proved by
the scenario suite. Action Scheduler would add a visible log of runs and retries at the cost of the
dependency. Decide: keep WP-Cron (nothing to do) or add Action Scheduler (approval).

## 11. Where WordPress plugin releases live

Safe update is built: a must-use plugin points WordPress's own updater at a release JSON,
`{"version": "…", "package": "https://…/core-client-x.y.z.zip"}`, named by
`CORE_CLIENT_UPDATE_URL` in `wp-config.php`. Two things are assumed and need your word:

- The JSON format above, and that WordPress's own updater does the swap (no custom swapping code).
- Hosting. Proposal: the release pipeline (Phase 1b) publishes `core-client.zip` and
  `core-client.json` as GitHub Release assets of this repository, and the plugin header's
  `Update URI` and `Plugin URI` use `https://kowboy.se/core-client` as the plugin's identity.

## 12. Client acceptance criteria in `acceptance/criteria.json` (protected)

The scenario suite proves the client halves of several criteria. `acceptance/criteria.json` is
protected, so the mapping is proposed here rather than written. Each test name exists twice, once
per client, prefixed `the Lovable kit against Core >` and `the WordPress client against Core >`:

| AC  | Test                                                                       | Note                                                                  |
| --- | -------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 8   | `keeps its copy and reports the failure when Core is down (AC 8)`          | The loop half: the copy stays. Page rendering needs templates.        |
| 10  | `stores a field it has never seen, verbatim (AC 10, AC 30)`                |                                                                       |
| 20  | every scenario in `clients/sync-scenarios.ts`                              | The sync half. The search/filter half needs the model.                |
| 21  | `the WordPress client > lets the must-use updater offer a newer release …` | The Lovable half is structural: function and site deploy separately.  |
| 22  | `converges on its own schedule when bells never arrive (AC 22)`            | Now proved on the real clients' own backstops, not only the fake one. |
| 30  | `skips an item it cannot use, and keeps going (AC 30)` and the AC 10 test  | Sentry reporting is the placeholder, as in Core.                      |

Say yes and the file gets these lines and the report is regenerated.

## 13. Supabase edge function limits for very large first syncs

A Supabase function invocation has a wall-clock limit (minutes, plan-dependent). The sync commits
every page with its cursor, so a run cut short loses nothing and the next bell or 15 minute run
carries on; a 300k-property first load would simply take several runs. If that is too slow for a
large Lovable tenant, the function can re-invoke itself when it stops on a time budget. Not built:
no such tenant exists yet.

## 14. WordPress tests need WordPress and MariaDB on every machine

`npm run test:wordpress` needs a WordPress checkout and a MariaDB or MySQL database
(`clients/wordpress/test/setup.sh`, about a minute). CI has its own job for it. A cloud session
has to run the setup once before it can run that suite; a SessionStart hook could do it
automatically. `npm test` itself stays self-contained: the Lovable suite runs under Deno from npm.
