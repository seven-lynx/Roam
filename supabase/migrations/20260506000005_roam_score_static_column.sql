-- =============================================================================
-- roam_score_static column + trigger (Fix 6, schema-only)
-- =============================================================================
--
-- Problem:
--   roam() computes (wilson_score + 0.3 * seeder_score) at runtime across
--   ~787k TABLESAMPLE rows on every call. This static component only changes
--   when a vote is cast. Pre-computing it at write time eliminates repeated
--   arithmetic at query time.
--
-- This migration:
--   1. Adds roam_score_static DOUBLE PRECISION to public.urls (nullable,
--      no default — instant metadata operation in PG12+)
--   2. Creates a BEFORE INSERT OR UPDATE trigger to keep it in sync
--
-- Backfill and index MUST be run manually via Supabase Studio SQL editor
-- (no statement timeout applies there):
--
--   -- Step 1: backfill (~2-5 min on 3.15M rows)
--   UPDATE public.urls
--     SET roam_score_static = wilson_score + 0.3 * seeder_score
--   WHERE roam_score_static IS NULL;
--
--   -- Step 2: index (build once, maintained incrementally)
--   CREATE INDEX idx_urls_roam_score_static
--     ON public.urls (roam_score_static DESC)
--     WHERE approved = TRUE;
--
--   -- Step 3: drop superseded expression index
--   DROP INDEX idx_urls_fallback_sort;
--
-- After those three steps are complete, apply migration
-- 20260506000006_roam_v17_use_score_static.sql to update roam() to use
-- COALESCE(roam_score_static, ...) and ORDER BY roam_score_static.
--
-- Timeout notes:
--   ALTER TABLE ADD COLUMN (nullable, no default) is a metadata-only operation
--   in PostgreSQL 12+ and completes in milliseconds. However, it requires an
--   AccessExclusiveLock on urls and will block if concurrent SELECT queries
--   hold ShareLocks. SET statement_timeout = '0' and SET lock_timeout = '0'
--   below disable both timeouts for this session so the lock wait succeeds.
-- =============================================================================

SET statement_timeout = '0';
SET lock_timeout = '0';

ALTER TABLE public.urls
  ADD COLUMN IF NOT EXISTS roam_score_static DOUBLE PRECISION;

CREATE OR REPLACE FUNCTION public.update_roam_score_static()
RETURNS TRIGGER AS $$
BEGIN
  NEW.roam_score_static := NEW.wilson_score + 0.3 * NEW.seeder_score;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_urls_roam_score_static ON public.urls;

CREATE TRIGGER trg_urls_roam_score_static
  BEFORE INSERT OR UPDATE OF wilson_score, seeder_score
  ON public.urls
  FOR EACH ROW EXECUTE FUNCTION public.update_roam_score_static();
