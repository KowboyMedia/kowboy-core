---
name: notification-system-item-26
description: Item 26 alerts: levels P0-P3 on staging (172 ok; 173 no Sentry, Patric's own monitor on /v1/health); 178 and 184 closed as clear winners 2026-10-07
metadata:
  type: project
  modified: 2026-10-12T23:06:27.742Z
---

- On staging since 1a86ecb (2026-10-06): every check has a level; the worker's round
  (`engine/alerts.ts`) tells P0 after 5 min, P1 after 15 (each once, its end once), P2 in one
  07:00 Stockholm mail, P3 log only; while a P0 is open only P0 is told (rules A-E, 164).
  `/v1/health` answers 500 only while a P0 fails (173: NO Sentry, "wait, i dont want sentry to
  monitor"; Patric watches it with UptimeRobot or similar). Never propose Sentry uptime again.
- The round reads, then sends, then keeps; one round at a time (row `alerts:turn`, taken over
  after 2 min). A sites check that cannot run keeps the `subscribers:<id>` rows open. Rows kept
  before the levels (detail not JSON) end silently or adopt the words. Rule E counts from a
  check's first throw in the process. Migration 015 indexes bell events for the sites check.
- "Needs attention" (`engine/attention.ts`): 7 days, one line per thing, named and linked (163).
  Forms Core held back as a dry run (`submission.refused`, reason NOT_LIVE: outside production, or
  a connection ticked to dry-run its forms, d2a8ae6) are no line; the event's sentence names both.
  The office line's "what to do" differs for an office still refused (P1) and one taken off by
  a change (P2).
- 178 and 184 closed 2026-10-07 as clear winners (8325967): health_results keeps level and names
  (jsonb, migration 017); "Needs attention" lines show their level. A CRM's code points at things
  (`AdminThing` {connection, office?, record?, note?}) in check names and page values, and Core
  names and links them (`engine/admin/things.ts`); `admin.checks` gives check titles; `{address}`
  is shown whole from PUBLIC_URL. 178 item 2 (level on check.failed) not built: no reader. Vitec's
  adoption spec went via the coordinator to "Vitec office whitelist".
- Overview (934237a, 2026-10-12, his "should not list ... green/ OK cards"): under the verdict only
  checks failing at P0-P2; passing and P3 are not drawn. The passing sentences (`fine`, also in
  the adapter API's `checks`) were deleted; never add a list of passing checks back unasked.
- Texts follow AGENTS.md definition of done 5 and the shared words in `engine/admin/words.ts`.
- The event log redacts any field whose name holds key, token, secret and the like (`engine/events.ts`), so a
  problem's key travels as `problem` on check.failed and check.recovered; "Needs attention" pairs them by it.

**How to apply:** a new kind is one KINDS line plus a sentence in `engine/admin/summary.ts`, asked
first. See [[ask-before-adding-to-core]], [[admin-notes-in-plain-words]].
