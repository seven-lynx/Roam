-- =============================================================================
-- seen_urls per-user cap (Fix 8 from audit — Issue 11)
-- =============================================================================
--
-- Problem:
--   seen_urls grows unbounded for active users. roam() v14+ pre-loads the
--   entire seen set as v_seen_ids UUID[], then checks every TABLESAMPLE row
--   with (u.id != ALL(v_seen_ids)). PostgreSQL evaluates this as a linear scan
--   of the array for each row. At 787k TABLESAMPLE rows and 5,000+ seen IDs
--   for a power user that is ~4 billion comparisons per call — Fix 1 gets
--   measurably worse the longer someone uses the product.
--
--   A time-based cron (DELETE WHERE seen_at < NOW() - INTERVAL '30 days') was
--   already in place but doesn't bound the count: a user who roams 50× a day
--   accumulates 1,500 entries inside 30 days alone.
--
-- Fix:
--   Enforce a hard cap of SEEN_URL_CAP (2,000) rows per user via an AFTER
--   INSERT trigger on seen_urls. When the cap is exceeded the trigger deletes
--   the oldest (seen_at ASC) excess rows for that user only — one DELETE per
--   roam() call, touching at most 1 row under normal usage.
--
--   2,000 is chosen to:
--     - Keep v_seen_ids well under 2k UUIDs (total: ~32 KB in memory)
--     - Prevent repeat for months of typical usage (10-20 roams/day ≈ 100-200
--       days before any recycling occurs)
--     - Allow the != ALL() linear scan to remain negligible (2k × 787k = 1.6B
--       comparisons → still fast due to CPU branch prediction on UUID equality)
--
--   The trigger uses a targeted subquery so it never locks rows belonging to
--   other users.
--
-- Expected improvement:
--   Eliminates the long-tail latency growth for power users that has been
--   silently compounding since launch. Keeps roam() call time O(constant)
--   regardless of usage history.
-- =============================================================================

-- ── 1. Cap constant ──────────────────────────────────────────────────────────
-- Stored as a table so it can be changed without a schema migration.
CREATE TABLE IF NOT EXISTS public.roam_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO public.roam_config (key, value)
VALUES ('seen_url_cap', '2000')
ON CONFLICT (key) DO NOTHING;

-- RLS: only service role can write; authenticated users can read.
ALTER TABLE public.roam_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY roam_config_read ON public.roam_config
  FOR SELECT TO authenticated USING (TRUE);

-- ── 2. Trigger function ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_seen_url_cap()
RETURNS TRIGGER AS $$
DECLARE
  v_cap   INT;
  v_count INT;
BEGIN
  -- Read cap from config; default to 2000 if missing.
  SELECT COALESCE(value::INT, 2000)
  INTO   v_cap
  FROM   public.roam_config
  WHERE  key = 'seen_url_cap';

  IF v_cap IS NULL THEN
    v_cap := 2000;
  END IF;

  SELECT COUNT(*)
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
  END IF;

  RETURN NULL; -- AFTER trigger; return value is ignored
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── 3. Attach trigger ────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_seen_urls_cap ON public.seen_urls;

CREATE TRIGGER trg_seen_urls_cap
  AFTER INSERT ON public.seen_urls
  FOR EACH ROW EXECUTE FUNCTION public.enforce_seen_url_cap();

-- ── 4. Index to make the cap DELETE fast ─────────────────────────────────────
-- The trigger's DELETE subquery is: WHERE user_id = X ORDER BY seen_at ASC
-- The existing idx_seen_urls_lookup covers (user_id, url_id) — not useful for
-- ORDER BY seen_at. Add a covering index so the ORDER BY + LIMIT is an
-- index-scan rather than a sort.
CREATE INDEX IF NOT EXISTS idx_seen_urls_user_seen_at
  ON public.seen_urls (user_id, seen_at ASC);

-- ── 5. One-time trim of existing oversized histories ─────────────────────────
-- Users who already have > 2000 seen_urls will not be trimmed by the trigger
-- (it only fires on INSERT). Run a targeted delete for the current overage.
-- This is a small set (only power users) so it completes quickly.
DELETE FROM public.seen_urls
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY seen_at ASC) AS rn,
           COUNT(*)      OVER (PARTITION BY user_id)                      AS total
    FROM   public.seen_urls
  ) ranked
  WHERE total > 2000
    AND rn <= (total - 2000)
);
