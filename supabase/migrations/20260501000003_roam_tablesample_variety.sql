-- =============================================================================
-- roam() v4: per-call random variety via TABLESAMPLE
-- =============================================================================
-- Problem with v3 candidate pool:
--   Inner query always fetches top-500 by wilson_score, so every new user
--   draws from the exact same 500 URLs. Seen_urls creates divergence over time
--   but first-time users all get the same pool.
--
-- Fix: TABLESAMPLE BERNOULLI(p)
--   Samples p% of storage *blocks* at random — fast (no sort, no index),
--   naturally different on every call, not biased toward any score range.
--   With 10,000 approved URLs and p=10, yields ~1 000 random candidates.
--   With 100,000 URLs, still yields ~10 000 — scales automatically.
--
--   UNION ALL with a small top-N fallback guarantees a result even if the
--   random sample happens to yield 0 qualifying rows (e.g. niche language
--   filter + many seen URLs).
-- =============================================================================

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
SET statement_timeout = '25s'
AS $$
DECLARE
  v_url_id             UUID;
  v_langs              TEXT[];
  v_skip_paywall       BOOLEAN;
  v_allowed_subcat_ids UUID[];
  v_has_categories     BOOLEAN;
BEGIN
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- ── Load user settings ────────────────────────────────────────────────────
  SELECT
    COALESCE(s.preferred_languages, ARRAY['en']),
    COALESCE(s.skip_paywalled, FALSE)
  INTO v_langs, v_skip_paywall
  FROM user_settings s
  WHERE s.user_id = p_user_id;

  IF v_langs        IS NULL THEN v_langs        := ARRAY['en']; END IF;
  IF v_skip_paywall IS NULL THEN v_skip_paywall := FALSE;       END IF;

  -- ── Expand category prefs into a flat subcategory ID array ───────────────
  SELECT array_agg(DISTINCT sc.id)
  INTO   v_allowed_subcat_ids
  FROM   subcategories sc
  WHERE  sc.id IN (
           SELECT uc.subcategory_id
           FROM   user_categories uc
           WHERE  uc.user_id        = p_user_id
             AND  uc.subcategory_id IS NOT NULL
         )
     OR  sc.category_id IN (
           SELECT uc.category_id
           FROM   user_categories uc
           WHERE  uc.user_id        = p_user_id
             AND  uc.subcategory_id IS NULL
             AND  uc.category_id NOT IN (
                    SELECT uc2.category_id
                    FROM   user_categories uc2
                    WHERE  uc2.user_id        = p_user_id
                      AND  uc2.subcategory_id IS NOT NULL
                  )
         );

  SELECT EXISTS (
    SELECT 1 FROM user_categories WHERE user_id = p_user_id
  ) INTO v_has_categories;

  -- ── Shared filter macros (repeated in each branch) ────────────────────────
  -- We can't use a CTE here because TABLESAMPLE must appear in the FROM clause
  -- directly; a CTE over the same table would lose the sampling behaviour.

  IF p_collection_id IS NOT NULL THEN
    -- ── Collection mode ──────────────────────────────────────────────────────
    SELECT c.id INTO v_url_id
    FROM (
      -- Random sample (~10 % of collection rows)
      SELECT u.id, u.wilson_score
      FROM   urls u TABLESAMPLE BERNOULLI(10)
      INNER  JOIN collection_items ci ON ci.url_id = u.id
      WHERE  ci.collection_id = p_collection_id
        AND  u.approved = TRUE
        AND  u.language = ANY(v_langs)
        AND  (p_exclude_domain IS NULL OR u.domain IS DISTINCT FROM p_exclude_domain)
        AND  (NOT v_skip_paywall OR NOT EXISTS (
               SELECT 1 FROM paywalled_domains pd
               WHERE pd.domain = u.domain OR u.domain LIKE ('%.' || pd.domain)
             ))
        AND  NOT EXISTS (
               SELECT 1 FROM seen_urls su
               WHERE su.user_id = p_user_id AND su.url_id = u.id
             )

      UNION ALL

      -- Fallback: top-50 by score (guarantees a result for small collections)
      SELECT u.id, u.wilson_score
      FROM   urls u
      INNER  JOIN collection_items ci ON ci.url_id = u.id
      WHERE  ci.collection_id = p_collection_id
        AND  u.approved = TRUE
        AND  u.language = ANY(v_langs)
        AND  (p_exclude_domain IS NULL OR u.domain IS DISTINCT FROM p_exclude_domain)
        AND  (NOT v_skip_paywall OR NOT EXISTS (
               SELECT 1 FROM paywalled_domains pd
               WHERE pd.domain = u.domain OR u.domain LIKE ('%.' || pd.domain)
             ))
        AND  NOT EXISTS (
               SELECT 1 FROM seen_urls su
               WHERE su.user_id = p_user_id AND su.url_id = u.id
             )
      ORDER  BY u.wilson_score DESC
      LIMIT  50
    ) c
    ORDER BY (c.wilson_score + 0.1) * random() DESC
    LIMIT 1;

  ELSE
    -- ── Standard mode ────────────────────────────────────────────────────────
    SELECT c.id INTO v_url_id
    FROM (
      -- Random sample (~10 % of the urls table)
      -- Different pages are read on every call → different pool for every user
      -- on every request, regardless of wilson_score distribution.
      SELECT u.id, u.wilson_score
      FROM   urls u TABLESAMPLE BERNOULLI(10)
      WHERE  u.approved = TRUE
        AND  u.language = ANY(v_langs)
        AND  (p_exclude_domain IS NULL OR u.domain IS DISTINCT FROM p_exclude_domain)
        AND  (NOT v_skip_paywall OR NOT EXISTS (
               SELECT 1 FROM paywalled_domains pd
               WHERE pd.domain = u.domain OR u.domain LIKE ('%.' || pd.domain)
             ))
        AND  (
               NOT v_has_categories
               OR (v_allowed_subcat_ids IS NOT NULL AND u.subcategory_id = ANY(v_allowed_subcat_ids))
               OR (u.subcategory_id IS NULL AND v_has_categories)
             )
        AND  NOT EXISTS (
               SELECT 1 FROM seen_urls su
               WHERE su.user_id = p_user_id AND su.url_id = u.id
             )

      UNION ALL

      -- Fallback: top-100 by score for niche filters / nearly-exhausted pools
      SELECT u.id, u.wilson_score
      FROM   urls u
      WHERE  u.approved = TRUE
        AND  u.language = ANY(v_langs)
        AND  (p_exclude_domain IS NULL OR u.domain IS DISTINCT FROM p_exclude_domain)
        AND  (NOT v_skip_paywall OR NOT EXISTS (
               SELECT 1 FROM paywalled_domains pd
               WHERE pd.domain = u.domain OR u.domain LIKE ('%.' || pd.domain)
             ))
        AND  (
               NOT v_has_categories
               OR (v_allowed_subcat_ids IS NOT NULL AND u.subcategory_id = ANY(v_allowed_subcat_ids))
               OR (u.subcategory_id IS NULL AND v_has_categories)
             )
        AND  NOT EXISTS (
               SELECT 1 FROM seen_urls su
               WHERE su.user_id = p_user_id AND su.url_id = u.id
             )
      ORDER  BY u.wilson_score DESC
      LIMIT  100
    ) c
    ORDER BY (c.wilson_score + 0.1) * random() DESC
    LIMIT 1;
  END IF;

  -- Record as seen immediately.
  IF v_url_id IS NOT NULL THEN
    INSERT INTO seen_urls (user_id, url_id)
    VALUES (p_user_id, v_url_id)
    ON CONFLICT (user_id, url_id) DO NOTHING;
  END IF;

  RETURN QUERY
  SELECT u.id, u.url, u.title, u.description, u.og_image_url,
         u.subcategory_id, u.wilson_score
  FROM   urls u
  WHERE  u.id = v_url_id;
END;
$$;
