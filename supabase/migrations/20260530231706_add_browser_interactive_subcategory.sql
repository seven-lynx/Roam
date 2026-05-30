-- Add Interactive & Browser Experiences subcategory under Games & Hobbies.
INSERT INTO subcategories (id, category_id, name, slug, sort_order)
VALUES (
  'c2000005-0000-0000-0000-000000000010',
  'c1000000-0000-0000-0000-000000000005',
  'Interactive & Browser Experiences',
  'browser-interactive',
  10
)
ON CONFLICT (id) DO NOTHING;
