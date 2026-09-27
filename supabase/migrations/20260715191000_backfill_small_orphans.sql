-- backfill_small_orphans.sql
-- Assign subcategories to the remaining small-source orphan URLs (<200 per source).
-- These are clear-cut assignments with simple sourceΓåÆsubcategory mappings.
--
-- Leaves the big 3 archives (internetarchive, dpla, europeana) for later.

-- ≡ƒôÜ arxiv ΓåÆ Physics & Chemistry (57 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000001-0000-0000-0000-000000000003'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'arxiv';

-- ≡ƒÄ╡ bandcamp ΓåÆ Music (72 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000003-0000-0000-0000-000000000001'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'bandcamp';

-- ≡ƒÆ╗ github ΓåÆ Programming & Software Development (75 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000002-0000-0000-0000-000000000001'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'github';

-- ≡ƒô░ guardian ΓåÆ Modern History (51 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000004-0000-0000-0000-000000000002'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'guardian';

-- ≡ƒÉÿ mastodon ΓåÆ Internet Culture & Web History (43 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000002-0000-0000-0000-000000000006'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'mastodon';

-- ≡ƒôû wikipedia ΓåÆ Modern History (31 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000004-0000-0000-0000-000000000002'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'wikipedia';

-- ≡ƒîÉ kagisweb ΓåÆ Internet Culture & Web History (25 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000002-0000-0000-0000-000000000006'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'kagisweb';

-- Γ£ê∩╕Å smithsonian-travel ΓåÆ Travel & Exploration (20 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000007-0000-0000-0000-000000000001'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'smithsonian-travel';

-- ≡ƒôî pinboard ΓåÆ Internet Culture & Web History (13 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000002-0000-0000-0000-000000000006'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'pinboard';

-- ≡ƒÆí smithsonian-innovation ΓåÆ Emerging Technology (13 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000002-0000-0000-0000-000000000008'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'smithsonian-innovation';

-- ≡ƒö¼ smithsonian-science ΓåÆ Biology & Evolution (11 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000001-0000-0000-0000-000000000002'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'smithsonian-science';

-- ≡ƒô£ smithsonian-history ΓåÆ Modern History (9 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000004-0000-0000-0000-000000000002'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'smithsonian-history';

-- ≡ƒÄ¿ smithsonian-arts ΓåÆ Visual Art & Painting (6 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000003-0000-0000-0000-000000000003'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'smithsonian-arts';

-- ≡ƒºá lesswrong ΓåÆ Philosophy & Ethics (6 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000004-0000-0000-0000-000000000008'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'lesswrong';

-- ≡ƒñ¥ community ΓåÆ Subcultures & Communities (2 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000007-0000-0000-0000-000000000008'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'community';

-- ≡ƒÅ¢∩╕Å atlas-obscura-articles ΓåÆ Oddities & Curiosities (153 URLs)
UPDATE public.urls
SET subcategory_id = 'c2000006-0000-0000-0000-000000000002'
WHERE subcategory_id IS NULL
  AND approved = true
  AND source = 'atlas-obscura-articles';