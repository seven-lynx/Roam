-- =============================================================================
-- Roam - prune expired domain cooldowns (issue #129)
-- =============================================================================
-- `mark_url_seen()` only ever upserts a cooldown, so `user_domain_cooldowns`
-- keeps every (user, domain) pair that user has ever been served and nothing
-- removes a row once `cooldown_until` has passed. The table is scanned on every
-- roam() call to exclude the domains that are still cooling, so the accumulated
-- expired rows sit on the hot path for no benefit.
--
-- Two changes:
--   1. `mark_url_seen()` deletes up to 50 of the caller's expired rows per call.
--      Bounded on purpose: a serve must not pay for a large write, and a
--      returning user accumulates expired rows far slower than one per serve.
--   2. `(user_id, cooldown_until)` gets an index of its own. `(user_id, domain)`
--      is unique but cannot serve a range on its second column, which is what
--      both the delete above and the "when does the first domain come back"
--      read in roam() need.
--
-- Rollback: DROP INDEX public.idx_user_domain_cooldowns_expiry; and restore the
-- previous mark_url_seen() body from 20261109060000.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_user_domain_cooldowns_expiry
  ON public.user_domain_cooldowns (user_id, cooldown_until);

CREATE OR REPLACE FUNCTION public.mark_url_seen(
  p_url_id      UUID,
  p_cool_domain BOOLEAN DEFAULT TRUE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        UUID := auth.uid();
  v_discovery_mode TEXT;
  v_domain         TEXT;
BEGIN
  -- The caller is always the authenticated user: there is no p_user_id to spoof.
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Housekeeping before the serve is recorded: expired cooldowns no longer
  -- exclude anything, and this is the one write path that is certain to run for
  -- a user who is actually roaming (issue #129). `ctid` keeps the delete
  -- self-contained; LIMIT keeps it bounded.
  DELETE FROM user_domain_cooldowns
  WHERE  ctid IN (
    SELECT ctid
    FROM   user_domain_cooldowns
    WHERE  user_id = v_user_id
      AND  cooldown_until < NOW()
    LIMIT  50
  );

  -- Same upsert roam() performed inline before v38: a re-seen URL moves to the
  -- top of the 3,000-row exclusion window and its engagement fields reset.
  INSERT INTO seen_urls (user_id, url_id)
  VALUES (v_user_id, p_url_id)
  ON CONFLICT (user_id, url_id) DO UPDATE
    SET seen_at = NOW(), dwell_ms = NULL, skipped = NULL;

  IF NOT COALESCE(p_cool_domain, TRUE) THEN
    RETURN;
  END IF;

  SELECT COALESCE(s.discovery_mode, 'discovery')
  INTO   v_discovery_mode
  FROM   user_settings s
  WHERE  s.user_id = v_user_id;

  IF COALESCE(v_discovery_mode, 'discovery') <> 'discovery' THEN
    RETURN;
  END IF;

  SELECT u.domain INTO v_domain FROM urls u WHERE u.id = p_url_id;
  IF v_domain IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO user_domain_cooldowns (user_id, domain, cooldown_until)
  VALUES (v_user_id, v_domain, NOW() + INTERVAL '24 hours')
  ON CONFLICT (user_id, domain) DO UPDATE
    SET cooldown_until = NOW() + INTERVAL '24 hours';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_url_seen(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.mark_url_seen(UUID, BOOLEAN) TO authenticated;

