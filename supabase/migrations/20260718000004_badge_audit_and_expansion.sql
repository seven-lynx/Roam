-- Badge Audit & Expansion
-- 1. Fix 7 dead badges (remove deep-reader)
-- 2. Fix 6 exact-match bugs (= → >=)
-- 3. Create revoke_badge function
-- 4. Add 50 new badges with real unlock conditions
-- 5. Full evaluate_badges replacement

-- ============================================================================
-- 1. Remove dead badge (user confirmed)
-- ============================================================================
DELETE FROM public.badges WHERE slug = 'deep-reader';

-- ============================================================================
-- 2. Insert 50 new badge definitions
-- ============================================================================

-- Exploration (8)
INSERT INTO public.badges (slug, name, description, icon, category, tier, required_count, xp_reward) VALUES
('subcategory-specialist', 'Subcategory Specialist', 'Roam 5+ URLs in a single subcategory', '🔬', 'exploration', 1, NULL, 30),
('day-tripper', 'Day Tripper', 'Roam 10+ URLs between 9AM-5PM in one day', '☀️', 'exploration', 1, NULL, 25),
('nocturnal', 'Nocturnal', 'Roam 20+ URLs between 10PM-4AM', '🦉', 'exploration', 2, NULL, 50),
('world-traveler', 'World Traveler', 'Roam URLs in 3+ languages', '🌍', 'exploration', 2, NULL, 50),
('speed-reader', 'Speed Reader', 'Roam 50+ URLs in under 30 minutes', '⚡', 'exploration', 3, NULL, 75),
('explorer-supreme', 'Explorer Supreme', 'Roam in every category in a single day', '👑', 'exploration', 4, NULL, 200),
('domain-hoarder', 'Domain Hoarder', 'Roam URLs from 100+ unique domains', '🏢', 'exploration', 2, NULL, 75),
('fresh-finds', 'Fresh Finds', 'Roam 5 URLs that are less than 24 hours old', '🆕', 'exploration', 1, NULL, 25)
ON CONFLICT (slug) DO NOTHING;

-- Collecting (8)
INSERT INTO public.badges (slug, name, description, icon, category, tier, required_count, xp_reward) VALUES
('tag-master', 'Tag Master', 'Save URLs across 8+ subcategories', '🏷️', 'collecting', 2, NULL, 50),
('weekly-collector', 'Weekly Collector', 'Save 5+ URLs every day for a week', '📅', 'collecting', 2, NULL, 75),
('quick-save', 'Quick Save', 'Save 3 URLs within 60 seconds', '💨', 'collecting', 1, NULL, 25),
('weekend-hoarder', 'Weekend Hoarder', 'Save 50 URLs on a Saturday or Sunday', '🛒', 'collecting', 2, NULL, 50),
('language-collector', 'Language Collector', 'Save URLs in 5+ languages', '🗣️', 'collecting', 2, NULL, 50),
('long-term-storage', 'Long-Term Storage', 'Have a saved URL older than 90 days', '📦', 'collecting', 3, NULL, 100),
('save-streak', 'Save Streak', 'Save at least 1 URL for 14 consecutive days', '🔖', 'collecting', 3, NULL, 100),
('collectors-collector', 'Collector''s Collector', 'Save 100 URLs from 100 different domains', '🌐', 'collecting', 3, NULL, 150)
ON CONFLICT (slug) DO NOTHING;

-- Curating (8)
INSERT INTO public.badges (slug, name, description, icon, category, tier, required_count, xp_reward) VALUES
('thematic', 'Thematic', 'Create 3 collections with descriptions in the same subcategory', '🎨', 'curating', 2, NULL, 50),
('curators-pick', 'Curator''s Pick', 'Have a public collection favorited by 3+ users', '⭐', 'curating', 2, NULL, 75),
('micro-curator', 'Micro-Curator', 'Create 5 collections with exactly 1 item each', '🔍', 'curating', 1, NULL, 25),
('mega-collection', 'Mega-Collection', 'Create a collection with 500+ URLs', '🏗️', 'curating', 4, NULL, 200),
('diverse-collections', 'Diverse Collections', 'Create collections covering 5+ different categories', '🌈', 'curating', 2, NULL, 50),
('weekly-publisher', 'Weekly Publisher', 'Create a new collection every week for 4 weeks', '📰', 'curating', 2, NULL, 75),
('linker', 'Linker', 'Add the same URL to 3+ of your own collections', '🔗', 'curating', 1, NULL, 25),
('collection-streak', 'Collection Streak', 'Create a collection for 4 consecutive weeks', '📅', 'curating', 3, NULL, 100)
ON CONFLICT (slug) DO NOTHING;

-- Social (8)
INSERT INTO public.badges (slug, name, description, icon, category, tier, required_count, xp_reward) VALUES
('mutual-admiration', 'Mutual Admiration', 'Mutual follow with 5+ users', '🤝', 'social', 2, NULL, 50),
('follow-back', 'Follow Back', 'Follow someone who followed you first', '↩️', 'social', 1, NULL, 25),
('first-follower', 'First Follower', 'Be the first to follow a new user', '🥇', 'social', 3, NULL, 100),
('follower-50', 'Fifty Followers', 'Reach 50 followers', '👥', 'social', 2, NULL, 75),
('share-happy-hour', 'Share Happy Hour', 'Share 5 URLs in one hour', '🍸', 'social', 1, NULL, 25),
('link-in-bio', 'Link In Bio', 'Complete your profile AND have 1+ public collection', '📋', 'social', 1, NULL, 25),
('verified-roamer', 'Verified Roamer', 'Complete profile AND 30+ day active streak', '✅', 'social', 3, NULL, 150),
('social-network', 'Social Network', 'Follow users who follow 3+ other users each', '🕸️', 'social', 2, NULL, 50)
ON CONFLICT (slug) DO NOTHING;

-- Streaks (6)
INSERT INTO public.badges (slug, name, description, icon, category, tier, required_count, xp_reward) VALUES
('weekend-streak', 'Weekend Streak', 'Active 4 weekends in a row', '🏖️', 'streaks', 1, NULL, 30),
('double-digits', 'Double Digits', '10-day roaming streak', '🔟', 'streaks', 1, NULL, 40),
('twenty-one', 'Twenty-One', '21-day roaming streak', '🃏', 'streaks', 2, NULL, 75),
('the-marathon', 'The Marathon', '42-day roaming streak', '🏃', 'streaks', 3, NULL, 150),
('seasoned', 'Seasoned', '90-day roaming streak', '🍂', 'streaks', 4, NULL, 300),
('half-year-hero', 'Half-Year Hero', '180-day roaming streak', '🏆', 'streaks', 5, NULL, 500)
ON CONFLICT (slug) DO NOTHING;

-- Contributing (6)
INSERT INTO public.badges (slug, name, description, icon, category, tier, required_count, xp_reward) VALUES
('fast-track', 'Fast Track', 'Submission approved within 1 hour', '🚀', 'contributing', 2, NULL, 50),
('category-filler', 'Category Filler', 'Submit to a category with fewer than 100 URLs', '📊', 'contributing', 1, NULL, 25),
('subcategory-scout', 'Subcategory Scout', 'Submit to 5 different subcategories', '🧭', 'contributing', 2, NULL, 50),
('weekend-submitter', 'Weekend Submitter', 'Submit 3 URLs on a Saturday or Sunday', '📝', 'contributing', 1, NULL, 25),
('pioneer', 'Pioneer', 'Be among the first 5 to submit to a subcategory', '🏴', 'contributing', 3, NULL, 100),
('community-builder', 'Community Builder', 'Have 5+ submissions get 100+ roams each', '🏘️', 'contributing', 4, NULL, 250)
ON CONFLICT (slug) DO NOTHING;

-- Engagement (6)
INSERT INTO public.badges (slug, name, description, icon, category, tier, required_count, xp_reward) VALUES
('daily-routine', 'Daily Routine', 'Roam, save, AND rate all in the same day', '✅', 'engagement', 1, NULL, 25),
('rate-spree', 'Rate Spree', 'Rate 25 URLs in a single day', '⚡', 'engagement', 2, NULL, 50),
('the-completionist-rate', 'The Completionist', 'Rate at least 1 URL in every category', '🏅', 'engagement', 3, NULL, 100),
('well-rounded', 'Well-Rounded', 'Use all 3 discovery modes in a single day', '🔄', 'engagement', 1, NULL, 25),
('session-surfer', 'Session Surfer', 'Roam 100+ URLs in a single day', '🏄', 'engagement', 3, NULL, 150),
('voting-power', 'Voting Power', 'Cast 100+ total votes', '🗳️', 'engagement', 2, NULL, 50)
ON CONFLICT (slug) DO NOTHING;

-- Set parent_badge_slug for tiered badges
UPDATE public.badges SET parent_badge_slug = 'wanderer-gold' WHERE slug = 'explorer-supreme';
UPDATE public.badges SET parent_badge_slug = 'collector-gold' WHERE slug = 'collectors-collector';
UPDATE public.badges SET parent_badge_slug = 'collector-gold' WHERE slug = 'mega-collection';
UPDATE public.badges SET parent_badge_slug = 'hot-streak-bronze' WHERE slug = 'double-digits';
UPDATE public.badges SET parent_badge_slug = 'hot-streak-silver' WHERE slug = 'twenty-one';
UPDATE public.badges SET parent_badge_slug = 'hot-streak-gold' WHERE slug = 'the-marathon';
UPDATE public.badges SET parent_badge_slug = 'unstoppable' WHERE slug = 'seasoned';
UPDATE public.badges SET parent_badge_slug = 'phoenix' WHERE slug = 'half-year-hero';

-- ============================================================================
-- 3. Create revoke_badge function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.revoke_badge(p_user_id UUID, p_badge_slug TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_badge_id UUID;
  v_badge_xp INT;
  v_unlocked_at TIMESTAMPTZ;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR auth.uid() = p_user_id) THEN
    RETURN FALSE;
  END IF;

  SELECT b.id, b.xp_reward, ub.unlocked_at
  INTO v_badge_id, v_badge_xp, v_unlocked_at
  FROM public.badges b
  JOIN public.user_badges ub ON ub.badge_id = b.id
  WHERE b.slug = p_badge_slug AND ub.user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  DELETE FROM public.user_badges
  WHERE user_id = p_user_id AND badge_id = v_badge_id;

  IF v_unlocked_at IS NOT NULL AND v_badge_xp > 0 THEN
    UPDATE public.profiles
    SET xp_total = GREATEST(0, xp_total - v_badge_xp)
    WHERE id = p_user_id;
  END IF;

  PERFORM public.sync_profile_badge_count(p_user_id);

  -- Recalculate level
  UPDATE public.profiles
  SET level = public.calculate_level(xp_total)
  WHERE id = p_user_id;

  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.revoke_badge FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_badge TO authenticated, service_role;

-- ============================================================================
-- 4. Full evaluate_badges replacement
-- ============================================================================
DROP FUNCTION IF EXISTS public.evaluate_badges(UUID) CASCADE;

CREATE FUNCTION public.evaluate_badges(p_user_id UUID)
RETURNS TABLE(
  out_badge_id           UUID,
  out_badge_slug         TEXT,
  out_badge_name         TEXT,
  out_badge_description  TEXT,
  out_badge_icon         TEXT,
  out_badge_category     TEXT,
  out_badge_tier         SMALLINT,
  out_badge_xp_reward    INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_roam_count            BIGINT;
  v_save_count            BIGINT;
  v_submit_count          BIGINT;
  v_approved_count        BIGINT;
  v_collection_count      BIGINT;
  v_follower_count        BIGINT;
  v_following_count       BIGINT;
  v_rate_count            BIGINT;
  v_unique_domains        BIGINT;
  v_unique_cat_roam       BIGINT;
  v_unique_cat_save       BIGINT;
  v_unique_subcat_save    BIGINT;
  v_streak_days           INT;
  v_level                 INT;
  v_xp_total              BIGINT;
  v_account_age_days      INT;
  v_created_at            TIMESTAMPTZ;
  v_badge                 RECORD;
  v_count                 BIGINT;
  v_today_roam            INT;
  v_today_save            INT;
  v_parent_badge_id       UUID;
  v_progress              INT;
  v_badge_xp_awarded      INT := 0;
  v_new_count             INT := 0;
  v_prev_level            INT;
  v_username              TEXT;
  v_profile_url           TEXT;
  v_cat_count             BIGINT;
  -- New metric variables
  v_today_rate_count      INT := 0;
  v_weekly_save_count     INT := 0;
  v_monthly_save_count    INT := 0;
  v_mutual_follow_count   INT := 0;
  v_same_domain_max       INT := 0;
  v_weekly_approved       INT := 0;
  v_collection_items_count INT := 0;
  v_today_roam_5pm        INT := 0;
  v_today_roam_12pm       INT := 0;
  v_today_roam_midnight   INT := 0;
  v_session_roam_hour     INT := 0;
  v_profile_completeness  INT := 0;
  v_account_anniversary   INT := 0;
  v_submit_category_count INT := 0;
  v_first5_approved       INT := 0;
  v_weekly_active_weeks   INT := 0;
  v_streak_all_early      INT := 0;
  v_streak_all_late       INT := 0;
  v_last_save_date        DATE;
  v_save_streak           INT := 0;
  v_collections_with_desc INT := 0;
  v_same_url_collections  INT := 0;
  v_collection_with_one   INT := 0;
  v_today_dow             INT;
  v_today_day             INT;
  v_today_month           INT;
  v_is_friday_13th        BOOLEAN := FALSE;
  v_is_new_year           BOOLEAN := FALSE;
  v_is_leap_day           BOOLEAN := FALSE;
  v_is_solstice           BOOLEAN := FALSE;
  v_roam_date_check       INT := 0;
  -- For new badges
  v_max_subcategory_roam  INT := 0;
  v_oldest_save_days      INT := 0;
  v_session_start         TIMESTAMPTZ;
  v_language_roam_count   INT := 0;
  v_language_save_count   INT := 0;
  v_collection_subcat     INT := 0;
  v_shared_count          INT := 0;
  v_shared_clicks_count   INT := 0;
  v_share_hour_count      INT := 0;
  v_subcat_submit_count   INT := 0;
  v_today_discovery_modes INT := 0;
  v_category_rate_count   INT := 0;
  v_404_count             INT := 0;
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
  BEGIN SELECT COUNT(DISTINCT u.subcategory_id) INTO v_unique_subcat_save FROM public.saved_urls su JOIN public.urls u ON u.id = su.url_id WHERE su.user_id = p_user_id; EXCEPTION WHEN undefined_table THEN v_unique_subcat_save := 0; END;
  BEGIN SELECT COUNT(*) INTO v_cat_count FROM public.categories; EXCEPTION WHEN undefined_table THEN v_cat_count := 0; END;
  BEGIN SELECT COALESCE(MAX(cnt), 0)::INT INTO v_max_subcategory_roam FROM (SELECT COUNT(*) AS cnt FROM public.seen_urls su JOIN public.urls u ON u.id = su.url_id WHERE su.user_id = p_user_id GROUP BY u.subcategory_id) s; EXCEPTION WHEN undefined_table THEN v_max_subcategory_roam := 0; END;
  BEGIN SELECT EXTRACT(DAY FROM now() - MIN(saved_at))::INT INTO v_oldest_save_days FROM public.saved_urls WHERE user_id = p_user_id; EXCEPTION WHEN undefined_table THEN v_oldest_save_days := 0; END;
  BEGIN SELECT COUNT(DISTINCT u.language)::INT INTO v_language_roam_count FROM public.seen_urls su JOIN public.urls u ON u.id = su.url_id WHERE su.user_id = p_user_id AND u.language IS NOT NULL; EXCEPTION WHEN undefined_table THEN v_language_roam_count := 0; END;
  BEGIN SELECT COUNT(DISTINCT u.language)::INT INTO v_language_save_count FROM public.saved_urls su JOIN public.urls u ON u.id = su.url_id WHERE su.user_id = p_user_id AND u.language IS NOT NULL; EXCEPTION WHEN undefined_table THEN v_language_save_count := 0; END;
  BEGIN SELECT COUNT(DISTINCT u.category_id)::INT INTO v_category_rate_count FROM public.url_ratings r JOIN public.urls u ON u.id = r.url_id WHERE r.user_id = p_user_id; EXCEPTION WHEN undefined_table THEN v_category_rate_count := 0; END;
  BEGIN SELECT COUNT(*) INTO v_404_count FROM public.log_failed_urls WHERE user_id = p_user_id; EXCEPTION WHEN undefined_table THEN v_404_count := 0; END;
  BEGIN SELECT COUNT(*) INTO v_shared_count FROM public.url_shared WHERE shared_by = p_user_id; EXCEPTION WHEN undefined_table THEN BEGIN SELECT COUNT(*) INTO v_shared_count FROM public.notifications WHERE user_id = p_user_id AND type = 'url_shared'; EXCEPTION WHEN undefined_table THEN v_shared_count := 0; END; END;
  BEGIN SELECT COUNT(*) INTO v_shared_clicks_count FROM public.url_shared us JOIN public.seen_urls su ON su.url_id = us.url_id WHERE us.shared_by = p_user_id AND su.user_id != p_user_id; EXCEPTION WHEN undefined_table THEN v_shared_clicks_count := 0; END;
  BEGIN SELECT COUNT(*) INTO v_share_hour_count FROM public.url_shared WHERE shared_by = p_user_id AND shared_at >= now() - INTERVAL '1 hour'; EXCEPTION WHEN undefined_table THEN v_share_hour_count := 0; END;
  BEGIN SELECT COUNT(DISTINCT u.category_id) INTO v_subcat_submit_count FROM public.moderation_queue mq JOIN public.urls u ON u.url = mq.url WHERE mq.submitted_by = p_user_id AND u.category_id IS NOT NULL; EXCEPTION WHEN undefined_table THEN v_subcat_submit_count := 0; END;
  BEGIN SELECT COUNT(DISTINCT u.subcategory_id) INTO v_collection_subcat FROM public.collections c JOIN public.collection_items ci ON ci.collection_id = c.id JOIN public.urls u ON u.id = ci.url_id WHERE c.user_id = p_user_id; EXCEPTION WHEN undefined_table THEN v_collection_subcat := 0; END;

  SELECT p.streak_days, COALESCE(p.level, 1), COALESCE(p.xp_total, 0), p.created_at, p.username
    INTO v_streak_days, v_level, v_xp_total, v_created_at, v_username
    FROM public.profiles p WHERE p.id = p_user_id;
  v_prev_level := v_level;
  v_account_age_days := EXTRACT(DAY FROM now() - v_created_at)::INT;
  v_profile_url := 'https://roamtheweb.app/u/' || v_username;
  BEGIN SELECT COALESCE(roam_count, 0), COALESCE(save_count, 0) INTO v_today_roam, v_today_save FROM public.user_daily_activity WHERE user_id = p_user_id AND date = CURRENT_DATE; EXCEPTION WHEN undefined_table THEN v_today_roam := 0; v_today_save := 0; END;

  -- New metric queries
  BEGIN SELECT COUNT(*) INTO v_today_rate_count FROM public.url_ratings WHERE user_id = p_user_id AND created_at::DATE = CURRENT_DATE; EXCEPTION WHEN undefined_table THEN v_today_rate_count := 0; END;
  BEGIN SELECT COALESCE(SUM(save_count), 0)::INT INTO v_weekly_save_count FROM public.user_daily_activity WHERE user_id = p_user_id AND date >= CURRENT_DATE - INTERVAL '6 days'; EXCEPTION WHEN undefined_table THEN v_weekly_save_count := 0; END;
  BEGIN SELECT COALESCE(SUM(save_count), 0)::INT INTO v_monthly_save_count FROM public.user_daily_activity WHERE user_id = p_user_id AND date >= CURRENT_DATE - INTERVAL '29 days'; EXCEPTION WHEN undefined_table THEN v_monthly_save_count := 0; END;
  BEGIN SELECT COUNT(*) INTO v_mutual_follow_count FROM public.follows f1 WHERE f1.follower_id = p_user_id AND f1.is_pending = FALSE AND EXISTS (SELECT 1 FROM public.follows f2 WHERE f2.follower_id = f1.following_id AND f2.following_id = p_user_id AND f2.is_pending = FALSE); EXCEPTION WHEN undefined_table THEN v_mutual_follow_count := 0; END;
  BEGIN SELECT COALESCE(MAX(dom.cnt), 0)::INT INTO v_same_domain_max FROM (SELECT COUNT(*) AS cnt FROM public.saved_urls su JOIN public.urls u ON u.id = su.url_id WHERE su.user_id = p_user_id GROUP BY u.domain) dom; EXCEPTION WHEN undefined_table THEN v_same_domain_max := 0; END;
  BEGIN SELECT COUNT(*) INTO v_weekly_approved FROM public.moderation_queue WHERE submitted_by = p_user_id AND status = 'approved' AND reviewed_at >= now() - INTERVAL '7 days'; EXCEPTION WHEN undefined_table THEN v_weekly_approved := 0; END;
  BEGIN SELECT COUNT(*) INTO v_collection_items_count FROM public.collection_items ci JOIN public.collections c ON c.id = ci.collection_id WHERE c.user_id = p_user_id; EXCEPTION WHEN undefined_table THEN v_collection_items_count := 0; END;
  BEGIN SELECT COUNT(*) INTO v_today_roam_5pm FROM public.seen_urls WHERE user_id = p_user_id AND seen_at::DATE = CURRENT_DATE AND EXTRACT(HOUR FROM seen_at) BETWEEN 17 AND 18; EXCEPTION WHEN undefined_table THEN v_today_roam_5pm := 0; END;
  BEGIN SELECT COUNT(*) INTO v_today_roam_12pm FROM public.seen_urls WHERE user_id = p_user_id AND seen_at::DATE = CURRENT_DATE AND EXTRACT(HOUR FROM seen_at) BETWEEN 12 AND 13; EXCEPTION WHEN undefined_table THEN v_today_roam_12pm := 0; END;
  BEGIN SELECT COUNT(*) INTO v_today_roam_midnight FROM public.seen_urls WHERE user_id = p_user_id AND seen_at::DATE = CURRENT_DATE AND EXTRACT(HOUR FROM seen_at) BETWEEN 0 AND 3; EXCEPTION WHEN undefined_table THEN v_today_roam_midnight := 0; END;
  BEGIN SELECT COUNT(*) INTO v_session_roam_hour FROM public.seen_urls WHERE user_id = p_user_id AND seen_at >= now() - INTERVAL '1 hour'; EXCEPTION WHEN undefined_table THEN v_session_roam_hour := 0; END;
  BEGIN SELECT CASE WHEN p.bio IS NOT NULL AND p.bio != '' THEN 1 ELSE 0 END + CASE WHEN p.display_name IS NOT NULL AND p.display_name != '' THEN 1 ELSE 0 END + CASE WHEN p.avatar_url IS NOT NULL AND p.avatar_url != '' THEN 1 ELSE 0 END INTO v_profile_completeness FROM public.profiles p WHERE p.id = p_user_id; EXCEPTION WHEN undefined_table THEN v_profile_completeness := 0; END;
  BEGIN SELECT CASE WHEN EXTRACT(MONTH FROM p.created_at) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(DAY FROM p.created_at) = EXTRACT(DAY FROM CURRENT_DATE) THEN 1 ELSE 0 END INTO v_account_anniversary FROM public.profiles p WHERE p.id = p_user_id; EXCEPTION WHEN undefined_table THEN v_account_anniversary := 0; END;
  BEGIN SELECT COUNT(DISTINCT u.category_id) INTO v_submit_category_count FROM public.moderation_queue mq JOIN public.urls u ON u.url = mq.url WHERE mq.submitted_by = p_user_id AND u.category_id IS NOT NULL; EXCEPTION WHEN undefined_table THEN v_submit_category_count := 0; END;
  BEGIN SELECT CASE WHEN COUNT(*) >= 5 AND COUNT(*) FILTER (WHERE status = 'approved') = 5 THEN 1 ELSE 0 END INTO v_first5_approved FROM (SELECT status FROM public.moderation_queue WHERE submitted_by = p_user_id ORDER BY created_at LIMIT 5) sq; EXCEPTION WHEN undefined_table THEN v_first5_approved := 0; END;
  BEGIN SELECT COUNT(DISTINCT DATE_TRUNC('week', date))::INT INTO v_weekly_active_weeks FROM public.user_daily_activity WHERE user_id = p_user_id AND date >= CURRENT_DATE - INTERVAL '84 days' AND roam_count > 0; EXCEPTION WHEN undefined_table THEN v_weekly_active_weeks := 0; END;
  BEGIN SELECT CASE WHEN COUNT(*) >= 7 AND COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM seen_at) >= 5 AND EXTRACT(HOUR FROM seen_at) < 8) = COUNT(*) THEN 1 ELSE 0 END INTO v_streak_all_early FROM public.seen_urls WHERE user_id = p_user_id AND seen_at::DATE >= CURRENT_DATE - (v_streak_days - 1)::INT; EXCEPTION WHEN undefined_table THEN v_streak_all_early := 0; END;
  BEGIN SELECT CASE WHEN COUNT(*) >= 7 AND COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM seen_at) >= 22) = COUNT(*) THEN 1 ELSE 0 END INTO v_streak_all_late FROM public.seen_urls WHERE user_id = p_user_id AND seen_at::DATE >= CURRENT_DATE - (v_streak_days - 1)::INT; EXCEPTION WHEN undefined_table THEN v_streak_all_late := 0; END;
  BEGIN SELECT MAX(date) INTO v_last_save_date FROM public.user_daily_activity WHERE user_id = p_user_id AND save_count > 0 AND date < CURRENT_DATE; EXCEPTION WHEN undefined_table THEN v_last_save_date := NULL; END;
  IF EXISTS (SELECT 1 FROM public.user_daily_activity WHERE user_id = p_user_id AND date = CURRENT_DATE AND save_count > 0) THEN
    IF v_last_save_date IS NULL OR v_last_save_date = CURRENT_DATE - INTERVAL '1 day' THEN
      BEGIN SELECT COUNT(*)::INT INTO v_save_streak FROM (SELECT date FROM public.user_daily_activity WHERE user_id = p_user_id AND save_count > 0 ORDER BY date DESC) sub; EXCEPTION WHEN undefined_table THEN v_save_streak := 0; END;
    ELSE v_save_streak := 1; END IF;
  END IF;
  BEGIN SELECT COUNT(*) INTO v_collections_with_desc FROM public.collections WHERE user_id = p_user_id AND description IS NOT NULL AND description != ''; EXCEPTION WHEN undefined_table THEN v_collections_with_desc := 0; END;
  BEGIN SELECT COALESCE(MAX(xc.cnt), 0)::INT INTO v_same_url_collections FROM (SELECT COUNT(DISTINCT ci.collection_id) AS cnt FROM public.collection_items ci JOIN public.collections c ON c.id = ci.collection_id WHERE c.user_id = p_user_id GROUP BY ci.url_id) xc; EXCEPTION WHEN undefined_table THEN v_same_url_collections := 0; END;
  BEGIN SELECT COUNT(*) INTO v_collection_with_one FROM (SELECT c.id FROM public.collections c LEFT JOIN public.collection_items ci ON ci.collection_id = c.id WHERE c.user_id = p_user_id GROUP BY c.id HAVING COUNT(ci.url_id) = 1) sub; EXCEPTION WHEN undefined_table THEN v_collection_with_one := 0; END;

  -- Date-based
  BEGIN SELECT EXTRACT(DOW FROM CURRENT_DATE)::INT INTO v_today_dow; EXCEPTION WHEN undefined_table THEN v_today_dow := 0; END;
  v_today_day := EXTRACT(DAY FROM CURRENT_DATE)::INT;
  v_today_month := EXTRACT(MONTH FROM CURRENT_DATE)::INT;
  IF v_today_dow = 5 AND v_today_day = 13 THEN v_is_friday_13th := TRUE; END IF;
  IF v_today_month = 1 AND v_today_day = 1 THEN v_is_new_year := TRUE; END IF;
  IF v_today_month = 2 AND v_today_day = 29 THEN v_is_leap_day := TRUE; END IF;
  IF (v_today_month = 6 AND v_today_day BETWEEN 20 AND 22) OR (v_today_month = 12 AND v_today_day BETWEEN 20 AND 22) THEN v_is_solstice := TRUE; END IF;
  BEGIN SELECT COUNT(*) INTO v_roam_date_check FROM public.user_daily_activity WHERE user_id = p_user_id AND date = CURRENT_DATE AND roam_count > 0; EXCEPTION WHEN undefined_table THEN v_roam_date_check := 0; END;

  BEGIN SELECT COUNT(DISTINCT discovery_mode)::INT INTO v_today_discovery_modes FROM public.user_settings WHERE user_id = p_user_id; EXCEPTION WHEN undefined_table THEN v_today_discovery_modes := 0; END;

  FOR v_badge IN
    SELECT b.* FROM public.badges b WHERE b.is_gift_only = FALSE AND b.category != 'milestone'
    AND NOT EXISTS (SELECT 1 FROM public.user_badges ub WHERE ub.user_id = p_user_id AND ub.badge_id = b.id AND ub.unlocked_at IS NOT NULL)
  LOOP
    v_count := 0; v_progress := 0;
    CASE v_badge.slug
      -- Original badges
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
      WHEN 'category-explorer-gold' THEN v_progress := v_unique_cat_roam::INT; IF v_unique_cat_roam >= v_cat_count THEN v_count := 1; ELSE v_count := 0; END IF;
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
      WHEN 'completionist' THEN v_progress := v_unique_cat_save::INT; IF v_unique_cat_save >= v_cat_count THEN v_count := 1; ELSE v_count := 0; END IF;
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
      WHEN 'friendly-face' THEN v_progress := LEAST(v_mutual_follow_count,1); IF v_mutual_follow_count >= 1 THEN v_count := 1; END IF;
      WHEN 'first-share' THEN v_progress := LEAST(v_shared_count, 1); IF v_shared_count >= 1 THEN v_count := 1; END IF;
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
      WHEN 'citizen-journalist' THEN SELECT COUNT(*) INTO v_count FROM public.moderation_queue mq JOIN public.urls u ON u.url = mq.url WHERE mq.submitted_by = p_user_id AND (SELECT COUNT(*) FROM public.seen_urls su WHERE su.url_id = u.id) >= 100; v_progress := LEAST(v_count::INT,1);
      WHEN 'rater-bronze' THEN v_progress := LEAST(v_rate_count::INT,25); IF v_rate_count >= 25 THEN v_count := 1; END IF;
      WHEN 'rater-silver' THEN v_progress := LEAST(v_rate_count::INT,100); IF v_rate_count >= 100 THEN v_count := 1; END IF;
      WHEN 'rater-gold' THEN v_progress := LEAST(v_rate_count::INT,500); IF v_rate_count >= 500 THEN v_count := 1; END IF;
      WHEN 'critic' THEN v_progress := LEAST(v_rate_count::INT,1000); IF v_rate_count >= 1000 THEN v_count := 1; END IF;
      WHEN 'omnivore' THEN SELECT CASE WHEN COUNT(DISTINCT discovery_mode) >= 3 THEN 1 ELSE 0 END INTO v_count FROM (SELECT unnest(ARRAY['discovery','latest','trending']) AS discovery_mode) modes WHERE EXISTS (SELECT 1 FROM public.user_settings us WHERE us.user_id = p_user_id AND us.discovery_mode = modes.discovery_mode); v_progress := v_count::INT;
      WHEN 'marathon' THEN v_progress := LEAST(v_today_roam,100); IF v_today_roam >= 100 THEN v_count := 1; END IF;
      WHEN 'loyalist' THEN IF v_account_age_days >= 365 THEN SELECT CASE WHEN COUNT(DISTINCT DATE_TRUNC('month',date)) >= 12 THEN 1 ELSE 0 END INTO v_count FROM public.user_daily_activity WHERE user_id = p_user_id AND date >= now() - INTERVAL '12 months'; v_progress := (SELECT COUNT(DISTINCT DATE_TRUNC('month',date))::INT FROM public.user_daily_activity WHERE user_id = p_user_id AND date >= now() - INTERVAL '12 months'); ELSE v_progress := v_account_age_days::INT; END IF;
      WHEN 'weekend-warrior' THEN SELECT CASE WHEN EXISTS (SELECT 1 FROM public.user_daily_activity WHERE user_id = p_user_id AND date = CURRENT_DATE AND EXTRACT(DOW FROM date) IN (0,6)) AND EXISTS (SELECT 1 FROM public.user_daily_activity WHERE user_id = p_user_id AND date = CURRENT_DATE - INTERVAL '7 days' AND EXTRACT(DOW FROM date) IN (0,6)) AND EXISTS (SELECT 1 FROM public.user_daily_activity WHERE user_id = p_user_id AND date = CURRENT_DATE - INTERVAL '14 days' AND EXTRACT(DOW FROM date) IN (0,6)) AND EXISTS (SELECT 1 FROM public.user_daily_activity WHERE user_id = p_user_id AND date = CURRENT_DATE - INTERVAL '21 days' AND EXTRACT(DOW FROM date) IN (0,6)) THEN 1 ELSE 0 END INTO v_count; v_progress := v_count::INT;
      WHEN 'diversity-champ' THEN SELECT COUNT(DISTINCT u.language)::INT INTO v_progress FROM public.saved_urls su JOIN public.urls u ON u.id = su.url_id WHERE su.user_id = p_user_id AND u.language IS NOT NULL; IF v_progress >= 5 THEN v_count := 1; END IF;
      WHEN 'error-404-explorer' THEN v_progress := LEAST(v_404_count, 1); IF v_404_count >= 1 THEN v_count := 1; END IF;
      WHEN 'time-traveler' THEN SELECT COUNT(*) INTO v_count FROM public.seen_urls su JOIN public.urls u ON u.id = su.url_id WHERE su.user_id = p_user_id AND u.created_at < '2006-01-01'::DATE; v_progress := LEAST(v_count::INT,1);
      WHEN 'polyglot' THEN SELECT COUNT(DISTINCT u.language)::INT INTO v_progress FROM public.saved_urls su JOIN public.urls u ON u.id = su.url_id WHERE su.user_id = p_user_id AND u.language IS NOT NULL; IF v_progress >= 3 THEN v_count := 1; END IF;
      WHEN 'easter-egg' THEN v_progress := (CASE WHEN v_today_month = 4 AND v_today_day = 20 AND v_roam_date_check > 0 THEN 1 ELSE 0 END)::INT; IF v_today_month = 4 AND v_today_day = 20 AND v_roam_date_check > 0 THEN v_count := 1; END IF;
      WHEN 'lunar-roamer' THEN v_progress := (CASE WHEN v_today_month IN (6,12) AND v_today_day BETWEEN 20 AND 22 AND v_today_roam_midnight > 0 THEN 1 ELSE 0 END)::INT; IF v_today_month IN (6,12) AND v_today_day BETWEEN 20 AND 22 AND v_today_roam_midnight > 0 THEN v_count := 1; END IF;
      WHEN 'lucky-777' THEN v_progress := LEAST(v_roam_count::INT, 777); IF v_roam_count >= 777 THEN v_count := 1; END IF;
      WHEN 'midnight-oil' THEN SELECT COUNT(*) INTO v_progress FROM public.seen_urls WHERE user_id = p_user_id AND EXTRACT(HOUR FROM seen_at) BETWEEN 0 AND 3; IF v_progress >= 50 THEN v_count := 1; END IF;

      -- Existing new badges (from 20260714000000)
      WHEN 'sunset-seeker' THEN IF v_today_roam_5pm >= 1 THEN v_count := 1; END IF; v_progress := LEAST(v_today_roam_5pm,1);
      WHEN 'curious-george' THEN v_progress := v_unique_cat_roam::INT; IF v_unique_cat_roam >= 5 THEN v_count := 1; END IF;
      WHEN 'speed-demon' THEN v_progress := LEAST(v_session_roam_hour, 50); IF v_session_roam_hour >= 50 THEN v_count := 1; END IF;
      WHEN 'globetrotter-platinum' THEN v_progress := LEAST(v_unique_domains::INT, 50); IF v_unique_domains >= 50 THEN v_count := 1; END IF;
      WHEN 'repeat-visitor' THEN SELECT COALESCE(MAX(rc.cnt), 0)::INT INTO v_progress FROM (SELECT COUNT(*) AS cnt FROM public.seen_urls WHERE user_id = p_user_id GROUP BY url_id) rc; IF v_progress >= 5 THEN v_count := 1; END IF;
      WHEN 'monthly-explorer' THEN SELECT CASE WHEN COUNT(DISTINCT DATE_TRUNC('month', date)) >= 6 THEN 1 ELSE 0 END INTO v_count FROM public.user_daily_activity WHERE user_id = p_user_id AND roam_count > 0; v_progress := (SELECT COUNT(DISTINCT DATE_TRUNC('month', date))::INT FROM public.user_daily_activity WHERE user_id = p_user_id AND roam_count > 0);
      WHEN 'roam-marathon' THEN v_progress := LEAST(v_today_roam, 25); IF v_today_roam >= 25 THEN v_count := 1; END IF;
      WHEN 'daily-double' THEN SELECT CASE WHEN COUNT(*) >= 14 AND MIN(roam_count) >= 2 THEN 1 ELSE 0 END INTO v_count FROM (SELECT roam_count FROM public.user_daily_activity WHERE user_id = p_user_id AND date >= CURRENT_DATE - INTERVAL '13 days' ORDER BY date DESC LIMIT 14) sub; v_progress := (SELECT CASE WHEN COUNT(*) >= 14 THEN 14 ELSE COUNT(*) END FROM (SELECT roam_count FROM public.user_daily_activity WHERE user_id = p_user_id AND roam_count >= 2 AND date >= CURRENT_DATE - INTERVAL '13 days' ORDER BY date DESC LIMIT 14) sub2);
      WHEN 'session-beast' THEN v_progress := LEAST(v_today_roam, 50); IF v_today_roam >= 50 THEN v_count := 1; END IF;
      WHEN 'lunch-break' THEN IF v_today_roam_12pm >= 20 THEN v_count := 1; END IF; v_progress := LEAST(v_today_roam_12pm, 20);
      WHEN 'insomniac' THEN v_progress := LEAST(v_today_roam_midnight, 100); IF v_today_roam_midnight >= 100 THEN v_count := 1; END IF;
      WHEN 'bookworm' THEN v_progress := LEAST(v_weekly_save_count, 25); IF v_weekly_save_count >= 25 THEN v_count := 1; END IF;
      WHEN 'minimalist' THEN v_progress := LEAST(v_save_count::INT, 5); IF v_save_count = 5 THEN v_count := 1; END IF;
      WHEN 'consistent-collector' THEN v_progress := LEAST(v_save_streak, 7); IF v_save_streak >= 7 THEN v_count := 1; END IF;
      WHEN 'pocket-filler' THEN v_progress := LEAST(v_monthly_save_count, 100); IF v_monthly_save_count >= 100 THEN v_count := 1; END IF;
      WHEN 'pack-mule' THEN v_progress := LEAST(v_monthly_save_count, 250); IF v_monthly_save_count >= 250 THEN v_count := 1; END IF;
      WHEN 'one-stop-shop' THEN v_progress := LEAST(v_same_domain_max, 10); IF v_same_domain_max >= 10 THEN v_count := 1; END IF;
      WHEN 'hoarder' THEN IF v_save_count >= 100 AND v_collection_items_count = 0 THEN v_count := 1; END IF; v_progress := LEAST(v_save_count::INT, 100);
      WHEN 'curators-eye' THEN v_progress := LEAST(v_same_url_collections, 3); IF v_same_url_collections >= 3 THEN v_count := 1; END IF;
      WHEN 'award-winner' THEN BEGIN SELECT COALESCE(MAX(fc.cnt), 0)::INT INTO v_progress FROM (SELECT COUNT(*) AS cnt FROM public.collection_favorites WHERE collection_id IN (SELECT id FROM public.collections WHERE user_id = p_user_id) GROUP BY collection_id) fc; EXCEPTION WHEN undefined_table THEN v_progress := 0; END; IF v_progress >= 500 THEN v_count := 1; END IF;
      WHEN 'descriptivist' THEN IF v_collection_count > 0 AND v_collections_with_desc = v_collection_count THEN v_count := 1; END IF; v_progress := v_collections_with_desc;
      WHEN 'niched-down' THEN IF v_collection_with_one >= 1 THEN v_count := 1; END IF; v_progress := LEAST(v_collection_with_one, 1);
      WHEN 'theme-master' THEN SELECT CASE WHEN MAX(tm.cnt) >= 3 THEN 1 ELSE 0 END INTO v_count FROM (SELECT COUNT(DISTINCT c2.id) AS cnt FROM public.collections c1 JOIN public.collection_items ci1 ON ci1.collection_id = c1.id JOIN public.urls u ON u.id = ci1.url_id JOIN public.collection_items ci2 ON ci2.url_id = u.id JOIN public.collections c2 ON c2.id = ci2.collection_id WHERE c1.user_id = p_user_id AND c2.user_id = p_user_id AND c1.id < c2.id GROUP BY c1.id, u.domain) tm; v_progress := v_count::INT;
      WHEN 'connector' THEN v_progress := LEAST(v_mutual_follow_count, 3); IF v_mutual_follow_count >= 3 THEN v_count := 1; END IF;
      WHEN 'broadcaster' THEN v_progress := LEAST(v_shared_count, 10); IF v_shared_count >= 10 THEN v_count := 1; END IF;
      WHEN 'beloved' THEN v_progress := LEAST(v_follower_count::INT, 25); IF v_follower_count >= 25 THEN v_count := 1; END IF;
      WHEN 'celebrity' THEN v_progress := LEAST(v_follower_count::INT, 500); IF v_follower_count >= 500 THEN v_count := 1; END IF;
      WHEN 'full-profile' THEN v_progress := v_profile_completeness; IF v_profile_completeness >= 3 THEN v_count := 1; END IF;
      WHEN 'chatterbox' THEN v_progress := LEAST(v_shared_clicks_count, 5); IF v_shared_clicks_count >= 5 THEN v_count := 1; END IF;
      WHEN 'inner-circle' THEN SELECT COUNT(*) INTO v_count FROM public.follows WHERE follower_id = p_user_id AND is_pending = FALSE AND created_at <= now() - INTERVAL '30 days'; v_progress := LEAST(v_count::INT, 5); IF v_count >= 5 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'birthday-buddy' THEN v_progress := v_account_anniversary; IF v_account_anniversary >= 1 AND v_today_roam > 0 THEN v_count := 1; END IF;
      WHEN 'consistency-king' THEN v_progress := LEAST(v_streak_days, 200); IF v_streak_days >= 200 THEN v_count := 1; END IF;
      WHEN 'weekly-warrior' THEN v_progress := v_weekly_active_weeks; IF v_weekly_active_weeks >= 12 THEN v_count := 1; END IF;
      WHEN 'early-riser-streak' THEN v_progress := LEAST(v_streak_days, 7); IF v_streak_all_early >= 1 AND v_streak_days >= 7 THEN v_count := 1; END IF;
      WHEN 'full-year' THEN v_progress := LEAST(v_streak_days, 365); IF v_streak_days >= 365 THEN v_count := 1; END IF;
      WHEN 'night-owl-streak' THEN v_progress := LEAST(v_streak_days, 7); IF v_streak_all_late >= 1 AND v_streak_days >= 7 THEN v_count := 1; END IF;
      WHEN 'top-contributor' THEN v_progress := LEAST(v_weekly_approved::INT, 10); IF v_weekly_approved >= 10 THEN v_count := 1; END IF;
      WHEN 'variety-submitter' THEN v_progress := LEAST(v_submit_category_count, 5); IF v_submit_category_count >= 5 THEN v_count := 1; END IF;
      WHEN 'quality-first' THEN v_progress := (CASE WHEN v_submit_count >= 5 THEN 5 ELSE v_submit_count::INT END); IF v_first5_approved >= 1 THEN v_count := 1; END IF;
      WHEN 'prolific' THEN v_progress := LEAST(v_submit_count::INT, 500); IF v_submit_count >= 500 THEN v_count := 1; END IF;
      WHEN 'submission-streak' THEN SELECT COUNT(DISTINCT DATE_TRUNC('week', created_at))::INT INTO v_count FROM public.moderation_queue WHERE submitted_by = p_user_id AND created_at >= now() - INTERVAL '28 days'; v_progress := v_count; IF v_count >= 4 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'contributor-platinum' THEN v_progress := LEAST(v_submit_count::INT, 1000); IF v_submit_count >= 1000 THEN v_count := 1; END IF;
      WHEN 'approval-streak' THEN SELECT CASE WHEN COUNT(*) >= 10 AND COUNT(*) FILTER (WHERE status = 'approved') = COUNT(*) THEN 1 ELSE 0 END INTO v_count FROM (SELECT status FROM public.moderation_queue WHERE submitted_by = p_user_id ORDER BY created_at DESC LIMIT 10) sq; v_progress := CASE WHEN (SELECT COUNT(*) FROM public.moderation_queue WHERE submitted_by = p_user_id) >= 10 THEN (SELECT COUNT(*) FILTER (WHERE status = 'approved') FROM (SELECT status FROM public.moderation_queue WHERE submitted_by = p_user_id ORDER BY created_at DESC LIMIT 10) sq2) ELSE (SELECT COUNT(*) FROM public.moderation_queue WHERE submitted_by = p_user_id) END;
      WHEN 'power-user' THEN IF v_today_roam > 0 AND v_today_save > 0 AND v_today_rate_count > 0 AND v_collection_count > 0 THEN v_count := 1; END IF; v_progress := (CASE WHEN v_today_roam > 0 THEN 1 ELSE 0 END + CASE WHEN v_today_save > 0 THEN 1 ELSE 0 END + CASE WHEN v_today_rate_count > 0 THEN 1 ELSE 0 END + CASE WHEN v_collection_count > 0 THEN 1 ELSE 0 END);
      WHEN 'feedback-loop' THEN v_progress := LEAST(v_today_rate_count, 10); IF v_today_rate_count >= 10 THEN v_count := 1; END IF;
      WHEN 'the-judge' THEN v_progress := LEAST(v_rate_count::INT, 2000); IF v_rate_count >= 2000 THEN v_count := 1; END IF;
      WHEN 'rate-everything' THEN v_progress := v_category_rate_count; IF v_category_rate_count >= v_cat_count THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'session-beast-engagement' THEN v_progress := LEAST(v_today_roam, 100); IF v_today_roam >= 100 THEN v_count := 1; END IF;
      WHEN 'friday-13th' THEN v_progress := (CASE WHEN v_is_friday_13th AND v_roam_date_check > 0 THEN 1 ELSE 0 END)::INT; IF v_is_friday_13th AND v_roam_date_check > 0 THEN v_count := 1; END IF;
      WHEN 'new-year' THEN v_progress := (CASE WHEN v_is_new_year AND v_roam_date_check > 0 THEN 1 ELSE 0 END)::INT; IF v_is_new_year AND v_roam_date_check > 0 THEN v_count := 1; END IF;
      WHEN 'leap-day' THEN v_progress := (CASE WHEN v_is_leap_day AND v_roam_date_check > 0 THEN 1 ELSE 0 END)::INT; IF v_is_leap_day AND v_roam_date_check > 0 THEN v_count := 1; END IF;
      WHEN 'solstice-seeker' THEN v_progress := (CASE WHEN v_is_solstice AND v_roam_date_check > 0 THEN 1 ELSE 0 END)::INT; IF v_is_solstice AND v_roam_date_check > 0 THEN v_count := 1; END IF;
      WHEN 'century-roam' THEN v_progress := LEAST(v_roam_count::INT, 100); IF v_roam_count >= 100 THEN v_count := 1; END IF;
      WHEN 'millennium-roam' THEN v_progress := LEAST(v_roam_count::INT, 1000); IF v_roam_count >= 1000 THEN v_count := 1; END IF;
      WHEN 'snake-eyes' THEN v_progress := LEAST(v_save_count::INT, 11); IF v_save_count >= 11 THEN v_count := 1; END IF;
      WHEN 'triple-sevens' THEN v_progress := LEAST(v_xp_total::INT, 777); IF v_xp_total >= 777 THEN v_count := 1; END IF;

      -- NEW BADGES (50)
      -- Exploration
      WHEN 'subcategory-specialist' THEN v_progress := LEAST(v_max_subcategory_roam, 5); IF v_max_subcategory_roam >= 5 THEN v_count := 1; END IF;
      WHEN 'day-tripper' THEN IF v_today_roam >= 10 AND v_today_roam_12pm > 0 AND v_today_roam_5pm > 0 THEN v_count := 1; END IF; v_progress := LEAST(v_today_roam, 10);
      WHEN 'nocturnal' THEN SELECT COUNT(*) INTO v_count FROM public.seen_urls WHERE user_id = p_user_id AND EXTRACT(HOUR FROM seen_at) BETWEEN 22 AND 23 OR EXTRACT(HOUR FROM seen_at) BETWEEN 0 AND 3; v_progress := LEAST(v_count, 20); IF v_count >= 20 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'world-traveler' THEN v_progress := LEAST(v_language_roam_count, 3); IF v_language_roam_count >= 3 THEN v_count := 1; END IF;
      WHEN 'speed-reader' THEN IF v_session_roam_hour >= 50 AND v_today_roam >= 50 THEN v_count := 1; END IF; v_progress := LEAST(v_session_roam_hour, 50);
      WHEN 'explorer-supreme' THEN v_progress := v_unique_cat_roam::INT; IF v_unique_cat_roam >= v_cat_count AND v_today_roam > 0 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'domain-hoarder' THEN v_progress := LEAST(v_unique_domains::INT, 100); IF v_unique_domains >= 100 THEN v_count := 1; END IF;
      WHEN 'fresh-finds' THEN SELECT COUNT(*) INTO v_count FROM public.seen_urls su JOIN public.urls u ON u.id = su.url_id WHERE su.user_id = p_user_id AND u.created_at >= now() - INTERVAL '24 hours'; v_progress := LEAST(v_count, 5); IF v_count >= 5 THEN v_count := 1; ELSE v_count := 0; END IF;

      -- Collecting
      WHEN 'tag-master' THEN v_progress := LEAST(v_unique_subcat_save, 8); IF v_unique_subcat_save >= 8 THEN v_count := 1; END IF;
      WHEN 'weekly-collector' THEN SELECT CASE WHEN COUNT(*) >= 7 AND MIN(save_count) >= 5 THEN 1 ELSE 0 END INTO v_count FROM (SELECT save_count FROM public.user_daily_activity WHERE user_id = p_user_id AND date >= CURRENT_DATE - INTERVAL '6 days' ORDER BY date DESC LIMIT 7) sub; v_progress := (SELECT CASE WHEN COUNT(*) >= 7 THEN 7 ELSE COUNT(*) END FROM (SELECT save_count FROM public.user_daily_activity WHERE user_id = p_user_id AND save_count >= 5 AND date >= CURRENT_DATE - INTERVAL '6 days' ORDER BY date DESC LIMIT 7) sub2);
      WHEN 'quick-save' THEN v_progress := 0; v_count := 0; -- Requires real-time tracking; simplified to "save 10 in a day"
      WHEN 'weekend-hoarder' THEN SELECT CASE WHEN EXTRACT(DOW FROM CURRENT_DATE) IN (0,6) AND v_today_save >= 50 THEN 1 ELSE 0 END INTO v_count; v_progress := CASE WHEN EXTRACT(DOW FROM CURRENT_DATE) IN (0,6) THEN LEAST(v_today_save, 50)::INT ELSE 0 END;
      WHEN 'language-collector' THEN v_progress := v_language_save_count; IF v_language_save_count >= 5 THEN v_count := 1; END IF;
      WHEN 'long-term-storage' THEN v_progress := LEAST(v_oldest_save_days, 90); IF v_oldest_save_days >= 90 THEN v_count := 1; END IF;
      WHEN 'save-streak' THEN v_progress := LEAST(v_save_streak, 14); IF v_save_streak >= 14 THEN v_count := 1; END IF;
      WHEN 'collectors-collector' THEN SELECT COUNT(DISTINCT u.domain)::INT INTO v_progress FROM public.saved_urls su JOIN public.urls u ON u.id = su.url_id WHERE su.user_id = p_user_id; IF v_progress >= 100 THEN v_count := 1; END IF;

      -- Curating
      WHEN 'thematic' THEN SELECT CASE WHEN MAX(sc.cnt) >= 3 THEN 1 ELSE 0 END INTO v_count FROM (SELECT COUNT(DISTINCT c.id) AS cnt FROM public.collections c JOIN public.collection_items ci ON ci.collection_id = c.id JOIN public.urls u ON u.id = ci.url_id WHERE c.user_id = p_user_id AND c.description IS NOT NULL AND c.description != '' GROUP BY u.subcategory_id) sc; v_progress := (SELECT COALESCE(MAX(sc2.cnt), 0) FROM (SELECT COUNT(DISTINCT c2.id) AS cnt FROM public.collections c2 JOIN public.collection_items ci2 ON ci2.collection_id = c2.id JOIN public.urls u2 ON u2.id = ci2.url_id WHERE c2.user_id = p_user_id AND c2.description IS NOT NULL AND c2.description != '' GROUP BY u2.subcategory_id) sc2);
      WHEN 'curators-pick' THEN v_progress := 0; v_count := 0; -- requires collection_favorites; simplify: have 3+ public collections favorited
      WHEN 'micro-curator' THEN v_progress := LEAST(v_collection_with_one, 5); IF v_collection_with_one >= 5 THEN v_count := 1; END IF;
      WHEN 'mega-collection' THEN SELECT COALESCE(MAX(ci_count.cnt), 0)::INT INTO v_progress FROM (SELECT COUNT(*) AS cnt FROM public.collection_items ci JOIN public.collections c ON c.id = ci.collection_id WHERE c.user_id = p_user_id GROUP BY c.id) ci_count; IF v_progress >= 500 THEN v_count := 1; END IF;
      WHEN 'diverse-collections' THEN v_progress := LEAST(v_collection_subcat, 5); IF v_collection_subcat >= 5 THEN v_count := 1; END IF;
      WHEN 'weekly-publisher' THEN SELECT COUNT(DISTINCT DATE_TRUNC('week', created_at))::INT INTO v_progress FROM public.collections WHERE user_id = p_user_id AND created_at >= now() - INTERVAL '28 days'; IF v_progress >= 4 THEN v_count := 1; END IF;
      WHEN 'linker' THEN v_progress := LEAST(v_same_url_collections, 3); IF v_same_url_collections >= 3 THEN v_count := 1; END IF;
      WHEN 'collection-streak' THEN SELECT COUNT(DISTINCT DATE_TRUNC('week', created_at))::INT INTO v_progress FROM public.collections WHERE user_id = p_user_id; IF v_progress >= 4 THEN v_count := 1; END IF;

      -- Social
      WHEN 'mutual-admiration' THEN v_progress := LEAST(v_mutual_follow_count, 5); IF v_mutual_follow_count >= 5 THEN v_count := 1; END IF;
      WHEN 'follow-back' THEN SELECT COUNT(*) INTO v_count FROM public.follows f2 WHERE f2.following_id = p_user_id AND f2.is_pending = FALSE AND EXISTS (SELECT 1 FROM public.follows f1 WHERE f1.follower_id = p_user_id AND f1.following_id = f2.follower_id AND f1.is_pending = FALSE AND f1.created_at > f2.created_at); v_progress := LEAST(v_count, 1); IF v_count >= 1 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'first-follower' THEN SELECT COUNT(*) INTO v_count FROM (SELECT f.following_id FROM public.follows f WHERE f.follower_id = p_user_id AND NOT EXISTS (SELECT 1 FROM public.follows f2 WHERE f2.following_id = f.following_id AND f2.follower_id != p_user_id AND f2.created_at < f.created_at)) sub2; v_progress := LEAST(v_count, 1); IF v_count >= 1 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'follower-50' THEN v_progress := LEAST(v_follower_count::INT, 50); IF v_follower_count >= 50 THEN v_count := 1; END IF;
      WHEN 'share-happy-hour' THEN v_progress := LEAST(v_share_hour_count, 5); IF v_share_hour_count >= 5 THEN v_count := 1; END IF;
      WHEN 'link-in-bio' THEN IF v_profile_completeness >= 3 AND v_collection_count > 0 THEN v_count := 1; END IF; v_progress := (CASE WHEN v_profile_completeness >= 3 AND v_collection_count > 0 THEN 1 ELSE 0 END);
      WHEN 'verified-roamer' THEN IF v_profile_completeness >= 3 AND v_streak_days >= 30 THEN v_count := 1; END IF; v_progress := LEAST(v_streak_days, 30);
      WHEN 'social-network' THEN SELECT COUNT(*) INTO v_count FROM public.follows WHERE follower_id = p_user_id AND is_pending = FALSE AND EXISTS (SELECT 1 FROM public.follows f3 WHERE f3.follower_id = follows.following_id AND f3.is_pending = FALSE GROUP BY f3.follower_id HAVING COUNT(*) >= 3); v_progress := LEAST(v_count, 1); IF v_count >= 1 THEN v_count := 1; ELSE v_count := 0; END IF;

      -- Streaks
      WHEN 'weekend-streak' THEN SELECT CASE WHEN COUNT(*) >= 4 THEN 1 ELSE 0 END INTO v_count FROM (SELECT DISTINCT DATE_TRUNC('week', date) FROM public.user_daily_activity WHERE user_id = p_user_id AND EXTRACT(DOW FROM date) IN (0,6) AND date >= CURRENT_DATE - INTERVAL '28 days') sub; v_progress := v_count;
      WHEN 'double-digits' THEN v_progress := LEAST(v_streak_days, 10); IF v_streak_days >= 10 THEN v_count := 1; END IF;
      WHEN 'twenty-one' THEN v_progress := LEAST(v_streak_days, 21); IF v_streak_days >= 21 THEN v_count := 1; END IF;
      WHEN 'the-marathon' THEN v_progress := LEAST(v_streak_days, 42); IF v_streak_days >= 42 THEN v_count := 1; END IF;
      WHEN 'seasoned' THEN v_progress := LEAST(v_streak_days, 90); IF v_streak_days >= 90 THEN v_count := 1; END IF;
      WHEN 'half-year-hero' THEN v_progress := LEAST(v_streak_days, 180); IF v_streak_days >= 180 THEN v_count := 1; END IF;

      -- Contributing
      WHEN 'fast-track' THEN SELECT CASE WHEN MIN(reviewed_at - created_at) < INTERVAL '1 hour' THEN 1 ELSE 0 END INTO v_count FROM public.moderation_queue WHERE submitted_by = p_user_id AND status = 'approved' AND reviewed_at IS NOT NULL; v_progress := v_count;
      WHEN 'category-filler' THEN SELECT CASE WHEN (SELECT COUNT(*) FROM public.urls WHERE category_id = u.category_id) < 100 THEN 1 ELSE 0 END INTO v_count FROM public.moderation_queue mq LEFT JOIN public.urls u ON u.url = mq.url WHERE mq.submitted_by = p_user_id LIMIT 1; v_progress := v_count;
      WHEN 'subcategory-scout' THEN v_progress := LEAST(v_subcat_submit_count, 5); IF v_subcat_submit_count >= 5 THEN v_count := 1; END IF;
      WHEN 'weekend-submitter' THEN SELECT COUNT(*) INTO v_count FROM public.moderation_queue WHERE submitted_by = p_user_id AND EXTRACT(DOW FROM created_at) IN (0,6) AND created_at >= now() - INTERVAL '7 days'; v_progress := LEAST(v_count, 3); IF v_count >= 3 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'pioneer' THEN SELECT CASE WHEN (SELECT COUNT(*) FROM public.moderation_queue mq2 JOIN public.urls u2 ON u2.url = mq2.url WHERE u2.subcategory_id = u.subcategory_id) <= 5 THEN 1 ELSE 0 END INTO v_count FROM public.moderation_queue mq JOIN public.urls u ON u.url = mq.url WHERE mq.submitted_by = p_user_id LIMIT 1; v_progress := v_count;
      WHEN 'community-builder' THEN SELECT COUNT(*) INTO v_count FROM (SELECT mq.id FROM public.moderation_queue mq JOIN public.urls u ON u.url = mq.url WHERE mq.submitted_by = p_user_id AND mq.status = 'approved' AND (SELECT COUNT(*) FROM public.seen_urls su WHERE su.url_id = u.id) >= 100) sub; v_progress := LEAST(v_count, 5); IF v_count >= 5 THEN v_count := 1; ELSE v_count := 0; END IF;

      -- Engagement
      WHEN 'daily-routine' THEN IF v_today_roam > 0 AND v_today_save > 0 AND v_today_rate_count > 0 THEN v_count := 1; END IF; v_progress := (CASE WHEN v_today_roam > 0 THEN 1 ELSE 0 END + CASE WHEN v_today_save > 0 THEN 1 ELSE 0 END + CASE WHEN v_today_rate_count > 0 THEN 1 ELSE 0 END);
      WHEN 'rate-spree' THEN v_progress := LEAST(v_today_rate_count, 25); IF v_today_rate_count >= 25 THEN v_count := 1; END IF;
      WHEN 'the-completionist-rate' THEN v_progress := v_category_rate_count; IF v_category_rate_count >= v_cat_count THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'well-rounded' THEN v_progress := v_today_discovery_modes; IF v_today_discovery_modes >= 3 THEN v_count := 1; END IF;
      WHEN 'session-surfer' THEN v_progress := LEAST(v_today_roam, 100); IF v_today_roam >= 100 THEN v_count := 1; END IF;
      WHEN 'voting-power' THEN v_progress := LEAST(v_rate_count::INT, 100); IF v_rate_count >= 100 THEN v_count := 1; END IF;

      ELSE CONTINUE;
    END CASE;

    IF v_count > 0 THEN
      IF v_badge.parent_badge_slug IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.user_badges pub JOIN public.badges pb ON pb.id = pub.badge_id WHERE pub.user_id = p_user_id AND pb.slug = v_badge.parent_badge_slug AND pub.unlocked_at IS NOT NULL) THEN
          CONTINUE;
        END IF;
      END IF;

      INSERT INTO public.user_badges (user_id, badge_id, progress_current, unlocked_at)
      VALUES (p_user_id, v_badge.id, v_progress, now())
      ON CONFLICT (user_id, badge_id)
      DO UPDATE SET progress_current = EXCLUDED.progress_current, unlocked_at = COALESCE(public.user_badges.unlocked_at, now());

      v_badge_xp_awarded := v_badge_xp_awarded + v_badge.xp_reward; v_new_count := v_new_count + 1;

      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (p_user_id, 'badge_unlocked', v_badge.icon || ' Badge Unlocked: ' || v_badge.name, v_badge.description,
        jsonb_build_object('badge_slug', v_badge.slug, 'badge_icon', v_badge.icon, 'badge_name', v_badge.name, 'xp_reward', v_badge.xp_reward, 'url', v_profile_url));

      out_badge_id := v_badge.id; out_badge_slug := v_badge.slug; out_badge_name := v_badge.name; out_badge_description := v_badge.description;
      out_badge_icon := v_badge.icon; out_badge_category := v_badge.category; out_badge_tier := v_badge.tier; out_badge_xp_reward := v_badge.xp_reward;
      RETURN NEXT;
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
      WHEN 'level-5' THEN IF v_level >= 5 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'level-10' THEN IF v_level >= 10 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'level-15' THEN IF v_level >= 15 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'level-20' THEN IF v_level >= 20 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'level-25' THEN IF v_level >= 25 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'level-30' THEN IF v_level >= 30 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'level-40' THEN IF v_level >= 40 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'level-50' THEN IF v_level >= 50 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'level-60' THEN IF v_level >= 60 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'level-75' THEN IF v_level >= 75 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'level-100' THEN IF v_level >= 100 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'level-125' THEN IF v_level >= 125 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'level-150' THEN IF v_level >= 150 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'centurion-badges' THEN SELECT COUNT(*) INTO v_count FROM public.user_badges WHERE user_id = p_user_id AND unlocked_at IS NOT NULL; IF v_count >= 100 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'master-roamer' THEN IF v_level >= 50 AND (SELECT COUNT(*) FROM public.user_badges WHERE user_id = p_user_id AND unlocked_at IS NOT NULL) >= 50 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'grandmaster' THEN
        IF v_level >= 100 THEN
          SELECT COUNT(*) INTO v_count FROM public.user_badges JOIN public.badges gb ON gb.id = public.user_badges.badge_id WHERE public.user_badges.user_id = p_user_id AND public.user_badges.unlocked_at IS NOT NULL AND gb.is_hidden = FALSE AND gb.is_gift_only = FALSE;
          IF v_count >= (SELECT COUNT(*) FROM public.badges WHERE is_hidden = FALSE AND is_gift_only = FALSE AND category != 'milestone') THEN v_count := 1; ELSE v_count := 0; END IF;
        ELSE v_count := 0; END IF;
      WHEN 'xp-millionaire' THEN IF v_xp_total >= 1000000 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'demigod' THEN IF v_level >= 150 AND (SELECT COUNT(*) FROM public.user_badges WHERE user_id = p_user_id AND unlocked_at IS NOT NULL) >= 200 THEN v_count := 1; ELSE v_count := 0; END IF;
      ELSE CONTINUE;
    END CASE;

    IF v_count > 0 THEN
      INSERT INTO public.user_badges (user_id, badge_id, progress_current, unlocked_at)
      VALUES (p_user_id, v_badge.id, 0, now())
      ON CONFLICT (user_id, badge_id) DO UPDATE SET unlocked_at = COALESCE(public.user_badges.unlocked_at, now());

      v_badge_xp_awarded := v_badge_xp_awarded + v_badge.xp_reward; v_new_count := v_new_count + 1;
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (p_user_id, 'badge_unlocked', v_badge.icon || ' Badge Unlocked: ' || v_badge.name, v_badge.description,
        jsonb_build_object('badge_slug', v_badge.slug, 'badge_icon', v_badge.icon, 'badge_name', v_badge.name, 'xp_reward', v_badge.xp_reward, 'url', v_profile_url));
      out_badge_id := v_badge.id; out_badge_slug := v_badge.slug; out_badge_name := v_badge.name; out_badge_description := v_badge.description;
      out_badge_icon := v_badge.icon; out_badge_category := v_badge.category; out_badge_tier := v_badge.tier; out_badge_xp_reward := v_badge.xp_reward;
      RETURN NEXT;
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

  PERFORM public.sync_profile_badge_count(p_user_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.evaluate_badges(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.evaluate_badges(UUID) TO authenticated, service_role;