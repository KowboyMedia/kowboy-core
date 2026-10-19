-- The old "Reload all data" is gone: a whole tenant's Send in Manual sync rebuilds its websites,
-- and nothing reads or writes the table that followed a reload. Drops one table that held only
-- a day's progress of each reload.
drop table if exists reloads;
