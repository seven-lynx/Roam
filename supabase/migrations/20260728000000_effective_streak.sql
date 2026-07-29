-- Read-time streak validation: returns the effective streak for a user,
-- resetting to 0 if their last activity was more than 24 hours ago.
-- Also updates the stored profile so the correction persists.

CREATE OR REPLACE FUNCTION public.get_effective_streak(p_user_id UUID)
RETURNS TABLE(streak_days INT, max_streak INT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_last_date DATE;
  v_streak INT;
  v_max INT;
BEGIN
  -- Get latest activity date for this user
  SELECT MAX(uda.date) INTO v_last_date
  FROM public.user_daily_activity uda
  WHERE uda.user_id = p_user_id;

  -- Get stored streak values from profiles
  SELECT COALESCE(p.streak_days, 0), COALESCE(p.max_streak, 0)
  INTO v_streak, v_max
  FROM public.profiles p
  WHERE p.id = p_user_id;

  -- No activity ever recorded -> streak is 0
  IF v_last_date IS NULL THEN
    IF v_streak != 0 THEN
      UPDATE public.profiles SET streak_days = 0 WHERE id = p_user_id;
    END IF;
    streak_days := 0;
    max_streak := v_max;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Last activity was yesterday or today -> streak is valid (stored value)
  IF v_last_date >= CURRENT_DATE - INTERVAL '1 day' THEN
    streak_days := v_streak;
    max_streak := v_max;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Last activity was more than 24 hours ago -> streak is broken
  -- Correct the stored value so it doesn't stay stale
  IF v_streak != 0 THEN
    UPDATE public.profiles SET streak_days = 0 WHERE id = p_user_id;
  END IF;

  streak_days := 0;
  max_streak := v_max;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_effective_streak(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_effective_streak(UUID) TO authenticated, service_role;