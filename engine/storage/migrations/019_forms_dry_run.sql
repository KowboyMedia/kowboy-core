-- A CRM connection can be ticked to dry-run its forms (Patric, 2026-10-07: "Add a connector
-- checkbox to prevent hot leads, only dry run"). Ticked, the forms guard holds every form that
-- would go through the connection before the CRM is called, on production too, so a test reaches
-- no brokerage as a lead. Reading homes and a viewing's times goes on. The tick can only hold
-- forms, never send one the guard would hold. Unticked for every connection until someone ticks it.
alter table connections add column if not exists forms_dry_run boolean not null default false;
