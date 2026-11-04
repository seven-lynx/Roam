-- =============================================================================
-- Serve telemetry + hygiene: replace the broken urls.serve_count with a
-- lifetime counter maintained by a rollup-before-prune job, and add a periodic
-- hygiene query that flags "over-served but never rated" URLs.
--
-- Background:
--   urls.serve_count was meant to be incremented on every serve, but roam()
--   v22+ dropped the increment, so the column has been 0 forever (and
--   home_stats().total_serves therefore reported 0). Re-adding a per-serve
--   UPDATE to the ~1M-row `urls` table on the hottest path would create
--   dead-tuple churn / vacuum pressure on the largest table — the opposite of
--   efficient. The serve event is ALREADY recorded in seen_urls (bounded by a
--   30-day prune + a 2,000-row/user cap), so we derive both goals from that.
--
-- This migration:
--   1. Adds a single-row lifetime counter (serve_counter).
--   2. Re-points the nightly seen_urls prune to roll rows up into that counter
--      before deleting them (rollup-before-prune).
--   3. Makes the per-user cap trigger roll evicted rows up too, so no serves
--      are lost.
--   4. Re-sources home_stats().total_serves to
--      serve_counter.total_serves + COUNT(seen_urls) — the lifetime total, read
--      in O(1) via the existing hourly snapshot refresh.
--   5. Adds a daily hygiene job that flags URLs seen by >= N distinct users in
--      the last 30 days with zero votes.
--
-- Note: `serve_count` becomes vestigial (never written, never meaningfully
-- read). It is intentionally left in place to avoid a cascading drop; the
-- inert +0.25 exploration-bonus term in roam() v35 is unaffected (it has been
-- a constant since the v22 rewrite dropped the increment).
--
-- Rollback: see RUNBOOK.md § 20261103000009_serve_telemetry_hygiene.sql.
-- =============================================================================

-- ── 1. Lifetime serve counter (single row) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.serve_counter (
  id           boolean     PRIMARY KEY DEFAULT true CHECK (id),
  total_serves bigint      NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.serve_counter (id, total_serves) VALUES (true, 0)
ON CONFLICT (id) DO NOTHING;

-- Only postgres/service_role (via SECURITY DEFINER functions) may touch this.
ALTER TABLE public.serve_counter ENABLE ROW LEVEL SECURITY;

-- ── 2. Rollup-before-prune for the nightly seen_urls cleanup ─────────────────
-- Atomically delete >30-day rows and fold the count into serve_counter so the
-- lifetime total is not lost as the window rolls forward.
CREATE OR REPLACE FUNCTION public.rollup_seen_urls_and_prune()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_serves bigint;
BEGIN
  WITH doomed AS (
    DELETE FROM public.seen_urls
    WHERE seen_at < NOW() - INTERVAL '30 days'
    RETURNING 1
  )
  SELECT count(*) INTO v_serves FROM doomed;

  IF v_serves > 0 THEN
    UPDATE public.serve_counter
       SET total_serves = total_serves + v_serves,
           updated_at   = now()
     WHERE id = true;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.rollup_seen_urls_and_prune() FROM PUBLIC;

-- ── 3. Cap trigger rollup (so evicted rows are counted too) ─────────────────
-- The 2,000-row/user cap can evict rows that are still inside the 30-day
-- window. Fold those into serve_counter so they are not lost from the lifetime
-- total. (This only executes when a user exceeds the cap, i.e. rarely.)
CREATE OR REPLACE FUNCTION public.enforce_seen_url_cap()
RETURNS TRIGGER AS $$
DECLARE
  v_cap     int;
  v_count   int;
  v_deleted int;
BEGIN
  -- Read cap from config; default to 2000 if missing.
  SELECT COALESCE(value::int, 2000)
  INTO   v_cap
  FROM   public.roam_config
  WHERE  key = 'seen_url_cap';

  IF v_cap IS NULL THEN
    v_cap := 2000;
  END IF;

  SELECT count(*)
  INTO   v_count
  FROM   public.seen_urls
  WHERE  user_id = NEW.user_id;

  IF v_count > v_cap THEN
    DELETE FROM public.seen_urls
    WHERE id IN (
      SELECT id
      FROM   public.seen_urls
      WHERE  user_id = NEW.user_id
      ORDER  BY seen_at ASC
      LIMIT  (v_count - v_cap)
    );

    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    IF v_deleted > 0 THEN
      UPDATE public.serve_counter
         SET total_serves = total_serves + v_deleted,
             updated_at   = now()
       WHERE id = true;
    END IF;
  END IF;

  RETURN NULL; -- AFTER trigger; return value is ignored
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── 4. Re-source home_stats().total_serves from the lifetime counter ─────────
-- active_urls still comes from urls (partial-index COUNT). total_serves is now
-- serve_counter.total_serves + the rows still inside the 30-day window.
-- (seen_urls is bounded by the per-user cap, so COUNT(*) is cheap.)
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
    (SELECT count(*)::bigint FROM public.urls WHERE approved = TRUE AND inactive = FALSE),
    (SELECT count(*)::bigint FROM public.tags WHERE is_active = TRUE),
    (SELECT COALESCE(sc.total_serves, 0) FROM public.serve_counter sc WHERE id = true)
      + (SELECT count(*)::bigint FROM public.seen_urls),
    now()
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

-- ── 5. Hygiene: flag over-served-but-never-rated URLs ────────────────────────
CREATE TABLE IF NOT EXISTS public.over_served_unrated (
  url_id          uuid PRIMARY KEY,
  url             text NOT NULL,
  title           text,
  distinct_serves bigint NOT NULL DEFAULT 0,
  first_seen_at   timestamptz,
  last_seen_at    timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Populated by a SECURITY DEFINER function; read by service_role only.
ALTER TABLE public.over_served_unrated ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.refresh_over_served_unrated(p_min_serves int DEFAULT 10)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.over_served_unrated;

  INSERT INTO public.over_served_unrated
    (url_id, url, title, distinct_serves, first_seen_at, last_seen_at, updated_at)
  SELECT
    su.url_id,
    u.url,
    u.title,
    count(DISTINCT su.user_id) AS distinct_serves,
    min(su.seen_at)            AS first_seen_at,
    max(su.seen_at)            AS last_seen_at,
    now()
  FROM public.seen_urls su
  JOIN public.urls u ON u.id = su.url_id
  WHERE u.approved = TRUE
    AND u.inactive = FALSE
    AND COALESCE(u.upvotes, 0) = 0
    AND COALESCE(u.downvotes, 0) = 0
  GROUP BY su.url_id, u.url, u.title
  HAVING count(DISTINCT su.user_id) >= p_min_serves
  ORDER BY count(DISTINCT su.user_id) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_over_served_unrated(integer) FROM PUBLIC;

-- ── 6. (Re)schedule the jobs ─────────────────────────────────────────────────

-- 6a. Nightly prune now rolls up before deleting (same schedule: 03:00 UTC).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'delete-old-seen-urls') THEN
    PERFORM cron.unschedule('delete-old-seen-urls');
  END IF;
  PERFORM cron.schedule(
    'delete-old-seen-urls',
    '0 3 * * *',
    'SELECT public.rollup_seen_urls_and_prune();'
  );
END
$$;

-- 6b. Daily hygiene refresh (runs after the 03:00 prune).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-over-served-unrated') THEN
    PERFORM cron.unschedule('refresh-over-served-unrated');
  END IF;
  PERFORM cron.schedule(
    'refresh-over-served-unrated',
    '0 4 * * *',
    'SELECT public.refresh_over_served_unrated(10);'
  );
END
$$;

-- Seed both outputs now so the values are live immediately (the snapshot read
-- path and the hygiene table are both populated without waiting for cron).
SELECT public.refresh_home_stats();
SELECT public.refresh_over_served_unrated(10);
