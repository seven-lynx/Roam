-- Fix streak bypass: record_daily_activity was pre-inserting a row into
-- user_daily_activity before calling update_streak. update_streak's
-- first-activity-of-day gate would then see the existing row and skip
-- all streak calculation — including gap detection, reset, and increment.
--
-- This caused:
--  - Inflated streaks: stale streak_days persisted past gaps
--  - Inflated roam_count: non-roam actions bumped roam_count incorrectly
--
-- Fix: Add p_is_roam parameter to update_streak. record_daily_activity
-- no longer pre-inserts — it delegates entirely to update_streak with
-- p_is_roam := FALSE.

-- Fix 1: update_streak with p_is_roam control
CREATE OR REPLACE FUNCTION public.update_streak(p_user_id UUID, p_is_roam BOOLEAN DEFAULT TRUE)
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
    -- Not the first activity today.
    -- Only bump roam_count if this is actually a roam action.
    IF p_is_roam THEN
      UPDATE public.user_daily_activity
      SET roam_count = roam_count + 1
      WHERE user_id = p_user_id AND date = CURRENT_DATE;
    END IF;

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
  VALUES (p_user_id, CURRENT_DATE, CASE WHEN p_is_roam THEN 1 ELSE 0 END)
  ON CONFLICT (user_id, date) DO UPDATE
    SET roam_count = user_daily_activity.roam_count + CASE WHEN p_is_roam THEN 1 ELSE 0 END;

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

REVOKE EXECUTE ON FUNCTION public.update_streak(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_streak(UUID, BOOLEAN) TO authenticated, service_role;

-- Fix 2: record_daily_activity no longer pre-inserts a row.
-- Instead, it delegates entirely to update_streak with p_is_roam := FALSE,
-- which handles row creation AND streak calculation atomically.
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

  -- First activity of the day: run full streak update, but don't count as roam
  RETURN QUERY SELECT * FROM public.update_streak(p_user_id, p_is_roam := FALSE);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_daily_activity(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_daily_activity(UUID) TO authenticated, service_role;