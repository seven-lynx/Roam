-- =============================================================================
-- roam() v29 — Variety, exploration, and fairness improvements
-- =============================================================================
-- Changes from v28:
--  1. TABLESAMPLE BERNOULLI(5) – 5× larger candidate pool (was 1%)
--  2. Domain cooldown: 30 min → 24 hours (stop domain fatigue)
--  3. Seen URLs limit: 2,000 → 10,000 (power-user cliff)
--  4. Recency decay: -0.001 → -0.0003 (evergreen content gets fair chance)
--  5. Scoring: 70% score / 30% random instead of pure random() (signal matters)
--  6. Exploration bonus: low-serve-count URLs get a boost
--  7. Adjacent serving rate: 15% → 25% (now that engagement weights are richer)
--  8. Serendipity mode: 5% chance to pick from a never-seen subcategory
-- =============================================================================

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
  v_serendipity_subcat  UUID;   -- v29: serendipity mode target
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
  -- v29: raised from 2000 to 10000 to prevent power-user cliff
  SELECT array_agg(url_id)
  INTO   v_seen_ids
  FROM (
    SELECT url_id FROM seen_urls
    WHERE  user_id = p_user_id
    ORDER  BY seen_at DESC
    LIMIT  10000
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

  -- ── Serendipity mode (v29): 5% chance to pick a subcategory the user has
  --    NEVER visited. This surfaces completely new content categories. ────────
  v_serendipity_subcat := NULL;
  IF v_discovery_mode = 'discovery'
     AND random() < 0.05
     AND p_subcategory_id IS NULL
     AND p_category_id    IS NULL
     AND p_collection_id  IS NULL
     AND v_allowed_subcat_ids IS NOT NULL
  THEN
    -- Pick a random subcategory from the user's allowed set that they've
    -- never seen a URL from (no entry in seen_urls for that subcategory).
    SELECT sc.id INTO v_serendipity_subcat
    FROM subcategories sc
    WHERE sc.id = ANY(v_allowed_subcat_ids)
      AND NOT EXISTS (
        SELECT 1 FROM seen_urls su
        JOIN urls u ON u.id = su.url_id
        WHERE su.user_id = p_user_id
          AND u.subcategory_id = sc.id
      )
    ORDER BY random()
    LIMIT 1;
  END IF;

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

  -- ── Discovery mode: 25% adjacent serving (up from 15% in v28) ─────────────
  -- Increased now that engagement-derived pair scores make weights more
  -- reliable (skip/dwell signals feed into interest_pair_scores).
  v_adjacent_subcat_id := NULL;
  IF v_discovery_mode = 'discovery'
     AND random() < 0.25
     AND p_subcategory_id IS NULL
     AND p_category_id    IS NULL
     AND p_collection_id  IS NULL
     AND v_serendipity_subcat IS NULL  -- don't override serendipity
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

  v_effective_subcat_id := COALESCE(p_subcategory_id, v_adjacent_subcat_id, v_serendipity_subcat);

  -- ═══════════════════════════════════════════════════════════════════════════
  --  COLLECTION MODE
  -- ═══════════════════════════════════════════════════════════════════════════
  IF p_collection_id IS NOT NULL THEN

    -- v29: TABLESAMPLE 5% (was 1%), 70/30 score/random weighting,
    --      recency decay constant 0.0003 (was 0.001),
    --      exploration bonus for low-serve-count URLs
    SELECT c.id INTO v_url_id
    FROM (
      SELECT u.id,
             (u.roam_score_static
               + CASE WHEN (u.upvotes + u.downvotes) = 0 THEN 0.15 ELSE 0 END
               -- v29: exploration bonus — URLs with few serves get boosted
               + CASE
                   WHEN u.serve_count IS NULL OR u.serve_count = 0 THEN 0.25
                   ELSE 1.0 / (1 + u.serve_count * 0.1)
                 END)
               * LEAST(GREATEST(COALESCE(
                   v_score_weights[array_position(v_score_subcats, u.subcategory_id)],
                   1.0), 0.4), 2.0)
               * CASE
                   WHEN u.published_at IS NULL THEN 0.7
                   -- v29: gentler decay (0.001 → 0.0003)
                   ELSE GREATEST(
                     EXP(-0.0003 * GREATEST(
                       EXTRACT(EPOCH FROM (NOW() - u.published_at)) / 86400.0, 0
                     )), 0.2)
                 END
               AS eff_score
      FROM   urls u TABLESAMPLE BERNOULLI(5)
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
    -- v29: 70% score weight / 30% randomness (was pure random())
    ORDER BY c.eff_score * (0.7 + 0.3 * random()) DESC
    LIMIT 1;

    IF v_url_id IS NULL THEN
      SELECT c.id INTO v_url_id
      FROM (
        SELECT u.id,
               (u.roam_score_static
                 + CASE WHEN (u.upvotes + u.downvotes) = 0 THEN 0.15 ELSE 0 END
                 + CASE
                     WHEN u.serve_count IS NULL OR u.serve_count = 0 THEN 0.25
                     ELSE 1.0 / (1 + u.serve_count * 0.1)
                   END)
                 * LEAST(GREATEST(COALESCE(
                     v_score_weights[array_position(v_score_subcats, u.subcategory_id)],
                     1.0), 0.4), 2.0)
                 * CASE
                     WHEN u.published_at IS NULL THEN 0.7
                     ELSE GREATEST(
                       EXP(-0.0003 * GREATEST(
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
      ORDER BY c.eff_score * (0.7 + 0.3 * random()) DESC
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
               + CASE WHEN (u.upvotes + u.downvotes) = 0 THEN 0.15 ELSE 0 END
               + CASE
                   WHEN u.serve_count IS NULL OR u.serve_count = 0 THEN 0.25
                   ELSE 1.0 / (1 + u.serve_count * 0.1)
                 END)
               * LEAST(GREATEST(COALESCE(
                   v_score_weights[array_position(v_score_subcats, u.subcategory_id)],
                   1.0), 0.4), 2.0)
               * CASE
                   WHEN u.published_at IS NULL THEN 0.7
                   ELSE GREATEST(
                     EXP(-0.0003 * GREATEST(
                       EXTRACT(EPOCH FROM (NOW() - u.published_at)) / 86400.0, 0
                     )), 0.2)
                 END
               AS eff_score
      FROM   urls u TABLESAMPLE BERNOULLI(5)
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
    ORDER BY c.eff_score * (0.7 + 0.3 * random()) DESC
    LIMIT 1;

    IF v_url_id IS NULL THEN
      SELECT c.id INTO v_url_id
      FROM (
        SELECT u.id,
               (u.roam_score_static
                 + CASE WHEN (u.upvotes + u.downvotes) = 0 THEN 0.15 ELSE 0 END
                 + CASE
                     WHEN u.serve_count IS NULL OR u.serve_count = 0 THEN 0.25
                     ELSE 1.0 / (1 + u.serve_count * 0.1)
                   END)
                 * LEAST(GREATEST(COALESCE(
                     v_score_weights[array_position(v_score_subcats, u.subcategory_id)],
                     1.0), 0.4), 2.0)
                 * CASE
                     WHEN u.published_at IS NULL THEN 0.7
                     ELSE GREATEST(
                       EXP(-0.0003 * GREATEST(
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
      ORDER BY c.eff_score * (0.7 + 0.3 * random()) DESC
      LIMIT 1;
    END IF;

  END IF;

  -- ── Record seen + domain cooldown ─────────────────────────────────────────
  -- v29: domain cooldown extended to 24 hours (was 30 minutes)
  IF v_url_id IS NOT NULL THEN
    INSERT INTO seen_urls (user_id, url_id)
    VALUES (p_user_id, v_url_id)
    ON CONFLICT (user_id, url_id) DO UPDATE
      SET seen_at = NOW(), dwell_ms = NULL, skipped = NULL;

    IF v_discovery_mode = 'discovery' AND p_collection_id IS NULL THEN
      SELECT domain INTO v_url_domain FROM urls WHERE id = v_url_id;
      IF v_url_domain IS NOT NULL THEN
        INSERT INTO user_domain_cooldowns (user_id, domain, cooldown_until)
        VALUES (p_user_id, v_url_domain, NOW() + INTERVAL '24 hours')
        ON CONFLICT (user_id, domain) DO UPDATE
          SET cooldown_until = NOW() + INTERVAL '24 hours';
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