-- Phase 2: Activity Feed
-- Tracks public user actions so followers can see what people are discovering.
-- Only records activity from users with public profiles.

-- Create user_activity table
CREATE TABLE IF NOT EXISTS user_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('url_submitted', 'url_rated', 'collection_created', 'collection_updated')),
  subject_id uuid,         -- url_id or collection_id
  subject_title TEXT,      -- cached title for fast display without joins
  subject_url TEXT,        -- cached URL for direct navigation
  collection_slug TEXT,    -- cached slug for collection links
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

-- RLS: Users can see their own activity
CREATE POLICY "users can view own activity"
  ON user_activity FOR SELECT
  USING (user_id = auth.uid());

-- RLS: Users can see activity from people they follow (who have public profiles)
CREATE POLICY "users can view activity from followed public users"
  ON user_activity FOR SELECT
  USING (
    user_id IN (
      SELECT f.following_id FROM follows f
      JOIN profiles p ON f.following_id = p.id
      WHERE f.follower_id = auth.uid()
        AND p.is_public = TRUE
    )
  );

-- Performance indices
CREATE INDEX IF NOT EXISTS idx_user_activity_user_created ON user_activity(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_created ON user_activity(created_at DESC);

-- Trigger function: log URL rating activity
CREATE OR REPLACE FUNCTION log_rating_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_title TEXT;
  v_url TEXT;
BEGIN
  -- Only log upvotes (value > 0) to avoid cluttering feed with downvote spam
  IF NEW.value > 0 THEN
    SELECT original_url, title INTO v_url, v_title
    FROM urls WHERE id = NEW.url_id;

    INSERT INTO user_activity (user_id, activity_type, subject_id, subject_title, subject_url)
    VALUES (NEW.user_id, 'url_rated', NEW.url_id, v_title, v_url)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: fire on new ratings
DROP TRIGGER IF EXISTS trg_log_rating_activity ON ratings;
CREATE TRIGGER trg_log_rating_activity
  AFTER INSERT OR UPDATE ON ratings
  FOR EACH ROW EXECUTE FUNCTION log_rating_activity();

-- Trigger function: log collection activity
CREATE OR REPLACE FUNCTION log_collection_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log public collection activity
  IF NEW.is_public = TRUE THEN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO user_activity (user_id, activity_type, subject_id, subject_title, collection_slug)
      VALUES (NEW.user_id, 'collection_created', NEW.id, NEW.name, NEW.slug)
      ON CONFLICT DO NOTHING;
    ELSIF TG_OP = 'UPDATE' AND OLD.is_public = FALSE AND NEW.is_public = TRUE THEN
      -- Collection made public counts as a notable activity
      INSERT INTO user_activity (user_id, activity_type, subject_id, subject_title, collection_slug)
      VALUES (NEW.user_id, 'collection_updated', NEW.id, NEW.name, NEW.slug)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: fire on collection inserts/updates
DROP TRIGGER IF EXISTS trg_log_collection_activity ON collections;
CREATE TRIGGER trg_log_collection_activity
  AFTER INSERT OR UPDATE ON collections
  FOR EACH ROW EXECUTE FUNCTION log_collection_activity();

-- Trigger function: log URL submission activity
CREATE OR REPLACE FUNCTION log_submission_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Log when a submitted URL gets approved
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    INSERT INTO user_activity (user_id, activity_type, subject_id, subject_title)
    VALUES (NEW.submitted_by, 'url_submitted', NEW.id, NEW.url)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: fire on moderation_queue status changes
DROP TRIGGER IF EXISTS trg_log_submission_activity ON moderation_queue;
CREATE TRIGGER trg_log_submission_activity
  AFTER UPDATE ON moderation_queue
  FOR EACH ROW EXECUTE FUNCTION log_submission_activity();

-- RPC Function: get activity feed for current user's following list
CREATE OR REPLACE FUNCTION get_activity_feed(
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  p_before TIMESTAMP DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  activity_type TEXT,
  subject_id uuid,
  subject_title TEXT,
  subject_url TEXT,
  collection_slug TEXT,
  created_at TIMESTAMP
) AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    ua.id,
    ua.user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    ua.activity_type,
    ua.subject_id,
    ua.subject_title,
    ua.subject_url,
    ua.collection_slug,
    ua.created_at
  FROM user_activity ua
  JOIN profiles p ON ua.user_id = p.id
  WHERE ua.user_id IN (
    SELECT f.following_id FROM follows f
    JOIN profiles fp ON f.following_id = fp.id
    WHERE f.follower_id = auth.uid()
      AND fp.is_public = TRUE
  )
  AND (p_before IS NULL OR ua.created_at < p_before)
  ORDER BY ua.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_activity_feed TO authenticated;

-- Clean up old activity entries (keep last 90 days)
-- This can be called periodically via a cron job or pg_cron
CREATE OR REPLACE FUNCTION cleanup_old_activity()
RETURNS void AS $$
BEGIN
  DELETE FROM user_activity WHERE created_at < now() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
