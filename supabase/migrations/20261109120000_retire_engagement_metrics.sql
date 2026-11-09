-- =============================================================================
-- Retire the engagement metrics (dwell_ms / skipped)
-- =============================================================================
-- Both columns were added 2026-07-08 (20260708000003) to feed
-- interest_pair_scores and roam()'s skip penalty. They never received a value:
-- the only writer was the `report-engagement` Edge Function, which did a
-- client-side UPDATE on seen_urls — RLS-enabled with a SELECT-only policy — so
-- every report matched zero rows and PostgREST answered 204. The trigger below
-- and the seven `skipped = TRUE` filters in roam() have therefore been inert
-- since the day they shipped.
--
-- Rather than repair the write path (20261109070000_report_engagement_rpc.sql,
-- merged this morning in #126 but never applied to any project), the decision is
-- to collect nothing of the sort. Roam only needs to know which URLs were served,
-- and that is seen_urls itself: roam() writes the row for a live serve,
-- mark_url_seen() writes it when a prefetched URL reaches the screen.
--
-- This migration removes the pipeline that consumed the metrics. The two columns
-- stay (always NULL) so the deployed roam()/mark_url_seen() bodies need no
-- rewrite; a later migration can drop them together with the roam() body that
-- still references `skipped`.
--
-- Rollback: see RUNBOOK.md § 20261109120000_retire_engagement_metrics.sql.
-- =============================================================================

-- 1. The engagement → pair-score trigger. It is `AFTER UPDATE OF dwell_ms,
--    skipped`, and mark_url_seen() sets both columns on every serve, so it has
--    been firing on every serve only to return immediately (both values NULL).
DROP TRIGGER IF EXISTS trg_seen_urls_engagement_pair_scores ON public.seen_urls;
DROP FUNCTION IF EXISTS public.update_pair_scores_from_engagement();

-- 2. Its index, which only existed to serve engagement-aware queries.
DROP INDEX IF EXISTS public.idx_seen_urls_engagement;

-- 3. The write path, in case a project ever ran 20261109070000 before it was
--    deleted. A no-op where the function was never created.
DROP FUNCTION IF EXISTS public.report_engagement(UUID, INTEGER, BOOLEAN);

-- 4. Say so in the catalogue, so the columns do not look collectable.
COMMENT ON COLUMN public.seen_urls.dwell_ms IS
  'Deprecated 2026-11-09: never collected (the only writer was an RLS-blocked UPDATE). Always NULL; scheduled for removal.';
COMMENT ON COLUMN public.seen_urls.skipped IS
  'Deprecated 2026-11-09: never collected (the only writer was an RLS-blocked UPDATE). Always NULL; scheduled for removal.';
