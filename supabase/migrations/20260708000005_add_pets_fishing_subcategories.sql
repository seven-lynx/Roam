-- Add missing subcategories that were defined in scripts/lib/seed.js SUBCATEGORY
-- constants but never inserted by migration 20260503000006_deterministic_subcategory_ids.sql.
-- This fixes FK violations from seeders referencing non-existent subcategory_id rows.
--
-- Missing: ANIME_MANGA, SCIFI_FANTASY (pillar 3), BROWSER_INTERACTIVE, PETS, FISHING (pillar 5).
--
-- Uses ON CONFLICT (id) DO NOTHING for idempotency — safe to re-run.

BEGIN;

INSERT INTO public.subcategories (id, category_id, name, slug, sort_order) VALUES
  -- Arts & Culture (pillar 3) — missing 10, 11
  ('c2000003-0000-0000-0000-000000000010', 'c1000000-0000-0000-0000-000000000003', 'Anime & Manga',     'anime-manga',      10),
  ('c2000003-0000-0000-0000-000000000011', 'c1000000-0000-0000-0000-000000000003', 'Sci-Fi & Fantasy',  'scifi-fantasy',    11),

  -- Games & Hobbies (pillar 5) — missing 10, 11, 12
  ('c2000005-0000-0000-0000-000000000010', 'c1000000-0000-0000-0000-000000000005', 'Browser & Interactive', 'browser-interactive', 10),
  ('c2000005-0000-0000-0000-000000000011', 'c1000000-0000-0000-0000-000000000005', 'Pets & Animals',        'pets',                11),
  ('c2000005-0000-0000-0000-000000000012', 'c1000000-0000-0000-0000-000000000005', 'Fishing & Angling',     'fishing',             12)
ON CONFLICT (id) DO NOTHING;

COMMIT;