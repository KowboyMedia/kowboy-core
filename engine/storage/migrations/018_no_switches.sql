-- Sites and CRM connections lose their on/off switches (Patric, 2026-10-07, asked whether to drop
-- the old switches for sites and connections: "Drop them"). Core reads every connection and tells
-- every site of an enabled tenant of changes; the tenant's Enabled stays the one switch. Anything
-- switched off before comes back on.
alter table connections drop column if exists active;
alter table subscribers drop column if exists active;
