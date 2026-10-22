-- The records search by words in the record went with the Records page rebuilt from zero
-- (Patric, 2026-10-06: the scope is tenants, offices, entity types and one id). Nothing reads
-- the full-text index any more, so it goes with the feature.
drop index if exists items_search;
