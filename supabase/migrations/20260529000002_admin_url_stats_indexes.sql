-- Partial indexes for fast index-only COUNT scans in admin_url_stats().
--
-- With these indexes Postgres can resolve COUNT(*) WHERE approved/inactive = true
-- via an index-only scan instead of a full sequential scan (~3.1M rows).
-- The BRIN index on created_at speeds the recent_urls range scan.

CREATE INDEX IF NOT EXISTS idx_urls_created_at_brin
  ON public.urls USING brin (created_at);

CREATE INDEX IF NOT EXISTS idx_urls_approved_partial
  ON public.urls (id) WHERE approved = true;

CREATE INDEX IF NOT EXISTS idx_urls_inactive_partial
  ON public.urls (id) WHERE inactive = true;

-- Rewrite admin_url_stats to use four separate subqueries so the planner
-- can use the partial indexes above instead of a single full-table scan.
CREATE OR REPLACE FUNCTION public.admin_url_stats(since_date timestamptz)
RETURNS TABLE (
  total_urls    bigint,
  approved_urls bigint,
  inactive_urls bigint,
  recent_urls   bigint
)
LANGUAGE sql
SECURITY DEFINER
SET statement_timeout = '30s'
AS $$
  SELECT
    (SELECT COUNT(*) FROM public.urls)::bigint,
    (SELECT COUNT(*) FROM public.urls WHERE approved = true)::bigint,
    (SELECT COUNT(*) FROM public.urls WHERE inactive = true)::bigint,
    (SELECT COUNT(*) FROM public.urls WHERE created_at >= since_date)::bigint;
$$;
