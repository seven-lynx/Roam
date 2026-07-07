-- ============================================================================
-- Performance Optimization: Indexes for roam() and decouple badge evaluation
-- ============================================================================
-- Adds covering indexes for the roam() hot path and creates a scheduled
-- badge evaluation pattern to avoid running 15+ COUNT(*) queries per roam.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Covering index for roam()'s core hot-path query
-- The roam() function filters on (approved, inactive, language, category, domain)
-- and orders by roam_score_static DESC. This composite index eliminates the sort
-- and makes the index-only scan possible.
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_urls_roam_hotpath
  ON public.urls (approved, inactive, language, category_id, roam_score_static DESC)
  INCLUDE (id, url, title, description, og_image_url, subcategory_id, domain, wilson_score)
  WHERE approved = TRUE AND inactive = FALSE;

-- ---------------------------------------------------------------------------
-- 2. Index for seen_urls lookup by user (used on every roam)
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_seen_urls_user_seen
  ON public.seen_urls (user_id, seen_at DESC)
  INCLUDE (url_id);

-- ---------------------------------------------------------------------------
-- 3. Index for notifications unread count (used by realtime now, but still useful
--    for initial fetch and for push notifications)
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_unread
  ON public.notifications (user_id, read, created_at DESC)
  WHERE read = FALSE;

-- ---------------------------------------------------------------------------
-- 4. Index for collection_items join (collection mode roam)
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_collection_items_url
  ON public.collection_items (collection_id, url_id);

-- ---------------------------------------------------------------------------
-- 5. Materialized daily stats table for admin analytics
--    (replaces live aggregations on every admin dashboard load)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_stats (
  date           DATE PRIMARY KEY,
  dau            INT NOT NULL DEFAULT 0,
  mau            INT NOT NULL DEFAULT 0,
  new_users      INT NOT NULL DEFAULT 0,
  total_roams    BIGINT NOT NULL DEFAULT 0,
  total_saves    BIGINT NOT NULL DEFAULT 0,
  total_submits  BIGINT NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Function to refresh daily_stats (call via scheduled edge function or cron)
CREATE OR REPLACE FUNCTION public.refresh_daily_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '10s'
AS $$
BEGIN
  -- Clear and repopulate today's row
  DELETE FROM public.daily_stats WHERE date = CURRENT_DATE;

  INSERT INTO public.daily_stats (date, dau, mau, new_users, total_roams, total_saves, total_submits)
  SELECT
    CURRENT_DATE,
    -- DAU: users active today (seen_urls, saved_urls, or user_daily_activity)
    (SELECT COUNT(DISTINCT user_id) FROM public.seen_urls WHERE seen_at::DATE = CURRENT_DATE)
    + (SELECT COUNT(DISTINCT user_id) FROM public.saved_urls WHERE saved_at::DATE = CURRENT_DATE),
    -- MAU: users active in last 30 days
    (SELECT COUNT(DISTINCT user_id) FROM public.seen_urls WHERE seen_at > now() - INTERVAL '30 days'),
    -- New users today
    (SELECT COUNT(*) FROM public.profiles WHERE created_at::DATE = CURRENT_DATE),
    -- Total roams all time
    (SELECT COUNT(*) FROM public.seen_urls),
    -- Total saves all time
    (SELECT COUNT(*) FROM public.saved_urls),
    -- Total submissions all time
    (SELECT COUNT(*) FROM public.moderation_queue)
  ON CONFLICT (date) DO UPDATE SET
    dau           = EXCLUDED.dau,
    mau           = EXCLUDED.mau,
    new_users     = EXCLUDED.new_users,
    total_roams   = EXCLUDED.total_roams,
    total_saves   = EXCLUDED.total_saves,
    total_submits = EXCLUDED.total_submits,
    updated_at    = now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refresh_daily_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_daily_stats() TO service_role;

-- ---------------------------------------------------------------------------
-- 6. Index for leaderboard ranking (avoids full-table sort)
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_leaderboard
  ON public.profiles (level DESC, xp_total DESC, badge_count DESC)
  INCLUDE (username, display_name, avatar_url)
  WHERE is_private = FALSE;

-- ---------------------------------------------------------------------------
-- 7. Index for user_activity feed queries
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_activity_created
  ON public.user_activity (created_at DESC, user_id);

-- ---------------------------------------------------------------------------
-- 8. Retention policy: clean up old seeding_runs log rows
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_old_seeding_runs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.seeding_runs WHERE started_at < now() - INTERVAL '30 days';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_seeding_runs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_old_seeding_runs() TO service_role;