-- =============================================================================
-- URL Inactive Flag + Report Tracking (Task 8.2)
-- =============================================================================
--
-- Adds:
--   1. urls.inactive BOOLEAN column — set to TRUE when a URL is reported dead
--   2. url_reports table — audit log of who reported what and when
--   3. Index on (inactive, approved) for fast candidate-pool filtering
--   4. roam() v10 — adds AND NOT u.inactive to all 4 candidate branches
--
-- =============================================================================

-- ── 1. Add inactive column to urls ───────────────────────────────────────────
ALTER TABLE public.urls
  ADD COLUMN IF NOT EXISTS inactive BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 2. Index for fast filtering of inactive URLs ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_urls_inactive_approved
  ON public.urls (inactive, approved);

-- ── 3. url_reports audit table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.url_reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url_id      UUID        NOT NULL REFERENCES public.urls(id) ON DELETE CASCADE,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_url_reports_url_id    ON public.url_reports (url_id);
CREATE INDEX IF NOT EXISTS idx_url_reports_user_id   ON public.url_reports (user_id);

-- ── 4. roam() v10: inactive guard ─────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.roam(UUID, UUID, TEXT, UUID) CASCADE;

CREATE FUNCTION public.roam(
  p_user_id         UUID,
  p_collection_id   UUID    DEFAULT NULL,
  p_exclude_domain  TEXT    DEFAULT NULL,
  p_subcategory_id  UUID    DEFAULT NULL
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
  v_url_id              UUID;
  v_langs               TEXT[];
  v_skip_paywall        BOOLEAN;
  v_discovery_mode      TEXT;
  v_allowed_subcat_ids  UUID[];
  v_has_categories      BOOLEAN;
  v_adjacent_subcat_id  UUID;
  v_effective_subcat_id UUID;
  v_deep_dive_subcats   UUID[];
BEGIN
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- ── Load user settings ────────────────────────────────────────────────────
  SELECT
    COALESCE(s.preferred_languages, ARRAY['en']),
    COALESCE(s.skip_paywalled, FALSE),
    COALESCE(s.discovery_mode, 'discovery')
  INTO v_langs, v_skip_paywall, v_discovery_mode
  FROM user_settings s
  WHERE s.user_id = p_user_id;

  IF v_langs           IS NULL THEN v_langs           := ARRAY['en']; END IF;
  IF v_skip_paywall    IS NULL THEN v_skip_paywall    := FALSE;        END IF;
  IF v_discovery_mode  IS NULL THEN v_discovery_mode  := 'discovery';  END IF;

  -- ── Expand category prefs into flat subcategory ID array ─────────────────
  SELECT array_agg(DISTINCT sc.id)
  INTO   v_allowed_subcat_ids
  FROM   subcategories sc
  WHERE  sc.id IN (
           SELECT uc.subcategory_id FROM user_categories uc
           WHERE  uc.user_id = p_user_id AND uc.subcategory_id IS NOT NULL
         )
     OR  sc.category_id IN (
           SELECT uc.category_id FROM user_categories uc
           WHERE  uc.user_id        = p_user_id
             AND  uc.subcategory_id IS NULL
             AND  uc.category_id NOT IN (
                    SELECT uc2.category_id FROM user_categories uc2
                    WHERE  uc2.user_id = p_user_id AND uc2.subcategory_id IS NOT NULL
                  )
         );

  SELECT EXISTS (SELECT 1 FROM user_categories WHERE user_id = p_user_id)
  INTO v_has_categories;

  -- ── Deep Dive: narrow to top-3 subcategories by calibrated_weight ─────────
  IF v_discovery_mode = 'deep_dive'
     AND p_subcategory_id IS NULL
     AND p_collection_id  IS NULL
  THEN
    SELECT array_agg(subcategory_id)
    INTO   v_deep_dive_subcats
    FROM (
      SELECT subcategory_id
      FROM   user_interest_scores
      WHERE  user_id = p_user_id
        AND  calibrated_weight > 1.0
      ORDER  BY calibrated_weight DESC
      LIMIT  3
    ) t;
    IF v_deep_dive_subcats IS NULL OR array_length(v_deep_dive_subcats, 1) = 0 THEN
      v_deep_dive_subcats := v_allowed_subcat_ids;
    END IF;
  END IF;

  -- ── Discovery mode: 12% adjacent serving ─────────────────────────────────
  v_adjacent_subcat_id := NULL;
  IF v_discovery_mode = 'discovery'
     AND random() < 0.12
     AND p_subcategory_id IS NULL
     AND p_collection_id  IS NULL
  THEN
    SELECT
      CASE WHEN ips.subcategory_a_id = uis_top.top_subcat
           THEN ips.subcategory_b_id
           ELSE ips.subcategory_a_id
      END
    INTO v_adjacent_subcat_id
    FROM (
      SELECT subcategory_id AS top_subcat
      FROM   user_interest_scores
      WHERE  user_id = p_user_id
      ORDER  BY calibrated_weight DESC
      LIMIT  1
    ) uis_top
    JOIN interest_pair_scores ips
      ON  ips.user_id = p_user_id
      AND (   ips.subcategory_a_id = uis_top.top_subcat
           OR ips.subcategory_b_id = uis_top.top_subcat)
      AND ips.pair_weight > 1.0
    ORDER BY ips.pair_weight DESC
    LIMIT 1;
  END IF;

  v_effective_subcat_id := COALESCE(p_subcategory_id, v_adjacent_subcat_id);

  IF p_collection_id IS NOT NULL THEN
    -- ── Collection mode ──────────────────────────────────────────────────────
    SELECT c.id INTO v_url_id
    FROM (
      SELECT u.id,
             u.wilson_score
               * LEAST(GREATEST(COALESCE(uis.calibrated_weight, 1.0), 0.4), 2.0)
               AS eff_score
      FROM   urls u TABLESAMPLE BERNOULLI(10)
      LEFT   JOIN user_interest_scores uis
                  ON uis.user_id = p_user_id AND uis.subcategory_id = u.subcategory_id
      INNER  JOIN collection_items ci ON ci.url_id = u.id
      WHERE  ci.collection_id = p_collection_id
        AND  u.approved       = TRUE
        AND  NOT u.inactive                   -- v10: skip dead links
        AND  u.wilson_score   > -0.1
        AND  u.language       = ANY(v_langs)
        AND  (p_exclude_domain IS NULL OR u.domain IS DISTINCT FROM p_exclude_domain)
        AND  NOT EXISTS (
               SELECT 1 FROM user_suppressed_domains usd
               WHERE usd.user_id = p_user_id AND usd.domain = u.domain
                 AND usd.suppressed_until > NOW()
             )
        AND  (NOT v_skip_paywall OR NOT EXISTS (
               SELECT 1 FROM paywalled_domains pd
               WHERE pd.domain = u.domain OR u.domain LIKE ('%.' || pd.domain)
             ))
        AND  NOT EXISTS (
               SELECT 1 FROM seen_urls su
               WHERE su.user_id = p_user_id AND su.url_id = u.id
             )

      UNION ALL

      SELECT fb.id, fb.eff_score
      FROM (
        SELECT u.id,
               u.wilson_score
                 * LEAST(GREATEST(COALESCE(uis.calibrated_weight, 1.0), 0.4), 2.0)
                 AS eff_score
        FROM   urls u
        LEFT   JOIN user_interest_scores uis
                    ON uis.user_id = p_user_id AND uis.subcategory_id = u.subcategory_id
        INNER  JOIN collection_items ci ON ci.url_id = u.id
        WHERE  ci.collection_id = p_collection_id
          AND  u.approved       = TRUE
          AND  NOT u.inactive                 -- v10: skip dead links
          AND  u.wilson_score   > -0.1
          AND  u.language       = ANY(v_langs)
          AND  (p_exclude_domain IS NULL OR u.domain IS DISTINCT FROM p_exclude_domain)
          AND  NOT EXISTS (
                 SELECT 1 FROM user_suppressed_domains usd
                 WHERE usd.user_id = p_user_id AND usd.domain = u.domain
                   AND usd.suppressed_until > Now()
               )
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
      ) fb
    ) c
    ORDER BY (c.eff_score + 0.1) * random() DESC
    LIMIT 1;

  ELSE
    -- ── Standard mode ─────────────────────────────────────────────────────
    SELECT c.id INTO v_url_id
    FROM (
      SELECT u.id,
             u.wilson_score
               * LEAST(GREATEST(COALESCE(uis.calibrated_weight, 1.0), 0.4), 2.0)
               AS eff_score
      FROM   urls u TABLESAMPLE BERNOULLI(10)
      LEFT   JOIN user_interest_scores uis
                  ON uis.user_id = p_user_id AND uis.subcategory_id = u.subcategory_id
      WHERE  u.approved = TRUE
        AND  NOT u.inactive                   -- v10: skip dead links
        AND  u.wilson_score   > -0.1
        AND  u.language = ANY(v_langs)
        AND  (p_exclude_domain IS NULL OR u.domain IS DISTINCT FROM p_exclude_domain)
        AND  NOT EXISTS (
               SELECT 1 FROM user_suppressed_domains usd
               WHERE usd.user_id = p_user_id AND usd.domain = u.domain
                 AND usd.suppressed_until > NOW()
             )
        AND  (NOT v_skip_paywall OR NOT EXISTS (
               SELECT 1 FROM paywalled_domains pd
               WHERE pd.domain = u.domain OR u.domain LIKE ('%.' || pd.domain)
             ))
        AND  (v_effective_subcat_id IS NULL OR u.subcategory_id = v_effective_subcat_id)
        AND  (
               v_deep_dive_subcats IS NULL
               OR u.subcategory_id = ANY(v_deep_dive_subcats)
             )
        AND  (
               v_effective_subcat_id IS NOT NULL
               OR v_deep_dive_subcats IS NOT NULL
               OR NOT v_has_categories
               OR (v_allowed_subcat_ids IS NOT NULL AND u.subcategory_id = ANY(v_allowed_subcat_ids))
               OR (u.subcategory_id IS NULL AND v_has_categories)
             )
        AND  NOT EXISTS (
               SELECT 1 FROM seen_urls su
               WHERE su.user_id = p_user_id AND su.url_id = u.id
             )

      UNION ALL

      SELECT fb.id, fb.eff_score
      FROM (
        SELECT u.id,
               u.wilson_score
                 * LEAST(GREATEST(COALESCE(uis.calibrated_weight, 1.0), 0.4), 2.0)
                 AS eff_score
        FROM   urls u
        LEFT   JOIN user_interest_scores uis
                    ON uis.user_id = p_user_id AND uis.subcategory_id = u.subcategory_id
        WHERE  u.approved = TRUE
          AND  NOT u.inactive                 -- v10: skip dead links
          AND  u.wilson_score   > -0.1
          AND  u.language = ANY(v_langs)
          AND  (p_exclude_domain IS NULL OR u.domain IS DISTINCT FROM p_exclude_domain)
          AND  NOT EXISTS (
                 SELECT 1 FROM user_suppressed_domains usd
                 WHERE usd.user_id = p_user_id AND usd.domain = u.domain
                   AND usd.suppressed_until > NOW()
               )
          AND  (NOT v_skip_paywall OR NOT EXISTS (
                 SELECT 1 FROM paywalled_domains pd
                 WHERE pd.domain = u.domain OR u.domain LIKE ('%.' || pd.domain)
               ))
          AND  (v_effective_subcat_id IS NULL OR u.subcategory_id = v_effective_subcat_id)
          AND  (
                 v_deep_dive_subcats IS NULL
                 OR u.subcategory_id = ANY(v_deep_dive_subcats)
               )
          AND  (
                 v_effective_subcat_id IS NOT NULL
                 OR v_deep_dive_subcats IS NOT NULL
                 OR NOT v_has_categories
                 OR (v_allowed_subcat_ids IS NOT NULL AND u.subcategory_id = ANY(v_allowed_subcat_ids))
                 OR (u.subcategory_id IS NULL AND v_has_categories)
               )
          AND  NOT EXISTS (
                 SELECT 1 FROM seen_urls su
                 WHERE su.user_id = p_user_id AND su.url_id = u.id
               )
        ORDER  BY u.wilson_score DESC
        LIMIT  100
      ) fb
    ) c
    ORDER BY (c.eff_score + 0.1) * random() DESC
    LIMIT 1;
  END IF;

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
