-- Kowboy Core, initial schema (SRS §3).

create table tenants (
  id                text primary key,
  display_name      text not null,
  token_hmac        text not null,
  active            boolean not null default true,
  purge_watermark   bigint not null default 0,
  created_at        timestamptz not null default now()
);

create table connections (
  id                text primary key,
  tenant_id         text not null references tenants(id) on delete cascade,
  provider          text not null,
  credentials       text,
  licensed_offices  text[] not null default '{}',
  active            boolean not null default true,
  last_ingest_at    timestamptz,
  last_error        text
);
create index connections_tenant on connections(tenant_id);

create table subscribers (
  id                bigserial primary key,
  tenant_id         text not null references tenants(id) on delete cascade,
  label             text not null,
  bell_url          text not null,
  bell_secret       text not null,
  active            boolean not null default true,
  last_bell_at      timestamptz,
  last_bell_status  text,
  last_pull_at      timestamptz,
  last_client       text
);
create index subscribers_tenant on subscribers(tenant_id);

-- One globally increasing cursor for every item write (SRS §3, §8).
create sequence item_seq as bigint start 1;

create table items (
  tenant_id         text not null references tenants(id) on delete cascade,
  connection_id     text not null references connections(id) on delete cascade,
  datatype          text not null,
  remote_id         text not null,
  office_id         text,
  seq               bigint not null,
  deleted           boolean not null default false,
  schema_version    text not null default '1',
  content_hash      text not null,
  raw               jsonb,
  data              jsonb,
  remote_updated_at timestamptz,
  rules_version     text not null,
  updated_at        timestamptz not null default now(),
  tombstoned_at     timestamptz,
  primary key (tenant_id, connection_id, datatype, remote_id)
);
-- The subscriber read: "everything for this tenant and datatype after seq N".
create index items_cursor on items(tenant_id, datatype, seq);
create unique index items_seq on items(seq);

-- Event log (strategy §8.2), partitioned by day, dropped after the retention window.
create table events (
  at              timestamptz not null default now(),
  type            text not null,
  correlation_id  text,
  tenant_id       text,
  connection_id   text,
  datatype        text,
  remote_id       text,
  subscriber_id   bigint,
  fields          jsonb not null default '{}'::jsonb
) partition by range (at);

create index events_at on events(at);
create index events_correlation on events(correlation_id);
create index events_entity on events(connection_id, datatype, remote_id);

-- Liveness of the worker role, read by /v1/health (strategy §13).
create table heartbeats (
  name  text primary key,
  at    timestamptz not null default now()
);
