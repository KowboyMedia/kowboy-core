-- The entire payload reaches the sites (Patric, 2026-09-18): each row also keeps `raw`, the CRM
-- payload exactly as Core served it, next to `data`. Additive; rows synced before this migration
-- get their `raw` at the next change or forcerefresh.

alter table offices add column if not exists raw jsonb;
alter table agents add column if not exists raw jsonb;
alter table areas add column if not exists raw jsonb;
alter table associations add column if not exists raw jsonb;
alter table projects add column if not exists raw jsonb;
alter table properties add column if not exists raw jsonb;
