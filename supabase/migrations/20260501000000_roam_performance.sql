-- =============================================================================
-- roam() performance: domain column + indexes
-- =============================================================================
-- Eliminates per-row regex evaluation in roam() by:
--   1. Adding a pre-computed `domain` column to urls
--   2. Adding a trigger to keep it populated on insert/update
--   3. Adding indexes on (language WHERE approved) and (domain)
--   4. Rewriting roam() to use equality/LIKE instead of regex
-- =============================================================================

SET statement_timeout = 0;

-- ── 1. Add domain column ─────────────────────────────────────────────────────
-- Strips scheme, optional "www.", and path/query/fragment.
-- "https://www.nytimes.com/foo?q=1" → "nytimes.com"
-- "https://blogs.wsj.com/bar"       → "blogs.wsj.com"

ALTER TABLE public.urls ADD COLUMN IF NOT EXISTS domain TEXT;

UPDATE public.urls
SET domain = lower(
  regexp_replace(
    regexp_replace(url, '^https?://(www\.)?', ''),
    '[/?#].*$', ''
  )
)
WHERE domain IS NULL;

-- ── 2. Trigger: auto-populate domain on every insert/update ─────────────────
CREATE OR REPLACE FUNCTION public.set_url_domain()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.domain := lower(
    regexp_replace(
      regexp_replace(NEW.url, '^https?://(www\.)?', ''),
      '[/?#].*$', ''
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_urls_domain ON public.urls;
CREATE TRIGGER trg_urls_domain
  BEFORE INSERT OR UPDATE OF url ON public.urls
  FOR EACH ROW EXECUTE FUNCTION public.set_url_domain();

-- ── 3. Indexes ───────────────────────────────────────────────────────────────
-- Primary scan path: approved rows filtered by language
CREATE INDEX IF NOT EXISTS idx_urls_language_approved
  ON public.urls (language)
  WHERE approved = TRUE;

-- Domain equality lookups (paywall filter + exclude-domain)
CREATE INDEX IF NOT EXISTS idx_urls_domain
  ON public.urls (domain);

-- Composite for seen_urls correlated subquery (should already exist)
CREATE INDEX IF NOT EXISTS idx_seen_urls_user_url
  ON public.seen_urls (user_id, url_id);

-- ── 4. Rewrite roam() using domain column ────────────────────────────────────
DROP FUNCTION IF EXISTS public.roam(UUID, UUID, TEXT) CASCADE;

CREATE FUNCTION public.roam(
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
  v_url_id        UUID;
  v_langs         TEXT[];
  v_skip_paywall  BOOLEAN;
BEGIN
  -- Callers may only roam as themselves.
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Load user settings; fall back to defaults if no row exists yet.
  SELECT
    COALESCE(s.preferred_languages, ARRAY['en']),
    COALESCE(s.skip_paywalled, FALSE)
  INTO v_langs, v_skip_paywall
  FROM user_settings s
  WHERE s.user_id = p_user_id;

  IF v_langs IS NULL    THEN v_langs := ARRAY['en']; END IF;
  IF v_skip_paywall IS NULL THEN v_skip_paywall := FALSE; END IF;

  IF p_collection_id IS NOT NULL THEN
    -- ── Collection mode ──────────────────────────────────────────────────────
    SELECT u.id INTO v_url_id
    FROM urls u
    INNER JOIN collection_items ci ON ci.url_id = u.id
    WHERE ci.collection_id = p_collection_id
      AND u.approved = TRUE
      AND u.language = ANY(v_langs)
      -- Exclude same domain as last roam (simple equality, uses idx_urls_domain)
      AND (p_exclude_domain IS NULL OR u.domain IS DISTINCT FROM p_exclude_domain)
      -- Paywall filter: text equality + subdomain check, no regex
      AND (
        NOT v_skip_paywall
        OR NOT EXISTS (
          SELECT 1 FROM paywalled_domains pd
          WHERE pd.domain = u.domain
             OR u.domain LIKE ('%.' || pd.domain)
        )
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
      -- Exclude same domain as last roam (simple equality, uses idx_urls_domain)
      AND (p_exclude_domain IS NULL OR u.domain IS DISTINCT FROM p_exclude_domain)
      -- Paywall filter: text equality + subdomain check, no regex
      AND (
        NOT v_skip_paywall
        OR NOT EXISTS (
          SELECT 1 FROM paywalled_domains pd
          WHERE pd.domain = u.domain
             OR u.domain LIKE ('%.' || pd.domain)
        )
      )
      -- Category filter
      AND (
        (u.subcategory_id IS NOT NULL AND sc.id IS NOT NULL AND (
          EXISTS (
            SELECT 1 FROM user_categories uc
            WHERE uc.user_id = p_user_id
              AND uc.subcategory_id = u.subcategory_id
          )
          OR (
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

  -- Return the selected URL row (empty result set if pool exhausted).
  RETURN QUERY
  SELECT u.id, u.url, u.title, u.description, u.og_image_url,
         u.subcategory_id, u.wilson_score
  FROM urls u
  WHERE u.id = v_url_id;
END;
$$;

-- Grant execute to authenticated users (SECURITY DEFINER, so it runs as owner)
GRANT EXECUTE ON FUNCTION public.roam(UUID, UUID, TEXT) TO authenticated;
