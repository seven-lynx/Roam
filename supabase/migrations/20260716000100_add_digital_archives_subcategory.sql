-- Add "Digital Archives & Libraries" subcategory under People & Places (pillar 7)
-- to capture 41,970 orphan URLs from internetarchive, dpla, and europeana.
--
-- UUID scheme: c2{pillar:06d}-0000-0000-0000-{sort:012d}
-- People & Places pillar = 000007, next sort = 000013 (after MOUNTAINS_ALPINE at 000012)

INSERT INTO public.subcategories (id, category_id, name, slug, sort_order)
VALUES (
  'c2000007-0000-0000-0000-000000000013',
  'c1000000-0000-0000-0000-000000000007',
  'Digital Archives & Libraries',
  'digital-archives-libraries',
  13
) ON CONFLICT (id) DO NOTHING;

-- Backfill the 3 remaining orphan sources
UPDATE public.urls
SET subcategory_id = 'c2000007-0000-0000-0000-000000000013'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source IN ('internetarchive', 'dpla', 'europeana');