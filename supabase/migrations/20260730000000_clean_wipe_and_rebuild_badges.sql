-- =============================================================================
-- CLEAN WIPE & REBUILD: Badge + XP + Streak Repair
-- =============================================================================
-- Migration 20260713000000 Fix 3 (lines 94-108) incorrectly marked all
-- user_badges rows with progress_current = 0 as "unlocked" by setting
-- unlocked_at = now(). This affected:
--   - All milestone badges (level-10 through grandmaster)
--   - All binary badges (night-owl, early-bird, etc.) with required_count IS NULL
--   - Tier-chained badges where the user hadn't earned prerequisites yet
--
-- This migration does a clean wipe of all non-gift badge data and prepares
-- for a full rebuild via evaluate_badges() for every user.
-- =============================================================================

-- Step 1: Backup gift badge assignments (hand-granted by admins, always legitimate)
CREATE TEMP TABLE gift_badge_backup AS
SELECT ub.*
FROM public.user_badges ub
JOIN public.badges b ON b.id = ub.badge_id
WHERE b.is_gift_only = TRUE;

-- Step 2: Wipe ALL user_badges rows
DELETE FROM public.user_badges;

-- Step 3: Restore gift badge assignments
INSERT INTO public.user_badges (user_id, badge_id, unlocked_at, progress_current, granted_by)
SELECT user_id, badge_id, unlocked_at, progress_current, granted_by
FROM gift_badge_backup;

-- Step 4: Delete non-gift badge_rewards XP log entries
-- (gift XP uses action='badge_gifted' from grant_badge(), preserved)
DELETE FROM public.xp_log WHERE action = 'badge_rewards';

-- Step 5: Recalculate xp_total from remaining xp_log entries
WITH recalc AS (
  SELECT
    p.id,
    COALESCE(SUM(xl.xp_awarded), 0) AS new_xp
  FROM public.profiles p
  LEFT JOIN public.xp_log xl ON xl.user_id = p.id
  GROUP BY p.id
)
UPDATE public.profiles p
SET xp_total = recalc.new_xp
FROM recalc
WHERE p.id = recalc.id
  AND p.xp_total IS DISTINCT FROM recalc.new_xp;

-- Step 6: Recalculate level from new xp_total
UPDATE public.profiles
SET level = public.calculate_level(xp_total)
WHERE level IS DISTINCT FROM public.calculate_level(xp_total);

-- Step 7: Recalculate badge_count from remaining unlocked badges (gift only at this point)
WITH badge_counts AS (
  SELECT
    ub.user_id,
    COUNT(*)::INT AS actual_count
  FROM public.user_badges ub
  WHERE ub.unlocked_at IS NOT NULL
  GROUP BY ub.user_id
)
UPDATE public.profiles p
SET badge_count = COALESCE(bc.actual_count, 0)
FROM badge_counts bc
WHERE p.id = bc.user_id;

-- Users with no badges at all get badge_count = 0
UPDATE public.profiles
SET badge_count = 0
WHERE badge_count != 0
  AND NOT EXISTS (
    SELECT 1 FROM public.user_badges ub
    WHERE ub.user_id = profiles.id AND ub.unlocked_at IS NOT NULL
  );

-- Step 8: Reset stale streaks (users whose last activity was >24h ago)
SELECT public.reset_stale_streaks() AS stale_streaks_reset;

-- Clean up temp table
DROP TABLE IF EXISTS gift_badge_backup;

-- =============================================================================
-- NOTE: After applying this migration, run the rebuild script:
--   node scripts/rebuild-badges.mjs
--
-- This calls evaluate_badges() for every user, which:
--   1. Awards only badges the user legitimately qualifies for
--   2. Creates progress rows for in-progress badges (unlocked_at = NULL)
--   3. Awards correct XP via xp_log for each new badge
--   4. Syncs profile badge counts
-- =============================================================================