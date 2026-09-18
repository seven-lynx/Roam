-- =============================================================================
-- Report Materialized Views — mirror offline report queries for live access
-- Deploy in Supabase SQL Editor if REST API times out (>60s GROUP BY).
-- =============================================================================

-- MV 1: Category Coverage Matrix (A2)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_report_category_matrix AS
SELECT
  COALESCE(c.name, 'unknown') AS category,
  COUNT(*)::int AS total,
  COUNT(*) FILTER (WHERE NOT u.inactive)::int AS active,
  COUNT(*) FILTER (WHERE u.inactive)::int AS inactive,
  COUNT(*) FILTER (WHERE (u.upvotes + u.downvotes) > 0)::int AS rated,
  ROUND((COALESCE(AVG(u.wilson_score) FILTER (WHERE (u.upvotes + u.downvotes) > 0), 0) * 100)::numeric, 1)::float AS avg_wilson
FROM public.urls u
JOIN public.subcategories sc ON sc.id = u.subcategory_id
JOIN public.categories c ON c.id = sc.category_id
GROUP BY c.name
ORDER BY total DESC;

-- MV 2: Source Contribution (A4)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_report_source_contrib AS
SELECT
  COALESCE(u.source, 'unknown') AS source,
  COUNT(*)::int AS total,
  COUNT(*) FILTER (WHERE NOT u.inactive)::int AS active,
  COUNT(*) FILTER (WHERE u.inactive)::int AS dead,
  COUNT(*) FILTER (WHERE (u.upvotes + u.downvotes) > 0)::int AS rated,
  ROUND((COALESCE(AVG(u.wilson_score) FILTER (WHERE (u.upvotes + u.downvotes) > 0), 0) * 100)::numeric, 1)::float AS avg_w
FROM public.urls u WHERE u.source IS NOT NULL
GROUP BY u.source ORDER BY total DESC LIMIT 30;

-- MV 3: Zero-Vote Gaps (A6)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_report_zero_vote_gaps AS
SELECT
  COALESCE(c.name, 'unknown') AS category,
  COUNT(*)::int AS zero_votes
FROM public.urls u
JOIN public.subcategories sc ON sc.id = u.subcategory_id
JOIN public.categories c ON c.id = sc.category_id
WHERE u.upvotes = 0 AND u.downvotes = 0
GROUP BY c.name ORDER BY zero_votes DESC;

-- MV 4: Language Distribution (A7)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_report_language_distribution AS
SELECT COALESCE(language, 'unknown') AS language, COUNT(*)::int AS count
FROM public.urls GROUP BY language ORDER BY count DESC;

-- MV 5: Age Distribution (A8)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_report_age_distribution AS
SELECT '<1 month' AS bucket, COUNT(*)::int AS count FROM public.urls WHERE created_at >= NOW() - INTERVAL '30 days'
UNION ALL SELECT '1-3 months', COUNT(*)::int FROM public.urls WHERE created_at >= NOW() - INTERVAL '90 days' AND created_at < NOW() - INTERVAL '30 days'
UNION ALL SELECT '3-6 months', COUNT(*)::int FROM public.urls WHERE created_at >= NOW() - INTERVAL '180 days' AND created_at < NOW() - INTERVAL '90 days'
UNION ALL SELECT '6-12 months', COUNT(*)::int FROM public.urls WHERE created_at >= NOW() - INTERVAL '365 days' AND created_at < NOW() - INTERVAL '180 days'
UNION ALL SELECT '>12 months', COUNT(*)::int FROM public.urls WHERE created_at < NOW() - INTERVAL '365 days';

-- Refresh function
CREATE OR REPLACE FUNCTION public.refresh_report_views()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET statement_timeout = '120s' AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_report_category_matrix;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_report_source_contrib;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_report_zero_vote_gaps;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_report_language_distribution;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_report_age_distribution;
END; $$;

REVOKE EXECUTE ON FUNCTION public.refresh_report_views() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_report_views() TO service_role;