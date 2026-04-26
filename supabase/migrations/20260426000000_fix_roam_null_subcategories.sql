-- Fix roam() function to handle URLs with NULL subcategory_id
-- The initial seeding didn't assign subcategories to URLs, so roam() needs to
-- accept unassigned URLs when user has selected category pillars.

CREATE OR REPLACE FUNCTION public.roam(
  p_user_id       UUID,
  p_collection_id UUID DEFAULT NULL
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
  v_url_id UUID;
BEGIN
  -- Callers may only roam as themselves.
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_collection_id IS NOT NULL THEN
    -- ── Collection mode ────────────────────────────────────────────────────
    SELECT u.id INTO v_url_id
    FROM urls u
    INNER JOIN collection_items ci ON ci.url_id = u.id
    WHERE ci.collection_id = p_collection_id
      AND u.approved = TRUE
      AND NOT EXISTS (
        SELECT 1 FROM seen_urls su
        WHERE su.user_id = p_user_id AND su.url_id = u.id
      )
    ORDER BY (u.wilson_score + 0.1) * random() DESC
    LIMIT 1;

  ELSE
    -- ── Standard mode ──────────────────────────────────────────────────────
    -- If URLs have subcategories assigned, filter by user's selected subcategories.
    -- If URLs have NULL subcategories, filter by user's selected category pillars.
    SELECT u.id INTO v_url_id
    FROM urls u
    LEFT JOIN subcategories sc ON sc.id = u.subcategory_id
    WHERE u.approved = TRUE
      AND (
        -- Case 1: URL has a subcategory assigned
        (u.subcategory_id IS NOT NULL AND sc.id IS NOT NULL AND (
          -- User explicitly selected this subcategory
          EXISTS (
            SELECT 1 FROM user_categories uc
            WHERE uc.user_id = p_user_id
              AND uc.subcategory_id = u.subcategory_id
          )
          OR (
            -- User selected the whole pillar with no subcategory refinements
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
        -- Case 2: URL has NULL subcategory (unassigned) - allow if user selected any category
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

  -- Return the selected URL row (empty result set if pool is exhausted).
  RETURN QUERY
  SELECT u.id, u.url, u.title, u.description, u.og_image_url,
         u.subcategory_id, u.wilson_score
  FROM urls u
  WHERE u.id = v_url_id;
END;
$$;
