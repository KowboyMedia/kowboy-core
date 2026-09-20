-- The admin panel rebuilt as a browser app on an admin API (Patric, 2026-09-20, register
-- questions 59 to 61). Everything here is additive.

-- Events get a number, so the panel's live stream and its pages tail and page the log by it.
alter table events add column id bigserial;
create index events_id on events(id);

-- Long operations (a recompute of everything, an impact preview) run as jobs the worker takes,
-- with progress, a result and a history; the panel watches them live.
create table jobs (
  id               bigserial primary key,
  kind             text not null,
  scope            jsonb not null default '{}'::jsonb,
  dry_run          boolean not null default false,
  state            text not null default 'queued',
  progress         jsonb not null default '{}'::jsonb,
  result           jsonb,
  error            text,
  requested_by     text,
  cancel_requested boolean not null default false,
  created_at       timestamptz not null default now(),
  started_at       timestamptz,
  finished_at      timestamptz
);
create index jobs_open on jobs (id) where finished_at is null;

-- "Fetch again" names records; the lifecycle queue carries them to the adapter.
alter table lifecycle_events add column records jsonb;

-- Alerts: the last state seen per health check, so a change is told once.
create table alert_state (
  name        text primary key,
  ok          boolean not null,
  detail      text,
  since       timestamptz not null default now(),
  notified_at timestamptz
);

-- Free-text search over the unified record, for the panel's records search.
create index items_search on items
  using gin (jsonb_to_tsvector('simple', coalesce(data, '{}'::jsonb), '["string"]'));
