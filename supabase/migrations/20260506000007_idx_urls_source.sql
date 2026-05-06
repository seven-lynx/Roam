-- Migration: add index on urls.source for efficient seeder-scoped queries
--
-- Without this, any WHERE source = '...' filter does a full 3.15M row seq-scan
-- and hits the statement timeout. Used by categorize-urls.mjs (and check-dead-urls.mjs)
-- when the --source flag is passed.

SET statement_timeout = '0';
SET lock_timeout      = '0';

CREATE INDEX IF NOT EXISTS idx_urls_source
  ON public.urls (source)
  WHERE approved = TRUE AND inactive = FALSE;
