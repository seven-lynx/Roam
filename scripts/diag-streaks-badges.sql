-- Diagnostic: Streak & Badge Health for Production
-- Run this: node scripts/run-sql.mjs scripts/diag-streaks-badges.sql
-- OR connect to the Supabase SQL editor and run directly.

-- 1. Streak check: how many profiles have non-zero streaks?
SELECT
  COUNT(*) AS total_users,
  COUNT(*) FILTER (WHERE streak_days > 0) AS users_with_active_streak,
  COUNT(*) FILTER (WHERE max_streak > 0) AS users_with_any_streak_history,
  ROUND(AVG(streak_days), 1) AS avg_streak,
  MAX(streak_days) AS max_streak_days,
  MAX(max_streak) AS best_streak_ever
FROM profiles;

-- 2. Top users with streaks
SELECT id, username, streak_days, max_streak, badge_count
FROM profiles
WHERE streak_days > 0
ORDER BY streak_days DESC
LIMIT 10;

-- 3. Badge count drift: profiles.badge_count vs actual unlocked badges
SELECT
  p.id,
  p.username,
  p.badge_count AS profile_badge_count,
  (SELECT COUNT(*) FROM user_badges ub WHERE ub.user_id = p.id AND ub.unlocked_at IS NOT NULL) AS actual_unlocked,
  (SELECT COUNT(*) FROM user_badges ub WHERE ub.user_id = p.id) AS total_rows
FROM profiles p
WHERE p.badge_count != (SELECT COUNT(*) FROM user_badges ub WHERE ub.user_id = p.id AND ub.unlocked_at IS NOT NULL)
LIMIT 10;

-- 4. Streak badges: how many users have them unlocked vs in-progress?
SELECT
  b.slug,
  b.name,
  COUNT(DISTINCT ub.user_id) FILTER (WHERE ub.unlocked_at IS NOT NULL) AS users_unlocked,
  COUNT(DISTINCT ub.user_id) FILTER (WHERE ub.unlocked_at IS NULL) AS users_in_progress,
  COUNT(DISTINCT ub.user_id) AS total_rows
FROM badges b
JOIN user_badges ub ON ub.badge_id = b.id
WHERE b.category = 'streaks'
GROUP BY b.slug, b.name
ORDER BY users_unlocked DESC;

-- 5. Find streak badges with unlocked_at IS NULL (invisible in UI)
SELECT
  p.username,
  b.slug,
  b.name,
  ub.progress_current,
  ub.unlocked_at,
  p.streak_days AS profile_streak_days
FROM user_badges ub
JOIN badges b ON b.id = ub.badge_id
JOIN profiles p ON p.id = ub.user_id
WHERE b.category = 'streaks'
  AND ub.unlocked_at IS NULL
  AND ub.progress_current >= 3  -- qualifies for at least hot-streak-bronze
ORDER BY p.username, b.tier;

-- 6. Check user_daily_activity: any rows at all?
SELECT
  COUNT(*) AS total_daily_rows,
  COUNT(DISTINCT user_id) AS distinct_users,
  MIN(date) AS earliest,
  MAX(date) AS latest
FROM user_daily_activity;

-- 7. Recent roams / daily activity (last 7 days)
SELECT date, COUNT(DISTINCT user_id) AS users, SUM(roam_count) AS total_roams
FROM user_daily_activity
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY date
ORDER BY date DESC;

-- 8. Verify evaluate_badges function signature exists
SELECT proname, pronargs, prosrc IS NOT NULL AS has_body
FROM pg_proc
WHERE proname = 'evaluate_badges';

-- 9. Verify update_streak function exists
SELECT proname, pronargs
FROM pg_proc
WHERE proname = 'update_streak';

-- 10. Verify sync_profile_badge_count exists
SELECT proname, pronargs
FROM pg_proc
WHERE proname = 'sync_profile_badge_count';