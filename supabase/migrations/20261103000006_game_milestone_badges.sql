-- ============================================================================
-- Game completionist ladder + score/deep-run milestones.
-- ============================================================================
-- All game achievements live in the `games` category (`milestone` is level/XP
-- and `contributing` is URL submissions).
--
-- Completionist ladder (distinct game wins, read from xp_log game:<id>:win):
--   gamer-first  — any 1 distinct win
--   gamer-3      — 3 distinct wins
--   gamer-all    — all 7 wins (unearnable until BOTFIELD ships)
--
-- Score / deep-run milestones:
--   high-score-500 / high-score-1000 — game:<id>:over score (only past level 100)
--   relay-lvl-25 / compiler-lvl-25    — game:<id>:level depth
-- ============================================================================

INSERT INTO public.badges (slug, name, description, icon, category, tier, required_count, xp_reward)
VALUES
  ('gamer-first',     'First Program',     'Win any one in-OS program',            '🎮', 'games', 1, 1,    25),
  ('gamer-3',         'Three Programs',    'Win 3 different in-OS programs',       '🕹️', 'games', 2, 3,   100),
  ('gamer-all',       'Deck Master',       'Win all 7 in-OS programs',             '👑', 'games', 3, 7,   500),
  ('high-score-500',  'Score Surfer',      'Score 500+ after clearing level 100',  '🏄', 'games', 2, 500,  50),
  ('high-score-1000', 'Score Runner',      'Score 1000+ after clearing level 100', '🚀', 'games', 3, 1000, 100),
  ('relay-lvl-25',    'Relay Runner',      'Reach level 25 in RELAY',              '🐍', 'games', 2, 25,   50),
  ('compiler-lvl-25', 'Hard Compile',      'Reach level 25 in COMPILER',           '🧱', 'games', 2, 25,   50)
ON CONFLICT (slug) DO NOTHING;
