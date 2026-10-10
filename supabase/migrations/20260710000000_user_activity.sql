-- User Activity table: powers the Following feed across all platforms.
-- Auto-populated by triggers on ratings, submissions, and collection actions.

-- Table
CREATE TABLE IF NOT EXISTS user_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,  -- 'url_rated', 'url_submitted', 'collection_created', 'badge_unlocked'
  subject_id uuid,              -- url_id or collection_id or badge_id
  subject_title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

-- RLS: users can only see activity from users they follow
CREATE POLICY "followers can view activity"
  ON user_activity FOR SELECT
  USING (
    user_id IN (
      SELECT following_id FROM follows
      WHERE follower_id = auth.uid()
    )
  );

-- Index for feed queries (newest first, by followed users)
CREATE INDEX IF NOT EXISTS idx_user_activity_feed
  ON user_activity(user_id, created_at DESC);

-- ── Triggers to auto-populate activity ─────────────────────────────────

-- Trigger on ratings (thumbs up / thumbs down)
CREATE OR REPLACE FUNCTION record_rating_activity()
RETURNS trigger AS $$
BEGIN
  INSERT INTO user_activity (user_id, activity_type, subject_id, subject_title)
  SELECT NEW.user_id, 'url_rated', NEW.url_id, u.title
  FROM urls u WHERE u.id = NEW.url_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_rating_activity ON ratings;
CREATE TRIGGER trg_rating_activity
  AFTER INSERT ON ratings
  FOR EACH ROW EXECUTE FUNCTION record_rating_activity();

-- Trigger on URL submissions
CREATE OR REPLACE FUNCTION record_submission_activity()
RETURNS trigger AS $$
BEGIN
  INSERT INTO user_activity (user_id, activity_type, subject_id, subject_title)
  VALUES (NEW.submitted_by, 'url_submitted', NEW.id, NEW.title);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_submission_activity ON urls;
CREATE TRIGGER trg_submission_activity
  AFTER INSERT ON urls
  FOR EACH ROW
  WHEN (NEW.submitted_by IS NOT NULL)
  EXECUTE FUNCTION record_submission_activity();

-- Trigger on collection creation
CREATE OR REPLACE FUNCTION record_collection_activity()
RETURNS trigger AS $$
BEGIN
  INSERT INTO user_activity (user_id, activity_type, subject_id, subject_title)
  VALUES (NEW.user_id, 'collection_created', NEW.id, NEW.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_collection_activity ON collections;
CREATE TRIGGER trg_collection_activity
  AFTER INSERT ON collections
  FOR EACH ROW EXECUTE FUNCTION record_collection_activity();

-- ── RPC: Get activity feed for the current user ────────────────────────

CREATE OR REPLACE FUNCTION get_activity_feed(p_limit INT DEFAULT 30)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  activity_type TEXT,
  subject_id uuid,
  subject_title TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
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
    ua.created_at
  FROM user_activity ua
  JOIN profiles p ON ua.user_id = p.id
  WHERE ua.user_id IN (
    SELECT following_id FROM follows
    WHERE follower_id = auth.uid()
  )
  ORDER BY ua.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;