-- =============================================================================
-- home_stats() performance fix
-- =============================================================================
-- The `urls` table has ~1M rows. The previous home_stats() computed COUNT and
-- SUM over it on every call; the two sequential scans exceed the `anon` role's
-- 3s statement_timeout, so the public endpoint kept timing out (SQLSTATE 57014)
-- and the telemetry widget showed zeros.
--
-- Fix: cache the aggregates in a single-row snapshot, refresh it on a cron
-- schedule (runs as the postgres role, which has a 2min timeout), and make
-- home_stats() read the snapshot in O(1). The public read path is unchanged —
-- still SECURITY DEFINER, still granted to anon/authenticated.
--
-- Rollback: DROP TABLE IF EXISTS public.home_stats_snapshot;
--           then restore the previous home_stats() body.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.home_stats_snapshot (
  id            boolean PRIMARY KEY DEFAULT true CHECK (id),
  total_users   bigint NOT NULL DEFAULT 0,
  total_ratings bigint NOT NULL DEFAULT 0,
  active_urls   bigint NOT NULL DEFAULT 0,
  active_tags   bigint NOT NULL DEFAULT 0,
  total_serves  bigint NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- anon/authenticated read this only through the SECURITY DEFINER function.
ALTER TABLE public.home_stats_snapshot ENABLE ROW LEVEL SECURITY;

-- Recompute the snapshot. Expensive by design — call on a schedule, never per request.
CREATE OR REPLACE FUNCTION public.refresh_home_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.home_stats_snapshot
    (id, total_users, total_ratings, active_urls, active_tags, total_serves, updated_at)
  SELECT
    true,
    (SELECT count(*)::bigint FROM public.profiles),
    (SELECT count(*)::bigint FROM public.ratings),
    u.cnt,
    (SELECT count(*)::bigint FROM public.tags WHERE is_active = TRUE),
    u.srv,
    now()
  FROM (
    SELECT count(*)::bigint AS cnt, COALESCE(sum(serve_count), 0)::bigint AS srv
      FROM public.urls
     WHERE approved = TRUE AND inactive = FALSE
  ) u
  ON CONFLICT (id) DO UPDATE SET
    total_users   = EXCLUDED.total_users,
    total_ratings = EXCLUDED.total_ratings,
    active_urls   = EXCLUDED.active_urls,
    active_tags   = EXCLUDED.active_tags,
    total_serves  = EXCLUDED.total_serves,
    updated_at    = EXCLUDED.updated_at;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_home_stats() FROM PUBLIC;

-- Fast public read path — always returns exactly one row.
CREATE OR REPLACE FUNCTION public.home_stats()
RETURNS TABLE (
  total_users   bigint,
  total_ratings bigint,
  active_urls   bigint,
  active_tags   bigint,
  total_serves  bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    COALESCE((SELECT total_users   FROM public.home_stats_snapshot WHERE id = TRUE), 0),
    COALESCE((SELECT total_ratings FROM public.home_stats_snapshot WHERE id = TRUE), 0),
    COALESCE((SELECT active_urls   FROM public.home_stats_snapshot WHERE id = TRUE), 0),
    COALESCE((SELECT active_tags   FROM public.home_stats_snapshot WHERE id = TRUE), 0),
    COALESCE((SELECT total_serves  FROM public.home_stats_snapshot WHERE id = TRUE), 0);
$$;

GRANT EXECUTE ON FUNCTION public.home_stats() TO anon, authenticated;

-- Seed the snapshot now (this single call is the only slow step).
SELECT public.refresh_home_stats();

-- Refresh hourly so the counters track live traffic.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-home-stats') THEN
    PERFORM cron.unschedule('refresh-home-stats');
  END IF;
  PERFORM cron.schedule('refresh-home-stats', '0 * * * *', 'SELECT public.refresh_home_stats();');
END
$$;
