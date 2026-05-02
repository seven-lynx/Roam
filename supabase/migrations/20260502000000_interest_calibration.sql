-- =============================================================================
-- Interest Calibration with Revealed Preferences Scoring (Task 11.28)
-- =============================================================================
--
-- Replaces the additive affinity score (user_subcategory_affinity) with a
-- ratio-based calibrated weight stored in user_interest_scores.
--
-- FORMULA:
--   calibrated_weight = upvote_count / (upvote_count + downvote_count) / 0.5
--
--   Examples:
--     80% upvotes → 0.8 / 0.5 = 1.6  (+60% boost)
--     50% upvotes → 0.5 / 0.5 = 1.0  (neutral, no change)
--     30% upvotes → 0.3 / 0.5 = 0.6  (-40% penalty)
--     cold start  →                 = 1.0  (default, no data)
--
-- EFFECTIVE SCORE in roam():
--   eff_score = wilson_score * CLAMP(calibrated_weight, 0.4, 2.0)
--
--   The lower clamp (0.4) ensures heavily disliked subcategories still
--   occasionally surface (domain suppression handles repeated dislikes).
--   The upper clamp (2.0) prevents runaway over-weighting.
-- =============================================================================

-- ── 1. user_interest_scores table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_interest_scores (
  user_id           UUID        NOT NULL REFERENCES auth.users    ON DELETE CASCADE,
  subcategory_id    UUID        NOT NULL REFERENCES subcategories ON DELETE CASCADE,
  upvote_count      INTEGER     NOT NULL DEFAULT 0,
  downvote_count    INTEGER     NOT NULL DEFAULT 0,
  calibrated_weight FLOAT       NOT NULL DEFAULT 1.0,
  last_updated      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, subcategory_id)
);

CREATE INDEX IF NOT EXISTS idx_user_interest_scores
  ON public.user_interest_scores (user_id, subcategory_id);

ALTER TABLE public.user_interest_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "interest_scores: users can read own"
  ON public.user_interest_scores FOR SELECT
  USING (auth.uid() = user_id);

-- ── 2. Trigger: maintain interest scores on every rating event ───────────────
CREATE OR REPLACE FUNCTION public.update_interest_scores()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_subcat_id  UUID;
  v_uid        UUID;
  v_up_delta   INTEGER;
  v_down_delta INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT subcategory_id INTO v_subcat_id FROM urls WHERE id = NEW.url_id;
    v_uid        := NEW.user_id;
    v_up_delta   := CASE WHEN NEW.value =  1 THEN 1 ELSE 0 END;
    v_down_delta := CASE WHEN NEW.value = -1 THEN 1 ELSE 0 END;
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT subcategory_id INTO v_subcat_id FROM urls WHERE id = NEW.url_id;
    v_uid        := NEW.user_id;
    v_up_delta   := (CASE WHEN NEW.value =  1 THEN 1 ELSE 0 END)
                  - (CASE WHEN OLD.value =  1 THEN 1 ELSE 0 END);
    v_down_delta := (CASE WHEN NEW.value = -1 THEN 1 ELSE 0 END)
                  - (CASE WHEN OLD.value = -1 THEN 1 ELSE 0 END);
  ELSE -- DELETE
    SELECT subcategory_id INTO v_subcat_id FROM urls WHERE id = OLD.url_id;
    v_uid        := OLD.user_id;
    v_up_delta   := -(CASE WHEN OLD.value =  1 THEN 1 ELSE 0 END);
    v_down_delta := -(CASE WHEN OLD.value = -1 THEN 1 ELSE 0 END);
  END IF;

  IF v_subcat_id IS NULL THEN RETURN NULL; END IF;

  INSERT INTO user_interest_scores
    (user_id, subcategory_id, upvote_count, downvote_count, calibrated_weight, last_updated)
  VALUES (
    v_uid,
    v_subcat_id,
    GREATEST(0, v_up_delta),
    GREATEST(0, v_down_delta),
    1.0,
    NOW()
  )
  ON CONFLICT (user_id, subcategory_id) DO UPDATE SET
    upvote_count   = GREATEST(0, user_interest_scores.upvote_count   + v_up_delta),
    downvote_count = GREATEST(0, user_interest_scores.downvote_count + v_down_delta),
    calibrated_weight = (
      CASE
        WHEN (GREATEST(0, user_interest_scores.upvote_count   + v_up_delta)
            + GREATEST(0, user_interest_scores.downvote_count + v_down_delta)) = 0
        THEN 1.0
        ELSE
          GREATEST(0, user_interest_scores.upvote_count + v_up_delta)::FLOAT
          / (GREATEST(0, user_interest_scores.upvote_count   + v_up_delta)
           + GREATEST(0, user_interest_scores.downvote_count + v_down_delta))::FLOAT
          / 0.5
      END
    ),
    last_updated = NOW();

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_ratings_interest_scores ON public.ratings;
CREATE TRIGGER trg_ratings_interest_scores
  AFTER INSERT OR UPDATE OR DELETE ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_interest_scores();

-- ── 3. Backfill from existing ratings ────────────────────────────────────────
INSERT INTO user_interest_scores
  (user_id, subcategory_id, upvote_count, downvote_count, calibrated_weight, last_updated)
SELECT
  r.user_id,
  u.subcategory_id,
  COUNT(*) FILTER (WHERE r.value =  1)::INTEGER AS upvote_count,
  COUNT(*) FILTER (WHERE r.value = -1)::INTEGER AS downvote_count,
  CASE
    WHEN COUNT(*) = 0 THEN 1.0
    ELSE (COUNT(*) FILTER (WHERE r.value = 1)::FLOAT / COUNT(*)::FLOAT) / 0.5
  END AS calibrated_weight,
  NOW() AS last_updated
FROM   ratings r
INNER  JOIN urls u ON u.id = r.url_id
WHERE  u.subcategory_id IS NOT NULL
GROUP  BY r.user_id, u.subcategory_id
ON CONFLICT (user_id, subcategory_id) DO UPDATE SET
  upvote_count      = EXCLUDED.upvote_count,
  downvote_count    = EXCLUDED.downvote_count,
  calibrated_weight = EXCLUDED.calibrated_weight,
  last_updated      = EXCLUDED.last_updated;

-- ── 4. roam() v6: calibrated weight scoring ──────────────────────────────────
--
-- Replaces the additive affinity formula:
--   wilson_score * (1 + 0.3 * clamp(affinity, 0, 10) / 10)
--
-- With calibrated weight:
--   wilson_score * clamp(calibrated_weight, 0.4, 2.0)
--
-- Cold-start (no ratings yet): calibrated_weight defaults to 1.0 → neutral.
-- =============================================================================

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

  IF p_collection_id IS NOT NULL THEN
    -- ── Collection mode ──────────────────────────────────────────────────────
    SELECT c.id INTO v_url_id
    FROM (
      -- Random sample (~10% of collection rows)
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

      -- Fallback: top-50 by score (guarantees a result for small collections)
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
        ORDER  BY u.wilson_score DESC
        LIMIT  50
      ) fb
    ) c
    ORDER BY (c.eff_score + 0.1) * random() DESC
    LIMIT 1;

  ELSE
    -- ── Standard mode (with optional subcategory pin) ─────────────────────
    SELECT c.id INTO v_url_id
    FROM (
      -- Random sample (~10% of the urls table)
      SELECT u.id,
             u.wilson_score
               * LEAST(GREATEST(COALESCE(uis.calibrated_weight, 1.0), 0.4), 2.0)
               AS eff_score
      FROM   urls u TABLESAMPLE BERNOULLI(10)
      LEFT   JOIN user_interest_scores uis
                  ON uis.user_id = p_user_id AND uis.subcategory_id = u.subcategory_id
      WHERE  u.approved = TRUE
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
        -- Subcategory pin (from "Roam within this category")
        AND  (p_subcategory_id IS NULL OR u.subcategory_id = p_subcategory_id)
        -- User category prefs (only applied when not pinned to a specific subcategory)
        AND  (
               p_subcategory_id IS NOT NULL
               OR NOT v_has_categories
               OR (v_allowed_subcat_ids IS NOT NULL AND u.subcategory_id = ANY(v_allowed_subcat_ids))
               OR (u.subcategory_id IS NULL AND v_has_categories)
             )
        AND  NOT EXISTS (
               SELECT 1 FROM seen_urls su
               WHERE su.user_id = p_user_id AND su.url_id = u.id
             )

      UNION ALL

      -- Fallback: top-100 by score for niche filters / nearly-exhausted pools
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
          AND  (p_subcategory_id IS NULL OR u.subcategory_id = p_subcategory_id)
          AND  (
                 p_subcategory_id IS NOT NULL
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
