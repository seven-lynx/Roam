-- admin_analytics()
--
-- Returns eight datasets for /admin analytics tab:
--   1. submissions_by_date      — daily submission counts, last 30 days
--   2. submissions_by_category  — top-10 parent categories by submission count
--   3. top_urls                 — top-10 URLs by wilson_score (uses idx_urls_rated)
--   4. queue_stats              — approved / rejected / pending counts
--   5. top_rated_categories     — avg wilson score per category (min 5 rated URLs)
--   6. source_breakdown         — URL count per seeder source (from MV, hourly)
--   7. language_distribution    — URL count per language (from MV, hourly)
--   8. dead_by_category         — dead URL % per category (from MV, hourly)
--
-- All aggregation done in Postgres; nothing downloaded to the client.
-- Called via supabase.rpc('admin_analytics') through a server action.
--
-- Security: SECURITY DEFINER + explicit revoke so only service_role can call it.

CREATE OR REPLACE FUNCTION public.admin_analytics()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '15s'
AS $$
DECLARE
  v_by_date          JSON;
  v_by_category      JSON;
  v_top_urls         JSON;
  v_queue_stats      JSON;
  v_top_rated_cats   JSON;
  v_sources          JSON;
  v_languages        JSON;
  v_dead_by_category JSON;
BEGIN
  -- ── 1. Submissions per day, last 30 days ──────────────────────────────────
  SELECT json_agg(row ORDER BY row.date)
  INTO v_by_date
  FROM (
    SELECT
      (created_at AT TIME ZONE 'UTC')::date::text AS date,
      COUNT(*)::int                               AS count
    FROM public.moderation_queue
    WHERE created_at >= (NOW() - INTERVAL '30 days')
    GROUP BY 1
  ) row;

  -- ── 2. Submissions by parent category (top 10, all time) ──────────────────
  SELECT json_agg(row ORDER BY row.count DESC)
  INTO v_by_category
  FROM (
    SELECT
      c.name  AS category,
      COUNT(*)::int AS count
    FROM public.moderation_queue mq
    JOIN public.subcategories  sc ON sc.id = mq.subcategory_id
    JOIN public.categories      c  ON c.id  = sc.category_id
    GROUP BY c.name
    ORDER BY count DESC
    LIMIT 10
  ) row;

  -- ── 3. Top 10 URLs by wilson score ────────────────────────────────────────
  SELECT json_agg(row ORDER BY row.wilson_score DESC)
  INTO v_top_urls
  FROM (
    SELECT
      url,
      COALESCE(title, url) AS title,
      ROUND((wilson_score * 100)::numeric, 1)::float AS wilson_score,
      COALESCE(upvotes, 0)::int                      AS upvotes,
      COALESCE(downvotes, 0)::int                    AS downvotes
    FROM public.urls
    WHERE approved = true
      AND (upvotes + downvotes) > 0
    ORDER BY wilson_score DESC
    LIMIT 10
  ) row;

  -- ── 4. Queue stats: counts by status ──────────────────────────────────────
  SELECT json_build_object(
    'approved', COUNT(*) FILTER (WHERE status = 'approved')::int,
    'rejected', COUNT(*) FILTER (WHERE status = 'rejected')::int,
    'pending',  COUNT(*) FILTER (WHERE status = 'pending')::int
  )
  INTO v_queue_stats
  FROM public.moderation_queue;

  -- ── 5. Top rated categories (avg wilson score, min 5 rated URLs) ──────────
  SELECT json_agg(row ORDER BY row.avg_score DESC)
  INTO v_top_rated_cats
  FROM (
    SELECT
      c.name AS category,
      COUNT(*)::int AS rated_urls,
      ROUND((AVG(u.wilson_score) * 100)::numeric, 1)::float AS avg_score
    FROM public.urls u
    JOIN public.subcategories sc ON sc.id = u.subcategory_id
    JOIN public.categories c ON c.id = sc.category_id
    WHERE u.approved = true AND (u.upvotes + u.downvotes) > 0
    GROUP BY c.name
    HAVING COUNT(*) >= 5
    ORDER BY avg_score DESC
  ) row;

  -- ── 6. Source breakdown (materialized view, refreshed hourly) ─────────────
  SELECT json_agg(row ORDER BY row.count DESC)
  INTO v_sources
  FROM (
    SELECT source, count FROM public.mv_analytics_sources
    ORDER BY count DESC LIMIT 20
  ) row;

  -- ── 7. Language distribution (materialized view, refreshed hourly) ─────────
  SELECT json_agg(row ORDER BY row.count DESC)
  INTO v_languages
  FROM (
    SELECT language, count FROM public.mv_analytics_languages
    ORDER BY count DESC LIMIT 15
  ) row;

  -- ── 8. Dead URL rate by category (materialized view, refreshed hourly) ─────
  SELECT json_agg(row ORDER BY row.total DESC)
  INTO v_dead_by_category
  FROM (
    SELECT category, total, inactive_count, dead_pct
    FROM public.mv_analytics_dead_by_category
    ORDER BY total DESC
  ) row;

  RETURN json_build_object(
    'submissions_by_date',     COALESCE(v_by_date,          '[]'::json),
    'submissions_by_category', COALESCE(v_by_category,      '[]'::json),
    'top_urls',                COALESCE(v_top_urls,         '[]'::json),
    'queue_stats',             COALESCE(v_queue_stats,      '{}'::json),
    'top_rated_categories',    COALESCE(v_top_rated_cats,   '[]'::json),
    'source_breakdown',        COALESCE(v_sources,          '[]'::json),
    'language_distribution',   COALESCE(v_languages,        '[]'::json),
    'dead_by_category',        COALESCE(v_dead_by_category, '[]'::json)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_analytics() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_analytics() TO service_role;
