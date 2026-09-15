-- The site's copy of its Kowboy Core data (SRS §8, Appendix B). Applied with `supabase db push`.
--
-- One table per datatype, keyed by connection and remote id, holding the served `data` verbatim.
-- Indexed columns for the search filters are added, additively, once the data model is defined
-- (docs/field-tables.md). `synced_at` is the sync's own bookkeeping: never show it, never sort by
-- it; dates come from `remote_updated_at` or from `data`.

create table if not exists offices (
  connection_id     text not null,
  remote_id         text not null,
  office_id         text,
  seq               bigint not null,
  content_hash      text not null,
  remote_updated_at timestamptz,
  data              jsonb not null,
  synced_at         timestamptz not null default now(),
  primary key (connection_id, remote_id)
);

create table if not exists agents (
  connection_id     text not null,
  remote_id         text not null,
  office_id         text,
  seq               bigint not null,
  content_hash      text not null,
  remote_updated_at timestamptz,
  data              jsonb not null,
  synced_at         timestamptz not null default now(),
  primary key (connection_id, remote_id)
);

create table if not exists areas (
  connection_id     text not null,
  remote_id         text not null,
  office_id         text,
  seq               bigint not null,
  content_hash      text not null,
  remote_updated_at timestamptz,
  data              jsonb not null,
  synced_at         timestamptz not null default now(),
  primary key (connection_id, remote_id)
);

create table if not exists associations (
  connection_id     text not null,
  remote_id         text not null,
  office_id         text,
  seq               bigint not null,
  content_hash      text not null,
  remote_updated_at timestamptz,
  data              jsonb not null,
  synced_at         timestamptz not null default now(),
  primary key (connection_id, remote_id)
);

create table if not exists properties (
  connection_id     text not null,
  remote_id         text not null,
  office_id         text,
  seq               bigint not null,
  content_hash      text not null,
  remote_updated_at timestamptz,
  data              jsonb not null,
  synced_at         timestamptz not null default now(),
  primary key (connection_id, remote_id)
);

-- The sync's state, one row per name: the cursor per datatype (`after.<datatype>`), the note a
-- bell leaves for a running sync (`pending`), and what an operator wants to see (`last_success_at`,
-- `last_error`, `running_since`, `last_finished_at`, `last_kind`, `runs`).
create table if not exists core_sync_state (
  name  text primary key,
  value text not null
);

-- The site reads through PostgREST as `anon`: everything readable, nothing writable. Only the
-- sync function writes, over its direct database connection.
alter table offices enable row level security;
alter table agents enable row level security;
alter table areas enable row level security;
alter table associations enable row level security;
alter table properties enable row level security;
alter table core_sync_state enable row level security;

drop policy if exists "read" on offices;
create policy "read" on offices for select using (true);
drop policy if exists "read" on agents;
create policy "read" on agents for select using (true);
drop policy if exists "read" on areas;
create policy "read" on areas for select using (true);
drop policy if exists "read" on associations;
create policy "read" on associations for select using (true);
drop policy if exists "read" on properties;
create policy "read" on properties for select using (true);
drop policy if exists "read" on core_sync_state;
create policy "read" on core_sync_state for select using (true);
