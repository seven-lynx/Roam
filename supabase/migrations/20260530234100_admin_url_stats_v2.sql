-- admin_url_stats() v2
--
-- Extends the RPC with three new aggregates needed by /admin/dashboard:
--   total_serves     — SUM(serve_count) across all approved+active URLs
--   avg_wilson_score — AVG(wilson_score) across approved+active URLs
--   active_users_week — COUNT(DISTINCT user_id) from ratings in the window

DROP FUNCTION IF EXISTS public.admin_url_stats(timestamptz);

CREATE FUNCTION public.admin_url_stats(since_date timestamptz)
RETURNS TABLE (
  total_urls         bigint,
  active_urls        bigint,
  inactive_urls      bigint,
  recent_urls        bigint,
  total_serves       bigint,
  avg_wilson_score   double precision,
  active_users_week  bigint
)
LANGUAGE sql
SECURITY DEFINER
SET statement_timeout TO '30s'
AS $$
  SELECT
    -- Fast approximate counts from pg_class (instant, no table scan)
    (SELECT reltuples::bigint FROM pg_class WHERE oid = 'public.urls'::regclass)         AS total_urls,
    (SELECT reltuples::bigint FROM pg_class WHERE oid = 'idx_urls_active_partial'::regclass)   AS active_urls,
    (SELECT reltuples::bigint FROM pg_class WHERE oid = 'idx_urls_inactive_partial'::regclass) AS inactive_urls,
    -- Exact count for "added this week" (small result set, fast range scan)
    (SELECT COUNT(*)             FROM public.urls    WHERE created_at >= since_date)           AS recent_urls,
    -- Aggregates over approved+active URLs only (bounded by partial index)
    (SELECT COALESCE(SUM(serve_count), 0)::bigint FROM public.urls WHERE approved = TRUE AND inactive = FALSE) AS total_serves,
    (SELECT COALESCE(AVG(wilson_score), 0)         FROM public.urls WHERE approved = TRUE AND inactive = FALSE) AS avg_wilson_score,
    -- Active users: distinct raters in the window
    (SELECT COUNT(DISTINCT user_id) FROM public.ratings WHERE created_at >= since_date)        AS active_users_week;
$$;

-- Restrict to service_role only (admin dashboard uses the service key)
REVOKE EXECUTE ON FUNCTION public.admin_url_stats(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_url_stats(timestamptz) TO service_role;
