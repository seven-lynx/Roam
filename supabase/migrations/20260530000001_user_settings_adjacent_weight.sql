-- Add adjacent_weight to user_settings.
-- Controls the maximum interest multiplier applied to sibling subcategories
-- (topics from the same pillar that the user did NOT explicitly pick).
-- Default 0.5 = half weight, preserving discovery value without flooding results
-- with unchosen topics.

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS adjacent_weight FLOAT NOT NULL DEFAULT 0.5;
