-- Re-create get_user_badges if it was not applied to production.
-- Sentry error ROAM-ANDROID-W: "Could not find the function public.get_user_badges(p_user_id)"
-- This function was defined in 20260613000000_badges_gamification.sql but may not have been
-- applied to the production database. Running it again is safe (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.get_user_badges(p_user_id UUID)
RETURNS TABLE(
  id UUID,
  slug TEXT,
  name TEXT,
  description TEXT,
  icon TEXT,
  category TEXT,
  tier SMALLINT,
  required_count INT,
  is_unlocked BOOLEAN,
  unlocked_at TIMESTAMPTZ,
  progress_current INT,
  is_hidden BOOLEAN,
  is_gift_only BOOLEAN,
  xp_reward INT,
  parent_badge_slug TEXT,
  granted_by UUID
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.slug,
    b.name,
    b.description,
    b.icon,
    b.category,
    b.tier,
    b.required_count,
    (ub.user_id IS NOT NULL AND ub.unlocked_at IS NOT NULL) AS is_unlocked,
    ub.unlocked_at,
    COALESCE(ub.progress_current, 0)::INT,
    b.is_hidden,
    b.is_gift_only,
    b.xp_reward,
    b.parent_badge_slug,
    ub.granted_by
  FROM public.badges b
  LEFT JOIN public.user_badges ub
    ON ub.badge_id = b.id AND ub.user_id = p_user_id
  ORDER BY
    CASE b.category
      WHEN 'exploration'   THEN 1
      WHEN 'collecting'    THEN 2
      WHEN 'curating'      THEN 3
      WHEN 'social'        THEN 4
      WHEN 'streaks'       THEN 5
      WHEN 'contributing'  THEN 6
      WHEN 'engagement'    THEN 7
      WHEN 'milestone'     THEN 8
      WHEN 'secret'        THEN 9
      WHEN 'gift'          THEN 10
    END,
    b.tier,
    b.name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_badges FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_badges TO authenticated, service_role;
