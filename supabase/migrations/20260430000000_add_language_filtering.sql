-- =============================================================================
-- Add language support to URLs and user settings
-- =============================================================================
-- Problem: the discovery pool contains non-English content (Wikivoyage pages,
-- Curlie URLs, academic papers, etc.) from sources covering many languages.
-- Users should default to English-only discovery with other languages opt-in.
--
-- Approach:
--   1. Add `language` column to `urls` (default 'en', BCP-47 tag e.g. 'fr')
--   2. Add `user_settings` table (holds preferred_languages TEXT[])
--   3. Restore the full roam() function with:
--      - language filtering (pass through iff lang IN user prefs)
--      - full category/subcategory logic (restores the debug stub)
--      - seen_urls exclusion
--      - domain exclusion
--      - collection mode
-- =============================================================================


-- ── 1. Language column on urls ────────────────────────────────────────────────
-- Default 'en' covers all existing seeded content which is English-only.
-- Non-English seeders (if added later) must explicitly pass a language tag.
ALTER TABLE public.urls
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en';

-- Index so roam() can filter efficiently by language
CREATE INDEX IF NOT EXISTS idx_urls_language
  ON urls (language)
  WHERE approved = TRUE;

-- Also add language to moderation_queue so admin knows the language of a
-- submitted URL and can set it correctly on approval.
ALTER TABLE public.moderation_queue
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en';


-- ── 2. user_settings table ───────────────────────────────────────────────────
-- One row per user. Created lazily (on first save or sign-up).
-- preferred_languages: BCP-47 codes the user wants to see.
-- Default is {'en'} (English only).
-- RLS: users can only read/write their own row.
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id              UUID        PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  preferred_languages  TEXT[]      NOT NULL DEFAULT ARRAY['en'],
  skip_paywalled       BOOLEAN     NOT NULL DEFAULT FALSE,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_settings: users manage own"
  ON user_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ── 3. Restore full roam() with language filtering ───────────────────────────
-- Replaces the minimal debug stub from migration 20260426000005.
-- Parameters:
--   p_user_id         — caller's user ID (must match auth.uid())
--   p_collection_id   — if provided, draws from this collection only
--   p_exclude_domain  — optional domain to exclude (anti-repetition)
--
-- Language behaviour:
--   Reads preferred_languages from user_settings. If no row exists, defaults
--   to {'en'}. A URL passes the language filter iff its language tag is in the
--   user's preferred list.

DROP FUNCTION IF EXISTS public.roam(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.roam(UUID, UUID, TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.roam(
  p_user_id         UUID,
  p_collection_id   UUID    DEFAULT NULL,
  p_exclude_domain  TEXT    DEFAULT NULL
)
RETURNS TABLE (
  id             UUID,
  url            TEXT,
  title          TEXT,
  description    TEXT,
  og_image_url   TEXT,
  subcategory_id UUID,
  wilson_score   DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url_id   UUID;
  v_langs    TEXT[];
BEGIN
  -- Callers may only roam as themselves.
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Load language preferences; fall back to English-only if no settings row yet.
  SELECT COALESCE(s.preferred_languages, ARRAY['en'])
    INTO v_langs
    FROM user_settings s
   WHERE s.user_id = p_user_id;

  IF v_langs IS NULL THEN
    v_langs := ARRAY['en'];
  END IF;

  IF p_collection_id IS NOT NULL THEN
    -- ── Collection mode ──────────────────────────────────────────────────────
    -- Ignore category preferences; draw from the specified collection.
    -- Language filter still applies.
    SELECT u.id INTO v_url_id
    FROM urls u
    INNER JOIN collection_items ci ON ci.url_id = u.id
    WHERE ci.collection_id = p_collection_id
      AND u.approved = TRUE
      AND u.language = ANY(v_langs)
      AND (
        p_exclude_domain IS NULL
        OR u.url !~ ('^https?://([^/]*\.)?' || regexp_replace(p_exclude_domain, '\.', '\\.', 'g') || '(/|$)')
      )
      AND NOT EXISTS (
        SELECT 1 FROM seen_urls su
        WHERE su.user_id = p_user_id AND su.url_id = u.id
      )
    ORDER BY (u.wilson_score + 0.1) * random() DESC
    LIMIT 1;

  ELSE
    -- ── Standard mode ────────────────────────────────────────────────────────
    SELECT u.id INTO v_url_id
    FROM urls u
    LEFT JOIN subcategories sc ON sc.id = u.subcategory_id
    WHERE u.approved = TRUE
      AND u.language = ANY(v_langs)
      AND (
        p_exclude_domain IS NULL
        OR u.url !~ ('^https?://([^/]*\.)?' || regexp_replace(p_exclude_domain, '\.', '\\.', 'g') || '(/|$)')
      )
      AND (
        -- Case 1: URL has a subcategory assigned — match user's category prefs
        (u.subcategory_id IS NOT NULL AND sc.id IS NOT NULL AND (
          -- User explicitly selected this subcategory
          EXISTS (
            SELECT 1 FROM user_categories uc
            WHERE uc.user_id = p_user_id
              AND uc.subcategory_id = u.subcategory_id
          )
          OR (
            -- User selected the whole pillar (no subcategory refinements for it)
            EXISTS (
              SELECT 1 FROM user_categories uc
              WHERE uc.user_id = p_user_id
                AND uc.category_id = sc.category_id
                AND uc.subcategory_id IS NULL
            )
            AND NOT EXISTS (
              SELECT 1 FROM user_categories uc2
              WHERE uc2.user_id = p_user_id
                AND uc2.category_id = sc.category_id
                AND uc2.subcategory_id IS NOT NULL
            )
          )
        ))
        OR
        -- Case 2: URL has no subcategory — allow if user selected any pillar
        (u.subcategory_id IS NULL AND EXISTS (
          SELECT 1 FROM user_categories uc
          WHERE uc.user_id = p_user_id
            AND uc.subcategory_id IS NULL
        ))
      )
      AND NOT EXISTS (
        SELECT 1 FROM seen_urls su
        WHERE su.user_id = p_user_id AND su.url_id = u.id
      )
    ORDER BY (u.wilson_score + 0.1) * random() DESC
    LIMIT 1;
  END IF;

  -- Record as seen immediately (on serve, not on rate).
  IF v_url_id IS NOT NULL THEN
    INSERT INTO seen_urls (user_id, url_id)
    VALUES (p_user_id, v_url_id)
    ON CONFLICT (user_id, url_id) DO NOTHING;
  END IF;

  -- Return the selected URL row (empty if pool exhausted).
  RETURN QUERY
  SELECT u.id, u.url, u.title, u.description, u.og_image_url,
         u.subcategory_id, u.wilson_score
  FROM urls u
  WHERE u.id = v_url_id;
END;
$$;
