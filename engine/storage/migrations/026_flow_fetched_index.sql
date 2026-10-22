-- The panel's Flow lists the newest records Core wrote from the CRMs and leaves out the records new
-- rules prepared again. After a new rules version those are tens of thousands of the newest
-- writes, and Flow walked back through all of them, every second, before finding its hundred (up
-- to ten seconds on staging). This index holds only the writes Flow shows. Additive.
create index if not exists events_written_fetched on events (id)
  where type = 'entity.written' and coalesce(fields ->> 'cause', '') <> 'recompute';
