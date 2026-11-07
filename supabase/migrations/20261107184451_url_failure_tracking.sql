-- =============================================================================
-- URL failure tracking + threshold retirement (replaces log-failed-urls)
-- =============================================================================
--
-- The former log-failed-urls Edge Function (issue #48) never worked: it wrote
-- `submitted_by_id`/`status = 'auto_flagged'` to moderation_queue, neither of
-- which exists there, and upserted on a column with no unique constraint. It
-- also had no caller. Failed-URL tracking belongs in its own aggregate, not in
-- the human moderation queue.
--
-- Design:
--   * url_failure_reports holds ONE row per (url_id, user_id) — the primary key
--     is the duplicate suppression, so storage is bounded by distinct
--     (URL, reporter) pairs instead of growing with every failure event.
--   * report_url_failures(jsonb) is a single batch RPC. Identity comes from
--     auth.uid(), so there is no way to forget to check the caller (the defect
--     class that produced #48), and no service-role key sits in the write path.
--   * The retirement check is scoped to the url_ids in the current batch only —
--     it never aggregates the table or scans urls beyond those ids.
--   * Threshold: >= 2 distinct users AND >= 3 total failures within 30 days.
--   * Blast-radius guards: a batch may retire at most 25 URLs, and the pool may
--     retire at most 500 per day. On breach the failure rows are still recorded,
--     the retirement is skipped, and a WARNING is raised for the log reader.
--   * Culling is reversible: admin-moderation `restore` clears urls.inactive,
--     and the trg_urls_inactive_since trigger clears inactive_since with it.
-- =============================================================================

-- ── 1. urls.inactive_since — when the URL was retired ────────────────────────
-- Drives the daily blast-radius guard, the purge age test, and admin UI. Set by
-- trigger so every retirement path (this RPC, report-url, the wilson floor, the
-- admin sweep) gets a timestamp without each call site remembering to.

ALTER TABLE public.urls
  ADD COLUMN IF NOT EXISTS inactive_since TIMESTAMPTZ;

-- Existing retired rows: updated_at is the best available proxy for when.
UPDATE public.urls
   SET inactive_since = updated_at
 WHERE inactive
   AND inactive_since IS NULL;

CREATE INDEX IF NOT EXISTS idx_urls_inactive_since
  ON public.urls (inactive_since)
  WHERE inactive_since IS NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_urls_inactive_since()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT NEW.inactive THEN
    NEW.inactive_since := NULL;          -- restored: no longer retired
  ELSIF NEW.inactive_since IS NULL THEN
    NEW.inactive_since := NOW();         -- newly retired
  END IF;
  RETURN NEW;
END;
$$;

-- Two triggers on purpose: the UPDATE one is `OF inactive` so it costs nothing on
-- the hot wilson_score recompute path, where urls is updated per rating.
DROP TRIGGER IF EXISTS trg_urls_inactive_since_ins ON public.urls;
CREATE TRIGGER trg_urls_inactive_since_ins
  BEFORE INSERT ON public.urls
  FOR EACH ROW EXECUTE FUNCTION public.handle_urls_inactive_since();

DROP TRIGGER IF EXISTS trg_urls_inactive_since ON public.urls;
CREATE TRIGGER trg_urls_inactive_since
  BEFORE UPDATE OF inactive ON public.urls
  FOR EACH ROW EXECUTE FUNCTION public.handle_urls_inactive_since();


-- ── 2. url_failure_reports — one row per (url, reporter) ─────────────────────

CREATE TABLE IF NOT EXISTS public.url_failure_reports (
  url_id       UUID        NOT NULL REFERENCES public.urls(id)     ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fail_count   INTEGER     NOT NULL DEFAULT 1 CHECK (fail_count > 0),
  last_reason  TEXT,
  first_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (url_id, user_id)
);

-- Purge scan support (pg_cron job at the bottom of this file).
CREATE INDEX IF NOT EXISTS idx_url_failure_reports_last_seen
  ON public.url_failure_reports (last_seen);

ALTER TABLE public.url_failure_reports ENABLE ROW LEVEL SECURITY;

-- Read-only for the reporter and admins. There is deliberately NO insert/update
-- policy: all writes go through report_url_failures(), which is SECURITY DEFINER
-- and derives the reporter from auth.uid().
DROP POLICY IF EXISTS "url_failure_reports: reporter and admin can read"
  ON public.url_failure_reports;
CREATE POLICY "url_failure_reports: reporter and admin can read"
  ON public.url_failure_reports FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());


-- ── 3. report_url_failures(jsonb) — the only write path ──────────────────────
--
-- p_entries: [ { "url_id": "<uuid>", "fail_count": 1, "reason": "navigation_error" } ]
--
-- One round trip per client batch, one statement, no triggers. The reporter is
-- auth.uid() — never the payload — so a client cannot report on another user's
-- behalf, and a caller that does not establish an identity gets SQLSTATE 28000.

CREATE OR REPLACE FUNCTION public.report_url_failures(p_entries JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_ids        UUID[];
  v_candidates UUID[];
  v_retired    INT  := 0;
  v_today      INT;
  v_logged     INT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_entries IS NULL OR jsonb_typeof(p_entries) <> 'array' THEN
    RAISE EXCEPTION 'p_entries must be a JSON array' USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(p_entries) > 50 THEN
    RAISE EXCEPTION 'batch too large (max 50 entries)' USING ERRCODE = '22023';
  END IF;

  -- Malformed ids are dropped individually rather than aborting the batch — the
  -- same failure mode as log-failed-urls' toISOString() RangeError, which lost
  -- every entry because one was bad.
  SELECT COALESCE(array_agg(DISTINCT e.url_id), '{}'::UUID[])
    INTO v_ids
    FROM (
      SELECT (raw.entry ->> 'url_id')::UUID AS url_id
        FROM jsonb_array_elements(p_entries) AS raw(entry)
       WHERE (raw.entry ->> 'url_id')
             ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ) e
    JOIN public.urls u ON u.id = e.url_id;   -- PK lookups; skips unknown ids

  v_logged := COALESCE(cardinality(v_ids), 0);
  IF v_logged = 0 THEN
    RETURN jsonb_build_object('ok', true, 'logged', 0, 'retired', 0);
  END IF;

  -- Upsert one row per (url, reporter). fail_count is clamped so a single client
  -- cannot inflate itself past the threshold on its own.
  --
  -- Note the shape: every cast sits in a SELECT list or JOIN condition, never
  -- beside a regex in the same WHERE clause (AND has no evaluation order, so a
  -- malformed value could raise before the guard ran — the very failure mode that
  -- made log-failed-urls lose whole batches).
  INSERT INTO public.url_failure_reports (url_id, user_id, fail_count, last_reason)
  SELECT g.url_id,
         v_uid,
         LEAST(SUM(g.fail_count), 50)::INT,   -- clamp the whole batch per URL
         MAX(g.reason)                        -- any non-null reason beats null
    FROM (
      SELECT (raw.entry ->> 'url_id')::UUID AS url_id,
             CASE WHEN jsonb_typeof(raw.entry -> 'fail_count') = 'number'
                  THEN (raw.entry ->> 'fail_count')::NUMERIC::INT
                  ELSE 1
             END                             AS fail_count,
             NULLIF(left(raw.entry ->> 'reason', 200), '') AS reason
        FROM jsonb_array_elements(p_entries) AS raw(entry)
       WHERE (raw.entry ->> 'url_id')
             ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ) g
    JOIN public.urls u ON u.id = g.url_id   -- unknown ids are skipped, not fatal
   GROUP BY g.url_id                        -- ON CONFLICT cannot touch a row twice
  ON CONFLICT (url_id, user_id) DO UPDATE
    SET fail_count  = CASE
                        -- stale row: start the 30-day count over instead of
                        -- carrying ancient failures toward the threshold
                        WHEN url_failure_reports.last_seen < NOW() - INTERVAL '30 days'
                        THEN EXCLUDED.fail_count
                        ELSE LEAST(url_failure_reports.fail_count + EXCLUDED.fail_count, 50)
                      END,
        last_seen   = NOW(),
        last_reason = COALESCE(EXCLUDED.last_reason,
                               url_failure_reports.last_reason);

  -- Which of THIS BATCH's urls now qualify? PK-prefix index scan over the
  -- reporters of those ids only — never a table-wide aggregate.
  SELECT COALESCE(array_agg(q.url_id), '{}'::UUID[])
    INTO v_candidates
    FROM (
      SELECT f.url_id
        FROM public.url_failure_reports f
       WHERE f.url_id = ANY (v_ids)
         AND f.last_seen >= NOW() - INTERVAL '30 days'
       GROUP BY f.url_id
      HAVING COUNT(*) >= 2 AND SUM(f.fail_count) >= 3
    ) q;

  IF cardinality(v_candidates) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'logged', v_logged, 'retired', 0);
  END IF;

  -- Guard 1: a single batch can never retire the pool.
  IF cardinality(v_candidates) > 25 THEN
    RAISE WARNING 'report_url_failures: % candidates in one batch (% logged) exceeds the 25-URL cap; retiring none',
      cardinality(v_candidates), v_logged;
    RETURN jsonb_build_object('ok', true, 'logged', v_logged, 'retired', 0,
                              'tripped', 'batch_cap');
  END IF;

  -- Guard 2: a systemic client bug must not drain the pool. inactive_since covers
  -- every retirement path, not just this one.
  SELECT COUNT(*) INTO v_today
    FROM public.urls
   WHERE inactive_since >= date_trunc('day', NOW());

  IF v_today + cardinality(v_candidates) > 500 THEN
    RAISE WARNING 'report_url_failures: daily retirement cap reached (% retired today, % candidates); retiring none',
      v_today, cardinality(v_candidates);
    RETURN jsonb_build_object('ok', true, 'logged', v_logged, 'retired', 0,
                              'tripped', 'daily_cap');
  END IF;

  UPDATE public.urls
     SET inactive = TRUE                      -- inactive_since set by trigger
   WHERE id = ANY (v_candidates)
     AND NOT inactive;

  GET DIAGNOSTICS v_retired = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'logged', v_logged, 'retired', v_retired);
END;
$$;

REVOKE ALL ON FUNCTION public.report_url_failures(JSONB) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.report_url_failures(JSONB) TO authenticated;


-- ── 4. url_reports: one row per (url, reporter) ──────────────────────────────
-- report-url inserted unconditionally, so a user re-reporting the same link grew
-- the audit table without bound and made fn_auto_retire_on_reports' COUNT() get
-- progressively more expensive. Collapse the existing duplicates, then constrain
-- so a repeat report is a no-op.

DELETE FROM public.url_reports AS a
 USING public.url_reports AS b
 WHERE a.url_id  = b.url_id
   AND a.user_id = b.user_id
   AND a.ctid    > b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS uq_url_reports_url_user
  ON public.url_reports (url_id, user_id);


-- ── 5. pg_cron: purge stale failure tracking ─────────────────────────────────
-- A pair only matters to the 30-day threshold; keep 180 days for forensics and
-- drop the rest. SQL-only, so nothing new to deploy. Same idempotent pattern as
-- the delete-old-seen-urls job.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'delete-old-url-failure-reports'
  ) THEN
    PERFORM cron.schedule(
      'delete-old-url-failure-reports',
      '30 3 * * *',
      'DELETE FROM public.url_failure_reports WHERE last_seen < NOW() - INTERVAL ''180 days'''
    );
  END IF;
END;
$$;

