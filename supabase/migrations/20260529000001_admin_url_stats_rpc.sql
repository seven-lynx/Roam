-- admin_url_stats(since_date)
--
-- Returns the four url-table counts needed by /admin/dashboard.
--
-- Approach: four separate correlated subqueries so the planner can use a
-- partial index-only scan for each one instead of a single full-table scan.
-- The function sets statement_timeout = '30s' to override the PostgREST
-- session default (~8 s).
--
-- Called via supabase.rpc('admin_url_stats', { since_date: '...' })

-- ── Partial indexes for fast index-only COUNT scans ───────────────────────────

-- Total count: no useful partial index (must count everything).
-- A BRIN index on created_at speeds the recent_urls range scan significantly.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_urls_created_at_brin
  ON public.urls USING brin (created_at);

-- Partial index: rows where approved = true
-- Allows: SELECT COUNT(*) FROM urls WHERE approved = true  → index-only scan
CREATE INDEX IF NOT EXISTS idx_urls_approved_partial
  ON public.urls (id) WHERE approved = true;

-- Partial index: rows where inactive = true
-- Allows: SELECT COUNT(*) FROM urls WHERE inactive = true  → index-only scan
CREATE INDEX IF NOT EXISTS idx_urls_inactive_partial
  ON public.urls (id) WHERE inactive = true;

-- ── RPC function ──────────────────────────────────────────────────────────────

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

-- Only the service role (used by the admin dashboard) may call this.
REVOKE EXECUTE ON FUNCTION public.admin_url_stats(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_url_stats(timestamptz) TO service_role;
