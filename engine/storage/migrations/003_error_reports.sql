-- Error reports sent to Sentry: one row per distinct error, so the same error leaves once a day
-- whichever process hits it (Patric, 2026-09-18: "the same error once per day, regardless of
-- client or install"). The engine writes it from engine/errors.ts; the count says how often the
-- error was seen since it was first reported.
create table error_reports (
  fingerprint   text primary key,
  first_seen_at timestamptz not null default now(),
  last_sent_at  timestamptz not null default now(),
  seen          bigint not null default 1
);
