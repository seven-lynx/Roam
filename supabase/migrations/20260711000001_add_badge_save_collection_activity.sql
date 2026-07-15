-- Add badge_unlocked, url_saved, and url_added_to_collection to the activity feed.
-- Followers will see these alongside existing url_rated, url_submitted, collection_created.

-- ── 1. Add new columns to user_activity ──────────────────────────────────────
ALTER TABLE user_activity
  ADD COLUMN IF NOT EXISTS badge_icon TEXT,
  ADD COLUMN IF NOT EXISTS badge_name TEXT,
  ADD COLUMN IF NOT EXISTS subject_url TEXT,
  ADD COLUMN IF NOT EXISTS collection_slug TEXT;

-- ── 2. Trigger: badge_unlocked activity ──────────────────────────────────────
CREATE OR REPLACE FUNCTION record_badge_activity()
RETURNS trigger AS $$
DECLARE
  v_badge RECORD;
BEGIN
  -- Only fire when a badge transitions from not-unlocked to unlocked
  IF OLD.unlocked_at IS NULL AND NEW.unlocked_at IS NOT NULL THEN
    SELECT icon, name INTO v_badge
    FROM badges WHERE id = NEW.badge_id;

    INSERT INTO user_activity (user_id, activity_type, subject_id, subject_title, badge_icon, badge_name)
    VALUES (NEW.user_id, 'badge_unlocked', NEW.badge_id, v_badge.name, v_badge.icon, v_badge.name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_badge_activity ON user_badges;
CREATE TRIGGER trg_badge_activity
  AFTER UPDATE OF unlocked_at ON user_badges
  FOR EACH ROW EXECUTE FUNCTION record_badge_activity();

-- Also handle INSERT where unlocked_at is immediately set (backfills, gift badges)
CREATE OR REPLACE FUNCTION record_badge_insert_activity()
RETURNS trigger AS $$
DECLARE
  v_badge RECORD;
BEGIN
  IF NEW.unlocked_at IS NOT NULL THEN
    SELECT icon, name INTO v_badge
    FROM badges WHERE id = NEW.badge_id;

    INSERT INTO user_activity (user_id, activity_type, subject_id, subject_title, badge_icon, badge_name)
    VALUES (NEW.user_id, 'badge_unlocked', NEW.badge_id, v_badge.name, v_badge.icon, v_badge.name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_badge_insert_activity ON user_badges;
CREATE TRIGGER trg_badge_insert_activity
  AFTER INSERT ON user_badges
  FOR EACH ROW EXECUTE FUNCTION record_badge_insert_activity();

-- ── 3. Trigger: url_saved activity ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION record_save_activity()
RETURNS trigger AS $$
DECLARE
  v_url   TEXT;
  v_title TEXT;
BEGIN
  SELECT original_url, title INTO v_url, v_title
  FROM urls WHERE id = NEW.url_id;

  INSERT INTO user_activity (user_id, activity_type, subject_id, subject_title, subject_url)
  VALUES (NEW.user_id, 'url_saved', NEW.url_id, v_title, v_url);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_save_activity ON saved_urls;
CREATE TRIGGER trg_save_activity
  AFTER INSERT ON saved_urls
  FOR EACH ROW EXECUTE FUNCTION record_save_activity();

-- ── 4. Trigger: url_added_to_collection activity ─────────────────────────────
CREATE OR REPLACE FUNCTION record_collection_item_activity()
RETURNS trigger AS $$
DECLARE
  v_url       TEXT;
  v_title     TEXT;
  v_user_id   UUID;
  v_col_slug  TEXT;
  v_col_name  TEXT;
BEGIN
  SELECT original_url, title INTO v_url, v_title
  FROM urls WHERE id = NEW.url_id;

  SELECT user_id, slug, name INTO v_user_id, v_col_slug, v_col_name
  FROM collections WHERE id = NEW.collection_id;

  INSERT INTO user_activity (user_id, activity_type, subject_id, subject_title, subject_url, collection_slug)
  VALUES (v_user_id, 'url_added_to_collection', NEW.url_id, v_title, v_url, v_col_slug);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_collection_item_activity ON collection_items;
CREATE TRIGGER trg_collection_item_activity
  AFTER INSERT ON collection_items
  FOR EACH ROW EXECUTE FUNCTION record_collection_item_activity();

-- ── 5. Update get_activity_feed to include new columns and pagination ────────
DROP FUNCTION IF EXISTS get_activity_feed(INT);
CREATE OR REPLACE FUNCTION get_activity_feed(
  p_limit  INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  p_before TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  id              uuid,
  user_id         uuid,
  username        TEXT,
  display_name    TEXT,
  avatar_url      TEXT,
  activity_type   TEXT,
  subject_id      uuid,
  subject_title   TEXT,
  subject_url     TEXT,
  badge_icon      TEXT,
  badge_name      TEXT,
  collection_slug TEXT,
  created_at      TIMESTAMPTZ
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
    ua.subject_url,
    ua.badge_icon,
    ua.badge_name,
    ua.collection_slug,
    ua.created_at
  FROM user_activity ua
  JOIN profiles p ON ua.user_id = p.id
  WHERE ua.user_id IN (
    SELECT following_id FROM follows
    WHERE follower_id = auth.uid()
  )
  AND (p_before IS NULL OR ua.created_at < p_before)
  ORDER BY ua.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_activity_feed(INT, INT, TIMESTAMPTZ) TO authenticated;