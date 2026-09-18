-- =============================================================================
-- Revert admin_analytics() from v5 back to stable v3 (12 datasets, <10s).
-- v5 timed out because it added 24 heavy GROUP BY queries across 1.5M rows.
-- Separate focused RPCs will provide the extra data without timeouts.
--
-- v6: Source active_users (DAU/MAU) from materialized daily_stats table.
--     Add daily_stats_last30 and total_counts to the response.
-- =============================================================================

DROP FUNCTION IF EXISTS public.admin_analytics() CASCADE;

CREATE OR REPLACE FUNCTION public.admin_analytics()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '30s'
AS $$
DECLARE
  v_by_date             JSON;
  v_by_category         JSON;
  v_top_urls            JSON;
  v_queue_stats         JSON;
  v_top_rated_cats      JSON;
  v_sources             JSON;
  v_languages           JSON;
  v_dead_by_category    JSON;
  v_active_users        JSON;
  v_by_dow_hour         JSON;
  v_velocity            JSON;
  v_rejection_by_domain JSON;
  v_daily_stats_last30  JSON;
  v_total_counts        JSON;
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

  -- ── 9. Active users: DAU/MAU from daily_stats; WAU still computed live ────
  SELECT json_build_object(
    'dau', COALESCE((SELECT dau FROM public.daily_stats WHERE date = CURRENT_DATE), 0),
    'wau', COALESCE((SELECT COUNT(DISTINCT user_id)::int FROM (
              SELECT user_id FROM public.seen_urls
              WHERE seen_at >= NOW() - INTERVAL '7 days'
              UNION
              SELECT user_id FROM public.ratings
              WHERE created_at >= NOW() - INTERVAL '7 days'
            ) wau_users), 0),
    'mau', COALESCE((SELECT mau FROM public.daily_stats WHERE date = CURRENT_DATE), 0)
  )
  INTO v_active_users;

  -- ── 9b. Daily stats trend (last 30 days) for admin sparklines ─────────────
  SELECT json_agg(row ORDER BY row.date)
  INTO v_daily_stats_last30
  FROM (
    SELECT
      date::text       AS date,
      dau,
      mau,
      new_users,
      total_roams,
      total_saves,
      total_submits
    FROM public.daily_stats
    WHERE date >= CURRENT_DATE - INTERVAL '29 days'
    ORDER BY date
  ) row;

  -- ── 9c. All-time total counts from the latest daily_stats row ──────────────
  SELECT json_build_object(
    'total_roams',   COALESCE((SELECT total_roams   FROM public.daily_stats WHERE date = CURRENT_DATE), 0),
    'total_saves',   COALESCE((SELECT total_saves   FROM public.daily_stats WHERE date = CURRENT_DATE), 0),
    'total_submits', COALESCE((SELECT total_submits FROM public.daily_stats WHERE date = CURRENT_DATE), 0)
  )
  INTO v_total_counts;

  -- ── 10. Submissions by day-of-week × hour-of-day ───────────────────────────
  SELECT json_agg(row ORDER BY row.dow, row.hour)
  INTO v_by_dow_hour
  FROM (
    SELECT
      EXTRACT(DOW FROM (created_at AT TIME ZONE 'America/New_York'))::int AS dow,
      EXTRACT(HOUR FROM (created_at AT TIME ZONE 'America/New_York'))::int AS hour,
      COUNT(*)::int AS count
    FROM public.moderation_queue
    GROUP BY 1, 2
  ) row;

  -- ── 11. Velocity: approved URLs created this week vs last week ─────────────
  SELECT json_build_object(
    'this_week', (SELECT COUNT(*)::int FROM public.urls
                  WHERE approved = true
                    AND created_at >= date_trunc('week', NOW() AT TIME ZONE 'America/New_York')),
    'last_week', (SELECT COUNT(*)::int FROM public.urls
                  WHERE approved = true
                    AND created_at >= date_trunc('week', NOW() AT TIME ZONE 'America/New_York') - INTERVAL '7 days'
                    AND created_at <  date_trunc('week', NOW() AT TIME ZONE 'America/New_York'))
  )
  INTO v_velocity;

  -- ── 12. Rejection rate by domain ───────────────────────────────────────────
  SELECT json_agg(row ORDER BY row.rejection_pct DESC)
  INTO v_rejection_by_domain
  FROM (
    SELECT
      domain,
      total,
      rejected,
      ROUND((rejected::numeric / total::numeric * 100)::numeric, 1)::float AS rejection_pct
    FROM (
      SELECT
        LOWER(SPLIT_PART(SPLIT_PART(url, '/', 3), ':', 1)) AS domain,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected
      FROM public.moderation_queue
      WHERE url IS NOT NULL AND url != ''
        AND url LIKE 'http%'
      GROUP BY 1
      HAVING COUNT(*) >= 5
    ) sub
    ORDER BY rejection_pct DESC
    LIMIT 15
  ) row;

  RETURN json_build_object(
    'submissions_by_date',     COALESCE(v_by_date,            '[]'::json),
    'submissions_by_category', COALESCE(v_by_category,        '[]'::json),
    'top_urls',                COALESCE(v_top_urls,           '[]'::json),
    'queue_stats',             COALESCE(v_queue_stats,        '{}'::json),
    'top_rated_categories',    COALESCE(v_top_rated_cats,     '[]'::json),
    'source_breakdown',        COALESCE(v_sources,            '[]'::json),
    'language_distribution',   COALESCE(v_languages,          '[]'::json),
    'dead_by_category',        COALESCE(v_dead_by_category,   '[]'::json),
    'active_users',            COALESCE(v_active_users,       '{}'::json),
    'daily_stats_last30',      COALESCE(v_daily_stats_last30, '[]'::json),
    'total_counts',            COALESCE(v_total_counts,       '{}'::json),
    'submissions_by_dow_hour', COALESCE(v_by_dow_hour,        '[]'::json),
    'velocity',                COALESCE(v_velocity,           '{}'::json),
    'rejection_by_domain',     COALESCE(v_rejection_by_domain,'[]'::json)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_analytics() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_analytics() TO service_role;