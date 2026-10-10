-- Fix ambiguous column references between OUT parameter badge_id and user_badges.badge_id
-- The OUT parameters badge_id, badge_slug, etc. shadow table column names in subqueries.
-- Solution: fully qualify ALL column references in WHERE clauses and ON CONFLICT clauses.

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
  v_created_at        TIMESTAMPTZ;
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
  v_total_categories  BIGINT;
BEGIN
  IF auth.uid() <> p_user_id AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'You can only evaluate badges for yourself.';
  END IF;

  BEGIN SELECT COUNT(*) INTO v_roam_count FROM public.seen_urls WHERE user_id = p_user_id; EXCEPTION WHEN undefined_table THEN v_roam_count := 0; END;
  BEGIN SELECT COUNT(*) INTO v_save_count FROM public.saved_urls WHERE user_id = p_user_id; EXCEPTION WHEN undefined_table THEN v_save_count := 0; END;
  BEGIN SELECT COUNT(*) INTO v_submit_count FROM public.moderation_queue WHERE submitted_by = p_user_id; EXCEPTION WHEN undefined_table THEN v_submit_count := 0; END;
  BEGIN SELECT COUNT(*) INTO v_approved_count FROM public.moderation_queue WHERE submitted_by = p_user_id AND status = 'approved'; EXCEPTION WHEN undefined_table THEN v_approved_count := 0; END;
  BEGIN SELECT COUNT(*) INTO v_collection_count FROM public.collections WHERE user_id = p_user_id; EXCEPTION WHEN undefined_table THEN v_collection_count := 0; END;
  BEGIN SELECT COUNT(*) INTO v_follower_count FROM public.follows WHERE following_id = p_user_id AND is_pending = FALSE; EXCEPTION WHEN undefined_table THEN v_follower_count := 0; END;
  BEGIN SELECT COUNT(*) INTO v_following_count FROM public.follows WHERE follower_id = p_user_id AND is_pending = FALSE; EXCEPTION WHEN undefined_table THEN v_following_count := 0; END;
  BEGIN SELECT COUNT(*) INTO v_rate_count FROM public.url_ratings WHERE user_id = p_user_id; EXCEPTION WHEN undefined_table THEN v_rate_count := 0; END;
  BEGIN SELECT COUNT(DISTINCT u.domain) INTO v_unique_domains FROM public.seen_urls su JOIN public.urls u ON u.id = su.url_id WHERE su.user_id = p_user_id; EXCEPTION WHEN undefined_table THEN v_unique_domains := 0; END;
  BEGIN SELECT COUNT(DISTINCT u.category_id) INTO v_unique_cat_roam FROM public.seen_urls su JOIN public.urls u ON u.id = su.url_id WHERE su.user_id = p_user_id; EXCEPTION WHEN undefined_table THEN v_unique_cat_roam := 0; END;
  BEGIN SELECT COUNT(DISTINCT u.category_id) INTO v_unique_cat_save FROM public.saved_urls su JOIN public.urls u ON u.id = su.url_id WHERE su.user_id = p_user_id; EXCEPTION WHEN undefined_table THEN v_unique_cat_save := 0; END;
  BEGIN SELECT COUNT(*) INTO v_total_categories FROM public.categories; EXCEPTION WHEN undefined_table THEN v_total_categories := 0; END;

  SELECT p.streak_days, COALESCE(p.level, 1), COALESCE(p.xp_total, 0), p.created_at, p.username
    INTO v_streak_days, v_level, v_xp_total, v_created_at, v_username
    FROM public.profiles p WHERE p.id = p_user_id;
  v_prev_level := v_level;
  v_account_age_days := EXTRACT(DAY FROM now() - v_created_at)::INT;
  v_profile_url := 'https://roamtheweb.app/u/' || v_username;
  BEGIN SELECT COALESCE(roam_count, 0), COALESCE(save_count, 0) INTO v_today_roam, v_today_save FROM public.user_daily_activity WHERE user_id = p_user_id AND date = CURRENT_DATE; EXCEPTION WHEN undefined_table THEN v_today_roam := 0; v_today_save := 0; END;

  FOR v_badge IN
    SELECT b.* FROM public.badges b WHERE b.is_gift_only = FALSE AND b.category != 'milestone'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_badges _ub WHERE _ub.user_id = p_user_id AND _ub.badge_id = b.id AND _ub.unlocked_at IS NOT NULL
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
      WHEN 'globetrotter-bronze' THEN v_progress := LEAST(v_unique_domains::INT, 5); IF v_unique_domains >= 5 THEN v_count := 1; END IF;
      WHEN 'globetrotter-silver' THEN v_progress := LEAST(v_unique_domains::INT, 15); IF v_unique_domains >= 15 THEN v_count := 1; END IF;
      WHEN 'globetrotter-gold' THEN v_progress := LEAST(v_unique_domains::INT, 30); IF v_unique_domains >= 30 THEN v_count := 1; END IF;
      WHEN 'category-explorer-bronze' THEN v_progress := LEAST(v_unique_cat_roam::INT, 3); IF v_unique_cat_roam >= 3 THEN v_count := 1; END IF;
      WHEN 'category-explorer-silver' THEN v_progress := LEAST(v_unique_cat_roam::INT, 5); IF v_unique_cat_roam >= 5 THEN v_count := 1; END IF;
      WHEN 'category-explorer-gold' THEN v_progress := v_unique_cat_roam::INT; IF v_unique_cat_roam >= v_total_categories AND v_total_categories > 0 THEN v_count := 1; ELSE v_count := 0; END IF;
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
      WHEN 'completionist' THEN v_progress := v_unique_cat_save::INT; IF v_unique_cat_save >= v_total_categories AND v_total_categories > 0 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'hot-streak-bronze' THEN v_progress := LEAST(v_streak_days, 3); IF v_streak_days >= 3 THEN v_count := 1; END IF;
      WHEN 'hot-streak-silver' THEN v_progress := LEAST(v_streak_days, 7); IF v_streak_days >= 7 THEN v_count := 1; END IF;
      WHEN 'hot-streak-gold' THEN v_progress := LEAST(v_streak_days, 30); IF v_streak_days >= 30 THEN v_count := 1; END IF;
      WHEN 'unstoppable' THEN v_progress := LEAST(v_streak_days, 60); IF v_streak_days >= 60 THEN v_count := 1; END IF;
      WHEN 'phoenix' THEN v_progress := LEAST(v_streak_days, 100); IF v_streak_days >= 100 THEN v_count := 1; END IF;
      WHEN 'first-submission' THEN v_progress := LEAST(v_submit_count::INT, 1); IF v_submit_count >= 1 THEN v_count := 1; END IF;
      WHEN 'contributor-bronze' THEN v_progress := LEAST(v_submit_count::INT, 5); IF v_submit_count >= 5 THEN v_count := 1; END IF;
      WHEN 'contributor-silver' THEN v_progress := LEAST(v_submit_count::INT, 25); IF v_submit_count >= 25 THEN v_count := 1; END IF;
      WHEN 'contributor-gold' THEN v_progress := LEAST(v_submit_count::INT, 100); IF v_submit_count >= 100 THEN v_count := 1; END IF;
      WHEN 'approved-bronze' THEN v_progress := LEAST(v_approved_count::INT, 5); IF v_approved_count >= 5 THEN v_count := 1; END IF;
      WHEN 'approved-silver' THEN v_progress := LEAST(v_approved_count::INT, 25); IF v_approved_count >= 25 THEN v_count := 1; END IF;
      WHEN 'approved-gold' THEN v_progress := LEAST(v_approved_count::INT, 100); IF v_approved_count >= 100 THEN v_count := 1; END IF;
      WHEN 'social-butterfly-bronze' THEN v_progress := LEAST(v_following_count::INT, 5); IF v_following_count >= 5 THEN v_count := 1; END IF;
      WHEN 'social-butterfly-silver' THEN v_progress := LEAST(v_following_count::INT, 25); IF v_following_count >= 25 THEN v_count := 1; END IF;
      WHEN 'social-butterfly-gold' THEN v_progress := LEAST(v_following_count::INT, 100); IF v_following_count >= 100 THEN v_count := 1; END IF;
      WHEN 'influencer-bronze' THEN v_progress := LEAST(v_follower_count::INT, 10); IF v_follower_count >= 10 THEN v_count := 1; END IF;
      WHEN 'influencer-silver' THEN v_progress := LEAST(v_follower_count::INT, 50); IF v_follower_count >= 50 THEN v_count := 1; END IF;
      WHEN 'influencer-gold' THEN v_progress := LEAST(v_follower_count::INT, 200); IF v_follower_count >= 200 THEN v_count := 1; END IF;
      WHEN 'influencer-platinum' THEN v_progress := LEAST(v_follower_count::INT, 1000); IF v_follower_count >= 1000 THEN v_count := 1; END IF;
      WHEN 'first-collection' THEN v_progress := LEAST(v_collection_count::INT, 1); IF v_collection_count >= 1 THEN v_count := 1; END IF;
      WHEN 'curator-bronze' THEN v_progress := LEAST(v_collection_count::INT, 3); IF v_collection_count >= 3 THEN v_count := 1; END IF;
      WHEN 'curator-silver' THEN v_progress := LEAST(v_collection_count::INT, 10); IF v_collection_count >= 10 THEN v_count := 1; END IF;
      WHEN 'curator-gold' THEN v_progress := LEAST(v_collection_count::INT, 25); IF v_collection_count >= 25 THEN v_count := 1; END IF;
      WHEN 'curator-supreme' THEN v_progress := LEAST(v_collection_count::INT, 50); IF v_collection_count >= 50 THEN v_count := 1; END IF;
      WHEN 'profile-perfectionist' THEN SELECT CASE WHEN p.bio IS NOT NULL AND p.bio != '' AND p.display_name IS NOT NULL AND p.display_name != '' AND p.avatar_url IS NOT NULL AND p.avatar_url != '' THEN 1 ELSE 0 END INTO v_count FROM public.profiles p WHERE p.id = p_user_id; v_progress := v_count::INT;
      WHEN 'rater-bronze' THEN v_progress := LEAST(v_rate_count::INT, 25); IF v_rate_count >= 25 THEN v_count := 1; END IF;
      WHEN 'rater-silver' THEN v_progress := LEAST(v_rate_count::INT, 100); IF v_rate_count >= 100 THEN v_count := 1; END IF;
      WHEN 'rater-gold' THEN v_progress := LEAST(v_rate_count::INT, 500); IF v_rate_count >= 500 THEN v_count := 1; END IF;
      WHEN 'critic' THEN v_progress := LEAST(v_rate_count::INT, 1000); IF v_rate_count >= 1000 THEN v_count := 1; END IF;
      ELSE v_count := 0;
    END CASE;

    IF v_count > 0 THEN
      IF v_badge.parent_badge_slug IS NOT NULL THEN
        SELECT b2.id INTO v_parent_badge_id FROM public.badges b2 WHERE b2.slug = v_badge.parent_badge_slug;
        IF NOT EXISTS (SELECT 1 FROM public.user_badges _pa WHERE _pa.user_id = p_user_id AND _pa.badge_id = v_parent_badge_id AND _pa.unlocked_at IS NOT NULL) THEN CONTINUE; END IF;
      END IF;

      INSERT INTO public.user_badges (user_id, badge_id, progress_current, unlocked_at)
      VALUES (p_user_id, v_badge.id, v_progress, now())
      ON CONFLICT (user_id, badge_id)
      DO UPDATE SET progress_current = EXCLUDED.progress_current, unlocked_at = COALESCE(public.user_badges.unlocked_at, now());

      SELECT _r1.unlocked_at INTO v_existing_row FROM public.user_badges _r1 WHERE _r1.user_id = p_user_id AND _r1.badge_id = v_badge.id;
      IF v_existing_row.unlocked_at IS NOT NULL THEN
        v_badge_xp_awarded := v_badge_xp_awarded + v_badge.xp_reward; v_new_count := v_new_count + 1;
        INSERT INTO public.notifications (user_id, type, title, body, data)
        VALUES (p_user_id, 'badge_unlocked', v_badge.icon || ' Badge Unlocked: ' || v_badge.name, v_badge.description, jsonb_build_object('badge_slug', v_badge.slug, 'badge_icon', v_badge.icon, 'badge_name', v_badge.name, 'xp_reward', v_badge.xp_reward, 'url', v_profile_url));
        badge_id := v_badge.id; badge_slug := v_badge.slug; badge_name := v_badge.name; badge_description := v_badge.description; badge_icon := v_badge.icon; badge_category := v_badge.category; badge_tier := v_badge.tier; badge_xp_reward := v_badge.xp_reward;
        RETURN NEXT;
      END IF;
    ELSE
      INSERT INTO public.user_badges (user_id, badge_id, progress_current, unlocked_at)
      VALUES (p_user_id, v_badge.id, v_progress, NULL)
      ON CONFLICT (user_id, badge_id) DO UPDATE SET progress_current = EXCLUDED.progress_current;
    END IF;
  END LOOP;

  -- Milestone badges
  FOR v_badge IN
    SELECT b.* FROM public.badges b WHERE b.category = 'milestone' AND b.is_gift_only = FALSE
    AND NOT EXISTS (SELECT 1 FROM public.user_badges _mb WHERE _mb.user_id = p_user_id AND _mb.badge_id = b.id AND _mb.unlocked_at IS NOT NULL)
  LOOP
    CASE v_badge.slug
      WHEN 'level-10' THEN IF v_level >= 10 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'level-20' THEN IF v_level >= 20 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'level-30' THEN IF v_level >= 30 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'level-40' THEN IF v_level >= 40 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'level-50' THEN IF v_level >= 50 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'level-75' THEN IF v_level >= 75 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'level-100' THEN IF v_level >= 100 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'centurion-badges' THEN SELECT COUNT(*) INTO v_count FROM public.user_badges _c WHERE _c.user_id = p_user_id AND _c.unlocked_at IS NOT NULL; IF v_count >= 100 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'master-roamer' THEN IF v_level >= 50 AND (SELECT COUNT(*) FROM public.user_badges _mr WHERE _mr.user_id = p_user_id AND _mr.unlocked_at IS NOT NULL) >= 50 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'grandmaster' THEN
        IF v_level >= 100 THEN
          SELECT COUNT(*) INTO v_count FROM public.user_badges _gm JOIN public.badges gb ON gb.id = _gm.badge_id WHERE _gm.user_id = p_user_id AND _gm.unlocked_at IS NOT NULL AND gb.is_hidden = FALSE AND gb.is_gift_only = FALSE;
          IF v_count >= (SELECT COUNT(*) FROM public.badges gb2 WHERE gb2.is_hidden = FALSE AND gb2.is_gift_only = FALSE AND gb2.category != 'milestone') THEN v_count := 1; ELSE v_count := 0; END IF;
        ELSE v_count := 0; END IF;
      ELSE CONTINUE;
    END CASE;

    IF v_count > 0 THEN
      INSERT INTO public.user_badges (user_id, badge_id, progress_current, unlocked_at)
      VALUES (p_user_id, v_badge.id, 0, now())
      ON CONFLICT (user_id, badge_id) DO UPDATE SET unlocked_at = COALESCE(public.user_badges.unlocked_at, now());

      SELECT _r2.unlocked_at INTO v_existing_row FROM public.user_badges _r2 WHERE _r2.user_id = p_user_id AND _r2.badge_id = v_badge.id;
      IF v_existing_row.unlocked_at IS NOT NULL THEN
        v_badge_xp_awarded := v_badge_xp_awarded + v_badge.xp_reward; v_new_count := v_new_count + 1;
        INSERT INTO public.notifications (user_id, type, title, body, data)
        VALUES (p_user_id, 'badge_unlocked', v_badge.icon || ' Badge Unlocked: ' || v_badge.name, v_badge.description, jsonb_build_object('badge_slug', v_badge.slug, 'badge_icon', v_badge.icon, 'badge_name', v_badge.name, 'xp_reward', v_badge.xp_reward, 'url', v_profile_url));
        badge_id := v_badge.id; badge_slug := v_badge.slug; badge_name := v_badge.name; badge_description := v_badge.description; badge_icon := v_badge.icon; badge_category := v_badge.category; badge_tier := v_badge.tier; badge_xp_reward := v_badge.xp_reward;
        RETURN NEXT;
      END IF;
    END IF;
  END LOOP;

  IF v_badge_xp_awarded > 0 THEN
    INSERT INTO public.xp_log (user_id, action, xp_awarded, metadata)
    VALUES (p_user_id, 'badge_rewards', v_badge_xp_awarded, jsonb_build_object('badge_count', v_new_count));
    UPDATE public.profiles SET xp_total = xp_total + v_badge_xp_awarded, badge_count = badge_count + v_new_count WHERE id = p_user_id;
  END IF;

  SELECT xp_total, public.calculate_level(xp_total) INTO v_xp_total, v_level FROM public.profiles WHERE id = p_user_id;
  UPDATE public.profiles SET level = v_level WHERE id = p_user_id AND level <> v_level;

  IF v_level > v_prev_level THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (p_user_id, 'level_up', '🎉 Level Up! You''re now Level ' || v_level, 'Keep roaming to earn more badges and XP!', jsonb_build_object('level', v_level, 'rank', '', 'url', v_profile_url));
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.evaluate_badges(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.evaluate_badges(UUID) TO authenticated, service_role;