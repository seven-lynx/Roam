-- ============================================================================
-- Add idempotency support to award_xp to prevent double-awarding XP on retries
-- ============================================================================
-- Edge functions fire award_xp via fire-and-forget .then() chains. If a retry
-- occurs (network blip, timeout, etc.), the same roam/save/collection action
-- could be awarded XP twice. This migration adds a p_idempotency_key parameter
-- to award_xp and stores it in xp_log. When the same key is reused within 1
-- hour, the call is a no-op (returns current XP/level without awarding again).
-- ============================================================================

-- 1. Add idempotency_key column to xp_log (nullable, optional)
ALTER TABLE public.xp_log
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- 2. Index for fast idempotency lookups
CREATE INDEX IF NOT EXISTS idx_xp_log_idempotency
  ON public.xp_log (user_id, idempotency_key, created_at DESC)
  WHERE idempotency_key IS NOT NULL;

-- 3. Rewrite award_xp with idempotency support
-- Based on the latest version from 20260617000000_level_up_notifications.sql
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
  v_xp          INT;
  v_new_xp      BIGINT;
  v_new_lvl     INT;
  v_cur_lvl     INT;
  v_username    TEXT;
  v_profile_url TEXT;
BEGIN
  SELECT xp INTO v_xp FROM public.xp_actions WHERE action = p_action;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown action: %', p_action;
  END IF;

  -- ── Idempotency check ──────────────────────────────────────────────────
  -- If an idempotency key is provided, check if we've already awarded XP for
  -- this key within the last hour. If so, return current XP without awarding
  -- again — the caller gets the same result as if the award succeeded.
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.xp_log
      WHERE user_id = p_user_id
        AND idempotency_key = p_idempotency_key
        AND created_at > now() - INTERVAL '1 hour'
    ) THEN
      -- Already awarded — return current XP/level as a no-op
      SELECT xp_total, public.calculate_level(xp_total)
        INTO v_new_xp, v_new_lvl
        FROM public.profiles WHERE id = p_user_id;
      xp_awarded   := 0;  -- zero means "idempotent — already awarded"
      new_xp_total := v_new_xp;
      new_level    := v_new_lvl;
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  -- ── Normal XP award path ───────────────────────────────────────────────
  INSERT INTO public.xp_log (user_id, action, xp_awarded, metadata, idempotency_key)
  VALUES (p_user_id, p_action, v_xp, p_metadata, p_idempotency_key);

  INSERT INTO public.user_daily_activity (user_id, date, xp_earned)
  VALUES (p_user_id, CURRENT_DATE, v_xp)
  ON CONFLICT (user_id, date)
  DO UPDATE SET xp_earned = user_daily_activity.xp_earned + v_xp;

  -- Capture level before the XP bump
  SELECT level, username INTO v_cur_lvl, v_username
    FROM public.profiles WHERE id = p_user_id;

  UPDATE public.profiles
    SET xp_total = xp_total + v_xp
  WHERE id = p_user_id
  RETURNING xp_total INTO v_new_xp;

  v_new_lvl := public.calculate_level(v_new_xp);

  IF v_new_lvl > v_cur_lvl THEN
    UPDATE public.profiles SET level = v_new_lvl WHERE id = p_user_id;

    v_profile_url := 'https://roamtheweb.app/u/' || v_username;

    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      p_user_id,
      'level_up',
      '🎉 Level Up! You''re now Level ' || v_new_lvl,
      'Keep roaming to earn more badges and XP!',
      jsonb_build_object(
        'level', v_new_lvl,
        'rank', '',
        'url', v_profile_url
      )
    );
  END IF;

  xp_awarded   := v_xp;
  new_xp_total := v_new_xp;
  new_level    := v_new_lvl;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_xp(UUID, TEXT, JSONB, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.award_xp(UUID, TEXT, JSONB, TEXT) TO authenticated, service_role;