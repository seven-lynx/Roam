-- =============================================================================
-- User discovery + follow notifications
-- =============================================================================
-- Adds the missing pieces that make the follow graph usable:
--   1. notify_on_new_follower  — a trigger that inserts a 'new_follower'
--      notification when someone follows you (the type already existed in the
--      schema and UI, but nothing ever created the row).
--   2. search_users            — full-user search by username / display name,
--      across every public profile (not just existing connections).
--   3. get_follow_suggestions  — "People you may like": popular public profiles
--      the current user does not already follow.
-- =============================================================================


-- ── 1. new_follower notification ──────────────────────────────────────────────
-- Fires on a completed follow (is_pending = FALSE), whether the row is inserted
-- directly (public profile) or transitions out of pending (accepted request).
-- SECURITY DEFINER because notifications has no user-facing INSERT policy.
CREATE OR REPLACE FUNCTION public.notify_on_new_follower()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
  v_username     TEXT;
  v_display_name TEXT;
  v_avatar_url   TEXT;
BEGIN
  -- Only notify for completed follows.
  IF NEW.is_pending THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, only notify when transitioning from pending -> completed so an
  -- accepted request notifies once and unrelated updates stay silent.
  IF TG_OP = 'UPDATE' AND OLD.is_pending = FALSE THEN
    RETURN NEW;
  END IF;

  SELECT username, display_name, avatar_url
    INTO v_username, v_display_name, v_avatar_url
    FROM public.profiles
   WHERE id = NEW.follower_id;

  -- No profile (shouldn't happen) — skip silently.
  IF v_username IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    NEW.following_id,
    'new_follower',
    'New follower',
    '@' || v_username || ' started following you',
    jsonb_build_object(
      'follower_id',  NEW.follower_id,
      'username',     v_username,
      'display_name', v_display_name,
      'avatar_url',   v_avatar_url,
      'url',          '/u/' || v_username
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_follower_insert ON public.follows;
CREATE TRIGGER trg_notify_new_follower_insert
  AFTER INSERT ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_new_follower();

DROP TRIGGER IF EXISTS trg_notify_new_follower_update ON public.follows;
CREATE TRIGGER trg_notify_new_follower_update
  AFTER UPDATE OF is_pending ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_new_follower();


-- ── 2. search_users ───────────────────────────────────────────────────────────
-- Searches every public profile by username or display name. Returns the
-- follower count and whether the current viewer already follows each result.
-- Available to anon (search still works logged-out; is_following is just FALSE).
CREATE OR REPLACE FUNCTION public.search_users(p_query TEXT, p_limit INT DEFAULT 20)
RETURNS TABLE (
  user_id        UUID,
  username       TEXT,
  display_name   TEXT,
  avatar_url     TEXT,
  bio            TEXT,
  follower_count BIGINT,
  is_following   BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.bio,
    (SELECT COUNT(*) FROM public.follows f
      WHERE f.following_id = p.id AND f.is_pending = FALSE),
    EXISTS (SELECT 1 FROM public.follows f2
      WHERE f2.follower_id = auth.uid() AND f2.following_id = p.id)
  FROM public.profiles p
  WHERE p.is_public = TRUE
    AND p.username IS NOT NULL
    AND (auth.uid() IS NULL OR p.id <> auth.uid())
    AND p_query IS NOT NULL
    AND length(btrim(p_query)) >= 1
    AND (p.username ILIKE '%' || btrim(p_query) || '%'
         OR p.display_name ILIKE '%' || btrim(p_query) || '%')
  ORDER BY
    (p.username ILIKE btrim(p_query) || '%') DESC,   -- prefix matches first
    (SELECT COUNT(*) FROM public.follows f3
      WHERE f3.following_id = p.id AND f3.is_pending = FALSE) DESC,
    p.username
  LIMIT LEAST(GREATEST(p_limit, 1), 50);
$$;

GRANT EXECUTE ON FUNCTION public.search_users(TEXT, INT) TO authenticated, anon;


-- ── 3. get_follow_suggestions ─────────────────────────────────────────────────
-- "People you may like": popular public profiles the viewer does not follow yet.
CREATE OR REPLACE FUNCTION public.get_follow_suggestions(p_limit INT DEFAULT 12)
RETURNS TABLE (
  user_id        UUID,
  username       TEXT,
  display_name   TEXT,
  avatar_url     TEXT,
  bio            TEXT,
  follower_count BIGINT,
  is_following   BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.bio,
    (SELECT COUNT(*) FROM public.follows f
      WHERE f.following_id = p.id AND f.is_pending = FALSE),
    FALSE
  FROM public.profiles p
  WHERE p.is_public = TRUE
    AND p.username IS NOT NULL
    AND (auth.uid() IS NULL OR p.id <> auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM public.follows f2
      WHERE f2.follower_id = auth.uid() AND f2.following_id = p.id
    )
  ORDER BY
    (SELECT COUNT(*) FROM public.follows f3
      WHERE f3.following_id = p.id AND f3.is_pending = FALSE) DESC,
    COALESCE(p.xp_total, 0) DESC,
    p.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 50);
$$;

GRANT EXECUTE ON FUNCTION public.get_follow_suggestions(INT) TO authenticated;
