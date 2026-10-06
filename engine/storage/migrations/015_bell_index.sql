-- The sites check (engine/health.ts, question 172) asks, for a site that has not fetched since
-- Core last told it about changes, whether Core told it before the last hour too. Without this,
-- that question reads the event log back to the site's last fetch, or all of it for a site that
-- never fetched, at every alert round, Overview and call to the public /v1/health. Only the
-- messages to the sites are in it, so it stays small.
create index events_bell on events (subscriber_id, at) where type = 'bell';
