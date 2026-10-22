-- A check's level and the things it names, as the process that ran it gave them (questions 178 and
-- 184): the web process shows a CRM's check at the level the CRM's code gave it, and a name may
-- point at a connection, an office or a record, which Core puts into words and links.
alter table health_results add column level text;
alter table health_results alter column names type jsonb using to_jsonb(names);
