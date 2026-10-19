-- A form is sent once (218, 2026-10-19): nothing sends a form again, so Core no longer keeps a
-- copy of what the visitor wrote, encrypted until the CRM took it (014). The site keeps its own
-- log of its forms for 30 days. The copies still held go with the column.
alter table submissions drop column if exists content;
