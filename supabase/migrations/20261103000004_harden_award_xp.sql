-- =============================================================================
-- Harden award_xp(): an authenticated caller may only award XP to themselves.
-- =============================================================================
-- award_xp() is SECURITY DEFINER and exposed to `authenticated`, so without a
-- guard a client could award fixed XP to any user (inflating anyone's XP or
-- griefing). This adds an auth.uid() = p_user_id check. The service role
-- (auth.uid() IS NULL) still awards to any user — used by the follow edge
-- function's gain_follower award.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.award_xp(
  p_user_id           UUID,
  p_action            TEXT,
  p_metadata          JSONB DEFAULT '{}'::jsonb,
  p_idempotency_key   TEXT DEFAULT NULL
)
RETURNS TABLE(new_xp_total BIGINT, new_level INT, xp_awarded INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '3s'
AS $$
DECLARE
  v_xp INT;
BEGIN
  -- Only self-awards for authenticated callers; service role bypasses.
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Cannot award XP to another user';
  END IF;

  SELECT xp INTO v_xp FROM public.xp_actions WHERE action = p_action;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown action: %', p_action;
  END IF;
  RETURN QUERY SELECT * FROM public.apply_xp(p_user_id, p_action, v_xp, p_metadata, p_idempotency_key);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_xp(UUID, TEXT, JSONB, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.award_xp(UUID, TEXT, JSONB, TEXT) TO authenticated, service_role;
