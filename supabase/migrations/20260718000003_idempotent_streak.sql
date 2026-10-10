-- Idempotent streak update: only recalculate on first activity of the day.
-- Subsequent calls just increment the daily counter, avoiding redundant work.

CREATE OR REPLACE FUNCTION public.update_streak(p_user_id UUID)
RETURNS TABLE(streak_days INT, max_streak INT, is_streak_broken BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cur INT;
  v_max INT;
  v_broken BOOLEAN := FALSE;
  v_existing BOOLEAN;
BEGIN
  -- Check if today's row already exists (first-activity-of-day gate)
  SELECT TRUE INTO v_existing
  FROM public.user_daily_activity
  WHERE user_id = p_user_id AND date = CURRENT_DATE;

  IF v_existing THEN
    -- Not the first activity today — just bump the counter, return current streak
    UPDATE public.user_daily_activity
    SET roam_count = roam_count + 1
    WHERE user_id = p_user_id AND date = CURRENT_DATE;

    SELECT COALESCE(s.streak_days, 0), COALESCE(s.max_streak, 0)
    INTO v_cur, v_max
    FROM public.profiles s
    WHERE s.id = p_user_id;

    streak_days := v_cur;
    max_streak := v_max;
    is_streak_broken := FALSE;
    RETURN NEXT;
    RETURN;
  END IF;

  -- First activity of the day: full streak logic
  INSERT INTO public.user_daily_activity (user_id, date, roam_count)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, date) DO UPDATE
    SET roam_count = user_daily_activity.roam_count + 1;

  -- Get current streak values
  SELECT COALESCE(s.streak_days, 0), COALESCE(s.max_streak, 0)
  INTO v_cur, v_max
  FROM public.profiles s
  WHERE s.id = p_user_id;

  -- Find most recent activity day before today
  PERFORM 1 FROM public.user_daily_activity
  WHERE user_id = p_user_id AND date = CURRENT_DATE - INTERVAL '1 day';

  IF NOT FOUND THEN
    -- No activity yesterday: streak broken or first-ever
    IF v_cur > 1 THEN v_broken := TRUE; END IF;
    v_cur := 1;
  ELSE
    -- Had activity yesterday: increment streak
    v_cur := v_cur + 1;
  END IF;

  IF v_cur > v_max THEN v_max := v_cur; END IF;

  UPDATE public.profiles
  SET streak_days = v_cur, max_streak = v_max
  WHERE id = p_user_id;

  streak_days := v_cur;
  max_streak := v_max;
  is_streak_broken := v_broken;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_streak(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_streak(UUID) TO authenticated, service_role;


-- Also make record_daily_activity idempotent (for save/follow/submit actions)
CREATE OR REPLACE FUNCTION public.record_daily_activity(p_user_id UUID)
RETURNS TABLE(streak_days INT, max_streak INT, is_streak_broken BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_already_active BOOLEAN;
  v_cur INT;
  v_max INT;
BEGIN
  -- Check if the user already has activity today
  SELECT TRUE INTO v_already_active
  FROM public.user_daily_activity
  WHERE user_id = p_user_id AND date = CURRENT_DATE;

  IF v_already_active THEN
    -- Already active today — just return current streak, no recalculation
    SELECT COALESCE(s.streak_days, 0), COALESCE(s.max_streak, 0)
    INTO v_cur, v_max
    FROM public.profiles s
    WHERE s.id = p_user_id;

    streak_days := v_cur;
    max_streak := v_max;
    is_streak_broken := FALSE;
    RETURN NEXT;
    RETURN;
  END IF;

  -- First activity of the day: ensure the row exists and run streak update
  INSERT INTO public.user_daily_activity (user_id, date, xp_earned)
  VALUES (p_user_id, CURRENT_DATE, 0)
  ON CONFLICT (user_id, date) DO NOTHING;

  RETURN QUERY SELECT * FROM public.update_streak(p_user_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_daily_activity(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_daily_activity(UUID) TO authenticated, service_role;