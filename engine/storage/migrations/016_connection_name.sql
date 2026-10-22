-- A CRM connection gets a name a person types and can change (Patric, 2026-10-07, question 180:
-- "Human readable identifier is a name and is editable. Unique identifier has an internal
-- purpose and does not matter for a human in an admin panel."). The id stays Core's fixed key
-- for records, events and links, made by Core from the first name typed. A connection saved
-- before keeps as its name the id a person typed for it then.
alter table connections add column name text;
update connections set name = id where name is null;
alter table connections alter column name set not null;

-- The request to stop a run, which only the old Manual sync made, goes with it (Patric,
-- 2026-10-07, question 183: "everything not named is removed").
alter table jobs drop column if exists cancel_requested;
