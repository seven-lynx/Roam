-- =============================================================================
-- Fix award_xp(): its RETURN QUERY collided with its own RETURNS TABLE columns.
-- =============================================================================
-- award_xp() declares OUT columns (new_xp_total, new_level, xp_awarded) and then
-- runs `RETURN QUERY SELECT * FROM public.apply_xp(...)`, whose result carries the
-- same three names — apply_xp returns the identical TABLE shape. PL/pgSQL resolves
-- those names in one namespace, so every call raised
--
--   42702  column reference "xp_awarded" is ambiguous
--
-- before awarding anything. The caller (game-action) logs that as a warning, so
-- clients received a success response while their XP total never moved.
--
-- Aliasing the function and qualifying each column removes the ambiguity. apply_xp
-- itself is correct and untouched, and the output column names are unchanged
-- because callers decode the returned row by name.
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

  RETURN QUERY
    SELECT ax.new_xp_total, ax.new_level, ax.xp_awarded
    FROM public.apply_xp(p_user_id, p_action, v_xp, p_metadata, p_idempotency_key) AS ax;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_xp(UUID, TEXT, JSONB, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.award_xp(UUID, TEXT, JSONB, TEXT) TO authenticated, service_role;
