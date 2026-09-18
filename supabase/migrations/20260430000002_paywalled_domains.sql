-- =============================================================================
-- Paywalled domains table + skip_paywalled support in roam()
-- =============================================================================
-- Creates a lookup table of known paywalled domains and updates roam() to
-- filter them out when the user has skip_paywalled = TRUE in user_settings.
-- =============================================================================


-- ── 1. paywalled_domains table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.paywalled_domains (
  domain    TEXT        PRIMARY KEY,
  added_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Publicly readable (roam() runs as SECURITY DEFINER, but good to have)
ALTER TABLE public.paywalled_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "paywalled_domains: public read"
  ON paywalled_domains FOR SELECT
  USING (TRUE);

-- ── 2. Seed known paywalled domains ─────────────────────────────────────────
INSERT INTO public.paywalled_domains (domain) VALUES
  ('nytimes.com'),
  ('wsj.com'),
  ('ft.com'),
  ('bloomberg.com'),
  ('theatlantic.com'),
  ('newyorker.com'),
  ('thetimes.co.uk'),
  ('thetimes.com'),
  ('economist.com'),
  ('businessinsider.com'),
  ('hbr.org'),
  ('wired.com'),
  ('washingtonpost.com'),
  ('latimes.com'),
  ('bostonglobe.com'),
  ('sfchronicle.com'),
  ('chicagotribune.com'),
  ('telegraph.co.uk'),
  ('spectator.co.uk'),
  ('foreignaffairs.com'),
  ('scientificamerican.com'),
  ('nature.com'),
  ('science.org')
ON CONFLICT (domain) DO NOTHING;

-- ── 3. Update roam() to respect skip_paywalled ──────────────────────────────
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
  v_url_id        UUID;
  v_langs         TEXT[];
  v_skip_paywall  BOOLEAN;
BEGIN
  -- Callers may only roam as themselves.
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Load settings; fall back to defaults if no settings row yet.
  SELECT
    COALESCE(s.preferred_languages, ARRAY['en']),
    COALESCE(s.skip_paywalled, FALSE)
  INTO v_langs, v_skip_paywall
  FROM user_settings s
  WHERE s.user_id = p_user_id;

  IF v_langs IS NULL THEN
    v_langs := ARRAY['en'];
  END IF;
  IF v_skip_paywall IS NULL THEN
    v_skip_paywall := FALSE;
  END IF;

  IF p_collection_id IS NOT NULL THEN
    -- ── Collection mode ──────────────────────────────────────────────────────
    SELECT u.id INTO v_url_id
    FROM urls u
    INNER JOIN collection_items ci ON ci.url_id = u.id
    WHERE ci.collection_id = p_collection_id
      AND u.approved = TRUE
      AND u.language = ANY(v_langs)
      AND (
        NOT v_skip_paywall
        OR NOT EXISTS (
          SELECT 1 FROM paywalled_domains pd
          WHERE u.url ~ ('^https?://([^/]*\.)?' || replace(pd.domain, '.', '\.') || '(/|$)')
        )
      )
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
        NOT v_skip_paywall
        OR NOT EXISTS (
          SELECT 1 FROM paywalled_domains pd
          WHERE u.url ~ ('^https?://([^/]*\.)?' || replace(pd.domain, '.', '\.') || '(/|$)')
        )
      )
      AND (
        p_exclude_domain IS NULL
        OR u.url !~ ('^https?://([^/]*\.)?' || regexp_replace(p_exclude_domain, '\.', '\\.', 'g') || '(/|$)')
      )
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

  -- Return the selected URL row (empty if pool exhausted).
  RETURN QUERY
  SELECT u.id, u.url, u.title, u.description, u.og_image_url,
         u.subcategory_id, u.wilson_score
  FROM urls u
  WHERE u.id = v_url_id;
END;
$$;
