-- Two things the new admin panel (design B) follows over time, approved with question 197.
--
-- The Inbox's problems (rows 23, 36, 37 and 40): each card the Inbox shows is a problem that stays
-- open until it is solved, with who acted on it and when ("Done, I've pasted it" moves it to
-- "Waiting"), and when it was solved and by whom, so the Inbox can list what was fixed today. `key`
-- is the card's own (a check's name, or a kind and the id of what it is about); at most one problem
-- per key is open. `facts` holds what the Inbox needs to word the problem once its card is gone.
--
-- "Reload all data" for one tenant (rows 105 and 106): the full fetch asked of each of its
-- connections (one resync in lifecycle_events each), and when its sites were told to rebuild,
-- which the worker does once every one of those fetches is done. Additive.
create table if not exists panel_problems (
  id         bigserial primary key,
  key        text not null,
  tenant_id  integer references tenants(id) on delete cascade,
  opened_at  timestamptz not null default now(),
  facts      jsonb not null default '{}'::jsonb,
  acted_by   text,
  acted_at   timestamptz,
  solved_at  timestamptz,
  solved_by  text
);
create unique index if not exists panel_problems_open on panel_problems (key) where solved_at is null;
create index if not exists panel_problems_solved on panel_problems (solved_at) where solved_at is not null;

create table if not exists reloads (
  id           bigserial primary key,
  tenant_id    integer not null references tenants(id) on delete cascade,
  requested_by text,
  started_at   timestamptz not null default now(),
  events       bigint[] not null default '{}',
  rebuilt_at   timestamptz,
  error        text
);
create index if not exists reloads_tenant on reloads (tenant_id, id);
create index if not exists reloads_waiting on reloads (id) where rebuilt_at is null;
