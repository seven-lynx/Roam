-- Fix XP Consistency: Reduce cooldowns, add level-up notifications,
-- add trigger to keep level always in sync with xp_total, add reason return column.
-- Migration ID: 20260707000001

-- ── Step 1: Reduce cooldowns to user-friendly (but still anti-farm) values ──
UPDATE public.xp_actions SET cooldown_seconds = 5  WHERE action = 'roam';
UPDATE public.xp_actions SET cooldown_seconds = 10 WHERE action = 'save_url';
UPDATE public.xp_actions SET cooldown_seconds = 2  WHERE action = 'rate_url';
UPDATE public.xp_actions SET cooldown_seconds = 30 WHERE action = 'create_collection';
UPDATE public.xp_actions SET cooldown_seconds = 10 WHERE action = 'follow_user';
UPDATE public.xp_actions SET cooldown_seconds = 10 WHERE action = 'gain_follower';
UPDATE public.xp_actions SET cooldown_seconds = 10 WHERE action = 'share_url';
UPDATE public.xp_actions SET cooldown_seconds = 10 WHERE action = 'add_to_collection';
UPDATE public.xp_actions SET cooldown_seconds = 10 WHERE action = 'collection_favorited';

-- ── Step 2: Add trigger to keep level always consistent with xp_total ───────
-- This eliminates ALL possible divergence between xp_total and level.
-- Any function that updates xp_total no longer needs to manually set level.
CREATE OR REPLACE FUNCTION public.sync_profile_level()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.level = public.calculate_level(NEW.xp_total);
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists (safety)
DROP TRIGGER IF EXISTS trg_sync_profile_level ON public.profiles;

CREATE TRIGGER trg_sync_profile_level
  BEFORE UPDATE OF xp_total ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_level();

-- ── Step 3: Rebuild award_xp with reduced cooldowns, level-up notifications, ─
-- and a 'reason' return column for transparency.
DROP FUNCTION IF EXISTS public.award_xp(UUID, TEXT, JSONB, TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.award_xp(
  p_user_id UUID,
  p_action TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS TABLE(
  new_xp_total BIGINT,
  new_level INT,
  xp_awarded INT,
  reason TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '5s'
AS $$
DECLARE
  v_xp INT;
  v_cooldown INT;
  v_max_daily INT;
  v_new_xp BIGINT;
  v_new_lvl INT;
  v_cur_lvl INT;
  v_last_award TIMESTAMPTZ;
  v_today_xp INT;
  v_caller_uid UUID;
  v_is_service_role BOOLEAN;
  v_username TEXT;
  v_profile_url TEXT;
BEGIN
  -- ── AUTH GUARD ────────────────────────────────────────────────────────────
  BEGIN
    v_is_service_role := NULLIF(current_setting('request.jwt.claims', TRUE)::jsonb->>'role', NULL) = 'service_role';
  EXCEPTION WHEN OTHERS THEN
    v_is_service_role := FALSE;
  END;
  v_caller_uid := auth.uid();

  IF v_caller_uid != p_user_id AND NOT v_is_service_role THEN
    RAISE EXCEPTION 'Cannot award XP to another user. auth.uid()=%, p_user_id=%', v_caller_uid, p_user_id;
  END IF;

  -- ── VALIDATE ACTION ───────────────────────────────────────────────────────
  SELECT xp, cooldown_seconds, max_daily_xp
    INTO v_xp, v_cooldown, v_max_daily
    FROM public.xp_actions WHERE action = p_action;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown action: %', p_action;
  END IF;

  -- ── IDEMPOTENCY CHECK ─────────────────────────────────────────────────────
  IF p_idempotency_key IS NOT NULL THEN
    PERFORM 1 FROM public.xp_log
      WHERE user_id = p_user_id
        AND action = p_action
        AND idempotency_key = p_idempotency_key
      LIMIT 1;
    IF FOUND THEN
      SELECT xp_total, level INTO v_new_xp, v_new_lvl
        FROM public.profiles WHERE id = p_user_id;
      xp_awarded := 0;
      new_xp_total := v_new_xp;
      new_level := v_new_lvl;
      reason := 'idempotent';
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  -- ── COOLDOWN CHECK ────────────────────────────────────────────────────────
  IF v_cooldown > 0 THEN
    SELECT MAX(created_at) INTO v_last_award
      FROM public.xp_log
      WHERE user_id = p_user_id AND action = p_action;
    IF v_last_award IS NOT NULL AND (NOW() - v_last_award) < make_interval(secs => v_cooldown) THEN
      SELECT xp_total, level INTO v_new_xp, v_new_lvl
        FROM public.profiles WHERE id = p_user_id;
      xp_awarded := 0;
      new_xp_total := v_new_xp;
      new_level := v_new_lvl;
      reason := format('cooldown (next available in %s seconds)',
        v_cooldown - EXTRACT(EPOCH FROM (NOW() - v_last_award))::INT);
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  -- ── DAILY CAP CHECK ───────────────────────────────────────────────────────
  IF v_max_daily IS NOT NULL THEN
    SELECT COALESCE(SUM(xp_awarded), 0) INTO v_today_xp
      FROM public.xp_log
      WHERE user_id = p_user_id AND action = p_action AND created_at::DATE = CURRENT_DATE;
    IF v_today_xp >= v_max_daily THEN
      SELECT xp_total, level INTO v_new_xp, v_new_lvl
        FROM public.profiles WHERE id = p_user_id;
      xp_awarded := 0;
      new_xp_total := v_new_xp;
      new_level := v_new_lvl;
      reason := format('daily cap reached (%s/%s XP)', v_today_xp, v_max_daily);
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  -- ── CAPTURE PRE-XP STATE ──────────────────────────────────────────────────
  SELECT level, username INTO v_cur_lvl, v_username
    FROM public.profiles WHERE id = p_user_id;

  -- ── AWARD XP ──────────────────────────────────────────────────────────────
  INSERT INTO public.xp_log (user_id, action, xp_awarded, metadata, idempotency_key)
    VALUES (p_user_id, p_action, v_xp, p_metadata, p_idempotency_key);

  INSERT INTO public.user_daily_activity (user_id, date, xp_earned)
    VALUES (p_user_id, CURRENT_DATE, v_xp)
    ON CONFLICT (user_id, date) DO UPDATE SET xp_earned = user_daily_activity.xp_earned + v_xp;

  -- The sync_profile_level trigger will automatically recalculate level from xp_total.
  -- We still need to detect level-ups for notification purposes.
  UPDATE public.profiles SET xp_total = xp_total + v_xp WHERE id = p_user_id
    RETURNING xp_total, level INTO v_new_xp, v_new_lvl;

  -- ── LEVEL-UP NOTIFICATION ─────────────────────────────────────────────────
  IF v_new_lvl > v_cur_lvl THEN
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

  xp_awarded := v_xp;
  new_xp_total := v_new_xp;
  new_level := v_new_lvl;
  reason := 'awarded';
  RETURN NEXT;
END;
$$;

-- ── Step 4: Re-apply permissions ───────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.award_xp FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_xp TO authenticated, service_role;

-- ── Step 5: Fix grant_badge to let trigger handle level ────────────────────
-- The trigger on profiles already recalculates level from xp_total.
-- Remove the manual level = calculate_level(xp_total + ...) from grant_badge.
CREATE OR REPLACE FUNCTION public.grant_badge(
  p_user_id UUID,
  p_badge_slug TEXT,
  p_granted_by UUID
)
RETURNS TABLE(
  badge_id UUID,
  badge_slug TEXT,
  badge_name TEXT,
  badge_icon TEXT,
  badge_category TEXT,
  badge_xp_reward INT
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_badge RECORD;
  v_cur_lvl INT;
  v_new_xp BIGINT;
  v_new_lvl INT;
  v_username TEXT;
  v_profile_url TEXT;
BEGIN
  SELECT * INTO v_badge FROM public.badges WHERE slug = p_badge_slug;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Badge not found: %', p_badge_slug;
  END IF;

  INSERT INTO public.user_badges (user_id, badge_id, granted_by, progress_current)
  VALUES (p_user_id, v_badge.id, p_granted_by, 0)
  ON CONFLICT DO NOTHING;

  IF FOUND THEN
    SELECT username, level INTO v_username, v_cur_lvl FROM public.profiles WHERE id = p_user_id;
    v_profile_url := 'https://roamtheweb.app/u/' || v_username;

    -- Emit badge_unlocked notification
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      p_user_id,
      'badge_unlocked',
      v_badge.icon || ' Badge Unlocked: ' || v_badge.name,
      v_badge.description,
      jsonb_build_object(
        'badge_slug', v_badge.slug,
        'badge_icon', v_badge.icon,
        'badge_name', v_badge.name,
        'xp_reward', v_badge.xp_reward,
        'url', v_profile_url
      )
    );

    IF v_badge.xp_reward > 0 THEN
      INSERT INTO public.xp_log (user_id, action, xp_awarded, metadata)
      VALUES (
        p_user_id, 'badge_gifted', v_badge.xp_reward,
        jsonb_build_object('badge_slug', p_badge_slug, 'granted_by', p_granted_by)
      );

      -- Trigger handles level recalculation from xp_total
      UPDATE public.profiles
        SET xp_total = xp_total + v_badge.xp_reward,
            badge_count = badge_count + 1
      WHERE id = p_user_id
      RETURNING xp_total, level INTO v_new_xp, v_new_lvl;

      IF v_new_lvl > v_cur_lvl THEN
        INSERT INTO public.notifications (user_id, type, title, body, data)
        VALUES (
          p_user_id,
          'level_up',
          '🎉 Level Up! You''re now Level ' || v_new_lvl,
          'Keep roaming to earn more badges and XP!',
          jsonb_build_object('level', v_new_lvl, 'rank', '', 'url', v_profile_url)
        );
      END IF;
    ELSE
      UPDATE public.profiles
        SET badge_count = badge_count + 1
      WHERE id = p_user_id;
    END IF;

    badge_id := v_badge.id;
    badge_slug := v_badge.slug;
    badge_name := v_badge.name;
    badge_icon := v_badge.icon;
    badge_category := v_badge.category;
    badge_xp_reward := v_badge.xp_reward;
    RETURN NEXT;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.grant_badge FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_badge TO authenticated, service_role;

-- ── Step 6: Fix evaluate_badges to let trigger handle level ────────────────
-- Remove the manual level = calculate_level(xp_total) at the end.
-- The trigger does this automatically now.
CREATE OR REPLACE FUNCTION public.evaluate_badges(p_user_id UUID)
RETURNS TABLE(
  badge_id UUID,
  badge_slug TEXT,
  badge_name TEXT,
  badge_description TEXT,
  badge_icon TEXT,
  badge_category TEXT,
  badge_tier SMALLINT,
  badge_xp_reward INT
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_roam_count BIGINT;
  v_save_count BIGINT;
  v_submit_count BIGINT;
  v_approved_count BIGINT;
  v_collection_count BIGINT;
  v_follower_count BIGINT;
  v_following_count BIGINT;
  v_rate_count BIGINT;
  v_unique_domains BIGINT;
  v_unique_cat_roam BIGINT;
  v_unique_cat_save BIGINT;
  v_streak_days INT;
  v_level INT;
  v_xp_total BIGINT;
  v_account_age_days INT;
  v_badge RECORD;
  v_count BIGINT;
  v_today_roam INT;
  v_today_save INT;
  v_parent_badge_id UUID;
  v_progress INT;
  v_badge_xp_awarded INT := 0;
  v_new_count INT := 0;
  v_prev_level INT;
  v_username TEXT;
  v_profile_url TEXT;
BEGIN
  IF auth.uid() <> p_user_id AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'You can only evaluate badges for yourself.';
  END IF;

  SELECT COUNT(*) INTO v_roam_count FROM public.seen_urls WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_save_count FROM public.saved_urls WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_submit_count FROM public.moderation_queue WHERE submitted_by = p_user_id;
  SELECT COUNT(*) INTO v_approved_count FROM public.moderation_queue
    WHERE submitted_by = p_user_id AND status = 'approved';
  SELECT COUNT(*) INTO v_collection_count FROM public.collections WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_follower_count FROM public.follows WHERE following_id = p_user_id AND is_pending = FALSE;
  SELECT COUNT(*) INTO v_following_count FROM public.follows WHERE follower_id = p_user_id AND is_pending = FALSE;
  SELECT COUNT(*) INTO v_rate_count FROM public.url_ratings WHERE user_id = p_user_id;
  SELECT COUNT(DISTINCT u.domain) INTO v_unique_domains
  FROM public.seen_urls su JOIN public.urls u ON u.id = su.seen_url_id WHERE su.user_id = p_user_id;
  SELECT COUNT(DISTINCT u.category_id) INTO v_unique_cat_roam
  FROM public.seen_urls su JOIN public.urls u ON u.id = su.seen_url_id WHERE su.user_id = p_user_id;
  SELECT COUNT(DISTINCT u.category_id) INTO v_unique_cat_save
  FROM public.saved_urls su JOIN public.urls u ON u.id = su.url_id WHERE su.user_id = p_user_id;
  SELECT p.streak_days, p.level, p.xp_total, p.created_at, p.username
    INTO v_streak_days, v_level, v_xp_total, v_account_age_days, v_username
    FROM public.profiles p WHERE p.id = p_user_id;
  v_prev_level := v_level;
  v_account_age_days := EXTRACT(DAY FROM now() - v_account_age_days)::INT;
  v_profile_url := 'https://roamtheweb.app/u/' || v_username;
  SELECT COALESCE(roam_count, 0), COALESCE(save_count, 0)
    INTO v_today_roam, v_today_save
    FROM public.user_daily_activity WHERE user_id = p_user_id AND date = CURRENT_DATE;

  FOR v_badge IN
    SELECT * FROM public.badges
    WHERE id NOT IN (SELECT badge_id FROM public.user_badges WHERE user_id = p_user_id)
    AND is_gift_only = FALSE
    AND category != 'milestone'
  LOOP
    v_count := 0; v_progress := 0;
    CASE v_badge.slug
      WHEN 'first-roam' THEN v_progress := LEAST(v_roam_count, 1); IF v_roam_count >= 1 THEN v_count := 1; END IF;
      WHEN 'wanderer-bronze' THEN v_progress := LEAST(v_roam_count::INT, 10); IF v_roam_count >= 10 THEN v_count := 1; END IF;
      WHEN 'wanderer-silver' THEN v_progress := LEAST(v_roam_count::INT, 50); IF v_roam_count >= 50 THEN v_count := 1; END IF;
      WHEN 'wanderer-gold' THEN v_progress := LEAST(v_roam_count::INT, 200); IF v_roam_count >= 200 THEN v_count := 1; END IF;
      WHEN 'nomad-bronze' THEN v_progress := LEAST(v_roam_count::INT, 500); IF v_roam_count >= 500 THEN v_count := 1; END IF;
      WHEN 'nomad-silver' THEN v_progress := LEAST(v_roam_count::INT, 1000); IF v_roam_count >= 1000 THEN v_count := 1; END IF;
      WHEN 'nomad-gold' THEN v_progress := LEAST(v_roam_count::INT, 5000); IF v_roam_count >= 5000 THEN v_count := 1; END IF;
      WHEN 'nomad-platinum' THEN v_progress := LEAST(v_roam_count::INT, 10000); IF v_roam_count >= 10000 THEN v_count := 1; END IF;
      WHEN 'night-owl' THEN SELECT COUNT(*) INTO v_count FROM public.seen_urls WHERE user_id = p_user_id AND EXTRACT(HOUR FROM seen_at) BETWEEN 0 AND 3; v_progress := LEAST(v_count::INT, 1);
      WHEN 'early-bird' THEN SELECT COUNT(*) INTO v_count FROM public.seen_urls WHERE user_id = p_user_id AND EXTRACT(HOUR FROM seen_at) BETWEEN 5 AND 7; v_progress := LEAST(v_count::INT, 1);
      WHEN 'globetrotter-bronze' THEN v_progress := LEAST(v_unique_domains::INT, 5); IF v_unique_domains >= 5 THEN v_count := 1; END IF;
      WHEN 'globetrotter-silver' THEN v_progress := LEAST(v_unique_domains::INT, 15); IF v_unique_domains >= 15 THEN v_count := 1; END IF;
      WHEN 'globetrotter-gold' THEN v_progress := LEAST(v_unique_domains::INT, 30); IF v_unique_domains >= 30 THEN v_count := 1; END IF;
      WHEN 'category-explorer-bronze' THEN v_progress := LEAST(v_unique_cat_roam::INT, 3); IF v_unique_cat_roam >= 3 THEN v_count := 1; END IF;
      WHEN 'category-explorer-silver' THEN v_progress := LEAST(v_unique_cat_roam::INT, 5); IF v_unique_cat_roam >= 5 THEN v_count := 1; END IF;
      WHEN 'category-explorer-gold' THEN SELECT COUNT(*) INTO v_count FROM public.categories; v_progress := v_unique_cat_roam::INT; IF v_unique_cat_roam >= v_count THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'first-save' THEN v_progress := LEAST(v_save_count::INT, 1); IF v_save_count >= 1 THEN v_count := 1; END IF;
      WHEN 'collector-bronze' THEN v_progress := LEAST(v_save_count::INT, 10); IF v_save_count >= 10 THEN v_count := 1; END IF;
      WHEN 'collector-silver' THEN v_progress := LEAST(v_save_count::INT, 50); IF v_save_count >= 50 THEN v_count := 1; END IF;
      WHEN 'collector-gold' THEN v_progress := LEAST(v_save_count::INT, 200); IF v_save_count >= 200 THEN v_count := 1; END IF;
      WHEN 'collector-platinum' THEN v_progress := LEAST(v_save_count::INT, 1000); IF v_save_count >= 1000 THEN v_count := 1; END IF;
      WHEN 'archivist-bronze' THEN v_progress := LEAST(v_save_count::INT, 500); IF v_save_count >= 500 THEN v_count := 1; END IF;
      WHEN 'archivist-silver' THEN v_progress := LEAST(v_save_count::INT, 2000); IF v_save_count >= 2000 THEN v_count := 1; END IF;
      WHEN 'archivist-gold' THEN v_progress := LEAST(v_save_count::INT, 5000); IF v_save_count >= 5000 THEN v_count := 1; END IF;
      WHEN 'tagger-bronze' THEN v_progress := LEAST(v_unique_cat_save::INT, 3); IF v_unique_cat_save >= 3 THEN v_count := 1; END IF;
      WHEN 'tagger-silver' THEN v_progress := LEAST(v_unique_cat_save::INT, 6); IF v_unique_cat_save >= 6 THEN v_count := 1; END IF;
      WHEN 'tagger-gold' THEN v_progress := LEAST(v_unique_cat_save::INT, 10); IF v_unique_cat_save >= 10 THEN v_count := 1; END IF;
      WHEN 'completionist' THEN SELECT COUNT(*) INTO v_count FROM public.categories; v_progress := v_unique_cat_save::INT; IF v_unique_cat_save >= v_count THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'speed-collector' THEN IF v_today_save >= 10 THEN v_count := 1; END IF; v_progress := LEAST(v_today_save, 10);
      WHEN 'mega-collector' THEN IF v_today_save >= 50 THEN v_count := 1; END IF; v_progress := LEAST(v_today_save, 50);
      WHEN 'first-collection' THEN v_progress := LEAST(v_collection_count::INT, 1); IF v_collection_count >= 1 THEN v_count := 1; END IF;
      WHEN 'curator-bronze' THEN v_progress := LEAST(v_collection_count::INT, 3); IF v_collection_count >= 3 THEN v_count := 1; END IF;
      WHEN 'curator-silver' THEN v_progress := LEAST(v_collection_count::INT, 10); IF v_collection_count >= 10 THEN v_count := 1; END IF;
      WHEN 'curator-gold' THEN v_progress := LEAST(v_collection_count::INT, 25); IF v_collection_count >= 25 THEN v_count := 1; END IF;
      WHEN 'curator-supreme' THEN v_progress := LEAST(v_collection_count::INT, 50); IF v_collection_count >= 50 THEN v_count := 1; END IF;
      WHEN 'pack-rat-bronze' THEN SELECT COALESCE(MAX(ci_count.cnt), 0)::INT INTO v_progress FROM (SELECT COUNT(*) AS cnt FROM public.collection_items ci JOIN public.collections c ON c.id = ci.collection_id WHERE c.user_id = p_user_id GROUP BY c.id) ci_count; IF v_progress >= 10 THEN v_count := 1; END IF;
      WHEN 'pack-rat-silver' THEN SELECT COALESCE(MAX(ci_count.cnt), 0)::INT INTO v_progress FROM (SELECT COUNT(*) AS cnt FROM public.collection_items ci JOIN public.collections c ON c.id = ci.collection_id WHERE c.user_id = p_user_id GROUP BY c.id) ci_count; IF v_progress >= 50 THEN v_count := 1; END IF;
      WHEN 'pack-rat-gold' THEN SELECT COALESCE(MAX(ci_count.cnt), 0)::INT INTO v_progress FROM (SELECT COUNT(*) AS cnt FROM public.collection_items ci JOIN public.collections c ON c.id = ci.collection_id WHERE c.user_id = p_user_id GROUP BY c.id) ci_count; IF v_progress >= 200 THEN v_count := 1; END IF;
      WHEN 'public-curator' THEN SELECT COUNT(*) INTO v_count FROM public.collections WHERE user_id = p_user_id AND is_public = TRUE; v_progress := LEAST(v_count::INT, 5); IF v_count >= 5 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'favorited-bronze' THEN BEGIN SELECT COALESCE(SUM(fav_count.cnt), 0)::INT INTO v_progress FROM (SELECT COUNT(*) AS cnt FROM public.collection_favorites cf JOIN public.collections c ON c.id = cf.collection_id WHERE c.user_id = p_user_id GROUP BY cf.collection_id) fav_count; EXCEPTION WHEN undefined_table THEN v_progress := 0; END; IF v_progress >= 5 THEN v_count := 1; END IF;
      WHEN 'favorited-silver' THEN BEGIN SELECT COALESCE(SUM(fav_count.cnt), 0)::INT INTO v_progress FROM (SELECT COUNT(*) AS cnt FROM public.collection_favorites cf JOIN public.collections c ON c.id = cf.collection_id WHERE c.user_id = p_user_id GROUP BY cf.collection_id) fav_count; EXCEPTION WHEN undefined_table THEN v_progress := 0; END; IF v_progress >= 25 THEN v_count := 1; END IF;
      WHEN 'favorited-gold' THEN BEGIN SELECT COALESCE(SUM(fav_count.cnt), 0)::INT INTO v_progress FROM (SELECT COUNT(*) AS cnt FROM public.collection_favorites cf JOIN public.collections c ON c.id = cf.collection_id WHERE c.user_id = p_user_id GROUP BY cf.collection_id) fav_count; EXCEPTION WHEN undefined_table THEN v_progress := 0; END; IF v_progress >= 100 THEN v_count := 1; END IF;
      WHEN 'social-butterfly-bronze' THEN v_progress := LEAST(v_following_count::INT, 5); IF v_following_count >= 5 THEN v_count := 1; END IF;
      WHEN 'social-butterfly-silver' THEN v_progress := LEAST(v_following_count::INT, 25); IF v_following_count >= 25 THEN v_count := 1; END IF;
      WHEN 'social-butterfly-gold' THEN v_progress := LEAST(v_following_count::INT, 100); IF v_following_count >= 100 THEN v_count := 1; END IF;
      WHEN 'influencer-bronze' THEN v_progress := LEAST(v_follower_count::INT, 10); IF v_follower_count >= 10 THEN v_count := 1; END IF;
      WHEN 'influencer-silver' THEN v_progress := LEAST(v_follower_count::INT, 50); IF v_follower_count >= 50 THEN v_count := 1; END IF;
      WHEN 'influencer-gold' THEN v_progress := LEAST(v_follower_count::INT, 200); IF v_follower_count >= 200 THEN v_count := 1; END IF;
      WHEN 'influencer-platinum' THEN v_progress := LEAST(v_follower_count::INT, 1000); IF v_follower_count >= 1000 THEN v_count := 1; END IF;
      WHEN 'friendly-face' THEN SELECT COUNT(*) INTO v_count FROM public.follows f1 WHERE f1.follower_id = p_user_id AND EXISTS (SELECT 1 FROM public.follows f2 WHERE f2.follower_id = f1.following_id AND f2.following_id = p_user_id AND f2.is_pending = FALSE) AND f1.is_pending = FALSE; v_progress := LEAST(v_count::INT, 1);
      WHEN 'first-share' THEN v_count := 0; v_progress := 0;
      WHEN 'profile-perfectionist' THEN SELECT CASE WHEN p.bio IS NOT NULL AND p.bio != '' AND p.display_name IS NOT NULL AND p.display_name != '' AND p.avatar_url IS NOT NULL AND p.avatar_url != '' THEN 1 ELSE 0 END INTO v_count FROM public.profiles p WHERE p.id = p_user_id; v_progress := v_count::INT;
      WHEN 'hot-streak-bronze' THEN v_progress := LEAST(v_streak_days, 3); IF v_streak_days >= 3 THEN v_count := 1; END IF;
      WHEN 'hot-streak-silver' THEN v_progress := LEAST(v_streak_days, 7); IF v_streak_days >= 7 THEN v_count := 1; END IF;
      WHEN 'hot-streak-gold' THEN v_progress := LEAST(v_streak_days, 30); IF v_streak_days >= 30 THEN v_count := 1; END IF;
      WHEN 'unstoppable' THEN v_progress := LEAST(v_streak_days, 60); IF v_streak_days >= 60 THEN v_count := 1; END IF;
      WHEN 'phoenix' THEN v_progress := LEAST(v_streak_days, 100); IF v_streak_days >= 100 THEN v_count := 1; END IF;
      WHEN 'comeback' THEN SELECT CASE WHEN MAX(date) < CURRENT_DATE - INTERVAL '7 days' AND EXISTS (SELECT 1 FROM public.user_daily_activity WHERE user_id = p_user_id AND date = CURRENT_DATE) THEN 1 ELSE 0 END INTO v_count FROM public.user_daily_activity WHERE user_id = p_user_id; v_progress := v_count::INT;
      WHEN 'first-submission' THEN v_progress := LEAST(v_submit_count::INT, 1); IF v_submit_count >= 1 THEN v_count := 1; END IF;
      WHEN 'contributor-bronze' THEN v_progress := LEAST(v_submit_count::INT, 5); IF v_submit_count >= 5 THEN v_count := 1; END IF;
      WHEN 'contributor-silver' THEN v_progress := LEAST(v_submit_count::INT, 25); IF v_submit_count >= 25 THEN v_count := 1; END IF;
      WHEN 'contributor-gold' THEN v_progress := LEAST(v_submit_count::INT, 100); IF v_submit_count >= 100 THEN v_count := 1; END IF;
      WHEN 'approved-bronze' THEN v_progress := LEAST(v_approved_count::INT, 5); IF v_approved_count >= 5 THEN v_count := 1; END IF;
      WHEN 'approved-silver' THEN v_progress := LEAST(v_approved_count::INT, 25); IF v_approved_count >= 25 THEN v_count := 1; END IF;
      WHEN 'approved-gold' THEN v_progress := LEAST(v_approved_count::INT, 100); IF v_approved_count >= 100 THEN v_count := 1; END IF;
      WHEN 'quality-control' THEN IF v_submit_count >= 10 THEN v_progress := ((v_approved_count::NUMERIC / v_submit_count) * 100)::INT; IF (v_approved_count::NUMERIC / v_submit_count) >= 0.9 THEN v_count := 1; END IF; ELSE v_progress := v_submit_count::INT; END IF;
      WHEN 'citizen-journalist' THEN SELECT COUNT(*) INTO v_count FROM public.moderation_queue mq JOIN public.urls u ON u.url = mq.url WHERE mq.submitted_by = p_user_id AND (SELECT COUNT(*) FROM public.seen_urls su WHERE su.seen_url_id = u.id) >= 100; v_progress := LEAST(v_count::INT, 1);
      WHEN 'rater-bronze' THEN v_progress := LEAST(v_rate_count::INT, 25); IF v_rate_count >= 25 THEN v_count := 1; END IF;
      WHEN 'rater-silver' THEN v_progress := LEAST(v_rate_count::INT, 100); IF v_rate_count >= 100 THEN v_count := 1; END IF;
      WHEN 'rater-gold' THEN v_progress := LEAST(v_rate_count::INT, 500); IF v_rate_count >= 500 THEN v_count := 1; END IF;
      WHEN 'critic' THEN v_progress := LEAST(v_rate_count::INT, 1000); IF v_rate_count >= 1000 THEN v_count := 1; END IF;
      WHEN 'omnivore' THEN SELECT CASE WHEN COUNT(DISTINCT discovery_mode) >= 3 THEN 1 ELSE 0 END INTO v_count FROM (SELECT unnest(ARRAY['discovery', 'latest', 'trending']) AS discovery_mode) modes WHERE EXISTS (SELECT 1 FROM public.user_settings us WHERE us.user_id = p_user_id AND us.discovery_mode = modes.discovery_mode); v_progress := v_count::INT;
      WHEN 'marathon' THEN v_progress := LEAST(v_today_roam, 100); IF v_today_roam >= 100 THEN v_count := 1; END IF;
      WHEN 'loyalist' THEN IF v_account_age_days >= 365 THEN SELECT CASE WHEN COUNT(DISTINCT DATE_TRUNC('month', date)) >= 12 THEN 1 ELSE 0 END INTO v_count FROM public.user_daily_activity WHERE user_id = p_user_id AND date >= now() - INTERVAL '12 months'; v_progress := (SELECT COUNT(DISTINCT DATE_TRUNC('month', date))::INT FROM public.user_daily_activity WHERE user_id = p_user_id AND date >= now() - INTERVAL '12 months'); ELSE v_progress := v_account_age_days::INT; END IF;
      WHEN 'weekend-warrior' THEN SELECT CASE WHEN EXISTS (SELECT 1 FROM public.user_daily_activity WHERE user_id = p_user_id AND date = CURRENT_DATE AND EXTRACT(DOW FROM date) IN (0, 6)) AND EXISTS (SELECT 1 FROM public.user_daily_activity WHERE user_id = p_user_id AND date = CURRENT_DATE - INTERVAL '7 days' AND EXTRACT(DOW FROM date) IN (0, 6)) AND EXISTS (SELECT 1 FROM public.user_daily_activity WHERE user_id = p_user_id AND date = CURRENT_DATE - INTERVAL '14 days' AND EXTRACT(DOW FROM date) IN (0, 6)) AND EXISTS (SELECT 1 FROM public.user_daily_activity WHERE user_id = p_user_id AND date = CURRENT_DATE - INTERVAL '21 days' AND EXTRACT(DOW FROM date) IN (0, 6)) THEN 1 ELSE 0 END INTO v_count; v_progress := v_count::INT;
      WHEN 'diversity-champ' THEN SELECT COUNT(DISTINCT u.language)::INT INTO v_progress FROM public.saved_urls su JOIN public.urls u ON u.id = su.url_id WHERE su.user_id = p_user_id AND u.language IS NOT NULL; IF v_progress >= 5 THEN v_count := 1; END IF;
      WHEN 'error-404-explorer' THEN v_count := 0; v_progress := 0;
      WHEN 'time-traveler' THEN SELECT COUNT(*) INTO v_count FROM public.seen_urls su JOIN public.urls u ON u.id = su.seen_url_id WHERE su.user_id = p_user_id AND u.created_at < '2006-01-01'::DATE; v_progress := LEAST(v_count::INT, 1);
      WHEN 'polyglot' THEN SELECT COUNT(DISTINCT u.language)::INT INTO v_progress FROM public.saved_urls su JOIN public.urls u ON u.id = su.url_id WHERE su.user_id = p_user_id AND u.language IS NOT NULL; IF v_progress >= 3 THEN v_count := 1; END IF;
      WHEN 'easter-egg' THEN v_count := 0; v_progress := 0;
      WHEN 'lunar-roamer' THEN v_count := 0; v_progress := 0;
      WHEN 'lucky-777' THEN v_progress := LEAST(v_roam_count::INT, 777); IF v_roam_count = 777 THEN v_count := 1; END IF;
      WHEN 'midnight-oil' THEN SELECT COUNT(*) INTO v_progress FROM public.seen_urls WHERE user_id = p_user_id AND EXTRACT(HOUR FROM seen_at) BETWEEN 0 AND 3; IF v_progress >= 50 THEN v_count := 1; END IF;
      ELSE CONTINUE;
    END CASE;

    IF v_count > 0 THEN
      IF v_badge.parent_badge_slug IS NOT NULL THEN
        SELECT id INTO v_parent_badge_id FROM public.badges WHERE slug = v_badge.parent_badge_slug;
        IF NOT EXISTS (SELECT 1 FROM public.user_badges WHERE user_id = p_user_id AND badge_id = v_parent_badge_id) THEN
          CONTINUE;
        END IF;
      END IF;

      INSERT INTO public.user_badges (user_id, badge_id, progress_current)
      VALUES (p_user_id, v_badge.id, v_progress)
      ON CONFLICT DO NOTHING;

      IF FOUND THEN
        v_badge_xp_awarded := v_badge_xp_awarded + v_badge.xp_reward;
        v_new_count := v_new_count + 1;

        INSERT INTO public.notifications (user_id, type, title, body, data)
        VALUES (
          p_user_id,
          'badge_unlocked',
          v_badge.icon || ' Badge Unlocked: ' || v_badge.name,
          v_badge.description,
          jsonb_build_object(
            'badge_slug', v_badge.slug,
            'badge_icon', v_badge.icon,
            'badge_name', v_badge.name,
            'xp_reward', v_badge.xp_reward,
            'url', v_profile_url
          )
        );

        badge_id := v_badge.id;
        badge_slug := v_badge.slug;
        badge_name := v_badge.name;
        badge_description := v_badge.description;
        badge_icon := v_badge.icon;
        badge_category := v_badge.category;
        badge_tier := v_badge.tier;
        badge_xp_reward := v_badge.xp_reward;
        RETURN NEXT;
      END IF;
    ELSE
      INSERT INTO public.user_badges (user_id, badge_id, progress_current, unlocked_at)
      VALUES (p_user_id, v_badge.id, v_progress, NULL)
      ON CONFLICT (user_id, badge_id)
      DO UPDATE SET progress_current = EXCLUDED.progress_current;
    END IF;
  END LOOP;

  -- ── Evaluate milestone badges ──────────────────────────────────────────────
  FOR v_badge IN
    SELECT * FROM public.badges
    WHERE category = 'milestone' AND is_gift_only = FALSE
    AND id NOT IN (SELECT badge_id FROM public.user_badges WHERE user_id = p_user_id)
  LOOP
    CASE v_badge.slug
      WHEN 'level-10' THEN IF v_level >= 10 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'level-20' THEN IF v_level >= 20 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'level-30' THEN IF v_level >= 30 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'level-40' THEN IF v_level >= 40 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'level-50' THEN IF v_level >= 50 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'level-75' THEN IF v_level >= 75 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'level-100' THEN IF v_level >= 100 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'centurion-badges' THEN SELECT COUNT(*) INTO v_count FROM public.user_badges WHERE user_id = p_user_id; IF v_count >= 100 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'master-roamer' THEN IF v_level >= 50 AND (SELECT COUNT(*) FROM public.user_badges WHERE user_id = p_user_id) >= 50 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'grandmaster' THEN IF v_level >= 100 AND (SELECT COUNT(*) FROM public.user_badges ub JOIN public.badges b ON b.id = ub.badge_id WHERE ub.user_id = p_user_id AND b.is_hidden = FALSE AND b.is_gift_only = FALSE) >= (SELECT COUNT(*) FROM public.badges WHERE is_hidden = FALSE AND is_gift_only = FALSE AND category != 'milestone') THEN v_count := 1; ELSE v_count := 0; END IF;
      ELSE CONTINUE;
    END CASE;

    IF v_count > 0 THEN
      INSERT INTO public.user_badges (user_id, badge_id, progress_current)
      VALUES (p_user_id, v_badge.id, 0) ON CONFLICT DO NOTHING;
      IF FOUND THEN
        v_badge_xp_awarded := v_badge_xp_awarded + v_badge.xp_reward;
        v_new_count := v_new_count + 1;
        INSERT INTO public.notifications (user_id, type, title, body, data)
        VALUES (p_user_id, 'badge_unlocked', v_badge.icon || ' Badge Unlocked: ' || v_badge.name, v_badge.description, jsonb_build_object('badge_slug', v_badge.slug, 'badge_icon', v_badge.icon, 'badge_name', v_badge.name, 'xp_reward', v_badge.xp_reward, 'url', v_profile_url));
        badge_id := v_badge.id; badge_slug := v_badge.slug; badge_name := v_badge.name; badge_description := v_badge.description; badge_icon := v_badge.icon; badge_category := v_badge.category; badge_tier := v_badge.tier; badge_xp_reward := v_badge.xp_reward;
        RETURN NEXT;
      END IF;
    END IF;
  END LOOP;

  -- ── Award XP for all new badges ────────────────────────────────────────────
  IF v_badge_xp_awarded > 0 THEN
    INSERT INTO public.xp_log (user_id, action, xp_awarded, metadata)
    VALUES (p_user_id, 'badge_rewards', v_badge_xp_awarded, jsonb_build_object('badge_count', v_new_count));
    -- Trigger handles level recalculation automatically
    UPDATE public.profiles SET xp_total = xp_total + v_badge_xp_awarded, badge_count = badge_count + v_new_count WHERE id = p_user_id;
  END IF;

  -- ── Level-up notification ──────────────────────────────────────────────────
  SELECT level, xp_total INTO v_level, v_xp_total FROM public.profiles WHERE id = p_user_id;
  IF v_level > v_prev_level THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (p_user_id, 'level_up', '🎉 Level Up! You''re now Level ' || v_level, 'Keep roaming to earn more badges and XP!', jsonb_build_object('level', v_level, 'rank', '', 'url', v_profile_url));
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.evaluate_badges FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.evaluate_badges TO authenticated, service_role;