-- admin_url_stats() v3
--
-- Adds:
--   rated_urls       — count of active URLs that have been rated (wilson_score > 0)
--   unrated_urls     — active_urls minus rated_urls (approx)
--   new_ratings_week — new ratings submitted in the since_date window
--   avg_wilson_score — now filtered to rated-only (wilson_score > 0) for a meaningful signal
--
-- Uses a new partial index idx_urls_rated_partial for instant approximate counts.

-- Partial index for rated URLs: lets us read rated_urls from pg_class.reltuples
-- (instant, same pattern as idx_urls_active_partial / idx_urls_inactive_partial).
CREATE INDEX IF NOT EXISTS idx_urls_rated_partial
  ON public.urls (id)
  WHERE approved = true AND inactive = false AND wilson_score > 0;

DROP FUNCTION IF EXISTS public.admin_url_stats(timestamptz);

CREATE FUNCTION public.admin_url_stats(since_date timestamptz)
RETURNS TABLE (
  total_urls         bigint,
  active_urls        bigint,
  inactive_urls      bigint,
  recent_urls        bigint,
  total_serves       bigint,
  avg_wilson_score   double precision,
  rated_urls         bigint,
  unrated_urls       bigint,
  new_ratings_week   bigint,
  active_users_week  bigint
)
LANGUAGE sql
SECURITY DEFINER
SET statement_timeout TO '30s'
AS $$
  SELECT
    -- Fast approximate counts from pg_class (instant, no table scan)
    (SELECT reltuples::bigint FROM pg_class WHERE oid = 'public.urls'::regclass)                   AS total_urls,
    (SELECT reltuples::bigint FROM pg_class WHERE oid = 'idx_urls_active_partial'::regclass)       AS active_urls,
    (SELECT reltuples::bigint FROM pg_class WHERE oid = 'idx_urls_inactive_partial'::regclass)     AS inactive_urls,
    -- Exact count for "added this week" (small bounded set, fast range scan)
    (SELECT COUNT(*)             FROM public.urls    WHERE created_at >= since_date)               AS recent_urls,
    -- Aggregates over active URLs (covered by idx_urls_active_aggregates)
    (SELECT COALESCE(SUM(serve_count), 0)::bigint    FROM public.urls WHERE approved = TRUE AND inactive = FALSE) AS total_serves,
    -- Rated-only wilson average: excludes unrated URLs that would collapse the mean to ~0
    (SELECT COALESCE(AVG(wilson_score), 0)            FROM public.urls WHERE approved = TRUE AND inactive = FALSE AND wilson_score > 0) AS avg_wilson_score,
    -- Approximate rated / unrated counts from pg_class (instant)
    (SELECT reltuples::bigint FROM pg_class WHERE oid = 'idx_urls_rated_partial'::regclass)        AS rated_urls,
    (
      (SELECT reltuples::bigint FROM pg_class WHERE oid = 'idx_urls_active_partial'::regclass)
      - (SELECT reltuples::bigint FROM pg_class WHERE oid = 'idx_urls_rated_partial'::regclass)
    )                                                                                               AS unrated_urls,
    -- Ratings activity in the window
    (SELECT COUNT(*)             FROM public.ratings WHERE created_at >= since_date)               AS new_ratings_week,
    (SELECT COUNT(DISTINCT user_id) FROM public.ratings WHERE created_at >= since_date)            AS active_users_week;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_url_stats(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_url_stats(timestamptz) TO service_role;
