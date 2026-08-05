-- Disable statement timeout for this bulk cleanup operation, then deactivate
-- all Curlie URLs in the People & Places category.
SET statement_timeout = 0;

UPDATE urls
SET inactive = true
WHERE source = 'curlie'
  AND category_id = 'c1000000-0000-0000-0000-000000000007'
  AND inactive = false;
