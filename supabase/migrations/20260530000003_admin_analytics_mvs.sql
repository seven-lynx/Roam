-- Analytics materialized views for admin dashboard.
-- These aggregate over the 3.1M-row urls table, which takes ~15s as a live
-- query. Pre-computing them as materialized views brings reads to <1ms.
-- pg_cron refreshes each view hourly (staggered to avoid contention).

-- ── Source breakdown ──────────────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_analytics_sources AS
SELECT source, COUNT(*)::int AS count
FROM public.urls
WHERE approved = true AND inactive = false
GROUP BY source;

CREATE UNIQUE INDEX IF NOT EXISTS mv_analytics_sources_pkey
  ON public.mv_analytics_sources (source);

-- ── Language distribution ─────────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_analytics_languages AS
SELECT language, COUNT(*)::int AS count
FROM public.urls
WHERE approved = true AND inactive = false
GROUP BY language;

CREATE UNIQUE INDEX IF NOT EXISTS mv_analytics_languages_pkey
  ON public.mv_analytics_languages (language);

-- ── Dead URL rate by category ─────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_analytics_dead_by_category AS
SELECT
  c.name AS category,
  COUNT(*)::int                                                                      AS total,
  COUNT(*) FILTER (WHERE u.inactive = true)::int                                    AS inactive_count,
  ROUND(
    (COUNT(*) FILTER (WHERE u.inactive = true)::numeric / NULLIF(COUNT(*), 0) * 100),
    1
  )::float                                                                           AS dead_pct
FROM public.urls u
JOIN public.subcategories sc ON sc.id = u.subcategory_id
JOIN public.categories c ON c.id = sc.category_id
WHERE u.approved = true
GROUP BY c.name;

CREATE UNIQUE INDEX IF NOT EXISTS mv_analytics_dead_by_category_pkey
  ON public.mv_analytics_dead_by_category (category);

-- ── Partial index for approved URLs by subcategory (supports dead-rate queries)
CREATE INDEX IF NOT EXISTS idx_urls_approved_subcat
  ON public.urls (subcategory_id)
  INCLUDE (inactive)
  WHERE approved = true;

-- ── Weekly cron jobs (Sunday 02:00 UTC, staggered 5 min apart) ───────────────
-- Requires pg_cron (already enabled on this project).
SELECT cron.schedule(
  'refresh-mv-analytics-sources',
  '0 2 * * 0',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_analytics_sources'
);

SELECT cron.schedule(
  'refresh-mv-analytics-languages',
  '5 2 * * 0',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_analytics_languages'
);

SELECT cron.schedule(
  'refresh-mv-analytics-dead-by-category',
  '10 2 * * 0',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_analytics_dead_by_category'
);
