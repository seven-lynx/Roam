-- =============================================================================
-- URL Share Notifications: create notifications when URLs are shared
-- =============================================================================
-- Previously, share_url_with_user() inserted into shared_urls and fired a
-- pg_notify() on the 'url_shared' channel, but nothing listened and no
-- notifications row was created. The recipient never found out they were
-- shared a URL.
--
-- This migration:
--   1. Adds 'url_shared' to the notifications.type CHECK constraint
--   2. Rewrites share_url_with_user() to INSERT a notification so the
--      push-notify edge function picks it up and delivers a push message
-- =============================================================================

-- ── 1. Add url_shared to the type CHECK constraint ─────────────────────────
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('url_approved', 'url_rejected', 'new_follower', 'badge_unlocked', 'level_up', 'url_shared'));

-- ── 2. Rewrite share_url_with_user to emit a notification ──────────────────
CREATE OR REPLACE FUNCTION share_url_with_user(
  p_recipient_id uuid,
  p_url_id uuid
)
RETURNS json AS $$
DECLARE
  v_sender_id uuid := auth.uid();
  v_share_id uuid;
  v_url_title TEXT;
  v_url_url TEXT;
  v_sender_username TEXT;
  v_recipient_username TEXT;
BEGIN
  -- Require authentication
  IF v_sender_id IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  -- Prevent sending to self
  IF v_sender_id = p_recipient_id THEN
    RETURN json_build_object('error', 'Cannot share with yourself');
  END IF;

  -- Verify recipient exists
  IF NOT EXISTS(SELECT 1 FROM profiles WHERE id = p_recipient_id) THEN
    RETURN json_build_object('error', 'Recipient not found');
  END IF;

  -- Verify URL exists
  IF NOT EXISTS(SELECT 1 FROM urls WHERE id = p_url_id) THEN
    RETURN json_build_object('error', 'URL not found');
  END IF;

  -- Attempt insert (UNIQUE constraint prevents duplicate shares)
  INSERT INTO shared_urls (sender_id, recipient_id, url_id)
  VALUES (v_sender_id, p_recipient_id, p_url_id)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_share_id;

  -- If insert returned nothing, the share already exists
  IF v_share_id IS NULL THEN
    RETURN json_build_object('error', 'URL already shared with this user');
  END IF;

  -- Get URL title, URL, and usernames for notification payload
  SELECT u.title, u.url, p1.username, p2.username
  INTO v_url_title, v_url_url, v_sender_username, v_recipient_username
  FROM urls u, profiles p1, profiles p2
  WHERE u.id = p_url_id AND p1.id = v_sender_id AND p2.id = p_recipient_id;

  -- Insert a notification so the push-notify edge function picks it up
  -- and delivers a push message (FCM / Web Push) to the recipient.
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    p_recipient_id,
    'url_shared',
    '@' || v_sender_username || ' shared a link with you',
    COALESCE(NULLIF(v_url_title, ''), v_url_url),
    jsonb_build_object(
      'url', v_url_url,
      'sender_username', v_sender_username,
      'sender_id', v_sender_id,
      'url_title', COALESCE(NULLIF(v_url_title, ''), v_url_url),
      'share_id', v_share_id
    )
  );

  RETURN json_build_object(
    'success', true,
    'share_id', v_share_id,
    'message', format('URL shared with %s', v_recipient_username)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;