-- subcategory_report()
--
-- Returns aggregated seeders & URL counts per subcategory from the `urls`
-- table. Uses GROUP BY (subcategory, source) to avoid expensive COUNT(DISTINCT)
-- on 1.6M rows. Returns ~200-300 rows; client-side JS merges into
-- per-subcategory seeders + URL totals.
--
-- Called via supabase.rpc('subcategory_report')
--
-- Companion helpers:
--   subcategory_null_count()    → count of approved URLs with NULL subcategory_id
--   subcategory_null_sources()  → breakdown of those NULL URLs by source
--   subcategory_total_count()   → total approved URL count

-- ── Main report: one row per (subcategory, source) combination ────────────
DROP FUNCTION IF EXISTS public.subcategory_report();

CREATE OR REPLACE FUNCTION public.subcategory_report()
RETURNS TABLE (
  subcategory_id   uuid,
  subcategory_name text,
  category_name    text,
  source           text,
  url_count        int
)
LANGUAGE sql
SECURITY DEFINER
SET statement_timeout = '30s'
AS $$
  SELECT
    s.id,
    s.name,
    c.name,
    u.source,
    COUNT(*)::int
  FROM subcategories s
  LEFT JOIN categories c ON c.id = s.category_id
  LEFT JOIN urls u       ON u.subcategory_id = s.id AND u.approved = true
  GROUP BY s.id, s.name, c.name, u.source
  ORDER BY c.name, s.name, u.source;
$$;

-- ── NULL-subcategory count ───────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.subcategory_null_count();
CREATE OR REPLACE FUNCTION public.subcategory_null_count()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET statement_timeout = '30s'
AS $$
  SELECT COUNT(*)::bigint
  FROM urls
  WHERE approved = true AND subcategory_id IS NULL;
$$;

-- ── NULL-subcategory breakdown by source ──────────────────────────────────
DROP FUNCTION IF EXISTS public.subcategory_null_sources();
CREATE OR REPLACE FUNCTION public.subcategory_null_sources()
RETURNS TABLE (
  source    text,
  url_count int
)
LANGUAGE sql
SECURITY DEFINER
SET statement_timeout = '30s'
AS $$
  SELECT source, COUNT(*)::int AS url_count
  FROM urls
  WHERE approved = true AND subcategory_id IS NULL
  GROUP BY source
  ORDER BY url_count DESC;
$$;

-- ── Total approved URL count ─────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.subcategory_total_count();
CREATE OR REPLACE FUNCTION public.subcategory_total_count()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET statement_timeout = '30s'
AS $$
  SELECT COUNT(*)::bigint FROM urls WHERE approved = true;
$$;

-- Only service_role may call these.
REVOKE EXECUTE ON FUNCTION public.subcategory_report()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.subcategory_null_count()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.subcategory_null_sources() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.subcategory_total_count()  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.subcategory_report()        TO service_role;
GRANT EXECUTE ON FUNCTION public.subcategory_null_count()    TO service_role;
GRANT EXECUTE ON FUNCTION public.subcategory_null_sources()  TO service_role;
GRANT EXECUTE ON FUNCTION public.subcategory_total_count()   TO service_role;