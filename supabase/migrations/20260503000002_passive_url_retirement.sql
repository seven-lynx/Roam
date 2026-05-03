-- =============================================================================
-- Passive URL Retirement (Task 8.19)
-- =============================================================================
--
-- Adds two automatic retirement triggers and one admin sweep function:
--
--   1. trg_auto_retire_on_reports
--      After INSERT on url_reports: if a URL has >= 3 DISTINCT user reports
--      within the last 30 days, set urls.inactive = TRUE immediately.
--      No cron job required — fires in the same transaction as the report.
--
--   2. trg_auto_retire_low_wilson
--      After UPDATE of wilson_score on urls: if a URL drops below -0.3,
--      set urls.inactive = TRUE. Stronger permanent floor than the -0.1
--      hide-from-results guard already in roam() — this removes the URL
--      from the pool entirely rather than just suppressing it.
--
--   3. retire_low_quality_urls()
--      Admin sweep function: retires all URLs that already satisfy either
--      condition as of the call time. Safe to call repeatedly (idempotent).
--      Returns the count of newly retired rows.
--
-- =============================================================================

-- ── 1. Report-threshold trigger ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_auto_retire_on_reports()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(DISTINCT user_id)
  INTO   v_count
  FROM   public.url_reports
  WHERE  url_id      = NEW.url_id
    AND  reported_at >= NOW() - INTERVAL '30 days';

  IF v_count >= 3 THEN
    UPDATE public.urls
    SET    inactive = TRUE
    WHERE  id = NEW.url_id
      AND  NOT inactive;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_retire_on_reports ON public.url_reports;

CREATE TRIGGER trg_auto_retire_on_reports
AFTER INSERT ON public.url_reports
FOR EACH ROW
EXECUTE FUNCTION public.fn_auto_retire_on_reports();

-- ── 2. Wilson-score-floor trigger ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_auto_retire_low_wilson()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- NEW.wilson_score already satisfies the WHEN condition below;
  -- this function body is intentionally minimal.
  UPDATE public.urls
  SET    inactive = TRUE
  WHERE  id = NEW.id
    AND  NOT inactive;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_retire_low_wilson ON public.urls;

CREATE TRIGGER trg_auto_retire_low_wilson
AFTER UPDATE OF wilson_score ON public.urls
FOR EACH ROW
WHEN (NEW.wilson_score < -0.3 AND NOT NEW.inactive)
EXECUTE FUNCTION public.fn_auto_retire_low_wilson();

-- ── 3. Admin sweep function ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.retire_low_quality_urls()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  n   INT := 0;
  tmp INT;
BEGIN
  -- Retire URLs with >= 3 distinct reporters within the last 30 days
  UPDATE public.urls u
  SET    inactive = TRUE
  FROM (
    SELECT   url_id
    FROM     public.url_reports
    WHERE    reported_at >= NOW() - INTERVAL '30 days'
    GROUP BY url_id
    HAVING   COUNT(DISTINCT user_id) >= 3
  ) r
  WHERE u.id = r.url_id
    AND NOT u.inactive;

  GET DIAGNOSTICS tmp = ROW_COUNT;
  n := n + tmp;

  -- Retire URLs with wilson_score below the -0.3 floor
  UPDATE public.urls
  SET    inactive = TRUE
  WHERE  wilson_score < -0.3
    AND  NOT inactive;

  GET DIAGNOSTICS tmp = ROW_COUNT;
  n := n + tmp;

  RETURN n;
END;
$$;

-- Allow authenticated admins to call the sweep from the dashboard
REVOKE ALL ON FUNCTION public.retire_low_quality_urls() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.retire_low_quality_urls() TO service_role;
