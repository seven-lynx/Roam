-- =============================================================================
-- Roam — Backfill url_tags from legacy subcategory assignments
-- =============================================================================
-- One-time bridge: for every URL that has a subcategory_id, copy its mapped
-- tags into url_tags (source = 'subcategory-migration', confidence 0.8).
-- Idempotent: ON CONFLICT DO NOTHING lets this be re-run safely.
-- =============================================================================

INSERT INTO public.url_tags (url_id, tag_id, confidence, source)
SELECT u.id, m.tag_id, 0.8, 'subcategory-migration'
FROM public.urls u
JOIN public.subcategories s ON s.id = u.subcategory_id
JOIN public.subcategory_tag_mapping m ON m.subcategory_slug = s.slug
WHERE u.subcategory_id IS NOT NULL
ON CONFLICT (url_id, tag_id) DO NOTHING;
