-- backfill_orphan_urls.sql
-- Assign subcategory_ids to approved URLs currently lacking them,
-- using source → subcategory mappings for clear-cut cases.
--
-- This reclaims ~60K orphan URLs from the pre-subcategory-era seeders.
--
-- Sources left unassigned (too broad for a single subcategory):
--   internetarchive, dpla, europeana — multi-topic cultural/archival collections

-- 📚 openlibrary → Literature & Writing (21,645 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000003-0000-0000-0000-000000000005'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'openlibrary';

-- 🎤 ted → broad — assign to Modern History / Ideas (7,465 URLs)
-- TED covers tech, science, personal dev; Modern History is a reasonable catch-all
UPDATE public.urls
SET subcategory_id = 'c2000004-0000-0000-0000-000000000002'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'ted';

-- ✈️ wikivoyage → Travel & Exploration (623 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000007-0000-0000-0000-000000000001'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'wikivoyage';

-- 📖 gutenberg → Literature & Writing (272 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000003-0000-0000-0000-000000000005'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'gutenberg';

-- 💻 hackernews → Programming & Software Development (262 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000002-0000-0000-0000-000000000001'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'hackernews';

-- 🔴 reddit → Internet Culture & Web History (1,447 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000002-0000-0000-0000-000000000006'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'reddit';

-- 🌐 marginalia → Internet Culture & Web History (1,055 URLs)
-- Marginalia indexes indie/small web — closest fit is Internet Culture
UPDATE public.urls
SET subcategory_id = 'c2000002-0000-0000-0000-000000000006'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'marginalia';

-- 💬 hn-ask → Internet Culture & Web History (873 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000002-0000-0000-0000-000000000006'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'hn-ask';

-- 📰 atlantic → Modern History (360 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000004-0000-0000-0000-000000000002'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'atlantic';

-- 📰 newyorker → Modern History (82 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000004-0000-0000-0000-000000000002'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'newyorker';

-- 🔬 semanticscholar → Biology & Evolution (252 URLs)
-- Broadly academic/scientific; Biology is the largest science subcategory
UPDATE public.urls
SET subcategory_id = 'c2000001-0000-0000-0000-000000000002'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'semanticscholar';

-- 🌤️ cloudhiker → Unusual Places & Secret Spaces (211 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000006-0000-0000-0000-000000000003'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'cloudhiker';

-- 🌐 wiby → Vintage Internet & Digital Archaeology (198 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000006-0000-0000-0000-000000000008'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'wiby';

-- 🏛️ smithsonian-news → Modern History (173 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000004-0000-0000-0000-000000000002'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'smithsonian-news';

-- 📝 longform → Literature & Writing (170 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000003-0000-0000-0000-000000000005'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'longform';

-- 🚀 nasa → Space & Astronomy (85 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000001-0000-0000-0000-000000000001'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'nasa';

-- 🗺️ atlas-obscura-places → Unusual Places & Secret Spaces (81 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000006-0000-0000-0000-000000000003'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'atlas-obscura-places';