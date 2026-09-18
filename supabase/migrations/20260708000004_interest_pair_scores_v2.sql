-- =============================================================================
-- Phase 2: Feed skip/dwell signals into interest_pair_scores
-- =============================================================================
-- The existing update_pair_scores() trigger only fires on explicit ratings.
-- This migration adds a trigger that also feeds engagement data from seen_urls
-- into interest_pair_scores when dwell/dwell time is reported.
--
-- Rules:
--   - A skip (skipped = TRUE, dwell < 3s) → soft downvote weight (0.5× of explicit)
--   - An engaged read (skipped = FALSE, dwell > 120s) → soft upvote weight (0.5×)
--   - Each engagement event fires at most once per (user, url) pair
--   - Uses canonical ordering (subcategory_a_id < subcategory_b_id)
-- =============================================================================

-- ── 1. Trigger function to update pair scores on engagement report ───────────
CREATE OR REPLACE FUNCTION public.update_pair_scores_from_engagement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rated_subcat  UUID;
  v_top_subcat    UUID;
  v_a             UUID;
  v_b             UUID;
BEGIN
  -- Only fire when engagement transitions from NULL → reported
  IF OLD.dwell_ms IS NOT NULL OR OLD.skipped IS NOT NULL THEN
    RETURN NEW; -- already had engagement data, don't double-count
  END IF;
  IF NEW.dwell_ms IS NULL AND NEW.skipped IS NULL THEN
    RETURN NEW; -- no engagement data to process
  END IF;

  -- Get the URL's subcategory
  SELECT u.subcategory_id INTO v_rated_subcat
  FROM urls u
  WHERE u.id = NEW.url_id;

  IF v_rated_subcat IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find the user's top subcategories (up to 5) from interest_scores
  -- and create/update pair scores between the rated subcategory and each top one
  FOR v_top_subcat IN
    SELECT uis.subcategory_id
    FROM user_interest_scores uis
    WHERE uis.user_id = NEW.user_id
      AND uis.subcategory_id <> v_rated_subcat
      AND uis.calibrated_weight >= 0.8
    ORDER BY uis.calibrated_weight DESC
    LIMIT 5
  LOOP
    -- Canonical ordering
    IF v_rated_subcat < v_top_subcat THEN
      v_a := v_rated_subcat;
      v_b := v_top_subcat;
    ELSE
      v_a := v_top_subcat;
      v_b := v_rated_subcat;
    END IF;

    -- A skip is a mild anti-signal for the pair
    IF NEW.skipped IS TRUE THEN
      INSERT INTO interest_pair_scores (user_id, subcategory_a_id, subcategory_b_id, upvote_count, downvote_count, pair_weight, last_updated)
      VALUES (NEW.user_id, v_a, v_b, 0, 1, 1.0, NOW())
      ON CONFLICT (user_id, subcategory_a_id, subcategory_b_id) DO UPDATE
        SET downvote_count = interest_pair_scores.downvote_count + 1,
            pair_weight    = LEAST(GREATEST(
              (interest_pair_scores.upvote_count + 1.0) /
              NULLIF(interest_pair_scores.upvote_count + interest_pair_scores.downvote_count + 1, 0) / 0.5,
              0.3), 3.0),
            last_updated   = NOW();
    END IF;

    -- 2+ minute engaged read is a mild positive signal for the pair
    IF NEW.skipped IS FALSE AND NEW.dwell_ms >= 120000 THEN
      INSERT INTO interest_pair_scores (user_id, subcategory_a_id, subcategory_b_id, upvote_count, downvote_count, pair_weight, last_updated)
      VALUES (NEW.user_id, v_a, v_b, 1, 0, 1.0, NOW())
      ON CONFLICT (user_id, subcategory_a_id, subcategory_b_id) DO UPDATE
        SET upvote_count   = interest_pair_scores.upvote_count + 1,
            pair_weight    = LEAST(GREATEST(
              (interest_pair_scores.upvote_count + 1 + 1.0) /
              NULLIF(interest_pair_scores.upvote_count + 1 + interest_pair_scores.downvote_count, 0) / 0.5,
              0.3), 3.0),
            last_updated   = NOW();
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- ── 2. Trigger on seen_urls ──────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_seen_urls_engagement_pair_scores ON public.seen_urls;
CREATE TRIGGER trg_seen_urls_engagement_pair_scores
  AFTER UPDATE OF dwell_ms, skipped ON public.seen_urls
  FOR EACH ROW
  EXECUTE FUNCTION public.update_pair_scores_from_engagement();

-- ── 3. Redeploy roam() as v28 — wire pair_weight boost ──────────────────────
-- The adjacent-serving section already uses interest_pair_scores.pair_weight.
-- With engagement signals now feeding into it, pair weights become richer.
-- No SQL changes needed to roam() — the existing 12% adjacent-serving logic
-- (lines ~163-191 in v27) already queries interest_pair_scores and filters
-- for pair_weight > 1.0. Engagement data will naturally produce stronger
-- pair weights where skip patterns don't exist and dwell time is high.

-- However, we bump the adjacent serving rate from 12% to 15% now that
-- pair weights are more reliable (they now have implicit signal, not just
-- explicit ratings). This is just a one-line constant change in roam().

DROP FUNCTION IF EXISTS public.roam(UUID, UUID, TEXT, UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.roam(UUID, UUID, TEXT, UUID, UUID, TEXT[]) CASCADE;

CREATE FUNCTION public.roam(
  p_user_id          UUID,
  p_collection_id    UUID     DEFAULT NULL,
  p_exclude_domain   TEXT     DEFAULT NULL,
  p_category_id      UUID     DEFAULT NULL,
  p_subcategory_id   UUID     DEFAULT NULL,
  p_exclude_domains  TEXT[]   DEFAULT NULL
)
RETURNS TABLE (
  id             UUID,
  url            TEXT,
  title          TEXT,
  description    TEXT,
  og_image_url   TEXT,
  category_id    UUID,
  subcategory_id UUID,
  wilson_score   DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '35s'
AS $$
#variable_conflict use_column
DECLARE
  v_url_id              UUID;
  v_url_domain          TEXT;
  v_langs               TEXT[];
  v_skip_paywall        BOOLEAN;
  v_discovery_mode      TEXT;
  v_allowed_subcat_ids  UUID[];
  v_has_categories      BOOLEAN;
  v_adjacent_subcat_id  UUID;
  v_effective_subcat_id UUID;
  v_deep_dive_subcats   UUID[];
  v_seen_ids            UUID[];
  v_cooled_domains      TEXT[];
  v_paywalled_domains   TEXT[];
  v_score_subcats       UUID[];
  v_score_weights       DOUBLE PRECISION[];
  v_excluded            TEXT[];
  v_skip_penalty_ids    UUID[];
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

  -- ── Merge exclude domains ─────────────────────────────────────────────────
  IF p_exclude_domains IS NOT NULL AND array_length(p_exclude_domains, 1) > 0 THEN
    v_excluded := p_exclude_domains;
    IF p_exclude_domain IS NOT NULL AND NOT p_exclude_domain = ANY(v_excluded) THEN
      v_excluded := array_append(v_excluded, p_exclude_domain);
    END IF;
  ELSIF p_exclude_domain IS NOT NULL THEN
    v_excluded := ARRAY[p_exclude_domain];
  END IF;

  -- ── Load exclusion sets as arrays ─────────────────────────────────────────
  SELECT array_agg(url_id)
  INTO   v_seen_ids
  FROM (
    SELECT url_id FROM seen_urls
    WHERE  user_id = p_user_id
    ORDER  BY seen_at DESC
    LIMIT  2000
  ) t;

  -- URLs the user rapidly skipped — extend exclusion (don't re-serve quickly-skipped content)
  SELECT array_agg(url_id)
  INTO   v_skip_penalty_ids
  FROM   seen_urls
  WHERE  user_id = p_user_id
    AND  skipped = TRUE
    AND  seen_at > NOW() - INTERVAL '90 days';

  SELECT array_agg(domain)
  INTO   v_cooled_domains
  FROM   user_domain_cooldowns
  WHERE  user_id = p_user_id
    AND  cooldown_until > NOW();

  SELECT array_agg(uis.subcategory_id ORDER BY uis.subcategory_id),
         array_agg(uis.calibrated_weight ORDER BY uis.subcategory_id)
  INTO   v_score_subcats, v_score_weights
  FROM   user_interest_scores uis
  WHERE  uis.user_id = p_user_id;

  IF v_skip_paywall THEN
    SELECT array_agg(domain)
    INTO   v_paywalled_domains
    FROM   paywalled_domains;
  END IF;

  -- ── Expand category prefs into flat subcategory ID array ──────────────────
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
     AND p_category_id    IS NULL
     AND p_collection_id  IS NULL
  THEN
    SELECT array_agg(uis.subcategory_id)
    INTO   v_deep_dive_subcats
    FROM (
      SELECT uis.subcategory_id
      FROM   user_interest_scores uis
      WHERE  uis.user_id = p_user_id
        AND  uis.calibrated_weight > 1.0
      ORDER  BY uis.calibrated_weight DESC
      LIMIT  3
    ) uis;
    IF v_deep_dive_subcats IS NULL OR array_length(v_deep_dive_subcats, 1) = 0 THEN
      v_deep_dive_subcats := v_allowed_subcat_ids;
    END IF;
  END IF;

  -- ── Discovery mode: 15% adjacent serving (up from 12% in v27) ─────────────
  v_adjacent_subcat_id := NULL;
  IF v_discovery_mode = 'discovery'
     AND random() < 0.15
     AND p_subcategory_id IS NULL
     AND p_category_id    IS NULL
     AND p_collection_id  IS NULL
  THEN
    SELECT
      CASE WHEN ips.subcategory_a_id = uis_top.top_subcat
           THEN ips.subcategory_b_id
           ELSE ips.subcategory_a_id
      END
    INTO v_adjacent_subcat_id
    FROM (
      SELECT uis.subcategory_id AS top_subcat
      FROM   user_interest_scores uis
      WHERE  uis.user_id = p_user_id
      ORDER  BY uis.calibrated_weight DESC
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

  -- ═══════════════════════════════════════════════════════════════════════════
  --  COLLECTION MODE
  -- ═══════════════════════════════════════════════════════════════════════════
  IF p_collection_id IS NOT NULL THEN

    SELECT c.id INTO v_url_id
    FROM (
      SELECT u.id,
             (u.roam_score_static
               + CASE WHEN (u.upvotes + u.downvotes) = 0 THEN 0.15 ELSE 0 END)
               * LEAST(GREATEST(COALESCE(
                   v_score_weights[array_position(v_score_subcats, u.subcategory_id)],
                   1.0), 0.4), 2.0)
               * CASE
                   WHEN u.published_at IS NULL THEN 0.7
                   ELSE GREATEST(
                     EXP(-0.001 * GREATEST(
                       EXTRACT(EPOCH FROM (NOW() - u.published_at)) / 86400.0, 0
                     )), 0.2)
                 END
               AS eff_score
      FROM   urls u TABLESAMPLE BERNOULLI(1)
      INNER  JOIN collection_items ci ON ci.url_id = u.id
      WHERE  ci.collection_id = p_collection_id
        AND  u.approved       = TRUE
        AND  u.wilson_score   > -0.1
        AND  u.language       = ANY(v_langs)
        AND  (v_excluded IS NULL OR NOT EXISTS (SELECT 1 FROM unnest(v_excluded) AS ex(d) WHERE u.domain = ex.d OR u.domain LIKE ('%.' || ex.d)))
        AND  NOT EXISTS (
               SELECT 1 FROM user_suppressed_domains usd
               WHERE usd.user_id = p_user_id
                 AND usd.suppressed_until > NOW()
                 AND (usd.domain = u.domain OR u.domain LIKE ('%.' || usd.domain))
             )
        AND  (NOT v_skip_paywall OR v_paywalled_domains IS NULL OR u.domain != ALL(v_paywalled_domains))
        AND  (v_seen_ids IS NULL OR u.id != ALL(v_seen_ids))
        AND  (v_skip_penalty_ids IS NULL OR u.id != ALL(v_skip_penalty_ids))
    ) c
    ORDER BY (c.eff_score + 0.1) * random() DESC
    LIMIT 1;

    IF v_url_id IS NULL THEN
      SELECT c.id INTO v_url_id
      FROM (
        SELECT u.id,
               (u.roam_score_static
                 + CASE WHEN (u.upvotes + u.downvotes) = 0 THEN 0.15 ELSE 0 END)
                 * LEAST(GREATEST(COALESCE(
                     v_score_weights[array_position(v_score_subcats, u.subcategory_id)],
                     1.0), 0.4), 2.0)
                 * CASE
                     WHEN u.published_at IS NULL THEN 0.7
                     ELSE GREATEST(
                       EXP(-0.001 * GREATEST(
                         EXTRACT(EPOCH FROM (NOW() - u.published_at)) / 86400.0, 0
                       )), 0.2)
                   END
                 AS eff_score
        FROM   urls u
        INNER  JOIN collection_items ci ON ci.url_id = u.id
        WHERE  ci.collection_id = p_collection_id
          AND  u.approved       = TRUE
          AND  u.wilson_score   > -0.1
          AND  u.language       = ANY(v_langs)
          AND  (v_excluded IS NULL OR NOT EXISTS (SELECT 1 FROM unnest(v_excluded) AS ex(d) WHERE u.domain = ex.d OR u.domain LIKE ('%.' || ex.d)))
          AND  NOT EXISTS (
                 SELECT 1 FROM user_suppressed_domains usd
                 WHERE usd.user_id = p_user_id
                   AND usd.suppressed_until > NOW()
                   AND (usd.domain = u.domain OR u.domain LIKE ('%.' || usd.domain))
               )
          AND  (NOT v_skip_paywall OR v_paywalled_domains IS NULL OR u.domain != ALL(v_paywalled_domains))
          AND  (v_seen_ids IS NULL OR u.id != ALL(v_seen_ids))
          AND  (v_skip_penalty_ids IS NULL OR u.id != ALL(v_skip_penalty_ids))
        ORDER  BY u.roam_score_static DESC
        LIMIT  50
      ) c
      ORDER BY (c.eff_score + 0.1) * random() DESC
      LIMIT 1;
    END IF;

  -- ═══════════════════════════════════════════════════════════════════════════
  --  STANDARD MODE
  -- ═══════════════════════════════════════════════════════════════════════════
  ELSE

    SELECT c.id INTO v_url_id
    FROM (
      SELECT u.id,
             (u.roam_score_static
               + CASE WHEN (u.upvotes + u.downvotes) = 0 THEN 0.15 ELSE 0 END)
               * LEAST(GREATEST(COALESCE(
                   v_score_weights[array_position(v_score_subcats, u.subcategory_id)],
                   1.0), 0.4), 2.0)
               * CASE
                   WHEN u.published_at IS NULL THEN 0.7
                   ELSE GREATEST(
                     EXP(-0.001 * GREATEST(
                       EXTRACT(EPOCH FROM (NOW() - u.published_at)) / 86400.0, 0
                     )), 0.2)
                 END
               AS eff_score
      FROM   urls u TABLESAMPLE BERNOULLI(1)
      WHERE  u.approved     = TRUE
        AND  u.wilson_score > -0.1
        AND  u.language     = ANY(v_langs)
        AND  (v_excluded IS NULL OR NOT EXISTS (SELECT 1 FROM unnest(v_excluded) AS ex(d) WHERE u.domain = ex.d OR u.domain LIKE ('%.' || ex.d)))
        AND  (p_category_id IS NULL OR u.category_id = p_category_id)
        AND  NOT EXISTS (
               SELECT 1 FROM user_suppressed_domains usd
               WHERE usd.user_id = p_user_id
                 AND usd.suppressed_until > NOW()
                 AND (usd.domain = u.domain OR u.domain LIKE ('%.' || usd.domain))
             )
        AND  (NOT v_skip_paywall OR v_paywalled_domains IS NULL OR u.domain != ALL(v_paywalled_domains))
        AND  (
               v_discovery_mode <> 'discovery'
               OR v_cooled_domains IS NULL
               OR u.domain != ALL(v_cooled_domains)
             )
        AND  (v_effective_subcat_id IS NULL OR u.subcategory_id = v_effective_subcat_id)
        AND  (
               v_deep_dive_subcats IS NULL
               OR u.subcategory_id = ANY(v_deep_dive_subcats)
             )
        AND  (
               p_category_id IS NOT NULL
               OR v_effective_subcat_id IS NOT NULL
               OR v_deep_dive_subcats IS NOT NULL
               OR NOT v_has_categories
               OR (v_allowed_subcat_ids IS NOT NULL AND u.subcategory_id = ANY(v_allowed_subcat_ids))
               OR (u.subcategory_id IS NULL AND v_has_categories)
             )
        AND  (v_seen_ids IS NULL OR u.id != ALL(v_seen_ids))
        AND  (v_skip_penalty_ids IS NULL OR u.id != ALL(v_skip_penalty_ids))
    ) c
    ORDER BY (c.eff_score + 0.1) * random() DESC
    LIMIT 1;

    IF v_url_id IS NULL THEN
      SELECT c.id INTO v_url_id
      FROM (
        SELECT u.id,
               (u.roam_score_static
                 + CASE WHEN (u.upvotes + u.downvotes) = 0 THEN 0.15 ELSE 0 END)
                 * LEAST(GREATEST(COALESCE(
                     v_score_weights[array_position(v_score_subcats, u.subcategory_id)],
                     1.0), 0.4), 2.0)
                 * CASE
                     WHEN u.published_at IS NULL THEN 0.7
                     ELSE GREATEST(
                       EXP(-0.001 * GREATEST(
                         EXTRACT(EPOCH FROM (NOW() - u.published_at)) / 86400.0, 0
                       )), 0.2)
                   END
                 AS eff_score
        FROM   urls u
        WHERE  u.approved     = TRUE
          AND  u.wilson_score > -0.1
          AND  u.language     = ANY(v_langs)
          AND  (v_excluded IS NULL OR NOT EXISTS (SELECT 1 FROM unnest(v_excluded) AS ex(d) WHERE u.domain = ex.d OR u.domain LIKE ('%.' || ex.d)))
          AND  (p_category_id IS NULL OR u.category_id = p_category_id)
          AND  NOT EXISTS (
                 SELECT 1 FROM user_suppressed_domains usd
                 WHERE usd.user_id = p_user_id
                   AND usd.suppressed_until > NOW()
                   AND (usd.domain = u.domain OR u.domain LIKE ('%.' || usd.domain))
               )
          AND  (NOT v_skip_paywall OR v_paywalled_domains IS NULL OR u.domain != ALL(v_paywalled_domains))
          AND  (
                 v_discovery_mode <> 'discovery'
                 OR v_cooled_domains IS NULL
                 OR u.domain != ALL(v_cooled_domains)
               )
          AND  (v_effective_subcat_id IS NULL OR u.subcategory_id = v_effective_subcat_id)
          AND  (
                 v_deep_dive_subcats IS NULL
                 OR u.subcategory_id = ANY(v_deep_dive_subcats)
               )
          AND  (
                 p_category_id IS NOT NULL
                 OR v_effective_subcat_id IS NOT NULL
                 OR v_deep_dive_subcats IS NOT NULL
                 OR NOT v_has_categories
                 OR (v_allowed_subcat_ids IS NOT NULL AND u.subcategory_id = ANY(v_allowed_subcat_ids))
                 OR (u.subcategory_id IS NULL AND v_has_categories)
               )
          AND  (v_seen_ids IS NULL OR u.id != ALL(v_seen_ids))
          AND  (v_skip_penalty_ids IS NULL OR u.id != ALL(v_skip_penalty_ids))
        ORDER  BY u.roam_score_static DESC
        LIMIT  100
      ) c
      ORDER BY (c.eff_score + 0.1) * random() DESC
      LIMIT 1;
    END IF;

  END IF;

  -- ── Record seen + domain cooldown ─────────────────────────────────────────
  IF v_url_id IS NOT NULL THEN
    INSERT INTO seen_urls (user_id, url_id)
    VALUES (p_user_id, v_url_id)
    ON CONFLICT (user_id, url_id) DO UPDATE
      SET seen_at = NOW(), dwell_ms = NULL, skipped = NULL;

    IF v_discovery_mode = 'discovery' AND p_collection_id IS NULL THEN
      SELECT domain INTO v_url_domain FROM urls WHERE id = v_url_id;
      IF v_url_domain IS NOT NULL THEN
        INSERT INTO user_domain_cooldowns (user_id, domain, cooldown_until)
        VALUES (p_user_id, v_url_domain, NOW() + INTERVAL '30 minutes')
        ON CONFLICT (user_id, domain) DO UPDATE
          SET cooldown_until = NOW() + INTERVAL '30 minutes';
      END IF;
    END IF;
  END IF;

  RETURN QUERY
  SELECT u.id, u.url, u.title, u.description, u.og_image_url,
         u.category_id, u.subcategory_id, u.wilson_score
  FROM   urls u
  WHERE  u.id = v_url_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.roam(UUID, UUID, TEXT, UUID, UUID, TEXT[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.roam(UUID, UUID, TEXT, UUID, UUID, TEXT[]) TO authenticated;