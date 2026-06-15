-- =============================================================================
-- Badges, Achievements & Gamification System
-- =============================================================================
-- Tables:
--   xp_actions       — Defines what earns XP (single source of truth)
--   xp_log           — Audit trail for every XP event
--   badges           — Badge definitions
--   user_badges      — Earned badges (junction)
--   user_daily_activity — Streak tracking + daily XP cap
--   leaderboard_snapshots — Cached leaderboard (refreshed by cron/function)
--
-- Modified tables:
--   profiles         — Add xp_total, level, streak_days, max_streak, badge_count
-- =============================================================================

-- ── xp_actions ───────────────────────────────────────────────────────────────
CREATE TABLE public.xp_actions (
  action      TEXT PRIMARY KEY,
  xp          INT NOT NULL CHECK (xp > 0),
  description TEXT NOT NULL DEFAULT ''
);

ALTER TABLE public.xp_actions ENABLE ROW LEVEL SECURITY;

-- Everyone can read xp_actions
CREATE POLICY "Anyone can read xp_actions"
  ON public.xp_actions
  FOR SELECT
  USING (true);

-- Only admins can modify (enforced via admin-level operations or edge functions)
CREATE POLICY "Admins can manage xp_actions"
  ON public.xp_actions
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Seed XP actions
INSERT INTO public.xp_actions (action, xp, description) VALUES
  ('roam',              10,  'Press the Roam button'),
  ('save_url',          5,   'Save a URL'),
  ('submit_url',        25,  'Submit a new URL to the catalog'),
  ('submit_approved',   50,  'Bonus when your submitted URL is approved'),
  ('create_collection', 20,  'Create a new collection'),
  ('add_to_collection', 5,   'Add a URL to a collection'),
  ('daily_roam_streak', 15,  'Roam on consecutive days (per-day bonus)'),
  ('follow_user',       5,   'Follow another user'),
  ('gain_follower',     10,  'Someone follows you'),
  ('share_url',         5,   'Share a URL'),
  ('rate_url',          3,   'Rate a URL (thumbs up/down)'),
  ('profile_complete',  100, 'One-time: fill out bio + interests + avatar'),
  ('collection_favorited', 15, 'Someone favorites your collection');

-- ── xp_log ───────────────────────────────────────────────────────────────────
CREATE TABLE public.xp_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action      TEXT        NOT NULL,
  xp_awarded  INT         NOT NULL CHECK (xp_awarded > 0),
  metadata    JSONB       DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX xp_log_user_id_created_idx ON public.xp_log (user_id, created_at DESC);
CREATE INDEX xp_log_action_idx ON public.xp_log (action);

ALTER TABLE public.xp_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own XP log
CREATE POLICY "Users can read own xp_log"
  ON public.xp_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- Edge functions can insert (use SECURITY DEFINER or admin role in functions)
CREATE POLICY "Admins can manage xp_log"
  ON public.xp_log
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ── badges ───────────────────────────────────────────────────────────────────
CREATE TABLE public.badges (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT        NOT NULL UNIQUE,
  name              TEXT        NOT NULL,
  description       TEXT        NOT NULL DEFAULT '',
  icon              TEXT        NOT NULL DEFAULT '🏅',
  category          TEXT        NOT NULL CHECK (category IN (
                    'exploration', 'collecting', 'curating', 'social',
                    'streaks', 'contributing', 'engagement', 'secret',
                    'milestone', 'gift'
                  )),
  tier              SMALLINT    NOT NULL DEFAULT 0 CHECK (tier >= 0 AND tier <= 5),
                  -- 0 = milestone/gift/no-tier
                  -- 1 = bronze, 2 = silver, 3 = gold, 4 = platinum, 5 = legendary
  required_count    INT,
                  -- For progressive badges: count needed to unlock.
                  -- NULL = one-time unlock (non-progressive).
                  -- For tiered badges, each tier is a separate row with
                  -- incrementing required_count values.
  parent_badge_slug TEXT REFERENCES public.badges(slug) ON DELETE SET NULL,
                  -- For tiered badges: slug of the lower-tier badge.
                  -- e.g., 'collector-bronze' has parent NULL,
                  --        'collector-silver' has parent 'collector-bronze'
  xp_reward         INT         NOT NULL DEFAULT 0,
  is_hidden         BOOLEAN     NOT NULL DEFAULT false,
  is_gift_only      BOOLEAN     NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

-- Everyone can read non-hidden badges
CREATE POLICY "Anyone can read visible badges"
  ON public.badges
  FOR SELECT
  USING (NOT is_hidden OR public.is_admin(auth.uid()));

-- Only admins can manage badges
CREATE POLICY "Admins can manage badges"
  ON public.badges
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ── Seed ALL Badges ──────────────────────────────────────────────────────────

-- === EXPLORATION ===
INSERT INTO public.badges (slug, name, description, icon, category, tier, required_count, xp_reward) VALUES
  ('first-roam',          'First Roam',          'Press Roam for the very first time',                      '🚀', 'exploration', 1, 1, 50),
  ('wanderer-bronze',     'Wanderer',            'Roam 10 times',                                           '🚶', 'exploration', 1, 10, 25),
  ('wanderer-silver',     'Wanderer II',         'Roam 50 times',                                           '🚶', 'exploration', 2, 50, 50),
  ('wanderer-gold',       'Wanderer III',        'Roam 200 times',                                          '🚶', 'exploration', 3, 200, 100),
  ('nomad-bronze',        'Nomad',               'Roam 500 times',                                          '🏕️', 'exploration', 1, 500, 150),
  ('nomad-silver',        'Nomad II',            'Roam 1,000 times',                                        '🏕️', 'exploration', 2, 1000, 250),
  ('nomad-gold',          'Nomad III',           'Roam 5,000 times',                                        '🏕️', 'exploration', 3, 5000, 500),
  ('nomad-platinum',      'Nomad Supreme',       'Roam 10,000 times',                                       '🏕️', 'exploration', 4, 10000, 1000),
  ('night-owl',           'Night Owl',           'Roam between midnight and 4 AM',                          '🦉', 'exploration', 1, NULL, 30),
  ('early-bird',          'Early Bird',          'Roam between 5 AM and 8 AM',                              '🐦', 'exploration', 1, NULL, 30),
  ('globetrotter-bronze', 'Globetrotter',        'Discover URLs from 5 unique domains',                     '🌎', 'exploration', 1, 5, 25),
  ('globetrotter-silver', 'Globetrotter II',     'Discover URLs from 15 unique domains',                    '🌎', 'exploration', 2, 15, 50),
  ('globetrotter-gold',   'Globetrotter III',    'Discover URLs from 30 unique domains',                    '🌎', 'exploration', 3, 30, 100),
  ('category-explorer-bronze', 'Category Explorer',     'Roam in 3 different categories',                   '🧭', 'exploration', 1, 3, 25),
  ('category-explorer-silver', 'Category Explorer II',  'Roam in 5 different categories',                   '🧭', 'exploration', 2, 5, 50),
  ('category-explorer-gold',   'Category Explorer III', 'Roam in all categories',                           '🧭', 'exploration', 3, NULL, 150);

-- === COLLECTING ===
INSERT INTO public.badges (slug, name, description, icon, category, tier, required_count, xp_reward) VALUES
  ('first-save',            'First Save',          'Save your first URL',                                  '💾', 'collecting', 1, 1, 50),
  ('collector-bronze',      'Collector',           'Save 10 URLs',                                         '📚', 'collecting', 1, 10, 25),
  ('collector-silver',      'Collector II',        'Save 50 URLs',                                         '📚', 'collecting', 2, 50, 50),
  ('collector-gold',        'Collector III',       'Save 200 URLs',                                        '📚', 'collecting', 3, 200, 100),
  ('collector-platinum',    'Collector Supreme',   'Save 1,000 URLs',                                      '📚', 'collecting', 4, 1000, 250),
  ('archivist-bronze',      'Archivist',           'Save 500 URLs',                                        '🗄️', 'collecting', 1, 500, 150),
  ('archivist-silver',      'Archivist II',        'Save 2,000 URLs',                                      '🗄️', 'collecting', 2, 2000, 300),
  ('archivist-gold',        'Archivist III',       'Save 5,000 URLs',                                      '🗄️', 'collecting', 3, 5000, 500),
  ('tagger-bronze',         'Tagger',              'Save URLs across 3 different categories',              '🏷️', 'collecting', 1, 3, 25),
  ('tagger-silver',         'Tagger II',           'Save URLs across 6 different categories',              '🏷️', 'collecting', 2, 6, 50),
  ('tagger-gold',           'Tagger III',          'Save URLs across 10 different categories',             '🏷️', 'collecting', 3, 10, 100),
  ('completionist',         'Completionist',       'Save a URL in every available category',               '✅', 'collecting', 2, NULL, 200),
  ('speed-collector',       'Speed Collector',     'Save 10 URLs in a single day',                         '⚡', 'collecting', 1, NULL, 40),
  ('mega-collector',        'Mega Collector',      'Save 50 URLs in a single day',                         '⚡', 'collecting', 2, NULL, 100);

-- === CURATING ===
INSERT INTO public.badges (slug, name, description, icon, category, tier, required_count, xp_reward) VALUES
  ('first-collection',      'First Collection',    'Create your first collection',                         '📁', 'curating', 1, 1, 50),
  ('curator-bronze',        'Curator',             'Create 3 collections',                                 '🖼️', 'curating', 1, 3, 25),
  ('curator-silver',        'Curator II',          'Create 10 collections',                                '🖼️', 'curating', 2, 10, 50),
  ('curator-gold',          'Curator III',         'Create 25 collections',                                '🖼️', 'curating', 3, 25, 100),
  ('curator-supreme',       'Curator Supreme',     'Create 50 collections',                                '🏛️', 'curating', 3, 50, 200),
  ('pack-rat-bronze',       'Pack Rat',            'One collection with 10 URLs',                          '🐿️', 'curating', 1, 10, 25),
  ('pack-rat-silver',       'Pack Rat II',         'One collection with 50 URLs',                          '🐿️', 'curating', 2, 50, 50),
  ('pack-rat-gold',         'Pack Rat III',        'One collection with 200 URLs',                         '🐿️', 'curating', 3, 200, 100),
  ('public-curator',        'Public Curator',      'Make 5 collections public',                            '🌐', 'curating', 2, 5, 50),
  ('favorited-bronze',      'Favorited',           'Have a collection favorited 5 times',                  '⭐', 'curating', 1, 5, 50),
  ('favorited-silver',      'Favorited II',        'Have a collection favorited 25 times',                 '⭐', 'curating', 2, 25, 100),
  ('favorited-gold',        'Favorited III',       'Have a collection favorited 100 times',                '⭐', 'curating', 3, 100, 250);

-- === SOCIAL ===
INSERT INTO public.badges (slug, name, description, icon, category, tier, required_count, xp_reward) VALUES
  ('social-butterfly-bronze', 'Social Butterfly',    'Follow 5 users',                                     '🦋', 'social', 1, 5, 25),
  ('social-butterfly-silver', 'Social Butterfly II', 'Follow 25 users',                                    '🦋', 'social', 2, 25, 50),
  ('social-butterfly-gold',   'Social Butterfly III','Follow 100 users',                                   '🦋', 'social', 3, 100, 150),
  ('influencer-bronze',       'Influencer',          'Gain 10 followers',                                  '📢', 'social', 1, 10, 25),
  ('influencer-silver',       'Influencer II',       'Gain 50 followers',                                  '📢', 'social', 2, 50, 50),
  ('influencer-gold',         'Influencer III',      'Gain 200 followers',                                 '📢', 'social', 3, 200, 100),
  ('influencer-platinum',     'Influencer Supreme',  'Gain 1,000 followers',                               '📢', 'social', 4, 1000, 500),
  ('friendly-face',           'Friendly Face',       'Follow someone who follows you back',                '👋', 'social', 1, NULL, 25),
  ('first-share',             'First Share',         'Share your first URL',                               '📤', 'social', 1, NULL, 25),
  ('viral-bronze',            'Viral',               'Shared URL clicked 10 times',                        '🦠', 'social', 1, 10, 50),
  ('viral-silver',            'Viral II',            'Shared URL clicked 100 times',                       '🦠', 'social', 2, 100, 150),
  ('viral-gold',              'Viral III',           'Shared URL clicked 1,000 times',                     '🦠', 'social', 3, 1000, 500),
  ('profile-perfectionist',   'Profile Perfectionist','Complete bio + interests + avatar',                 '✨', 'social', 1, NULL, 100);

-- === STREAKS ===
INSERT INTO public.badges (slug, name, description, icon, category, tier, required_count, xp_reward) VALUES
  ('hot-streak-bronze',       'Hot Streak',          '3-day roaming streak',                               '🔥', 'streaks', 1, 3, 30),
  ('hot-streak-silver',       'Hot Streak II',       '7-day roaming streak',                               '🔥', 'streaks', 2, 7, 75),
  ('hot-streak-gold',         'Hot Streak III',      '30-day roaming streak',                              '🔥', 'streaks', 3, 30, 250),
  ('unstoppable',             'Unstoppable',         '60-day roaming streak',                              '💪', 'streaks', 3, 60, 500),
  ('phoenix',                 'Phoenix',             '100-day roaming streak',                             '🐦', 'streaks', 4, 100, 1000),
  ('comeback',                'Comeback Kid',        'Roam after 7+ days of inactivity',                   '🔄', 'streaks', 1, NULL, 25);

-- === CONTRIBUTING ===
INSERT INTO public.badges (slug, name, description, icon, category, tier, required_count, xp_reward) VALUES
  ('first-submission',        'First Submission',    'Submit your first URL to the catalog',               '✏️', 'contributing', 1, 1, 50),
  ('contributor-bronze',      'Contributor',         'Submit 5 URLs',                                      '📝', 'contributing', 1, 5, 25),
  ('contributor-silver',      'Contributor II',      'Submit 25 URLs',                                     '📝', 'contributing', 2, 25, 50),
  ('contributor-gold',        'Contributor III',     'Submit 100 URLs',                                    '📝', 'contributing', 3, 100, 150),
  ('approved-bronze',         'Approved',            'Have 5 submissions approved',                        '✅', 'contributing', 1, 5, 50),
  ('approved-silver',         'Approved II',         'Have 25 submissions approved',                       '✅', 'contributing', 2, 25, 100),
  ('approved-gold',           'Approved III',        'Have 100 submissions approved',                      '✅', 'contributing', 3, 100, 250),
  ('quality-control',         'Quality Control',     '90%+ approval rate on submissions (min 10)',         '🔍', 'contributing', 2, NULL, 200),
  ('citizen-journalist',      'Citizen Journalist',  'A submitted URL gets 100+ roams',                    '📰', 'contributing', 3, NULL, 500);

-- === ENGAGEMENT ===
INSERT INTO public.badges (slug, name, description, icon, category, tier, required_count, xp_reward) VALUES
  ('rater-bronze',            'Rater',               'Rate 25 URLs',                                       '👍', 'engagement', 1, 25, 25),
  ('rater-silver',            'Rater II',            'Rate 100 URLs',                                      '👍', 'engagement', 2, 100, 50),
  ('rater-gold',              'Rater III',           'Rate 500 URLs',                                      '👍', 'engagement', 3, 500, 100),
  ('critic',                  'Critic',              'Rate 1,000 URLs',                                    '🎭', 'engagement', 3, 1000, 200),
  ('omnivore',                'Omnivore',            'Roam in all discovery modes',                        '🍽️', 'engagement', 1, NULL, 50),
  ('marathon',                'Marathon Runner',     'Roam 100 times in a single day',                     '🏃', 'engagement', 1, NULL, 200),
  ('loyalist',                'Loyalist',            'Account 1+ year old with activity every month',      '💎', 'engagement', 3, NULL, 500),
  ('weekend-warrior',         'Weekend Warrior',     'Roam on 4 consecutive weekends',                     '⚔️', 'engagement', 1, NULL, 50),
  ('diversity-champ',         'Diversity Champion',  'Save URLs in 5+ different languages',                '🗣️', 'engagement', 1, NULL, 50);

-- === SECRET / HIDDEN ===
INSERT INTO public.badges (slug, name, description, icon, category, tier, is_hidden, xp_reward) VALUES
  ('error-404-explorer',      '404 Explorer',        'Land on a page that returned a 404 error',           '🤔', 'secret', 1, true, 50),
  ('time-traveler',           'Time Traveler',       'Discover a URL archived from 2005 or earlier',       '⏰', 'secret', 2, true, 150),
  ('polyglot',                'Polyglot',            'Save URLs in 3+ different languages',                '🗣️', 'secret', 2, true, 75),
  ('easter-egg',              'Easter Egg Hunter',   'Visit the hidden easter egg URL',                    '🥚', 'secret', 3, true, 250),
  ('lunar-roamer',            'Lunar Roamer',        'Roam during a full moon',                            '🌙', 'secret', 2, true, 100),
  ('lucky-777',               'Lucky 777',           'Roam exactly 777 times',                             '🍀', 'secret', 2, true, 777),
  ('midnight-oil',            'Midnight Oil',        'Roam 50 times between midnight and 4 AM',            '🕯️', 'secret', 1, true, 50);

-- === MILESTONES ===
INSERT INTO public.badges (slug, name, description, icon, category, tier, required_count, xp_reward) VALUES
  ('level-10',                'Level 10',            'Reach level 10',                                     '⬆️', 'milestone', 0, 10, 50),
  ('level-20',                'Level 20',            'Reach level 20',                                     '⬆️', 'milestone', 0, 20, 100),
  ('level-30',                'Level 30',            'Reach level 30',                                     '⬆️', 'milestone', 0, 30, 150),
  ('level-40',                'Level 40',            'Reach level 40',                                     '⬆️', 'milestone', 0, 40, 200),
  ('level-50',                'Half Century',        'Reach level 50',                                     '🏆', 'milestone', 0, 50, 300),
  ('level-75',                'Level 75',            'Reach level 75',                                     '🏆', 'milestone', 0, 75, 500),
  ('level-100',               'Century Mark',        'Reach level 100',                                    '💯', 'milestone', 0, 100, 1000),
  ('centurion-badges',        'Centurion',           'Earn 100 badges',                                    '💯', 'milestone', 3, 100, 1000),
  ('master-roamer',           'Master Roamer',       'Reach level 50 + earn 50 badges',                    '👑', 'milestone', 4, NULL, 2000),
  ('grandmaster',             'Grandmaster',         'Reach level 100 + earn all non-secret badges',       '🌟', 'milestone', 5, NULL, 5000);

-- === GIFT-ONLY ===
INSERT INTO public.badges (slug, name, description, icon, category, tier, is_gift_only, xp_reward) VALUES
  ('beta-pioneer',            'Beta Pioneer',        'Helped test Roam during the beta',                   '🧪', 'gift', 0, true, 200),
  ('bug-hunter',              'Bug Hunter',          'Reported a meaningful bug that got fixed',           '🐛', 'gift', 0, true, 150),
  ('community-hero',          'Community Hero',      'Went above and beyond for the Roam community',       '🦸', 'gift', 0, true, 500),
  ('roam-legend',             'Roam Legend',         'Hand-picked by the Roam team as a legend',           '🏅', 'gift', 0, true, 1000),
  ('early-adopter',           'Early Adopter',       'Joined Roam in its earliest days',                   '🌅', 'gift', 0, true, 300),
  ('curator-spotlight',       'Curator Spotlight',   'Featured as a top curator by the Roam team',         '🔦', 'gift', 0, true, 300),
  ('innovator',               'Innovator',           'Contributed an idea that shaped Roam',               '💡', 'gift', 0, true, 300),
  ('good-citizen',            'Good Citizen',        'Flagged inappropriate content that was removed',     '🛡️', 'gift', 0, true, 150),
  ('trailblazer',             'Trailblazer',         'One of the first 100 users on Roam',                 '🗺️', 'gift', 0, true, 500),
  ('seasonal-hero',           'Seasonal Hero',       'Active during a special Roam event or season',       '🎪', 'gift', 0, true, 300);

-- Update parent_badge_slug for tiered badges
-- Explorer tier chains
UPDATE public.badges SET parent_badge_slug = NULL WHERE slug = 'wanderer-bronze';
UPDATE public.badges SET parent_badge_slug = 'wanderer-bronze' WHERE slug = 'wanderer-silver';
UPDATE public.badges SET parent_badge_slug = 'wanderer-silver' WHERE slug = 'wanderer-gold';

UPDATE public.badges SET parent_badge_slug = NULL WHERE slug = 'nomad-bronze';
UPDATE public.badges SET parent_badge_slug = 'nomad-bronze' WHERE slug = 'nomad-silver';
UPDATE public.badges SET parent_badge_slug = 'nomad-silver' WHERE slug = 'nomad-gold';
UPDATE public.badges SET parent_badge_slug = 'nomad-gold' WHERE slug = 'nomad-platinum';

UPDATE public.badges SET parent_badge_slug = NULL WHERE slug = 'globetrotter-bronze';
UPDATE public.badges SET parent_badge_slug = 'globetrotter-bronze' WHERE slug = 'globetrotter-silver';
UPDATE public.badges SET parent_badge_slug = 'globetrotter-silver' WHERE slug = 'globetrotter-gold';

UPDATE public.badges SET parent_badge_slug = NULL WHERE slug = 'category-explorer-bronze';
UPDATE public.badges SET parent_badge_slug = 'category-explorer-bronze' WHERE slug = 'category-explorer-silver';
UPDATE public.badges SET parent_badge_slug = 'category-explorer-silver' WHERE slug = 'category-explorer-gold';

-- Collector tier chains
UPDATE public.badges SET parent_badge_slug = NULL WHERE slug = 'collector-bronze';
UPDATE public.badges SET parent_badge_slug = 'collector-bronze' WHERE slug = 'collector-silver';
UPDATE public.badges SET parent_badge_slug = 'collector-silver' WHERE slug = 'collector-gold';
UPDATE public.badges SET parent_badge_slug = 'collector-gold' WHERE slug = 'collector-platinum';

UPDATE public.badges SET parent_badge_slug = NULL WHERE slug = 'archivist-bronze';
UPDATE public.badges SET parent_badge_slug = 'archivist-bronze' WHERE slug = 'archivist-silver';
UPDATE public.badges SET parent_badge_slug = 'archivist-silver' WHERE slug = 'archivist-gold';

UPDATE public.badges SET parent_badge_slug = NULL WHERE slug = 'tagger-bronze';
UPDATE public.badges SET parent_badge_slug = 'tagger-bronze' WHERE slug = 'tagger-silver';
UPDATE public.badges SET parent_badge_slug = 'tagger-silver' WHERE slug = 'tagger-gold';

-- Curator tier chains
UPDATE public.badges SET parent_badge_slug = NULL WHERE slug = 'curator-bronze';
UPDATE public.badges SET parent_badge_slug = 'curator-bronze' WHERE slug = 'curator-silver';
UPDATE public.badges SET parent_badge_slug = 'curator-silver' WHERE slug = 'curator-gold';

UPDATE public.badges SET parent_badge_slug = NULL WHERE slug = 'pack-rat-bronze';
UPDATE public.badges SET parent_badge_slug = 'pack-rat-bronze' WHERE slug = 'pack-rat-silver';
UPDATE public.badges SET parent_badge_slug = 'pack-rat-silver' WHERE slug = 'pack-rat-gold';

UPDATE public.badges SET parent_badge_slug = NULL WHERE slug = 'favorited-bronze';
UPDATE public.badges SET parent_badge_slug = 'favorited-bronze' WHERE slug = 'favorited-silver';
UPDATE public.badges SET parent_badge_slug = 'favorited-silver' WHERE slug = 'favorited-gold';

-- Social tier chains
UPDATE public.badges SET parent_badge_slug = NULL WHERE slug = 'social-butterfly-bronze';
UPDATE public.badges SET parent_badge_slug = 'social-butterfly-bronze' WHERE slug = 'social-butterfly-silver';
UPDATE public.badges SET parent_badge_slug = 'social-butterfly-silver' WHERE slug = 'social-butterfly-gold';

UPDATE public.badges SET parent_badge_slug = NULL WHERE slug = 'influencer-bronze';
UPDATE public.badges SET parent_badge_slug = 'influencer-bronze' WHERE slug = 'influencer-silver';
UPDATE public.badges SET parent_badge_slug = 'influencer-silver' WHERE slug = 'influencer-gold';
UPDATE public.badges SET parent_badge_slug = 'influencer-gold' WHERE slug = 'influencer-platinum';

UPDATE public.badges SET parent_badge_slug = NULL WHERE slug = 'viral-bronze';
UPDATE public.badges SET parent_badge_slug = 'viral-bronze' WHERE slug = 'viral-silver';
UPDATE public.badges SET parent_badge_slug = 'viral-silver' WHERE slug = 'viral-gold';

-- Streak tier chains
UPDATE public.badges SET parent_badge_slug = NULL WHERE slug = 'hot-streak-bronze';
UPDATE public.badges SET parent_badge_slug = 'hot-streak-bronze' WHERE slug = 'hot-streak-silver';
UPDATE public.badges SET parent_badge_slug = 'hot-streak-silver' WHERE slug = 'hot-streak-gold';

-- Contributing tier chains
UPDATE public.badges SET parent_badge_slug = NULL WHERE slug = 'contributor-bronze';
UPDATE public.badges SET parent_badge_slug = 'contributor-bronze' WHERE slug = 'contributor-silver';
UPDATE public.badges SET parent_badge_slug = 'contributor-silver' WHERE slug = 'contributor-gold';

UPDATE public.badges SET parent_badge_slug = NULL WHERE slug = 'approved-bronze';
UPDATE public.badges SET parent_badge_slug = 'approved-bronze' WHERE slug = 'approved-silver';
UPDATE public.badges SET parent_badge_slug = 'approved-silver' WHERE slug = 'approved-gold';

-- Engagement tier chains
UPDATE public.badges SET parent_badge_slug = NULL WHERE slug = 'rater-bronze';
UPDATE public.badges SET parent_badge_slug = 'rater-bronze' WHERE slug = 'rater-silver';
UPDATE public.badges SET parent_badge_slug = 'rater-silver' WHERE slug = 'rater-gold';

-- ── user_badges ──────────────────────────────────────────────────────────────
CREATE TABLE public.user_badges (
  user_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id      UUID        NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  unlocked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  progress_current INT      DEFAULT 0,
  granted_by    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, badge_id)
);

CREATE INDEX user_badges_user_id_idx ON public.user_badges (user_id, unlocked_at DESC);
CREATE INDEX user_badges_badge_id_idx ON public.user_badges (badge_id);
CREATE INDEX user_badges_granted_by_idx ON public.user_badges (granted_by);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Users can read their own badges
CREATE POLICY "Users can read own badges"
  ON public.user_badges
  FOR SELECT
  USING (auth.uid() = user_id);

-- Public can read badges of public profiles
CREATE POLICY "Public can read badges of public profiles"
  ON public.user_badges
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_badges.user_id AND p.is_public = TRUE
    )
  );

-- Admins can manage any user_badges (for gifting)
CREATE POLICY "Admins can manage user_badges"
  ON public.user_badges
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ── user_daily_activity ─────────────────────────────────────────────────────
CREATE TABLE public.user_daily_activity (
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date        DATE        NOT NULL DEFAULT CURRENT_DATE,
  roam_count  INT         NOT NULL DEFAULT 0,
  save_count  INT         NOT NULL DEFAULT 0,
  xp_earned   INT         NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

CREATE INDEX user_daily_activity_date_idx ON public.user_daily_activity (date);

ALTER TABLE public.user_daily_activity ENABLE ROW LEVEL SECURITY;

-- Users can read their own daily activity
CREATE POLICY "Users can read own daily activity"
  ON public.user_daily_activity
  FOR SELECT
  USING (auth.uid() = user_id);

-- Edge functions can insert/update (via admin or service role)
CREATE POLICY "Admins can manage daily activity"
  ON public.user_daily_activity
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ── leaderboard_snapshots ────────────────────────────────────────────────────
CREATE TABLE public.leaderboard_snapshots (
  period       TEXT        NOT NULL CHECK (period IN ('weekly', 'monthly', 'all_time')),
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  xp_earned    BIGINT      NOT NULL DEFAULT 0,
  badge_count  INT         NOT NULL DEFAULT 0,
  rank         INT         NOT NULL,
  snapshot_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (period, user_id, snapshot_at)
);

CREATE INDEX leaderboard_snapshots_period_rank_idx ON public.leaderboard_snapshots (period, snapshot_at DESC, rank);

ALTER TABLE public.leaderboard_snapshots ENABLE ROW LEVEL SECURITY;

-- Everyone can read leaderboard
CREATE POLICY "Anyone can read leaderboard"
  ON public.leaderboard_snapshots
  FOR SELECT
  USING (true);

-- Only admins/service can manage
CREATE POLICY "Admins can manage leaderboard"
  ON public.leaderboard_snapshots
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ── Modify profiles table ────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS xp_total    BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level       INT    NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS streak_days INT    NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_streak  INT    NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS badge_count INT    NOT NULL DEFAULT 0;

-- ── XP / Level utility function ──────────────────────────────────────────────
-- Level formula: level = floor(sqrt(xp_total / 100)) + 1
-- Level 1:    0-99 XP
-- Level 2:  100-399 XP
-- Level 3:  400-899 XP
-- Level 5:  1,600-2,499 XP
-- Level 10: 8,100-9,999 XP
-- Level 20: 36,100-39,999 XP
-- Level 50: 240,100-249,999 XP
-- Level 100: 980,100-999,999 XP
CREATE OR REPLACE FUNCTION public.calculate_level(p_xp BIGINT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT FLOOR(SQRT(p_xp::NUMERIC / 100))::INT + 1;
$$;

-- XP needed to reach a given level
CREATE OR REPLACE FUNCTION public.xp_for_level(p_level INT)
RETURNS BIGINT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ((p_level - 1)::NUMERIC * (p_level - 1) * 100)::BIGINT;
$$;

-- ── Function: award_xp ───────────────────────────────────────────────────────
-- Called by edge functions to safely award XP and update profile stats.
-- Returns: new_xp_total, new_level
CREATE OR REPLACE FUNCTION public.award_xp(
  p_user_id UUID,
  p_action  TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(new_xp_total BIGINT, new_level INT, xp_awarded INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_xp          INT;
  v_current_xp  BIGINT;
  v_current_lvl INT;
  v_new_xp      BIGINT;
  v_new_lvl     INT;
  v_action_desc TEXT;
BEGIN
  -- Only allow service_role or the user themselves (via admin functions)
  IF auth.uid() <> p_user_id AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'You can only award XP to yourself.';
  END IF;

  -- Get XP value for this action
  SELECT xp INTO v_xp FROM public.xp_actions WHERE action = p_action;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown action: %', p_action;
  END IF;

  -- Insert XP log
  INSERT INTO public.xp_log (user_id, action, xp_awarded, metadata)
  VALUES (p_user_id, p_action, v_xp, p_metadata);

  -- Update or insert daily activity
  INSERT INTO public.user_daily_activity (user_id, date, xp_earned)
  VALUES (p_user_id, CURRENT_DATE, v_xp)
  ON CONFLICT (user_id, date)
  DO UPDATE SET xp_earned = user_daily_activity.xp_earned + v_xp;

  -- Update profile XP
  UPDATE public.profiles
  SET xp_total = xp_total + v_xp
  WHERE id = p_user_id
  RETURNING xp_total INTO v_new_xp;

  -- Calculate new level
  v_new_lvl := public.calculate_level(v_new_xp);

  -- Get existing level
  SELECT level INTO v_current_lvl FROM public.profiles WHERE id = p_user_id;

  -- Update level if changed
  IF v_new_lvl > v_current_lvl THEN
    UPDATE public.profiles SET level = v_new_lvl WHERE id = p_user_id;
  END IF;

  xp_awarded := v_xp;
  new_xp_total := v_new_xp;
  new_level := v_new_lvl;

  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_xp(UUID, TEXT, JSONB) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.award_xp(UUID, TEXT, JSONB) TO authenticated, service_role;

-- ── Function: evaluate_badges ────────────────────────────────────────────────
-- Evaluates all unearned badges for a user and inserts any newly earned.
-- Returns the list of newly unlocked badges with their details.
CREATE OR REPLACE FUNCTION public.evaluate_badges(p_user_id UUID)
RETURNS TABLE(
  badge_id       UUID,
  badge_slug     TEXT,
  badge_name     TEXT,
  badge_description TEXT,
  badge_icon     TEXT,
  badge_category TEXT,
  badge_tier     SMALLINT,
  badge_xp_reward INT
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
BEGIN
  -- Only allow service_role or the user to evaluate badges for themselves
  IF auth.uid() <> p_user_id AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'You can only evaluate badges for yourself.';
  END IF;

  -- ── Collect user stats ─────────────────────────────────────────────────────

  -- Roam count: count of unique URLs seen
  SELECT COUNT(*) INTO v_roam_count FROM public.seen_urls WHERE user_id = p_user_id;

  -- Save count
  SELECT COUNT(*) INTO v_save_count FROM public.saved_urls WHERE user_id = p_user_id;

  -- Submit count
  SELECT COUNT(*) INTO v_submit_count FROM public.moderation_queue WHERE submitted_by = p_user_id;
  SELECT COUNT(*) INTO v_approved_count FROM public.moderation_queue
    WHERE submitted_by = p_user_id AND status = 'approved';

  -- Collection count
  SELECT COUNT(*) INTO v_collection_count FROM public.collections WHERE user_id = p_user_id;

  -- Follower/following
  SELECT COUNT(*) INTO v_follower_count FROM public.follows WHERE following_id = p_user_id AND is_pending = FALSE;
  SELECT COUNT(*) INTO v_following_count FROM public.follows WHERE follower_id = p_user_id AND is_pending = FALSE;

  -- Rate count
  SELECT COUNT(*) INTO v_rate_count FROM public.url_ratings WHERE user_id = p_user_id;

  -- Unique domains roamed
  SELECT COUNT(DISTINCT u.domain) INTO v_unique_domains
  FROM public.seen_urls su
  JOIN public.urls u ON u.id = su.seen_url_id
  WHERE su.user_id = p_user_id;

  -- Unique categories roamed
  SELECT COUNT(DISTINCT u.category_id) INTO v_unique_cat_roam
  FROM public.seen_urls su
  JOIN public.urls u ON u.id = su.seen_url_id
  WHERE su.user_id = p_user_id;

  -- Unique categories saved
  SELECT COUNT(DISTINCT u.category_id) INTO v_unique_cat_save
  FROM public.saved_urls su
  JOIN public.urls u ON u.id = su.url_id
  WHERE su.user_id = p_user_id;

  -- Profile stats
  SELECT p.streak_days, p.level, p.xp_total, p.created_at
    INTO v_streak_days, v_level, v_xp_total, v_account_age_days
    FROM public.profiles p WHERE p.id = p_user_id;
  v_account_age_days := EXTRACT(DAY FROM now() - v_account_age_days)::INT;

  -- Today's activity
  SELECT COALESCE(roam_count, 0), COALESCE(save_count, 0)
    INTO v_today_roam, v_today_save
    FROM public.user_daily_activity WHERE user_id = p_user_id AND date = CURRENT_DATE;

  -- ── Evaluate each unearned badge ───────────────────────────────────────────

  FOR v_badge IN
    SELECT * FROM public.badges
    WHERE id NOT IN (
      SELECT badge_id FROM public.user_badges WHERE user_id = p_user_id
    )
    AND is_gift_only = FALSE  -- gift-only badges must be manually granted
    AND category != 'milestone' -- milestone evaluated separately below
  LOOP
    v_count := 0;
    v_progress := 0;

    CASE v_badge.slug

      -- === EXPLORATION ===
      WHEN 'first-roam' THEN
        v_progress := LEAST(v_roam_count, 1);
        IF v_roam_count >= 1 THEN v_count := 1; END IF;

      WHEN 'wanderer-bronze' THEN
        v_progress := LEAST(v_roam_count::INT, 10);
        IF v_roam_count >= 10 THEN v_count := 1; END IF;

      WHEN 'wanderer-silver' THEN
        v_progress := LEAST(v_roam_count::INT, 50);
        IF v_roam_count >= 50 THEN v_count := 1; END IF;

      WHEN 'wanderer-gold' THEN
        v_progress := LEAST(v_roam_count::INT, 200);
        IF v_roam_count >= 200 THEN v_count := 1; END IF;

      WHEN 'nomad-bronze' THEN
        v_progress := LEAST(v_roam_count::INT, 500);
        IF v_roam_count >= 500 THEN v_count := 1; END IF;

      WHEN 'nomad-silver' THEN
        v_progress := LEAST(v_roam_count::INT, 1000);
        IF v_roam_count >= 1000 THEN v_count := 1; END IF;

      WHEN 'nomad-gold' THEN
        v_progress := LEAST(v_roam_count::INT, 5000);
        IF v_roam_count >= 5000 THEN v_count := 1; END IF;

      WHEN 'nomad-platinum' THEN
        v_progress := LEAST(v_roam_count::INT, 10000);
        IF v_roam_count >= 10000 THEN v_count := 1; END IF;

      -- night-owl: check if any roams were between 00:00-04:00 UTC
      WHEN 'night-owl' THEN
        SELECT COUNT(*) INTO v_count FROM public.seen_urls
          WHERE user_id = p_user_id
            AND EXTRACT(HOUR FROM seen_at) BETWEEN 0 AND 3;
        v_progress := LEAST(v_count::INT, 1);

      WHEN 'early-bird' THEN
        SELECT COUNT(*) INTO v_count FROM public.seen_urls
          WHERE user_id = p_user_id
            AND EXTRACT(HOUR FROM seen_at) BETWEEN 5 AND 7;
        v_progress := LEAST(v_count::INT, 1);

      WHEN 'globetrotter-bronze' THEN
        v_progress := LEAST(v_unique_domains::INT, 5);
        IF v_unique_domains >= 5 THEN v_count := 1; END IF;

      WHEN 'globetrotter-silver' THEN
        v_progress := LEAST(v_unique_domains::INT, 15);
        IF v_unique_domains >= 15 THEN v_count := 1; END IF;

      WHEN 'globetrotter-gold' THEN
        v_progress := LEAST(v_unique_domains::INT, 30);
        IF v_unique_domains >= 30 THEN v_count := 1; END IF;

      WHEN 'category-explorer-bronze' THEN
        v_progress := LEAST(v_unique_cat_roam::INT, 3);
        IF v_unique_cat_roam >= 3 THEN v_count := 1; END IF;

      WHEN 'category-explorer-silver' THEN
        v_progress := LEAST(v_unique_cat_roam::INT, 5);
        IF v_unique_cat_roam >= 5 THEN v_count := 1; END IF;

      WHEN 'category-explorer-gold' THEN
        -- "All categories" = count of all categories in the system
        SELECT COUNT(*) INTO v_count FROM public.categories;
        v_progress := v_unique_cat_roam::INT;
        IF v_unique_cat_roam >= v_count THEN v_count := 1; ELSE v_count := 0; END IF;

      -- === COLLECTING ===
      WHEN 'first-save' THEN
        v_progress := LEAST(v_save_count::INT, 1);
        IF v_save_count >= 1 THEN v_count := 1; END IF;

      WHEN 'collector-bronze' THEN
        v_progress := LEAST(v_save_count::INT, 10);
        IF v_save_count >= 10 THEN v_count := 1; END IF;

      WHEN 'collector-silver' THEN
        v_progress := LEAST(v_save_count::INT, 50);
        IF v_save_count >= 50 THEN v_count := 1; END IF;

      WHEN 'collector-gold' THEN
        v_progress := LEAST(v_save_count::INT, 200);
        IF v_save_count >= 200 THEN v_count := 1; END IF;

      WHEN 'collector-platinum' THEN
        v_progress := LEAST(v_save_count::INT, 1000);
        IF v_save_count >= 1000 THEN v_count := 1; END IF;

      WHEN 'archivist-bronze' THEN
        v_progress := LEAST(v_save_count::INT, 500);
        IF v_save_count >= 500 THEN v_count := 1; END IF;

      WHEN 'archivist-silver' THEN
        v_progress := LEAST(v_save_count::INT, 2000);
        IF v_save_count >= 2000 THEN v_count := 1; END IF;

      WHEN 'archivist-gold' THEN
        v_progress := LEAST(v_save_count::INT, 5000);
        IF v_save_count >= 5000 THEN v_count := 1; END IF;

      WHEN 'tagger-bronze' THEN
        v_progress := LEAST(v_unique_cat_save::INT, 3);
        IF v_unique_cat_save >= 3 THEN v_count := 1; END IF;

      WHEN 'tagger-silver' THEN
        v_progress := LEAST(v_unique_cat_save::INT, 6);
        IF v_unique_cat_save >= 6 THEN v_count := 1; END IF;

      WHEN 'tagger-gold' THEN
        v_progress := LEAST(v_unique_cat_save::INT, 10);
        IF v_unique_cat_save >= 10 THEN v_count := 1; END IF;

      WHEN 'completionist' THEN
        SELECT COUNT(*) INTO v_count FROM public.categories;
        v_progress := v_unique_cat_save::INT;
        IF v_unique_cat_save >= v_count THEN v_count := 1; ELSE v_count := 0; END IF;

      WHEN 'speed-collector' THEN
        IF v_today_save >= 10 THEN v_count := 1; END IF;
        v_progress := LEAST(v_today_save, 10);

      WHEN 'mega-collector' THEN
        IF v_today_save >= 50 THEN v_count := 1; END IF;
        v_progress := LEAST(v_today_save, 50);

      -- === CURATING ===
      WHEN 'first-collection' THEN
        v_progress := LEAST(v_collection_count::INT, 1);
        IF v_collection_count >= 1 THEN v_count := 1; END IF;

      WHEN 'curator-bronze' THEN
        v_progress := LEAST(v_collection_count::INT, 3);
        IF v_collection_count >= 3 THEN v_count := 1; END IF;

      WHEN 'curator-silver' THEN
        v_progress := LEAST(v_collection_count::INT, 10);
        IF v_collection_count >= 10 THEN v_count := 1; END IF;

      WHEN 'curator-gold' THEN
        v_progress := LEAST(v_collection_count::INT, 25);
        IF v_collection_count >= 25 THEN v_count := 1; END IF;

      WHEN 'curator-supreme' THEN
        v_progress := LEAST(v_collection_count::INT, 50);
        IF v_collection_count >= 50 THEN v_count := 1; END IF;

      WHEN 'pack-rat-bronze' THEN
        SELECT COALESCE(MAX(ci_count.cnt), 0)::INT INTO v_progress
          FROM (SELECT COUNT(*) AS cnt FROM public.collection_items ci
                JOIN public.collections c ON c.id = ci.collection_id
                WHERE c.user_id = p_user_id GROUP BY c.id) ci_count;
        IF v_progress >= 10 THEN v_count := 1; END IF;

      WHEN 'pack-rat-silver' THEN
        SELECT COALESCE(MAX(ci_count.cnt), 0)::INT INTO v_progress
          FROM (SELECT COUNT(*) AS cnt FROM public.collection_items ci
                JOIN public.collections c ON c.id = ci.collection_id
                WHERE c.user_id = p_user_id GROUP BY c.id) ci_count;
        IF v_progress >= 50 THEN v_count := 1; END IF;

      WHEN 'pack-rat-gold' THEN
        SELECT COALESCE(MAX(ci_count.cnt), 0)::INT INTO v_progress
          FROM (SELECT COUNT(*) AS cnt FROM public.collection_items ci
                JOIN public.collections c ON c.id = ci.collection_id
                WHERE c.user_id = p_user_id GROUP BY c.id) ci_count;
        IF v_progress >= 200 THEN v_count := 1; END IF;

      WHEN 'public-curator' THEN
        SELECT COUNT(*) INTO v_count FROM public.collections
          WHERE user_id = p_user_id AND is_public = TRUE;
        v_progress := LEAST(v_count::INT, 5);
        IF v_count >= 5 THEN v_count := 1; ELSE v_count := 0; END IF;

      -- favorited: use collection_favorites table if it exists
      WHEN 'favorited-bronze' THEN
        BEGIN
          SELECT COALESCE(SUM(fav_count.cnt), 0)::INT INTO v_progress
            FROM (SELECT COUNT(*) AS cnt FROM public.collection_favorites cf
                  JOIN public.collections c ON c.id = cf.collection_id
                  WHERE c.user_id = p_user_id GROUP BY cf.collection_id) fav_count;
        EXCEPTION WHEN undefined_table THEN
          v_progress := 0;
        END;
        IF v_progress >= 5 THEN v_count := 1; END IF;

      WHEN 'favorited-silver' THEN
        BEGIN
          SELECT COALESCE(SUM(fav_count.cnt), 0)::INT INTO v_progress
            FROM (SELECT COUNT(*) AS cnt FROM public.collection_favorites cf
                  JOIN public.collections c ON c.id = cf.collection_id
                  WHERE c.user_id = p_user_id GROUP BY cf.collection_id) fav_count;
        EXCEPTION WHEN undefined_table THEN
          v_progress := 0;
        END;
        IF v_progress >= 25 THEN v_count := 1; END IF;

      WHEN 'favorited-gold' THEN
        BEGIN
          SELECT COALESCE(SUM(fav_count.cnt), 0)::INT INTO v_progress
            FROM (SELECT COUNT(*) AS cnt FROM public.collection_favorites cf
                  JOIN public.collections c ON c.id = cf.collection_id
                  WHERE c.user_id = p_user_id GROUP BY cf.collection_id) fav_count;
        EXCEPTION WHEN undefined_table THEN
          v_progress := 0;
        END;
        IF v_progress >= 100 THEN v_count := 1; END IF;

      -- === SOCIAL ===
      WHEN 'social-butterfly-bronze' THEN
        v_progress := LEAST(v_following_count::INT, 5);
        IF v_following_count >= 5 THEN v_count := 1; END IF;

      WHEN 'social-butterfly-silver' THEN
        v_progress := LEAST(v_following_count::INT, 25);
        IF v_following_count >= 25 THEN v_count := 1; END IF;

      WHEN 'social-butterfly-gold' THEN
        v_progress := LEAST(v_following_count::INT, 100);
        IF v_following_count >= 100 THEN v_count := 1; END IF;

      WHEN 'influencer-bronze' THEN
        v_progress := LEAST(v_follower_count::INT, 10);
        IF v_follower_count >= 10 THEN v_count := 1; END IF;

      WHEN 'influencer-silver' THEN
        v_progress := LEAST(v_follower_count::INT, 50);
        IF v_follower_count >= 50 THEN v_count := 1; END IF;

      WHEN 'influencer-gold' THEN
        v_progress := LEAST(v_follower_count::INT, 200);
        IF v_follower_count >= 200 THEN v_count := 1; END IF;

      WHEN 'influencer-platinum' THEN
        v_progress := LEAST(v_follower_count::INT, 1000);
        IF v_follower_count >= 1000 THEN v_count := 1; END IF;

      -- friendly-face: check if there's a mutual follow
      WHEN 'friendly-face' THEN
        SELECT COUNT(*) INTO v_count FROM public.follows f1
          WHERE f1.follower_id = p_user_id
            AND EXISTS (SELECT 1 FROM public.follows f2
                        WHERE f2.follower_id = f1.following_id
                          AND f2.following_id = p_user_id
                          AND f2.is_pending = FALSE)
            AND f1.is_pending = FALSE;
        v_progress := LEAST(v_count::INT, 1);

      WHEN 'first-share' THEN
        -- Shared URLs tracking would need a shares table; skip for now (count=0)
        v_count := 0;
        v_progress := 0;

      WHEN 'profile-perfectionist' THEN
        SELECT CASE WHEN p.bio IS NOT NULL AND p.bio != ''
                      AND p.display_name IS NOT NULL AND p.display_name != ''
                      AND p.avatar_url IS NOT NULL AND p.avatar_url != ''
                    THEN 1 ELSE 0 END INTO v_count
        FROM public.profiles p WHERE p.id = p_user_id;
        v_progress := v_count::INT;

      -- === STREAKS ===
      WHEN 'hot-streak-bronze' THEN
        v_progress := LEAST(v_streak_days, 3);
        IF v_streak_days >= 3 THEN v_count := 1; END IF;

      WHEN 'hot-streak-silver' THEN
        v_progress := LEAST(v_streak_days, 7);
        IF v_streak_days >= 7 THEN v_count := 1; END IF;

      WHEN 'hot-streak-gold' THEN
        v_progress := LEAST(v_streak_days, 30);
        IF v_streak_days >= 30 THEN v_count := 1; END IF;

      WHEN 'unstoppable' THEN
        v_progress := LEAST(v_streak_days, 60);
        IF v_streak_days >= 60 THEN v_count := 1; END IF;

      WHEN 'phoenix' THEN
        v_progress := LEAST(v_streak_days, 100);
        IF v_streak_days >= 100 THEN v_count := 1; END IF;

      WHEN 'comeback' THEN
        -- Check if user had 7+ days of inactivity then roamed
        SELECT CASE WHEN MAX(date) < CURRENT_DATE - INTERVAL '7 days'
                      AND EXISTS (SELECT 1 FROM public.user_daily_activity
                                   WHERE user_id = p_user_id AND date = CURRENT_DATE)
                    THEN 1 ELSE 0 END INTO v_count
        FROM public.user_daily_activity WHERE user_id = p_user_id;
        v_progress := v_count::INT;

      -- === CONTRIBUTING ===
      WHEN 'first-submission' THEN
        v_progress := LEAST(v_submit_count::INT, 1);
        IF v_submit_count >= 1 THEN v_count := 1; END IF;

      WHEN 'contributor-bronze' THEN
        v_progress := LEAST(v_submit_count::INT, 5);
        IF v_submit_count >= 5 THEN v_count := 1; END IF;

      WHEN 'contributor-silver' THEN
        v_progress := LEAST(v_submit_count::INT, 25);
        IF v_submit_count >= 25 THEN v_count := 1; END IF;

      WHEN 'contributor-gold' THEN
        v_progress := LEAST(v_submit_count::INT, 100);
        IF v_submit_count >= 100 THEN v_count := 1; END IF;

      WHEN 'approved-bronze' THEN
        v_progress := LEAST(v_approved_count::INT, 5);
        IF v_approved_count >= 5 THEN v_count := 1; END IF;

      WHEN 'approved-silver' THEN
        v_progress := LEAST(v_approved_count::INT, 25);
        IF v_approved_count >= 25 THEN v_count := 1; END IF;

      WHEN 'approved-gold' THEN
        v_progress := LEAST(v_approved_count::INT, 100);
        IF v_approved_count >= 100 THEN v_count := 1; END IF;

      WHEN 'quality-control' THEN
        IF v_submit_count >= 10 THEN
          v_progress := ((v_approved_count::NUMERIC / v_submit_count) * 100)::INT;
          IF (v_approved_count::NUMERIC / v_submit_count) >= 0.9 THEN v_count := 1; END IF;
        ELSE
          v_progress := v_submit_count::INT;
        END IF;

      -- citizen-journalist: submitted URL with 100+ seen_urls entries
      WHEN 'citizen-journalist' THEN
        SELECT COUNT(*) INTO v_count FROM public.moderation_queue mq
          JOIN public.urls u ON u.url = mq.url
          WHERE mq.submitted_by = p_user_id
            AND (SELECT COUNT(*) FROM public.seen_urls su WHERE su.seen_url_id = u.id) >= 100;
        v_progress := LEAST(v_count::INT, 1);

      -- === ENGAGEMENT ===
      WHEN 'rater-bronze' THEN
        v_progress := LEAST(v_rate_count::INT, 25);
        IF v_rate_count >= 25 THEN v_count := 1; END IF;

      WHEN 'rater-silver' THEN
        v_progress := LEAST(v_rate_count::INT, 100);
        IF v_rate_count >= 100 THEN v_count := 1; END IF;

      WHEN 'rater-gold' THEN
        v_progress := LEAST(v_rate_count::INT, 500);
        IF v_rate_count >= 500 THEN v_count := 1; END IF;

      WHEN 'critic' THEN
        v_progress := LEAST(v_rate_count::INT, 1000);
        IF v_rate_count >= 1000 THEN v_count := 1; END IF;

      -- omnivore: check if user has roamed in all discovery modes
      WHEN 'omnivore' THEN
        SELECT CASE WHEN COUNT(DISTINCT discovery_mode) >= 3 THEN 1 ELSE 0 END INTO v_count
          FROM (SELECT unnest(ARRAY['discovery', 'latest', 'trending']) AS discovery_mode) modes
          WHERE EXISTS (SELECT 1 FROM public.user_settings us
                        WHERE us.user_id = p_user_id AND us.discovery_mode = modes.discovery_mode);
        v_progress := v_count::INT;

      WHEN 'marathon' THEN
        v_progress := LEAST(v_today_roam, 100);
        IF v_today_roam >= 100 THEN v_count := 1; END IF;

      WHEN 'loyalist' THEN
        -- Account 1+ year with activity every month
        IF v_account_age_days >= 365 THEN
          SELECT CASE WHEN COUNT(DISTINCT DATE_TRUNC('month', date)) >= 12 THEN 1 ELSE 0 END INTO v_count
            FROM public.user_daily_activity
            WHERE user_id = p_user_id AND date >= now() - INTERVAL '12 months';
          v_progress := (SELECT COUNT(DISTINCT DATE_TRUNC('month', date))::INT
                          FROM public.user_daily_activity
                          WHERE user_id = p_user_id AND date >= now() - INTERVAL '12 months');
        ELSE
          v_progress := v_account_age_days::INT;
        END IF;

      WHEN 'weekend-warrior' THEN
        -- Roamed on 4 consecutive weekends
        SELECT CASE WHEN EXISTS (
          SELECT 1 FROM public.user_daily_activity
          WHERE user_id = p_user_id AND date = CURRENT_DATE
            AND EXTRACT(DOW FROM date) IN (0, 6) -- Sunday or Saturday
        ) AND EXISTS (
          SELECT 1 FROM public.user_daily_activity
          WHERE user_id = p_user_id AND date = CURRENT_DATE - INTERVAL '7 days'
            AND EXTRACT(DOW FROM date) IN (0, 6)
        ) AND EXISTS (
          SELECT 1 FROM public.user_daily_activity
          WHERE user_id = p_user_id AND date = CURRENT_DATE - INTERVAL '14 days'
            AND EXTRACT(DOW FROM date) IN (0, 6)
        ) AND EXISTS (
          SELECT 1 FROM public.user_daily_activity
          WHERE user_id = p_user_id AND date = CURRENT_DATE - INTERVAL '21 days'
            AND EXTRACT(DOW FROM date) IN (0, 6)
        ) THEN 1 ELSE 0 END INTO v_count;
        v_progress := v_count::INT;

      WHEN 'diversity-champ' THEN
        SELECT COUNT(DISTINCT u.language)::INT INTO v_progress
        FROM public.saved_urls su
        JOIN public.urls u ON u.id = su.url_id
        WHERE su.user_id = p_user_id AND u.language IS NOT NULL;
        IF v_progress >= 5 THEN v_count := 1; END IF;

      -- === SECRET ===
      WHEN 'error-404-explorer' THEN
        -- Requires tracking 404 responses; skip unless tracked
        v_count := 0;
        v_progress := 0;

      WHEN 'time-traveler' THEN
        SELECT COUNT(*) INTO v_count FROM public.seen_urls su
          JOIN public.urls u ON u.id = su.seen_url_id
          WHERE su.user_id = p_user_id AND u.created_at < '2006-01-01'::DATE;
        v_progress := LEAST(v_count::INT, 1);

      WHEN 'polyglot' THEN
        SELECT COUNT(DISTINCT u.language)::INT INTO v_progress
        FROM public.saved_urls su
        JOIN public.urls u ON u.id = su.url_id
        WHERE su.user_id = p_user_id AND u.language IS NOT NULL;
        IF v_progress >= 3 THEN v_count := 1; END IF;

      WHEN 'easter-egg' THEN
        -- Requires a specific hidden URL interaction; skip
        v_count := 0;
        v_progress := 0;

      WHEN 'lunar-roamer' THEN
        -- Fun badge: requires checking moon phase; skip for now
        v_count := 0;
        v_progress := 0;

      WHEN 'lucky-777' THEN
        v_progress := LEAST(v_roam_count::INT, 777);
        IF v_roam_count = 777 THEN v_count := 1; END IF;

      WHEN 'midnight-oil' THEN
        SELECT COUNT(*) INTO v_progress FROM public.seen_urls
          WHERE user_id = p_user_id AND EXTRACT(HOUR FROM seen_at) BETWEEN 0 AND 3;
        IF v_progress >= 50 THEN v_count := 1; END IF;

      ELSE
        -- Unknown badge slug, skip
        CONTINUE;
    END CASE;

    -- ── Award badge if earned ───────────────────────────────────────────────
    IF v_count > 0 THEN
      -- Check prerequisite tiered badge (if parent_badge_slug is set)
      IF v_badge.parent_badge_slug IS NOT NULL THEN
        SELECT id INTO v_parent_badge_id FROM public.badges WHERE slug = v_badge.parent_badge_slug;
        IF NOT EXISTS (
          SELECT 1 FROM public.user_badges WHERE user_id = p_user_id AND badge_id = v_parent_badge_id
        ) THEN
          -- Prerequisite not yet earned; skip this badge but still track progress
          CONTINUE;
        END IF;
      END IF;

      -- Insert the badge
      INSERT INTO public.user_badges (user_id, badge_id, progress_current)
      VALUES (p_user_id, v_badge.id, v_progress)
      ON CONFLICT DO NOTHING;

      -- If inserted, award XP and return
      IF FOUND THEN
        v_badge_xp_awarded := v_badge_xp_awarded + v_badge.xp_reward;
        v_new_count := v_new_count + 1;

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
      -- Update progress for in-progress badges
      INSERT INTO public.user_badges (user_id, badge_id, progress_current, unlocked_at)
      VALUES (p_user_id, v_badge.id, v_progress, NULL)
      ON CONFLICT (user_id, badge_id)
      DO UPDATE SET progress_current = EXCLUDED.progress_current;
    END IF;
  END LOOP;

  -- ── Evaluate milestone badges (level-based) ────────────────────────────────
  FOR v_badge IN
    SELECT * FROM public.badges
    WHERE category = 'milestone'
      AND is_gift_only = FALSE
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
      WHEN 'centurion-badges' THEN
        SELECT COUNT(*) INTO v_count FROM public.user_badges WHERE user_id = p_user_id;
        IF v_count >= 100 THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'master-roamer' THEN
        IF v_level >= 50 AND (SELECT COUNT(*) FROM public.user_badges WHERE user_id = p_user_id) >= 50
        THEN v_count := 1; ELSE v_count := 0; END IF;
      WHEN 'grandmaster' THEN
        IF v_level >= 100 AND (SELECT COUNT(*) FROM public.user_badges ub
           JOIN public.badges b ON b.id = ub.badge_id
           WHERE ub.user_id = p_user_id AND b.is_hidden = FALSE AND b.is_gift_only = FALSE)
           >= (SELECT COUNT(*) FROM public.badges WHERE is_hidden = FALSE AND is_gift_only = FALSE AND category != 'milestone')
        THEN v_count := 1; ELSE v_count := 0; END IF;
      ELSE
        CONTINUE;
    END CASE;

    IF v_count > 0 THEN
      INSERT INTO public.user_badges (user_id, badge_id, progress_current)
      VALUES (p_user_id, v_badge.id, 0)
      ON CONFLICT DO NOTHING;

      IF FOUND THEN
        v_badge_xp_awarded := v_badge_xp_awarded + v_badge.xp_reward;
        v_new_count := v_new_count + 1;

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
    END IF;
  END LOOP;

  -- ── Award XP for all new badges in one lump ────────────────────────────────
  IF v_badge_xp_awarded > 0 THEN
    INSERT INTO public.xp_log (user_id, action, xp_awarded, metadata)
    VALUES (p_user_id, 'badge_rewards', v_badge_xp_awarded,
            jsonb_build_object('badge_count', v_new_count));

    UPDATE public.profiles
    SET xp_total = xp_total + v_badge_xp_awarded,
        badge_count = badge_count + v_new_count
    WHERE id = p_user_id;
  END IF;

  -- Recalculate level after badge XP
  SELECT xp_total, public.calculate_level(xp_total) INTO v_xp_total, v_level
    FROM public.profiles WHERE id = p_user_id;

  UPDATE public.profiles SET level = v_level WHERE id = p_user_id AND level <> v_level;

END;
$$;

REVOKE EXECUTE ON FUNCTION public.evaluate_badges(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.evaluate_badges(UUID) TO authenticated, service_role;

-- ── Function: update_streak ─────────────────────────────────────────────────
-- Updates a user's daily streak. Call after each roam.
CREATE OR REPLACE FUNCTION public.update_streak(p_user_id UUID)
RETURNS TABLE(streak_days INT, max_streak INT, is_streak_broken BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_last_active DATE;
  v_current_streak INT;
  v_max_streak INT;
  v_is_broken BOOLEAN := FALSE;
BEGIN
  IF auth.uid() <> p_user_id AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'You can only update your own streak.';
  END IF;

  -- Get last activity date (excluding today)
  SELECT MAX(date) INTO v_last_active
    FROM public.user_daily_activity
    WHERE user_id = p_user_id AND date < CURRENT_DATE;

  -- Update or create today's activity
  INSERT INTO public.user_daily_activity (user_id, date, roam_count)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, date)
  DO UPDATE SET roam_count = user_daily_activity.roam_count + 1;

  -- Calculate streak
  SELECT streak_days, max_streak INTO v_current_streak, v_max_streak
    FROM public.profiles WHERE id = p_user_id;

  IF v_last_active IS NULL OR v_last_active < CURRENT_DATE - INTERVAL '1 day' THEN
    -- Streak broken (or first ever activity)
    IF v_current_streak > 1 THEN
      v_is_broken := TRUE;
    END IF;
    v_current_streak := 1;
  ELSIF v_last_active = CURRENT_DATE - INTERVAL '1 day' THEN
    -- Consecutive day
    v_current_streak := v_current_streak + 1;
  END IF;

  -- Update max streak
  IF v_current_streak > v_max_streak THEN
    v_max_streak := v_current_streak;
  END IF;

  -- Save to profile
  UPDATE public.profiles
  SET streak_days = v_current_streak, max_streak = v_max_streak
  WHERE id = p_user_id;

  streak_days := v_current_streak;
  max_streak := v_max_streak;
  is_streak_broken := v_is_broken;

  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_streak(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.update_streak(UUID) TO authenticated, service_role;

-- ── Function: grant_badge (for admin gifting) ────────────────────────────────
CREATE OR REPLACE FUNCTION public.grant_badge(
  p_user_id UUID,
  p_badge_slug TEXT,
  p_granted_by UUID
)
RETURNS TABLE(
  badge_id UUID, badge_slug TEXT, badge_name TEXT, badge_icon TEXT, 
  badge_category TEXT, badge_xp_reward INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_badge RECORD;
BEGIN
  -- Must be admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can grant badges.';
  END IF;

  SELECT * INTO v_badge FROM public.badges WHERE slug = p_badge_slug;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Badge not found: %', p_badge_slug;
  END IF;

  -- Insert the badge
  INSERT INTO public.user_badges (user_id, badge_id, granted_by, progress_current)
  VALUES (p_user_id, v_badge.id, p_granted_by, 0)
  ON CONFLICT (user_id, badge_id) DO NOTHING;

  IF FOUND THEN
    -- Award XP for the badge
    IF v_badge.xp_reward > 0 THEN
      INSERT INTO public.xp_log (user_id, action, xp_awarded, metadata)
      VALUES (p_user_id, 'badge_gifted', v_badge.xp_reward,
              jsonb_build_object('badge_slug', p_badge_slug, 'granted_by', p_granted_by));

      UPDATE public.profiles
      SET xp_total = xp_total + v_badge.xp_reward,
          badge_count = badge_count + 1,
          level = public.calculate_level(xp_total + v_badge.xp_reward)
      WHERE id = p_user_id;
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

REVOKE EXECUTE ON FUNCTION public.grant_badge(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.grant_badge(UUID, TEXT, UUID) TO authenticated, service_role;

-- ── Function: get_user_badges ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_badges(p_user_id UUID)
RETURNS TABLE(
  id UUID,
  slug TEXT,
  name TEXT,
  description TEXT,
  icon TEXT,
  category TEXT,
  tier SMALLINT,
  required_count INT,
  is_unlocked BOOLEAN,
  unlocked_at TIMESTAMPTZ,
  progress_current INT,
  is_hidden BOOLEAN,
  is_gift_only BOOLEAN,
  xp_reward INT,
  parent_badge_slug TEXT,
  granted_by UUID
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.slug,
    b.name,
    b.description,
    b.icon,
    b.category,
    b.tier,
    b.required_count,
    ub.user_id IS NOT NULL AND ub.unlocked_at IS NOT NULL AS is_unlocked,
    ub.unlocked_at,
    COALESCE(ub.progress_current, 0)::INT AS progress_current,
    b.is_hidden,
    b.is_gift_only,
    b.xp_reward,
    b.parent_badge_slug,
    ub.granted_by
  FROM public.badges b
  LEFT JOIN public.user_badges ub ON ub.badge_id = b.id AND ub.user_id = p_user_id
  ORDER BY
    CASE b.category
      WHEN 'exploration' THEN 1
      WHEN 'collecting' THEN 2
      WHEN 'curating' THEN 3
      WHEN 'social' THEN 4
      WHEN 'streaks' THEN 5
      WHEN 'contributing' THEN 6
      WHEN 'engagement' THEN 7
      WHEN 'milestone' THEN 8
      WHEN 'secret' THEN 9
      WHEN 'gift' THEN 10
    END,
    b.tier,
    b.name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_badges(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_user_badges(UUID) TO authenticated, service_role;