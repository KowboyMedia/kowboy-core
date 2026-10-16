-- Two times the new admin panel (design B) shows, approved with question 197 (rows 84 and 98).
-- When a tenant's token was last replaced, so a brokerage's page can say which of its sites still
-- fetch with the old one ("Waiting for new token") and which already use the new one. When a
-- connection's forms test mode was turned on ("On since 09:44"); null while it is off, and for a
-- connection ticked before this column existed, whose start Core never kept. Additive.
alter table tenants add column if not exists token_replaced_at timestamptz;
alter table connections add column if not exists forms_dry_run_since timestamptz;
