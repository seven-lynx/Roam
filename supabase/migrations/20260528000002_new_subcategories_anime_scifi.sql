-- Add Anime & Manga and Science Fiction & Fantasy subcategories to Arts & Culture (pillar 3).
-- UUID scheme: c2{pillar:06d}-0000-0000-0000-{sort_order:012d}
INSERT INTO public.subcategories (id, category_id, name, slug, sort_order) VALUES
  ('c2000003-0000-0000-0000-000000000010', 'c1000000-0000-0000-0000-000000000003', 'Anime & Manga',               'anime-manga',       10),
  ('c2000003-0000-0000-0000-000000000011', 'c1000000-0000-0000-0000-000000000003', 'Science Fiction & Fantasy',   'scifi-fantasy',     11)
ON CONFLICT (id) DO NOTHING;
