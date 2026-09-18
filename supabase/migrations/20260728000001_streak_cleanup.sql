-- Bulk reset stale streaks: finds all users whose last activity was >24 hours ago
-- and whose streak_days is > 0, and resets them to 0. Returns count of affected rows.

CREATE OR REPLACE FUNCTION public.reset_stale_streaks()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INT;
BEGIN
  WITH stale_users AS (
    SELECT p.id
    FROM public.profiles p
    WHERE p.streak_days > 0
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_daily_activity uda
        WHERE uda.user_id = p.id
          AND uda.date >= CURRENT_DATE - INTERVAL '1 day'
      )
  )
  UPDATE public.profiles p
  SET streak_days = 0
  FROM stale_users s
  WHERE p.id = s.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reset_stale_streaks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_stale_streaks() TO service_role;