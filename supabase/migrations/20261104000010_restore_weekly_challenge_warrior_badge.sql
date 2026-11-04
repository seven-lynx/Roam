-- Restore the "Complete 5 weekly challenges" badge, which was silently dropped.
--
-- It was originally seeded in 20260805000000_challenge_system.sql under slug
-- 'weekly-warrior', but that slug was already taken by the streaks badge
-- (20260714000000_more_badges.sql: "Roam at least once per week for 12
-- consecutive weeks"). Because the challenge INSERT used ON CONFLICT DO NOTHING,
-- the duplicate was a no-op and the challenge badge never landed.
--
-- Re-insert it under a unique slug. Category 'curiosity' matches the other
-- challenge badges after the engagement -> curiosity rename
-- (20261103000002_unify_xp_badges.sql).

INSERT INTO public.badges
  (slug, name, description, icon, category, tier, required_count, xp_reward, is_hidden)
VALUES
  ('weekly-challenge-warrior', 'Weekly Challenge Warrior', 'Complete 5 weekly challenges', '🗡️', 'curiosity', 0, 5, 100, false)
ON CONFLICT (slug) DO NOTHING;
