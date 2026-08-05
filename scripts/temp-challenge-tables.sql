-- Challenge tables + seed data only (no badges)
CREATE TABLE IF NOT EXISTS public.challenges (
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

CREATE TABLE IF NOT EXISTS public.challenge_instances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id    UUID REFERENCES public.challenges(id) ON DELETE CASCADE,
  challenge_type  TEXT NOT NULL,
  starts_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL,
  is_global       BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_challenges (
  user_id                UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  instance_id            UUID REFERENCES public.challenge_instances(id) ON DELETE CASCADE,
  progress_current       INT DEFAULT 0,
  completed_at           TIMESTAMPTZ DEFAULT NULL,
  completed_xp_awarded   BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (user_id, instance_id)
);

-- Seed 34 challenges
INSERT INTO public.challenges (challenge_type, challenge_key, title, goal_description, goal_count, xp_reward, condition_type, weight) VALUES
('daily', 'roam-5', 'Roam 5 pages', 'Discover 5 new pages today', 5, 30, 'roam_count', 3),
('daily', 'roam-10', 'Roam 10 pages', 'Discover 10 new pages today', 10, 50, 'roam_count', 2),
('daily', 'roam-20', 'Roam 20 pages', 'Discover 20 new pages today', 20, 80, 'roam_count', 1),
('daily', 'save-3', 'Save 3 pages', 'Save 3 pages for later today', 3, 30, 'save_count', 3),
('daily', 'save-5', 'Save 5 pages', 'Save 5 pages for later today', 5, 50, 'save_count', 2),
('daily', 'save-10', 'Save 10 pages', 'Save 10 pages for later today', 10, 80, 'save_count', 1),
('daily', 'rate-5', 'Rate 5 pages', 'Rate 5 pages today', 5, 30, 'rate_count', 2),
('daily', 'rate-10', 'Rate 10 pages', 'Rate 10 pages today', 10, 50, 'rate_count', 1),
('daily', 'submit-1', 'Submit a URL', 'Submit 1 URL for review today', 1, 40, 'submit_count', 2),
('daily', 'follow-1', 'Follow someone', 'Follow 1 new person today', 1, 20, 'follow_count', 2),
('daily', 'collection-1', 'Create a collection', 'Create 1 new collection today', 1, 30, 'collection_count', 2),
('daily', 'roam-3-save-1', 'Roam & Save', 'Roam 3 pages AND save 1', 3, 40, 'roam_count', 2),
('daily', 'roam-5-rate-2', 'Roam & Rate', 'Roam 5 pages AND rate 2', 5, 50, 'roam_count', 1),
('daily', 'save-3-rate-1', 'Save & Rate', 'Save 3 pages AND rate 1', 3, 40, 'save_count', 1),
('weekly', 'roam-50', 'Roam 50 pages', 'Discover 50 pages this week', 50, 100, 'roam_count', 3),
('weekly', 'roam-100', 'Roam 100 pages', 'Discover 100 pages this week', 100, 200, 'roam_count', 2),
('weekly', 'save-20', 'Save 20 pages', 'Save 20 pages this week', 20, 100, 'save_count', 3),
('weekly', 'save-50', 'Save 50 pages', 'Save 50 pages this week', 50, 200, 'save_count', 2),
('weekly', 'rate-25', 'Rate 25 pages', 'Rate 25 pages this week', 25, 100, 'rate_count', 2),
('weekly', 'submit-3', 'Submit 3 URLs', 'Submit 3 URLs this week', 3, 100, 'submit_count', 2),
('weekly', 'follow-5', 'Follow 5 people', 'Follow 5 new people this week', 5, 80, 'follow_count', 2),
('weekly', 'collection-3', 'Create 3 collections', 'Create 3 collections this week', 3, 100, 'collection_count', 2),
('weekly', 'roam-25-save-10', 'Roam & Save Weekly', 'Roam 25 AND save 10 this week', 25, 150, 'roam_count', 1),
('monthly', 'roam-200', 'Roam 200 pages', 'Discover 200 pages this month', 200, 300, 'roam_count', 3),
('monthly', 'roam-500', 'Roam 500 pages', 'Discover 500 pages this month', 500, 500, 'roam_count', 2),
('monthly', 'save-100', 'Save 100 pages', 'Save 100 pages this month', 100, 300, 'save_count', 3),
('monthly', 'save-250', 'Save 250 pages', 'Save 250 pages this month', 250, 500, 'save_count', 2),
('monthly', 'rate-100', 'Rate 100 pages', 'Rate 100 pages this month', 100, 300, 'rate_count', 2),
('monthly', 'submit-10', 'Submit 10 URLs', 'Submit 10 URLs this month', 10, 300, 'submit_count', 2),
('monthly', 'follow-20', 'Follow 20 people', 'Follow 20 new people this month', 20, 200, 'follow_count', 2),
('monthly', 'collection-10', 'Create 10 collections', 'Create 10 collections this month', 10, 300, 'collection_count', 2),
('monthly', 'roam-100-save-50', 'Roam & Save Monthly', 'Roam 100 AND save 50 this month', 100, 400, 'roam_count', 1),
('monthly', 'roam-300-rate-50', 'Roam & Rate Monthly', 'Roam 300 AND rate 50 this month', 300, 500, 'roam_count', 1),
('monthly', 'all-around', 'All-Around Explorer', 'Roam 100, save 50, AND rate 25 this month', 100, 600, 'roam_count', 1);