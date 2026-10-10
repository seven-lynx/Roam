-- backfill_small_orphans.sql
-- Assign subcategories to the remaining small-source orphan URLs (<200 per source).
-- These are clear-cut assignments with simple source→subcategory mappings.
--
-- Leaves the big 3 archives (internetarchive, dpla, europeana) for later.

-- 📚 arxiv → Physics & Chemistry (57 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000001-0000-0000-0000-000000000003'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'arxiv';

-- 🎵 bandcamp → Music (72 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000003-0000-0000-0000-000000000001'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'bandcamp';

-- 💻 github → Programming & Software Development (75 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000002-0000-0000-0000-000000000001'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'github';

-- 📰 guardian → Modern History (51 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000004-0000-0000-0000-000000000002'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'guardian';

-- 🐘 mastodon → Internet Culture & Web History (43 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000002-0000-0000-0000-000000000006'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'mastodon';

-- 📖 wikipedia → Modern History (31 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000004-0000-0000-0000-000000000002'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'wikipedia';

-- 🌐 kagisweb → Internet Culture & Web History (25 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000002-0000-0000-0000-000000000006'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'kagisweb';

-- ✈️ smithsonian-travel → Travel & Exploration (20 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000007-0000-0000-0000-000000000001'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'smithsonian-travel';

-- 📌 pinboard → Internet Culture & Web History (13 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000002-0000-0000-0000-000000000006'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'pinboard';

-- 💡 smithsonian-innovation → Emerging Technology (13 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000002-0000-0000-0000-000000000008'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'smithsonian-innovation';

-- 🔬 smithsonian-science → Biology & Evolution (11 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000001-0000-0000-0000-000000000002'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'smithsonian-science';

-- 📜 smithsonian-history → Modern History (9 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000004-0000-0000-0000-000000000002'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'smithsonian-history';

-- 🎨 smithsonian-arts → Visual Art & Painting (6 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000003-0000-0000-0000-000000000003'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'smithsonian-arts';

-- 🧠 lesswrong → Philosophy & Ethics (6 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000004-0000-0000-0000-000000000008'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'lesswrong';

-- 🤝 community → Subcultures & Communities (2 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000007-0000-0000-0000-000000000008'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'community';

-- 🏛️ atlas-obscura-articles → Oddities & Curiosities (153 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000006-0000-0000-0000-000000000002'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'atlas-obscura-articles';