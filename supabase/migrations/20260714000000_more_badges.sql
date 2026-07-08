-- ============================================================================
-- Badge Expansion: ~75 new badges across all categories
-- Adds new badge definitions and updates evaluate_badges() with new logic
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. New Badge Definitions
-- ---------------------------------------------------------------------------

-- Exploration (11 new)
INSERT INTO public.badges (slug, name, description, icon, category, tier, required_count, xp_reward) VALUES
  ('sunset-seeker', 'Sunset Seeker', 'Roam during sunset hours (5 PM - 7 PM)', '🌇', 'exploration', 1, NULL, 30),
  ('curious-george', 'Curious George', 'Roam in 5 different categories in a single day', '🐵', 'exploration', 1, NULL, 50),
  ('speed-demon', 'Speed Demon', 'Roam 50 times within a single hour', '⚡', 'exploration', 2, NULL, 75),
  ('globetrotter-platinum', 'Globetrotter Supreme', 'Discover URLs from 50 unique domains', '🌐', 'exploration', 4, 50, 200),
  ('repeat-visitor', 'Repeat Visitor', 'Re-visit the same URL 5 times', '🔁', 'exploration', 1, NULL, 30),
  ('monthly-explorer', 'Monthly Explorer', 'Roam at least once every calendar month for 6 months', '📅', 'exploration', 2, NULL, 100),
  ('roam-marathon', 'Half Marathon', 'Roam 25 times in a single day', '🏃', 'exploration', 1, NULL, 60),
  ('daily-double', 'Daily Double', 'Roam 2+ times every day for 14 straight days', '🔄', 'exploration', 2, NULL, 150),
  ('session-beast', 'Session Beast', 'Roam 50 times in one continuous session', '💪', 'exploration', 2, NULL, 100),
  ('lunch-break', 'Lunch Break', 'Roam 20 times between 12 PM and 2 PM', '🍽️', 'exploration', 1, NULL, 40),
  ('insomniac', 'Insomniac', 'Roam 100 times between midnight and 4 AM', '🌙', 'exploration', 2, NULL, 150)
ON CONFLICT DO NOTHING;

-- Collecting (7 new)
INSERT INTO public.badges (slug, name, description, icon, category, tier, required_count, xp_reward) VALUES
  ('bookworm', 'Bookworm', 'Save 25 URLs in a single week', '📚', 'collecting', 2, NULL, 100),
  ('minimalist', 'Minimalist', 'Save exactly 5 URLs total', '⚖️', 'collecting', 1, NULL, 40),
  ('consistent-collector', 'Consistent Collector', 'Save at least one URL on 7 consecutive days', '🔖', 'collecting', 2, NULL, 100),
  ('pocket-filler', 'Pocket Filler', 'Save 100 URLs in a single month', '💼', 'collecting', 3, NULL, 200),
  ('pack-mule', 'Pack Mule', 'Save 250 URLs in a single month', '🎒', 'collecting', 3, NULL, 350),
  ('one-stop-shop', 'One-Stop Shop', 'Save 10 URLs all from the same domain', '🏪', 'collecting', 1, NULL, 40),
  ('hoarder', 'Hoarder', 'Save 100+ URLs without adding any to a collection', '🗃️', 'collecting', 2, NULL, 100)
ON CONFLICT DO NOTHING;

-- Curating (5 new)
INSERT INTO public.badges (slug, name, description, icon, category, tier, required_count, xp_reward) VALUES
  ('curators-eye', 'Curator''s Eye', 'Add the same URL to 3 different collections', '🎯', 'curating', 1, NULL, 50),
  ('award-winner', 'Award Winner', 'Have a collection favorited 500 times', '🏆', 'curating', 4, 500, 500),
  ('descriptivist', 'Descriptivist', 'All your collections have descriptions', '📝', 'curating', 1, NULL, 35),
  ('niched-down', 'Niched Down', 'Create a collection with exactly 1 curated URL', '🔬', 'curating', 1, NULL, 25),
  ('theme-master', 'Theme Master', 'Have 3 collections that share at least one URL domain', '🎨', 'curating', 2, NULL, 75)
ON CONFLICT DO NOTHING;

-- Social (8 new)
INSERT INTO public.badges (slug, name, description, icon, category, tier, required_count, xp_reward) VALUES
  ('connector', 'Connector', 'Have 3+ mutual follows (you both follow each other)', '👥', 'social', 1, 3, 40),
  ('broadcaster', 'Broadcaster', 'Share 10 different URLs', '📢', 'social', 1, 10, 50),
  ('beloved', 'Beloved', 'Gain 25 followers', '❤️', 'social', 1, 25, 50),
  ('celebrity', 'Celebrity', 'Gain 500 followers', '👑', 'social', 3, 500, 250),
  ('full-profile', 'Full Profile', 'Complete your bio, display name, and avatar profile fields', '📋', 'social', 1, NULL, 75),
  ('chatterbox', 'Chatterbox', 'Your shared URLs get clicked 500 times total', '💬', 'social', 3, 500, 200),
  ('inner-circle', 'Inner Circle', 'Follow the same 5+ people for 30 days', '🧑‍🤝‍🧑', 'social', 2, NULL, 100),
  ('birthday-buddy', 'Birthday Buddy', 'Roam on your account anniversary', '🎂', 'social', 1, NULL, 30)
ON CONFLICT DO NOTHING;

-- Streaks (5 new)
INSERT INTO public.badges (slug, name, description, icon, category, tier, required_count, xp_reward) VALUES
  ('consistency-king', 'Consistency King', '200-day roaming streak', '🔥', 'streaks', 4, 200, 750),
  ('weekly-warrior', 'Weekly Warrior', 'Roam at least once per week for 12 consecutive weeks', '📅', 'streaks', 2, NULL, 150),
  ('early-riser-streak', 'Early Riser Streak', '7-day streak where every roam is before 8 AM', '🌅', 'streaks', 2, NULL, 100),
  ('full-year', '365', 'A full year roaming streak', '📆', 'streaks', 5, 365, 2000),
  ('night-owl-streak', 'Night Owl Streak', '7-day streak where every roam is after 10 PM', '🦉', 'streaks', 2, NULL, 100)
ON CONFLICT DO NOTHING;

-- Contributing (7 new)
INSERT INTO public.badges (slug, name, description, icon, category, tier, required_count, xp_reward) VALUES
  ('top-contributor', 'Top Contributor', '10+ approved submissions in a single week', '🏅', 'contributing', 2, NULL, 150),
  ('variety-submitter', 'Variety Submitter', 'Submit URLs in 5+ different categories', '🧭', 'contributing', 1, 5, 50),
  ('quality-first', 'Quality First', 'Your first 5 submissions were all approved', '💎', 'contributing', 2, NULL, 100),
  ('prolific', 'Prolific', 'Submit 500 URLs', '📦', 'contributing', 4, 500, 400),
  ('submission-streak', 'Submission Streak', 'Submit at least 1 URL per week for 4 weeks', '📊', 'contributing', 1, NULL, 100),
  ('contributor-platinum', 'Contributor Supreme', 'Submit 1000 URLs', '📝', 'contributing', 4, 1000, 500),
  ('approval-streak', 'Approval Streak', 'Have 10 consecutive submissions approved', '✅', 'contributing', 2, NULL, 150)
ON CONFLICT DO NOTHING;

-- Engagement (6 new)
INSERT INTO public.badges (slug, name, description, icon, category, tier, required_count, xp_reward) VALUES
  ('power-user', 'Power User', 'Roam, save, rate, share, and create a collection all in one day', '⚡', 'engagement', 2, NULL, 100),
  ('feedback-loop', 'Feedback Loop', 'Rate 10 URLs in a single day', '📝', 'engagement', 1, NULL, 40),
  ('the-judge', 'The Judge', 'Rate 2,000 URLs', '⚖️', 'engagement', 4, 2000, 400),
  ('rate-everything', 'Rate Everything', 'Rate URLs in every available category', '🎯', 'engagement', 2, NULL, 100),
  ('session-beast-engagement', 'Sprint Master', 'Roam 100 times in a single day', '🏃', 'engagement', 2, NULL, 200),
  ('deep-reader', 'Deep Reader', 'Spend 5+ minutes reading a single page', '📖', 'engagement', 1, NULL, 30)
ON CONFLICT DO NOTHING;

-- Secret (8 new)
INSERT INTO public.badges (slug, name, description, icon, category, tier, required_count, xp_reward, is_hidden) VALUES
  ('friday-13th', 'Friday the 13th', 'Roam on Friday the 13th', '🎃', 'secret', 1, NULL, 50, true),
  ('new-year', 'New Year Roamer', 'Roam on January 1st', '🎆', 'secret', 1, NULL, 50, true),
  ('leap-day', 'Leap Day Explorer', 'Roam on February 29th', '🗓️', 'secret', 2, NULL, 100, true),
  ('solstice-seeker', 'Solstice Seeker', 'Roam on summer or winter solstice', '☀️', 'secret', 2, NULL, 100, true),
  ('century-roam', 'Century Roam', 'Roam your 100th time', '💯', 'secret', 1, NULL, 50, true),
  ('millennium-roam', 'Millennium Roam', 'Roam your 1,000th time', '🏆', 'secret', 3, NULL, 200, true),
  ('snake-eyes', 'Snake Eyes', 'Save your 11th URL', '🎲', 'secret', 1, NULL, 30, true),
  ('triple-sevens', 'Triple Sevens', 'Earn exactly 777 XP total', '🍀', 'secret', 2, NULL, 100, true)
ON CONFLICT DO NOTHING;

-- Milestone (8 new)
INSERT INTO public.badges (slug, name, description, icon, category, tier, required_count, xp_reward) VALUES
  ('level-5', 'Level 5', 'Reach level 5', '⬆️', 'milestone', 0, 5, 25),
  ('level-15', 'Level 15', 'Reach level 15', '⬆️', 'milestone', 0, 15, 50),
  ('level-25', 'Level 25', 'Reach level 25', '⬆️', 'milestone', 0, 25, 75),
  ('level-60', 'Level 60', 'Reach level 60', '⬆️', 'milestone', 0, 60, 200),
  ('level-125', 'Level 125', 'Reach level 125', '⬆️', 'milestone', 0, 125, 500),
  ('level-150', 'Level 150', 'Reach level 150', '⬆️', 'milestone', 0, 150, 750),
  ('xp-millionaire', 'XP Millionaire', 'Accumulate 1,000,000 XP', '💰', 'milestone', 4, 1000000, 1000),
  ('demigod', 'Demigod', 'Reach level 150 + earn 200 badges', '🌌', 'milestone', 5, NULL, 5000)
ON CONFLICT DO NOTHING;

-- Gift (6 new)
INSERT INTO public.badges (slug, name, description, icon, category, tier, required_count, xp_reward, is_gift_only) VALUES
  ('top-gun', 'Top Gun', 'Ranked #1 on the weekly leaderboard', '🔝', 'gift', 0, NULL, 500, true),
  ('spotlight', 'Spotlight', 'Featured in the Roam newsletter or blog', '🗞️', 'gift', 0, NULL, 300, true),
  ('ambassador', 'Ambassador', 'Referred 5+ active users to Roam', '📣', 'gift', 0, NULL, 400, true),
  ('roam-scholar', 'Roam Scholar', 'Wrote a tutorial or guide about Roam', '📖', 'gift', 0, NULL, 500, true),
  ('record-breaker', 'Record Breaker', 'Broke a platform record', '🥇', 'gift', 0, NULL, 1000, true),
  ('roam-royalty', 'Roam Royalty', 'Exceptional community member recognized by the Roam team', '👑', 'gift', 0, NULL, 2000, true)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Update tier/chain relationships (parent_badge_slug)
-- ---------------------------------------------------------------------------

-- Globetrotter chain: add platinum tier
UPDATE public.badges SET parent_badge_slug = 'globetrotter-gold' WHERE slug = 'globetrotter-platinum';

-- Favorited chain: add award-winner tier
UPDATE public.badges SET parent_badge_slug = 'favorited-gold' WHERE slug = 'award-winner';

-- Streaks chain: add consistency-king and full-year
UPDATE public.badges SET parent_badge_slug = 'phoenix' WHERE slug = 'consistency-king';
UPDATE public.badges SET parent_badge_slug = 'consistency-king' WHERE slug = 'full-year';

-- Collector chain: add contributor-platinum
UPDATE public.badges SET parent_badge_slug = 'contributor-gold' WHERE slug = 'contributor-platinum';

-- Rater chain: add the-judge
UPDATE public.badges SET parent_badge_slug = 'critic' WHERE slug = 'the-judge';

-- Influencer chain: add beloved and celebrity
UPDATE public.badges SET parent_badge_slug = 'influencer-bronze' WHERE slug = 'beloved';
UPDATE public.badges SET parent_badge_slug = 'influencer-gold' WHERE slug = 'celebrity';

-- ---------------------------------------------------------------------------
-- 3. Updated evaluate_badges() with new badge evaluation logic
-- ---------------------------------------------------------------------------

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
  -- New variables for new badges
  v_today_rate_count INT; v_weekly_save_count INT; v_monthly_save_count INT;
  v_mutual_follow_count INT; v_same_domain_max INT; v_weekly_approved INT;
  v_collection_items_count INT; v_today_roam_5pm INT; v_today_roam_12pm INT;
  v_today_roam_midnight INT; v_profile_completeness INT;
  v_account_anniversary INT; v_submit_category_count INT;
  v_first5_approved INT; v_weekly_active_weeks INT;
  v_streak_all_early INT; v_streak_all_late INT;
  v_save_streak INT; v_last_save_date DATE;
  v_session_roam_hour INT; v_yesterday_roam INT;
  v_collections_with_desc INT; v_total_collections_with_desc INT;
  v_same_url_collections INT; v_cat_count BIGINT;
  v_roam_date_check INT; v_today_dow INT; v_today_day INT; v_today_month INT;
  v_is_friday_13th BOOLEAN := FALSE; v_is_new_year BOOLEAN := FALSE;
  v_is_leap_day BOOLEAN := FALSE; v_is_solstice BOOLEAN := FALSE;
  v_collection_with_one INT;
BEGIN
  -- Core counts
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

  -- New metric queries
  -- Today's rate count
  SELECT COUNT(*) INTO v_today_rate_count FROM public.url_ratings WHERE user_id = p_user_id AND created_at::DATE = CURRENT_DATE;

  -- Weekly saves (last 7 days)
  SELECT COALESCE(SUM(save_count), 0)::INT INTO v_weekly_save_count FROM public.user_daily_activity WHERE user_id = p_user_id AND date >= CURRENT_DATE - INTERVAL '6 days';

  -- Monthly saves (last 30 days)
  SELECT COALESCE(SUM(save_count), 0)::INT INTO v_monthly_save_count FROM public.user_daily_activity WHERE user_id = p_user_id AND date >= CURRENT_DATE - INTERVAL '29 days';

  -- Mutual follows
  SELECT COUNT(*) INTO v_mutual_follow_count FROM public.follows f1 WHERE f1.follower_id = p_user_id AND f1.is_pending = FALSE AND EXISTS (SELECT 1 FROM public.follows f2 WHERE f2.follower_id = f1.following_id AND f2.following_id = p_user_id AND f2.is_pending = FALSE);

  -- Max saves from a single domain
  SELECT COALESCE(MAX(dom.cnt), 0)::INT INTO v_same_domain_max FROM (SELECT COUNT(*) AS cnt FROM public.saved_urls su JOIN public.urls u ON u.id = su.url_id WHERE su.user_id = p_user_id GROUP BY u.domain) dom;

  -- Weekly approved submissions
  SELECT COUNT(*) INTO v_weekly_approved FROM public.moderation_queue WHERE submitted_by = p_user_id AND status = 'approved' AND reviewed_at >= now() - INTERVAL '7 days';

  -- Collection items count
  SELECT COUNT(*) INTO v_collection_items_count FROM public.collection_items ci JOIN public.collections c ON c.id = ci.collection_id WHERE c.user_id = p_user_id;

  -- Time-window roams (today)
  SELECT COUNT(*) INTO v_today_roam_5pm FROM public.seen_urls WHERE user_id = p_user_id AND seen_at::DATE = CURRENT_DATE AND EXTRACT(HOUR FROM seen_at) BETWEEN 17 AND 18;
  SELECT COUNT(*) INTO v_today_roam_12pm FROM public.seen_urls WHERE user_id = p_user_id AND seen_at::DATE = CURRENT_DATE AND EXTRACT(HOUR FROM seen_at) BETWEEN 12 AND 13;
  SELECT COUNT(*) INTO v_today_roam_midnight FROM public.seen_urls WHERE user_id = p_user_id AND seen_at::DATE = CURRENT_DATE AND EXTRACT(HOUR FROM seen_at) BETWEEN 0 AND 3;

  -- Roams in the last hour (session burst)
  SELECT COUNT(*) INTO v_session_roam_hour FROM public.seen_urls WHERE user_id = p_user_id AND seen_at >= now() - INTERVAL '1 hour';

  -- Profile completeness (bio + display_name + avatar)
  SELECT CASE WHEN p.bio IS NOT NULL AND p.bio != '' THEN 1 ELSE 0 END + CASE WHEN p.display_name IS NOT NULL AND p.display_name != '' THEN 1 ELSE 0 END + CASE WHEN p.avatar_url IS NOT NULL AND p.avatar_url != '' THEN 1 ELSE 0 END INTO v_profile_completeness FROM public.profiles p WHERE p.id = p_user_id;

  -- Account anniversary check
  SELECT CASE WHEN EXTRACT(MONTH FROM p.created_at) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(DAY FROM p.created_at) = EXTRACT(DAY FROM CURRENT_DATE) THEN 1 ELSE 0 END INTO v_account_anniversary FROM public.profiles p WHERE p.id = p_user_id;

  -- Submit category diversity
  SELECT COUNT(DISTINCT u.category_id) INTO v_submit_category_count FROM public.moderation_queue mq JOIN public.urls u ON u.url = mq.url WHERE mq.submitted_by = p_user_id AND u.category_id IS NOT NULL;

  -- First 5 submissions all approved
  SELECT CASE WHEN COUNT(*) >= 5 AND COUNT(*) FILTER (WHERE status = 'approved') = 5 THEN 1 ELSE 0 END INTO v_first5_approved FROM (SELECT status FROM public.moderation_queue WHERE submitted_by = p_user_id ORDER BY created_at LIMIT 5) sq;

  -- Weekly active weeks count (for weekly-warrior: 12 consecutive weeks)
  SELECT COUNT(DISTINCT DATE_TRUNC('week', date))::INT INTO v_weekly_active_weeks FROM public.user_daily_activity WHERE user_id = p_user_id AND date >= CURRENT_DATE - INTERVAL '84 days' AND roam_count > 0;

  -- Streak quality checks: all early (before 8 AM) or all late (after 10 PM)
  SELECT CASE WHEN COUNT(*) >= 7 AND COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM seen_at) >= 5 AND EXTRACT(HOUR FROM seen_at) < 8) = COUNT(*) THEN 1 ELSE 0 END INTO v_streak_all_early FROM public.seen_urls WHERE user_id = p_user_id AND seen_at::DATE >= CURRENT_DATE - (v_streak_days - 1)::INT;
  SELECT CASE WHEN COUNT(*) >= 7 AND COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM seen_at) >= 22) = COUNT(*) THEN 1 ELSE 0 END INTO v_streak_all_late FROM public.seen_urls WHERE user_id = p_user_id AND seen_at::DATE >= CURRENT_DATE - (v_streak_days - 1)::INT;

  -- Save streak: consecutive days with saves
  SELECT MAX(date) INTO v_last_save_date FROM public.user_daily_activity WHERE user_id = p_user_id AND save_count > 0 AND date < CURRENT_DATE;
  IF EXISTS (SELECT 1 FROM public.user_daily_activity WHERE user_id = p_user_id AND date = CURRENT_DATE AND save_count > 0) THEN
    IF v_last_save_date IS NULL OR v_last_save_date = CURRENT_DATE - INTERVAL '1 day' THEN
      SELECT COUNT(*)::INT INTO v_save_streak FROM (
        SELECT date FROM public.user_daily_activity WHERE user_id = p_user_id AND save_count > 0 ORDER BY date DESC
      ) sub;
    ELSE
      v_save_streak := 1;
    END IF;
  ELSE
    v_save_streak := 0;
  END IF;

  -- Yesterday's roam count
  SELECT COALESCE(roam_count, 0) INTO v_yesterday_roam FROM public.user_daily_activity WHERE user_id = p_user_id AND date = CURRENT_DATE - INTERVAL '1 day';

  -- Collections with descriptions
  SELECT COUNT(*) INTO v_collections_with_desc FROM public.collections WHERE user_id = p_user_id AND description IS NOT NULL AND description != '';
  v_total_collections_with_desc := v_collection_count;

  -- Same URL in multiple collections
  SELECT COALESCE(MAX(xc.cnt), 0)::INT INTO v_same_url_collections FROM (SELECT COUNT(DISTINCT ci.collection_id) AS cnt FROM public.collection_items ci JOIN public.collections c ON c.id = ci.collection_id WHERE c.user_id = p_user_id GROUP BY ci.url_id) xc;

  -- Category count
  SELECT COUNT(*) INTO v_cat_count FROM public.categories;

  -- Collection with exactly 1 item
  SELECT COUNT(*) INTO v_collection_with_one FROM (SELECT c.id FROM public.collections c LEFT JOIN public.collection_items ci ON ci.collection_id = c.id WHERE c.user_id = p_user_id GROUP BY c.id HAVING COUNT(ci.url_id) = 1) sub;

  -- Date-based secret badges
  v_today_dow := EXTRACT(DOW FROM CURRENT_DATE)::INT;
  v_today_day := EXTRACT(DAY FROM CURRENT_DATE)::INT;
  v_today_month := EXTRACT(MONTH FROM CURRENT_DATE)::INT;
  -- Friday the 13th
  IF v_today_dow = 5 AND v_today_day = 13 THEN v_is_friday_13th := TRUE; END IF;
  -- New Year
  IF v_today_month = 1 AND v_today_day = 1 THEN v_is_new_year := TRUE; END IF;
  -- Leap Day
  IF v_today_month = 2 AND v_today_day = 29 THEN v_is_leap_day := TRUE; END IF;
  -- Solstice (approximate: June 20-22 or Dec 20-22)
  IF (v_today_month = 6 AND v_today_day BETWEEN 20 AND 22) OR (v_today_month = 12 AND v_today_day BETWEEN 20 AND 22) THEN v_is_solstice := TRUE; END IF;

  -- Roam on date checks (for secret badges)
  SELECT COUNT(*) INTO v_roam_date_check FROM public.user_daily_activity WHERE user_id = p_user_id AND date = CURRENT_DATE AND roam_count > 0;

  FOR v_badge IN SELECT * FROM public.badges WHERE id NOT IN (SELECT badge_id FROM public.user_badges WHERE user_id = p_user_id) AND is_gift_only = FALSE AND category != 'milestone'
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

      -- ===================================================================
      -- NEW BADGES
      -- ===================================================================

      -- Exploration
      WHEN 'sunset-seeker' THEN IF v_today_roam_5pm >= 1 THEN v_count := 1; END IF; v_progress := LEAST(v_today_roam_5pm,1);
      WHEN 'curious-george' THEN v_progress := v_unique_cat_roam::INT; IF v_unique_cat_roam >= 5 THEN v_count := 1; END IF;
      WHEN 'speed-demon' THEN v_progress := LEAST(v_session_roam_hour, 50); IF v_session_roam_hour >= 50 THEN v_count := 1; END IF;
      WHEN 'globetrotter-platinum' THEN v_progress := LEAST(v_unique_domains::INT, 50); IF v_unique_domains >= 50 THEN v_count := 1; END IF;
      WHEN 'repeat-visitor' THEN SELECT COALESCE(MAX(rc.cnt), 0)::INT INTO v_progress FROM (SELECT COUNT(*) AS cnt FROM public.seen_urls WHERE user_id = p_user_id GROUP BY seen_url_id) rc; IF v_progress >= 5 THEN v_count := 1; END IF;
      WHEN 'monthly-explorer' THEN SELECT CASE WHEN COUNT(DISTINCT DATE_TRUNC('month', date)) >= 6 THEN 1 ELSE 0 END INTO v_count FROM public.user_daily_activity WHERE user_id = p_user_id AND roam_count > 0; v_progress := (SELECT COUNT(DISTINCT DATE_TRUNC('month', date))::INT FROM public.user_daily_activity WHERE user_id = p_user_id AND roam_count > 0);
      WHEN 'roam-marathon' THEN v_progress := LEAST(v_today_roam, 25); IF v_today_roam >= 25 THEN v_count := 1; END IF;
      WHEN 'daily-double' THEN SELECT CASE WHEN COUNT(*) >= 14 AND MIN(roam_count) >= 2 THEN 1 ELSE 0 END INTO v_count FROM (SELECT roam_count FROM public.user_daily_activity WHERE user_id = p_user_id AND date >= CURRENT_DATE - INTERVAL '13 days' ORDER BY date DESC LIMIT 14) sub; v_progress := (SELECT CASE WHEN COUNT(*) >= 14 THEN 14 ELSE COUNT(*) END FROM (SELECT roam_count FROM public.user_daily_activity WHERE user_id = p_user_id AND roam_count >= 2 AND date >= CURRENT_DATE - INTERVAL '13 days' ORDER BY date DESC LIMIT 14) sub2);
      WHEN 'session-beast' THEN v_progress := LEAST(v_today_roam, 50); IF v_today_roam >= 50 THEN v_count := 1; END IF;
      WHEN 'lunch-break' THEN IF v_today_roam_12pm >= 20 THEN v_count := 1; END IF; v_progress := LEAST(v_today_roam_12pm, 20);
      WHEN 'insomniac' THEN v_progress := LEAST(v_today_roam_midnight, 100); IF v_today_roam_midnight >= 100 THEN v_count := 1; END IF;

      -- Collecting
      WHEN 'bookworm' THEN v_progress := LEAST(v_weekly_save_count, 25); IF v_weekly_save_count >= 25 THEN v_count := 1; END IF;
      WHEN 'minimalist' THEN v_progress := LEAST(v_save_count::INT, 5); IF v_save_count = 5 THEN v_count := 1; END IF;
      WHEN 'consistent-collector' THEN v_progress := LEAST(v_save_streak, 7); IF v_save_streak >= 7 THEN v_count := 1; END IF;
      WHEN 'pocket-filler' THEN v_progress := LEAST(v_monthly_save_count, 100); IF v_monthly_save_count >= 100 THEN v_count := 1; END IF;
      WHEN 'pack-mule' THEN v_progress := LEAST(v_monthly_save_count, 250); IF v_monthly_save_count >= 250 THEN v_count := 1; END IF;
      WHEN 'one-stop-shop' THEN v_progress := LEAST(v_same_domain_max, 10); IF v_same_domain_max >= 10 THEN v_count := 1; END IF;
      WHEN 'hoarder' THEN IF v_save_count >= 100 AND v_collection_items_count = 0 THEN v_count := 1; END IF; v_progress := LEAST(v_save_count::INT, 100);

      -- Curating
      WHEN 'curators-eye' THEN v_progress := LEAST(v_same_url_collections, 3); IF v_same_url_collections >= 3 THEN v_count := 1; END IF;
      WHEN 'award-winner' THEN BEGIN SELECT COALESCE(MAX(fc.cnt), 0)::INT INTO v_progress FROM (SELECT COUNT(*) AS cnt FROM public.collection_favorites WHERE collection_id IN (SELECT id FROM public.collections WHERE user_id = p_user_id) GROUP BY collection_id) fc; EXCEPTION WHEN undefined_table THEN v_progress := 0; END; IF v_progress >= 500 THEN v_count := 1; END IF;
      WHEN 'descriptivist' THEN IF v_collection_count > 0 AND v_collections_with_desc = v_collection_count THEN v_count := 1; END IF; v_progress := v_collections_with_desc;
      WHEN 'niched-down' THEN IF v_collection_with_one >= 1 THEN v_count := 1; END IF; v_progress := LEAST(v_collection_with_one, 1);
      WHEN 'theme-master' THEN SELECT CASE WHEN MAX(tm.cnt) >= 3 THEN 1 ELSE 0 END INTO v_count FROM (SELECT COUNT(DISTINCT c2.id) AS cnt FROM public.collections c1 JOIN public.collection_items ci1 ON ci1.collection_id = c1.id JOIN public.urls u ON u.id = ci1.url_id JOIN public.collection_items ci2 ON ci2.url_id = u.id JOIN public.collections c2 ON c2.id = ci2.collection_id WHERE c1.user_id = p_user_id AND c2.user_id = p_user_id AND c1.id < c2.id GROUP BY c1.id, u.domain) tm; v_progress := v_count::INT;

      -- Social
      WHEN 'connector' THEN v_progress := LEAST(v_mutual_follow_count, 3); IF v_mutual_follow_count >= 3 THEN v_count := 1; END IF;
      WHEN 'broadcaster' THEN v_count := 0; v_progress := 0; -- requires a shares tracking table (future infrastructure)
      WHEN 'beloved' THEN v_progress := LEAST(v_follower_count::INT, 25); IF v_follower_count >= 25 THEN v_count := 1; END IF;
      WHEN 'celebrity' THEN v_progress := LEAST(v_follower_count::INT, 500); IF v_follower_count >= 500 THEN v_count := 1; END IF;
      WHEN 'full-profile' THEN v_progress := v_profile_completeness; IF v_profile_completeness >= 3 THEN v_count := 1; END IF;
      WHEN 'chatterbox' THEN v_count := 0; v_progress := 0; -- requires share click analytics (future infrastructure)
      WHEN 'inner-circle' THEN SELECT COUNT(*) INTO v_count FROM public.follows WHERE follower_id = p_user_id AND is_pending = FALSE AND created_at <= now() - INTERVAL '30 days'; v_progress := LEAST(v_count::INT, 5); IF v_count >= 5 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'birthday-buddy' THEN v_progress := v_account_anniversary; IF v_account_anniversary >= 1 AND v_today_roam > 0 THEN v_count := 1; END IF;

      -- Streaks
      WHEN 'consistency-king' THEN v_progress := LEAST(v_streak_days, 200); IF v_streak_days >= 200 THEN v_count := 1; END IF;
      WHEN 'weekly-warrior' THEN v_progress := v_weekly_active_weeks; IF v_weekly_active_weeks >= 12 THEN v_count := 1; END IF;
      WHEN 'early-riser-streak' THEN v_progress := LEAST(v_streak_days, 7); IF v_streak_all_early >= 1 AND v_streak_days >= 7 THEN v_count := 1; END IF;
      WHEN 'full-year' THEN v_progress := LEAST(v_streak_days, 365); IF v_streak_days >= 365 THEN v_count := 1; END IF;
      WHEN 'night-owl-streak' THEN v_progress := LEAST(v_streak_days, 7); IF v_streak_all_late >= 1 AND v_streak_days >= 7 THEN v_count := 1; END IF;

      -- Contributing
      WHEN 'top-contributor' THEN v_progress := LEAST(v_weekly_approved::INT, 10); IF v_weekly_approved >= 10 THEN v_count := 1; END IF;
      WHEN 'variety-submitter' THEN v_progress := LEAST(v_submit_category_count, 5); IF v_submit_category_count >= 5 THEN v_count := 1; END IF;
      WHEN 'quality-first' THEN v_progress := (CASE WHEN v_submit_count >= 5 THEN 5 ELSE v_submit_count::INT END); IF v_first5_approved >= 1 THEN v_count := 1; END IF;
      WHEN 'prolific' THEN v_progress := LEAST(v_submit_count::INT, 500); IF v_submit_count >= 500 THEN v_count := 1; END IF;
      WHEN 'submission-streak' THEN SELECT COUNT(DISTINCT DATE_TRUNC('week', created_at))::INT INTO v_count FROM public.moderation_queue WHERE submitted_by = p_user_id AND created_at >= now() - INTERVAL '28 days'; v_progress := v_count; IF v_count >= 4 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'contributor-platinum' THEN v_progress := LEAST(v_submit_count::INT, 1000); IF v_submit_count >= 1000 THEN v_count := 1; END IF;
      WHEN 'approval-streak' THEN SELECT CASE WHEN COUNT(*) >= 10 AND COUNT(*) FILTER (WHERE status = 'approved') = COUNT(*) THEN 1 ELSE 0 END INTO v_count FROM (SELECT status FROM public.moderation_queue WHERE submitted_by = p_user_id ORDER BY created_at DESC LIMIT 10) sq; v_progress := CASE WHEN (SELECT COUNT(*) FROM public.moderation_queue WHERE submitted_by = p_user_id) >= 10 THEN (SELECT COUNT(*) FILTER (WHERE status = 'approved') FROM (SELECT status FROM public.moderation_queue WHERE submitted_by = p_user_id ORDER BY created_at DESC LIMIT 10) sq2) ELSE (SELECT COUNT(*) FROM public.moderation_queue WHERE submitted_by = p_user_id) END;

      -- Engagement
      WHEN 'power-user' THEN IF v_today_roam > 0 AND v_today_save > 0 AND v_today_rate_count > 0 AND v_collection_count > 0 THEN v_count := 1; END IF; v_progress := (CASE WHEN v_today_roam > 0 THEN 1 ELSE 0 END + CASE WHEN v_today_save > 0 THEN 1 ELSE 0 END + CASE WHEN v_today_rate_count > 0 THEN 1 ELSE 0 END + CASE WHEN v_collection_count > 0 THEN 1 ELSE 0 END);
      WHEN 'feedback-loop' THEN v_progress := LEAST(v_today_rate_count, 10); IF v_today_rate_count >= 10 THEN v_count := 1; END IF;
      WHEN 'the-judge' THEN v_progress := LEAST(v_rate_count::INT, 2000); IF v_rate_count >= 2000 THEN v_count := 1; END IF;
      WHEN 'rate-everything' THEN SELECT COUNT(DISTINCT u.category_id) INTO v_count FROM public.url_ratings r JOIN public.urls u ON u.id = r.url_id WHERE r.user_id = p_user_id; v_progress := v_count::INT; IF v_count >= v_cat_count THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'session-beast-engagement' THEN v_progress := LEAST(v_today_roam, 100); IF v_today_roam >= 100 THEN v_count := 1; END IF;
      WHEN 'deep-reader' THEN v_count := 0; v_progress := 0; -- requires dwell time tracking

      -- Secret
      WHEN 'friday-13th' THEN v_progress := (CASE WHEN v_is_friday_13th AND v_roam_date_check > 0 THEN 1 ELSE 0 END)::INT; IF v_is_friday_13th AND v_roam_date_check > 0 THEN v_count := 1; END IF;
      WHEN 'new-year' THEN v_progress := (CASE WHEN v_is_new_year AND v_roam_date_check > 0 THEN 1 ELSE 0 END)::INT; IF v_is_new_year AND v_roam_date_check > 0 THEN v_count := 1; END IF;
      WHEN 'leap-day' THEN v_progress := (CASE WHEN v_is_leap_day AND v_roam_date_check > 0 THEN 1 ELSE 0 END)::INT; IF v_is_leap_day AND v_roam_date_check > 0 THEN v_count := 1; END IF;
      WHEN 'solstice-seeker' THEN v_progress := (CASE WHEN v_is_solstice AND v_roam_date_check > 0 THEN 1 ELSE 0 END)::INT; IF v_is_solstice AND v_roam_date_check > 0 THEN v_count := 1; END IF;
      WHEN 'century-roam' THEN v_progress := LEAST(v_roam_count::INT, 100); IF v_roam_count = 100 THEN v_count := 1; END IF;
      WHEN 'millennium-roam' THEN v_progress := LEAST(v_roam_count::INT, 1000); IF v_roam_count = 1000 THEN v_count := 1; END IF;
      WHEN 'snake-eyes' THEN v_progress := LEAST(v_save_count::INT, 11); IF v_save_count = 11 THEN v_count := 1; END IF;
      WHEN 'triple-sevens' THEN v_progress := LEAST(v_xp_total::INT, 777); IF v_xp_total = 777 THEN v_count := 1; END IF;

      ELSE CONTINUE;
    END CASE;

    IF v_count > 0 THEN
      IF v_badge.parent_badge_slug IS NOT NULL THEN
        SELECT id INTO v_parent_badge_id FROM public.badges WHERE slug = v_badge.parent_badge_slug;
        IF NOT EXISTS (SELECT 1 FROM public.user_badges WHERE user_id = p_user_id AND badge_id = v_parent_badge_id AND unlocked_at IS NOT NULL) THEN CONTINUE; END IF;
      END IF;
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
      -- Original milestones
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
      -- New milestones
      WHEN 'level-5' THEN IF v_level >= 5 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'level-15' THEN IF v_level >= 15 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'level-25' THEN IF v_level >= 25 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'level-60' THEN IF v_level >= 60 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'level-125' THEN IF v_level >= 125 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'level-150' THEN IF v_level >= 150 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'xp-millionaire' THEN IF v_xp_total >= 1000000 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'demigod' THEN IF v_level >= 150 AND (SELECT COUNT(*) FROM public.user_badges WHERE user_id = p_user_id AND unlocked_at IS NOT NULL) >= 200 THEN v_count := 1; ELSE v_count := 0; END IF;
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

  PERFORM public.sync_profile_badge_count(p_user_id);
END; $$;

REVOKE EXECUTE ON FUNCTION public.evaluate_badges FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.evaluate_badges TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Verify friendly-face now uses v_mutual_follow_count properly
-- ---------------------------------------------------------------------------
-- The original friendly-face query was inlined; we updated it to use the
-- precomputed variable. This is now consistent and more efficient.