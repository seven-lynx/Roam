-- =============================================================================
-- Challenge System: tables, seed data, 21 challenge badges, notification type
-- =============================================================================
-- Creates the full challenge infrastructure:
--   - challenges (catalog pool — 34 rows)
--   - challenge_instances (active instances per user or global)
--   - user_challenges (per-user progress tracking)
--   - 21 challenge-related badges in public.badges
--   - 'challenge_complete' notification type
-- =============================================================================

-- ── 1. Challenge catalog ───────────────────────────────────────────────────
CREATE TABLE public.challenges (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_type    TEXT NOT NULL CHECK (challenge_type IN ('daily','weekly','monthly')),
  challenge_key     TEXT NOT NULL UNIQUE,
  title             TEXT NOT NULL,
  goal_description  TEXT,
  goal_count        INT NOT NULL,
  xp_reward         INT NOT NULL DEFAULT 50,
  condition_type    TEXT NOT NULL,
  category_filter   UUID[] DEFAULT NULL,
  time_restriction  TEXT DEFAULT NULL,
  weight            INT DEFAULT 1
);

-- ── 2. Active challenge instances ──────────────────────────────────────────
CREATE TABLE public.challenge_instances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id    UUID REFERENCES public.challenges(id) ON DELETE CASCADE,
  challenge_type  TEXT NOT NULL,
  starts_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL,
  is_global       BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_challenge_instances_type_expires
  ON public.challenge_instances(challenge_type, expires_at);

-- ── 3. Per-user progress ──────────────────────────────────────────────────
CREATE TABLE public.user_challenges (
  user_id                UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  instance_id            UUID REFERENCES public.challenge_instances(id) ON DELETE CASCADE,
  progress_current       INT DEFAULT 0,
  completed_at           TIMESTAMPTZ DEFAULT NULL,
  completed_xp_awarded   BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (user_id, instance_id)
);

CREATE INDEX idx_user_challenges_user ON public.user_challenges(user_id);
CREATE INDEX idx_user_challenges_completed ON public.user_challenges(user_id, completed_at)
  WHERE completed_at IS NOT NULL;

-- ── 4. RLS policies ────────────────────────────────────────────────────────
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_challenges ENABLE ROW LEVEL SECURITY;

-- challenges: readable by authenticated users
DO $$ BEGIN
  CREATE POLICY "Authenticated users can read challenges"
    ON public.challenges FOR SELECT
    USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- challenge_instances: readable by authenticated users
DO $$ BEGIN
  CREATE POLICY "Authenticated users can read challenge instances"
    ON public.challenge_instances FOR SELECT
    USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- user_challenges: users can read/write their own
DO $$ BEGIN
  CREATE POLICY "Users can read own challenge progress"
    ON public.user_challenges FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own challenge progress"
    ON public.user_challenges FOR UPDATE
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert user challenges"
    ON public.user_challenges FOR INSERT
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 5. Seed challenge pool (34 challenges) ─────────────────────────────────

-- Daily challenges (18)
INSERT INTO public.challenges (challenge_type, challenge_key, title, goal_description, goal_count, xp_reward, condition_type, time_restriction, weight)
VALUES
('daily', 'roam-10', 'Quick Browse', 'Roam 10 URLs', 10, 50, 'roam_count', NULL, 3),
('daily', 'roam-25', 'Power Browser', 'Roam 25 URLs', 25, 100, 'roam_count', NULL, 1),
('daily', 'save-3', 'Collector', 'Save 3 URLs', 3, 60, 'save_count', NULL, 2),
('daily', 'category-hop-3', 'Category Hopper', 'Explore 3 different categories', 3, 75, 'category_count', NULL, 2),
('daily', 'rate-5', 'Critic''s Choice', 'Rate 5 URLs', 5, 40, 'rate_count', NULL, 2),
('daily', 'morning-roam', 'Early Bird', 'Roam 3 URLs before 10am', 3, 70, 'roam_count', 'morning', 1),
('daily', 'night-roam', 'Night Owl', 'Roam 3 URLs after 10pm', 3, 70, 'roam_count', 'night', 1),
('daily', 'domain-hop-5', 'Domain Hopper', 'Visit 5 different domains', 5, 60, 'domain_count', NULL, 2),
('daily', 'subcategory-scout', 'Subcategory Scout', 'Explore 2 different subcategories', 2, 80, 'subcategory_count', NULL, 2),
('daily', 'lunch-roam', 'Lunch Break', 'Roam 5 URLs between 12-2pm', 5, 65, 'roam_count', 'afternoon', 1),
('daily', 'save-variety', 'Variety Saver', 'Save from 2 different categories', 2, 70, 'save_count', NULL, 1),
('daily', 'feedback-5', 'Feedback Giver', 'Rate 5 URLs (any rating)', 5, 50, 'rate_count', NULL, 1),
('daily', 'collection-add', 'Collection Builder', 'Add 3 items to any collection', 3, 75, 'collection_count', NULL, 1),
('daily', 'share-1', 'Sharer', 'Share 1 URL', 1, 50, 'share_count', NULL, 1),
('daily', 'session-stack', 'Session Stacker', 'Roam 20+ URLs in a single session', 20, 100, 'session_count', NULL, 1),
('daily', 'follow-1', 'Networker', 'Follow 1 new person', 1, 60, 'follow_count', NULL, 2),
('daily', 'submit-1', 'Contributor', 'Submit 1 URL', 1, 80, 'submit_count', NULL, 1),
('daily', 'profile-view-3', 'Profile Peeker', 'View 3 different user profiles', 3, 30, 'profile_view_count', NULL, 1);

-- Weekly challenges (8)
INSERT INTO public.challenges (challenge_type, challenge_key, title, goal_description, goal_count, xp_reward, condition_type)
VALUES
('weekly', 'weekly-roam-50', 'Weekly Explorer', 'Roam 50 URLs', 50, 200, 'roam_count'),
('weekly', 'weekly-save-20', 'Weekly Collector', 'Save 20 URLs', 20, 250, 'save_count'),
('weekly', 'weekly-categories-8', 'Category Explorer', 'Explore 8 different categories', 8, 300, 'category_count'),
('weekly', 'weekly-follow-3', 'Weekly Networker', 'Follow 3 new people', 3, 200, 'follow_count'),
('weekly', 'weekly-submit-3', 'Weekly Contributor', 'Submit 3 URLs', 3, 350, 'submit_count'),
('weekly', 'weekly-rate-25', 'Weekly Critic', 'Rate 25 URLs', 25, 200, 'rate_count'),
('weekly', 'weekly-subcategories-5', 'Subcategory Explorer', 'Explore 5 different subcategories', 5, 350, 'subcategory_count'),
('weekly', 'weekly-save-streak', 'Weekly Save Streak', 'Save 1+ URL for 5 days', 5, 400, 'save_count');

-- Monthly challenges (8)
INSERT INTO public.challenges (challenge_type, challenge_key, title, goal_description, goal_count, xp_reward, condition_type)
VALUES
('monthly', 'monthly-roam-200', 'Monthly Explorer', 'Roam 200 URLs', 200, 600, 'roam_count'),
('monthly', 'monthly-save-75', 'Monthly Collector', 'Save 75 URLs', 75, 750, 'save_count'),
('monthly', 'monthly-categories-all', 'Category Master', 'Explore every category', 15, 1000, 'category_count'),
('monthly', 'monthly-followers-5', 'Influencer', 'Gain 5 new followers', 5, 800, 'follow_count'),
('monthly', 'monthly-submit-10', 'Monthly Contributor', 'Submit 10 URLs', 10, 1000, 'submit_count'),
('monthly', 'monthly-rate-100', 'Monthly Critic', 'Rate 100 URLs', 100, 700, 'rate_count'),
('monthly', 'monthly-streak-20', 'Streak Master', 'Maintain a 20-day streak', 20, 1200, 'streak_days'),
('monthly', 'monthly-save-diversity', 'Save Diversity', 'Save from 10 different categories', 10, 1000, 'save_count');

-- ── 6. Insert 21 challenge-related badges ──────────────────────────────────
INSERT INTO public.badges (slug, name, description, icon, category, tier, required_count, xp_reward, is_hidden)
VALUES
('first-challenge', 'First Challenge', 'Complete your first challenge', '🎯', 'engagement', 0, 1, 50, false),
('challenge-accepted', 'Challenge Accepted', 'Complete 50 challenges', '✅', 'engagement', 1, 50, 100, false),
('challenge-master', 'Challenge Master', 'Complete 250 challenges', '🏆', 'engagement', 2, 250, 250, false),
('challenge-addict', 'Challenge Addict', 'Complete 1000 challenges', '🔥', 'engagement', 3, 1000, 500, false),
('daily-devotion', 'Daily Devotion', 'Complete 5 daily challenges', '📅', 'engagement', 0, 5, 75, false),
('daily-driver', 'Daily Driver', 'Complete 25 daily challenges', '🚗', 'engagement', 1, 25, 150, false),
('daily-dynamo', 'Daily Dynamo', 'Complete 100 daily challenges', '⚡', 'engagement', 2, 100, 300, false),
('weekly-warrior', 'Weekly Warrior', 'Complete 5 weekly challenges', '🗡️', 'engagement', 0, 5, 100, false),
('weekly-champion', 'Weekly Champion', 'Complete 25 weekly challenges', '👑', 'engagement', 1, 25, 200, false),
('weekly-legend', 'Weekly Legend', 'Complete 50 weekly challenges', '🌟', 'engagement', 2, 50, 400, false),
('monthly-mastery', 'Monthly Mastery', 'Complete 3 monthly challenges', '📆', 'engagement', 0, 3, 150, false),
('monthly-mogul', 'Monthly Mogul', 'Complete 12 monthly challenges', '💼', 'engagement', 1, 12, 350, false),
('overachiever', 'Overachiever', 'Exceed a challenge goal by 50%', '📈', 'engagement', 0, NULL, 100, false),
('triple-threat', 'Triple Threat', 'Complete daily + weekly + monthly in same day', '🎪', 'engagement', 0, NULL, 200, false),
('perfect-week', 'Perfect Week', 'Complete ALL active weekly challenges', '✨', 'engagement', 0, NULL, 300, false),
('perfect-month', 'Perfect Month', 'Complete ALL active monthly challenges', '💎', 'engagement', 0, NULL, 500, false),
('last-minute-save', 'Last Minute Save', 'Complete a challenge in its final hour', '⏰', 'engagement', 0, NULL, 100, false),
('speed-challenger', 'Speed Challenger', 'Complete a daily challenge within 1 hour', '🏃', 'engagement', 0, NULL, 150, false),
('streak-challenger', 'Streak Challenger', 'Complete 1+ challenge per day for 7 days', '🔥', 'engagement', 0, NULL, 200, false),
('january-grind', 'January Grind', 'Complete 20 daily challenges in January', '❄️', 'engagement', 0, NULL, 300, true),
('challenge-hoarder', 'Challenge Hoarder', 'Have 5+ active challenges and complete all', '📦', 'engagement', 0, NULL, 150, false);

-- ── 7. Add challenge_complete notification type ────────────────────────────
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('url_approved', 'url_rejected', 'new_follower', 'badge_unlocked', 'level_up', 'url_shared', 'challenge_complete'));