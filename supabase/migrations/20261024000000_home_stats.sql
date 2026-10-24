-- =============================================================================
-- home_stats() — public aggregate counters for the homepage and /stats page.
-- =============================================================================
-- Returns one row with marketing-friendly totals. SECURITY DEFINER so `anon`
-- and `authenticated` can read counts without exposing row data (RLS on the
-- underlying tables remains intact and row-level SELECT is never granted).
--
-- The SUM(serve_count) aggregate is covered by idx_urls_active_aggregates
-- (see 20260531045000_admin_url_stats_covering_index.sql), so it does not
-- full-scan the urls table.
--
-- Rollback: DROP FUNCTION IF EXISTS public.home_stats();
-- =============================================================================

CREATE OR REPLACE FUNCTION public.home_stats()
RETURNS TABLE (
  total_users   bigint,
  total_ratings bigint,
  active_urls   bigint,
  active_tags   bigint,
  total_serves  bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    (SELECT COUNT(*)::bigint
       FROM public.profiles)                                                     AS total_users,
    (SELECT COUNT(*)::bigint
       FROM public.ratings)                                                      AS total_ratings,
    (SELECT COUNT(*)::bigint
       FROM public.urls
      WHERE approved = TRUE AND inactive = FALSE)                                AS active_urls,
    (SELECT COUNT(*)::bigint
       FROM public.tags
      WHERE is_active = TRUE)                                                    AS active_tags,
    (SELECT COALESCE(SUM(serve_count), 0)::bigint
       FROM public.urls
      WHERE approved = TRUE AND inactive = FALSE)                                AS total_serves;
$$;

GRANT EXECUTE ON FUNCTION public.home_stats() TO anon, authenticated;
