-- Add "Cars & Automotive" subcategory under Games & Hobbies (pillar 5)
-- Needed for StumbleUpon auto/motorsports category mapping.
--
-- UUID scheme: c2{pillar:06d}-0000-0000-0000-{sort:012d}
-- Games & Hobbies pillar = 000005, next sort = 000013 (after FISHING at 000012)

INSERT INTO public.subcategories (id, category_id, name, slug, sort_order)
VALUES (
  'c2000005-0000-0000-0000-000000000013',
  'c1000000-0000-0000-0000-000000000005',
  'Cars & Automotive',
  'cars-automotive',
  13
) ON CONFLICT (id) DO NOTHING;