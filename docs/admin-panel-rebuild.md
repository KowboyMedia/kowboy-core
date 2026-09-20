# Admin panel: the rebuild (register questions 59 to 61, answered 2026-09-20)

Patric, 2026-09-20: the panel as first built worked but read as a hobby project: full-page
reloads, no word after a save, a search that could not sort, inconsistent panels, journeys that
took thought, and core functions missing (recompute everything, an office, a tenant, a CRM). This
file was the discussion piece: what the panel is for, what comparable products offer, every
function rated with MoSCoW, and how to build it to the standard of a professional product in 2026. Patric's answer the same day: **implement every Must and every Should, list the Coulds,
build from scratch on best practices with nothing carried over (a hard rule), and list any
significant gap with a suggestion.** Section 6 says what was built and what the gaps are;
`docs/admin-panel.md` describes the panel as it is.

## 1. What the panel is for

The people at the panel are Kowboy's operators: Patric and the agents, later a support person.
Customers never see it (decision 2026-09-18: the panel stays people-only, agents keep the API).

| #   | Use case                                                                                                                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U1  | **Onboard a customer.** Make the tenant with its CRM login, offices and sites in one go, watch the first load finish, hand the token and the bell secret to the site.                                                                                                       |
| U2  | **Keep it healthy.** Know within minutes when something is red (the worker, an adapter, a refused office, a site that stopped pulling), see why, and act from there.                                                                                                        |
| U3  | **Support a customer.** "Why is listing X missing or wrong on their site?" Find the record, see the CRM's payload, the unified record, the display strings and the timeline from the CRM's notification to the site's apply; fetch it again or recompute it; ring the site. |
| U4  | **Release safely.** After a ledger or mapping change: preview the impact, recompute a scope or everything with progress, verify, and see what changed.                                                                                                                      |
| U5  | **Watch the flow.** What is happening now and over the day: records in, calls to the CRMs, bells, pulls, what is queued, what failed, per tenant.                                                                                                                           |
| U6  | **Licences and secrets.** Disable or enable a tenant, rotate its token or a site's bell secret, see who logged in and what they did.                                                                                                                                        |
| U7  | **Configure an adapter.** The notification URL to give the CRM, its settings, the second CRM when it comes.                                                                                                                                                                 |
| U8  | **Try things without leaving the browser.** Pull as a site, look at a CRM record raw and unified, dry-run a recompute, replay a notification.                                                                                                                               |

## 2. What comparable products offer

Three families set the bar. What they have in common is the catalogue in section 3.

- **Sync and integration platforms** (Airbyte, Fivetran, Nango, Merge): a connection page with a
  status tab (health per stream, records loaded per run), a timeline of connection events, logs
  per attempt with retries, "sync now" and "reset", per-stream on/off, notifications by email,
  Slack or webhook on failure, usage and quotas. Airbyte's connection page shows the last syncs'
  stream status and records loaded, a timeline of events, downloadable logs per attempt, and
  retries per attempt ([Airbyte connection status](https://docs.airbyte.com/platform/cloud/managing-airbyte-cloud/review-connection-status),
  [connection timeline](https://docs.airbyte.com/platform/cloud/managing-airbyte-cloud/review-connection-timeline),
  read 2026-09-20).
- **Developer consoles** (Stripe, Postmark, Sentry): an event log with filters and a timeline per
  object, webhook attempts with resend, request logs with search, a test mode, API keys with
  rotation, alerts, an audit log of the team's actions, command palette, keyboard shortcuts, dark
  mode.
- **Admin frameworks** (React-admin, Refine, Filament, Django admin): lists with server-side sort,
  filter, search and paging, column chooser, bulk actions, forms with validation, undo and toasts,
  relations, dashboard widgets, live updates, saved filters, CSV export, roles and permissions,
  responsive and accessible by default. Refine is MIT and headless with live updates and
  notifications built in and integrations for Ant Design, Material UI, Mantine, Chakra or any
  Tailwind design ([Refine on GitHub](https://github.com/refinedev/refine),
  [Refine licence](https://refine.dev/docs/further-readings/license/), read 2026-09-20).
  React-admin's core is MIT, but its realtime and audit-log packages are part of the paid
  Enterprise Edition ([React-admin ecosystem](https://marmelab.com/react-admin/Ecosystem.html),
  [ra-audit-log](https://react-admin-ee.marmelab.com/documentation/ra-audit-log), read 2026-09-20).

## 3. Every function, rated (MoSCoW)

Must: without it the panel is not the product. Should: expected of a professional tool, built
right after the Musts. Could: nice, when there is time. Won't: not now, on purpose. Size is a
rough effort: S a few hours, M a day or two, L several days. "Built" means it exists in today's
panel and carries over in the new form.

### A. Onboarding a customer (U1)

| Function                                                                                                                                                 | Rating | Size  | Note                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----- | ---------------------------------------------------------- |
| One page for a tenant: name, licence, the CRM chosen from a list with its panel (login, offices), the sites one or many, one Save; edit is the same page | Must   | built | Keeps the flow of 2026-09-20.                              |
| Save without a reload, a toast saying what happened (made, loading, secrets ready), errors shown at the field                                            | Must   | S     | The thing missing today.                                   |
| Checks while typing: required fields, URL shape, offices shape, a login half filled                                                                      | Must   | S     |                                                            |
| Copy buttons for the token and the bell secrets, with "copied"                                                                                           | Must   | S     |                                                            |
| "Check the login" before saving: the adapter tries the CRM with the typed login and says yes or no                                                       | Should | M     | Needs a generic adapter capability (a probe); question 61. |
| First-load progress on the tenant page: records per datatype, done or failed, how long it took                                                           | Should | M     | Comes with jobs (D).                                       |
| A tenant with one or several CRMs, of the same or different kinds                                                                                        | Must   | M     | Moved from Could by Patric, 2026-09-20.                    |
| Archive a tenant (hide it, keep its data 90 days)                                                                                                        | Could  | S     | Today: licence off and "Remove everything".                |

### B. Health and monitoring (U2, U5)

| Function                                                                                       | Rating | Size  | Note                                                                                  |
| ---------------------------------------------------------------------------------------------- | ------ | ----- | ------------------------------------------------------------------------------------- |
| Dashboard: health, figures, charts over 24 hours, records per datatype, sites' freshness       | Must   | built | Made live (refreshes itself).                                                         |
| Health checks with the reason for a red one                                                    | Must   | built |                                                                                       |
| Live activity: the last records through Core with their state, and what is queued              | Must   | built | Queued rows need question 57.                                                         |
| Per-connection status: schedules, fetch list, refused offices, retries, with "run now" actions | Must   | built | Moves from the Vitec page onto the tenant's connection view; the adapter provides it. |
| Alerts by email or Slack when health goes red or a site stops pulling, with a link to the page | Should | M     | Postmark and Slack exist; Sentry for errors already.                                  |
| Environment banner (staging or production), version and deploy time on every page              | Should | S     |                                                                                       |
| Usage: CRM calls per connection per day, Sentry budget, event log size                         | Could  | S     |                                                                                       |
| Uptime and answer times of the sites' pulls over 7 days                                        | Could  | S     |                                                                                       |

### C. Records (U3)

| Function                                                                                       | Rating | Size  | Note                                        |
| ---------------------------------------------------------------------------------------------- | ------ | ----- | ------------------------------------------- |
| Search with server-side filters: tenant, CRM, office, entity type, id, written dates, removed  | Must   | built | Without a reload.                           |
| Sort by any column, pages of 25 to 500, choose the columns shown                               | Must   | S     | Missing today.                              |
| Tick rows and act on them: recompute, fetch again from the CRM, ring the tenant's sites        | Must   | S     | "Fetch again" needs question 57.            |
| One record: raw, unified and display side by side, its timeline down to what each site applied | Must   | built |                                             |
| Preview what a recompute would change for one record before doing it                           | Should | S     | The dry run exists.                         |
| Free-text search across a record's fields (address, name)                                      | Should | M     | Postgres full-text over the unified record. |
| Records failing the schema, listed with their errors                                           | Should | S     | From the impact preview.                    |
| Export a search as CSV or JSON                                                                 | Could  | S     |                                             |
| Saved searches                                                                                 | Could  | S     |                                             |
| A record's earlier versions and the diff between them                                          | Could  | L     | Needs versions stored; nothing today.       |

### D. Recompute and fetch again (U4)

| Function                                                                                             | Rating | Size  | Note                                                                                    |
| ---------------------------------------------------------------------------------------------------- | ------ | ----- | --------------------------------------------------------------------------------------- |
| Recompute by scope: one record, a selection, office(s), tenant(s), CRM(s), a datatype, everything    | Must   | M     | Patric's ask; the engine already recomputes any scope, the panel only offered a record. |
| Fetch again from the CRM by the same scopes                                                          | Must   | M     | Office, tenant and CRM scopes exist as lifecycle events; record and selection need 57.  |
| Preview first, then run: every recompute shows examined, changed, failed and examples before writing | Must   | S     |                                                                                         |
| Long operations as jobs: progress, cancel, a result, a history of runs                               | Must   | M     | Run by the worker, watched live; today a recompute of everything blocks a request.      |
| Impact preview before a release, as a report with diffs (AC 36)                                      | Should | S     |                                                                                         |
| Housekeeping now                                                                                     | Must   | built |                                                                                         |

### E. Sites (U1, U3)

| Function                                                                                              | Rating | Size  | Note                 |
| ----------------------------------------------------------------------------------------------------- | ------ | ----- | -------------------- |
| Sites per tenant: last pull, last bell and its answer, ring (changes or everything), new bell secret  | Must   | built |                      |
| Site setup checklist: secret and token in the site, first bell answered, first pull done, first apply | Should | S     | Makes U1 end to end. |
| What a site holds versus Core: counts per datatype from its applied reports, and what failed there    | Should | M     |                      |
| The site's own errors (from `/v1/errors`) shown per site                                              | Should | S     |                      |

### F. Events and audit (U3, U6)

| Function                                                                        | Rating | Size  | Note                                                        |
| ------------------------------------------------------------------------------- | ------ | ----- | ----------------------------------------------------------- |
| The event log with filters, and following a correlation id                      | Must   | built | Paged, with a live tail.                                    |
| Who did what on the panel: logins, saves, actions, with the person and the time | Should | S     | Logins and tests are logged; saves and actions are not yet. |
| Export events                                                                   | Could  | S     |                                                             |

### G. Trying things (U8)

| Function                                                               | Rating | Size  | Note                                                                            |
| ---------------------------------------------------------------------- | ------ | ----- | ------------------------------------------------------------------------------- |
| Pull as a site, ring, queue a lifecycle event, recompute preview       | Must   | built | Moves next to what it concerns (a "Try" drawer on the tenant and record pages). |
| Look at a CRM record: raw next to unified and display, nothing written | Must   | built | Vitec only today; generic through the adapter is question 61.                   |
| Replay a notification payload                                          | Could  | S     |                                                                                 |

### H. Settings and access (U6, U7)

| Function                                                       | Rating | Size  | Note                                                                |
| -------------------------------------------------------------- | ------ | ----- | ------------------------------------------------------------------- |
| Configuration read-only, migrations, rules and schema versions | Must   | built |                                                                     |
| Token and bell secret rotation                                 | Must   | built |                                                                     |
| Login by email link, the maintenance switch                    | Must   | built |                                                                     |
| Adapter settings and directions, the notification URL          | Must   | built |                                                                     |
| A second CRM appears in the tenant's CRM list by itself        | Must   | built | The design holds.                                                   |
| Users and roles (operator, viewer), invited by email           | Could  | M     | "Roles come when they are needed" (2026-09-18); one operator today. |
| Passkeys or a second factor                                    | Could  | M     |                                                                     |
| Rotate the admin secret the agents use                         | Could  | S     |                                                                     |

### I. The qualities of a professional tool (every page)

| Function                                                                                  | Rating | Size | Note                                                                   |
| ----------------------------------------------------------------------------------------- | ------ | ---- | ---------------------------------------------------------------------- |
| No full-page reloads: actions and searches answer in place, with loading and error states | Must   | —    | The heart of the rebuild.                                              |
| A toast for every outcome, undo where it is safe (a licence switch, a site switched off)  | Must   | S    |                                                                        |
| One pattern each for a list, a detail page, a form and a row's actions, used everywhere   | Must   | —    | Consistency.                                                           |
| Confirmations that say what will happen before "Remove everything" or "New token"         | Must   | S    |                                                                        |
| Empty states that say what to do next                                                     | Must   | S    |                                                                        |
| Responsive and accessible: keyboard, labels, contrast, screen reader names                | Must   | —    |                                                                        |
| Live updates: activity, jobs, health and figures change on the page without a reload      | Should | M    | One event stream from Core.                                            |
| A command palette: jump to a tenant, a record id, a page                                  | Should | S    |                                                                        |
| Dark mode                                                                                 | Could  | S    |                                                                        |
| Keyboard shortcuts                                                                        | Could  | S    |                                                                        |
| The panel in Swedish                                                                      | Won't  |      | An internal tool; the sites are Swedish, the panel is not a site.      |
| A customer-facing portal                                                                  | Won't  |      | Customers get sites, not the panel.                                    |
| Editing record data by hand                                                               | Won't  |      | Core copies the CRM; a hand edit would be a lie the next fetch undoes. |

## 4. How to build it

The bar is a product one would pay for. Four ways, rated by the impression they give, how they fit
Core's rules (simple, one code path, the seam), the effort, what they add, and how they are tested.

| Way                                                                                                                                                         | Impression | Fit with Core                                                                                                 | Effort | Adds                                                                             | Verdict                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Keep today's server-rendered Tabler pages and add htmx for in-place updates and sorting                                                                     | medium     | high: no build, small code                                                                                    | medium | htmx (14 KB)                                                                     | The ceiling stays low; every rich table or live view is hand work.                 |
| **A React app on Core's admin API: Refine (headless) with shadcn/ui and Tailwind, tables by TanStack, forms by react-hook-form, toasts, a command palette** | high       | good: the API becomes the one code path for agents and the app; the app is a client like the WordPress plugin | high   | a build step (Vite) and browser-side libraries, all MIT; Playwright for journeys | **Recommended.** The look and behaviour of a 2026 SaaS console, on standard parts. |
| A React app with React-admin and Material UI                                                                                                                | high       | good, the same shape                                                                                          | medium | the same, plus paid packages for realtime and audit log                          | The live and audit pieces are paid; the free part is dated Material.               |
| A low-code tool (Retool, Appsmith) on Core's API                                                                                                            | medium     | poor: a vendor holds the panel and reaches the data                                                           | low    | a vendor, a monthly cost                                                         | No: a vendor, a cost, and the panel leaves the repository.                         |

The recommendation in words: Core gets a complete admin API (JSON, under `/v1/admin/`), which is
the single place where tenants are saved, records searched, recomputes run and events read; the
agents already use that API, the app becomes its second user, and nothing is done in two ways.
The app lives in one new folder of the repository, is built into static files by the same
`npm run build`, and is served by Core's web process under `/admin`, so nothing else runs and
nothing is hosted elsewhere. Long operations (recompute everything, fetch an office again) become
jobs the worker runs with progress, watched live through one event stream from Core, which also
feeds the activity list, the dashboard and the health verdict. Every user journey (onboard a
tenant, find a record, recompute a scope, ring a site, rotate a token) is a browser test run in
the checks, so "it passed the tests" means "a person could do it".

Ant Design instead of shadcn/ui is the faster, more conventional alternative if speed matters
more than the modern look; the rest stays the same.

### What it takes from the adapter API (approval needed)

An adapter's own pages cannot be React code shipped by the adapter without coupling the app to
each CRM. Instead the adapter hands the engine **data that describes its panel**: sections of
key-values, tables with row actions, forms with fields, and actions, and the app renders them
with the same components as everything else. The same shape carries the connection status on the
tenant page, the "check the login" probe, the "look at a record" dry run and the queue (question
57). This is one additive change to `engine/adapter-api/`, question 61.

### Order of work

1. The admin API completed and tested, jobs and the event stream in the engine, the adapter
   panel description (61) if approved.
2. The app: shell and login, dashboard, tenants (the one-page flow, in place, with toasts),
   records (grid with sort, filter, paging, selection and actions; the record page), recompute
   and fetch-again by scope with jobs, events, settings, adapter panels. Every journey a browser
   test. Today's pages are replaced page by page as each journey passes, and removed at the end.
3. The Shoulds: alerts, first-load progress, the site checklist and parity, the audit trail, the
   command palette, live everywhere, "check the login".
4. The Coulds, as they earn their place.

## 5. Decisions asked of Patric

Register questions 59 (the ratings), 60 (the way to build) and 61 (the adapter panel
description). Question 57 (queue and fetch-again for records) stands.

## 6. What was built (2026-09-20), the Coulds, and the gaps

**Built from scratch, every Must and every Should.** The old server-rendered panel (`engine/admin/`,
the Vitec adapter's HTML pages, their tests) is deleted. In its place: a JSON admin API in the
engine (`engine/admin-api/`) with a login by mailed link, an audit trail, jobs with progress and
cancel, a live event stream, alerts by mail and Slack, and adapters that describe their panels as
data; a browser app (`admin/`, React 19, Vite, Tailwind v4, shadcn/ui, TanStack Query and Table,
react-hook-form, Recharts) built into static files by `npm run build` and served by the web process
under `/admin`; the Vitec adapter's admin rebuilt as data with a login probe, a record inspection
and its queue; and tests at three levels: the API through HTTP, the web process as deployed, and
every user journey in a real browser (`admin/e2e`, an enforced check). The stack is the one
recommended in section 4, with one change: no Refine. The engine's own rule against framework-style
layers (AGENTS.md) won over a data-provider abstraction; TanStack Query and Table on the API do the
same work in plain code.

| Rated  | Rows | Built           |
| ------ | ---- | --------------- |
| Must   | 32   | 32              |
| Should | 14   | 14              |
| Could  | 14   | 0, listed below |
| Won't  | 3    | 0, on purpose   |

Where a Should had a smaller reading, the honest one was built: "first-load progress" is what the
latest load has written, left unchanged, removed and dropped since it started (the engine cannot
see inside an adapter's fetch, but it sees every write); "what a site holds versus Core" is what
the sites reported applied and failed per datatype out of the event log's 30 days, not a count the
site never sends; the "site setup checklist" proves the secret by a bell answered, the token by a
pull and the link by a record applied, since a pull cannot name the site (the token is the
tenant's).

### The Coulds, not built, for later

| Could                                                                  | What it would take                                                                                                                                 |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| A tenant with two CRMs                                                 | Allow more than one connection per tenant on the page and in the save; the engine already keys everything by connection.                           |
| Archive a tenant                                                       | A flag that hides it from the list and stops its bells, keeping the data 90 days; today: licence off and "Remove everything".                      |
| Usage: CRM calls per connection per day, Sentry budget, event log size | Three queries over the event log and the database, one card on the dashboard.                                                                      |
| Uptime and answer times of the sites' pulls over 7 days                | The same query as the dashboard's over a week, one chart.                                                                                          |
| Export a search as CSV or JSON                                         | One endpoint that streams the search's rows, one button.                                                                                           |
| Saved searches                                                         | The search lives in the address already; saving is a list of names and addresses per person.                                                       |
| A record's earlier versions and the diff between them                  | Versions are not stored; it needs a history table on every write and a diff view. The largest of these.                                            |
| Export events                                                          | As for records.                                                                                                                                    |
| Replay a notification payload                                          | An adapter capability: hand a stored `webhook.received` payload back to its listener.                                                              |
| Users and roles (operator, viewer), invited by email                   | A users table, an invitation mail, a role on the session, and a check per change.                                                                  |
| Passkeys or a second factor                                            | WebAuthn on the login page and a credential table.                                                                                                 |
| Rotate the admin secret from the panel                                 | The secret is the app's environment; rotating it from the panel means Core writing its own configuration on the platform. Better left to an agent. |
| Dark mode                                                              | The design tokens are in place; a second set of values and a switch.                                                                               |
| Keyboard shortcuts                                                     | Beyond the palette's ⌘K: a small map of keys to pages.                                                                                             |

### Gaps found while building, with a suggestion each

1. **A pull does not name the site.** Every site of a tenant pulls with the tenant's token, so
   "last pull" and "first pull" are per tenant, and the checklist proves the token per tenant, not
   per site. Suggestion: implement later, as a header the clients send (`X-Core-Site`) and Core
   records per site; a small additive change to both clients. Not blocking.
2. **What a site holds is inferred, not counted.** Parity is built from the sites' applied and
   failed reports over the event log's 30 days. Suggestion: implement later, as a periodic
   `POST /v1/holdings` from the clients with their counts per datatype; then the page can say
   "the site holds 412 of 415". Not blocking.
3. **Removing a site deletes it.** A site taken off the tenant's page is deleted with its row; its
   events stay. Suggestion: do not implement more; "archive a tenant" (a Could) covers the case
   where history matters.
4. **The recompute's "everything" is one process at a time.** Jobs run one after another in the
   worker, in pages of 200 records, so a recompute of everything takes minutes on a large
   database and blocks the next job. Suggestion: implement only if it hurts: a second worker
   taking jobs is one line of configuration on the platform, and the queue already locks per job.
5. **Alerts know Core's health, not the sites'.** A site that stops pulling turns the
   `subscribers` check red, which alerts; a site that pulls but fails to apply does not.
   Suggestion: implement later as one more health check, "sites failing to apply in the last
   hour", registered by the engine; a few lines. Not blocking.
6. **The old operator endpoints stay.** `POST /v1/admin/bell`, `event`, `replay` and `recompute`
   with the admin secret are the contract the agents and scripts use (SRS §10); the panel's
   endpoints sit next to them. Suggestion: leave them; they share the engine's functions with the
   panel, and removing them is a contract change for nothing.

## 7. Patric's verdict on section 6, and what follows (2026-09-20, later)

The build of section 6 was a reskin: new code and a new stack, but every page, its layout and its
user flow came from the first build, because the function list was written by walking that
build. Patric had ruled that out. Nothing of it is inherited into the next design; the requirement
sheets (sections 1 and 3, with the Must below) and best-practice patterns of market-leading admin
consoles are the only inputs, the information architecture and the screens are approved before
any code, and nothing is built until he says so. The strategy is in the chat answer of the same
day and moves into `docs/admin-panel-design.md` once the design is drafted.

Changes to the sheets:

- A tenant may have one or several CRM connections, of the same or different kinds: a Must.
- Shelved as a later performance improvement: jobs run one after another in the worker (a second
  worker takes jobs in parallel; one platform setting).
- Shelved as a later health check: a site that pulls but fails to apply records turns a check red
  and alerts.
- Cut what nothing uses (register question 65): the old operator endpoints with the admin secret
  and the setup scripts, once the panel's API is the one code path.
- The public health check keeps its 200 or 500 answer for an uptime monitor and must say what is
  wrong in words a viewer understands without naming customers (register question 62).
- Every notification Vitec sends may be stored (register question 63).

The gaps of section 6, explained in full:

1. **A pull does not name the site.** A "site" is one website that shows a tenant's records: one
   WordPress installation with the Core plugin, or one Lovable site. Every site has a bell URL
   (where Core rings to say "there is something new") and a bell secret (so the site knows the
   bell came from Core). A "pull" is the site fetching the changes from Core, page by page, with
   the tenant's token. Because every site of a tenant pulls with the same token, Core can see
   that a pull happened for the tenant but not which of its sites made it. So "last pull" and
   "first pull" are known per tenant, not per site, and the setup checklist can say "a site
   pulled with the token" but not "acme.se pulled". The fix is small: the plugin and the Lovable
   kit send their site name in a header with every pull, and Core records it per site.
2. **What a site holds is inferred, not counted.** After every page a site pulls, it reports to
   Core which records it applied and which it could not. From those reports Core can say "the
   sites reported 640 properties applied and 6 failed"; it cannot say "the site holds 646
   properties" because the site never reports its totals. A small addition to the clients, a
   report of their counts per datatype now and then, would make the comparison exact.
3. **Removing a site deletes it.** A site is a row in Core: its name, its bell URL, its bell
   secret, when it was last rung, what it answered, when the tenant last pulled. Taking the site
   off the tenant's page deletes that row. The events it produced (bells rung, what it applied)
   stay in the event log, but nothing points at them any more. What is lost: its secret (adding
   it again means a new secret pasted into the site), its bell history in one place, and a
   protection against a slip of the hand. The alternative is to keep the row hidden and inactive
   ("archive"), which is what "archive a tenant" in the Coulds does for a whole tenant. The
   suggestion stands: deletion is fine for now; archiving covers the case where the history
   matters.
