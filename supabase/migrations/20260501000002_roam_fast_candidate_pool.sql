-- =============================================================================
-- roam() v3: fast candidate-pool approach
-- =============================================================================
-- Root cause of statement timeout:
--   ORDER BY (wilson_score + 0.1) * random() DESC LIMIT 1
--   requires sorting ALL qualifying rows. With thousands of URLs this
--   routinely exceeds the authenticated-role statement_timeout.
--
-- Fix (two changes):
--   1. Pre-load user category preferences into arrays ONCE at the top.
--      Eliminates 4 correlated EXISTS/NOT EXISTS subqueries evaluated
--      per row in the hot path.
--   2. Candidate pool: inner query grabs the top 100 by wilson_score
--      (index scan, stops early), outer query randomises those 100.
--      Random sort is now O(100) instead of O(n).
--   3. SET statement_timeout = '25s' in the function header so it
--      overrides any shorter role-level setting.
-- =============================================================================

-- ── Optional: composite index for fast candidate selection ───────────────────
-- Lets the inner ORDER BY wilson_score DESC / LIMIT 100 use an index scan.
CREATE INDEX IF NOT EXISTS idx_urls_roam_candidates
  ON public.urls (wilson_score DESC, language)
  WHERE approved = TRUE;

-- ── Rewrite roam() ───────────────────────────────────────────────────────────
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
  v_allowed_subcat_ids UUID[];   -- flat list of subcategory UUIDs the user may see
  v_has_categories     BOOLEAN;  -- user has any entry in user_categories
BEGIN
  -- Callers may only roam as themselves.
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- ── Load user settings (single row lookup) ─────────────────────────────────
  SELECT
    COALESCE(s.preferred_languages, ARRAY['en']),
    COALESCE(s.skip_paywalled, FALSE)
  INTO v_langs, v_skip_paywall
  FROM user_settings s
  WHERE s.user_id = p_user_id;

  IF v_langs       IS NULL THEN v_langs       := ARRAY['en']; END IF;
  IF v_skip_paywall IS NULL THEN v_skip_paywall := FALSE; END IF;

  -- ── Expand category preferences → flat subcategory ID list ────────────────
  -- Covers three selection styles:
  --   a) Explicitly selected subcategories (uc.subcategory_id IS NOT NULL)
  --   b) All subcategories of a whole-category selection where the user
  --      has NOT also drilled into specific subcategories of that category
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

  IF p_collection_id IS NOT NULL THEN
    -- ── Collection mode ──────────────────────────────────────────────────────
    -- Pick top 100 candidates by wilson_score (cheap index+join), then
    -- randomise within that pool.
    SELECT c.id INTO v_url_id
    FROM (
      SELECT u.id, u.wilson_score
      FROM   urls u
      INNER  JOIN collection_items ci ON ci.url_id = u.id
      WHERE  ci.collection_id = p_collection_id
        AND  u.approved       = TRUE
        AND  u.language       = ANY(v_langs)
        AND  (p_exclude_domain IS NULL OR u.domain IS DISTINCT FROM p_exclude_domain)
        AND  (
               NOT v_skip_paywall
               OR NOT EXISTS (
                 SELECT 1 FROM paywalled_domains pd
                 WHERE pd.domain = u.domain
                    OR u.domain LIKE ('%.' || pd.domain)
               )
             )
        AND  NOT EXISTS (
               SELECT 1 FROM seen_urls su
               WHERE  su.user_id = p_user_id AND su.url_id = u.id
             )
      ORDER  BY u.wilson_score DESC
      LIMIT  100
    ) c
    ORDER BY (c.wilson_score + 0.1) * random() DESC
    LIMIT 1;

  ELSE
    -- ── Standard mode ────────────────────────────────────────────────────────
    SELECT c.id INTO v_url_id
    FROM (
      SELECT u.id, u.wilson_score
      FROM   urls u
      WHERE  u.approved = TRUE
        AND  u.language = ANY(v_langs)
        AND  (p_exclude_domain IS NULL OR u.domain IS DISTINCT FROM p_exclude_domain)
        AND  (
               NOT v_skip_paywall
               OR NOT EXISTS (
                 SELECT 1 FROM paywalled_domains pd
                 WHERE pd.domain = u.domain
                    OR u.domain LIKE ('%.' || pd.domain)
               )
             )
        AND  (
               -- No category preferences → show everything
               NOT v_has_categories
               OR
               -- URL has a subcategory the user is allowed to see
               (
                 v_allowed_subcat_ids IS NOT NULL
                 AND u.subcategory_id = ANY(v_allowed_subcat_ids)
               )
               OR
               -- URL has no subcategory; show to any user with categories set
               (u.subcategory_id IS NULL AND v_has_categories)
             )
        AND  NOT EXISTS (
               SELECT 1 FROM seen_urls su
               WHERE  su.user_id = p_user_id AND su.url_id = u.id
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

  -- Return the selected row (empty result set if pool exhausted).
  RETURN QUERY
  SELECT u.id, u.url, u.title, u.description, u.og_image_url,
         u.subcategory_id, u.wilson_score
  FROM   urls u
  WHERE  u.id = v_url_id;
END;
$$;
