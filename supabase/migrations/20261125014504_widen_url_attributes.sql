-- =============================================================================
-- Widen url_attributes to the vocabulary the tagger actually emits (T4 / D2)
-- =============================================================================
-- The offline tagger has written 977,745 attribute rows that production rejects.
-- Measured 2026-11-24 against the four CHECKs below: `audience_level` emits
-- `advanced` (32,229 rows), `content_type` emits `reference` (159,185) and
-- `gallery` (103,724), `depth` emits `reference`, and `tone` is ALWAYS a JSON
-- array string (`["neutral"]` 567,719 rows) against a scalar CHECK - so 100 % of
-- the table failed and nothing ever uploaded.
--
-- The target sets are not invented here: they are `tagging.enums.values` in the
-- Skyhook defaults (`src/config.js`), which the upload mapper uses to map every
-- value (`src/adapters/tagging/enums.js`). Widening the DB to match the mapper
-- is what stops the two drifting apart again.
--
-- The table is empty in production (0 rows, 2026-11-24), so the `tone` type
-- change is metadata-only; the USING clause exists for a local replay that was
-- seeded from the offline store.
--
-- Rollback: see RUNBOOK.md -> 20261125014504_widen_url_attributes.sql
-- =============================================================================

-- Drop the four CHECKs BY LOOKUP, not by name: the constraint names of an inline
-- column CHECK are assigned by the server, and `pg_constraint` is not reachable
-- through PostgREST, so the names cannot be read from here before writing this.
DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT c.conname
      FROM pg_constraint c
     WHERE c.conrelid = 'public.url_attributes'::regclass
       AND c.contype  = 'c'
       AND (
         pg_get_constraintdef(c.oid) ILIKE '%audience_level%'
         OR pg_get_constraintdef(c.oid) ILIKE '%content_type%'
         OR pg_get_constraintdef(c.oid) ILIKE '%depth%'
         OR pg_get_constraintdef(c.oid) ILIKE '%tone%'
       )
  LOOP
    EXECUTE format('ALTER TABLE public.url_attributes DROP CONSTRAINT %I', con.conname);
  END LOOP;
END
$$;

-- `tone` becomes an array: the tagger assigns several, and the mapper already
-- normalises a scalar to a one-element array.
ALTER TABLE public.url_attributes
  ALTER COLUMN tone TYPE TEXT[]
  USING CASE
          WHEN tone IS NULL       THEN NULL
          WHEN btrim(tone) = ''   THEN '{}'::TEXT[]
          ELSE ARRAY[tone]
        END;

ALTER TABLE public.url_attributes
  ADD CONSTRAINT url_attributes_audience_level_check
    CHECK (audience_level IS NULL OR audience_level IN
      ('beginner', 'intermediate', 'advanced', 'expert', 'general')),
  ADD CONSTRAINT url_attributes_content_type_check
    CHECK (content_type IS NULL OR content_type IN
      ('explainer', 'research', 'opinion', 'how-to', 'narrative', 'news', 'review',
       'interview', 'longform', 'tutorial', 'infographic', 'podcast', 'video',
       'interactive', 'faq', 'data-journalism', 'article', 'reference', 'gallery', 'other')),
  ADD CONSTRAINT url_attributes_depth_check
    CHECK (depth IS NULL OR depth IN ('quick-read', 'medium', 'deep-dive', 'reference')),
  -- Containment: every element must be known, while NULL and '{}' stay legal.
  ADD CONSTRAINT url_attributes_tone_check
    CHECK (tone IS NULL OR tone <@ ARRAY[
      'academic', 'playful', 'serious', 'technical', 'accessible', 'inspirational',
      'critical', 'neutral', 'journalistic', 'humorous', 'conversational', 'sensational'
    ]::TEXT[]);

COMMENT ON COLUMN public.url_attributes.tone IS
  'Zero or more tone words; every element is CHECKed against tagging.enums.values.tone in the Skyhook config.';

