-- Add missing indexes on collection_items and follows foreign-key columns.
-- Without these, lookups like "all collections containing URL X" or
-- "all followers of user Y" do a full table scan.

CREATE INDEX IF NOT EXISTS idx_collection_items_url_id
    ON collection_items (url_id);

CREATE INDEX IF NOT EXISTS idx_follows_follower_id
    ON follows (follower_id);

CREATE INDEX IF NOT EXISTS idx_follows_following_id
    ON follows (following_id);
