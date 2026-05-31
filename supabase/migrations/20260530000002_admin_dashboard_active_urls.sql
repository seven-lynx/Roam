-- Admin dashboard: switch the "URLs" stat from approved (which includes
-- retired/inactive) to truly active (approved AND NOT inactive). Adds a
-- partial index so the count can be pulled instantly from pg_class stats.

CREATE INDEX IF NOT EXISTS idx_urls_active_partial
  ON public.urls (id)
  WHERE approved = TRUE AND inactive = FALSE;

ANALYZE public.urls;

DROP FUNCTION IF EXISTS public.admin_url_stats(timestamptz);

CREATE FUNCTION public.admin_url_stats(since_date timestamptz)
RETURNS TABLE (
  total_urls    bigint,
  active_urls   bigint,
  inactive_urls bigint,
  recent_urls   bigint
)
LANGUAGE sql
SECURITY DEFINER
SET statement_timeout TO '30s'
AS $$
  SELECT
    -- Approximate counts from pg_class stats: instant, not affected by visibility map or write load.
    (SELECT reltuples::bigint FROM pg_class WHERE oid = 'public.urls'::regclass),
    (SELECT reltuples::bigint FROM pg_class WHERE oid = 'idx_urls_active_partial'::regclass),
    (SELECT reltuples::bigint FROM pg_class WHERE oid = 'idx_urls_inactive_partial'::regclass),
    (SELECT COUNT(*) FROM public.urls WHERE created_at >= since_date);
$$;
