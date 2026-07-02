-- Phase 1: URL Sharing to Users
-- New table for sharing URLs directly with other users

-- Create shared_urls table
CREATE TABLE IF NOT EXISTS shared_urls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url_id uuid NOT NULL REFERENCES public.urls(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  -- Prevent duplicate shares of the same URL to the same recipient
  UNIQUE(sender_id, recipient_id, url_id)
);

-- Enable RLS
ALTER TABLE shared_urls ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view shares they sent
CREATE POLICY "users can view own shared urls"
  ON shared_urls FOR SELECT
  USING (sender_id = auth.uid());

-- RLS Policy: Users can view shares sent to them
CREATE POLICY "users can view shared urls sent to them"
  ON shared_urls FOR SELECT
  USING (recipient_id = auth.uid());

-- RLS Policy: Users can only insert shares as themselves
CREATE POLICY "users can share urls with others"
  ON shared_urls FOR INSERT
  WITH CHECK (sender_id = auth.uid());

-- Index for fast lookups by recipient (common query: "what has been shared with me")
CREATE INDEX IF NOT EXISTS idx_shared_urls_recipient ON shared_urls(recipient_id, created_at DESC);

-- Index for fast lookups by sender (for potential "sharing history" feature)
CREATE INDEX IF NOT EXISTS idx_shared_urls_sender ON shared_urls(sender_id, created_at DESC);

-- Index for preventing duplicate shares (helps enforce UNIQUE constraint)
CREATE INDEX IF NOT EXISTS idx_shared_urls_unique_check ON shared_urls(sender_id, recipient_id, url_id);

-- RPC Function: Share a URL with a specific user
CREATE OR REPLACE FUNCTION share_url_with_user(
  p_recipient_id uuid,
  p_url_id uuid
)
RETURNS json AS $$
DECLARE
  v_sender_id uuid := auth.uid();
  v_share_id uuid;
  v_url_title TEXT;
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

  -- Get URL title and usernames for notification payload
  SELECT u.title, p1.username, p2.username
  INTO v_url_title, v_sender_username, v_recipient_username
  FROM urls u, profiles p1, profiles p2
  WHERE u.id = p_url_id AND p1.id = v_sender_id AND p2.id = p_recipient_id;

  -- Trigger notification via pg_notify (for real-time push notification service)
  -- Listener will be the Edge Function or push notification service
  PERFORM pg_notify('url_shared', json_build_object(
    'recipient_id', p_recipient_id::text,
    'sender_id', v_sender_id::text,
    'sender_username', v_sender_username,
    'recipient_username', v_recipient_username,
    'url_id', p_url_id::text,
    'url_title', v_url_title,
    'share_id', v_share_id::text
  )::text);

  RETURN json_build_object(
    'success', true,
    'share_id', v_share_id,
    'message', format('URL shared with %s', v_recipient_username)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC Function: Get shared URLs for the current user (recently shared with them)
CREATE OR REPLACE FUNCTION get_shared_urls_for_user(
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  share_id uuid,
  sender_id uuid,
  sender_username TEXT,
  sender_avatar_url TEXT,
  url_id uuid,
  url_title TEXT,
  url_domain TEXT,
  url_og_image TEXT,
  created_at TIMESTAMP
) AS $$
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT 
    su.id,
    su.sender_id,
    p.username,
    p.avatar_url,
    su.url_id,
    u.title,
    u.domain,
    u.og_image_url,
    su.created_at
  FROM shared_urls su
  JOIN profiles p ON su.sender_id = p.id
  JOIN urls u ON su.url_id = u.id
  WHERE su.recipient_id = auth.uid()
  ORDER BY su.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC Function: Get list of eligible share recipients (followers + following)
CREATE OR REPLACE FUNCTION get_share_recipients(
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  user_id uuid,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  relationship TEXT  -- 'follower', 'following', or 'friend'
) AS $$
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  WITH followers_data AS (
    SELECT f.follower_id as user_id, 'follower' as relationship
    FROM follows f
    WHERE f.following_id = auth.uid() AND f.is_pending = FALSE
  ),
  following_data AS (
    SELECT f.following_id as user_id, 'following' as relationship
    FROM follows f
    WHERE f.follower_id = auth.uid() AND f.is_pending = FALSE
  ),
  all_connections AS (
    SELECT user_id, relationship FROM followers_data
    UNION
    SELECT user_id, relationship FROM following_data
  )
  SELECT 
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    ac.relationship
  FROM all_connections ac
  JOIN profiles p ON ac.user_id = p.id
  WHERE 
    (p_search IS NULL OR p.username ILIKE '%' || p_search || '%' OR p.display_name ILIKE '%' || p_search || '%')
    AND p.id != auth.uid()
  ORDER BY ac.relationship, p.username
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION share_url_with_user TO authenticated;
GRANT EXECUTE ON FUNCTION get_shared_urls_for_user TO authenticated;
GRANT EXECUTE ON FUNCTION get_share_recipients TO authenticated;
