-- The maintenance switch is removed (question 215 a): Core always tells the websites at once and
-- always runs its jobs. The table of switches held only that one, so it goes, with the log's
-- lines of the old admin turning it on and off. Nothing is held back: change notices held while
-- it was on are pending bells on the websites' rows, which the worker sends once a second.
drop table if exists settings;
delete from events where type = 'admin.maintenance';
