-- =============================================================================
-- Fix badge unlocking: progress rows block earned badges (ON CONFLICT DO NOTHING)
-- Also implements lunar-roamer and error-404-explorer badge logic.
-- Also adds missing 'badge_rewards' xp_action.
-- Also creates the notifications → push-notify database webhook trigger.
-- =============================================================================

-- ── 1. Ensure badge_rewards xp_action exists ─────────────────────────────────
-- badge_rewards uses xp=1 as the CHECK constraint requires xp>0. Actual XP is awarded
-- per-badge via badge.xp_reward in evaluate_badges, not from this xp_actions table.
INSERT INTO public.xp_actions (action, xp, description)
VALUES ('badge_rewards', 1, 'XP awarded from badge unlocks (internal)')
ON CONFLICT DO NOTHING;

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. Replace evaluate_badges with fixed version
--    Critical fix: ON CONFLICT DO NOTHING → DO UPDATE SET unlocked_at
--    This allows badges that previously had only a progress row to now unlock.
-- ═════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.evaluate_badges(p_user_id UUID)
RETURNS TABLE(
  badge_id           UUID,
  badge_slug         TEXT,
  badge_name         TEXT,
  badge_description  TEXT,
  badge_icon         TEXT,
  badge_category     TEXT,
  badge_tier         SMALLINT,
  badge_xp_reward    INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_roam_count        BIGINT;
  v_save_count        BIGINT;
  v_submit_count      BIGINT;
  v_approved_count    BIGINT;
  v_collection_count  BIGINT;
  v_follower_count    BIGINT;
  v_following_count   BIGINT;
  v_rate_count        BIGINT;
  v_unique_domains    BIGINT;
  v_unique_cat_roam   BIGINT;
  v_unique_cat_save   BIGINT;
  v_streak_days       INT;
  v_level             INT;
  v_xp_total          BIGINT;
  v_account_age_days  INT;
  v_badge            RECORD;
  v_count            BIGINT;
  v_today_roam       INT;
  v_today_save       INT;
  v_parent_badge_id  UUID;
  v_progress         INT;
  v_badge_xp_awarded INT := 0;
  v_new_count        INT := 0;
  v_prev_level       INT;
  v_username         TEXT;
  v_profile_url      TEXT;
  v_existing_row     RECORD;
BEGIN
  IF auth.uid() <> p_user_id AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'You can only evaluate badges for yourself.';
  END IF;

  -- ── Collect user stats ─────────────────────────────────────────────────────
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

  -- ── Evaluate each unearned badge (including those with progress rows) ─────
  FOR v_badge IN
    SELECT * FROM public.badges
    WHERE is_gift_only = FALSE
    AND category != 'milestone'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_badges ub
      WHERE ub.user_id = p_user_id AND ub.badge_id = badges.id AND ub.unlocked_at IS NOT NULL
    )
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
      WHEN 'error-404-explorer' THEN SELECT COUNT(*) INTO v_count FROM public.log_failed_urls WHERE user_id = p_user_id; v_progress := LEAST(v_count::INT, 1); IF v_count > 0 THEN v_count := 1; END IF;
      WHEN 'time-traveler' THEN SELECT COUNT(*) INTO v_count FROM public.seen_urls su JOIN public.urls u ON u.id = su.seen_url_id WHERE su.user_id = p_user_id AND u.created_at < '2006-01-01'::DATE; v_progress := LEAST(v_count::INT, 1);
      WHEN 'polyglot' THEN SELECT COUNT(DISTINCT u.language)::INT INTO v_progress FROM public.saved_urls su JOIN public.urls u ON u.id = su.url_id WHERE su.user_id = p_user_id AND u.language IS NOT NULL; IF v_progress >= 3 THEN v_count := 1; END IF;
      WHEN 'easter-egg' THEN v_count := 0; v_progress := 0;
      WHEN 'lunar-roamer' THEN SELECT CASE WHEN EXISTS (SELECT 1 FROM public.seen_urls su WHERE su.user_id = p_user_id AND su.seen_at::DATE IN ('2026-01-03','2026-02-01','2026-03-03','2026-04-02','2026-05-01','2026-05-31','2026-06-29','2026-07-29','2026-08-28','2026-09-26','2026-10-26','2026-11-24','2026-12-24','2027-01-22','2027-02-20','2027-03-22','2027-04-20','2027-05-20','2027-06-18','2027-07-18','2027-08-16','2027-09-15','2027-10-15','2027-11-13','2027-12-13')) THEN 1 ELSE 0 END INTO v_count; v_progress := v_count::INT;
      WHEN 'lucky-777' THEN v_progress := LEAST(v_roam_count::INT, 777); IF v_roam_count = 777 THEN v_count := 1; END IF;
      WHEN 'midnight-oil' THEN SELECT COUNT(*) INTO v_progress FROM public.seen_urls WHERE user_id = p_user_id AND EXTRACT(HOUR FROM seen_at) BETWEEN 0 AND 3; IF v_progress >= 50 THEN v_count := 1; END IF;
      ELSE CONTINUE;
    END CASE;

    IF v_count > 0 THEN
      IF v_badge.parent_badge_slug IS NOT NULL THEN
        SELECT id INTO v_parent_badge_id FROM public.badges WHERE slug = v_badge.parent_badge_slug;
        IF NOT EXISTS (SELECT 1 FROM public.user_badges WHERE user_id = p_user_id AND badge_id = v_parent_badge_id AND unlocked_at IS NOT NULL) THEN
          CONTINUE;
        END IF;
      END IF;

      -- CRITICAL FIX: Use DO UPDATE SET so existing progress rows get their unlocked_at set.
      -- Previously ON CONFLICT DO NOTHING silently ignored earned badges that had a progress row.
      INSERT INTO public.user_badges (user_id, badge_id, progress_current, unlocked_at)
      VALUES (p_user_id, v_badge.id, v_progress, now())
      ON CONFLICT (user_id, badge_id)
      DO UPDATE SET progress_current = EXCLUDED.progress_current,
                    unlocked_at = COALESCE(user_badges.unlocked_at, now());

      -- Check if this was a NEW unlock (row didn't exist, OR existed but unlocked_at was NULL)
      SELECT unlocked_at INTO v_existing_row FROM public.user_badges WHERE user_id = p_user_id AND badge_id = v_badge.id;
      IF v_existing_row.unlocked_at = now() OR v_existing_row.unlocked_at IS NOT NULL THEN
        -- Award XP and notify only if this is truly new
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
      -- Progress row: update progress but keep unlocked_at as-is
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
    AND NOT EXISTS (
      SELECT 1 FROM public.user_badges ub
      WHERE ub.user_id = p_user_id AND ub.badge_id = badges.id AND ub.unlocked_at IS NOT NULL
    )
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
      ON CONFLICT (user_id, badge_id)
      DO UPDATE SET unlocked_at = COALESCE(user_badges.unlocked_at, now());

      SELECT unlocked_at INTO v_existing_row FROM public.user_badges WHERE user_id = p_user_id AND badge_id = v_badge.id;
      IF v_existing_row.unlocked_at = now() OR v_existing_row.unlocked_at IS NOT NULL THEN
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
    UPDATE public.profiles SET xp_total = xp_total + v_badge_xp_awarded, badge_count = badge_count + v_new_count WHERE id = p_user_id;
  END IF;

  SELECT xp_total, public.calculate_level(xp_total) INTO v_xp_total, v_level FROM public.profiles WHERE id = p_user_id;
  UPDATE public.profiles SET level = v_level WHERE id = p_user_id AND level <> v_level;

  -- ── Level-up notification (for level gains caused by badge XP) ─────────────
  IF v_level > v_prev_level THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (p_user_id, 'level_up', '🎉 Level Up! You''re now Level ' || v_level, 'Keep roaming to earn more badges and XP!', jsonb_build_object('level', v_level, 'rank', '', 'url', v_profile_url));
  END IF;

END;
$$;

REVOKE EXECUTE ON FUNCTION public.evaluate_badges(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.evaluate_badges(UUID) TO authenticated, service_role;

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. Create database webhook for notifications → push-notify
--    Supabase webhooks are managed via the Dashboard > Database > Webhooks,
--    but this migration documents the expected configuration and creates a
--    pg_net-based trigger as a fallback if pg_net extension is available.
--    The Supabase-managed webhook should be configured as:
--      Table: public.notifications
--      Events: INSERT
--      Function: push-notify
-- ═════════════════════════════════════════════════════════════════════════════

-- Try to create a pg_net-based trigger as a backup (silently skipped if pg_net unavailable)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    CREATE OR REPLACE FUNCTION public.notify_webhook_trigger()
    RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $fn$
    BEGIN
      PERFORM net.http_post(
        url := CONCAT(current_setting('app.settings.supabase_url'), '/functions/v1/push-notify'),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', CONCAT('Bearer ', current_setting('supabase.service_role_key'))
        ),
        body := jsonb_build_object(
          'type', 'INSERT',
          'table', 'notifications',
          'record', row_to_json(NEW)
        )
      );
      RETURN NEW;
    END;
    $fn$;

    DROP TRIGGER IF EXISTS on_notification_insert ON public.notifications;
    CREATE TRIGGER on_notification_insert
      AFTER INSERT ON public.notifications
      FOR EACH ROW EXECUTE FUNCTION public.notify_webhook_trigger();
  END IF;
END;
$$;