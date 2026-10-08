-- Seed the starter tag graph edges (see scripts/lib/tag-vocabulary.mjs).
-- GENERATED FILE — do not edit by hand. Run: node scripts/generate-tag-artifacts.mjs

INSERT INTO public.tag_relations (from_tag_id, to_tag_id, relation, weight)
SELECT f.id, t.id, v.relation, v.weight
FROM (VALUES
  ('music', 'classical-music', 'broader_than', 0.8),
  ('music', 'jazz', 'broader_than', 0.8),
  ('music', 'electronic-music', 'broader_than', 0.8),
  ('music', 'hip-hop', 'broader_than', 0.8),
  ('music', 'rock-music', 'broader_than', 0.8),
  ('music', 'folk-world-music', 'broader_than', 0.8),
  ('artificial-intelligence', 'machine-learning', 'broader_than', 0.8),
  ('artificial-intelligence', 'deep-learning', 'broader_than', 0.8),
  ('artificial-intelligence', 'nlp', 'broader_than', 0.8),
  ('artificial-intelligence', 'computer-vision', 'broader_than', 0.8),
  ('machine-learning', 'deep-learning', 'broader_than', 0.8),
  ('biology', 'genetics', 'broader_than', 0.8),
  ('biology', 'evolution', 'broader_than', 0.8),
  ('biology', 'ecology', 'broader_than', 0.8),
  ('biology', 'zoology', 'broader_than', 0.8),
  ('biology', 'botany', 'broader_than', 0.8),
  ('medicine', 'immunology', 'broader_than', 0.8),
  ('medicine', 'virology', 'broader_than', 0.8),
  ('medicine', 'epidemiology', 'broader_than', 0.8),
  ('medicine', 'neuroscience', 'broader_than', 0.8),
  ('programming', 'web-development', 'broader_than', 0.8),
  ('programming', 'mobile-development', 'broader_than', 0.8),
  ('film', 'documentary', 'broader_than', 0.7),
  ('film', 'television', 'related_to', 0.5),
  ('neuroscience', 'artificial-intelligence', 'related_to', 0.5),
  ('neuroscience', 'psychology', 'related_to', 0.5),
  ('genetics', 'medicine', 'related_to', 0.6),
  ('climate-science', 'environmental-sustainability', 'related_to', 0.6),
  ('literature', 'poetry', 'related_to', 0.6),
  ('physics', 'quantum-computing', 'related_to', 0.5),
  ('economics', 'personal-finance', 'related_to', 0.5),
  ('biology', 'marine-biology', 'broader_than', 0.8),
  ('biology', 'microbiology', 'broader_than', 0.8)
) AS v(from_slug, to_slug, relation, weight)
JOIN public.tags f ON f.slug = v.from_slug
JOIN public.tags t ON t.slug = v.to_slug;
