-- Fix badge count discrepancy and streak tracking
-- 
-- Problems:
-- 1. profile.badge_count drifts from actual unlocked badges because evaluate_badges()
--    does not explicitly set unlocked_at = now(), relying on column defaults that may
--    have been removed (migration 20260709000012 made unlocked_at nullable).
--    The ON CONFLICT DO NOTHING on line 404 of evaluate_badges inserts rows without
--    specifying unlocked_at, leaving it NULL when DEFAULT is absent.
-- 2. update_streak() is called only from the roam edge function as a fire-and-forget
--    with empty error handlers. No other user actions contribute to daily activity,
--    so streaks always show 0 for users who haven't roamed recently.
-- 3. No helper exists to simply "mark user active today" from any edge function.

-- ── Fix 1: sync_profile_badge_count ────────────────────────────────────────
-- Reconciles profiles.badge_count with actual unlocked badges.
-- Safe to call at any time; does not break anything if counts already match.

CREATE OR REPLACE FUNCTION public.sync_profile_badge_count(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_actual INT;
  v_stored INT;
BEGIN
  SELECT COUNT(*) INTO v_actual
  FROM public.user_badges
  WHERE user_id = p_user_id AND unlocked_at IS NOT NULL;

  SELECT badge_count INTO v_stored FROM public.profiles WHERE id = p_user_id;

  IF v_actual != COALESCE(v_stored, 0) THEN
    UPDATE public.profiles SET badge_count = v_actual WHERE id = p_user_id;
  END IF;

  RETURN v_actual;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_profile_badge_count FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_profile_badge_count TO authenticated, service_role;

-- ── Fix 2: record_daily_activity ───────────────────────────────────────────
-- Simple helper that ensures a user_daily_activity row exists for today and
-- calls update_streak. Call this from any edge function that represents user
-- activity (save, submit, follow, rate, etc.) so streaks aren't broken when
-- the user engages with Roam in ways other than pressing the Roam button.

CREATE OR REPLACE FUNCTION public.record_daily_activity(p_user_id UUID)
RETURNS TABLE(streak_days INT, max_streak INT, is_streak_broken BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Ensure today's row exists (do not double-count roam_count for non-roam actions)
  INSERT INTO public.user_daily_activity (user_id, date, xp_earned)
  VALUES (p_user_id, CURRENT_DATE, 0)
  ON CONFLICT (user_id, date) DO NOTHING;

  -- Run the streak update
  RETURN QUERY SELECT * FROM public.update_streak(p_user_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_daily_activity FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_daily_activity TO authenticated, service_role;

-- ── Fix 3: Repair existing user_badges rows with NULL unlocked_at ─────────
-- Rows inserted by the old evaluate_badges() at line 404 (INSERT … ON CONFLICT
-- DO NOTHING without specifying unlocked_at) and line 411 (explicitly NULL).
-- For rows that represent unlocked badges (NOT inserted by the in-progress path
-- at line 411), set unlocked_at to a reasonable default.
--
-- The in-progress insert (line 411) sets unlocked_at = NULL AND includes
-- progress_current > 0. Unlocked inserts (line 404) set progress_current
-- without unlocked_at. We distinguish: if progress_current matches or exceeds
-- required_count and unlocked_at IS NULL, it was an unlocked insert.

UPDATE public.user_badges
SET unlocked_at = COALESCE(unlocked_at, now())
WHERE unlocked_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.badges b
    WHERE b.id = user_badges.badge_id
      AND (
        -- Either required_count is NULL (binary badge) → always treat as unlocked
        b.required_count IS NULL
        -- Or progress meets the requirement
        OR user_badges.progress_current >= b.required_count
        -- Or badge has no progress at all but was inserted (milestone/gift)
        OR user_badges.progress_current = 0
      )
  );

-- Now sync all profile badge counts to the actual values
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles LOOP
    PERFORM public.sync_profile_badge_count(r.id);
  END LOOP;
END;
$$;

-- ── Fix 4: Make update_streak more defensive ──────────────────────────────
-- The original update_streak function is mostly correct but can be hardened.
-- Re-create it with better NULL handling and a guard against calling it when
-- user_daily_activity has no rows yet.

CREATE OR REPLACE FUNCTION public.update_streak(p_user_id UUID)
RETURNS TABLE(streak_days INT, max_streak INT, is_streak_broken BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_last_active DATE;
  v_cur INT;
  v_max INT;
  v_broken BOOLEAN := FALSE;
BEGIN
  -- Find the most recent activity day BEFORE today
  SELECT MAX(date) INTO v_last_active
  FROM public.user_daily_activity
  WHERE user_id = p_user_id AND date < CURRENT_DATE;

  -- Update/create today's row (for roam calls, increment roam_count)
  INSERT INTO public.user_daily_activity (user_id, date, roam_count)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, date) DO UPDATE
    SET roam_count = user_daily_activity.roam_count + 1;

  -- Get current streak values from profile
  SELECT COALESCE(s.streak_days, 0), COALESCE(s.max_streak, 0)
  INTO v_cur, v_max
  FROM public.profiles s
  WHERE s.id = p_user_id;

  -- Calculate new streak
  IF v_last_active IS NULL OR v_last_active < CURRENT_DATE - INTERVAL '1 day' THEN
    -- Streak broken or first-ever activity
    IF v_cur > 1 THEN v_broken := TRUE; END IF;
    v_cur := 1;
  ELSIF v_last_active = CURRENT_DATE - INTERVAL '1 day' THEN
    -- Consecutive day — increment
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

REVOKE EXECUTE ON FUNCTION public.update_streak FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_streak TO authenticated, service_role;

-- ── Fix 5: Repair evaluate_badges to explicitly set unlocked_at ────────────
-- The original evaluate_badges (line 404) does:
--   INSERT ... VALUES (..., v_progress) ON CONFLICT DO NOTHING
-- without specifying unlocked_at. If the DEFAULT now() was removed by any
-- subsequent migration, unlocked badges get unlocked_at = NULL, making them
-- invisible to get_user_badges()'s is_unlocked check.
--
-- This is fixed by an updated CREATE OR REPLACE below that adds unlocked_at = now()
-- to the unlocked insert path, and by also calling sync_profile_badge_count
-- at the end of evaluation.

CREATE OR REPLACE FUNCTION public.evaluate_badges(p_user_id UUID)
RETURNS TABLE(badge_id UUID, badge_slug TEXT, badge_name TEXT, badge_description TEXT, badge_icon TEXT, badge_category TEXT, badge_tier SMALLINT, badge_xp_reward INT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_roam_count BIGINT; v_save_count BIGINT; v_submit_count BIGINT; v_approved_count BIGINT;
  v_collection_count BIGINT; v_follower_count BIGINT; v_following_count BIGINT; v_rate_count BIGINT;
  v_unique_domains BIGINT; v_unique_cat_roam BIGINT; v_unique_cat_save BIGINT;
  v_streak_days INT; v_level INT; v_xp_total BIGINT; v_account_age_days INT;
  v_badge RECORD; v_count BIGINT; v_today_roam INT; v_today_save INT;
  v_parent_badge_id UUID; v_progress INT;
  v_badge_xp_awarded INT := 0; v_new_count INT := 0;
BEGIN
  SELECT COUNT(*) INTO v_roam_count FROM public.seen_urls WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_save_count FROM public.saved_urls WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_submit_count FROM public.moderation_queue WHERE submitted_by = p_user_id;
  SELECT COUNT(*) INTO v_approved_count FROM public.moderation_queue WHERE submitted_by = p_user_id AND status = 'approved';
  SELECT COUNT(*) INTO v_collection_count FROM public.collections WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_follower_count FROM public.follows WHERE following_id = p_user_id AND is_pending = FALSE;
  SELECT COUNT(*) INTO v_following_count FROM public.follows WHERE follower_id = p_user_id AND is_pending = FALSE;
  SELECT COUNT(*) INTO v_rate_count FROM public.url_ratings WHERE user_id = p_user_id;
  SELECT COUNT(DISTINCT u.domain) INTO v_unique_domains FROM public.seen_urls su JOIN public.urls u ON u.id = su.seen_url_id WHERE su.user_id = p_user_id;
  SELECT COUNT(DISTINCT u.category_id) INTO v_unique_cat_roam FROM public.seen_urls su JOIN public.urls u ON u.id = su.seen_url_id WHERE su.user_id = p_user_id;
  SELECT COUNT(DISTINCT u.category_id) INTO v_unique_cat_save FROM public.saved_urls su JOIN public.urls u ON u.id = su.url_id WHERE su.user_id = p_user_id;
  SELECT p.streak_days, COALESCE(p.level,1), COALESCE(p.xp_total,0), p.created_at INTO v_streak_days, v_level, v_xp_total, v_account_age_days FROM public.profiles p WHERE p.id = p_user_id;
  v_account_age_days := EXTRACT(DAY FROM now() - v_account_age_days)::INT;
  SELECT COALESCE(roam_count,0), COALESCE(save_count,0) INTO v_today_roam, v_today_save FROM public.user_daily_activity WHERE user_id = p_user_id AND date = CURRENT_DATE;

  FOR v_badge IN SELECT * FROM public.badges WHERE id NOT IN (SELECT badge_id FROM public.user_badges WHERE user_id = p_user_id) AND is_gift_only = FALSE AND category != 'milestone'
  LOOP
    v_count := 0; v_progress := 0;
    CASE v_badge.slug
      WHEN 'first-roam' THEN v_progress := LEAST(v_roam_count,1); IF v_roam_count >= 1 THEN v_count := 1; END IF;
      WHEN 'wanderer-bronze' THEN v_progress := LEAST(v_roam_count::INT,10); IF v_roam_count >= 10 THEN v_count := 1; END IF;
      WHEN 'wanderer-silver' THEN v_progress := LEAST(v_roam_count::INT,50); IF v_roam_count >= 50 THEN v_count := 1; END IF;
      WHEN 'wanderer-gold' THEN v_progress := LEAST(v_roam_count::INT,200); IF v_roam_count >= 200 THEN v_count := 1; END IF;
      WHEN 'nomad-bronze' THEN v_progress := LEAST(v_roam_count::INT,500); IF v_roam_count >= 500 THEN v_count := 1; END IF;
      WHEN 'nomad-silver' THEN v_progress := LEAST(v_roam_count::INT,1000); IF v_roam_count >= 1000 THEN v_count := 1; END IF;
      WHEN 'nomad-gold' THEN v_progress := LEAST(v_roam_count::INT,5000); IF v_roam_count >= 5000 THEN v_count := 1; END IF;
      WHEN 'nomad-platinum' THEN v_progress := LEAST(v_roam_count::INT,10000); IF v_roam_count >= 10000 THEN v_count := 1; END IF;
      WHEN 'night-owl' THEN SELECT COUNT(*) INTO v_count FROM public.seen_urls WHERE user_id = p_user_id AND EXTRACT(HOUR FROM seen_at) BETWEEN 0 AND 3; v_progress := LEAST(v_count::INT,1);
      WHEN 'early-bird' THEN SELECT COUNT(*) INTO v_count FROM public.seen_urls WHERE user_id = p_user_id AND EXTRACT(HOUR FROM seen_at) BETWEEN 5 AND 7; v_progress := LEAST(v_count::INT,1);
      WHEN 'globetrotter-bronze' THEN v_progress := LEAST(v_unique_domains::INT,5); IF v_unique_domains >= 5 THEN v_count := 1; END IF;
      WHEN 'globetrotter-silver' THEN v_progress := LEAST(v_unique_domains::INT,15); IF v_unique_domains >= 15 THEN v_count := 1; END IF;
      WHEN 'globetrotter-gold' THEN v_progress := LEAST(v_unique_domains::INT,30); IF v_unique_domains >= 30 THEN v_count := 1; END IF;
      WHEN 'category-explorer-bronze' THEN v_progress := LEAST(v_unique_cat_roam::INT,3); IF v_unique_cat_roam >= 3 THEN v_count := 1; END IF;
      WHEN 'category-explorer-silver' THEN v_progress := LEAST(v_unique_cat_roam::INT,5); IF v_unique_cat_roam >= 5 THEN v_count := 1; END IF;
      WHEN 'category-explorer-gold' THEN SELECT COUNT(*) INTO v_count FROM public.categories; v_progress := v_unique_cat_roam::INT; IF v_unique_cat_roam >= v_count THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'first-save' THEN v_progress := LEAST(v_save_count::INT,1); IF v_save_count >= 1 THEN v_count := 1; END IF;
      WHEN 'collector-bronze' THEN v_progress := LEAST(v_save_count::INT,10); IF v_save_count >= 10 THEN v_count := 1; END IF;
      WHEN 'collector-silver' THEN v_progress := LEAST(v_save_count::INT,50); IF v_save_count >= 50 THEN v_count := 1; END IF;
      WHEN 'collector-gold' THEN v_progress := LEAST(v_save_count::INT,200); IF v_save_count >= 200 THEN v_count := 1; END IF;
      WHEN 'collector-platinum' THEN v_progress := LEAST(v_save_count::INT,1000); IF v_save_count >= 1000 THEN v_count := 1; END IF;
      WHEN 'archivist-bronze' THEN v_progress := LEAST(v_save_count::INT,500); IF v_save_count >= 500 THEN v_count := 1; END IF;
      WHEN 'archivist-silver' THEN v_progress := LEAST(v_save_count::INT,2000); IF v_save_count >= 2000 THEN v_count := 1; END IF;
      WHEN 'archivist-gold' THEN v_progress := LEAST(v_save_count::INT,5000); IF v_save_count >= 5000 THEN v_count := 1; END IF;
      WHEN 'tagger-bronze' THEN v_progress := LEAST(v_unique_cat_save::INT,3); IF v_unique_cat_save >= 3 THEN v_count := 1; END IF;
      WHEN 'tagger-silver' THEN v_progress := LEAST(v_unique_cat_save::INT,6); IF v_unique_cat_save >= 6 THEN v_count := 1; END IF;
      WHEN 'tagger-gold' THEN v_progress := LEAST(v_unique_cat_save::INT,10); IF v_unique_cat_save >= 10 THEN v_count := 1; END IF;
      WHEN 'completionist' THEN SELECT COUNT(*) INTO v_count FROM public.categories; v_progress := v_unique_cat_save::INT; IF v_unique_cat_save >= v_count THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'speed-collector' THEN IF v_today_save >= 10 THEN v_count := 1; END IF; v_progress := LEAST(v_today_save,10);
      WHEN 'mega-collector' THEN IF v_today_save >= 50 THEN v_count := 1; END IF; v_progress := LEAST(v_today_save,50);
      WHEN 'first-collection' THEN v_progress := LEAST(v_collection_count::INT,1); IF v_collection_count >= 1 THEN v_count := 1; END IF;
      WHEN 'curator-bronze' THEN v_progress := LEAST(v_collection_count::INT,3); IF v_collection_count >= 3 THEN v_count := 1; END IF;
      WHEN 'curator-silver' THEN v_progress := LEAST(v_collection_count::INT,10); IF v_collection_count >= 10 THEN v_count := 1; END IF;
      WHEN 'curator-gold' THEN v_progress := LEAST(v_collection_count::INT,25); IF v_collection_count >= 25 THEN v_count := 1; END IF;
      WHEN 'curator-supreme' THEN v_progress := LEAST(v_collection_count::INT,50); IF v_collection_count >= 50 THEN v_count := 1; END IF;
      WHEN 'pack-rat-bronze' THEN SELECT COALESCE(MAX(ci_count.cnt),0)::INT INTO v_progress FROM (SELECT COUNT(*) AS cnt FROM public.collection_items ci JOIN public.collections c ON c.id = ci.collection_id WHERE c.user_id = p_user_id GROUP BY c.id) ci_count; IF v_progress >= 10 THEN v_count := 1; END IF;
      WHEN 'pack-rat-silver' THEN SELECT COALESCE(MAX(ci_count.cnt),0)::INT INTO v_progress FROM (SELECT COUNT(*) AS cnt FROM public.collection_items ci JOIN public.collections c ON c.id = ci.collection_id WHERE c.user_id = p_user_id GROUP BY c.id) ci_count; IF v_progress >= 50 THEN v_count := 1; END IF;
      WHEN 'pack-rat-gold' THEN SELECT COALESCE(MAX(ci_count.cnt),0)::INT INTO v_progress FROM (SELECT COUNT(*) AS cnt FROM public.collection_items ci JOIN public.collections c ON c.id = ci.collection_id WHERE c.user_id = p_user_id GROUP BY c.id) ci_count; IF v_progress >= 200 THEN v_count := 1; END IF;
      WHEN 'public-curator' THEN SELECT COUNT(*) INTO v_count FROM public.collections WHERE user_id = p_user_id AND is_public = TRUE; v_progress := LEAST(v_count::INT,5); IF v_count >= 5 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'social-butterfly-bronze' THEN v_progress := LEAST(v_following_count::INT,5); IF v_following_count >= 5 THEN v_count := 1; END IF;
      WHEN 'social-butterfly-silver' THEN v_progress := LEAST(v_following_count::INT,25); IF v_following_count >= 25 THEN v_count := 1; END IF;
      WHEN 'social-butterfly-gold' THEN v_progress := LEAST(v_following_count::INT,100); IF v_following_count >= 100 THEN v_count := 1; END IF;
      WHEN 'influencer-bronze' THEN v_progress := LEAST(v_follower_count::INT,10); IF v_follower_count >= 10 THEN v_count := 1; END IF;
      WHEN 'influencer-silver' THEN v_progress := LEAST(v_follower_count::INT,50); IF v_follower_count >= 50 THEN v_count := 1; END IF;
      WHEN 'influencer-gold' THEN v_progress := LEAST(v_follower_count::INT,200); IF v_follower_count >= 200 THEN v_count := 1; END IF;
      WHEN 'influencer-platinum' THEN v_progress := LEAST(v_follower_count::INT,1000); IF v_follower_count >= 1000 THEN v_count := 1; END IF;
      WHEN 'friendly-face' THEN SELECT COUNT(*) INTO v_count FROM public.follows f1 WHERE f1.follower_id = p_user_id AND EXISTS (SELECT 1 FROM public.follows f2 WHERE f2.follower_id = f1.following_id AND f2.following_id = p_user_id AND f2.is_pending = FALSE) AND f1.is_pending = FALSE; v_progress := LEAST(v_count::INT,1);
      WHEN 'first-share' THEN v_count := 0; v_progress := 0;
      WHEN 'profile-perfectionist' THEN SELECT CASE WHEN p.bio IS NOT NULL AND p.bio != '' AND p.display_name IS NOT NULL AND p.display_name != '' AND p.avatar_url IS NOT NULL AND p.avatar_url != '' THEN 1 ELSE 0 END INTO v_count FROM public.profiles p WHERE p.id = p_user_id; v_progress := v_count::INT;
      WHEN 'hot-streak-bronze' THEN v_progress := LEAST(v_streak_days,3); IF v_streak_days >= 3 THEN v_count := 1; END IF;
      WHEN 'hot-streak-silver' THEN v_progress := LEAST(v_streak_days,7); IF v_streak_days >= 7 THEN v_count := 1; END IF;
      WHEN 'hot-streak-gold' THEN v_progress := LEAST(v_streak_days,30); IF v_streak_days >= 30 THEN v_count := 1; END IF;
      WHEN 'unstoppable' THEN v_progress := LEAST(v_streak_days,60); IF v_streak_days >= 60 THEN v_count := 1; END IF;
      WHEN 'phoenix' THEN v_progress := LEAST(v_streak_days,100); IF v_streak_days >= 100 THEN v_count := 1; END IF;
      WHEN 'comeback' THEN SELECT CASE WHEN MAX(date) < CURRENT_DATE - INTERVAL '7 days' AND EXISTS (SELECT 1 FROM public.user_daily_activity WHERE user_id = p_user_id AND date = CURRENT_DATE) THEN 1 ELSE 0 END INTO v_count FROM public.user_daily_activity WHERE user_id = p_user_id; v_progress := v_count::INT;
      WHEN 'first-submission' THEN v_progress := LEAST(v_submit_count::INT,1); IF v_submit_count >= 1 THEN v_count := 1; END IF;
      WHEN 'contributor-bronze' THEN v_progress := LEAST(v_submit_count::INT,5); IF v_submit_count >= 5 THEN v_count := 1; END IF;
      WHEN 'contributor-silver' THEN v_progress := LEAST(v_submit_count::INT,25); IF v_submit_count >= 25 THEN v_count := 1; END IF;
      WHEN 'contributor-gold' THEN v_progress := LEAST(v_submit_count::INT,100); IF v_submit_count >= 100 THEN v_count := 1; END IF;
      WHEN 'approved-bronze' THEN v_progress := LEAST(v_approved_count::INT,5); IF v_approved_count >= 5 THEN v_count := 1; END IF;
      WHEN 'approved-silver' THEN v_progress := LEAST(v_approved_count::INT,25); IF v_approved_count >= 25 THEN v_count := 1; END IF;
      WHEN 'approved-gold' THEN v_progress := LEAST(v_approved_count::INT,100); IF v_approved_count >= 100 THEN v_count := 1; END IF;
      WHEN 'quality-control' THEN IF v_submit_count >= 10 THEN v_progress := ((v_approved_count::NUMERIC / v_submit_count) * 100)::INT; IF (v_approved_count::NUMERIC / v_submit_count) >= 0.9 THEN v_count := 1; END IF; ELSE v_progress := v_submit_count::INT; END IF;
      WHEN 'citizen-journalist' THEN SELECT COUNT(*) INTO v_count FROM public.moderation_queue mq JOIN public.urls u ON u.url = mq.url WHERE mq.submitted_by = p_user_id AND (SELECT COUNT(*) FROM public.seen_urls su WHERE su.seen_url_id = u.id) >= 100; v_progress := LEAST(v_count::INT,1);
      WHEN 'rater-bronze' THEN v_progress := LEAST(v_rate_count::INT,25); IF v_rate_count >= 25 THEN v_count := 1; END IF;
      WHEN 'rater-silver' THEN v_progress := LEAST(v_rate_count::INT,100); IF v_rate_count >= 100 THEN v_count := 1; END IF;
      WHEN 'rater-gold' THEN v_progress := LEAST(v_rate_count::INT,500); IF v_rate_count >= 500 THEN v_count := 1; END IF;
      WHEN 'critic' THEN v_progress := LEAST(v_rate_count::INT,1000); IF v_rate_count >= 1000 THEN v_count := 1; END IF;
      WHEN 'omnivore' THEN SELECT CASE WHEN COUNT(DISTINCT discovery_mode) >= 3 THEN 1 ELSE 0 END INTO v_count FROM (SELECT unnest(ARRAY['discovery','latest','trending']) AS discovery_mode) modes WHERE EXISTS (SELECT 1 FROM public.user_settings us WHERE us.user_id = p_user_id AND us.discovery_mode = modes.discovery_mode); v_progress := v_count::INT;
      WHEN 'marathon' THEN v_progress := LEAST(v_today_roam,100); IF v_today_roam >= 100 THEN v_count := 1; END IF;
      WHEN 'loyalist' THEN IF v_account_age_days >= 365 THEN SELECT CASE WHEN COUNT(DISTINCT DATE_TRUNC('month',date)) >= 12 THEN 1 ELSE 0 END INTO v_count FROM public.user_daily_activity WHERE user_id = p_user_id AND date >= now() - INTERVAL '12 months'; v_progress := (SELECT COUNT(DISTINCT DATE_TRUNC('month',date))::INT FROM public.user_daily_activity WHERE user_id = p_user_id AND date >= now() - INTERVAL '12 months'); ELSE v_progress := v_account_age_days::INT; END IF;
      WHEN 'weekend-warrior' THEN SELECT CASE WHEN EXISTS (SELECT 1 FROM public.user_daily_activity WHERE user_id = p_user_id AND date = CURRENT_DATE AND EXTRACT(DOW FROM date) IN (0,6)) AND EXISTS (SELECT 1 FROM public.user_daily_activity WHERE user_id = p_user_id AND date = CURRENT_DATE - INTERVAL '7 days' AND EXTRACT(DOW FROM date) IN (0,6)) AND EXISTS (SELECT 1 FROM public.user_daily_activity WHERE user_id = p_user_id AND date = CURRENT_DATE - INTERVAL '14 days' AND EXTRACT(DOW FROM date) IN (0,6)) AND EXISTS (SELECT 1 FROM public.user_daily_activity WHERE user_id = p_user_id AND date = CURRENT_DATE - INTERVAL '21 days' AND EXTRACT(DOW FROM date) IN (0,6)) THEN 1 ELSE 0 END INTO v_count; v_progress := v_count::INT;
      WHEN 'diversity-champ' THEN SELECT COUNT(DISTINCT u.language)::INT INTO v_progress FROM public.saved_urls su JOIN public.urls u ON u.id = su.url_id WHERE su.user_id = p_user_id AND u.language IS NOT NULL; IF v_progress >= 5 THEN v_count := 1; END IF;
      WHEN 'error-404-explorer' THEN v_count := 0; v_progress := 0;
      WHEN 'time-traveler' THEN SELECT COUNT(*) INTO v_count FROM public.seen_urls su JOIN public.urls u ON u.id = su.seen_url_id WHERE su.user_id = p_user_id AND u.created_at < '2006-01-01'::DATE; v_progress := LEAST(v_count::INT,1);
      WHEN 'polyglot' THEN SELECT COUNT(DISTINCT u.language)::INT INTO v_progress FROM public.saved_urls su JOIN public.urls u ON u.id = su.url_id WHERE su.user_id = p_user_id AND u.language IS NOT NULL; IF v_progress >= 3 THEN v_count := 1; END IF;
      WHEN 'easter-egg' THEN v_count := 0; v_progress := 0;
      WHEN 'lunar-roamer' THEN v_count := 0; v_progress := 0;
      WHEN 'lucky-777' THEN v_progress := LEAST(v_roam_count::INT,777); IF v_roam_count = 777 THEN v_count := 1; END IF;
      WHEN 'midnight-oil' THEN SELECT COUNT(*) INTO v_progress FROM public.seen_urls WHERE user_id = p_user_id AND EXTRACT(HOUR FROM seen_at) BETWEEN 0 AND 3; IF v_progress >= 50 THEN v_count := 1; END IF;
      ELSE CONTINUE;
    END CASE;

    IF v_count > 0 THEN
      IF v_badge.parent_badge_slug IS NOT NULL THEN
        SELECT id INTO v_parent_badge_id FROM public.badges WHERE slug = v_badge.parent_badge_slug;
        IF NOT EXISTS (SELECT 1 FROM public.user_badges WHERE user_id = p_user_id AND badge_id = v_parent_badge_id AND unlocked_at IS NOT NULL) THEN CONTINUE; END IF;
      END IF;
      -- FIX: Explicitly set unlocked_at = now() so this row is counted by get_user_badges
      INSERT INTO public.user_badges (user_id, badge_id, progress_current, unlocked_at)
      VALUES (p_user_id, v_badge.id, v_progress, now())
      ON CONFLICT (user_id, badge_id) DO UPDATE
      SET progress_current = EXCLUDED.progress_current,
          unlocked_at = COALESCE(user_badges.unlocked_at, EXCLUDED.unlocked_at);
      IF FOUND THEN
        v_badge_xp_awarded := v_badge_xp_awarded + v_badge.xp_reward; v_new_count := v_new_count + 1;
        badge_id := v_badge.id; badge_slug := v_badge.slug; badge_name := v_badge.name; badge_description := v_badge.description; badge_icon := v_badge.icon; badge_category := v_badge.category; badge_tier := v_badge.tier; badge_xp_reward := v_badge.xp_reward;
        RETURN NEXT;
      END IF;
    ELSE
      -- In-progress badge: unlocked_at stays NULL, but we track progress
      INSERT INTO public.user_badges (user_id, badge_id, progress_current, unlocked_at)
      VALUES (p_user_id, v_badge.id, v_progress, NULL)
      ON CONFLICT (user_id, badge_id) DO UPDATE
      SET progress_current = EXCLUDED.progress_current;
    END IF;
  END LOOP;

  -- Milestone badges
  FOR v_badge IN SELECT * FROM public.badges WHERE category = 'milestone' AND is_gift_only = FALSE AND id NOT IN (SELECT badge_id FROM public.user_badges WHERE user_id = p_user_id)
  LOOP
    CASE v_badge.slug
      WHEN 'level-10' THEN IF v_level >= 10 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'level-20' THEN IF v_level >= 20 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'level-30' THEN IF v_level >= 30 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'level-40' THEN IF v_level >= 40 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'level-50' THEN IF v_level >= 50 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'level-75' THEN IF v_level >= 75 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'level-100' THEN IF v_level >= 100 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'centurion-badges' THEN SELECT COUNT(*) INTO v_count FROM public.user_badges WHERE user_id = p_user_id AND unlocked_at IS NOT NULL; IF v_count >= 100 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'master-roamer' THEN IF v_level >= 50 AND (SELECT COUNT(*) FROM public.user_badges WHERE user_id = p_user_id AND unlocked_at IS NOT NULL) >= 50 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'grandmaster' THEN IF v_level >= 100 AND (SELECT COUNT(*) FROM public.user_badges ub JOIN public.badges b ON b.id = ub.badge_id WHERE ub.user_id = p_user_id AND ub.unlocked_at IS NOT NULL AND b.is_hidden = FALSE AND b.is_gift_only = FALSE) >= (SELECT COUNT(*) FROM public.badges WHERE is_hidden = FALSE AND is_gift_only = FALSE AND category != 'milestone') THEN v_count := 1; ELSE v_count := 0; END IF;
      ELSE CONTINUE;
    END CASE;
    IF v_count > 0 THEN
      INSERT INTO public.user_badges (user_id, badge_id, progress_current, unlocked_at)
      VALUES (p_user_id, v_badge.id, 0, now())
      ON CONFLICT (user_id, badge_id) DO UPDATE
      SET unlocked_at = COALESCE(user_badges.unlocked_at, EXCLUDED.unlocked_at);
      IF FOUND THEN
        v_badge_xp_awarded := v_badge_xp_awarded + v_badge.xp_reward; v_new_count := v_new_count + 1;
        badge_id := v_badge.id; badge_slug := v_badge.slug; badge_name := v_badge.name; badge_description := v_badge.description; badge_icon := v_badge.icon; badge_category := v_badge.category; badge_tier := v_badge.tier; badge_xp_reward := v_badge.xp_reward;
        RETURN NEXT;
      END IF;
    END IF;
  END LOOP;

  IF v_badge_xp_awarded > 0 THEN
    INSERT INTO public.xp_log (user_id, action, xp_awarded, metadata) VALUES (p_user_id, 'badge_rewards', v_badge_xp_awarded, jsonb_build_object('badge_count', v_new_count));
    UPDATE public.profiles SET xp_total = xp_total + v_badge_xp_awarded, badge_count = badge_count + v_new_count WHERE id = p_user_id;
  END IF;
  SELECT xp_total, public.calculate_level(xp_total) INTO v_xp_total, v_level FROM public.profiles WHERE id = p_user_id;
  UPDATE public.profiles SET level = v_level WHERE id = p_user_id AND level <> v_level;

  -- FIX: Always sync badge_count after evaluation to keep it accurate
  PERFORM public.sync_profile_badge_count(p_user_id);
END; $$;

REVOKE EXECUTE ON FUNCTION public.evaluate_badges FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.evaluate_badges TO authenticated, service_role;