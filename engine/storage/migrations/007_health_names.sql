-- A health check's names (the sites, connections or offices its detail counts) are kept next to
-- the detail, so the worker's checks reach the alerts with them while /v1/health, which is public,
-- answers with the counts alone (Patric, 2026-09-20, question 62).
alter table health_results add column names text[];
