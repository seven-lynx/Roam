-- =============================================================================
-- report_engagement(): the only writer of seen_urls.dwell_ms / skipped
-- =============================================================================
-- Why this exists (issue #122 follow-up):
--
-- The `report-engagement` Edge Function used a client-side
-- `.from('seen_urls').update(...)` under the caller's JWT. `seen_urls` has RLS
-- enabled (20260423000000_initial.sql:262) with a SELECT-only policy
-- (20260423000000_initial.sql:347, "Written exclusively by roam() ... no INSERT
-- policy needed"), so that UPDATE matched zero rows and returned no error —
-- PostgREST answers 204 for an UPDATE that touches nothing. dwell_ms/skipped
-- were therefore never persisted from any client, which also means:
--
--   * trg_seen_urls_engagement_pair_scores (AFTER UPDATE OF dwell_ms, skipped)
--     never fired, so interest_pair_scores never learned from engagement; and
--   * roam()'s skip penalty (`skipped = TRUE` in the v37 body) never saw a row.
--
-- The fix is the same shape as mark_url_seen(): a SECURITY DEFINER RPC keyed off
-- auth.uid(), so there is no p_user_id to spoof and no UPDATE policy to add to a
-- table whose writes are deliberately server-only.
--
-- A report is also proof of a serve. Since v38 a prefetched URL carries no
-- seen_urls row until a client calls mark_url_seen() on render, and clients that
-- predate it never call it at all — a bare UPDATE would match 0 rows there too.
-- The upsert below creates the row when it is missing.
--
-- Semantics: one statement, upsert on (user_id, url_id). On conflict only
-- dwell_ms/skipped move; seen_at and the domain cooldown belong to
-- mark_url_seen(), so reporting engagement never re-orders the 3,000-row
-- exclusion window or extends a 24 h cooldown as a side effect.
--
-- Rollback: see RUNBOOK.md § 20261109070000_report_engagement_rpc.sql.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.report_engagement(
  p_url_id   UUID,
  p_dwell_ms INTEGER,
  p_skipped  BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  -- The caller is always the authenticated user: there is no p_user_id to spoof.
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- The Edge Function validates these before calling; the guards protect a direct
  -- RPC caller from writing a row that the skip penalty would misread.
  IF p_dwell_ms IS NULL OR p_dwell_ms < 0 THEN
    RAISE EXCEPTION 'dwell_ms must be a non-negative number';
  END IF;

  IF p_skipped IS NULL THEN
    RAISE EXCEPTION 'skipped is required';
  END IF;

  INSERT INTO seen_urls (user_id, url_id, dwell_ms, skipped)
  VALUES (v_user_id, p_url_id, p_dwell_ms, p_skipped)
  ON CONFLICT (user_id, url_id) DO UPDATE
    SET dwell_ms = p_dwell_ms,
        skipped  = p_skipped;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.report_engagement(UUID, INTEGER, BOOLEAN) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.report_engagement(UUID, INTEGER, BOOLEAN) TO authenticated;
