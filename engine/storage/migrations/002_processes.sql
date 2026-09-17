-- What the engine's two processes share (strategy §5.1, §8.1). The web process takes admin calls
-- and queues lifecycle events here; the worker delivers them to the adapters. The worker records
-- the adapters' health checks here; the web process reports them.
create table lifecycle_events (
  id            bigserial primary key,
  connection_id text not null,
  event         text not null,
  office_ids    text[],
  datatype      text,
  created_at    timestamptz not null default now(),
  taken_at      timestamptz,
  done_at       timestamptz,
  error         text
);
create index lifecycle_events_pending on lifecycle_events (id) where done_at is null;

create table health_results (
  name   text primary key,
  ok     boolean not null,
  detail text,
  at     timestamptz not null default now()
);
