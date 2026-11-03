-- ============================================================================
-- award_game_xp: variable-XP awards for the in-OS games (RELAY / COMPILER /
-- DEBRIS). Unlike award_xp, which looks a *fixed* value up in xp_actions, this
-- takes an explicit p_xp so a game can award 10 XP per cleared level and a
-- score-derived bonus at game over. Shares award_xp's idempotency, daily-activity
-- and level-up-notification plumbing.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.award_game_xp(
  p_user_id           UUID,
  p_action            TEXT,
  p_xp                INT,
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
  -- Clamp the award: a game can never mint negative XP, and a single call is
  -- capped so a runaway score can't mint unbounded XP in one shot.
  v_xp := GREATEST(1, LEAST(p_xp, 1000));

  -- ── Idempotency check (same 1-hour window as award_xp) ──────────────────
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.xp_log
      WHERE user_id = p_user_id
        AND idempotency_key = p_idempotency_key
        AND created_at > now() - INTERVAL '1 hour'
    ) THEN
      SELECT xp_total, public.calculate_level(xp_total)
        INTO v_new_xp, v_new_lvl
        FROM public.profiles WHERE id = p_user_id;
      xp_awarded   := 0;
      new_xp_total := v_new_xp;
      new_level    := v_new_lvl;
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

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

REVOKE EXECUTE ON FUNCTION public.award_game_xp(UUID, TEXT, INT, JSONB, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.award_game_xp(UUID, TEXT, INT, JSONB, TEXT) TO authenticated, service_role;
