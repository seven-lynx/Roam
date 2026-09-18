-- =============================================================================
-- Interest Interaction Patterns & Adjacent Category Recommendations (Task 11.29)
-- =============================================================================
--
-- Tracks which PAIRS of subcategories produce high engagement together for each
-- user. When a user consistently upvotes in both Physics and Philosophy, the
-- pair (Physics, Philosophy) gets a high pair_weight.
--
-- PAIR SCORE UPDATE:
--   When a user rates a URL in subcategory A, we look at their top-5 other
--   subcategories by calibrated_weight and upsert pair counts for each pairing.
--   pair_weight = (upvote_count / total) / 0.5  (same formula as calibrated_weight)
--
-- ADJACENT SERVING IN roam():
--   12% of requests: find the user's top primary subcategory, find its best
--   pair partner from interest_pair_scores, and serve from that adjacent
--   subcategory. This enables serendipitous discovery within the user's
--   demonstrated interest space — no explicit "explore mode" needed.
--
-- Pairs are stored in canonical order (subcategory_a_id < subcategory_b_id)
-- to avoid duplicate rows.
-- =============================================================================

-- ── 1. interest_pair_scores table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.interest_pair_scores (
  user_id          UUID    NOT NULL REFERENCES auth.users    ON DELETE CASCADE,
  subcategory_a_id UUID    NOT NULL REFERENCES subcategories ON DELETE CASCADE,
  subcategory_b_id UUID    NOT NULL REFERENCES subcategories ON DELETE CASCADE,
  upvote_count     INTEGER NOT NULL DEFAULT 0,
  downvote_count   INTEGER NOT NULL DEFAULT 0,
  pair_weight      FLOAT   NOT NULL DEFAULT 1.0,
  last_updated     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, subcategory_a_id, subcategory_b_id),
  CHECK (subcategory_a_id < subcategory_b_id)  -- canonical order enforced
);

CREATE INDEX IF NOT EXISTS idx_interest_pair_scores_user
  ON public.interest_pair_scores (user_id, pair_weight DESC);

ALTER TABLE public.interest_pair_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pair_scores: users can read own"
  ON public.interest_pair_scores FOR SELECT
  USING (auth.uid() = user_id);

-- ── 2. Trigger: maintain pair scores on every rating ─────────────────────────
--
-- Fires AFTER trg_ratings_interest_scores (alphabetical order), so
-- user_interest_scores already reflects the latest rating when this runs.
-- Only processes INSERT and UPDATE; DELETE is skipped (pair weights degrade
-- naturally as numerator stays flat while the table ages).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_pair_scores()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_subcat_id      UUID;
  v_uid            UUID;
  v_up_inc         INTEGER;
  v_dn_inc         INTEGER;
  v_subcat_a       UUID;
  v_subcat_b       UUID;
  rec              RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN RETURN NULL; END IF;
  IF TG_OP = 'UPDATE' AND NEW.value = OLD.value THEN RETURN NULL; END IF;

  v_uid := NEW.user_id;
  SELECT subcategory_id INTO v_subcat_id FROM urls WHERE id = NEW.url_id;
  IF v_subcat_id IS NULL THEN RETURN NULL; END IF;

  v_up_inc := CASE WHEN NEW.value =  1 THEN 1 ELSE 0 END;
  v_dn_inc := CASE WHEN NEW.value = -1 THEN 1 ELSE 0 END;

  -- Find the top-5 other subcategories this user engages with
  FOR rec IN
    SELECT subcategory_id AS paired
    FROM   user_interest_scores
    WHERE  user_id = v_uid
      AND  subcategory_id != v_subcat_id
      AND  calibrated_weight >= 0.8   -- only pair with subcategories the user likes
    ORDER  BY calibrated_weight DESC
    LIMIT  5
  LOOP
    -- Canonical order: smaller UUID first
    IF v_subcat_id < rec.paired THEN
      v_subcat_a := v_subcat_id;
      v_subcat_b := rec.paired;
    ELSE
      v_subcat_a := rec.paired;
      v_subcat_b := v_subcat_id;
    END IF;

    INSERT INTO interest_pair_scores
      (user_id, subcategory_a_id, subcategory_b_id,
       upvote_count, downvote_count, pair_weight, last_updated)
    VALUES (
      v_uid, v_subcat_a, v_subcat_b,
      v_up_inc, v_dn_inc,
      CASE WHEN (v_up_inc + v_dn_inc) = 0 THEN 1.0
           ELSE v_up_inc::FLOAT / (v_up_inc + v_dn_inc)::FLOAT / 0.5
      END,
      NOW()
    )
    ON CONFLICT (user_id, subcategory_a_id, subcategory_b_id) DO UPDATE SET
      upvote_count   = interest_pair_scores.upvote_count   + v_up_inc,
      downvote_count = interest_pair_scores.downvote_count + v_dn_inc,
      pair_weight    = CASE
        WHEN (interest_pair_scores.upvote_count   + v_up_inc
            + interest_pair_scores.downvote_count + v_dn_inc) = 0
        THEN 1.0
        ELSE (interest_pair_scores.upvote_count + v_up_inc)::FLOAT
           / (interest_pair_scores.upvote_count   + v_up_inc
            + interest_pair_scores.downvote_count + v_dn_inc)::FLOAT
           / 0.5
      END,
      last_updated = NOW();
  END LOOP;

  RETURN NULL;
END;
$$;

-- Trigger fires after trg_ratings_interest_scores (p < r alphabetically)
DROP TRIGGER IF EXISTS trg_ratings_pair_scores ON public.ratings;
CREATE TRIGGER trg_ratings_pair_scores
  AFTER INSERT OR UPDATE OR DELETE ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_pair_scores();

-- ── 3. Backfill pairs from existing user_interest_scores ─────────────────────
-- For each user, cross-join their top subcategories (calibrated_weight >= 0.8)
-- and seed pair scores as the geometric mean of their individual weights.
INSERT INTO interest_pair_scores
  (user_id, subcategory_a_id, subcategory_b_id, upvote_count, downvote_count, pair_weight, last_updated)
SELECT
  a.user_id,
  LEAST(a.subcategory_id, b.subcategory_id)    AS subcategory_a_id,
  GREATEST(a.subcategory_id, b.subcategory_id) AS subcategory_b_id,
  LEAST(a.upvote_count, b.upvote_count)        AS upvote_count,
  LEAST(a.downvote_count, b.downvote_count)    AS downvote_count,
  SQRT(a.calibrated_weight * b.calibrated_weight) AS pair_weight,
  NOW()
FROM   user_interest_scores a
INNER  JOIN user_interest_scores b
       ON  b.user_id        = a.user_id
       AND b.subcategory_id > a.subcategory_id   -- canonical order, no duplicates
WHERE  a.calibrated_weight >= 0.8
  AND  b.calibrated_weight >= 0.8
ON CONFLICT (user_id, subcategory_a_id, subcategory_b_id) DO UPDATE SET
  upvote_count   = EXCLUDED.upvote_count,
  downvote_count = EXCLUDED.downvote_count,
  pair_weight    = EXCLUDED.pair_weight,
  last_updated   = EXCLUDED.last_updated;

-- ── 4. roam() v7: adjacent subcategory serving (12% of requests) ─────────────
--
-- When random() < 0.12 and no explicit subcategory/collection pin is active:
--   1. Find the user's top subcategory by calibrated_weight ("primary")
--   2. Find the best pair partner for primary from interest_pair_scores
--   3. Serve a URL from that adjacent subcategory
--
-- This produces serendipitous-yet-relevant discovery: users who love Physics
-- and have shown they enjoy Physics+Philosophy together will occasionally
-- see a Philosophy URL during normal roam sessions.
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
  v_url_id              UUID;
  v_langs               TEXT[];
  v_skip_paywall        BOOLEAN;
  v_allowed_subcat_ids  UUID[];
  v_has_categories      BOOLEAN;
  v_adjacent_subcat_id  UUID;    -- resolved adjacent subcategory (12% serving)
  v_effective_subcat_id UUID;    -- COALESCE(p_subcategory_id, v_adjacent_subcat_id)
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

  -- ── Adjacent subcategory (12% of standard, un-pinned requests) ───────────
  v_adjacent_subcat_id := NULL;
  IF random() < 0.12
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

  -- Effective subcategory: explicit pin takes priority, then adjacent
  v_effective_subcat_id := COALESCE(p_subcategory_id, v_adjacent_subcat_id);

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
    -- ── Standard mode (with optional subcategory pin or adjacent serving) ──
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
        -- Subcategory pin OR adjacent serving
        AND  (v_effective_subcat_id IS NULL OR u.subcategory_id = v_effective_subcat_id)
        -- User category prefs (skipped when pinned or serving adjacent)
        AND  (
               v_effective_subcat_id IS NOT NULL
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
          AND  (v_effective_subcat_id IS NULL OR u.subcategory_id = v_effective_subcat_id)
          AND  (
                 v_effective_subcat_id IS NOT NULL
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
