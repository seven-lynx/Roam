-- Fix: drop CONCURRENTLY from refresh (needs unique indexes)
CREATE OR REPLACE FUNCTION public.refresh_report_views()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET statement_timeout = '120s' AS $$
BEGIN
  REFRESH MATERIALIZED VIEW mv_report_category_matrix;
  REFRESH MATERIALIZED VIEW mv_report_source_contrib;
  REFRESH MATERIALIZED VIEW mv_report_zero_vote_gaps;
  REFRESH MATERIALIZED VIEW mv_report_language_distribution;
  REFRESH MATERIALIZED VIEW mv_report_age_distribution;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refresh_report_views() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_report_views() TO service_role;

-- Run now
SELECT refresh_report_views();