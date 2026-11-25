-- =============================================================================
-- Roam - user tag profile: prior, decay, graph hop, read (tag-rollout T10, D5-D7)
-- =============================================================================
-- Three read-time functions over the weights the sibling migration writes. None
-- of them writes anything, so `replace_user_interests()` keeps working untouched
-- and there is no backfill to run when a user edits their interests.
--
--   user_tag_prior(uuid)        onboarding prior: the user's subcategories ->
--                               subcategory_tag_affinity, at most 1.0 per tag
--   user_tag_weight_map(uuid)   stored weight, decayed, plus a one-hop graph
--                               contribution and the prior at half weight
--   user_tag_profile(uuid, int) the ranked profile a caller may read
--
-- D5 was amended on 2026-11-25 (issue #147): the prior reads the corpus-derived
-- `subcategory_tag_affinity` (667 rows over 61 subcategories), not the
-- hand-written `subcategory_tag_mapping`, because the bridge agrees with the
-- tagger's tags on only 21.88 % of tagged URLs - seeding a new user from it
-- would hand them tags the corpus barely carries.
--
-- D6: decay is applied on read (weight * 0.95 ^ weeks), never by a cron.
-- D7: the one-hop expansion lives in user_tag_weight_map(), not in roam(), so the
-- eight scoring sites T11 touches see exactly one weight per tag.
--
-- Rollback: see RUNBOOK.md -> 20261125150143_user_tag_prior_decay_profile.sql
-- =============================================================================

-- ── Onboarding prior (D5) ────────────────────────────────────────────────────
-- A pillar row (subcategory_id IS NULL) means "the whole pillar", so it expands
-- to every subcategory in that category; a topic row is one subcategory. The sum
-- of the affinity shares is divided by the number of interests, so a user who
-- picked one topic gets that topic's real shares rather than a share per interest
-- added up, and capped at 1.0 because the map is a prior, not a score.
CREATE OR REPLACE FUNCTION public.user_tag_prior(p_user UUID)
RETURNS TABLE (tag_id UUID, weight NUMERIC)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH interests AS (
    SELECT DISTINCT sc.slug
    FROM public.user_categories uc
    JOIN public.subcategories sc
      ON sc.id = uc.subcategory_id
      OR (uc.subcategory_id IS NULL AND sc.category_id = uc.category_id)
    WHERE uc.user_id = p_user
  ),
  n AS (
    SELECT greatest(count(*), 1)::NUMERIC AS interest_count FROM interests
  )
  SELECT a.tag_id,
         round(least(1.0, sum(a.weight) / n.interest_count), 4) AS weight
  FROM interests i
  JOIN public.subcategory_tag_affinity a ON a.subcategory_slug = i.slug
  JOIN public.tags t ON t.id = a.tag_id AND t.is_active
  CROSS JOIN n
  GROUP BY a.tag_id, n.interest_count
  HAVING sum(a.weight) > 0
$$;

COMMENT ON FUNCTION public.user_tag_prior(UUID) IS
  'Read-time onboarding prior: the caller-selected subcategories (or pillars) mapped through subcategory_tag_affinity, divided by the number of interests and capped at 1.0 per tag. Writes nothing.';

-- ── The weight map: decay + one-hop graph + prior at half weight (D6, D7) ────
-- A graph neighbour counts at half of its source tag's decayed weight, degraded
-- by the edge weight sqrt(Jaccard) so a weak edge cannot flood the multiplier.
-- An edge stored in either direction is followed once, and a tag reachable by
-- several edges keeps its strongest contribution rather than the sum: two routes
-- to the same tag are not twice the evidence.
CREATE OR REPLACE FUNCTION public.user_tag_weight_map(p_user UUID)
RETURNS TABLE (tag_id UUID, weight NUMERIC)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH own AS (
    SELECT w.tag_id,
           w.weight * power(
             0.95::NUMERIC,
             greatest(0, extract(epoch FROM (now() - w.updated_at)) / 604800)
           ) AS base
    FROM public.user_tag_weights w
    WHERE w.user_id = p_user
      AND w.weight > 0
  ),
  hop AS (
    SELECT r.to_tag_id AS tag_id, max(0.5 * o.base * r.weight) AS base
    FROM own o
    JOIN public.tag_relations r ON r.from_tag_id = o.tag_id
    GROUP BY r.to_tag_id
    UNION ALL
    SELECT r.from_tag_id AS tag_id, max(0.5 * o.base * r.weight) AS base
    FROM own o
    JOIN public.tag_relations r ON r.to_tag_id = o.tag_id
    GROUP BY r.from_tag_id
  ),
  hop_best AS (
    SELECT h.tag_id, max(h.base) AS base FROM hop h GROUP BY h.tag_id
  ),
  prior AS (
    SELECT p.tag_id, p.weight * 0.5 AS base FROM public.user_tag_prior(p_user) p
  ),
  combined AS (
    SELECT o.tag_id, o.base FROM own o
    UNION ALL SELECT h.tag_id, h.base FROM hop_best h
    UNION ALL SELECT p.tag_id, p.base FROM prior p
  )
  SELECT c.tag_id, round(sum(c.base), 4) AS weight
  FROM combined c
  GROUP BY c.tag_id
  HAVING sum(c.base) > 0
$$;

COMMENT ON FUNCTION public.user_tag_weight_map(UUID) IS
  'One weight per tag for a user: stored weight decayed 0.95 per week, plus one-hop tag_relations neighbours at half weight x the edge weight, plus the onboarding prior at half weight. The single input roam() v41 reads (D7).';

-- ── The profile a caller may read ────────────────────────────────────────────
-- `source` says where a row's evidence came from: 'actions' when the user has a
-- stored weight for the tag, 'prior' when it comes from their subcategories, and
-- 'graph' when it is only a one-hop neighbour of something they acted on. It is
-- informative - the weight column already carries the arithmetic.
--
-- SECURITY DEFINER and it takes a user id, so it refuses every caller but the
-- user and an admin (or the service role, which already bypasses RLS). Without
-- that guard the function would be a cross-user interest leak: a client could
-- read anyone's ranked profile without touching a table.
CREATE OR REPLACE FUNCTION public.user_tag_profile(
  p_user  UUID,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  tag_id       UUID,
  slug         TEXT,
  display_name TEXT,
  pillar       TEXT,
  weight       NUMERIC,
  source       TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_limit  INT  := least(greatest(coalesce(p_limit, 50), 1), 200);
BEGIN
  IF p_user IS NULL THEN
    RAISE EXCEPTION 'No user given' USING ERRCODE = '22023';
  END IF;

  IF v_caller IS DISTINCT FROM p_user
     AND coalesce(auth.role(), '') <> 'service_role'
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Cannot read another user''s tag profile' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH m AS (
    SELECT wm.tag_id, wm.weight FROM public.user_tag_weight_map(p_user) wm
  ),
  acted AS (
    SELECT uw.tag_id
    FROM public.user_tag_weights uw
    WHERE uw.user_id = p_user AND uw.weight > 0
  ),
  onboarding AS (
    SELECT pv.tag_id FROM public.user_tag_prior(p_user) pv
  )
  SELECT t.id, t.slug, t.display_name, t.pillar, m.weight,
         CASE WHEN a.tag_id IS NOT NULL THEN 'actions'
              WHEN o.tag_id IS NOT NULL THEN 'prior'
              ELSE 'graph' END
  FROM m
  JOIN public.tags t ON t.id = m.tag_id AND t.is_active
  LEFT JOIN acted a      ON a.tag_id = m.tag_id
  LEFT JOIN onboarding o ON o.tag_id = m.tag_id
  WHERE m.weight > 0
  ORDER BY m.weight DESC, t.slug
  LIMIT v_limit;
END;
$$;

COMMENT ON FUNCTION public.user_tag_profile(UUID, INT) IS
  'Ranked tag profile for one user: (tag_id, slug, display_name, pillar, weight, source) from user_tag_weight_map(), best first. Callable only by that user, an admin or the service role.';

REVOKE ALL ON FUNCTION public.user_tag_prior(UUID)           FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_tag_weight_map(UUID)      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_tag_profile(UUID, INT)    FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.user_tag_prior(UUID)        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_tag_weight_map(UUID)   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_tag_profile(UUID, INT) TO authenticated, service_role;

