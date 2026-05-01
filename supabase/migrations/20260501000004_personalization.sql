-- =============================================================================
-- Personalization: domain suppression + subcategory affinity
-- =============================================================================
--
-- Two signals derived from per-user ratings:
--
-- 1. DOMAIN SUPPRESSION
--    A user who downvotes 2+ URLs from the same domain will stop seeing that
--    domain for 30 days. A trigger on `ratings` maintains the
--    `user_suppressed_domains` table automatically. Suppression lifts if the
--    user removes enough downvotes to drop below 2.
--
-- 2. SUBCATEGORY AFFINITY
--    Each upvote on a URL increases the user's affinity score for that URL's
--    subcategory; downvotes decrease it. roam() multiplies wilson_score by
--    (1 + 0.3 × clamp(affinity, 0, 10) / 10) — up to +30% for subcategories
--    the user has consistently upvoted. Negative affinity is clamped to 0:
--    it never suppresses content (domain suppression handles repeated dislikes).
--    A trigger on `ratings` maintains the table; existing ratings are backfilled.
-- =============================================================================

-- ── 1. user_suppressed_domains ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_suppressed_domains (
  user_id          UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  domain           TEXT        NOT NULL,
  downvote_count   SMALLINT    NOT NULL DEFAULT 2,
  suppressed_until TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_user_suppressed_domains
  ON public.user_suppressed_domains (user_id, domain);

ALTER TABLE public.user_suppressed_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppressed_domains: users can read own"
  ON public.user_suppressed_domains FOR SELECT
  USING (auth.uid() = user_id);

-- ── 2. user_subcategory_affinity ─────────────────────────────────────────────
-- score = running sum of votes (+1 / -1) for URLs in that subcategory.
CREATE TABLE IF NOT EXISTS public.user_subcategory_affinity (
  user_id        UUID   NOT NULL REFERENCES auth.users    ON DELETE CASCADE,
  subcategory_id UUID   NOT NULL REFERENCES subcategories ON DELETE CASCADE,
  score          FLOAT  NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, subcategory_id)
);

ALTER TABLE public.user_subcategory_affinity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "affinity: users can read own"
  ON public.user_subcategory_affinity FOR SELECT
  USING (auth.uid() = user_id);

-- ── 3. Trigger: maintain domain suppression ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_domain_suppression()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_domain TEXT;
  v_uid    UUID;
  v_count  BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_uid := OLD.user_id;
    SELECT u.domain INTO v_domain FROM urls u WHERE u.id = OLD.url_id;
  ELSE
    v_uid := NEW.user_id;
    SELECT u.domain INTO v_domain FROM urls u WHERE u.id = NEW.url_id;
  END IF;

  IF v_domain IS NULL THEN RETURN NULL; END IF;

  -- Count this user's current -1 ratings for this domain (AFTER trigger so
  -- the triggering row is already reflected in the table).
  SELECT COUNT(*) INTO v_count
  FROM   ratings r
  INNER  JOIN urls u ON u.id = r.url_id
  WHERE  r.user_id = v_uid
    AND  u.domain  = v_domain
    AND  r.value   = -1;

  IF v_count >= 2 THEN
    INSERT INTO user_suppressed_domains (user_id, domain, downvote_count, suppressed_until)
    VALUES (v_uid, v_domain, v_count::SMALLINT, NOW() + INTERVAL '30 days')
    ON CONFLICT (user_id, domain) DO UPDATE
      SET downvote_count   = EXCLUDED.downvote_count,
          -- Push suppression window forward, never backward
          suppressed_until = GREATEST(user_suppressed_domains.suppressed_until, EXCLUDED.suppressed_until);
  ELSE
    DELETE FROM user_suppressed_domains
    WHERE user_id = v_uid AND domain = v_domain;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_ratings_domain_suppression ON public.ratings;
CREATE TRIGGER trg_ratings_domain_suppression
  AFTER INSERT OR UPDATE OR DELETE ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_domain_suppression();

-- ── 4. Trigger: maintain subcategory affinity ────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_subcategory_affinity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_subcat_id UUID;
  v_uid       UUID;
  v_delta     FLOAT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT subcategory_id INTO v_subcat_id FROM urls WHERE id = NEW.url_id;
    v_uid   := NEW.user_id;
    v_delta := NEW.value;
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT subcategory_id INTO v_subcat_id FROM urls WHERE id = NEW.url_id;
    v_uid   := NEW.user_id;
    v_delta := NEW.value - OLD.value;  -- e.g. flip +1→-1 gives delta = -2
  ELSE -- DELETE
    SELECT subcategory_id INTO v_subcat_id FROM urls WHERE id = OLD.url_id;
    v_uid   := OLD.user_id;
    v_delta := -OLD.value;
  END IF;

  -- No-op if URL has no subcategory, or vote didn't actually change
  IF v_subcat_id IS NULL OR v_delta = 0 THEN RETURN NULL; END IF;

  INSERT INTO user_subcategory_affinity (user_id, subcategory_id, score)
  VALUES (v_uid, v_subcat_id, v_delta)
  ON CONFLICT (user_id, subcategory_id) DO UPDATE
    SET score = user_subcategory_affinity.score + EXCLUDED.score;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_ratings_subcategory_affinity ON public.ratings;
CREATE TRIGGER trg_ratings_subcategory_affinity
  AFTER INSERT OR UPDATE OR DELETE ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_subcategory_affinity();

-- ── 5. Backfill from existing ratings ────────────────────────────────────────

-- Affinity backfill
INSERT INTO user_subcategory_affinity (user_id, subcategory_id, score)
SELECT r.user_id, u.subcategory_id, SUM(r.value)::FLOAT
FROM   ratings r
INNER  JOIN urls u ON u.id = r.url_id
WHERE  u.subcategory_id IS NOT NULL
GROUP  BY r.user_id, u.subcategory_id
ON CONFLICT (user_id, subcategory_id) DO UPDATE
  SET score = EXCLUDED.score;

-- Domain suppression backfill
INSERT INTO user_suppressed_domains (user_id, domain, downvote_count, suppressed_until)
SELECT r.user_id, u.domain, COUNT(*)::SMALLINT, NOW() + INTERVAL '30 days'
FROM   ratings r
INNER  JOIN urls u ON u.id = r.url_id
WHERE  r.value = -1
  AND  u.domain IS NOT NULL
GROUP  BY r.user_id, u.domain
HAVING COUNT(*) >= 2
ON CONFLICT (user_id, domain) DO NOTHING;

-- ── 6. roam() v5: affinity-weighted + domain suppression ─────────────────────
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
      -- Random sample
      SELECT u.id,
             u.wilson_score * (1.0 + 0.3 * LEAST(GREATEST(COALESCE(aff.score, 0), 0), 10.0) / 10.0) AS eff_score
      FROM   urls u TABLESAMPLE BERNOULLI(10)
      LEFT   JOIN user_subcategory_affinity aff
                  ON aff.user_id = p_user_id AND aff.subcategory_id = u.subcategory_id
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

      -- Fallback top-50
      SELECT u.id,
             u.wilson_score * (1.0 + 0.3 * LEAST(GREATEST(COALESCE(aff.score, 0), 0), 10.0) / 10.0) AS eff_score
      FROM   urls u
      LEFT   JOIN user_subcategory_affinity aff
                  ON aff.user_id = p_user_id AND aff.subcategory_id = u.subcategory_id
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
    ) c
    ORDER BY (c.eff_score + 0.1) * random() DESC
    LIMIT 1;

  ELSE
    -- ── Standard mode ────────────────────────────────────────────────────────
    SELECT c.id INTO v_url_id
    FROM (
      -- Random sample (~10% of table pages, different every call)
      SELECT u.id,
             u.wilson_score * (1.0 + 0.3 * LEAST(GREATEST(COALESCE(aff.score, 0), 0), 10.0) / 10.0) AS eff_score
      FROM   urls u TABLESAMPLE BERNOULLI(10)
      LEFT   JOIN user_subcategory_affinity aff
                  ON aff.user_id = p_user_id AND aff.subcategory_id = u.subcategory_id
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

      -- Fallback top-100
      SELECT u.id,
             u.wilson_score * (1.0 + 0.3 * LEAST(GREATEST(COALESCE(aff.score, 0), 0), 10.0) / 10.0) AS eff_score
      FROM   urls u
      LEFT   JOIN user_subcategory_affinity aff
                  ON aff.user_id = p_user_id AND aff.subcategory_id = u.subcategory_id
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
    ORDER BY (c.eff_score + 0.1) * random() DESC
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
