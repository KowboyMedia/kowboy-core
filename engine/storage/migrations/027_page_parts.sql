-- Each record's part of a changes page, compressed and ready to send (question 227): a page is put
-- together from these, so the database no longer turns raw and data into text for it, nor Core
-- compresses it again. Written with the record; a record without one is sent from raw and data,
-- and the worker fills the records stored before this. Compressed already, so the database stores
-- it as it is.
alter table items add column if not exists page_part bytea;
alter table items alter column page_part set storage external;

-- A version of Core without parts, such as the one still running during a deploy or one rolled
-- back to, writes a record and leaves its part alone: the part is emptied then, so a page never
-- carries a record as it was before. A part holds all of a record's item but `seq` and
-- `remote_updated_at`.
create or replace function items_page_part_stale() returns trigger language plpgsql as $$
begin
  new.page_part := null;
  return new;
end;
$$;

drop trigger if exists items_page_part_stale on items;
create trigger items_page_part_stale
  before update of raw, data, office_id, deleted, schema_version, content_hash on items
  for each row
  when (new.page_part is not distinct from old.page_part
        and (new.raw, new.data, new.office_id, new.deleted, new.schema_version, new.content_hash)
          is distinct from
            (old.raw, old.data, old.office_id, old.deleted, old.schema_version, old.content_hash))
  execute function items_page_part_stale();
