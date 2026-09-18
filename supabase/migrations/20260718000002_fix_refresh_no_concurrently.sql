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

-- NOTE: The trailing `SELECT refresh_report_views();` was removed on 2026-08-04.
-- It timed out (SQLSTATE 57014) after 120s refreshing all 5 materialized
-- views during `supabase db push`, blocking every subsequent migration
-- (roam() v32/v33/v34/v35) from being applied. The function definition is
-- still created above; materialized views are refreshed by the scheduled
-- `refresh_report_views` job instead of blocking deploys.