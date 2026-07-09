-- Add PETS and FISHING subcategories under GAMES_HOBBIES (category_id c1...0005)
-- Sort order 11 and 12 respectively, extending the existing range (1-10)

INSERT INTO subcategories (id, category_id, name, sort_order)
VALUES
  ('c2000005-0000-0000-0000-000000000011', 'c1000000-0000-0000-0000-000000000005', 'Pets', 11),
  ('c2000005-0000-0000-0000-000000000012', 'c1000000-0000-0000-0000-000000000005', 'Fishing', 12)
ON CONFLICT (id) DO NOTHING;