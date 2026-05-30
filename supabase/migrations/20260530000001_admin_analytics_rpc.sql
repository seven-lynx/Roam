-- admin_analytics()
--
-- Returns three datasets for /admin analytics tab:
--   1. submissions_by_date   — daily submission counts for the last 30 days
--   2. submissions_by_category — top-10 parent categories by submission count
--   3. top_urls              — top-10 URLs by wilson_score
--
-- All aggregation done in Postgres; nothing downloaded to the client.
-- Called via supabase.rpc('admin_analytics')
--
-- Security: SECURITY DEFINER + explicit revoke so only service_role can call it.

CREATE OR REPLACE FUNCTION public.admin_analytics()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '15s'
AS $$
DECLARE
  v_by_date      JSON;
  v_by_category  JSON;
  v_top_urls     JSON;
BEGIN
  -- ── 1. Submissions per day, last 30 calendar days ─────────────────────────
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

  -- ── 2. Submissions by parent category (top 10) ────────────────────────────
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

  RETURN json_build_object(
    'submissions_by_date',     COALESCE(v_by_date,     '[]'::json),
    'submissions_by_category', COALESCE(v_by_category, '[]'::json),
    'top_urls',                COALESCE(v_top_urls,    '[]'::json)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_analytics() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_analytics() TO service_role;
