-- =============================================================================
-- Replace url_tags surrogate primary key with the natural composite key
-- (REVIEW + TEST BEFORE APPLYING)
-- =============================================================================
-- url_tags.id (UUID, DEFAULT gen_random_uuid()) is never referenced: no foreign
-- keys point at it and no application code reads it. The natural key is
-- (url_id, tag_id), which already has a UNIQUE constraint. Promoting it to the
-- primary key removes the ~43 MB url_tags_pkey index and the unused id column,
-- and it matches skyhook's upload upsert conflict target ("url_id, tag_id").
--
-- MUST be tested locally before `supabase db push`:
--   supabase db reset && node scripts/verify-roam-rpc.mjs
-- (RULES.md §1.4 / supabase/RULES.md S.5)
-- =============================================================================

ALTER TABLE public.url_tags DROP CONSTRAINT IF EXISTS url_tags_pkey;
ALTER TABLE public.url_tags DROP COLUMN IF EXISTS id;
ALTER TABLE public.url_tags DROP CONSTRAINT IF EXISTS url_tags_url_id_tag_id_key;
ALTER TABLE public.url_tags ADD PRIMARY KEY (url_id, tag_id);
