-- The panel's Flow (the tenant mockups, images 22 to 27) lists the newest records Core wrote from
-- the CRMs, read again every second while someone has it open. Most of the event log is other
-- kinds (calls to the CRMs, records that did not change), so without this index each read would
-- walk back through them to find its hundred. Only the writes are in it. Additive.
create index if not exists events_written on events (id) where type = 'entity.written';
