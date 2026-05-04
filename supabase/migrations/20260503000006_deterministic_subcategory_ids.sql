-- Assign deterministic UUIDs to subcategories so seeders can reference them
-- as constants (like CATEGORY.*) without a DB round-trip.
--
-- UUID scheme: c2{pillar:06d}-0000-0000-0000-{sort_order:012d}
--   pillar 1-8 = Science, Technology, Arts, History, Games, Weird, Places, Mind
--   sort_order 1-9 per pillar
--
-- Safe to run idempotently: we null-out child FKs, delete, and re-insert.
-- In practice both FK columns are all NULL right now (no seeder sets them yet).

BEGIN;

-- Null out any FK references so the DELETE below won't fail or cascade wrongly.
UPDATE public.urls             SET subcategory_id = NULL WHERE subcategory_id IS NOT NULL;
UPDATE public.user_categories  SET subcategory_id = NULL WHERE subcategory_id IS NOT NULL;

-- Drop existing random-UUID rows.
DELETE FROM public.subcategories;

-- Re-insert with deterministic IDs.
INSERT INTO public.subcategories (id, category_id, name, slug, sort_order) VALUES

  -- ── 🔬 Science & Nature (pillar 1) ─────────────────────────────────────────
  ('c2000001-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Space & Astronomy',              'space-astronomy',              1),
  ('c2000001-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'Biology & Evolution',            'biology-evolution',            2),
  ('c2000001-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 'Physics & Chemistry',            'physics-chemistry',            3),
  ('c2000001-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000001', 'Environment & Climate',          'environment-climate',          4),
  ('c2000001-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000001', 'Medicine & Health Science',      'medicine-health-science',      5),
  ('c2000001-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000001', 'Mathematics & Logic',            'mathematics-logic',            6),
  ('c2000001-0000-0000-0000-000000000007', 'c1000000-0000-0000-0000-000000000001', 'Geology & Earth Science',        'geology-earth-science',        7),
  ('c2000001-0000-0000-0000-000000000008', 'c1000000-0000-0000-0000-000000000001', 'Oceanography & Marine Life',     'oceanography-marine-life',     8),
  ('c2000001-0000-0000-0000-000000000009', 'c1000000-0000-0000-0000-000000000001', 'Paleontology & Natural History', 'paleontology-natural-history', 9),

  -- ── 💻 Technology (pillar 2) ─────────────────────────────────────────────────
  ('c2000002-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'Programming & Software Development', 'programming-software',   1),
  ('c2000002-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000002', 'Design & UX',                        'design-ux',               2),
  ('c2000002-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000002', 'AI & Machine Learning',              'ai-machine-learning',     3),
  ('c2000002-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000002', 'Hardware & Electronics',             'hardware-electronics',    4),
  ('c2000002-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000002', 'Cybersecurity & Privacy',            'cybersecurity-privacy',   5),
  ('c2000002-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000002', 'Internet Culture & Web History',     'internet-culture',        6),
  ('c2000002-0000-0000-0000-000000000007', 'c1000000-0000-0000-0000-000000000002', 'Robotics & Automation',              'robotics-automation',     7),
  ('c2000002-0000-0000-0000-000000000008', 'c1000000-0000-0000-0000-000000000002', 'Emerging Technology',                'emerging-technology',     8),
  ('c2000002-0000-0000-0000-000000000009', 'c1000000-0000-0000-0000-000000000002', 'Open Source & Dev Communities',      'open-source',             9),

  -- ── 🎨 Arts & Culture (pillar 3) ─────────────────────────────────────────────
  ('c2000003-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', 'Music',                       'music',                   1),
  ('c2000003-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000003', 'Film & Television',           'film-television',         2),
  ('c2000003-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000003', 'Visual Art & Painting',       'visual-art',              3),
  ('c2000003-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000003', 'Comics & Illustration',       'comics-illustration',     4),
  ('c2000003-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000003', 'Literature & Writing',        'literature-writing',      5),
  ('c2000003-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000003', 'Photography',                 'photography',             6),
  ('c2000003-0000-0000-0000-000000000007', 'c1000000-0000-0000-0000-000000000003', 'Architecture & Urban Design', 'architecture-urban',      7),
  ('c2000003-0000-0000-0000-000000000008', 'c1000000-0000-0000-0000-000000000003', 'Theatre & Performance',       'theatre-performance',     8),
  ('c2000003-0000-0000-0000-000000000009', 'c1000000-0000-0000-0000-000000000003', 'Fashion & Textiles',          'fashion-textiles',        9),

  -- ── 📜 History & Ideas (pillar 4) ────────────────────────────────────────────
  ('c2000004-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000004', 'Ancient & Medieval History',   'ancient-medieval-history',  1),
  ('c2000004-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000004', 'Modern History',               'modern-history',            2),
  ('c2000004-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000004', 'Philosophy & Ethics',          'philosophy-ethics',         3),
  ('c2000004-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000004', 'Politics & Geopolitics',       'politics-geopolitics',      4),
  ('c2000004-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000004', 'Religion & Mythology',         'religion-mythology',        5),
  ('c2000004-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000004', 'Anthropology & Archaeology',   'anthropology-archaeology',  6),
  ('c2000004-0000-0000-0000-000000000007', 'c1000000-0000-0000-0000-000000000004', 'Economics & Economic History', 'economics-history',         7),
  ('c2000004-0000-0000-0000-000000000008', 'c1000000-0000-0000-0000-000000000004', 'Social History & Movements',   'social-history',            8),
  ('c2000004-0000-0000-0000-000000000009', 'c1000000-0000-0000-0000-000000000004', 'Military History',             'military-history',          9),

  -- ── 🎮 Games & Hobbies (pillar 5) ────────────────────────────────────────────
  ('c2000005-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000005', 'Video Games',                     'video-games',             1),
  ('c2000005-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000005', 'Board Games & Tabletop RPGs',     'board-games-tabletop',    2),
  ('c2000005-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000005', 'Sports & Athletics',              'sports-athletics',        3),
  ('c2000005-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000005', 'Cooking & Food',                  'cooking-food',            4),
  ('c2000005-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000005', 'Crafts, DIY & Making',            'crafts-diy-making',       5),
  ('c2000005-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000005', 'Collecting & Enthusiast Culture', 'collecting',              6),
  ('c2000005-0000-0000-0000-000000000007', 'c1000000-0000-0000-0000-000000000005', 'Outdoor Activities & Adventure',  'outdoor-adventure',       7),
  ('c2000005-0000-0000-0000-000000000008', 'c1000000-0000-0000-0000-000000000005', 'Gardening & Horticulture',        'gardening-horticulture',  8),
  ('c2000005-0000-0000-0000-000000000009', 'c1000000-0000-0000-0000-000000000005', 'Puzzles & Brain Teasers',         'puzzles-brain-teasers',   9),

  -- ── 🌀 Weird & Wonderful (pillar 6) ──────────────────────────────────────────
  ('c2000006-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000006', 'Oddities & Curiosities',                'oddities-curiosities',   1),
  ('c2000006-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000006', 'True Crime & Mysteries',                'true-crime-mysteries',   2),
  ('c2000006-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000006', 'Urban Legends & Folklore',              'urban-legends-folklore', 6),
  ('c2000006-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000006', 'Paranormal & Unexplained',              'paranormal-unexplained', 3),
  ('c2000006-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000006', 'Vintage Internet & Digital Archaeology', 'vintage-internet',      4),
  ('c2000006-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000006', 'Absurdist Humour & Satire',             'absurdist-humour',       5),
  ('c2000006-0000-0000-0000-000000000007', 'c1000000-0000-0000-0000-000000000006', 'Conspiracy Theories & Fringe Ideas',    'conspiracy-fringe',      7),
  ('c2000006-0000-0000-0000-000000000008', 'c1000000-0000-0000-0000-000000000006', 'Unusual Places & Secret Spaces',        'unusual-places',         8),
  ('c2000006-0000-0000-0000-000000000009', 'c1000000-0000-0000-0000-000000000006', 'Lost Media & Forgotten Things',         'lost-media',             9),

  -- ── 🌍 People & Places (pillar 7) ────────────────────────────────────────────
  ('c2000007-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000007', 'Travel & Exploration',             'travel-exploration',    1),
  ('c2000007-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000007', 'Cities & Urban Life',              'cities-urban-life',     2),
  ('c2000007-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000007', 'Biographies & Profiles',           'biographies-profiles',  3),
  ('c2000007-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000007', 'Languages & Linguistics',          'languages-linguistics', 4),
  ('c2000007-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000007', 'Indigenous Cultures & Traditions', 'indigenous-cultures',   5),
  ('c2000007-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000007', 'Subcultures & Communities',        'subcultures-communities', 6),
  ('c2000007-0000-0000-0000-000000000007', 'c1000000-0000-0000-0000-000000000007', 'Migration & Diaspora Stories',     'migration-diaspora',    7),
  ('c2000007-0000-0000-0000-000000000008', 'c1000000-0000-0000-0000-000000000007', 'Maps & Cartography',               'maps-cartography',      8),
  ('c2000007-0000-0000-0000-000000000009', 'c1000000-0000-0000-0000-000000000007', 'Festivals, Customs & Traditions',  'festivals-customs',     9),

  -- ── 🧠 Mind & Body (pillar 8) ────────────────────────────────────────────────
  ('c2000008-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000008', 'Psychology & Human Behaviour', 'psychology-behaviour',    1),
  ('c2000008-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000008', 'Mental Health & Wellbeing',    'mental-health',           2),
  ('c2000008-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000008', 'Fitness & Movement',           'fitness-movement',        3),
  ('c2000008-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000008', 'Nutrition & Health',           'nutrition-health',        4),
  ('c2000008-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000008', 'Neuroscience & Brain Science', 'neuroscience',            5),
  ('c2000008-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000008', 'Mindfulness & Meditation',     'mindfulness-meditation',  6),
  ('c2000008-0000-0000-0000-000000000007', 'c1000000-0000-0000-0000-000000000008', 'Sleep & Recovery',             'sleep-recovery',          7),
  ('c2000008-0000-0000-0000-000000000008', 'c1000000-0000-0000-0000-000000000008', 'Relationships & Social Dynamics', 'relationships-social', 8),
  ('c2000008-0000-0000-0000-000000000009', 'c1000000-0000-0000-0000-000000000008', 'Personal Development & Habits', 'personal-development',   9);

COMMIT;
