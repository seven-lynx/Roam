-- Replace edge function leaderboard with a PostgreSQL RPC function
-- Called directly from client via supabase.rpc('get_leaderboard', { p_period: 'all_time' })
-- SECURITY DEFINER bypasses RLS so we can aggregate across all users
-- Much faster than edge function — completes in milliseconds via indexed queries

CREATE OR REPLACE FUNCTION public.get_leaderboard(p_period TEXT DEFAULT 'all_time')
RETURNS TABLE(
  rank BIGINT,
  user_id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  xp_total BIGINT,
  level INT,
  badge_count BIGINT,
  streak_days INT,
  xp_earned BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_since TIMESTAMPTZ;
BEGIN
  -- Determine the time window
  IF p_period = 'weekly' THEN
    v_since := now() - INTERVAL '7 days';
  ELSIF p_period = 'monthly' THEN
    v_since := now() - INTERVAL '30 days';
  ELSE
    v_since := '1970-01-01'::TIMESTAMPTZ; -- all_time
  END IF;

  RETURN QUERY
  WITH xp_aggregated AS (
    SELECT
      xl.user_id,
      SUM(xl.xp_awarded)::BIGINT AS xp_earned
    FROM public.xp_log xl
    WHERE xl.created_at >= v_since
    GROUP BY xl.user_id
  ),
  badge_counts AS (
    SELECT
      ub.user_id,
      COUNT(*)::BIGINT AS badge_count
    FROM public.user_badges ub
    WHERE ub.unlocked_at IS NOT NULL
    GROUP BY ub.user_id
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY COALESCE(xa.xp_earned, 0) DESC, p.xp_total DESC) AS rank,
    p.id AS user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    COALESCE(p.xp_total, 0) AS xp_total,
    COALESCE(p.level, 1) AS level,
    COALESCE(bc.badge_count, 0) AS badge_count,
    COALESCE(p.streak_days, 0) AS streak_days,
    COALESCE(xa.xp_earned, 0) AS xp_earned
  FROM xp_aggregated xa
  JOIN public.profiles p ON p.id = xa.user_id
  LEFT JOIN badge_counts bc ON bc.user_id = xa.user_id
  ORDER BY xp_earned DESC, xp_total DESC
  LIMIT 50;
END;
$$;

-- Grant execute to authenticated role (anon can also call since it's SECURITY DEFINER)
REVOKE EXECUTE ON FUNCTION public.get_leaderboard FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard TO authenticated, anon;

-- Add index to speed up the period-filtered XP query
CREATE INDEX IF NOT EXISTS xp_log_created_at_idx ON public.xp_log (created_at) WHERE created_at IS NOT NULL;